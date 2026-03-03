/* ------------------------------------------------------------------ */
/*  PIN Sentinel — NWSS ↔ Water Quality Correlation Engine            */
/*  Correlates NWSS pathogen anomalies with downstream WQ events.     */
/* ------------------------------------------------------------------ */

import type { ChangeEvent, NwssCorrelation } from './types';
import type { NWSSAnomaly } from '../nwss/types';
import { fipsToHuc8 } from '../nwss/geo-mapping';
import { getAdjacentHucs } from './hucAdjacency';
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

    // Find WQ events within the correlation window
    const anomalyTime = new Date(anomaly.date).getTime();
    const windowMs = CORRELATION_WINDOW_HOURS * 60 * 60 * 1000;

    const nearbyWqEvents = wqEvents.filter(e => {
      if (!e.geography.huc8) return false;
      if (!adjacentHucs.has(e.geography.huc8)) return false;

      const eventTime = new Date(e.detectedAt).getTime();
      const gap = Math.abs(eventTime - anomalyTime);
      return gap <= windowMs;
    });

    if (nearbyWqEvents.length === 0) continue;

    // Score the correlation
    const result = scoreCorrelation(anomaly, anomalyHucs, nearbyWqEvents, windowMs);

    if (result.correlationScore >= CORRELATION_THRESHOLD) {
      correlations.push(result);
    }
  }

  return correlations;
}

/* ------------------------------------------------------------------ */
/*  Scoring                                                           */
/* ------------------------------------------------------------------ */

function scoreCorrelation(
  anomaly: NWSSAnomaly,
  anomalyHucs: string[],
  wqEvents: ChangeEvent[],
  windowMs: number,
): NwssCorrelation {
  const anomalyTime = new Date(anomaly.date).getTime();
  const anomalyHucSet = new Set(anomalyHucs);

  // 1. Parameter match score
  const links = BIO_PROXY_LINKS.filter(l => l.pathogen === anomaly.pathogen);
  const parameterMatches: { paramCd: string; matchStrength: number }[] = [];
  let bestParamScore = 0;

  for (const event of wqEvents) {
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

  // 2. Temporal proximity score (closer = higher)
  let minGap = Infinity;
  for (const e of wqEvents) {
    const gap = Math.abs(new Date(e.detectedAt).getTime() - anomalyTime);
    minGap = Math.min(minGap, gap);
  }
  const temporalScore = minGap <= 0
    ? 1.0
    : Math.max(0.1, 1.0 - (minGap / windowMs));

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
    CORRELATION_WEIGHTS.temporalProximity * temporalScore +
    CORRELATION_WEIGHTS.spatialProximity * spatialScore +
    CORRELATION_WEIGHTS.parameterMatch * paramScore;

  const temporalGapHours = minGap === Infinity ? 0 : minGap / (60 * 60 * 1000);

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
  };
}
