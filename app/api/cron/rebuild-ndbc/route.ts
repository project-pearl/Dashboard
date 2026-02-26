// app/api/cron/rebuild-ndbc/route.ts
// Cron endpoint — fetches NOAA NDBC buoy station data and latest observations
// for all 50 states + DC. Parses activestations.xml for station metadata and
// latest_obs.txt for bulk observations. For WQ-flagged stations, fetches .ocean
// files for DO, pH, etc.
// Schedule: daily via Vercel cron (2 PM UTC) or manual trigger.

export const maxDuration = 300;

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

// Bounding boxes for all 50 states + DC [west, south, east, north]
// Coastal buffers (~0.5°) included to capture nearshore buoys
const STATE_BOUNDS: Record<string, [number, number, number, number]> = {
  AL: [-88.47, 30.14, -84.89, 35.01],
  AK: [-179.15, 51.21, -129.98, 71.39],
  AZ: [-114.82, 31.33, -109.04, 37.00],
  AR: [-94.62, 33.00, -89.64, 36.50],
  CA: [-124.85, 32.53, -114.13, 42.01],
  CO: [-109.06, 36.99, -102.04, 41.00],
  CT: [-73.73, 40.95, -71.79, 42.05],
  DE: [-75.79, 38.45, -75.05, 39.84],
  DC: [-77.12, 38.79, -76.91, 38.99],
  FL: [-87.63, 24.40, -79.97, 31.00],
  GA: [-85.61, 30.36, -80.84, 35.00],
  HI: [-160.25, 18.91, -154.81, 22.24],
  ID: [-117.24, 41.99, -111.04, 49.00],
  IL: [-91.51, 36.97, -87.50, 42.51],
  IN: [-88.10, 37.77, -84.78, 41.76],
  IA: [-96.64, 40.38, -90.14, 43.50],
  KS: [-102.05, 36.99, -94.59, 40.00],
  KY: [-89.57, 36.50, -81.96, 39.15],
  LA: [-94.04, 28.93, -88.82, 33.02],
  ME: [-71.08, 42.98, -66.95, 47.46],
  MD: [-79.49, 37.91, -75.05, 39.72],
  MA: [-73.51, 41.24, -69.93, 42.89],
  MI: [-90.42, 41.70, -82.41, 48.27],
  MN: [-97.24, 43.50, -89.49, 49.38],
  MS: [-91.66, 30.17, -88.10, 34.99],
  MO: [-95.77, 36.00, -89.10, 40.61],
  MT: [-116.05, 44.36, -104.04, 49.00],
  NE: [-104.05, 40.00, -95.31, 43.00],
  NV: [-120.01, 35.00, -114.04, 42.00],
  NH: [-72.56, 42.70, -70.70, 45.31],
  NJ: [-75.56, 38.93, -73.89, 41.36],
  NM: [-109.05, 31.33, -103.00, 37.00],
  NY: [-79.76, 40.50, -71.86, 45.02],
  NC: [-84.32, 33.84, -75.46, 36.59],
  ND: [-104.05, 45.94, -96.55, 49.00],
  OH: [-84.82, 38.40, -80.52, 42.33],
  OK: [-103.00, 33.62, -94.43, 37.00],
  OR: [-124.57, 41.99, -116.46, 46.29],
  PA: [-80.52, 39.72, -74.69, 42.27],
  RI: [-71.86, 41.15, -71.12, 42.02],
  SC: [-83.35, 32.03, -78.54, 35.22],
  SD: [-104.06, 42.48, -96.44, 45.95],
  TN: [-90.31, 34.98, -81.65, 36.68],
  TX: [-106.65, 25.84, -93.51, 36.50],
  UT: [-114.05, 37.00, -109.04, 42.00],
  VT: [-73.44, 42.73, -71.46, 45.02],
  VA: [-83.68, 36.54, -75.24, 39.47],
  WA: [-124.85, 45.54, -116.92, 49.00],
  WV: [-82.64, 37.20, -77.72, 40.64],
  WI: [-92.89, 42.49, -86.25, 47.08],
  WY: [-111.06, 40.99, -104.05, 45.01],
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

function isInStateBounds(lat: number, lng: number): boolean {
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

    // Filter to stations within US state bounding boxes
    const usStations = allStations.filter(s => isInStateBounds(s.lat, s.lng));
    console.log(`[NDBC Cron] ${usStations.length} stations within US state bounds`);

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
    const stationMap = new Map<string, typeof usStations[0]>();
    for (const s of usStations) stationMap.set(s.id, s);

    // Step 4: Fetch .ocean files for WQ-flagged stations
    const wqStations = usStations.filter(s => s.wq);
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

    for (const s of usStations) {
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

    if (stationCount === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[NDBC Cron] 0 stations in ${elapsed}s — skipping cache save`);
      return NextResponse.json({ status: 'empty', duration: `${elapsed}s`, cache: getNdbcCacheStatus() });
    }

    await setNdbcCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[NDBC Cron] Build complete in ${elapsed}s — ${stationCount} stations, ` +
      `${oceanMap.size} WQ, ${Object.keys(grid).length} cells`
    );

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      totalActiveStations: allStations.length,
      usStations: stationCount,
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
