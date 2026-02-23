// app/api/cron/rebuild-ndbc/route.ts
// Cron endpoint — fetches NOAA NDBC buoy station data and latest observations.
// Parses activestations.xml for station metadata and latest_obs.txt for bulk
// observations. For WQ-flagged stations, fetches .ocean files for DO, pH, etc.
// Schedule: daily via Vercel cron (2 PM UTC) or manual trigger.

import { NextRequest, NextResponse } from 'next/server';
import {
  setNdbcCache, getNdbcCacheStatus,
  isNdbcBuildInProgress, setNdbcBuildInProgress,
  gridKey,
  type NdbcStation, type NdbcObservation, type NdbcOceanParams,
} from '@/lib/ndbcCache';

// ── Config ───────────────────────────────────────────────────────────────────

const STATIONS_URL = 'https://www.ndbc.noaa.gov/activestations.xml';
const LATEST_OBS_URL = 'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt';
const OCEAN_URL_BASE = 'https://www.ndbc.noaa.gov/data/realtime2';
const FETCH_TIMEOUT_MS = 30_000;
const OCEAN_FETCH_TIMEOUT_MS = 15_000;
const DELAY_MS = 300;

// Bounding boxes for priority states [west, south, east, north]
const STATE_BOUNDS: Record<string, [number, number, number, number]> = {
  MD: [-79.49, 37.91, -75.05, 39.72],
  VA: [-83.68, 36.54, -75.24, 39.47],
  DC: [-77.12, 38.79, -76.91, 38.99],
  PA: [-80.52, 39.72, -74.69, 42.27],
  DE: [-75.79, 38.45, -75.05, 39.84],
  FL: [-87.63, 24.40, -80.03, 31.00],
  WV: [-82.64, 37.20, -77.72, 40.64],
  CA: [-124.41, 32.53, -114.13, 42.01],
  TX: [-106.65, 25.84, -93.51, 36.50],
  NY: [-79.76, 40.50, -71.86, 45.02],
  NJ: [-75.56, 38.93, -73.89, 41.36],
  OH: [-84.82, 38.40, -80.52, 42.33],
  NC: [-84.32, 33.84, -75.46, 36.59],
  MA: [-73.51, 41.24, -69.93, 42.89],
  GA: [-85.61, 30.36, -80.84, 35.00],
  IL: [-91.51, 36.97, -87.50, 42.51],
  MI: [-90.42, 41.70, -82.41, 48.27],
  WA: [-124.85, 45.54, -116.92, 49.00],
  OR: [-124.57, 41.99, -116.46, 46.29],
};

// ── XML Parser (minimal, no dependencies) ───────────────────────────────────

function parseStationsXml(xml: string): Array<{
  id: string; name: string; lat: number; lng: number;
  type: string; owner: string; met: boolean; wq: boolean;
}> {
  const stations: Array<{
    id: string; name: string; lat: number; lng: number;
    type: string; owner: string; met: boolean; wq: boolean;
  }> = [];

  // Match <station> elements with attributes
  const stationRegex = /<station\s+([^>]+?)\/?\s*>/g;
  let match;

  while ((match = stationRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const get = (name: string) => {
      const m = new RegExp(`${name}="([^"]*)"`, 'i').exec(attrs);
      return m ? m[1] : '';
    };

    const lat = parseFloat(get('lat'));
    const lng = parseFloat(get('lon'));
    if (isNaN(lat) || isNaN(lng)) continue;

    stations.push({
      id: get('id'),
      name: get('name'),
      lat,
      lng,
      type: get('type') || 'unknown',
      owner: get('owner') || '',
      met: get('met') === 'y',
      wq: get('waterquality') === 'y',
    });
  }

  return stations;
}

// ── Text Parser ──────────────────────────────────────────────────────────────

function parseNum(val: string): number | null {
  if (!val || val === 'MM' || val === 'N/A') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function parseLatestObs(text: string): Map<string, { obs: NdbcObservation; lat: number; lng: number; time: string }> {
  const map = new Map<string, { obs: NdbcObservation; lat: number; lng: number; time: string }>();
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 18) continue;

    const stn = parts[0];
    const lat = parseNum(parts[1]);
    const lng = parseNum(parts[2]);
    if (lat === null || lng === null) continue;

    const yr = parts[3];
    const mo = parts[4];
    const dd = parts[5];
    const hh = parts[6];
    const mm = parts[7];
    const time = `${yr}-${mo}-${dd}T${hh}:${mm}:00Z`;

    map.set(stn, {
      lat,
      lng,
      time,
      obs: {
        windDir: parseNum(parts[8]),
        windSpeed: parseNum(parts[9]),
        gust: parseNum(parts[10]),
        waveHeight: parseNum(parts[11]),
        wavePeriod: parseNum(parts[12]),
        pressure: parseNum(parts[14]),   // skip APD (13), MWD (14) → PRES is at [14]
        airTemp: parseNum(parts[16]),
        waterTemp: parseNum(parts[17]),
        dewPoint: parseNum(parts[18]),
        tide: parts.length > 20 ? parseNum(parts[20]) : null,
      },
    });
  }

  return map;
}

function parseOceanFile(text: string): NdbcOceanParams | null {
  const lines = text.split('\n');
  // Find first data line (skip headers starting with #)
  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 8) continue;

    // Ocean file format: YY MM DD hh mm DEPTH OTMP COND SAL O2% O2PPM CLCON TURB PH EH
    return {
      depth: parseNum(parts[5]),
      oceanTemp: parseNum(parts[6]),
      salinity: parts.length > 8 ? parseNum(parts[8]) : null,
      dissolvedO2Pct: parts.length > 9 ? parseNum(parts[9]) : null,
      dissolvedO2Ppm: parts.length > 10 ? parseNum(parts[10]) : null,
      chlorophyll: parts.length > 11 ? parseNum(parts[11]) : null,
      turbidity: parts.length > 12 ? parseNum(parts[12]) : null,
      ph: parts.length > 13 ? parseNum(parts[13]) : null,
    };
  }
  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function isInPriorityState(lat: number, lng: number): boolean {
  for (const [, bounds] of Object.entries(STATE_BOUNDS)) {
    const [west, south, east, north] = bounds;
    if (lng >= west && lng <= east && lat >= south && lat <= north) return true;
  }
  return false;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isNdbcBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'NDBC build already in progress',
      cache: getNdbcCacheStatus(),
    });
  }

  setNdbcBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Step 1: Fetch station metadata
    console.log('[NDBC Cron] Fetching active stations...');
    const stationsRes = await fetch(STATIONS_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
    });
    if (!stationsRes.ok) throw new Error(`Stations XML: HTTP ${stationsRes.status}`);
    const stationsXml = await stationsRes.text();
    const allStations = parseStationsXml(stationsXml);
    console.log(`[NDBC Cron] Parsed ${allStations.length} active stations`);

    // Filter to priority states
    const priorityStations = allStations.filter(s => isInPriorityState(s.lat, s.lng));
    console.log(`[NDBC Cron] ${priorityStations.length} stations in priority states`);

    // Step 2: Fetch bulk latest observations
    console.log('[NDBC Cron] Fetching latest observations...');
    const obsRes = await fetch(LATEST_OBS_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
    });
    if (!obsRes.ok) throw new Error(`Latest obs: HTTP ${obsRes.status}`);
    const obsText = await obsRes.text();
    const obsMap = parseLatestObs(obsText);
    console.log(`[NDBC Cron] Parsed ${obsMap.size} observation rows`);

    // Step 3: Merge station metadata with observations
    const stationMap = new Map<string, typeof priorityStations[0]>();
    for (const s of priorityStations) stationMap.set(s.id, s);

    // Step 4: Fetch .ocean files for WQ-flagged stations
    const wqStations = priorityStations.filter(s => s.wq);
    console.log(`[NDBC Cron] ${wqStations.length} WQ stations — fetching ocean data...`);
    const oceanMap = new Map<string, NdbcOceanParams>();

    // Fetch in batches of 5
    for (let i = 0; i < wqStations.length; i += 5) {
      const batch = wqStations.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (s) => {
          const url = `${OCEAN_URL_BASE}/${s.id}.ocean`;
          const res = await fetch(url, {
            signal: AbortSignal.timeout(OCEAN_FETCH_TIMEOUT_MS),
            headers: { 'User-Agent': 'PEARL-Platform/1.0' },
          });
          if (!res.ok) return null;
          const text = await res.text();
          return { id: s.id, ocean: parseOceanFile(text) };
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value?.ocean) {
          oceanMap.set(r.value.id, r.value.ocean);
        }
      }

      if (i + 5 < wqStations.length) await delay(DELAY_MS);
    }
    console.log(`[NDBC Cron] Got ocean data for ${oceanMap.size} stations`);

    // Step 5: Build grid index
    const grid: Record<string, { stations: NdbcStation[] }> = {};
    let stationCount = 0;

    for (const s of priorityStations) {
      const obsData = obsMap.get(s.id);
      const station: NdbcStation = {
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        type: s.type,
        owner: s.owner,
        hasMeteo: s.met,
        hasWQ: s.wq,
        observation: obsData?.obs || null,
        ocean: oceanMap.get(s.id) || null,
        observedAt: obsData?.time || null,
      };

      const key = gridKey(s.lat, s.lng);
      if (!grid[key]) grid[key] = { stations: [] };
      grid[key].stations.push(station);
      stationCount++;
    }

    // Step 6: Store in cache
    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        stationCount,
        wqStationCount: oceanMap.size,
        gridCells: Object.keys(grid).length,
      },
      grid,
    };

    setNdbcCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[NDBC Cron] Build complete in ${elapsed}s — ${stationCount} stations, ` +
      `${oceanMap.size} WQ, ${Object.keys(grid).length} cells`
    );

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      totalActiveStations: allStations.length,
      priorityStations: stationCount,
      wqStations: oceanMap.size,
      gridCells: Object.keys(grid).length,
      cache: getNdbcCacheStatus(),
    });

  } catch (err: any) {
    console.error('[NDBC Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'NDBC build failed' },
      { status: 500 },
    );
  } finally {
    setNdbcBuildInProgress(false);
  }
}
