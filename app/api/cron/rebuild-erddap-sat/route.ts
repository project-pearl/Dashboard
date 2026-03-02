// app/api/cron/rebuild-erddap-sat/route.ts
// Cron endpoint — fetches CoastWatch ERDDAP satellite-derived water quality
// (chlorophyll-a and SST) for US coastal waters.
// Schedule: daily via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setErddapSatCache, getErddapSatCacheStatus,
  isErddapSatBuildInProgress, setErddapSatBuildInProgress,
  gridKey,
  type SatellitePixel,
} from '@/lib/erddapSatCache';

// ── Config ───────────────────────────────────────────────────────────────────

const ERDDAP_BASE = 'https://coastwatch.noaa.gov/erddap/griddap';
const CHLOR_DATASET = 'noaacwNPPVIIRSchlaDaily';
const CHLOR_VAR = 'chlor_a';
const SST_DATASET = 'noaacrwsstDaily';
const SST_VAR = 'sea_surface_temperature';

// CONUS at 0.5° resolution
const LAT_START = 24;
const LAT_END = 50;
const LON_START = -130;
const LON_END = -65;
const STEP = 0.5;

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

  if (isErddapSatBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'ERDDAP-Sat build already in progress',
      cache: getErddapSatCacheStatus(),
    });
  }

  setErddapSatBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Fetch chlorophyll-a and SST in parallel, with separate try/catch
    const chlorUrl = `${ERDDAP_BASE}/${CHLOR_DATASET}.json?${CHLOR_VAR}[(last)][(${LAT_START}):(${STEP}):(${LAT_END})][(${LON_START}):(${STEP}):(${LON_END})]`;
    const sstUrl = `${ERDDAP_BASE}/${SST_DATASET}.json?${SST_VAR}[(last)][(${LAT_START}):(${STEP}):(${LAT_END})][(${LON_START}):(${STEP}):(${LON_END})]`;

    let chlorRows: ErddapRow[] = [];
    let sstRows: ErddapRow[] = [];
    let chlorError: string | null = null;
    let sstError: string | null = null;

    const [chlorResult, sstResult] = await Promise.allSettled([
      (async () => {
        try {
          console.log('[ERDDAP-Sat Cron] Fetching chlorophyll-a...');
          const res = await fetch(chlorUrl, {
            headers: { 'User-Agent': 'PEARL-Platform/1.0' },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          return parseErddapJson(json, CHLOR_VAR);
        } catch (e: any) {
          chlorError = e.message;
          console.warn(`[ERDDAP-Sat Cron] Chlorophyll fetch failed: ${e.message}`);
          return [];
        }
      })(),
      (async () => {
        try {
          console.log('[ERDDAP-Sat Cron] Fetching SST...');
          const res = await fetch(sstUrl, {
            headers: { 'User-Agent': 'PEARL-Platform/1.0' },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          return parseErddapJson(json, SST_VAR);
        } catch (e: any) {
          sstError = e.message;
          console.warn(`[ERDDAP-Sat Cron] SST fetch failed: ${e.message}`);
          return [];
        }
      })(),
    ]);

    if (chlorResult.status === 'fulfilled') chlorRows = chlorResult.value;
    if (sstResult.status === 'fulfilled') sstRows = sstResult.value;

    console.log(`[ERDDAP-Sat Cron] Chlor rows: ${chlorRows.length}, SST rows: ${sstRows.length}`);

    // Build a lookup map for SST by lat/lng for merging
    const sstMap = new Map<string, ErddapRow>();
    for (const row of sstRows) {
      sstMap.set(`${row.lat}_${row.lng}`, row);
    }

    // Merge into SatellitePixel records — use chlor as base, fill in SST
    const pixelMap = new Map<string, SatellitePixel>();

    for (const row of chlorRows) {
      const key = `${row.lat}_${row.lng}`;
      const sstRow = sstMap.get(key);
      pixelMap.set(key, {
        lat: row.lat,
        lng: row.lng,
        chlorA: row.value,
        sst: sstRow?.value ?? null,
        time: row.time || sstRow?.time || new Date().toISOString(),
      });
      sstMap.delete(key);
    }

    // Add any SST-only pixels not covered by chlor
    for (const [key, row] of Array.from(sstMap.entries())) {
      pixelMap.set(key, {
        lat: row.lat,
        lng: row.lng,
        chlorA: null,
        sst: row.value,
        time: row.time || new Date().toISOString(),
      });
    }

    const pixels = Array.from(pixelMap.values());

    // Build grid index
    const grid: Record<string, { pixels: SatellitePixel[] }> = {};
    for (const p of pixels) {
      const key = gridKey(p.lat, p.lng);
      if (!grid[key]) grid[key] = { pixels: [] };
      grid[key].pixels.push(p);
    }

    // Empty-data guard
    if (pixels.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[ERDDAP-Sat Cron] 0 pixels in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        chlorError,
        sstError,
        cache: getErddapSatCacheStatus(),
      });
    }

    await setErddapSatCache({
      _meta: {
        built: new Date().toISOString(),
        pixelCount: pixels.length,
        gridCells: Object.keys(grid).length,
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[ERDDAP-Sat Cron] Complete in ${elapsed}s — ${pixels.length} pixels, ${Object.keys(grid).length} cells`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      pixelCount: pixels.length,
      gridCells: Object.keys(grid).length,
      chlorRows: chlorRows.length,
      sstRows: sstRows.length,
      chlorError,
      sstError,
      cache: getErddapSatCacheStatus(),
    });

  } catch (err: any) {
    console.error('[ERDDAP-Sat Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'ERDDAP-Sat build failed' },
      { status: 500 },
    );
  } finally {
    setErddapSatBuildInProgress(false);
  }
}
