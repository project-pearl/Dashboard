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

  // Compare build timestamps — if the cache was rebuilt since last poll, emit ONE aggregate event
  const currentBuilt = status.lastBuilt;
  const prevBuilt = prevState.lastTimestamps?.['lastBuilt'];

  if (currentBuilt && currentBuilt !== prevBuilt) {
    const loadedStates = status.statesLoaded ?? [];

    // Single aggregate event per rebuild — prevents 50+ events flooding the scorer
    events.push({
      eventId: `attains-rebuild-${Date.now().toString(36)}`,
      source: SOURCE,
      detectedAt: now,
      sourceTimestamp: currentBuilt,
      changeType: 'DOCUMENT_UPDATED',
      geography: {
        // No specific state — this is a national-level assessment update
      },
      severityHint: 'LOW',
      payload: {
        statesUpdated: loadedStates.length,
        states: loadedStates,
        cacheStatus: status.status,
        loadedStates: status.loadedStates,
      },
      metadata: {
        sourceRecordId: `attains-rebuild-${currentBuilt}`,
      },
    });
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
