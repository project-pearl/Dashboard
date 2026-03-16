/* ------------------------------------------------------------------ */
/*  Sentinel Intelligence Feed — Enriched 48h Event Timeline           */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { SENTINEL_FLAGS } from '@/lib/sentinel/config';
import {
  ensureWarmed as ensureQueueWarmed,
  getAllEvents,
} from '@/lib/sentinel/eventQueue';
import {
  ensureWarmed as ensureScoreWarmed,
  getScoredHucs,
} from '@/lib/sentinel/scoringEngine';
import { detectCoordination } from '@/lib/sentinel/coordinationEngine';
import { classifyEvent, gatherConfounders } from '@/lib/sentinel/classificationEngine';
import type {
  ChangeEvent,
  ScoredHuc,
  ScoredEventRef,
  SentinelFeedEntry,
  ScoreLevel,
  AttackClassification,
  CoordinatedEvent,
} from '@/lib/sentinel/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_ENTRIES = 200;
const MAX_HOURS = 48;

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!SENTINEL_FLAGS.ENABLED) {
    return NextResponse.json({ enabled: false, reason: 'SENTINEL_ENABLED=false' });
  }

  try {
    await Promise.all([ensureQueueWarmed(), ensureScoreWarmed()]);

    const url = request.nextUrl;
    const levelFilter = url.searchParams.get('level')?.split(',').map(s => s.trim().toUpperCase()) ?? null;
    const sourceFilter = url.searchParams.get('source')?.split(',').map(s => s.trim()) ?? null;
    const hours = Math.min(Number(url.searchParams.get('hours')) || 48, MAX_HOURS);

    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const allEvents = getAllEvents().filter(e => new Date(e.detectedAt).getTime() >= cutoff);

    const scoredHucs = getScoredHucs();
    const hucMap = new Map<string, ScoredHuc>();
    for (const h of scoredHucs) hucMap.set(h.huc8, h);

    // Coordination detection indexed by HUC
    const coordEvents = detectCoordination(allEvents);
    const coordByHuc = new Map<string, CoordinatedEvent>();
    for (const ce of coordEvents) {
      for (const mh of ce.memberHucs) {
        if (!coordByHuc.has(mh) || ce.coordinationScore > (coordByHuc.get(mh)!.coordinationScore)) {
          coordByHuc.set(mh, ce);
        }
      }
    }

    // Memoize classification per HUC to avoid redundant calls
    const classCache = new Map<string, AttackClassification>();
    function getClassification(huc8: string, huc: ScoredHuc): AttackClassification {
      if (classCache.has(huc8)) return classCache.get(huc8)!;
      const confounders = gatherConfounders(huc8, allEvents);
      const result = classifyEvent(huc, confounders);
      classCache.set(huc8, result);
      return result;
    }

    // Build entries
    const entries: SentinelFeedEntry[] = [];
    for (const event of allEvents) {
      const huc8 = event.geography.huc8;
      if (!huc8) continue;

      const scoredHuc = hucMap.get(huc8);
      if (!scoredHuc) continue;

      // Filter by level
      if (levelFilter && !levelFilter.includes(scoredHuc.level)) continue;
      // Filter by source
      if (sourceFilter && !sourceFilter.includes(event.source)) continue;

      const classification = getClassification(huc8, scoredHuc);

      // Find this event's scored ref
      const eventRef: ScoredEventRef | undefined = scoredHuc.events.find(r => r.eventId === event.eventId);

      // Find plume adjustment from active patterns
      const plumePattern = scoredHuc.activePatterns.find(p => p.plumeAdjustment && p.matchedEventIds.includes(event.eventId));

      const coord = coordByHuc.get(huc8);

      entries.push({
        eventId: event.eventId,
        detectedAt: event.detectedAt,
        source: event.source,
        changeType: event.changeType,
        severityHint: event.severityHint,
        geography: event.geography,
        huc8,
        hucScore: scoredHuc.score,
        hucLevel: scoredHuc.level,
        baseScore: eventRef?.baseScore ?? 0,
        decayedScore: eventRef?.decayedScore ?? 0,
        activePatterns: scoredHuc.activePatterns.map(p => p.patternId),
        classification: classification.classification,
        threatScore: classification.threatScore,
        confounders: classification.confounders,
        reasoning: classification.reasoning,
        cbrnIndicators: classification.cbrnIndicators,
        coordination: coord ? {
          coordinationScore: coord.coordinationScore,
          memberHucs: coord.memberHucs,
          parameterBreadth: coord.parameterBreadth,
          temporalSpread: coord.temporalSpread,
        } : null,
        plumeAdjustment: plumePattern?.plumeAdjustment ?? null,
        payload: event.payload,
      });

      if (entries.length >= MAX_ENTRIES) break;
    }

    // Sort newest first
    entries.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

    // Build summary
    const byLevel: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let cbrnDetections = 0;
    for (const e of entries) {
      byLevel[e.hucLevel] = (byLevel[e.hucLevel] ?? 0) + 1;
      bySource[e.source] = (bySource[e.source] ?? 0) + 1;
      if (e.cbrnIndicators.length > 0) cbrnDetections++;
    }

    return NextResponse.json({
      entries,
      summary: {
        total: entries.length,
        byLevel,
        bySource,
        coordinatedClusters: coordEvents.length,
        cbrnDetections,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[sentinel-feed] Error: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
