// app/api/cron/rebuild-bwb/route.ts
// Cron endpoint — fetches Blue Water Baltimore / Water Reporter stations and
// latest parameter readings, deduplicates, and populates the in-memory spatial
// cache so the dashboard has data even when the API goes down.
// Schedule: daily via Vercel cron (12 PM UTC) or manual trigger.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setBwbCache, getBwbCacheStatus,
  isBwbBuildInProgress, setBwbBuildInProgress,
  gridKey,
  type BwbStation, type BwbParameter,
} from '@/lib/bwbCache';

// ── Config ───────────────────────────────────────────────────────────────────

const WR_BASE = 'https://api.waterreporter.org';
const DELAY_MS = 1000;

// Bounding boxes to sweep — covers MD, DC, VA, FL pilot regions
// Each is [west, south, east, north]
const SEARCH_BBOXES: Array<{ name: string; bbox: string }> = [
  // Maryland — Baltimore metro + harbor
  { name: 'Baltimore', bbox: '-76.75,39.15,-76.40,39.35' },
  // Maryland — Chesapeake western shore
  { name: 'MD Western Shore', bbox: '-76.75,38.85,-76.45,39.15' },
  // Maryland — Eastern Shore
  { name: 'MD Eastern Shore', bbox: '-76.20,38.00,-75.50,39.45' },
  // Maryland — Western + Central
  { name: 'MD Western', bbox: '-79.50,39.15,-77.20,39.60' },
  // Maryland — Southern + Patuxent
  { name: 'MD Southern', bbox: '-76.85,38.30,-76.45,38.85' },
  // DC + Northern VA
  { name: 'DC Metro', bbox: '-77.20,38.80,-76.90,39.00' },
  // Virginia — Chesapeake
  { name: 'VA Chesapeake', bbox: '-76.60,36.75,-76.20,37.35' },
  // Florida — Pensacola pilot area
  { name: 'FL Pensacola', bbox: '-87.35,30.30,-86.80,30.70' },
];

// ── Water Reporter API helper ────────────────────────────────────────────────

function getToken(): string {
  return process.env.WATER_REPORTER_API_KEY || '';
}

async function wrFetch<T = any>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const token = getToken();
  if (!token || token === 'your_token_here') return null;

  const url = new URL(`${WR_BASE}${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`[BWB Cron] ${path}: HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(`[BWB Cron] ${path}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check API key
  const token = getToken();
  if (!token || token === 'your_token_here') {
    return NextResponse.json({
      status: 'error',
      error: 'WATER_REPORTER_API_KEY not configured',
    }, { status: 500 });
  }

  // Prevent concurrent builds
  if (isBwbBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'BWB build already in progress',
      cache: getBwbCacheStatus(),
    });
  }

  setBwbBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Step 1: Discover datasets across all bboxes
    const datasetIds = new Set<number>();
    const datasetNames = new Map<number, string>();

    for (const region of SEARCH_BBOXES) {
      console.log(`[BWB Cron] Scanning datasets in ${region.name}...`);
      const data = await wrFetch<any>('/datasets', {
        bbox: region.bbox,
        limit: '100',
      });

      if (data?.results) {
        for (const ds of data.results) {
          if (ds.id) {
            datasetIds.add(ds.id);
            datasetNames.set(ds.id, ds.name || `Dataset ${ds.id}`);
          }
        }
      }
      await delay(DELAY_MS);
    }

    console.log(`[BWB Cron] Found ${datasetIds.size} datasets`);

    // Step 2: Fetch stations for each dataset
    const allStations: BwbStation[] = [];
    const stationsSeen = new Set<string>(); // dedup key: datasetId|stationId
    let totalReadings = 0;

    for (const dsId of datasetIds) {
      console.log(`[BWB Cron] Fetching stations for dataset ${dsId} (${datasetNames.get(dsId)})...`);

      const stationData = await wrFetch<any>('/stations', {
        sets: String(dsId),
        geo_format: 'xy',
      });

      const features = stationData?.features;
      if (!Array.isArray(features) || features.length === 0) {
        await delay(DELAY_MS);
        continue;
      }

      for (const s of features) {
        const lat = parseFloat(s.lat || s.latitude || '');
        const lng = parseFloat(s.lng || s.longitude || '');
        if (isNaN(lat) || isNaN(lng) || lat <= 0) continue;

        const dedupKey = `${dsId}|${s.id}`;
        if (stationsSeen.has(dedupKey)) continue;
        stationsSeen.add(dedupKey);

        // Fetch parameters for this station
        await delay(500);
        const paramData = await wrFetch<any>('/parameters', {
          dataset_id: String(dsId),
          station_id: String(s.id),
        });

        const parameters: BwbParameter[] = [];
        if (paramData?.features) {
          for (const p of paramData.features) {
            parameters.push({
              name: p.name || '',
              normalizedName: p.normalized_name || '',
              unit: p.unit || '',
              latestValue: p.newest_value ?? null,
              latestDate: p.last_sampled || null,
            });
          }
        }

        totalReadings += parameters.length;

        allStations.push({
          stationId: s.id,
          datasetId: dsId,
          name: s.name || '',
          lat: Math.round(lat * 100000) / 100000,
          lng: Math.round(lng * 100000) / 100000,
          isActive: s.is_active !== false,
          lastSampled: s.last_sampled || '',
          parameters,
        });
      }

      await delay(DELAY_MS);
    }

    console.log(`[BWB Cron] Collected ${allStations.length} stations, ${totalReadings} parameter readings`);

    // Step 3: Build grid index
    const grid: Record<string, { stations: BwbStation[] }> = {};

    for (const s of allStations) {
      const key = gridKey(s.lat, s.lng);
      if (!grid[key]) grid[key] = { stations: [] };
      grid[key].stations.push(s);
    }

    // Step 4: Store in memory
    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        stationCount: allStations.length,
        parameterReadings: totalReadings,
        datasetsScanned: datasetIds.size,
        gridCells: Object.keys(grid).length,
      },
      grid,
    };

    setBwbCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[BWB Cron] Build complete in ${elapsed}s — ` +
      `${allStations.length} stations, ${totalReadings} readings, ` +
      `${datasetIds.size} datasets, ${Object.keys(grid).length} cells`
    );

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      stations: allStations.length,
      parameterReadings: totalReadings,
      datasetsScanned: datasetIds.size,
      gridCells: Object.keys(grid).length,
      datasets: Object.fromEntries(datasetNames),
      cache: getBwbCacheStatus(),
    });

  } catch (err: any) {
    console.error('[BWB Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'BWB build failed' },
      { status: 500 },
    );
  } finally {
    setBwbBuildInProgress(false);
  }
}
