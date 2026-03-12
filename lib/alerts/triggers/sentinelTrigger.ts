/* ------------------------------------------------------------------ */
/*  PIN Alerts - Sentinel Trigger                                      */
/*  Progressive classification + persistence gating for calmer alerts. */
/* ------------------------------------------------------------------ */

import type { AlertEvent } from '../types';
import type { ScoredHuc, CbrnIndicator } from '../../sentinel/types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';
import { getScoredHucs, ensureWarmed as warmScoring } from '../../sentinel/scoringEngine';
import { getAllStatuses, ensureWarmed as warmHealth } from '../../sentinel/sentinelHealth';
import { classifyEvent, gatherConfounders } from '../../sentinel/classificationEngine';
import { getAllEvents, ensureWarmed as warmQueue } from '../../sentinel/eventQueue';
import { getNwsAlertsAll, ensureWarmed as warmNwsAlerts } from '../../nwsAlertCache';

interface InvestigationState {
  consecutiveRuns: number;
  lastStage: string;
  lastConfidence: number;
  externalIssued: boolean;
  weatherDrivenEvent: boolean;
  weatherContext: string | null;
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

export const PATTERN_LABELS: Record<string, string> = {
  'potomac-crisis': 'Multi-Hazard Crisis',
  'infrastructure-stress': 'Infrastructure Stress',
  'spreading-contamination': 'Spreading Contamination',
  'regulatory-escalation': 'Regulatory Escalation',
  'enforcement-cascade': 'Enforcement Cascade',
  'bio-threat-correlation': 'Bio-Threat Correlation',
  'flood-prediction-cascade': 'Flood Prediction Cascade',
  'airborne-public-health': 'Airborne Public Health Risk',
  'predicted-infrastructure-failure': 'Predicted Infrastructure Failure',
  'hab-wq-correlation': 'HAB Water Quality',
  'beach-pathogen-wq': 'Beach Pathogen Alert',
};

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
  cbrnIndicators?: CbrnIndicator[],
  classificationDowngradeReason?: string,
): AlertEvent {
  const hasPatterns = huc.activePatterns.length > 0;
  return {
    id: crypto.randomUUID(),
    type: 'sentinel',
    severity,
    title: `HUC ${huc.huc8}: ${
      hasPatterns
        ? PATTERN_LABELS[huc.activePatterns[0].patternId] || 'Anomaly Signal'
        : 'Persistent Anomaly Signal'
    }`,
    body: [
      `Watershed ${huc.huc8} (${huc.stateAbbr}) — ${huc.level} level, score ${huc.score}.`,
      hasPatterns
        ? `Patterns: ${huc.activePatterns.map(p => PATTERN_LABELS[p.patternId] || p.patternId).join(', ')}.`
        : 'Score-only signal — monitoring for pattern emergence.',
      `${huc.events.length} correlated event${huc.events.length !== 1 ? 's' : ''} detected. Confidence: ${(confidence * 100).toFixed(0)}%.`,
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
      ...(cbrnIndicators && cbrnIndicators.length > 0 ? { cbrnIndicators } : {}),
      ...(classificationDowngradeReason ? { classificationDowngradeReason } : {}),
    },
  };
}

export async function evaluateSentinelAlerts(): Promise<AlertEvent[]> {
  await Promise.all([warmScoring(), warmHealth(), warmQueue(), warmNwsAlerts()]);

  const scoredHucs = getScoredHucs();
  const sourceStates = getAllStatuses();
  const previousSnapshot = await loadCacheFromBlob<SentinelSnapshot>(BLOB_PATHS.sentinelSnapshot);
  const prevInvestigations = previousSnapshot?.investigations ?? {};

  const events: AlertEvent[] = [];
  const now = new Date().toISOString();
  const allEvents = getAllEvents();
  const newInvestigations: Record<string, InvestigationState> = {};

  // Queue-age warmup: suppress external alerts if event queue < 24h old
  const oldestEventTs = allEvents.reduce((oldest, e) => {
    const ts = new Date(e.detectedAt).getTime();
    return ts < oldest ? ts : oldest;
  }, Date.now());
  const queueAgeHours = (Date.now() - oldestEventTs) / (1000 * 60 * 60);
  const systemWarming = allEvents.length === 0 || queueAgeHours < 24;

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
    if (classification.cbrnIndicators.length > 0) {
      rationale.push(`CBRN indicators: ${classification.cbrnIndicators.map(i => `${i.category.toUpperCase()} (${(i.confidence * 100).toFixed(0)}%)`).join(', ')}.`);
    }

    let stage: SentinelStage = stageBase;
    let externalEligible = false;
    let downgradeReason: string | undefined;
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

    // Pattern gate: CRITICAL with no patterns → downgrade to warning
    if (hardCritical && huc.activePatterns.length === 0) {
      downgradeReason = 'CRITICAL score with no corroborating patterns — downgraded to warning.';
      rationale.push(downgradeReason);
    }

    // Single-source gate: block external_alert if only one data source
    if (externalEligible) {
      const distinctSources = new Set(huc.events.map(e => e.source));
      if (distinctSources.size <= 1) {
        externalEligible = false;
        rationale.push(`Single-source CRITICAL (${[...distinctSources][0] || 'unknown'}) — awaiting multi-source corroboration.`);
      }
    }

    // Queue-age warmup: suppress external alerts while system is warming up
    if (externalEligible && systemWarming) {
      externalEligible = false;
      rationale.push(`System warmup: event queue only ${queueAgeHours.toFixed(1)}h old — suppressing external alert.`);
    }

    // Weather-driven event suppression: if active NWS severe weather warning
    // covers this HUC's state, suppress outbound alert and tag as weather-driven
    let weatherDriven = false;
    let weatherCtx: string | null = null;
    if (externalEligible) {
      const nwsAlerts = getNwsAlertsAll();
      const severeTypes = ['tornado', 'severe thunderstorm', 'hurricane', 'tropical storm'];
      const activeWarnings = nwsAlerts.filter(a =>
        a.event.toLowerCase().includes('warning') &&
        severeTypes.some(t => a.event.toLowerCase().includes(t)) &&
        (a.areaDesc.includes(huc.stateAbbr) || a.senderName.includes(huc.stateAbbr)),
      );
      if (activeWarnings.length > 0) {
        externalEligible = false;
        weatherDriven = true;
        weatherCtx = activeWarnings[0].event;
        rationale.push(`Suppressed: active NWS ${activeWarnings[0].event} — weather-driven event.`);
      }
    }

    newInvestigations[huc.huc8] = {
      consecutiveRuns: nextRuns,
      lastStage: stage,
      lastConfidence: confidence,
      externalIssued: externalEligible ? true : Boolean(prev?.externalIssued),
      weatherDrivenEvent: weatherDriven,
      weatherContext: weatherCtx,
      updatedAt: now,
    };

    if (!externalEligible) continue;

    const severity: AlertEvent['severity'] = (hardCritical && huc.activePatterns.length > 0) ? 'critical' : 'warning';
    events.push(makeHucAlert(huc, severity, stage, confidence, rationale, now, classification.cbrnIndicators, downgradeReason));
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
