// app/api/cron/rebuild-attains/route.ts
// Cron endpoint — fetches ATTAINS assessment data in time-budgeted chunks.
// Each invocation processes as many states as it can within 4 minutes,
// saves progress to disk, then SELF-CHAINS: fires the next chunk immediately
// so one cron trigger cascades through all 51 states without waiting 3 hours.

import { NextRequest, NextResponse } from 'next/server';
import {
  buildAttainsChunk,
  getCacheStatus,
  ensureWarmed,
} from '@/lib/attainsCache';

// Vercel Pro max is 300s — request 300s, budget 240s (leave margin for response)
export const maxDuration = 300;

const TIME_BUDGET_MS = 230_000; // ~4 minutes — leave 70s margin for blob load + save + response

/**
 * Fire-and-forget: trigger the next chunk without waiting for it.
 * Uses the deployment's own URL so it works on both preview and production.
 */
function triggerNextChunk(cronSecret: string | undefined) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!baseUrl) return;

  const url = `${baseUrl}/api/cron/rebuild-attains`;
  const headers: Record<string, string> = {};
  if (cronSecret) headers['authorization'] = `Bearer ${cronSecret}`;

  // Fire and forget — don't await, don't let failures propagate
  fetch(url, { headers }).catch(() => {});
}

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const startTime = Date.now();

  try {
    const result = await buildAttainsChunk(TIME_BUDGET_MS);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const remaining = result.totalStates - result.alreadyCached - result.processed.length;

    // Self-chain: if there are still states remaining, trigger the next chunk
    if (remaining > 0) {
      triggerNextChunk(cronSecret);
    }

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      statesProcessed: result.processed,
      statesFailed: result.failed,
      alreadyCached: result.alreadyCached,
      nowCached: result.alreadyCached + result.processed.length,
      totalStates: result.totalStates,
      remaining,
      selfChained: remaining > 0,
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
