/**
 * Event Predictor — state-level event probability engine.
 *
 * Combines current conditions + trend direction + historical signal patterns
 * to predict specific events (violations, impairment listings, enforcement, etc.).
 *
 * Works at the state level using aggregate metrics. Complements riskForecast.ts
 * which works at the HUC-8/site level.
 *
 * Pure functions, no cache dependencies.
 */

import type {
  DailyStateSnapshot,
  TrendResult,
  EventPrediction,
  PredictedEventType,
} from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp probability to 0-95 (never 100% certainty). */
function clamp(p: number): number {
  return Math.round(Math.min(95, Math.max(0, p)));
}

/** Compute a simple 30-day rate of change from snapshot history. */
function recentChange(
  history: DailyStateSnapshot[],
  metric: keyof DailyStateSnapshot,
  days: number = 30,
): number {
  if (history.length < 2) return 0;
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-days);
  if (recent.length < 2) return 0;
  const first = recent[0][metric] as number;
  const last = recent[recent.length - 1][metric] as number;
  return typeof first === 'number' && typeof last === 'number' ? last - first : 0;
}

/** Determine confidence level from historical data availability. */
function confidenceFromHistory(historicalDays: number): EventPrediction['confidence'] {
  if (historicalDays >= 90) return 'HIGH';
  if (historicalDays >= 30) return 'MODERATE';
  return 'LOW';
}

// ── Event Predictors ─────────────────────────────────────────────────────────

function predictViolation90d(
  current: DailyStateSnapshot,
  trend: TrendResult | null,
  history: DailyStateSnapshot[],
): EventPrediction {
  let probability = 10; // base rate
  const drivers: string[] = [];
  let trendContribution = 0;

  // Current violations signal more likely
  if (current.violationCount > 0) {
    probability += 30;
    drivers.push(`${current.violationCount} active violations`);
  }
  if (current.violationCount > 5) {
    probability += 10;
    drivers.push('High violation count (>5)');
  }

  // Trend: declining risk trend = higher probability
  if (trend?.direction === 'declining') {
    trendContribution = 15;
    probability += trendContribution;
    drivers.push('Risk trend is declining');
  } else if (trend?.direction === 'improving') {
    trendContribution = -10;
    probability += trendContribution;
  }

  // Recent 30d change in violations
  const violationDelta = recentChange(history, 'violationCount', 30);
  if (violationDelta > 0) {
    probability += Math.min(10, violationDelta * 2);
    drivers.push(`Violations rising (+${violationDelta} over 30d)`);
  }

  return {
    eventType: 'violation-90d',
    label: 'New Violation (90 days)',
    probability: clamp(probability),
    timeframe: '90 days',
    confidence: confidenceFromHistory(history.length),
    drivers,
    trendContribution,
  };
}

function predictImpairmentListing(
  current: DailyStateSnapshot,
  trend: TrendResult | null,
  history: DailyStateSnapshot[],
): EventPrediction {
  let probability = 5;
  const drivers: string[] = [];
  let trendContribution = 0;

  if (current.impairmentPct > 50) {
    probability += 25;
    drivers.push(`High impairment rate (${current.impairmentPct.toFixed(1)}%)`);
  } else if (current.impairmentPct > 30) {
    probability += 15;
    drivers.push(`Moderate impairment rate (${current.impairmentPct.toFixed(1)}%)`);
  }

  // Rising impairment trend
  if (trend?.direction === 'declining') {
    trendContribution = 15;
    probability += trendContribution;
    drivers.push('Impairment trend is worsening');
  } else if (trend?.direction === 'improving') {
    trendContribution = -10;
    probability += trendContribution;
  }

  // New high-severity signals indicate emerging problems
  const signalDelta = recentChange(history, 'highSeveritySignals', 30);
  if (signalDelta > 0) {
    probability += Math.min(10, signalDelta * 3);
    drivers.push(`High-severity signals increasing (+${signalDelta} over 30d)`);
  }

  return {
    eventType: 'impairment-listing',
    label: 'New Impairment Listing',
    probability: clamp(probability),
    timeframe: '6-12 months',
    confidence: confidenceFromHistory(history.length),
    drivers,
    trendContribution,
  };
}

function predictEnforcementAction(
  current: DailyStateSnapshot,
  trend: TrendResult | null,
  history: DailyStateSnapshot[],
): EventPrediction {
  let probability = 5;
  const drivers: string[] = [];
  let trendContribution = 0;

  if (current.enforcementActions > 0) {
    probability += 20;
    drivers.push(`${current.enforcementActions} active enforcement actions`);
  }
  if (current.violationCount > 5) {
    probability += 15;
    drivers.push(`High violation count (${current.violationCount})`);
  } else if (current.violationCount > 0) {
    probability += 8;
    drivers.push(`${current.violationCount} active violations`);
  }

  // Declining compliance trend
  if (trend?.direction === 'declining') {
    trendContribution = 10;
    probability += trendContribution;
    drivers.push('Compliance trending downward');
  } else if (trend?.direction === 'improving') {
    trendContribution = -8;
    probability += trendContribution;
  }

  return {
    eventType: 'enforcement-action',
    label: 'Enforcement Action',
    probability: clamp(probability),
    timeframe: '6 months',
    confidence: confidenceFromHistory(history.length),
    drivers,
    trendContribution,
  };
}

function predictExceedanceEvent(
  current: DailyStateSnapshot,
  trend: TrendResult | null,
  history: DailyStateSnapshot[],
): EventPrediction {
  let probability = 5;
  const drivers: string[] = [];
  let trendContribution = 0;

  if (current.highSeveritySignals > 0) {
    probability += 20;
    drivers.push(`${current.highSeveritySignals} high-severity signals`);
  }

  // Rising signal frequency
  if (trend?.direction === 'declining') {
    trendContribution = 15;
    probability += trendContribution;
    drivers.push('Signal frequency trending upward');
  } else if (trend?.direction === 'improving') {
    trendContribution = -10;
    probability += trendContribution;
  }

  // 3+ high-severity in last 30 days
  const recent30 = history.slice(-30);
  const maxHighSev = recent30.reduce((m, s) => Math.max(m, s.highSeveritySignals), 0);
  if (maxHighSev >= 3) {
    probability += 15;
    drivers.push(`Peak of ${maxHighSev} high-severity signals in 30d window`);
  }

  return {
    eventType: 'exceedance-event',
    label: 'Parameter Exceedance',
    probability: clamp(probability),
    timeframe: '60 days',
    confidence: confidenceFromHistory(history.length),
    drivers,
    trendContribution,
  };
}

function predictAdvisoryIssuance(
  current: DailyStateSnapshot,
  trend: TrendResult | null,
  history: DailyStateSnapshot[],
): EventPrediction {
  let probability = 5;
  const drivers: string[] = [];
  let trendContribution = 0;

  if (current.signalCount > 10) {
    probability += 15;
    drivers.push(`High signal count (${current.signalCount})`);
  }
  if (current.highSeveritySignals > 2) {
    probability += 20;
    drivers.push(`${current.highSeveritySignals} high-severity signals`);
  }

  if (trend?.direction === 'declining') {
    trendContribution = 10;
    probability += trendContribution;
    drivers.push('Conditions trending downward');
  } else if (trend?.direction === 'improving') {
    trendContribution = -10;
    probability += trendContribution;
  }

  return {
    eventType: 'advisory-issuance',
    label: 'Public Advisory',
    probability: clamp(probability),
    timeframe: '90 days',
    confidence: confidenceFromHistory(history.length),
    drivers,
    trendContribution,
  };
}

function predictInfrastructureFailure(
  current: DailyStateSnapshot,
  trend: TrendResult | null,
  history: DailyStateSnapshot[],
): EventPrediction {
  let probability = 3;
  const drivers: string[] = [];
  let trendContribution = 0;

  if (current.riskScore > 60) {
    probability += 25;
    drivers.push(`High risk score (${current.riskScore.toFixed(1)})`);
  } else if (current.riskScore > 40) {
    probability += 12;
    drivers.push(`Elevated risk score (${current.riskScore.toFixed(1)})`);
  }

  if (trend?.direction === 'declining') {
    trendContribution = 15;
    probability += trendContribution;
    drivers.push('Risk score trending upward');
  } else if (trend?.direction === 'improving') {
    trendContribution = -10;
    probability += trendContribution;
  }

  if (current.gwTrendFalling > 10) {
    probability += 10;
    drivers.push(`${current.gwTrendFalling} groundwater sites with falling levels`);
  }

  return {
    eventType: 'infrastructure-failure',
    label: 'Infrastructure Failure',
    probability: clamp(probability),
    timeframe: '12 months',
    confidence: confidenceFromHistory(history.length),
    drivers,
    trendContribution,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Predict all 6 event types for a state.
 *
 * @param current - Latest daily snapshot
 * @param trend - Risk score trend from trendAnalysis (null if insufficient data)
 * @param signalHistory - Last 90 days of snapshots for pattern detection
 */
export function predictEvents(
  current: DailyStateSnapshot,
  trend: TrendResult | null,
  signalHistory: DailyStateSnapshot[],
): EventPrediction[] {
  return [
    predictViolation90d(current, trend, signalHistory),
    predictImpairmentListing(current, trend, signalHistory),
    predictEnforcementAction(current, trend, signalHistory),
    predictExceedanceEvent(current, trend, signalHistory),
    predictAdvisoryIssuance(current, trend, signalHistory),
    predictInfrastructureFailure(current, trend, signalHistory),
  ].sort((a, b) => b.probability - a.probability);
}
