/**
 * Comprehensive Assessment — orchestrator that ties trend analysis,
 * scenario modeling, and event prediction into a unified output.
 *
 * Pure orchestration: no cache reads/writes. The cron route handles
 * data retrieval and persistence.
 */

import type {
  DailyStateSnapshot,
  TimeSeriesPoint,
  ComprehensiveAssessment,
} from './types';
import { computeTrend } from './trendAnalysis';
import { runAllScenarios } from './scenarioModeler';
import { predictEvents } from './eventPredictor';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a time series for a specific metric from snapshots. */
function toTimeSeries(
  snapshots: DailyStateSnapshot[],
  metric: keyof DailyStateSnapshot,
): TimeSeriesPoint[] {
  return snapshots
    .filter(s => typeof s[metric] === 'number')
    .map(s => ({ date: s.date, value: s[metric] as number }));
}

/** Calculate data completeness (0-100) based on non-zero fields. */
function dataCompleteness(snapshot: DailyStateSnapshot): number {
  const fields: (keyof DailyStateSnapshot)[] = [
    'riskScore', 'impairmentPct', 'violationCount', 'signalCount',
    'highSeveritySignals', 'impairedWaterbodies', 'totalAssessed',
    'enforcementActions', 'pfasDetections', 'aiReadinessScore', 'gwTrendFalling',
  ];
  let filled = 0;
  for (const f of fields) {
    const val = snapshot[f];
    if (typeof val === 'number' && val > 0) filled++;
  }
  return Math.round((filled / fields.length) * 100);
}

/** Map score to risk level. */
function riskLevel(score: number): 'green' | 'amber' | 'red' {
  if (score < 35) return 'green';
  if (score < 65) return 'amber';
  return 'red';
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a comprehensive assessment for one state.
 *
 * @param stateCode - 2-letter state abbreviation
 * @param snapshots - Historical daily snapshots (oldest first)
 */
export function buildAssessment(
  stateCode: string,
  snapshots: DailyStateSnapshot[],
): ComprehensiveAssessment {
  if (snapshots.length === 0) {
    return {
      stateCode,
      generatedAt: new Date().toISOString(),
      currentRiskScore: 0,
      currentRiskLevel: 'green',
      trends: {
        riskScore: null,
        impairmentPct: null,
        violationCount: null,
        signalFrequency: null,
      },
      scenarios: [],
      predictions: [],
      dataCompleteness: 0,
      historicalDays: 0,
    };
  }

  // Latest snapshot = current state
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted[sorted.length - 1];

  // 1. Trend analysis for key metrics
  const riskScoreTrend = computeTrend(toTimeSeries(sorted, 'riskScore'));
  const impairmentPctTrend = computeTrend(toTimeSeries(sorted, 'impairmentPct'));
  const violationCountTrend = computeTrend(toTimeSeries(sorted, 'violationCount'));
  const signalFrequencyTrend = computeTrend(toTimeSeries(sorted, 'signalCount'));

  // 2. Scenario modeling (works from day 1, no history needed)
  const scenarios = runAllScenarios(current);

  // 3. Event prediction (uses trend + last 90 days of history)
  const last90 = sorted.slice(-90);
  const predictions = predictEvents(current, riskScoreTrend, last90);

  return {
    stateCode,
    generatedAt: new Date().toISOString(),
    currentRiskScore: current.riskScore,
    currentRiskLevel: riskLevel(current.riskScore),
    trends: {
      riskScore: riskScoreTrend,
      impairmentPct: impairmentPctTrend,
      violationCount: violationCountTrend,
      signalFrequency: signalFrequencyTrend,
    },
    scenarios,
    predictions,
    dataCompleteness: dataCompleteness(current),
    historicalDays: sorted.length,
  };
}

/**
 * Build assessments for all states at once.
 *
 * @param allSnapshots - Record of state code → snapshot array
 * @returns Record of state code → ComprehensiveAssessment
 */
export function buildAllAssessments(
  allSnapshots: Record<string, DailyStateSnapshot[]>,
): Record<string, ComprehensiveAssessment> {
  const result: Record<string, ComprehensiveAssessment> = {};
  for (const [state, snapshots] of Object.entries(allSnapshots)) {
    result[state] = buildAssessment(state, snapshots);
  }
  return result;
}
