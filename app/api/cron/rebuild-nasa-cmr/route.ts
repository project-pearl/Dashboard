// app/api/cron/rebuild-nasa-cmr/route.ts
// Cron endpoint — indexes water quality-relevant NASA satellite datasets from CMR.
// Queries collection metadata + granule counts for key WQ collections.
// Schedule: daily via Vercel cron (3 PM UTC) or manual trigger.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setNasaCmrCache, getNasaCmrCacheStatus,
  isNasaCmrBuildInProgress, setNasaCmrBuildInProgress,
  type NasaCmrCollection,
} from '@/lib/nasaCmrCache';

// ── Config ───────────────────────────────────────────────────────────────────

const CMR_BASE = 'https://cmr.earthdata.nasa.gov/search';
const FETCH_TIMEOUT_MS = 20_000;
const DELAY_MS = 300;

// Curated list of water quality-relevant collections
const WQ_COLLECTIONS: Array<{ conceptId: string; category: string }> = [
  // Chlorophyll-a (algal blooms)
  { conceptId: 'C3380709133-OB_CLOUD', category: 'chlorophyll' },   // MODIS Aqua L3 Chl
  { conceptId: 'C3384237428-OB_CLOUD', category: 'chlorophyll' },   // MODIS Terra L3 Chl
  { conceptId: 'C3416412382-OB_CLOUD', category: 'chlorophyll' },   // Sentinel-3 Cyanobacteria
  { conceptId: 'C3406447185-OB_CLOUD', category: 'chlorophyll' },   // Sentinel-3A OLCI Chl
  // Sea Surface Temperature
  { conceptId: 'C1940473819-POCLOUD', category: 'sst' },            // MODIS Aqua SST
  { conceptId: 'C1996881146-POCLOUD', category: 'sst' },            // MUR Global SST
  // Ocean Color
  { conceptId: 'C3396928899-OB_CLOUD', category: 'ocean-color' },   // VIIRS J1 Ocean Color
  { conceptId: 'C3388381264-OB_CLOUD', category: 'ocean-color' },   // VIIRS NPP Ocean Color
  // Precipitation
  { conceptId: 'C2723754864-GES_DISC', category: 'precipitation' }, // GPM IMERG Daily
  { conceptId: 'C2723754859-GES_DISC', category: 'precipitation' }, // GPM IMERG Late Daily
  // Surface Water
  { conceptId: 'C2799438271-POCLOUD', category: 'surface-water' },  // SWOT Water Raster
  { conceptId: 'C2617126679-POCLOUD', category: 'surface-water' },  // OPERA Dynamic Surface Water
  // Landsat/Sentinel (custom WQ derivation)
  { conceptId: 'C2021957657-LPCLOUD', category: 'surface-reflectance' }, // HLS Landsat
  { conceptId: 'C2021957295-LPCLOUD', category: 'surface-reflectance' }, // HLS Sentinel-2
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchCollection(conceptId: string): Promise<any | null> {
  try {
    const url = `${CMR_BASE}/collections.json?concept_id=${conceptId}&include_granule_counts=true`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'Accept': 'application/json',
        'Client-Id': 'PEARL-Platform',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.feed?.entry?.[0] || null;
  } catch {
    return null;
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isNasaCmrBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'NASA CMR build already in progress',
      cache: getNasaCmrCacheStatus(),
    });
  }

  setNasaCmrBuildInProgress(true);
  const startTime = Date.now();

  try {
    const collections: NasaCmrCollection[] = [];
    const categories: Record<string, number> = {};
    let totalGranules = 0;

    // Fetch in batches of 4
    for (let i = 0; i < WQ_COLLECTIONS.length; i += 4) {
      const batch = WQ_COLLECTIONS.slice(i, i + 4);

      const results = await Promise.allSettled(
        batch.map(async ({ conceptId, category }) => {
          const entry = await fetchCollection(conceptId);
          if (!entry) return null;

          const granuleCount = parseInt(entry.granule_count || '0', 10);
          const platforms = Array.isArray(entry.platforms) ? entry.platforms.join(', ') : '';

          const col: NasaCmrCollection = {
            conceptId: entry.id || conceptId,
            shortName: entry.short_name || '',
            title: entry.title || '',
            platform: platforms,
            instrument: '',
            processingLevel: entry.processing_level_id || '',
            category,
            timeStart: entry.time_start || null,
            timeEnd: entry.time_end || null,
            granuleCount,
            cloudHosted: entry.cloud_hosted === true,
            spatialExtent: Array.isArray(entry.boxes) ? entry.boxes[0] : '',
            updatedAt: entry.updated || '',
          };

          return col;
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          collections.push(r.value);
          categories[r.value.category] = (categories[r.value.category] || 0) + 1;
          totalGranules += r.value.granuleCount;
        }
      }

      if (i + 4 < WQ_COLLECTIONS.length) await delay(DELAY_MS);
    }

    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        collectionCount: collections.length,
        totalGranules,
        categories,
      },
      collections,
    };

    await setNasaCmrCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[NASA CMR Cron] Built in ${elapsed}s — ${collections.length} collections, ${totalGranules} granules`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      collections: collections.length,
      totalGranules,
      categories,
      cache: getNasaCmrCacheStatus(),
    });

  } catch (err: any) {
    console.error('[NASA CMR Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'NASA CMR build failed' },
      { status: 500 },
    );
  } finally {
    setNasaCmrBuildInProgress(false);
  }
}
