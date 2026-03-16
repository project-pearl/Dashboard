/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Status Endpoint                                    */
/*  Returns health, active scores, queue depth                        */
/*  ?escalation=true adds trajectory/velocity for non-NOMINAL HUCs    */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import type { SentinelStatusResponse, EscalationIndicators } from '@/lib/sentinel/types';
import { SENTINEL_FLAGS } from '@/lib/sentinel/config';
import {
  ensureWarmed as ensureHealthWarmed,
  getAllStatuses,
  getHealthSummary,
} from '@/lib/sentinel/sentinelHealth';
import {
  ensureWarmed as ensureQueueWarmed,
  getQueueStats,
  getEventsForHuc,
} from '@/lib/sentinel/eventQueue';
import {
  ensureWarmed as ensureScoreWarmed,
  getScoredHucs,
  getResolvedHucs,
} from '@/lib/sentinel/scoringEngine';
import { computeEscalationIndicators } from '@/lib/sentinel/escalationIndicators';

export const dynamic = 'force-dynamic';

export async function GET(request?: NextRequest): Promise<NextResponse> {
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

    const response: SentinelStatusResponse & { escalation?: EscalationIndicators[] } = {
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

    // Escalation indicators when requested
    const wantEscalation = request?.nextUrl?.searchParams?.get('escalation') === 'true';
    if (wantEscalation) {
      const indicators: EscalationIndicators[] = [];
      for (const huc of activeHucs) {
        const hucEvents = getEventsForHuc(huc.huc8);
        indicators.push(computeEscalationIndicators(huc, hucEvents));
      }
      // Sort by absolute velocity, cap at 50
      indicators.sort((a, b) => Math.abs(b.velocity) - Math.abs(a.velocity));
      response.escalation = indicators.slice(0, 50);
    }

    return NextResponse.json(response);
  } catch (err: any) {
    console.error(`[sentinel-status] Error: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
