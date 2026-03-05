/* ------------------------------------------------------------------ */
/*  PIN Sentinel — NWS Alert Adapter                                  */
/*  Reads existing nwsAlertCache, diffs alert IDs                     */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';
import { getNwsAlertsByState, type NwsAlert } from '../../nwsAlertCache';
import { US_STATES } from '../stateValidation';

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

/** Extract state from senderName or areaDesc, validated against known codes */
function extractState(alert: NwsAlert): string | undefined {
  // NWS senderName often contains state: "NWS Baltimore MD/Washington DC"
  for (const m of alert.senderName?.matchAll(/\b([A-Z]{2})\b/g) ?? []) {
    if (US_STATES.has(m[1])) return m[1];
  }
  // Fallback: check areaDesc
  for (const m of alert.areaDesc?.matchAll(/\b([A-Z]{2})\b/g) ?? []) {
    if (US_STATES.has(m[1])) return m[1];
  }
  return undefined;
}

export function pollNws(prevState: SentinelSourceState): AdapterResult {
  const alertsByState = getNwsAlertsByState();
  const currentIds = new Set<string>();
  const previousIds = new Set(prevState.knownIds);

  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();

  for (const [state, alerts] of alertsByState) {
    for (const alert of alerts) {
      currentIds.add(alert.id);

      if (!previousIds.has(alert.id)) {
        const severity = mapSeverity(alert.severity);
        // Use cache state key (authoritative); fall back to regex extraction
        const stateAbbr = US_STATES.has(state) ? state : extractState(alert);

        events.push({
          eventId: `nws-${alert.id.replace(/[^a-zA-Z0-9]/g, '').slice(-20)}-${Date.now().toString(36)}`,
          source: SOURCE,
          detectedAt: now,
          sourceTimestamp: alert.onset ?? null,
          changeType: 'NEW_RECORD',
          geography: {
            stateAbbr,
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
  }

  return {
    events,
    updatedState: {
      knownIds: Array.from(currentIds),
    },
  };
}
