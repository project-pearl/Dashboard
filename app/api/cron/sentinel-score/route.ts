/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Score Cron Route                                   */
/*  Runs every 5 min. Tier 2 scoring + LLM escalation.               */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import type { ScoredHuc } from '@/lib/sentinel/types';
import { SENTINEL_FLAGS } from '@/lib/sentinel/config';
import { ensureWarmed as ensureQueueWarmed, getAllEvents } from '@/lib/sentinel/eventQueue';
import { ensureWarmed as ensureHealthWarmed } from '@/lib/sentinel/sentinelHealth';
import {
  scoreAllHucs,
  ensureWarmed as ensureScoreWarmed,
} from '@/lib/sentinel/scoringEngine';
import { detectCoordination } from '@/lib/sentinel/coordinationEngine';
import { classifyEvent, gatherConfounders } from '@/lib/sentinel/classificationEngine';
import { correlateNwssWithWQ } from '@/lib/sentinel/nwssCorrelationEngine';
import { ensureWarmed as ensureBaselinesWarmed } from '@/lib/sentinel/parameterBaselines';
import { ensureWarmed as ensureNwssWarmed, getNwssAnomalies } from '@/lib/nwss/nwssCache';
import { ensureWarmed as ensureIndicesWarmed } from '@/lib/indices/indicesCache';
import type { NwssCorrelation } from '@/lib/sentinel/types';
import { evaluateCoordinationAlerts } from '@/lib/alerts/triggers/coordinationTrigger';
import { dispatchAlerts } from '@/lib/alerts/engine';
import { ALERT_FLAGS } from '@/lib/alerts/config';
import type { AttackClassification } from '@/lib/sentinel/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SENTINEL_FLAGS.ENABLED || !SENTINEL_FLAGS.SCORING) {
    return NextResponse.json({
      status: 'disabled',
      reason: !SENTINEL_FLAGS.ENABLED ? 'SENTINEL_ENABLED=false' : 'SENTINEL_SCORING=false',
    });
  }

  const startTime = Date.now();

  try {
    // Warm all sentinel state (including indices for watershed context)
    await Promise.all([
      ensureQueueWarmed(),
      ensureHealthWarmed(),
      ensureScoreWarmed(),
      ensureBaselinesWarmed(),
      ensureNwssWarmed(),
      ensureIndicesWarmed(),
    ]);

    // Run Tier-2 scoring
    const scored = await scoreAllHucs();

    const criticalHucs = scored.filter(h => h.level === 'CRITICAL');
    const watchHucs = scored.filter(h => h.level === 'WATCH');
    const advisoryHucs = scored.filter(h => h.level === 'ADVISORY');

    // Coordination detection
    let coordinationResults: { detected: number; dispatched: number } = { detected: 0, dispatched: 0 };
    try {
      const allEvents = getAllEvents();
      const coordinated = detectCoordination(allEvents);
      coordinationResults.detected = coordinated.length;

      if (coordinated.length > 0 && ALERT_FLAGS.ENABLED) {
        const alertEvents = await evaluateCoordinationAlerts(coordinated);
        if (alertEvents.length > 0) {
          const result = await dispatchAlerts(alertEvents);
          coordinationResults.dispatched = result.sent;
        }
      }
    } catch (err: any) {
      console.warn(`[sentinel-score] Coordination detection error: ${err.message}`);
    }

    // Classification — only for WATCH+ HUCs
    const classifications: { huc8: string; classification: AttackClassification }[] = [];
    try {
      const allEvents = getAllEvents();
      const watchPlusHucs = scored.filter(h => h.level === 'WATCH' || h.level === 'CRITICAL');
      for (const huc of watchPlusHucs) {
        const confounders = gatherConfounders(huc.huc8, allEvents);
        const result = classifyEvent(huc, confounders);
        classifications.push({ huc8: huc.huc8, classification: result });
      }
    } catch (err: any) {
      console.warn(`[sentinel-score] Classification error: ${err.message}`);
    }

    // NWSS correlation
    let nwssCorrelations: NwssCorrelation[] = [];
    try {
      const nwssAnomalies = getNwssAnomalies();
      if (nwssAnomalies.length > 0) {
        const allEvents = getAllEvents();
        nwssCorrelations = correlateNwssWithWQ(nwssAnomalies, allEvents);
      }
    } catch (err: any) {
      console.warn(`[sentinel-score] NWSS correlation error: ${err.message}`);
    }

    // LLM escalation
    let llmTriggered = 0;
    const llmResults: { huc8: string; level: string; status: string }[] = [];

    if (SENTINEL_FLAGS.LLM && !SENTINEL_FLAGS.LOG_ONLY) {
      // WATCH: Call generate-insights with targeted HUCs
      if (watchHucs.length > 0) {
        const result = await triggerTargetedInsights(watchHucs, 'watch');
        llmTriggered += result.triggered;
        llmResults.push(...result.results);
      }

      // CRITICAL: Inline LLM call for immediate response
      if (criticalHucs.length > 0) {
        const result = await triggerTargetedInsights(criticalHucs, 'critical');
        llmTriggered += result.triggered;
        llmResults.push(...result.results);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      status: 'complete',
      duration: `${duration}s`,
      scoring: {
        totalScored: scored.length,
        critical: criticalHucs.length,
        watch: watchHucs.length,
        advisory: advisoryHucs.length,
        topHucs: scored.slice(0, 5).map(h => ({
          huc8: h.huc8,
          state: h.stateAbbr,
          score: h.score,
          level: h.level,
          events: h.events.length,
          patterns: h.activePatterns.map(p => p.patternId),
        })),
      },
      coordination: coordinationResults,
      classification: {
        evaluated: classifications.length,
        results: classifications.map(c => ({
          huc8: c.huc8,
          classification: c.classification.classification,
          threatScore: c.classification.threatScore,
        })),
      },
      nwssCorrelation: {
        anomaliesChecked: getNwssAnomalies().length,
        correlationsFound: nwssCorrelations.length,
        correlations: nwssCorrelations.map(c => ({
          pathogen: c.nwssAnomaly.pathogen,
          sigma: c.nwssAnomaly.sigma,
          score: c.correlationScore,
          spatialMatch: c.spatialMatch,
          wqEvents: c.wqEvents.length,
        })),
      },
      llm: {
        enabled: SENTINEL_FLAGS.LLM,
        triggered: llmTriggered,
        results: llmResults,
      },
    });
  } catch (err: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[sentinel-score] Fatal error: ${err.message}`);
    return NextResponse.json({
      status: 'error',
      duration: `${duration}s`,
      error: err.message,
    }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  LLM Escalation — calls generate-insights with ?hucs= param       */
/* ------------------------------------------------------------------ */

async function triggerTargetedInsights(
  hucs: ScoredHuc[],
  level: 'advisory' | 'watch' | 'critical'
): Promise<{ triggered: number; results: { huc8: string; level: string; status: string }[] }> {
  const results: { huc8: string; level: string; status: string }[] = [];

  try {
    // Call internal generate-insights endpoint with targeted HUCs
    const hucList = hucs.map(h => h.huc8).join(',');
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const url = `${baseUrl}/api/cron/generate-insights?hucs=${hucList}&sentinelTriggered=true&level=${level}`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.CRON_SECRET) {
      headers['Authorization'] = `Bearer ${process.env.CRON_SECRET}`;
    }

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(60_000),
    });

    const data = await res.json();

    for (const huc of hucs) {
      results.push({
        huc8: huc.huc8,
        level,
        status: res.ok ? 'triggered' : 'failed',
      });
    }

    return { triggered: res.ok ? hucs.length : 0, results };
  } catch (err: any) {
    console.warn(`[sentinel-score] LLM escalation failed: ${err.message}`);
    for (const huc of hucs) {
      results.push({ huc8: huc.huc8, level, status: 'error' });
    }
    return { triggered: 0, results };
  }
}
