// app/api/cron/rebuild-cms/route.ts
// Cron — fetches CMS provider data from Hospital Compare and Nursing Home Compare.
// Schedule: daily 1:30 AM UTC via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { setCMSCache, getCMSCacheStatus, isBuildInProgress, setBuildInProgress, processCMSData, buildCMSCacheData } from '@/lib/cmsCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

const CMS_HOSPITAL_URL = 'https://data.cms.gov/provider-data/api/1/datastore/sql?query=[SELECT * FROM xubh-q36u][LIMIT 5000]';
const CMS_NURSING_URL = 'https://data.cms.gov/provider-data/api/1/datastore/sql?query=[SELECT * FROM 4pq5-n9py][LIMIT 5000]';
const FETCH_TIMEOUT_MS = 60_000;

async function fetchDataset(url: string, label: string): Promise<any[]> {
  try {
    console.log(`[CMS Cron] Fetching ${label}...`);
    const res = await fetch(url, { headers: { 'User-Agent': 'PEARL-Platform/1.0', Accept: 'application/json' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) { console.warn(`[CMS Cron] ${label} HTTP ${res.status}`); return []; }
    const data = await res.json();
    const rows = Array.isArray(data) ? data : data?.results || data?.rows || [];
    console.log(`[CMS Cron] ${label}: ${rows.length} records`);
    return rows;
  } catch (e: any) { console.warn(`[CMS Cron] ${label} failed: ${e.message}`); return []; }
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (isBuildInProgress()) return NextResponse.json({ status: 'skipped', reason: 'build in progress', cache: getCMSCacheStatus() });

  setBuildInProgress(true);
  const startTime = Date.now();
  try {
    const [hospitals, nursing] = await Promise.all([fetchDataset(CMS_HOSPITAL_URL, 'Hospital Compare'), fetchDataset(CMS_NURSING_URL, 'Nursing Home Compare')]);
    const allRaw = [...hospitals, ...nursing];
    console.log(`[CMS Cron] Total raw: ${allRaw.length}`);
    if (allRaw.length === 0) { recordCronRun('rebuild-cms', 'success', Date.now() - startTime); return NextResponse.json({ status: 'empty' }); }

    const records = processCMSData(allRaw);
    const cacheData = await buildCMSCacheData(records);
    await setCMSCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[CMS Cron] Complete in ${elapsed}s — ${records.length} providers`);
    recordCronRun('rebuild-cms', 'success', Date.now() - startTime);
    return NextResponse.json({ status: 'complete', duration: `${elapsed}s`, recordCount: records.length });
  } catch (err: any) {
    console.error('[CMS Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-cms' } });
    notifySlackCronFailure({ cronName: 'rebuild-cms', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-cms', 'error', Date.now() - startTime, err.message);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  } finally { setBuildInProgress(false); }
}
