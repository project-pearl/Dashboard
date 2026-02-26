/* ------------------------------------------------------------------ */
/*  PIN Sentinel — ECHO Enforcement Adapter                           */
/*  Reads existing echoCache, diffs enforcement/violation IDs         */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';
import { getEchoAllData, type EchoFacility, type EchoViolation } from '../../echoCache';

const SOURCE = 'ECHO_ENFORCEMENT' as const;

function violationKey(v: EchoViolation): string {
  return `${v.registryId}|${v.violationType}|${v.pollutant}`;
}

function mapSeverity(v: EchoViolation): SeverityHint {
  if (v.qtrsInNc >= 4) return 'HIGH';
  if (v.qtrsInNc >= 2) return 'MODERATE';
  return 'LOW';
}

export function pollEcho(prevState: SentinelSourceState): AdapterResult {
  const { violations, facilities } = getEchoAllData();

  // Build facility lookup for cross-referencing
  const facilityMap = new Map<string, EchoFacility>();
  for (const f of facilities) facilityMap.set(f.registryId, f);

  const currentKeys = violations.map(v => violationKey(v));
  const previousKeys = new Set(prevState.knownIds);

  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < violations.length; i++) {
    const v = violations[i];
    const key = currentKeys[i];

    if (!previousKeys.has(key)) {
      const facility = facilityMap.get(v.registryId);

      events.push({
        eventId: `echo-${v.registryId.slice(-8)}-${Date.now().toString(36)}`,
        source: SOURCE,
        detectedAt: now,
        sourceTimestamp: null,
        changeType: 'NEW_RECORD',
        geography: {
          stateAbbr: v.state,
          lat: v.lat,
          lng: v.lng,
        },
        severityHint: mapSeverity(v),
        payload: {
          registryId: v.registryId,
          facilityName: v.name,
          violationType: v.violationType,
          pollutant: v.pollutant,
          qtrsInNc: v.qtrsInNc,
          permitId: facility?.permitId,
        },
        metadata: {
          sourceRecordId: key,
          facilityId: facility?.permitId ?? v.registryId,
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
