// app/api/cron/rebuild-attains/route.ts
// Cron endpoint — fetches ATTAINS assessment data in time-budgeted chunks.
// Each invocation processes as many states as it can within 4 minutes,
// saves progress to disk, and picks up remaining states on the next run.
// Schedule: every 3 hours — fills all 51 states within ~1 day, then no-ops.

import { NextRequest, NextResponse } from 'next/server';
import {
  buildAttainsChunk,
  getCacheStatus,
} from '@/lib/attainsCache';

// Vercel Pro max is 300s — request 300s, budget 240s (leave margin for response)
export const maxDuration = 300;

const TIME_BUDGET_MS = 180_000; // 3 minutes — leave 2 min margin for response + cold start

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      statesProcessed: result.processed,
      statesFailed: result.failed,
      alreadyCached: result.alreadyCached,
      nowCached: result.alreadyCached + result.processed.length,
      totalStates: result.totalStates,
      remaining: result.totalStates - result.alreadyCached - result.processed.length,
      savedToDisk: result.savedToDisk,
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
