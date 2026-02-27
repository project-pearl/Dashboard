/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Status Endpoint                                    */
/*  Returns health, active scores, queue depth                        */
/* ------------------------------------------------------------------ */

import { NextResponse } from 'next/server';
import type { SentinelStatusResponse } from '@/lib/sentinel/types';
import { SENTINEL_FLAGS } from '@/lib/sentinel/config';
import {
  ensureWarmed as ensureHealthWarmed,
  getAllStatuses,
  getHealthSummary,
} from '@/lib/sentinel/sentinelHealth';
import {
  ensureWarmed as ensureQueueWarmed,
  getQueueStats,
} from '@/lib/sentinel/eventQueue';
import {
  ensureWarmed as ensureScoreWarmed,
  getScoredHucs,
  getResolvedHucs,
} from '@/lib/sentinel/scoringEngine';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  if (!SENTINEL_FLAGS.ENABLED) {
    return NextResponse.json({
      enabled: false,
      reason: 'SENTINEL_ENABLED=false',
    });
  }

  try {
    await Promise.all([
      ensureHealthWarmed(),
      ensureQueueWarmed(),
      ensureScoreWarmed(),
    ]);

    const sources = getAllStatuses();
    const healthSummary = getHealthSummary();
    const queue = getQueueStats();
    const allScored = getScoredHucs();
    const activeHucs = allScored.filter(h => h.level !== 'NOMINAL');
    const recentResolutions = getResolvedHucs();

    const response: SentinelStatusResponse = {
      sources,
      activeHucs: activeHucs.slice(0, 50), // cap for response size
      queue,
      summary: {
        healthySources: healthSummary.healthy,
        degradedSources: healthSummary.degraded,
        offlineSources: healthSummary.offline,
        criticalHucs: allScored.filter(h => h.level === 'CRITICAL').length,
        watchHucs: allScored.filter(h => h.level === 'WATCH').length,
        advisoryHucs: allScored.filter(h => h.level === 'ADVISORY').length,
      },
      recentResolutions,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error(`[sentinel-status] Error: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
