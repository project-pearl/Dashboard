/* ------------------------------------------------------------------ */
/*  PIN Sentinel — NWSS ↔ Water Quality Correlation Engine            */
/*  Correlates NWSS pathogen anomalies with downstream WQ events.     */
/* ------------------------------------------------------------------ */

import type { ChangeEvent, NwssCorrelation } from './types';
import type { NWSSAnomaly } from '../nwss/types';
import { fipsToHuc8 } from '../nwss/geo-mapping';
import { getAdjacentHucs } from './hucAdjacency';
import { estimateFlowTimingForHucs, type HucFlowTiming } from './hucFlowTime';
import {
  CORRELATION_WINDOW_HOURS,
  BIO_PROXY_LINKS,
  CORRELATION_WEIGHTS,
  CORRELATION_THRESHOLD,
} from './nwssCorrelationConfig';

/* ------------------------------------------------------------------ */
/*  Main Correlation                                                  */
/* ------------------------------------------------------------------ */

export function correlateNwssWithWQ(
  nwssAnomalies: NWSSAnomaly[],
  wqEvents: ChangeEvent[],
): NwssCorrelation[] {
  const correlations: NwssCorrelation[] = [];

  for (const anomaly of nwssAnomalies) {
    // Only correlate significant anomalies (≥2σ)
    if (anomaly.sigma < 2.0) continue;

    // Resolve NWSS sewershed to HUC-8s
    const anomalyHucs = fipsToHuc8(anomaly.countyFips);
    if (anomalyHucs.length === 0) continue;

    // Expand to adjacent HUCs
    const adjacentHucs = new Set<string>();
    for (const huc of anomalyHucs) {
      adjacentHucs.add(huc);
      for (const adj of getAdjacentHucs(huc)) {
        adjacentHucs.add(adj);
      }
    }

    // Find WQ events within dynamic flow-time window (fallback: legacy fixed window)
    const anomalyTime = new Date(anomaly.date).getTime();
    const legacyWindowHours = CORRELATION_WINDOW_HOURS;

    const matchedEvents: MatchedEvent[] = [];
    for (const e of wqEvents) {
      if (!e.geography.huc8) continue;
      const eventTime = new Date(e.detectedAt).getTime();
      const gapHoursSigned = (eventTime - anomalyTime) / (60 * 60 * 1000);
      const gapHoursAbs = Math.abs(gapHoursSigned);

      const flowTiming = estimateFlowTimingForHucs(anomalyHucs, e.geography.huc8);
      if (flowTiming) {
        if (gapHoursAbs <= flowTiming.windowHours) {
          matchedEvents.push({ event: e, gapHoursSigned, flowTiming });
        }
        continue;
      }

      // Fallback for gaps in HUC graph/centroid data: preserve prior behavior
      if (adjacentHucs.has(e.geography.huc8) && gapHoursAbs <= legacyWindowHours) {
        matchedEvents.push({ event: e, gapHoursSigned, flowTiming: null });
      }
    }

    if (matchedEvents.length === 0) continue;

    // Score the correlation
    const result = scoreCorrelation(anomaly, anomalyHucs, matchedEvents, legacyWindowHours);

    if (result.correlationScore >= CORRELATION_THRESHOLD) {
      correlations.push(result);
    }
  }

  return correlations;
}

/* ------------------------------------------------------------------ */
/*  Scoring                                                           */
/* ------------------------------------------------------------------ */

interface MatchedEvent {
  event: ChangeEvent;
  gapHoursSigned: number;
  flowTiming: HucFlowTiming | null;
}

function scoreCorrelation(
  anomaly: NWSSAnomaly,
  anomalyHucs: string[],
  matched: MatchedEvent[],
  legacyWindowHours: number,
): NwssCorrelation {
  const wqEvents = matched.map(m => m.event);
  const anomalyHucSet = new Set(anomalyHucs);

  // 1. Parameter match score
  const links = BIO_PROXY_LINKS.filter(l => l.pathogen === anomaly.pathogen);
  const parameterMatches: { paramCd: string; matchStrength: number }[] = [];
  let bestParamScore = 0;

  for (const event of matched.map(m => m.event)) {
    const paramCd = (event.payload as Record<string, unknown>).parameterCd as string | undefined;
    if (!paramCd) continue;

    const link = links.find(l => l.paramCd === paramCd);
    if (link) {
      parameterMatches.push({ paramCd, matchStrength: link.matchStrength });
      bestParamScore = Math.max(bestParamScore, link.matchStrength);
    }
  }
  // Even without direct link, nearby WQ anomalies have some correlation
  const paramScore = parameterMatches.length > 0
    ? bestParamScore
    : 0.1;

  // 2. Temporal proximity score (best alignment to expected HUC travel-time)
  let bestTemporalScore = 0.1;
  let bestGapHours = Infinity;
  let bestTiming: HucFlowTiming | null = null;

  for (const m of matched) {
    const observed = Math.abs(m.gapHoursSigned);
    const expected = m.flowTiming?.expectedHours ?? 0;
    const window = m.flowTiming?.windowHours ?? legacyWindowHours;
    const err = Math.abs(observed - expected);
    const baseScore = Math.max(0.1, 1.0 - (err / Math.max(window, 1)));

    // Prefer downstream lag (event after anomaly); penalize reverse lead timing.
    const directionalScore = m.gapHoursSigned >= 0 ? baseScore : baseScore * 0.6;
    if (directionalScore > bestTemporalScore) {
      bestTemporalScore = directionalScore;
      bestGapHours = observed;
      bestTiming = m.flowTiming;
    }
  }

  // 3. Spatial proximity score
  let spatialMatch: 'same_huc' | 'adjacent_huc' | 'none' = 'none';
  for (const e of wqEvents) {
    if (e.geography.huc8 && anomalyHucSet.has(e.geography.huc8)) {
      spatialMatch = 'same_huc';
      break;
    }
  }
  if (spatialMatch === 'none' && wqEvents.length > 0) {
    spatialMatch = 'adjacent_huc';
  }
  const spatialScore = spatialMatch === 'same_huc' ? 1.0 : 0.5;

  // Combined score
  const correlationScore =
    CORRELATION_WEIGHTS.temporalProximity * bestTemporalScore +
    CORRELATION_WEIGHTS.spatialProximity * spatialScore +
    CORRELATION_WEIGHTS.parameterMatch * paramScore;

  const temporalGapHours = bestGapHours === Infinity ? 0 : bestGapHours;

  return {
    nwssAnomaly: {
      sewershedId: anomaly.sewershedId,
      pathogen: anomaly.pathogen,
      sigma: anomaly.sigma,
      concentration: anomaly.concentration,
      date: anomaly.date,
    },
    wqEvents,
    correlationScore: Math.round(correlationScore * 1000) / 1000,
    parameterMatches,
    spatialMatch,
    temporalGapHours: Math.round(temporalGapHours * 10) / 10,
    hucFlowTiming: bestTiming ? {
      expectedHours: bestTiming.expectedHours,
      windowHours: bestTiming.windowHours,
      hops: bestTiming.hops,
      distanceKm: bestTiming.distanceKm,
      routingMode: bestTiming.routingMode,
      lagDirection: matched.some(m => m.gapHoursSigned >= 0) ? 'downstream_lag' : 'reverse_lead',
    } : undefined,
  };
}
