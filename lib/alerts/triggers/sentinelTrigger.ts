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
import { classifyEvent, gatherConfounders } from '../../sentinel/classificationEngine';
import { getAllEvents, ensureWarmed as warmQueue } from '../../sentinel/eventQueue';

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
  await Promise.all([warmScoring(), warmHealth(), warmQueue()]);

  const scoredHucs = getScoredHucs();
  const sourceStates = getAllStatuses();
  const previousSnapshot = await loadCacheFromBlob<SentinelSnapshot>(BLOB_PATHS.sentinelSnapshot);

  const events: AlertEvent[] = [];
  const now = new Date().toISOString();
  const prevHucLevels = previousSnapshot?.hucLevels ?? {};
  const prevSourceStatuses = previousSnapshot?.sourceStatuses ?? {};

  // Pre-fetch events once for classification
  const allEvents = getAllEvents();

  // --- HUC level changes (with classification gate) ---
  for (const huc of scoredHucs) {
    const prevLevel = prevHucLevels[huc.huc8];

    const isNewCritical = huc.level === 'CRITICAL' && prevLevel !== 'CRITICAL';
    const isNewWatch = huc.level === 'WATCH' && prevLevel !== 'WATCH' && prevLevel !== 'CRITICAL';

    if (!isNewCritical && !isNewWatch) continue;

    // Run classification — suppress likely_benign (weather-correlated noise)
    const confounders = gatherConfounders(huc.huc8, allEvents);
    const classification = classifyEvent(huc, confounders);

    if (classification.classification === 'likely_benign') {
      console.warn(
        `[sentinel-trigger] Suppressed ${huc.huc8} (${huc.level}) — classified likely_benign ` +
        `(threat=${classification.threatScore}, confounders: ${confounders.filter(c => c.matched).map(c => c.rule).join(', ')})`,
      );
      continue;
    }

    const severity = isNewCritical ? 'critical' as const : 'warning' as const;
    const action = isNewCritical ? 'escalated to CRITICAL' : 'escalated to WATCH';
    const alert = makeHucAlert(huc, severity, action, now);

    // Attach classification to metadata for downstream enrichment
    alert.metadata.classification = classification;

    events.push(alert);
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
