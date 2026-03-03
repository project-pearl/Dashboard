/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Attack vs. Benign Classification Engine            */
/*  Rule-based confounder checking + threat signal detection.         */
/* ------------------------------------------------------------------ */

import type {
  ScoredHuc,
  ChangeEvent,
  AttackClassification,
  AttackClassificationType,
  ConfounderCheck,
  ClassificationReasoning,
} from './types';
import {
  CLASSIFICATION_THRESHOLDS,
  CONFOUNDER_RULES,
  ATTACK_SIGNALS,
  BIO_MARKER_PARAMS,
} from './classificationConfig';
import { getEventsForHuc } from './eventQueue';

/* ------------------------------------------------------------------ */
/*  Main Classification                                               */
/* ------------------------------------------------------------------ */

export function classifyEvent(
  huc: ScoredHuc,
  confounders: ConfounderCheck[],
): AttackClassification {
  const reasoning: ClassificationReasoning[] = [];

  // Start with base threat score derived from sentinel score level
  let threatScore = baseScoreFromLevel(huc.level);

  // Pattern multiplier: active compound patterns boost threat
  if (huc.activePatterns.length > 0) {
    const patternBoost = Math.min(0.2, huc.activePatterns.length * 0.1);
    threatScore += patternBoost;
    reasoning.push({
      rule: 'compound_patterns',
      effect: 'boost',
      magnitude: patternBoost,
      detail: `${huc.activePatterns.length} active compound pattern(s): ${huc.activePatterns.map(p => p.patternId).join(', ')}`,
    });
  }

  // Apply confounder reductions
  const matchedConfounders = confounders.filter(c => c.matched);
  for (const confounder of matchedConfounders) {
    const rule = CONFOUNDER_RULES.find(r => r.id === confounder.rule);
    if (!rule) continue;

    // Check if this confounder applies to the event's parameters
    const hucEvents = getEventsForHuc(huc.huc8);
    const eventParamCds = extractParamCds(hucEvents);

    if (rule.affectedParamCds.length > 0) {
      // Only reduce if affected parameters are present
      const affected = rule.affectedParamCds.some(p => eventParamCds.has(p));
      if (!affected) continue;

      // For flood confounder, exempt bio-markers
      if (rule.id === 'FLOOD_CONFOUNDER') {
        const onlyBioMarkers = [...eventParamCds].every(p => BIO_MARKER_PARAMS.has(p));
        if (onlyBioMarkers) continue;
      }
    }

    threatScore -= rule.reductionMagnitude;
    reasoning.push({
      rule: rule.id,
      effect: 'reduce',
      magnitude: rule.reductionMagnitude,
      detail: `${rule.name}: ${confounder.detail}`,
    });
  }

  // Apply attack signal boosts
  const hucEvents = getEventsForHuc(huc.huc8);
  const eventParamCds = extractParamCds(hucEvents);

  for (const signal of ATTACK_SIGNALS) {
    if (signal.id === 'MULTI_SITE_PATTERN') {
      // Multi-site detection: check if the HUC has coordination context
      // (this is boosted externally by coordination engine)
      continue;
    }

    const matchingParams = signal.paramCds.filter(p => eventParamCds.has(p));
    if (matchingParams.length >= signal.minDeviations) {
      threatScore += signal.boostMagnitude;
      reasoning.push({
        rule: signal.id,
        effect: 'boost',
        magnitude: signal.boostMagnitude,
        detail: `${signal.name}: ${signal.description}`,
      });
    }
  }

  // Clamp to [0, 1]
  threatScore = Math.max(0, Math.min(1, threatScore));

  const classification = classifyScore(threatScore, matchedConfounders.length);

  return {
    classification,
    threatScore: Math.round(threatScore * 1000) / 1000,
    confounders,
    reasoning,
  };
}

/* ------------------------------------------------------------------ */
/*  Confounder Gathering                                              */
/* ------------------------------------------------------------------ */

export function gatherConfounders(
  huc8: string,
  allEvents: ChangeEvent[],
): ConfounderCheck[] {
  const checks: ConfounderCheck[] = [];

  // 1. Rainfall confounder — check for QPE_RAINFALL events in same area
  const rainfallEvents = allEvents.filter(
    e => e.source === 'QPE_RAINFALL' &&
      e.geography.huc8 === huc8 &&
      isRecent(e.detectedAt, 24),
  );
  const maxRainfall = Math.max(0, ...rainfallEvents.map(
    e => (e.metadata.currentValue ?? 0) as number
  ));
  checks.push({
    rule: 'RAINFALL_CONFOUNDER',
    matched: maxRainfall > 2.0, // > 2 inches in 24h
    detail: maxRainfall > 0
      ? `Recent rainfall: ${maxRainfall.toFixed(1)} inches in 24h`
      : 'No significant recent rainfall',
  });

  // 2. Flood confounder — check for NWS_ALERTS with flood events
  const floodEvents = allEvents.filter(
    e => e.source === 'NWS_ALERTS' &&
      e.geography.huc8 === huc8 &&
      isRecent(e.detectedAt, 48) &&
      (e.severityHint === 'HIGH' || e.severityHint === 'CRITICAL'),
  );
  checks.push({
    rule: 'FLOOD_CONFOUNDER',
    matched: floodEvents.length > 0,
    detail: floodEvents.length > 0
      ? `${floodEvents.length} active NWS flood warning(s)`
      : 'No active flood warnings',
  });

  // 3. Seasonal confounder — check month for DO/temperature patterns
  const month = new Date().getMonth(); // 0-11
  const isSummerSeason = month >= 5 && month <= 8; // Jun-Sep
  const hucEvents = allEvents.filter(e => e.geography.huc8 === huc8);
  const hasSeasonalParams = hucEvents.some(e => {
    const pc = (e.payload as Record<string, unknown>).parameterCd;
    return pc === '00300' || pc === '00010'; // DO or temperature
  });
  checks.push({
    rule: 'SEASONAL_CONFOUNDER',
    matched: isSummerSeason && hasSeasonalParams,
    detail: isSummerSeason && hasSeasonalParams
      ? 'Summer season — DO/temperature anomalies may be seasonal'
      : 'Not in seasonal confounder window',
  });

  // 4. Covariance confounder — check for temp+DO correlation
  const hasDO = hucEvents.some(e =>
    (e.payload as Record<string, unknown>).parameterCd === '00300',
  );
  const hasTemp = hucEvents.some(e =>
    (e.payload as Record<string, unknown>).parameterCd === '00010',
  );
  checks.push({
    rule: 'COVARIANCE_CONFOUNDER',
    matched: hasDO && hasTemp,
    detail: hasDO && hasTemp
      ? 'Temperature and DO co-occurring — natural covariance possible'
      : 'No natural covariance detected',
  });

  return checks;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function baseScoreFromLevel(level: string): number {
  switch (level) {
    case 'CRITICAL':  return 0.7;
    case 'WATCH':     return 0.5;
    case 'ADVISORY':  return 0.3;
    default:          return 0.1;
  }
}

function classifyScore(
  score: number,
  confounderCount: number,
): AttackClassificationType {
  if (confounderCount > 0 && score < CLASSIFICATION_THRESHOLDS.POSSIBLE_ATTACK) {
    return 'likely_benign';
  }
  if (score >= CLASSIFICATION_THRESHOLDS.LIKELY_ATTACK) return 'likely_attack';
  if (score >= CLASSIFICATION_THRESHOLDS.POSSIBLE_ATTACK) return 'possible_attack';
  return 'likely_benign';
}

function extractParamCds(events: ChangeEvent[]): Set<string> {
  const params = new Set<string>();
  for (const e of events) {
    const pc = (e.payload as Record<string, unknown>).parameterCd;
    if (typeof pc === 'string') params.add(pc);
  }
  return params;
}

function isRecent(detectedAt: string, hoursAgo: number): boolean {
  return Date.now() - new Date(detectedAt).getTime() < hoursAgo * 60 * 60 * 1000;
}
