// app/api/cron/rebuild-coops/route.ts
// Cron endpoint — fetches NOAA CO-OPS tidal/coastal station data.
// Step 1: Bulk fetch station list. Step 2: Batch fetch latest observations.
// Schedule: every 6 hours via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setCoopsCache, getCoopsCacheStatus,
  isCoopsBuildInProgress, setCoopsBuildInProgress,
  gridKey,
  type CoopsStation,
} from '@/lib/coopsCache';

// ── Config ───────────────────────────────────────────────────────────────────

const STATIONS_URL = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=waterlevels';
const DATA_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 15_000;
const DELAY_MS = 200;

// US bounding box (includes AK, HI, territories)
function isUSStation(lat: number, lng: number): boolean {
  // CONUS
  if (lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66) return true;
  // Alaska
  if (lat >= 51 && lat <= 72 && lng >= -180 && lng <= -130) return true;
  // Hawaii
  if (lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154) return true;
  // US territories (PR, VI, Guam, etc.)
  if (lat >= 17 && lat <= 19 && lng >= -68 && lng <= -64) return true;
  if (lat >= 13 && lat <= 15 && lng >= 144 && lng <= 146) return true;
  return false;
}

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchLatestData(stationId: string, product: string): Promise<any> {
  const url = `${DATA_URL}?station=${stationId}&product=${product}&date=latest&datum=MLLW&units=metric&time_zone=gmt&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PEARL-Platform/1.0' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.[0] || null;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isCoopsBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'CO-OPS build already in progress',
      cache: getCoopsCacheStatus(),
    });
  }

  setCoopsBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Step 1: Fetch station list
    console.log('[CO-OPS Cron] Fetching station list...');
    const stationsRes = await fetch(STATIONS_URL, {
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!stationsRes.ok) throw new Error(`Station list: HTTP ${stationsRes.status}`);
    const stationsData = await stationsRes.json();
    const rawStations = stationsData?.stations || [];

    // Filter to US stations with valid coordinates
    const usStations = rawStations.filter((s: any) => {
      const lat = parseFloat(s.lat);
      const lng = parseFloat(s.lng);
      return !isNaN(lat) && !isNaN(lng) && isUSStation(lat, lng);
    });
    console.log(`[CO-OPS Cron] ${usStations.length} US stations (of ${rawStations.length} total)`);

    // Step 2: Batch fetch latest observations
    const stations: CoopsStation[] = [];
    let fetchErrors = 0;

    for (let i = 0; i < usStations.length; i += CONCURRENCY) {
      const batch = usStations.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (s: any) => {
          const id = s.id || s.stationId;
          try {
            // Fetch water level (primary product)
            const wl = await fetchLatestData(id, 'water_level');

            // Optionally fetch met data — use allSettled to not block on failures
            const [atResult, wtResult, windResult] = await Promise.allSettled([
              fetchLatestData(id, 'air_temperature'),
              fetchLatestData(id, 'water_temperature'),
              fetchLatestData(id, 'wind'),
            ]);

            const at = atResult.status === 'fulfilled' ? atResult.value : null;
            const wt = wtResult.status === 'fulfilled' ? wtResult.value : null;
            const wind = windResult.status === 'fulfilled' ? windResult.value : null;

            return {
              id,
              name: s.name || '',
              state: s.state || '',
              lat: parseFloat(s.lat),
              lng: parseFloat(s.lng),
              waterLevel: wl ? parseNum(wl.v) : null,
              waterLevelTime: wl?.t || null,
              airTemp: at ? parseNum(at.v) : null,
              waterTemp: wt ? parseNum(wt.v) : null,
              windSpeed: wind ? parseNum(wind.s) : null,
              windDir: wind?.dr || null,
            } as CoopsStation;
          } catch {
            fetchErrors++;
            return {
              id,
              name: s.name || '',
              state: s.state || '',
              lat: parseFloat(s.lat),
              lng: parseFloat(s.lng),
              waterLevel: null,
              waterLevelTime: null,
              airTemp: null,
              waterTemp: null,
              windSpeed: null,
              windDir: null,
            } as CoopsStation;
          }
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          stations.push(r.value);
        }
      }

      if (i + CONCURRENCY < usStations.length) await delay(DELAY_MS);
    }

    // Build grid index
    const grid: Record<string, { stations: CoopsStation[] }> = {};
    for (const s of stations) {
      const key = gridKey(s.lat, s.lng);
      if (!grid[key]) grid[key] = { stations: [] };
      grid[key].stations.push(s);
    }

    // Empty-data guard
    if (stations.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[CO-OPS Cron] 0 stations in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getCoopsCacheStatus(),
      });
    }

    await setCoopsCache({
      _meta: {
        built: new Date().toISOString(),
        stationCount: stations.length,
        gridCells: Object.keys(grid).length,
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[CO-OPS Cron] Complete in ${elapsed}s — ${stations.length} stations, ${Object.keys(grid).length} cells`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      stationCount: stations.length,
      gridCells: Object.keys(grid).length,
      fetchErrors,
      cache: getCoopsCacheStatus(),
    });

  } catch (err: any) {
    console.error('[CO-OPS Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'CO-OPS build failed' },
      { status: 500 },
    );
  } finally {
    setCoopsBuildInProgress(false);
  }
}
