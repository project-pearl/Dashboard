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
} from '@/lib/attainsCache';

// Vercel Pro max is 300s — request 300s, budget 240s (leave margin for response)
export const maxDuration = 300;

const TIME_BUDGET_MS = 230_000; // ~4 minutes — leave 70s margin for blob load + save + response
const MAX_CHAIN_DEPTH = 20; // Safety: stop self-chaining after 20 hops

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
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

    // Self-chain: if there are still states remaining, trigger the next chunk
    // Must await to keep function alive until the request reaches Vercel's edge
    const willChain = remaining > 0;
    if (willChain) {
      await triggerNextChunk(cronSecret, newDeferred, depth);
    }

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
      cache: getCacheStatus(),
    });
  } catch (err: any) {
    console.error('[ATTAINS Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'ATTAINS build failed', cache: getCacheStatus() },
      { status: 500 },
    );
  }
}
