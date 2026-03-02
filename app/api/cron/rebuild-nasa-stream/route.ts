// app/api/cron/rebuild-nasa-stream/route.ts
// Cron endpoint — fetches NASA MODIS Aqua satellite data via PFEG CoastWatch
// ERDDAP (monthly chlorophyll-a + 8-day SST composites).
// Schedule: weekly Sunday via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setNasaStreamCache, getNasaStreamCacheStatus,
  isNasaStreamBuildInProgress, setNasaStreamBuildInProgress,
  gridKey,
  type NasaSatObs,
} from '@/lib/nasaStreamCache';

// ── Config ───────────────────────────────────────────────────────────────────

const ERDDAP_BASE = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap';
const CHLOR_DATASET = 'erdMH1chlamday';
const CHLOR_VAR = 'chlorophyll';
const SST_DATASET = 'erdMBsstd8day';
const SST_VAR = 'sst';

// CONUS at 1.0° resolution for broader coverage
const LAT_START = 24;
const LAT_END = 50;
const LON_START = -130;
const LON_END = -65;
const STEP = 1.0;

const FETCH_TIMEOUT_MS = 120_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === '' || v === 'NaN') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

interface ErddapRow {
  time: string;
  lat: number;
  lng: number;
  value: number | null;
}

/**
 * Parse ERDDAP JSON response format:
 * { table: { columnNames: [...], rows: [[time, lat, lon, value], ...] } }
 */
function parseErddapJson(json: any, varName: string): ErddapRow[] {
  const table = json?.table;
  if (!table?.columnNames || !table?.rows) return [];

  const cols = table.columnNames as string[];
  const timeIdx = cols.indexOf('time');
  const latIdx = cols.indexOf('latitude');
  const lngIdx = cols.indexOf('longitude');
  const valIdx = cols.indexOf(varName);

  if (latIdx === -1 || lngIdx === -1 || valIdx === -1) return [];

  const rows: ErddapRow[] = [];
  for (const row of table.rows) {
    const lat = parseNum(row[latIdx]);
    const lng = parseNum(row[lngIdx]);
    const value = parseNum(row[valIdx]);
    if (lat === null || lng === null) continue;

    rows.push({
      time: timeIdx >= 0 ? String(row[timeIdx]) : '',
      lat,
      lng,
      value,
    });
  }
  return rows;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isNasaStreamBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'NASA-Stream build already in progress',
      cache: getNasaStreamCacheStatus(),
    });
  }

  setNasaStreamBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Fetch MODIS chlor-a (monthly) and SST (8-day) in parallel
    const chlorUrl = `${ERDDAP_BASE}/${CHLOR_DATASET}.json?${CHLOR_VAR}[(last)][(${LAT_START}):(${STEP}):(${LAT_END})][(${LON_START}):(${STEP}):(${LON_END})]`;
    const sstUrl = `${ERDDAP_BASE}/${SST_DATASET}.json?${SST_VAR}[(last)][(${LAT_START}):(${STEP}):(${LAT_END})][(${LON_START}):(${STEP}):(${LON_END})]`;

    let chlorRows: ErddapRow[] = [];
    let sstRows: ErddapRow[] = [];
    let chlorError: string | null = null;
    let sstError: string | null = null;

    const [chlorResult, sstResult] = await Promise.allSettled([
      (async () => {
        try {
          console.log('[NASA-Stream Cron] Fetching MODIS chlorophyll-a (monthly)...');
          const res = await fetch(chlorUrl, {
            headers: { 'User-Agent': 'PEARL-Platform/1.0' },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          return parseErddapJson(json, CHLOR_VAR);
        } catch (e: any) {
          chlorError = e.message;
          console.warn(`[NASA-Stream Cron] MODIS chlor fetch failed: ${e.message}`);
          return [];
        }
      })(),
      (async () => {
        try {
          console.log('[NASA-Stream Cron] Fetching MODIS SST (8-day)...');
          const res = await fetch(sstUrl, {
            headers: { 'User-Agent': 'PEARL-Platform/1.0' },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          return parseErddapJson(json, SST_VAR);
        } catch (e: any) {
          sstError = e.message;
          console.warn(`[NASA-Stream Cron] MODIS SST fetch failed: ${e.message}`);
          return [];
        }
      })(),
    ]);

    if (chlorResult.status === 'fulfilled') chlorRows = chlorResult.value;
    if (sstResult.status === 'fulfilled') sstRows = sstResult.value;

    console.log(`[NASA-Stream Cron] MODIS chlor rows: ${chlorRows.length}, SST rows: ${sstRows.length}`);

    // Build a lookup map for SST by lat/lng for merging
    const sstMap = new Map<string, ErddapRow>();
    for (const row of sstRows) {
      sstMap.set(`${row.lat}_${row.lng}`, row);
    }

    // Merge into NasaSatObs records — use chlor as base, fill in SST
    const obsMap = new Map<string, NasaSatObs>();

    for (const row of chlorRows) {
      const key = `${row.lat}_${row.lng}`;
      const sstRow = sstMap.get(key);
      obsMap.set(key, {
        lat: row.lat,
        lng: row.lng,
        modisChlorA: row.value,
        modisSst: sstRow?.value ?? null,
        time: row.time || sstRow?.time || new Date().toISOString(),
      });
      sstMap.delete(key);
    }

    // Add any SST-only observations not covered by chlor
    for (const [key, row] of Array.from(sstMap.entries())) {
      obsMap.set(key, {
        lat: row.lat,
        lng: row.lng,
        modisChlorA: null,
        modisSst: row.value,
        time: row.time || new Date().toISOString(),
      });
    }

    const observations = Array.from(obsMap.values());

    // Build grid index
    const grid: Record<string, { observations: NasaSatObs[] }> = {};
    for (const obs of observations) {
      const key = gridKey(obs.lat, obs.lng);
      if (!grid[key]) grid[key] = { observations: [] };
      grid[key].observations.push(obs);
    }

    // Empty-data guard
    if (observations.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[NASA-Stream Cron] 0 observations in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        chlorError,
        sstError,
        cache: getNasaStreamCacheStatus(),
      });
    }

    await setNasaStreamCache({
      _meta: {
        built: new Date().toISOString(),
        obsCount: observations.length,
        gridCells: Object.keys(grid).length,
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[NASA-Stream Cron] Complete in ${elapsed}s — ${observations.length} obs, ${Object.keys(grid).length} cells`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      obsCount: observations.length,
      gridCells: Object.keys(grid).length,
      chlorRows: chlorRows.length,
      sstRows: sstRows.length,
      chlorError,
      sstError,
      cache: getNasaStreamCacheStatus(),
    });

  } catch (err: any) {
    console.error('[NASA-Stream Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'NASA-Stream build failed' },
      { status: 500 },
    );
  } finally {
    setNasaStreamBuildInProgress(false);
  }
}
