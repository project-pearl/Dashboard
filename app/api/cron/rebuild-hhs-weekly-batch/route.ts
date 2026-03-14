// app/api/cron/rebuild-hhs-weekly-batch/route.ts
// Batch cron -- rebuilds 3 HHS weekly caches in one invocation:
//   1. IHS (Indian Health Service facilities via HIFLD)
//   2. OMH (Office of Minority Health disparities via HHS Socrata)
//   3. ACL (Administration for Community Living via Eldercare Locator)
//
// Replaces 3 individual cron routes to conserve Vercel cron slots:
//   rebuild-ihs, rebuild-omh, rebuild-acl
//
// Schedule: weekly Sunday 2:00 AM UTC
//
// Because the IHS, OMH, and ACL cache modules do not export standalone
// fetch/process/build functions (the fetch logic lives in the individual
// cron route files), this batch cron delegates to the existing sub-cron
// endpoints via internal HTTP fetch, forwarding the CRON_SECRET for auth.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

import { getIHSCacheInfo } from '@/lib/ihsCache';
import { getOMHCacheInfo } from '@/lib/omhCache';
import { getACLCacheInfo } from '@/lib/aclCache';

// ── Types ───────────────────────────────────────────────────────────────────

interface SubCronResult {
  name: string;
  status: 'success' | 'skipped' | 'error';
  durationMs: number;
  detail?: any;
  error?: string;
}

// ── Sub-cron definitions ────────────────────────────────────────────────────

const SUB_CRONS = [
  { name: 'ihs', path: '/api/cron/rebuild-ihs' },
  { name: 'omh', path: '/api/cron/rebuild-omh' },
  { name: 'acl', path: '/api/cron/rebuild-acl' },
] as const;

// ── Internal fetch helper ───────────────────────────────────────────────────

async function callSubCron(
  origin: string,
  path: string,
  cronName: string,
  authHeader: string | null,
): Promise<SubCronResult> {
  const start = Date.now();
  const url = `${origin}${path}`;

  try {
    console.log(`[HHS Weekly Batch] Calling ${cronName}...`);

    const headers: Record<string, string> = {};
    if (authHeader) {
      headers['authorization'] = authHeader;
    }
    // Also forward CRON_SECRET as query param for Vercel cron auth
    const fetchUrl = process.env.CRON_SECRET
      ? `${url}?cron_secret=${process.env.CRON_SECRET}`
      : url;

    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(120_000), // 2 min per sub-cron
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`[HHS Weekly Batch] ${cronName}: HTTP ${res.status}`);
      Sentry.captureMessage(`HHS Weekly Batch: ${cronName} returned HTTP ${res.status}`, {
        level: 'error',
        tags: { cron: `rebuild-${cronName}`, batch: 'hhs-weekly' },
      });
      return {
        name: cronName,
        status: 'error',
        durationMs: Date.now() - start,
        error: body?.error || `HTTP ${res.status}`,
        detail: body,
      };
    }

    console.log(`[HHS Weekly Batch] ${cronName}: ${body?.status || 'done'}`);
    return {
      name: cronName,
      status: body?.status === 'skipped' ? 'skipped' : 'success',
      durationMs: Date.now() - start,
      detail: body,
    };
  } catch (err: any) {
    console.error(`[HHS Weekly Batch] ${cronName} failed:`, err.message);
    Sentry.captureException(err, { tags: { cron: `rebuild-${cronName}`, batch: 'hhs-weekly' } });
    return {
      name: cronName,
      status: 'error',
      durationMs: Date.now() - start,
      error: err.message,
    };
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchStart = Date.now();
  const results: SubCronResult[] = [];

  // Determine origin for internal fetch calls
  const origin = request.nextUrl.origin;
  const authHeader = request.headers.get('authorization');

  console.log('[HHS Weekly Batch] Starting batch rebuild of 3 HHS weekly caches...');

  // Run sequentially to avoid overwhelming external APIs and stay within
  // the 300s function timeout. Each sub-cron has its own error handling.
  for (const sub of SUB_CRONS) {
    results.push(await callSubCron(origin, sub.path, sub.name, authHeader));
  }

  const totalDurationMs = Date.now() - batchStart;
  const elapsed = (totalDurationMs / 1000).toFixed(1);
  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log(`[HHS Weekly Batch] Complete in ${elapsed}s -- ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`);

  // Record overall batch cron run
  const overallStatus = failed === results.length ? 'error' : 'success';
  recordCronRun('rebuild-hhs-weekly-batch', overallStatus, totalDurationMs,
    failed > 0 ? `${failed}/${results.length} sub-crons failed` : undefined);

  // Notify Slack if any sub-cron failed
  if (failed > 0) {
    const failedNames = results.filter(r => r.status === 'error').map(r => r.name).join(', ');
    notifySlackCronFailure({
      cronName: 'rebuild-hhs-weekly-batch',
      error: `Sub-crons failed: ${failedNames}`,
      duration: totalDurationMs,
    });
  }

  const httpStatus = failed === results.length ? 500 : 200;

  return NextResponse.json({
    status: overallStatus,
    duration: `${elapsed}s`,
    summary: { succeeded, failed, skipped, total: results.length },
    results: results.map(r => ({
      name: r.name,
      status: r.status,
      duration: `${(r.durationMs / 1000).toFixed(1)}s`,
      error: r.error,
    })),
    cacheStatus: {
      ihs: getIHSCacheInfo(),
      omh: getOMHCacheInfo(),
      acl: getACLCacheInfo(),
    },
  }, { status: httpStatus });
}
