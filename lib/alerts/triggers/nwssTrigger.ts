/* ------------------------------------------------------------------ */
/*  PIN Alerts — NWSS Pathogen Anomaly Trigger                        */
/*                                                                    */
/*  After each NWSS poll cycle, evaluates pathogen anomalies and      */
/*  generates alert events for sigma >= 3.0 spikes.                   */
/*                                                                    */
/*  Cooldown: 7 days per sewershed+pathogen (data is weekly).         */
/* ------------------------------------------------------------------ */

import type { AlertEvent } from '../types';
import type { NwssCorrelation } from '../../sentinel/types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';
import { ensureWarmed, getNwssAnomalies } from '../../nwss/nwssCache';
import type { NWSSAnomaly } from '../../nwss/types';

/** Optional correlation data injected by sentinel-score cron */
let _correlationCache: NwssCorrelation[] = [];

export function setNwssCorrelations(correlations: NwssCorrelation[]): void {
  _correlationCache = correlations;
}

/* ------------------------------------------------------------------ */
/*  Snapshot — tracks which anomalies we've already alerted on        */
/* ------------------------------------------------------------------ */

interface NwssAlertSnapshot {
  /** sewershedId_pathogen → last alert ISO timestamp */
  lastAlertedAt: Record<string, string>;
  takenAt: string;
}

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/* ------------------------------------------------------------------ */
/*  Evaluate                                                          */
/* ------------------------------------------------------------------ */

export async function evaluateNwssAlerts(): Promise<AlertEvent[]> {
  await ensureWarmed();

  const anomalies = getNwssAnomalies();
  if (anomalies.length === 0) return [];

  const previousSnapshot = await loadCacheFromBlob<NwssAlertSnapshot>(BLOB_PATHS.nwssSnapshot);
  const prevAlerted = previousSnapshot?.lastAlertedAt ?? {};
  const now = new Date();
  const nowIso = now.toISOString();
  const events: AlertEvent[] = [];
  const newAlerted: Record<string, string> = { ...prevAlerted };

  for (const anomaly of anomalies) {
    // Only alert on sigma >= 3.0 (anomalous or extreme)
    if (anomaly.sigma < 3.0) continue;

    const key = `${anomaly.sewershedId}_${anomaly.pathogen}`;

    // Cooldown check — 7 days per sewershed+pathogen
    const lastAlerted = prevAlerted[key];
    if (lastAlerted && (now.getTime() - new Date(lastAlerted).getTime()) < COOLDOWN_MS) {
      continue;
    }

    const severity = anomaly.sigma >= 4.0 ? 'critical' : 'warning';
    const pathogenLabel = anomaly.pathogen.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const sigmaStr = anomaly.sigma.toFixed(1);

    events.push({
      id: crypto.randomUUID(),
      type: 'nwss',
      severity,
      title: `${pathogenLabel} +${sigmaStr}\u03C3 \u2014 ${anomaly.countiesServed || anomaly.jurisdiction} wastewater`,
      body: `${pathogenLabel} concentration ${anomaly.concentration.toFixed(0)} copies/person/day ` +
        `vs baseline ${anomaly.baseline.toFixed(0)}. ` +
        `${sigmaStr} sigma deviation. ` +
        `Population served: ${anomaly.populationServed.toLocaleString()}.`,
      entityId: anomaly.sewershedId,
      entityLabel: `${anomaly.pathogen} at ${anomaly.countiesServed || anomaly.jurisdiction} WWTP`,
      dedupKey: `nwss:${anomaly.sewershedId}:${anomaly.pathogen}:${severity}`,
      createdAt: nowIso,
      channel: 'email',
      recipientEmail: '',
      sent: false,
      sentAt: null,
      error: null,
      ruleId: null,
      metadata: {
        pathogen: anomaly.pathogen,
        concentration: anomaly.concentration,
        baseline: anomaly.baseline,
        sigma: anomaly.sigma,
        level: anomaly.level,
        countyFips: anomaly.countyFips,
        populationServed: anomaly.populationServed,
        sampleDate: anomaly.date,
        jurisdiction: anomaly.jurisdiction,
        ...getCorrelationMetadata(anomaly),
      },
    });

    newAlerted[key] = nowIso;
  }

  // Save updated snapshot
  await saveCacheToBlob(BLOB_PATHS.nwssSnapshot, {
    lastAlertedAt: newAlerted,
    takenAt: nowIso,
  });

  return events;
}

/* ------------------------------------------------------------------ */
/*  Correlation Metadata Helper                                       */
/* ------------------------------------------------------------------ */

function getCorrelationMetadata(anomaly: NWSSAnomaly): Record<string, unknown> {
  const match = _correlationCache.find(
    c => c.nwssAnomaly.sewershedId === anomaly.sewershedId &&
         c.nwssAnomaly.pathogen === anomaly.pathogen,
  );

  if (!match) return {};

  return {
    correlationScore: match.correlationScore,
    correlatedWqEvents: match.wqEvents.length,
    parameterMatches: match.parameterMatches,
    spatialMatch: match.spatialMatch,
    temporalGapHours: match.temporalGapHours,
  };
}
