/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Coordination Detection Engine                      */
/*  Spatial clustering, multivariate detection, temporal tightness.   */
/* ------------------------------------------------------------------ */

import type { ChangeEvent, CoordinatedEvent } from './types';
import { getHuc6Parent, getAdjacentHucs } from './hucAdjacency';
import {
  MIN_CLUSTER_SIZE,
  COORDINATION_WINDOW_MS,
  COORDINATION_THRESHOLD,
  COORDINATION_WEIGHTS,
  ATTACK_INDICATOR_PAIRS,
  MIN_MULTIVARIATE_PARAMS,
} from './coordinationConfig';

/* ------------------------------------------------------------------ */
/*  Main Detection                                                    */
/* ------------------------------------------------------------------ */

export function detectCoordination(
  events: ChangeEvent[],
  windowMs: number = COORDINATION_WINDOW_MS,
): CoordinatedEvent[] {
  if (events.length < MIN_CLUSTER_SIZE) return [];

  const now = Date.now();
  const cutoff = now - windowMs;

  // Filter to events within the window
  const windowed = events.filter(e =>
    new Date(e.detectedAt).getTime() > cutoff
  );

  if (windowed.length < MIN_CLUSTER_SIZE) return [];

  const coordinated: CoordinatedEvent[] = [];

  // 1. Spatial clustering — group by HUC-6 parent
  const huc6Groups = groupByHuc6(windowed);

  for (const [huc6, groupEvents] of huc6Groups) {
    // Expand cluster: include events in adjacent HUCs that share HUC-6
    const expandedEvents = expandCluster(groupEvents, windowed);

    if (expandedEvents.length < MIN_CLUSTER_SIZE) continue;

    // Get distinct HUC-8s
    const memberHucs = [...new Set(
      expandedEvents.map(e => e.geography.huc8).filter(Boolean) as string[]
    )];

    if (memberHucs.length < MIN_CLUSTER_SIZE) continue;

    // 2. Score the cluster
    const score = scoreCluster(expandedEvents, memberHucs, windowMs);

    if (score >= COORDINATION_THRESHOLD) {
      const timestamps = expandedEvents.map(e => new Date(e.detectedAt).getTime());
      const temporalSpread = Math.max(...timestamps) - Math.min(...timestamps);

      const paramCds = new Set<string>();
      for (const e of expandedEvents) {
        const pc = (e.payload as Record<string, unknown>).parameterCd;
        if (typeof pc === 'string') paramCds.add(pc);
      }

      coordinated.push({
        id: `coord-${huc6}-${Date.now().toString(36)}`,
        huc6,
        memberHucs,
        memberEvents: expandedEvents,
        coordinationScore: Math.round(score * 1000) / 1000,
        parameterBreadth: paramCds.size,
        temporalSpread,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  return coordinated;
}

/* ------------------------------------------------------------------ */
/*  Spatial Clustering                                                */
/* ------------------------------------------------------------------ */

function groupByHuc6(events: ChangeEvent[]): Map<string, ChangeEvent[]> {
  const groups = new Map<string, ChangeEvent[]>();

  for (const e of events) {
    const huc8 = e.geography.huc8;
    if (!huc8) continue;
    const huc6 = getHuc6Parent(huc8);
    if (!groups.has(huc6)) groups.set(huc6, []);
    groups.get(huc6)!.push(e);
  }

  return groups;
}

function expandCluster(seedEvents: ChangeEvent[], allEvents: ChangeEvent[]): ChangeEvent[] {
  const seedHucs = new Set(
    seedEvents.map(e => e.geography.huc8).filter(Boolean) as string[]
  );

  // Include events from adjacent HUC-8s
  const expandedHucs = new Set(seedHucs);
  for (const huc of seedHucs) {
    for (const adj of getAdjacentHucs(huc)) {
      expandedHucs.add(adj);
    }
  }

  const seen = new Set(seedEvents.map(e => e.eventId));
  const expanded = [...seedEvents];

  for (const e of allEvents) {
    if (seen.has(e.eventId)) continue;
    if (e.geography.huc8 && expandedHucs.has(e.geography.huc8)) {
      expanded.push(e);
      seen.add(e.eventId);
    }
  }

  return expanded;
}

/* ------------------------------------------------------------------ */
/*  Scoring                                                           */
/* ------------------------------------------------------------------ */

function scoreCluster(
  events: ChangeEvent[],
  memberHucs: string[],
  windowMs: number,
): number {
  // A. Cluster size score (2 HUCs = 0.3, 3 = 0.6, 4+ = 1.0)
  const clusterScore = Math.min(1.0, (memberHucs.length - 1) / 3);

  // B. Parameter breadth (how many distinct parameters are involved)
  const paramCds = new Set<string>();
  for (const e of events) {
    const pc = (e.payload as Record<string, unknown>).parameterCd;
    if (typeof pc === 'string') paramCds.add(pc);
  }
  // Check for attack indicator pairs
  let pairBonus = 0;
  for (const pair of ATTACK_INDICATOR_PAIRS) {
    if (pair.params.every(p => paramCds.has(p))) {
      pairBonus = Math.max(pairBonus, pair.weight);
    }
  }
  const breadthRaw = paramCds.size >= MIN_MULTIVARIATE_PARAMS ? 1.0
    : paramCds.size >= 2 ? 0.5
    : 0.2;
  const breadthScore = Math.min(1.0, breadthRaw + pairBonus * 0.3);

  // C. Temporal tightness (tighter = more suspicious)
  const timestamps = events.map(e => new Date(e.detectedAt).getTime());
  const spread = Math.max(...timestamps) - Math.min(...timestamps);
  // Score: events in <30min = 1.0, window/2 = 0.5, full window = 0.1
  const tightnessScore = spread <= 0
    ? 1.0
    : Math.max(0.1, 1.0 - (spread / windowMs));

  return (
    COORDINATION_WEIGHTS.clusterSize * clusterScore +
    COORDINATION_WEIGHTS.parameterBreadth * breadthScore +
    COORDINATION_WEIGHTS.temporalTightness * tightnessScore
  );
}

/* ------------------------------------------------------------------ */
/*  Multivariate Detection (standalone, for scored HUC analysis)      */
/* ------------------------------------------------------------------ */

export function detectMultivariateAnomaly(
  events: ChangeEvent[],
  huc8: string,
): { isMultivariate: boolean; paramCount: number; matchedPairs: string[][] } {
  const hucEvents = events.filter(e => e.geography.huc8 === huc8);
  const paramCds = new Set<string>();
  for (const e of hucEvents) {
    const pc = (e.payload as Record<string, unknown>).parameterCd;
    if (typeof pc === 'string') paramCds.add(pc);
  }

  const matchedPairs: string[][] = [];
  for (const pair of ATTACK_INDICATOR_PAIRS) {
    if (pair.params.every(p => paramCds.has(p))) {
      matchedPairs.push(pair.params);
    }
  }

  return {
    isMultivariate: paramCds.size >= MIN_MULTIVARIATE_PARAMS || matchedPairs.length > 0,
    paramCount: paramCds.size,
    matchedPairs,
  };
}
