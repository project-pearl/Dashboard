/* ------------------------------------------------------------------ */
/*  PIN Sentinel — ATTAINS Adapter                                    */
/*  Checks attainsCache build timestamp for changes                   */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SentinelSourceState } from '../types';
import { getCacheStatus } from '../../attainsCache';

const SOURCE = 'ATTAINS' as const;

export function pollAttains(prevState: SentinelSourceState): AdapterResult {
  const status = getCacheStatus();
  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();

  // Compare build timestamps — if the cache was rebuilt since last poll, emit events
  const currentBuilt = status.lastBuilt;
  const prevBuilt = prevState.lastTimestamps?.['lastBuilt'];

  if (currentBuilt && currentBuilt !== prevBuilt) {
    // ATTAINS updated — emit one event per loaded state
    const loadedStates = status.statesLoaded ?? [];

    for (const stateAbbr of loadedStates) {
      events.push({
        eventId: `attains-${stateAbbr}-${Date.now().toString(36)}`,
        source: SOURCE,
        detectedAt: now,
        sourceTimestamp: currentBuilt,
        changeType: 'DOCUMENT_UPDATED',
        geography: {
          stateAbbr,
        },
        severityHint: 'LOW',
        payload: {
          state: stateAbbr,
          cacheStatus: status.status,
          loadedStates: status.loadedStates,
        },
        metadata: {
          sourceRecordId: `attains-${stateAbbr}-${currentBuilt}`,
        },
      });
    }
  }

  return {
    events,
    updatedState: {
      lastTimestamps: {
        ...prevState.lastTimestamps,
        lastBuilt: currentBuilt ?? prevBuilt ?? '',
      },
    },
  };
}
