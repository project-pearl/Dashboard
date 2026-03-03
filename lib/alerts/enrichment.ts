/* ------------------------------------------------------------------ */
/*  PIN Alerts — Alert Payload Enrichment                             */
/*  Gathers HUC context, deviations, classification, map links.      */
/* ------------------------------------------------------------------ */

import type { AlertEvent } from './types';
import type { EnrichedAlert, ChangeEvent, NwssCorrelation } from '../sentinel/types';
import { getEventsForHuc, getEventsForHucAndAdjacent, getAllEvents } from '../sentinel/eventQueue';
import { getAdjacentHucs, getStateForHuc, getHucEntry } from '../sentinel/hucAdjacency';
import { getDeviation, getBaseline } from '../sentinel/parameterBaselines';
import { getScoredHucs } from '../sentinel/scoringEngine';
import { getAllStatuses } from '../sentinel/sentinelHealth';
import { detectCoordination } from '../sentinel/coordinationEngine';
import { classifyEvent, gatherConfounders } from '../sentinel/classificationEngine';

/* ------------------------------------------------------------------ */
/*  Main Enrichment                                                   */
/* ------------------------------------------------------------------ */

export function enrichAlertPayload(event: AlertEvent): EnrichedAlert {
  const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pin-dashboard.com';

  // 1. Affected HUCs
  const affectedHucs = gatherAffectedHucs(event);

  // 2. Parameter deviations
  const parameterDeviations = gatherDeviations(event);

  // 3. Coordination context
  const coordinationContext = gatherCoordinationContext(event);

  // 4. Classification
  const classification = gatherClassification(event);

  // 5. Map URL
  const huc8 = event.entityId;
  const mapUrl = `${dashboardUrl}/map?huc=${huc8}&alert=${event.id}`;

  // 6. Related events (last 24h, same area)
  const relatedEvents = gatherRelatedEvents(event);

  // 7. Source health
  const sourceHealth = getAllStatuses().map(s => ({
    source: s.source,
    status: s.status,
  }));

  return {
    affectedHucs,
    parameterDeviations,
    coordinationContext,
    classification,
    mapUrl,
    relatedEvents,
    sourceHealth,
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function gatherAffectedHucs(event: AlertEvent): EnrichedAlert['affectedHucs'] {
  const huc8 = event.entityId;
  const hucs: EnrichedAlert['affectedHucs'] = [];

  // Primary HUC
  const state = getStateForHuc(huc8) ?? '';
  const entry = getHucEntry(huc8);
  hucs.push({ huc8, name: entry ? `HUC-8 ${huc8}` : huc8, state });

  // Check metadata for member HUCs (coordination alerts)
  const memberHucs = event.metadata?.memberHucs;
  if (Array.isArray(memberHucs)) {
    for (const mhuc of memberHucs) {
      if (typeof mhuc === 'string' && mhuc !== huc8) {
        const mstate = getStateForHuc(mhuc) ?? '';
        hucs.push({ huc8: mhuc, name: `HUC-8 ${mhuc}`, state: mstate });
      }
    }
  }

  return hucs;
}

function gatherDeviations(event: AlertEvent): EnrichedAlert['parameterDeviations'] {
  const huc8 = event.entityId;
  const events = getEventsForHuc(huc8);
  const deviations: EnrichedAlert['parameterDeviations'] = [];

  for (const e of events) {
    const paramCd = (e.payload as Record<string, unknown>).parameterCd;
    const value = e.metadata.currentValue;
    if (typeof paramCd !== 'string' || typeof value !== 'number') continue;

    const baseline = getBaseline(huc8, paramCd);
    const zScore = getDeviation(huc8, paramCd, value);

    deviations.push({
      huc8,
      paramCd,
      value,
      zScore: zScore ?? 0,
      baseline: baseline
        ? { mean: baseline.mean, stdDev: baseline.stdDev }
        : { mean: 0, stdDev: 0 },
    });
  }

  return deviations;
}

function gatherCoordinationContext(event: AlertEvent): EnrichedAlert['coordinationContext'] {
  // If this is a coordination alert, extract from metadata
  if (event.type === 'coordination' && event.metadata) {
    return {
      coordinationScore: (event.metadata.coordinationScore as number) ?? 0,
      clusterSize: (event.metadata.clusterSize as number) ?? 0,
      memberHucs: (event.metadata.memberHucs as string[]) ?? [],
      temporalSpread: (event.metadata.temporalSpreadMs as number) ?? 0,
    };
  }

  // For non-coordination alerts, check if there's a coordinated cluster
  // involving this entity
  const allEvents = getAllEvents();
  const coordinated = detectCoordination(allEvents);
  const match = coordinated.find(c =>
    c.memberHucs.includes(event.entityId) ||
    c.huc6 === event.entityId.slice(0, 6)
  );

  if (!match) return null;

  return {
    coordinationScore: match.coordinationScore,
    clusterSize: match.memberHucs.length,
    memberHucs: match.memberHucs,
    temporalSpread: match.temporalSpread,
  };
}

function gatherClassification(event: AlertEvent): EnrichedAlert['classification'] {
  // Check if classification was already attached
  if (event.metadata?.classification) {
    return event.metadata.classification as EnrichedAlert['classification'];
  }

  // Try to classify from scored HUCs
  const scored = getScoredHucs();
  const huc = scored.find(h => h.huc8 === event.entityId);
  if (!huc || (huc.level !== 'WATCH' && huc.level !== 'CRITICAL')) return null;

  const allEvents = getAllEvents();
  const confounders = gatherConfounders(huc.huc8, allEvents);
  return classifyEvent(huc, confounders);
}

function gatherRelatedEvents(event: AlertEvent): ChangeEvent[] {
  const huc8 = event.entityId;
  const adjacentHucs = getAdjacentHucs(huc8);
  const allNearby = getEventsForHucAndAdjacent(huc8, adjacentHucs);

  // Filter to last 24h
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return allNearby
    .filter(e => new Date(e.detectedAt).getTime() > cutoff)
    .slice(0, 20); // Cap at 20
}
