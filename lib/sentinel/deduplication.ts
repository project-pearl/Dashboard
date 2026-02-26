/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Deduplication Rules                                */
/*  4 rules from the spec to prevent event queue bloat                */
/* ------------------------------------------------------------------ */

import type { ChangeEvent } from './types';
import { DEDUP_WINDOWS } from './config';

/**
 * Returns true if `newEvent` should be suppressed (deduplicated).
 */
export function shouldDeduplicate(
  newEvent: ChangeEvent,
  existingEvents: ChangeEvent[]
): boolean {
  const newTs = new Date(newEvent.detectedAt).getTime();

  for (const existing of existingEvents) {
    const existTs = new Date(existing.detectedAt).getTime();

    // Rule 1: Same source + same sourceRecordId within 1 hour → suppress
    if (
      newEvent.source === existing.source &&
      newEvent.metadata.sourceRecordId &&
      existing.metadata.sourceRecordId &&
      newEvent.metadata.sourceRecordId === existing.metadata.sourceRecordId
    ) {
      const windowMs = DEDUP_WINDOWS.sameSourceId_hours * 60 * 60 * 1000;
      if (Math.abs(newTs - existTs) < windowMs) {
        return true;
      }
    }

    // Rule 2: Same source + geography + changeType within 4 hours
    //         → suppress (severity upgrade handled by caller)
    if (
      newEvent.source === existing.source &&
      newEvent.changeType === existing.changeType &&
      sameGeography(newEvent, existing)
    ) {
      const windowMs = DEDUP_WINDOWS.sameGeography_hours * 60 * 60 * 1000;
      if (Math.abs(newTs - existTs) < windowMs) {
        // If new event is higher severity, update existing in-place
        if (severityRank(newEvent.severityHint) > severityRank(existing.severityHint)) {
          existing.severityHint = newEvent.severityHint;
          existing.payload = { ...existing.payload, ...newEvent.payload };
        }
        return true;
      }
    }

    // Rule 3: NWS alert updates — same alertId, re-score only on severity change
    if (
      newEvent.source === 'NWS_ALERTS' &&
      existing.source === 'NWS_ALERTS' &&
      DEDUP_WINDOWS.nwsAlertUpdateOnly &&
      newEvent.metadata.sourceRecordId &&
      newEvent.metadata.sourceRecordId === existing.metadata.sourceRecordId
    ) {
      // Allow through only if severity changed
      if (newEvent.severityHint === existing.severityHint) {
        return true;
      }
      // Severity changed — allow as new event (don't suppress)
      continue;
    }

    // Rule 4: ATTAINS — 24h cooldown per assessment unit
    if (
      newEvent.source === 'ATTAINS' &&
      existing.source === 'ATTAINS' &&
      sameGeography(newEvent, existing)
    ) {
      const windowMs = DEDUP_WINDOWS.attainsCooldown_hours * 60 * 60 * 1000;
      if (Math.abs(newTs - existTs) < windowMs) {
        return true;
      }
    }
  }

  return false;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function sameGeography(a: ChangeEvent, b: ChangeEvent): boolean {
  // HUC-8 match is strongest
  if (a.geography.huc8 && b.geography.huc8) {
    return a.geography.huc8 === b.geography.huc8;
  }
  // Fallback: same state
  if (a.geography.stateAbbr && b.geography.stateAbbr) {
    return a.geography.stateAbbr === b.geography.stateAbbr;
  }
  return false;
}

const SEVERITY_RANK: Record<string, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function severityRank(s: string): number {
  return SEVERITY_RANK[s] ?? 0;
}
