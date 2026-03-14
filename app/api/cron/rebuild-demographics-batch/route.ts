// app/api/cron/rebuild-demographics-batch/route.ts
// Batch cron -- rebuilds 3 demographics/EJ caches in one invocation:
//   1. Census ACS (5-Year tract-level demographic estimates)
//   2. CDC SVI (Social Vulnerability Index, tract-level)
//   3. CDC EJI (Environmental Justice Index, tract-level)
//
// Replaces 3 individual cron routes to conserve Vercel cron slots:
//   rebuild-census-acs, rebuild-cdc-svi, rebuild-cdc-eji
//
// Schedule: weekly Sunday 8:30 PM UTC
//
// Because the Census ACS, CDC SVI, and CDC EJI cache modules do not export
// standalone fetch/process/build functions (the fetch logic -- Census API
// calls, CSV downloads, gazetteer lookups -- lives in the individual cron
// route files), this batch cron delegates to the existing sub-cron
// endpoints via internal HTTP fetch, forwarding the CRON_SECRET for auth.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

import { getCensusAcsCacheStatus } from '@/lib/censusAcsCache';
import { getCdcSviCacheStatus } from '@/lib/cdcSviCache';
import { getCdcEjiCacheStatus } from '@/lib/cdcEjiCache';

// ── Types ───────────────────────────────────────────────────────────────────

interface SubCronResult {
  name: string;
  status: 'success' | 'skipped' | 'empty' | 'error';
  durationMs: number;
  detail?: any;
  error?: string;
}

// ── Sub-cron definitions ────────────────────────────────────────────────────

const SUB_CRONS = [
  { name: 'census-acs', path: '/api/cron/rebuild-census-acs' },
  { name: 'cdc-svi', path: '/api/cron/rebuild-cdc-svi' },
  { name: 'cdc-eji', path: '/api/cron/rebuild-cdc-eji' },
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
    console.log(`[Demographics Batch] Calling ${cronName}...`);

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
      signal: AbortSignal.timeout(240_000), // 4 min per sub-cron (SVI/EJI download large CSVs)
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`[Demographics Batch] ${cronName}: HTTP ${res.status}`);
      Sentry.captureMessage(`Demographics Batch: ${cronName} returned HTTP ${res.status}`, {
        level: 'error',
        tags: { cron: `rebuild-${cronName}`, batch: 'demographics' },
      });
      return {
        name: cronName,
        status: 'error',
        durationMs: Date.now() - start,
        error: body?.error || `HTTP ${res.status}`,
        detail: body,
      };
    }

    const subStatus = body?.status === 'skipped' ? 'skipped'
      : body?.status === 'empty' ? 'empty'
      : 'success';

    console.log(`[Demographics Batch] ${cronName}: ${body?.status || 'done'} (${body?.recordCount ?? '?'} records)`);
    return {
      name: cronName,
      status: subStatus,
      durationMs: Date.now() - start,
      detail: body,
    };
  } catch (err: any) {
    console.error(`[Demographics Batch] ${cronName} failed:`, err.message);
    Sentry.captureException(err, { tags: { cron: `rebuild-${cronName}`, batch: 'demographics' } });
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

  console.log('[Demographics Batch] Starting batch rebuild of 3 demographics caches...');

  // Run sequentially to stay within the 300s function timeout.
  // Census ACS runs first (fastest), then SVI and EJI (large CSV downloads).
  // Each sub-cron has its own error handling so a failure in one does not
  // block the others.
  for (const sub of SUB_CRONS) {
    results.push(await callSubCron(origin, sub.path, sub.name, authHeader));
  }

  const totalDurationMs = Date.now() - batchStart;
  const elapsed = (totalDurationMs / 1000).toFixed(1);
  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const empty = results.filter(r => r.status === 'empty').length;

  console.log(`[Demographics Batch] Complete in ${elapsed}s -- ${succeeded} succeeded, ${failed} failed, ${skipped} skipped, ${empty} empty`);

  // Record overall batch cron run
  const overallStatus = failed === results.length ? 'error' : 'success';
  recordCronRun('rebuild-demographics-batch', overallStatus, totalDurationMs,
    failed > 0 ? `${failed}/${results.length} sub-crons failed` : undefined);

  // Notify Slack if any sub-cron failed
  if (failed > 0) {
    const failedNames = results.filter(r => r.status === 'error').map(r => r.name).join(', ');
    notifySlackCronFailure({
      cronName: 'rebuild-demographics-batch',
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
      error: r.error,
      recordCount: r.detail?.recordCount,
      gridCells: r.detail?.gridCells,
    })),
    cacheStatus: {
      censusAcs: getCensusAcsCacheStatus(),
      cdcSvi: getCdcSviCacheStatus(),
      cdcEji: getCdcEjiCacheStatus(),
    },
  }, { status: httpStatus });
}
