// app/api/cron/rebuild-cms/route.ts
// Cron endpoint — fetches CMS Provider Data (Hospital Compare and Nursing Home
// Compare) from the CMS Socrata API, processes records, builds the cache.
// Schedule: daily at 4:15 AM UTC.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setCMSCache,
  getCMSCacheStatus,
  isBuildInProgress,
  setBuildInProgress,
  processCMSData,
  buildCMSCacheData,
} from '@/lib/cmsCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const CMS_SOCRATA_API = 'https://data.cms.gov/provider-data/api/1/datastore/sql';
const HOSPITAL_DATASET_ID = 'xubh-q36u';
const NURSING_HOME_DATASET_ID = '4pq5-n9py';
const FETCH_TIMEOUT_MS = 60_000;
const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchCMSDataset(
  datasetId: string,
  datasetLabel: string,
): Promise<any[]> {
  const allRows: any[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const query = `[SELECT * FROM ${datasetId}][LIMIT ${PAGE_SIZE} OFFSET ${offset}]`;

    try {
      const url = `${CMS_SOCRATA_API}?${new URLSearchParams({ query })}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        console.warn(`[CMS Cron] ${datasetLabel} page ${page}: HTTP ${res.status}`);
        break;
      }

      const data = await res.json();
      const rows = Array.isArray(data) ? data : data?.rows || data?.results || [];

      if (!Array.isArray(rows) || rows.length === 0) {
        console.log(`[CMS Cron] ${datasetLabel}: finished at page ${page} (${allRows.length} rows)`);
        break;
      }

      allRows.push(...rows);
      console.log(`[CMS Cron] ${datasetLabel} page ${page}: ${rows.length} rows (total ${allRows.length})`);

      if (rows.length < PAGE_SIZE) break;
    } catch (e: any) {
      console.warn(`[CMS Cron] ${datasetLabel} page ${page}: ${e.message}`);
      break;
    }
  }

  return allRows;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'CMS build already in progress',
      cache: getCMSCacheStatus(),
    });
  }

  setBuildInProgress(true);
  const startTime = Date.now();

  try {
    // ── Fetch Hospital Compare ──────────────────────────────────────
    console.log('[CMS Cron] Fetching Hospital Compare data...');
    const hospitalRows = await fetchCMSDataset(HOSPITAL_DATASET_ID, 'Hospital Compare');
    console.log(`[CMS Cron] Hospital Compare: ${hospitalRows.length} rows`);

    // ── Fetch Nursing Home Compare ──────────────────────────────────
    console.log('[CMS Cron] Fetching Nursing Home Compare data...');
    const nursingHomeRows = await fetchCMSDataset(NURSING_HOME_DATASET_ID, 'Nursing Home Compare');
    console.log(`[CMS Cron] Nursing Home Compare: ${nursingHomeRows.length} rows`);

    // ── Merge and tag ───────────────────────────────────────────────
    const allRaw: any[] = [];

    for (const row of hospitalRows) {
      allRaw.push({ ...row, provider_type: row.provider_type || 'hospital', data_type: 'provider_data' });
    }

    for (const row of nursingHomeRows) {
      allRaw.push({ ...row, provider_type: row.provider_type || 'nursing_home', data_type: 'provider_data' });
    }

    // ── Empty-data guard ─────────────────────────────────────────────
    if (allRaw.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[CMS Cron] No provider data returned in ${elapsed}s — skipping cache save`);
      recordCronRun('rebuild-cms', 'success', Date.now() - startTime);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getCMSCacheStatus(),
      });
    }

    // ── Process and build cache ──────────────────────────────────────
    const processed = processCMSData(allRaw);
    console.log(`[CMS Cron] Processed ${processed.length} provider records`);

    const cacheData = await buildCMSCacheData(processed);
    await setCMSCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[CMS Cron] Complete in ${elapsed}s — ${processed.length} providers (${hospitalRows.length} hospitals, ${nursingHomeRows.length} nursing homes)`);

    recordCronRun('rebuild-cms', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      totalProviders: processed.length,
      hospitalCount: hospitalRows.length,
      nursingHomeCount: nursingHomeRows.length,
      militaryFriendly: cacheData.summary.militaryFriendlyProviders,
      veteranServices: cacheData.summary.veteranServiceProviders,
      averageQuality: cacheData.summary.averageQualityRating,
      cache: getCMSCacheStatus(),
    });

  } catch (err: any) {
    console.error('[CMS Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-cms' } });

    notifySlackCronFailure({ cronName: 'rebuild-cms', error: err.message || 'build failed', duration: Date.now() - startTime });

    recordCronRun('rebuild-cms', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'CMS build failed' },
      { status: 500 },
    );
  } finally {
    setBuildInProgress(false);
  }
}
