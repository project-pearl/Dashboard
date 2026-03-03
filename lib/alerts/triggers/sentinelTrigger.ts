/* ------------------------------------------------------------------ */
/*  PIN Alerts — Sentinel Trigger                                     */
/*  Reads persisted scored HUCs + source health → candidate alerts    */
/* ------------------------------------------------------------------ */

import type { AlertEvent } from '../types';
import type { ScoredHuc, SentinelSourceState } from '../../sentinel/types';
import { BLOB_PATHS } from '../config';
import { BLOB_PATHS as SENTINEL_BLOB_PATHS } from '../../sentinel/config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';
import { getScoredHucs, ensureWarmed as warmScoring } from '../../sentinel/scoringEngine';
import { getAllStatuses, ensureWarmed as warmHealth } from '../../sentinel/sentinelHealth';

/* ------------------------------------------------------------------ */
/*  Snapshot Types                                                    */
/* ------------------------------------------------------------------ */

interface SentinelSnapshot {
  hucLevels: Record<string, string>;     // huc8 → ScoreLevel
  sourceStatuses: Record<string, string>; // source → SourceStatus
  takenAt: string;
}

/* ------------------------------------------------------------------ */
/*  Evaluate                                                          */
/* ------------------------------------------------------------------ */

export async function evaluateSentinelAlerts(): Promise<AlertEvent[]> {
  await warmScoring();
  await warmHealth();

  const scoredHucs = getScoredHucs();
  const sourceStates = getAllStatuses();
  const previousSnapshot = await loadCacheFromBlob<SentinelSnapshot>(BLOB_PATHS.sentinelSnapshot);

  const events: AlertEvent[] = [];
  const now = new Date().toISOString();
  const prevHucLevels = previousSnapshot?.hucLevels ?? {};
  const prevSourceStatuses = previousSnapshot?.sourceStatuses ?? {};

  // --- HUC level changes ---
  for (const huc of scoredHucs) {
    const prevLevel = prevHucLevels[huc.huc8];

    if (huc.level === 'CRITICAL' && prevLevel !== 'CRITICAL') {
      events.push(makeHucAlert(huc, 'critical', 'escalated to CRITICAL', now));
    } else if (huc.level === 'WATCH' && prevLevel !== 'WATCH' && prevLevel !== 'CRITICAL') {
      events.push(makeHucAlert(huc, 'warning', 'escalated to WATCH', now));
    }
  }

  // --- Source health transitions ---
  for (const source of sourceStates) {
    const prev = prevSourceStatuses[source.source];

    // DEGRADED → OFFLINE
    if (source.status === 'OFFLINE' && prev !== 'OFFLINE') {
      events.push({
        id: crypto.randomUUID(),
        type: 'sentinel',
        severity: 'critical',
        title: `${source.source} went OFFLINE`,
        body: `Data source ${source.source} has gone offline after ${source.consecutiveFailures} consecutive failures.`,
        entityId: source.source,
        entityLabel: source.source,
        dedupKey: `sentinel:${source.source}:offline`,
        createdAt: now,
        channel: 'email',
        recipientEmail: '',
        sent: false,
        sentAt: null,
        error: null,
        ruleId: null,
        metadata: { consecutiveFailures: source.consecutiveFailures },
      });
    }

    // OFFLINE → HEALTHY (recovery)
    if (source.status === 'HEALTHY' && prev === 'OFFLINE') {
      events.push({
        id: crypto.randomUUID(),
        type: 'sentinel',
        severity: 'info',
        title: `${source.source} recovered`,
        body: `Data source ${source.source} has recovered and is now HEALTHY.`,
        entityId: source.source,
        entityLabel: source.source,
        dedupKey: `sentinel:${source.source}:recovery`,
        createdAt: now,
        channel: 'email',
        recipientEmail: '',
        sent: false,
        sentAt: null,
        error: null,
        ruleId: null,
        metadata: {},
      });
    }
  }

  // --- Save snapshot ---
  const newSnapshot: SentinelSnapshot = {
    hucLevels: Object.fromEntries(scoredHucs.map(h => [h.huc8, h.level])),
    sourceStatuses: Object.fromEntries(sourceStates.map(s => [s.source, s.status])),
    takenAt: now,
  };
  await saveCacheToBlob(BLOB_PATHS.sentinelSnapshot, newSnapshot);

  return events;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeHucAlert(
  huc: ScoredHuc,
  severity: AlertEvent['severity'],
  action: string,
  now: string,
): AlertEvent {
  return {
    id: crypto.randomUUID(),
    type: 'sentinel',
    severity,
    title: `HUC ${huc.huc8} ${action}`,
    body: `Watershed ${huc.huc8} (${huc.stateAbbr}) has ${action} with score ${huc.score}. ${huc.events.length} contributing event(s).`,
    entityId: huc.huc8,
    entityLabel: `HUC-8 ${huc.huc8} (${huc.stateAbbr})`,
    dedupKey: `sentinel:${huc.huc8}:${severity}`,
    createdAt: now,
    channel: 'email',
    recipientEmail: '',
    sent: false,
    sentAt: null,
    error: null,
    ruleId: null,
    metadata: {
      score: huc.score,
      level: huc.level,
      eventCount: huc.events.length,
      activePatterns: huc.activePatterns.map(p => p.patternId),
    },
  };
}
