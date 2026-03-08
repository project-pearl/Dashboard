// app/api/cron/rebuild-attains/route.ts
// Cron endpoint — fetches ATTAINS assessment data in time-budgeted chunks.
// Each invocation processes as many states as it can within 4 minutes,
// saves progress to disk, then SELF-CHAINS: fires the next chunk immediately
// so one cron trigger cascades through all 51 states without waiting 3 hours.
//
// Failed states are passed via ?defer=VA,FL,WV to the next chunk so they get
// pushed to the end of the queue instead of blocking progress.

import { NextRequest, NextResponse } from 'next/server';
import {
  buildAttainsChunk,
  getCacheStatus,
  ensureWarmed,
  setHuc12Summaries,
  type Huc12Summary,
} from '@/lib/attainsCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// Vercel Pro max is 300s — request 300s, budget 240s (leave margin for response)
export const maxDuration = 300;

const TIME_BUDGET_MS = 230_000; // ~4 minutes — leave 70s margin for blob load + save + response
const MAX_CHAIN_DEPTH = 20; // Safety: stop self-chaining after 20 hops
const HUC12_CONCURRENCY = 3; // Concurrent HUC-12 summary fetches to avoid overwhelming ATTAINS API
const ATTAINS_BASE = 'https://attains.epa.gov/attains-public/api';

// All states for HUC-12 summary fetch
const ALL_STATES_ABBR = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
];

/**
 * Fetch HUC-12 summaries for a single state from ATTAINS.
 */
async function fetchHuc12Summaries(stateCode: string): Promise<Huc12Summary[]> {
  try {
    const url = `${ATTAINS_BASE}/huc12summary?state=${stateCode}&returnCountOnly=false`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.warn(`[ATTAINS HUC12] ${stateCode}: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const items = data?.items || [];
    const summaries: Huc12Summary[] = [];
    for (const item of items) {
      const huc12 = (item?.huc12 || '').trim();
      if (!huc12) continue;
      summaries.push({
        huc12,
        assessmentUnitCount: item?.assessmentUnitCount ?? item?.totalAssessmentUnits ?? 0,
        impairedCount: item?.totalImpairedAssessmentUnits ?? item?.impairedCount ?? 0,
        tmdlCount: item?.totalTMDL ?? item?.tmdlCount ?? 0,
        causeCount: item?.totalCauses ?? item?.causeCount ?? 0,
      });
    }
    return summaries;
  } catch (e: any) {
    console.warn(`[ATTAINS HUC12] ${stateCode} failed: ${e.message}`);
    return [];
  }
}

/**
 * Fetch HUC-12 summaries for all states with concurrency limit.
 */
async function fetchAllHuc12Summaries(timeBudgetDeadline: number): Promise<{ fetched: number; states: number }> {
  const queue = [...ALL_STATES_ABBR];
  let totalFetched = 0;
  let statesProcessed = 0;
  let idx = 0;

  while (idx < queue.length) {
    // Check time budget — stop if less than 20s remaining
    if (Date.now() > timeBudgetDeadline - 20_000) {
      console.log(`[ATTAINS HUC12] Time budget reached — processed ${statesProcessed} states`);
      break;
    }

    const batch = queue.slice(idx, idx + HUC12_CONCURRENCY);
    idx += batch.length;

    const results = await Promise.allSettled(batch.map(st => fetchHuc12Summaries(st)));

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value.length > 0) {
        setHuc12Summaries(r.value);
        totalFetched += r.value.length;
        statesProcessed++;
        console.log(`[ATTAINS HUC12] ${batch[i]}: ${r.value.length} HUC-12 summaries`);
      } else {
        const reason = r.status === 'rejected' ? r.reason?.message : 'no data';
        console.warn(`[ATTAINS HUC12] ${batch[i]}: ${reason}`);
      }
    }

    // Small delay between batches
    if (idx < queue.length && Date.now() < timeBudgetDeadline - 25_000) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return { fetched: totalFetched, states: statesProcessed };
}

/**
 * Trigger the next chunk — sends the request and waits just long enough (5s)
 * for Vercel's edge to accept it, then aborts so we don't wait for the full chunk.
 */
async function triggerNextChunk(cronSecret: string | undefined, deferred: string[], depth: number) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!baseUrl) return;

  const params = new URLSearchParams();
  if (deferred.length > 0) params.set('defer', deferred.join(','));
  params.set('depth', String(depth + 1));
  const url = `${baseUrl}/api/cron/rebuild-attains?${params}`;
  const headers: Record<string, string> = {};
  if (cronSecret) headers['authorization'] = `Bearer ${cronSecret}`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000); // 5s is enough for edge to accept
  try {
    await fetch(url, { headers, signal: ac.signal });
  } catch {
    // AbortError is expected — means request was sent and we moved on
  } finally {
    clearTimeout(timer);
  }
  console.log(`[ATTAINS Chain] Triggered depth=${depth + 1}`);
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse chain params
  const deferParam = request.nextUrl.searchParams.get('defer') || '';
  const deferred = deferParam ? deferParam.split(',').filter(Boolean) : [];
  const depth = parseInt(request.nextUrl.searchParams.get('depth') || '0', 10);

  // Load accumulated state from blob so we know what's already built
  await ensureWarmed();
  const status = getCacheStatus();

  // If already building (e.g. self-trigger in progress), skip
  if (status.status === 'building') {
    return NextResponse.json({
      status: 'skipped',
      reason: 'ATTAINS build already in progress',
      cache: status,
    });
  }

  // If all states loaded and not stale, nothing to do
  if (status.statesMissing.length === 0 && status.status === 'ready') {
    return NextResponse.json({
      status: 'no-op',
      reason: `All ${status.totalStates} states already cached`,
      cache: status,
    });
  }

  // Safety: stop infinite chains
  if (depth >= MAX_CHAIN_DEPTH) {
    return NextResponse.json({
      status: 'chain-limit',
      reason: `Reached max chain depth (${MAX_CHAIN_DEPTH})`,
      depth,
      cache: status,
    });
  }

  const startTime = Date.now();

  try {
    const result = await buildAttainsChunk(TIME_BUDGET_MS, deferred);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const remaining = result.totalStates - result.alreadyCached - result.processed.length;

    // Accumulate deferred states: previously deferred + newly failed
    const newDeferred = [...new Set([...deferred, ...result.failed])];

    // Fetch HUC-12 summaries only when all states are cached (don't steal
    // time budget from remaining state fetches — CA/MI/OR need every second)
    let huc12Result = { fetched: 0, states: 0 };
    if (remaining === 0) {
      const huc12Deadline = Date.now() + Math.max(0, 280_000 - (Date.now() - startTime));
      try {
        huc12Result = await fetchAllHuc12Summaries(huc12Deadline);
        console.log(`[ATTAINS Cron] HUC-12 summaries: ${huc12Result.fetched} from ${huc12Result.states} states`);
      } catch (e: any) {
        console.warn(`[ATTAINS Cron] HUC-12 fetch failed: ${e.message}`);
      }
    }

    // Self-chain: if there are still states remaining, trigger the next chunk
    // Must await to keep function alive until the request reaches Vercel's edge
    const willChain = remaining > 0;
    if (willChain) {
      await triggerNextChunk(process.env.CRON_SECRET, newDeferred, depth);
    }

    recordCronRun('rebuild-attains', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      depth,
      statesProcessed: result.processed,
      statesFailed: result.failed,
      deferred: newDeferred,
      alreadyCached: result.alreadyCached,
      nowCached: result.alreadyCached + result.processed.length,
      totalStates: result.totalStates,
      remaining,
      selfChained: willChain,
      savedToDisk: result.savedToDisk,
      savedToBlob: result.savedToBlob,
      huc12Summaries: huc12Result.fetched,
      huc12StatesProcessed: huc12Result.states,
      cache: getCacheStatus(),
    });
  } catch (err: any) {
    console.error('[ATTAINS Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-attains' } });

    notifySlackCronFailure({ cronName: 'rebuild-attains', error: err.message || 'build failed', duration: Date.now() - startTime });

    recordCronRun('rebuild-attains', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'ATTAINS build failed', cache: getCacheStatus() },
      { status: 500 },
    );
  }
}
