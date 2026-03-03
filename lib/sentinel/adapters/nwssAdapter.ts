/* ------------------------------------------------------------------ */
/*  PIN Sentinel — CDC NWSS Wastewater Adapter                        */
/*  Reads NWSS anomalies from nwssCache, maps to ChangeEvents.        */
/*  Enables the bio-threat compound pattern (CDC_NWSS + WQ sources).  */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';
import { getNwssAnomalies, ensureWarmed } from '../../nwss/nwssCache';
import { fipsToHuc8 } from '../../nwss/geo-mapping';

const SOURCE = 'CDC_NWSS' as const;

/* ------------------------------------------------------------------ */
/*  Sigma → Severity Mapping                                          */
/* ------------------------------------------------------------------ */

function sigmaToSeverity(sigma: number): SeverityHint {
  if (sigma >= 4.0) return 'CRITICAL';
  if (sigma >= 3.0) return 'HIGH';
  if (sigma >= 2.0) return 'MODERATE';
  return 'LOW';
}

/* ------------------------------------------------------------------ */
/*  Poll                                                              */
/* ------------------------------------------------------------------ */

export async function pollNwss(prevState: SentinelSourceState): Promise<AdapterResult> {
  await ensureWarmed();

  const anomalies = getNwssAnomalies();
  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();
  const knownIds = new Set(prevState.knownIds ?? []);

  for (const anomaly of anomalies) {
    // Only ingest anomalies above 2σ
    if (anomaly.sigma < 2.0) continue;

    const entityId = `nwss-${anomaly.sewershedId}-${anomaly.pathogen}`;

    // Dedup against previously seen anomalies
    if (knownIds.has(entityId)) continue;
    knownIds.add(entityId);

    // Resolve to HUC-8 via FIPS crosswalk
    const huc8s = fipsToHuc8(anomaly.countyFips);
    const huc8 = huc8s.length > 0 ? huc8s[0] : undefined;

    events.push({
      eventId: `nwss-${anomaly.sewershedId}-${anomaly.pathogen}-${Date.now().toString(36)}`,
      source: SOURCE,
      detectedAt: now,
      sourceTimestamp: anomaly.date,
      changeType: 'THRESHOLD_CROSSED',
      geography: {
        huc8,
        huc6: huc8?.slice(0, 6),
        stateAbbr: anomaly.jurisdiction,
      },
      severityHint: sigmaToSeverity(anomaly.sigma),
      payload: {
        pathogen: anomaly.pathogen,
        concentration: anomaly.concentration,
        baseline: anomaly.baseline,
        sigma: anomaly.sigma,
        level: anomaly.level,
        populationServed: anomaly.populationServed,
        countiesServed: anomaly.countiesServed,
        sewershedId: anomaly.sewershedId,
      },
      metadata: {
        sourceRecordId: entityId,
        currentValue: anomaly.concentration,
        threshold: anomaly.baseline + (anomaly.sigma * (anomaly.concentration - anomaly.baseline) / anomaly.sigma),
      },
    });
  }

  return {
    events,
    updatedState: {
      knownIds: [...knownIds],
    },
  };
}
