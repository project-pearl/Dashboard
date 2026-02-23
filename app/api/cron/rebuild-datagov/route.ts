// app/api/cron/rebuild-datagov/route.ts
// Cron endpoint — indexes water quality datasets from catalog.data.gov CKAN API.
// Searches for WQ-related datasets and caches metadata (titles, orgs, formats, URLs).
// Schedule: weekly via Vercel cron (Sunday 5 AM UTC) or manual trigger.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setDataGovCache, getDataGovCacheStatus,
  isDataGovBuildInProgress, setDataGovBuildInProgress,
  type DataGovDataset,
} from '@/lib/dataGovCache';

// ── Config ───────────────────────────────────────────────────────────────────

const CKAN_BASE = 'https://catalog.data.gov/api/3/action/package_search';
const FETCH_TIMEOUT_MS = 30_000;
const DELAY_MS = 1000;
const PAGE_SIZE = 100;
const MAX_DATASETS = 500; // Cap to keep cache manageable

// Search queries to cover water quality datasets
const SEARCH_QUERIES = [
  'water quality monitoring',
  'drinking water contamination',
  'wastewater discharge',
  'surface water assessment',
  'groundwater quality',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function searchCkan(query: string, start: number): Promise<{ results: any[]; count: number } | null> {
  try {
    const params = new URLSearchParams({
      q: query,
      rows: String(PAGE_SIZE),
      start: String(start),
      sort: 'metadata_modified desc',
    });
    const res = await fetch(`${CKAN_BASE}?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.success) return null;
    return { results: data.result.results || [], count: data.result.count || 0 };
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

  if (isDataGovBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Data.gov build already in progress',
      cache: getDataGovCacheStatus(),
    });
  }

  setDataGovBuildInProgress(true);
  const startTime = Date.now();

  try {
    const datasetMap = new Map<string, DataGovDataset>(); // Dedup by ID
    const orgs: Record<string, number> = {};
    const tags: Record<string, number> = {};

    for (const query of SEARCH_QUERIES) {
      console.log(`[Data.gov Cron] Searching: "${query}"...`);
      let start = 0;

      while (datasetMap.size < MAX_DATASETS) {
        const result = await searchCkan(query, start);
        if (!result || result.results.length === 0) break;

        for (const pkg of result.results) {
          if (datasetMap.has(pkg.id)) continue;

          const org = pkg.organization?.title || pkg.organization?.name || 'Unknown';
          orgs[org] = (orgs[org] || 0) + 1;

          const pkgTags = (pkg.tags || []).map((t: any) => t.display_name || t.name);
          for (const tag of pkgTags) {
            tags[tag] = (tags[tag] || 0) + 1;
          }

          const formats = (pkg.resources || [])
            .map((r: any) => (r.format || '').toUpperCase())
            .filter((f: string) => f);
          const uniqueFormats = [...new Set(formats)];

          const spatial = pkg.extras?.find((e: any) => e.key === 'spatial')?.value || null;

          datasetMap.set(pkg.id, {
            id: pkg.id,
            title: pkg.title || '',
            organization: org,
            description: (pkg.notes || '').slice(0, 300),
            url: `https://catalog.data.gov/dataset/${pkg.name || pkg.id}`,
            formats: uniqueFormats,
            tags: pkgTags.slice(0, 10),
            modified: pkg.metadata_modified || '',
            spatial,
          });
        }

        if (result.results.length < PAGE_SIZE) break;
        start += PAGE_SIZE;
        await delay(DELAY_MS);
      }

      await delay(DELAY_MS);
    }

    // Sort tags by frequency, keep top 30
    const topTags: Record<string, number> = {};
    const sortedTags = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 30);
    for (const [tag, count] of sortedTags) topTags[tag] = count;

    const datasets = [...datasetMap.values()];

    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        datasetCount: datasets.length,
        organizations: orgs,
        topTags,
      },
      datasets,
    };

    setDataGovCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Data.gov Cron] Built in ${elapsed}s — ${datasets.length} datasets`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      datasets: datasets.length,
      organizations: Object.keys(orgs).length,
      cache: getDataGovCacheStatus(),
    });

  } catch (err: any) {
    console.error('[Data.gov Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'Data.gov build failed' },
      { status: 500 },
    );
  } finally {
    setDataGovBuildInProgress(false);
  }
}
