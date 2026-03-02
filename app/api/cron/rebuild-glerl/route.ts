// app/api/cron/rebuild-glerl/route.ts
// Cron endpoint — fetches GLERL CoastWatch ERDDAP Great Lakes surface temp + ice cover.
// Fetches latest SST and ice cover grids, builds spatial cache.
// Schedule: daily via Vercel cron.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setGlerlCache, getGlerlCacheStatus,
  isGlerlBuildInProgress, setGlerlBuildInProgress,
  gridKey,
  type GlerlPixel,
} from '@/lib/glerlCache';

// ── Config ───────────────────────────────────────────────────────────────────

const ERDDAP_BASE = 'https://coastwatch.glerl.noaa.gov/erddap/griddap/GLSEA_GCS.json';
const SST_URL = `${ERDDAP_BASE}?sst[(last)][(41):(49)][(-92):(-76)]`;
const ICE_URL = `${ERDDAP_BASE}?ice_cover[(last)][(41):(49)][(-92):(-76)]`;
const FETCH_TIMEOUT_MS = 90_000; // ERDDAP can be slow

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === '' || v === 'NaN') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? null : n;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isGlerlBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'GLERL build already in progress',
      cache: getGlerlCacheStatus(),
    });
  }

  setGlerlBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Fetch SST and ice cover in parallel
    console.log('[GLERL Cron] Fetching SST and ice cover from ERDDAP...');

    const [sstResult, iceResult] = await Promise.allSettled([
      fetch(SST_URL, {
        headers: { 'User-Agent': 'PEARL-Platform/1.0' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }).then(r => {
        if (!r.ok) throw new Error(`SST: HTTP ${r.status}`);
        return r.json();
      }),
      fetch(ICE_URL, {
        headers: { 'User-Agent': 'PEARL-Platform/1.0' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }).then(r => {
        if (!r.ok) throw new Error(`Ice: HTTP ${r.status}`);
        return r.json();
      }),
    ]);

    // SST is the primary dataset — must succeed
    if (sstResult.status === 'rejected') {
      throw new Error(`SST fetch failed: ${sstResult.reason}`);
    }
    const sstData = sstResult.value;

    // Ice cover is optional (unavailable in summer months)
    let iceData: any = null;
    if (iceResult.status === 'fulfilled') {
      iceData = iceResult.value;
      console.log('[GLERL Cron] Ice cover data loaded');
    } else {
      console.warn(`[GLERL Cron] Ice cover unavailable (may be summer): ${iceResult.reason}`);
    }

    // Parse ERDDAP JSON table format: { table: { columnNames, rows } }
    const sstTable = sstData?.table;
    if (!sstTable?.columnNames || !sstTable?.rows) {
      throw new Error('Invalid SST ERDDAP response format');
    }

    const sstCols = sstTable.columnNames as string[];
    const sstRows = sstTable.rows as any[][];

    const timeIdx = sstCols.indexOf('time');
    const latIdx = sstCols.indexOf('latitude');
    const lngIdx = sstCols.indexOf('longitude');
    const sstIdx = sstCols.indexOf('sst');

    if (latIdx === -1 || lngIdx === -1 || sstIdx === -1) {
      throw new Error(`Missing SST columns. Found: ${sstCols.join(', ')}`);
    }

    // Build ice cover lookup map: "lat_lng" -> ice_cover value
    const iceMap = new Map<string, number | null>();
    if (iceData?.table?.columnNames && iceData?.table?.rows) {
      const iceCols = iceData.table.columnNames as string[];
      const iceRows = iceData.table.rows as any[][];
      const iceLatIdx = iceCols.indexOf('latitude');
      const iceLngIdx = iceCols.indexOf('longitude');
      const iceValIdx = iceCols.indexOf('ice_cover');

      if (iceLatIdx !== -1 && iceLngIdx !== -1 && iceValIdx !== -1) {
        for (const row of iceRows) {
          const lat = parseNum(row[iceLatIdx]);
          const lng = parseNum(row[iceLngIdx]);
          if (lat !== null && lng !== null) {
            iceMap.set(`${lat.toFixed(4)}_${lng.toFixed(4)}`, parseNum(row[iceValIdx]));
          }
        }
      }
    }

    // Build pixels from SST rows
    const pixels: GlerlPixel[] = [];
    for (const row of sstRows) {
      const lat = parseNum(row[latIdx]);
      const lng = parseNum(row[lngIdx]);
      const sst = parseNum(row[sstIdx]);

      if (lat === null || lng === null) continue;
      // Skip NaN SST values (land pixels)
      if (sst === null) continue;

      const iceKey = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
      const ice = iceMap.get(iceKey) ?? null;
      const time = timeIdx !== -1 ? String(row[timeIdx] || '') : '';

      pixels.push({
        lat,
        lng,
        lakeSurfaceTemp: sst,
        iceCover: ice,
        time,
      });
    }

    console.log(`[GLERL Cron] Parsed ${pixels.length} water pixels from ${sstRows.length} SST rows`);

    // Build grid index
    const grid: Record<string, { pixels: GlerlPixel[] }> = {};
    for (const p of pixels) {
      const key = gridKey(p.lat, p.lng);
      if (!grid[key]) grid[key] = { pixels: [] };
      grid[key].pixels.push(p);
    }

    // Empty-data guard
    if (pixels.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[GLERL Cron] 0 pixels in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getGlerlCacheStatus(),
      });
    }

    await setGlerlCache({
      _meta: {
        built: new Date().toISOString(),
        pixelCount: pixels.length,
        gridCells: Object.keys(grid).length,
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[GLERL Cron] Complete in ${elapsed}s — ${pixels.length} pixels, ${Object.keys(grid).length} cells`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      pixelCount: pixels.length,
      gridCells: Object.keys(grid).length,
      iceAvailable: iceData !== null,
      cache: getGlerlCacheStatus(),
    });

  } catch (err: any) {
    console.error('[GLERL Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'GLERL build failed' },
      { status: 500 },
    );
  } finally {
    setGlerlBuildInProgress(false);
  }
}
