/* ------------------------------------------------------------------ */
/*  PIN Alerts - Sentinel Trigger                                      */
/*  Progressive classification + persistence gating for calmer alerts. */
/* ------------------------------------------------------------------ */

import type { AlertEvent } from '../types';
import type { ScoredHuc } from '../../sentinel/types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';
import { getScoredHucs, ensureWarmed as warmScoring } from '../../sentinel/scoringEngine';
import { getAllStatuses, ensureWarmed as warmHealth } from '../../sentinel/sentinelHealth';
import { classifyEvent, gatherConfounders } from '../../sentinel/classificationEngine';
import { getAllEvents, ensureWarmed as warmQueue } from '../../sentinel/eventQueue';

interface InvestigationState {
  consecutiveRuns: number;
  lastStage: string;
  lastConfidence: number;
  externalIssued: boolean;
  updatedAt: string;
}

interface SentinelSnapshot {
  hucLevels: Record<string, string>;
  sourceStatuses: Record<string, string>;
  investigations?: Record<string, InvestigationState>;
  takenAt: string;
}

type SentinelStage =
  | 'possible_anomaly'
  | 'likely_natural_or_operational'
  | 'unexplained_investigate'
  | 'external_alert';

function stageFromClassification(
  classification: 'likely_attack' | 'possible_attack' | 'likely_benign' | 'insufficient_data',
): SentinelStage {
  if (classification === 'likely_benign') return 'likely_natural_or_operational';
  if (classification === 'insufficient_data') return 'possible_anomaly';
  if (classification === 'possible_attack') return 'possible_anomaly';
  return 'unexplained_investigate';
}

function makeHucAlert(
  huc: ScoredHuc,
  severity: AlertEvent['severity'],
  stage: SentinelStage,
  confidence: number,
  rationale: string[],
  now: string,
): AlertEvent {
  return {
    id: crypto.randomUUID(),
    type: 'sentinel',
    severity,
    title: `HUC ${huc.huc8}: ${stage === 'external_alert' ? 'Persistent anomaly signal' : 'Possible anomaly signal'}`,
    body: [
      `Watershed ${huc.huc8} (${huc.stateAbbr}) score ${huc.score} (${huc.level}).`,
      `Stage: ${stage}. Confidence: ${(confidence * 100).toFixed(0)}%.`,
      'Signal is under active analysis; no confirmed contamination event unless separately validated.',
    ].join(' '),
    entityId: huc.huc8,
    entityLabel: `HUC-8 ${huc.huc8} (${huc.stateAbbr})`,
    dedupKey: `sentinel:${huc.huc8}:${stage}:${severity}`,
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
      activePatterns: huc.activePatterns.map((p) => p.patternId),
      stage,
      confidence,
      rationale,
    },
  };
}

export async function evaluateSentinelAlerts(): Promise<AlertEvent[]> {
  await Promise.all([warmScoring(), warmHealth(), warmQueue()]);

  const scoredHucs = getScoredHucs();
  const sourceStates = getAllStatuses();
  const previousSnapshot = await loadCacheFromBlob<SentinelSnapshot>(BLOB_PATHS.sentinelSnapshot);
  const prevInvestigations = previousSnapshot?.investigations ?? {};

  const events: AlertEvent[] = [];
  const now = new Date().toISOString();
  const allEvents = getAllEvents();
  const newInvestigations: Record<string, InvestigationState> = {};

  for (const huc of scoredHucs) {
    if (huc.level !== 'WATCH' && huc.level !== 'CRITICAL') continue;

    const confounders = gatherConfounders(huc.huc8, allEvents);
    const classification = classifyEvent(huc, confounders);
    const prev = prevInvestigations[huc.huc8] ?? null;
    const nextRuns = (prev?.consecutiveRuns ?? 0) + 1;
    const stageBase = stageFromClassification(classification.classification);
    const confidence = classification.threatScore;
    const corroborated = huc.events.length >= 2 || huc.activePatterns.length >= 1;
    const persistent = nextRuns >= 2;
    const hardCritical = huc.level === 'CRITICAL' && confidence >= 0.8;

    const rationale: string[] = [];
    if (classification.classification === 'likely_benign') rationale.push('Confounder model indicates likely benign/natural signal.');
    if (persistent) rationale.push(`Signal persisted for ${nextRuns} runs.`);
    if (corroborated) rationale.push('Corroborated by multiple events/patterns.');

    let stage: SentinelStage = stageBase;
    let externalEligible = false;
    if (hardCritical) {
      stage = 'external_alert';
      externalEligible = true;
      rationale.push('Hard-critical threshold reached.');
    } else if (
      stageBase !== 'likely_natural_or_operational' &&
      persistent &&
      corroborated &&
      !prev?.externalIssued
    ) {
      stage = 'external_alert';
      externalEligible = true;
      rationale.push('Persistence + corroboration gate satisfied.');
    }

    newInvestigations[huc.huc8] = {
      consecutiveRuns: nextRuns,
      lastStage: stage,
      lastConfidence: confidence,
      externalIssued: externalEligible ? true : Boolean(prev?.externalIssued),
      updatedAt: now,
    };

    if (!externalEligible) continue;

    const severity: AlertEvent['severity'] = hardCritical ? 'critical' : 'warning';
    events.push(makeHucAlert(huc, severity, stage, confidence, rationale, now));
  }

  for (const source of sourceStates) {
    const prevStatus = previousSnapshot?.sourceStatuses?.[source.source];
    if (source.status === 'OFFLINE' && prevStatus !== 'OFFLINE') {
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
    if (source.status === 'HEALTHY' && prevStatus === 'OFFLINE') {
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

  const newSnapshot: SentinelSnapshot = {
    hucLevels: Object.fromEntries(scoredHucs.map((h) => [h.huc8, h.level])),
    sourceStatuses: Object.fromEntries(sourceStates.map((s) => [s.source, s.status])),
    investigations: newInvestigations,
    takenAt: now,
  };
  await saveCacheToBlob(BLOB_PATHS.sentinelSnapshot, newSnapshot);

  return events;
}
