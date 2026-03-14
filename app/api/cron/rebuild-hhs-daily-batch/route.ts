// app/api/cron/rebuild-hhs-daily-batch/route.ts
// Batch cron -- rebuilds 5 HHS daily caches in one invocation:
//   1. SAMHSA (treatment facility locator)
//   2. CMS (Hospital Compare + Nursing Home Compare)
//   3. MyHealthfinder (health guidance topics)
//   4. ATSDR Toxicology (chemical exposure profiles)
//   5. Data.CDC.gov (public health surveillance)
//
// Replaces 5 individual cron routes to conserve Vercel cron slots:
//   rebuild-samhsa, rebuild-cms, rebuild-myhealthfinder,
//   rebuild-atsdr-toxicology, rebuild-data-cdc-gov
//
// Schedule: daily 1:00 AM UTC

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// SAMHSA imports
import {
  setSAMHSACache,
  getSAMHSACacheStatus,
  isBuildInProgress as isSamhsaBuildInProgress,
  setBuildInProgress as setSamhsaBuildInProgress,
  processSAMHSAData,
  buildSAMHSACacheData,
  fetchSAMHSAData,
} from '@/lib/samhsaCache';

// CMS imports
import {
  setCMSCache,
  getCMSCacheStatus,
  isBuildInProgress as isCmsBuildInProgress,
  setBuildInProgress as setCmsBuildInProgress,
  processCMSData,
  buildCMSCacheData,
  fetchCMSData,
} from '@/lib/cmsCache';

// MyHealthfinder imports
import {
  setMyHealthfinderCache,
  getMyHealthfinderCacheStatus,
  isBuildInProgress as isMhfBuildInProgress,
  setBuildInProgress as setMhfBuildInProgress,
  fetchMyHealthfinderData,
  processMyHealthfinderData,
  buildMyHealthfinderCacheData,
} from '@/lib/myhealthfinderCache';

// ATSDR Toxicology imports
import {
  setATSDRToxicologyCache,
  getATSDRToxicologyCacheStatus,
  isBuildInProgress as isAtsdrBuildInProgress,
  setBuildInProgress as setAtsdrBuildInProgress,
  fetchATSDRToxicologyData,
  processATSDRToxicologyData,
  buildATSDRToxicologyCacheData,
} from '@/lib/atsdrToxicologyCache';

// Data.CDC.gov imports
import {
  setDataCDCGovCache,
  getDataCDCGovCacheStatus,
  isBuildInProgress as isCdcGovBuildInProgress,
  setBuildInProgress as setCdcGovBuildInProgress,
  fetchDataCDCGovData,
  processDataCDCGovData,
  buildDataCDCGovCacheData,
} from '@/lib/dataCdcGovCache';

// ── Types ───────────────────────────────────────────────────────────────────

interface SubCronResult {
  name: string;
  status: 'success' | 'skipped' | 'empty' | 'error';
  durationMs: number;
  recordCount?: number;
  error?: string;
}

// ── Sub-cron builders ───────────────────────────────────────────────────────

async function buildSamhsa(): Promise<SubCronResult> {
  const start = Date.now();

  if (isSamhsaBuildInProgress()) {
    return { name: 'samhsa', status: 'skipped', durationMs: Date.now() - start };
  }

  setSamhsaBuildInProgress(true);
  try {
    const rawData = await fetchSAMHSAData();

    if (rawData.length === 0) {
      console.warn('[HHS Daily Batch] SAMHSA: no data returned -- skipping cache save');
      recordCronRun('rebuild-samhsa', 'success', Date.now() - start);
      return { name: 'samhsa', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const processed = processSAMHSAData(rawData);
    const cacheData = await buildSAMHSACacheData(processed);
    await setSAMHSACache(cacheData);

    console.log(`[HHS Daily Batch] SAMHSA: ${processed.length} facilities`);
    recordCronRun('rebuild-samhsa', 'success', Date.now() - start);
    return { name: 'samhsa', status: 'success', durationMs: Date.now() - start, recordCount: processed.length };
  } catch (err: any) {
    console.error('[HHS Daily Batch] SAMHSA failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-samhsa', batch: 'hhs-daily' } });
    recordCronRun('rebuild-samhsa', 'error', Date.now() - start, err.message);
    return { name: 'samhsa', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setSamhsaBuildInProgress(false);
  }
}

async function buildCms(): Promise<SubCronResult> {
  const start = Date.now();

  if (isCmsBuildInProgress()) {
    return { name: 'cms', status: 'skipped', durationMs: Date.now() - start };
  }

  setCmsBuildInProgress(true);
  try {
    const rawData = await fetchCMSData();

    if (rawData.length === 0) {
      console.warn('[HHS Daily Batch] CMS: no data returned -- skipping cache save');
      recordCronRun('rebuild-cms', 'success', Date.now() - start);
      return { name: 'cms', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const processed = processCMSData(rawData);
    const cacheData = await buildCMSCacheData(processed);
    await setCMSCache(cacheData);

    console.log(`[HHS Daily Batch] CMS: ${processed.length} providers`);
    recordCronRun('rebuild-cms', 'success', Date.now() - start);
    return { name: 'cms', status: 'success', durationMs: Date.now() - start, recordCount: processed.length };
  } catch (err: any) {
    console.error('[HHS Daily Batch] CMS failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-cms', batch: 'hhs-daily' } });
    recordCronRun('rebuild-cms', 'error', Date.now() - start, err.message);
    return { name: 'cms', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setCmsBuildInProgress(false);
  }
}

async function buildMyhealthfinder(): Promise<SubCronResult> {
  const start = Date.now();

  if (isMhfBuildInProgress()) {
    return { name: 'myhealthfinder', status: 'skipped', durationMs: Date.now() - start };
  }

  setMhfBuildInProgress(true);
  try {
    const rawTopics = await fetchMyHealthfinderData();

    if (rawTopics.length === 0) {
      console.warn('[HHS Daily Batch] MyHealthfinder: no data returned -- skipping cache save');
      return { name: 'myhealthfinder', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const processed = processMyHealthfinderData(rawTopics);
    const cacheData = await buildMyHealthfinderCacheData(processed);
    await setMyHealthfinderCache(cacheData);

    console.log(`[HHS Daily Batch] MyHealthfinder: ${processed.length} topics`);
    return { name: 'myhealthfinder', status: 'success', durationMs: Date.now() - start, recordCount: processed.length };
  } catch (err: any) {
    console.error('[HHS Daily Batch] MyHealthfinder failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-myhealthfinder', batch: 'hhs-daily' } });
    return { name: 'myhealthfinder', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setMhfBuildInProgress(false);
  }
}

async function buildAtsdr(): Promise<SubCronResult> {
  const start = Date.now();

  if (isAtsdrBuildInProgress()) {
    return { name: 'atsdr-toxicology', status: 'skipped', durationMs: Date.now() - start };
  }

  setAtsdrBuildInProgress(true);
  try {
    const rawSubstances = await fetchATSDRToxicologyData();

    if (rawSubstances.length === 0) {
      console.warn('[HHS Daily Batch] ATSDR: no data returned -- skipping cache save');
      return { name: 'atsdr-toxicology', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const processed = processATSDRToxicologyData(rawSubstances);
    const cacheData = await buildATSDRToxicologyCacheData(processed);
    await setATSDRToxicologyCache(cacheData);

    console.log(`[HHS Daily Batch] ATSDR: ${processed.length} substances`);
    return { name: 'atsdr-toxicology', status: 'success', durationMs: Date.now() - start, recordCount: processed.length };
  } catch (err: any) {
    console.error('[HHS Daily Batch] ATSDR failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-atsdr-toxicology', batch: 'hhs-daily' } });
    return { name: 'atsdr-toxicology', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setAtsdrBuildInProgress(false);
  }
}

async function buildDataCdcGov(): Promise<SubCronResult> {
  const start = Date.now();

  if (isCdcGovBuildInProgress()) {
    return { name: 'data-cdc-gov', status: 'skipped', durationMs: Date.now() - start };
  }

  setCdcGovBuildInProgress(true);
  try {
    const rawDatasets = await fetchDataCDCGovData();

    if (rawDatasets.length === 0) {
      console.warn('[HHS Daily Batch] Data.CDC.gov: no data returned -- skipping cache save');
      return { name: 'data-cdc-gov', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const processed = processDataCDCGovData(rawDatasets);
    const cacheData = await buildDataCDCGovCacheData(processed);
    await setDataCDCGovCache(cacheData);

    console.log(`[HHS Daily Batch] Data.CDC.gov: ${processed.length} records`);
    return { name: 'data-cdc-gov', status: 'success', durationMs: Date.now() - start, recordCount: processed.length };
  } catch (err: any) {
    console.error('[HHS Daily Batch] Data.CDC.gov failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-data-cdc-gov', batch: 'hhs-daily' } });
    return { name: 'data-cdc-gov', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setCdcGovBuildInProgress(false);
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchStart = Date.now();
  const results: SubCronResult[] = [];

  console.log('[HHS Daily Batch] Starting batch rebuild of 5 HHS caches...');

  // Run sequentially to avoid overwhelming external APIs and stay within
  // the 300s function timeout. Each sub-cron has its own try/catch so a
  // failure in one does not block the others.

  results.push(await buildSamhsa());
  results.push(await buildCms());
  results.push(await buildMyhealthfinder());
  results.push(await buildAtsdr());
  results.push(await buildDataCdcGov());

  const totalDurationMs = Date.now() - batchStart;
  const elapsed = (totalDurationMs / 1000).toFixed(1);
  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const empty = results.filter(r => r.status === 'empty').length;

  console.log(`[HHS Daily Batch] Complete in ${elapsed}s -- ${succeeded} succeeded, ${failed} failed, ${skipped} skipped, ${empty} empty`);

  // Record overall batch cron run
  const overallStatus = failed === results.length ? 'error' : 'success';
  recordCronRun('rebuild-hhs-daily-batch', overallStatus, totalDurationMs,
    failed > 0 ? `${failed}/${results.length} sub-crons failed` : undefined);

  // Notify Slack if any sub-cron failed
  if (failed > 0) {
    const failedNames = results.filter(r => r.status === 'error').map(r => r.name).join(', ');
    notifySlackCronFailure({
      cronName: 'rebuild-hhs-daily-batch',
      error: `Sub-crons failed: ${failedNames}`,
      duration: totalDurationMs,
    });
  }

  const httpStatus = failed === results.length ? 500 : 200;

  return NextResponse.json({
    status: overallStatus,
    duration: `${elapsed}s`,
    summary: { succeeded, failed, skipped, empty, total: results.length },
    results: results.map(r => ({
      name: r.name,
      status: r.status,
      duration: `${(r.durationMs / 1000).toFixed(1)}s`,
      recordCount: r.recordCount,
      error: r.error,
    })),
    cacheStatus: {
      samhsa: getSAMHSACacheStatus(),
      cms: getCMSCacheStatus(),
      myhealthfinder: getMyHealthfinderCacheStatus(),
      atsdrToxicology: getATSDRToxicologyCacheStatus(),
      dataCdcGov: getDataCDCGovCacheStatus(),
    },
  }, { status: httpStatus });
}
