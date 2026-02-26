/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Score Cron Route                                   */
/*  Runs every 5 min. Tier 2 scoring + LLM escalation.               */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import type { ScoredHuc } from '@/lib/sentinel/types';
import { SENTINEL_FLAGS } from '@/lib/sentinel/config';
import { ensureWarmed as ensureQueueWarmed } from '@/lib/sentinel/eventQueue';
import { ensureWarmed as ensureHealthWarmed } from '@/lib/sentinel/sentinelHealth';
import {
  scoreAllHucs,
  ensureWarmed as ensureScoreWarmed,
} from '@/lib/sentinel/scoringEngine';

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
    // Warm all sentinel state
    await Promise.all([
      ensureQueueWarmed(),
      ensureHealthWarmed(),
      ensureScoreWarmed(),
    ]);

    // Run Tier-2 scoring
    const scored = await scoreAllHucs();

    const watchHucs = scored.filter(h => h.level === 'WATCH');
    const advisoryHucs = scored.filter(h => h.level === 'ADVISORY');
    const alertHucs = scored.filter(h => h.level === 'ALERT');

    // LLM escalation
    let llmTriggered = 0;
    const llmResults: { huc8: string; level: string; status: string }[] = [];

    if (SENTINEL_FLAGS.LLM && !SENTINEL_FLAGS.LOG_ONLY) {
      // ADVISORY: Call generate-insights with targeted HUCs
      if (advisoryHucs.length > 0) {
        const result = await triggerTargetedInsights(advisoryHucs, 'advisory');
        llmTriggered += result.triggered;
        llmResults.push(...result.results);
      }

      // ALERT: Inline LLM call for immediate response
      if (alertHucs.length > 0) {
        const result = await triggerTargetedInsights(alertHucs, 'alert');
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
        watch: watchHucs.length,
        advisory: advisoryHucs.length,
        alert: alertHucs.length,
        topHucs: scored.slice(0, 5).map(h => ({
          huc8: h.huc8,
          state: h.stateAbbr,
          score: h.score,
          level: h.level,
          events: h.events.length,
          patterns: h.activePatterns.map(p => p.patternId),
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
  level: 'advisory' | 'alert'
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
