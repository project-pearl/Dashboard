/* ------------------------------------------------------------------ */
/*  PIN Sentinel — NWPS Flood Adapter                                 */
/*  Reads NWS alerts, filters for flood-specific events, emits as    */
/*  NWPS_FLOOD source for compound pattern matching.                  */
/*                                                                    */
/*  This separates flood signals from general NWS weather alerts so   */
/*  the scoring engine can weight them independently (infrastructure  */
/*  stress, potomac-crisis patterns).                                 */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';
import { getNwsAlertsByState, type NwsAlert } from '../../nwsAlertCache';
import { US_STATES } from '../stateValidation';

const SOURCE = 'NWPS_FLOOD' as const;

/* ------------------------------------------------------------------ */
/*  Flood Event Classification                                        */
/* ------------------------------------------------------------------ */

/** NWS event strings that indicate flood conditions */
const FLOOD_EVENTS = new Set([
  'Flood Warning',
  'Flood Watch',
  'Flood Advisory',
  'Flash Flood Warning',
  'Flash Flood Watch',
  'Coastal Flood Warning',
  'Coastal Flood Watch',
  'Coastal Flood Advisory',
  'River Flood Warning',
  'Lakeshore Flood Warning',
  'Hydrologic Outlook',
]);

/** Broader match — catches variants like "Flood Statement" */
function isFloodEvent(event: string): boolean {
  if (FLOOD_EVENTS.has(event)) return true;
  const lower = event.toLowerCase();
  return lower.includes('flood') || lower.includes('flash flood');
}

/** Map NWS severity + event urgency to our severity hint */
function mapFloodSeverity(alert: NwsAlert): SeverityHint {
  const event = alert.event.toLowerCase();
  const severity = alert.severity?.toLowerCase() ?? '';
  const urgency = alert.urgency?.toLowerCase() ?? '';

  // Flash flood warnings are always high priority
  if (event.includes('flash flood') && event.includes('warning')) return 'CRITICAL';
  if (severity === 'extreme') return 'CRITICAL';
  if (severity === 'severe' || urgency === 'immediate') return 'HIGH';
  if (event.includes('warning')) return 'HIGH';
  if (event.includes('watch')) return 'MODERATE';
  return 'LOW';
}

/** Extract state from senderName or areaDesc, validated against known codes */
function extractState(alert: NwsAlert): string | undefined {
  for (const m of alert.senderName?.matchAll(/\b([A-Z]{2})\b/g) ?? []) {
    if (US_STATES.has(m[1])) return m[1];
  }
  for (const m of alert.areaDesc?.matchAll(/\b([A-Z]{2})\b/g) ?? []) {
    if (US_STATES.has(m[1])) return m[1];
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Poll                                                              */
/* ------------------------------------------------------------------ */

export function pollNwpsFlood(prevState: SentinelSourceState): AdapterResult {
  const alertsByState = getNwsAlertsByState();
  const currentIds = new Set<string>();
  const previousIds = new Set(prevState.knownIds);

  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();

  for (const [state, alerts] of alertsByState) {
    for (const alert of alerts) {
      if (!isFloodEvent(alert.event)) continue;
      currentIds.add(alert.id);
      if (previousIds.has(alert.id)) continue;

      const stateAbbr = US_STATES.has(state) ? state : extractState(alert);

      events.push({
        eventId: `nwps-${alert.id.replace(/[^a-zA-Z0-9]/g, '').slice(-20)}-${Date.now().toString(36)}`,
        source: SOURCE,
        detectedAt: now,
        sourceTimestamp: alert.onset ?? null,
        changeType: 'NEW_RECORD',
        geography: {
          stateAbbr,
        },
        severityHint: mapFloodSeverity(alert),
        payload: {
          event: alert.event,
          headline: alert.headline,
          areaDesc: alert.areaDesc,
          certainty: alert.certainty,
          urgency: alert.urgency,
          precipForecast: alert.precipForecast,
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
