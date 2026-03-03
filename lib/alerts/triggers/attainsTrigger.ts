/* ------------------------------------------------------------------ */
/*  PIN Alerts — ATTAINS Impairment Diff Trigger                      */
/*  Compares daily ATTAINS snapshots for significant changes          */
/* ------------------------------------------------------------------ */

import type { AlertEvent } from '../types';
import type { StateSummary } from '../../attainsCache';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';
import { getAttainsCacheSummary, ensureWarmed as warmAttains } from '../../attainsCache';

/* ------------------------------------------------------------------ */
/*  Snapshot Types                                                    */
/* ------------------------------------------------------------------ */

interface AttainsStateSnapshot {
  high: number;
  medium: number;
  tmdlNeeded: number;
  total: number;
  topCauses: string[];
}

type AttainsSnapshot = Record<string, AttainsStateSnapshot>;

const SIGNIFICANT_INCREASE_PCT = 10; // >=10% increase in Cat 5 → warning
const MINOR_CHANGE_THRESHOLD = 5;     // any change >= 5 waterbodies → info

/* ------------------------------------------------------------------ */
/*  Evaluate                                                          */
/* ------------------------------------------------------------------ */

export async function evaluateAttainsAlerts(): Promise<AlertEvent[]> {
  await warmAttains();

  const { states } = getAttainsCacheSummary();
  const previousSnapshot = await loadCacheFromBlob<AttainsSnapshot>(BLOB_PATHS.attainsSnapshot);

  const events: AlertEvent[] = [];
  const now = new Date().toISOString();
  const newSnapshot: AttainsSnapshot = {};

  for (const [stateCode, summary] of Object.entries(states)) {
    newSnapshot[stateCode] = {
      high: summary.high,
      medium: summary.medium,
      tmdlNeeded: summary.tmdlNeeded,
      total: summary.total,
      topCauses: summary.topCauses,
    };

    if (!previousSnapshot) continue;
    const prev = previousSnapshot[stateCode];
    if (!prev) continue;

    const cat5Diff = summary.tmdlNeeded - prev.tmdlNeeded;
    const highDiff = summary.high - prev.high;

    // Significant increase in Cat 5 (TMDL needed)
    if (prev.tmdlNeeded > 0 && cat5Diff > 0) {
      const pctIncrease = Math.round((cat5Diff / prev.tmdlNeeded) * 100);

      if (pctIncrease >= SIGNIFICANT_INCREASE_PCT) {
        events.push({
          id: crypto.randomUUID(),
          type: 'attains',
          severity: 'warning',
          title: `${stateCode}: ${cat5Diff} new Category 5 listings`,
          body: `${stateCode} ATTAINS data shows ${cat5Diff} new Category 5 (impaired, TMDL needed) waterbodies (${pctIncrease}% increase, ${prev.tmdlNeeded} → ${summary.tmdlNeeded}).`,
          entityId: stateCode,
          entityLabel: `${stateCode} ATTAINS`,
          dedupKey: `attains:${stateCode}:cat5:warning`,
          createdAt: now,
          channel: 'email',
          recipientEmail: '',
          sent: false,
          sentAt: null,
          error: null,
          ruleId: null,
          metadata: { cat5Before: prev.tmdlNeeded, cat5After: summary.tmdlNeeded, pctIncrease },
        });
        continue; // don't also fire info for the same state
      }
    }

    // Minor but notable changes
    if (Math.abs(cat5Diff) >= MINOR_CHANGE_THRESHOLD || Math.abs(highDiff) >= MINOR_CHANGE_THRESHOLD) {
      const changes: string[] = [];
      if (cat5Diff !== 0) changes.push(`Cat 5: ${cat5Diff > 0 ? '+' : ''}${cat5Diff}`);
      if (highDiff !== 0) changes.push(`High priority: ${highDiff > 0 ? '+' : ''}${highDiff}`);

      events.push({
        id: crypto.randomUUID(),
        type: 'attains',
        severity: 'info',
        title: `${stateCode}: ATTAINS data updated`,
        body: `${stateCode} ATTAINS changes: ${changes.join(', ')}.`,
        entityId: stateCode,
        entityLabel: `${stateCode} ATTAINS`,
        dedupKey: `attains:${stateCode}:change:info`,
        createdAt: now,
        channel: 'email',
        recipientEmail: '',
        sent: false,
        sentAt: null,
        error: null,
        ruleId: null,
        metadata: { cat5Diff, highDiff },
      });
    }
  }

  // Save new snapshot as baseline
  await saveCacheToBlob(BLOB_PATHS.attainsSnapshot, newSnapshot);

  return events;
}
