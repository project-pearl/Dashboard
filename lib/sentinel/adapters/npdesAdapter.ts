/* ------------------------------------------------------------------ */
/*  PIN Sentinel — NPDES/ICIS Adapter                                 */
/*  Reads existing icisCache, detects new violations                  */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';
import { getIcisAllData, type IcisViolation } from '../../icisCache';

const SOURCE = 'NPDES_DMR' as const;

/** Build a composite key for a violation */
function violationKey(v: IcisViolation): string {
  return `${v.permit}|${v.code}|${v.date}`;
}

function mapSeverity(v: IcisViolation): SeverityHint {
  if (v.rnc) return 'HIGH';        // Reportable Noncompliance
  if (v.severity?.toLowerCase().includes('significant')) return 'HIGH';
  if (v.severity?.toLowerCase().includes('reportable')) return 'HIGH';
  return 'MODERATE';
}

export function pollNpdes(prevState: SentinelSourceState): AdapterResult {
  const { violations } = getIcisAllData();
  const currentKeys = violations.map(v => violationKey(v));
  const previousKeys = new Set(prevState.knownIds);

  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < violations.length; i++) {
    const v = violations[i];
    const key = currentKeys[i];

    if (!previousKeys.has(key)) {
      events.push({
        eventId: `npdes-${v.permit.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString(36)}`,
        source: SOURCE,
        detectedAt: now,
        sourceTimestamp: v.date || null,
        changeType: 'NEW_RECORD',
        geography: {
          stateAbbr: undefined, // violations don't carry state directly
          lat: v.lat,
          lng: v.lng,
        },
        severityHint: mapSeverity(v),
        payload: {
          permit: v.permit,
          violationCode: v.code,
          description: v.desc,
          rnc: v.rnc,
        },
        metadata: {
          sourceRecordId: key,
          facilityId: v.permit,
        },
      });
    }
  }

  return {
    events,
    updatedState: {
      knownIds: currentKeys,
    },
  };
}
