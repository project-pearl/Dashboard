/* ------------------------------------------------------------------ */
/*  PIN Sentinel — NWS Alert Adapter                                  */
/*  Reads existing nwsAlertCache, diffs alert IDs                     */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';
import { getNwsAlertsAll, type NwsAlert } from '../../nwsAlertCache';

const SOURCE = 'NWS_ALERTS' as const;

/** Map NWS severity string to our SeverityHint */
function mapSeverity(nwsSeverity: string): SeverityHint {
  switch (nwsSeverity?.toLowerCase()) {
    case 'extreme':  return 'CRITICAL';
    case 'severe':   return 'HIGH';
    case 'moderate': return 'MODERATE';
    default:         return 'LOW';
  }
}

/** Guess state from senderName or areaDesc */
function extractState(alert: NwsAlert): string | undefined {
  // NWS senderName often contains state: "NWS Baltimore MD/Washington DC"
  const m = alert.senderName?.match(/\b([A-Z]{2})\b/);
  if (m) return m[1];
  // Fallback: check areaDesc
  const m2 = alert.areaDesc?.match(/\b([A-Z]{2})\b/);
  if (m2) return m2[1];
  return undefined;
}

export function pollNws(prevState: SentinelSourceState): AdapterResult {
  const allAlerts = getNwsAlertsAll();
  const currentIds = new Set(allAlerts.map(a => a.id));
  const previousIds = new Set(prevState.knownIds);

  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();

  for (const alert of allAlerts) {
    const isNew = !previousIds.has(alert.id);

    if (isNew) {
      const severity = mapSeverity(alert.severity);
      events.push({
        eventId: `nws-${alert.id.replace(/[^a-zA-Z0-9]/g, '').slice(-20)}-${Date.now().toString(36)}`,
        source: SOURCE,
        detectedAt: now,
        sourceTimestamp: alert.onset ?? null,
        changeType: 'NEW_RECORD',
        geography: {
          stateAbbr: extractState(alert),
        },
        severityHint: severity,
        payload: {
          event: alert.event,
          headline: alert.headline,
          areaDesc: alert.areaDesc,
          certainty: alert.certainty,
          urgency: alert.urgency,
        },
        metadata: {
          sourceRecordId: alert.id,
        },
      });
    }
  }

  return {
    events,
    updatedState: {
      knownIds: Array.from(currentIds),
    },
  };
}
