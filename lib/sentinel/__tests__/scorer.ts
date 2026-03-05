/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Validation Scorer                                  */
/*  Pure scoring functions: precision, recall, F1, latency.           */
/*  No I/O — all data passed in.                                      */
/* ------------------------------------------------------------------ */

import type {
  AttackClassificationType,
  ScoredHuc,
  CoordinatedEvent,
  AttackClassification,
} from '../types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ScenarioResult {
  scenarioName: string;
  description: string;
  eventsGenerated: number;
  eventsEnqueued: number;
  scoredHucs: ScoredHuc[];
  coordinatedEvents: CoordinatedEvent[];
  classification: AttackClassification | null;
  detectionLatencyMs: number;
  expectedClassification: string;
  expectedCoordinationRange: [number, number];
}

export interface ScenarioScore {
  scenarioName: string;
  description: string;
  passed: boolean;
  classificationMatch: boolean;
  coordinationInRange: boolean;
  actualClassification: AttackClassificationType | 'none';
  expectedClassification: string;
  actualCoordination: number;
  expectedCoordinationRange: [number, number];
  threatScore: number;
  detectionLatencyMs: number;
  eventsGenerated: number;
  hucsScored: number;
  reasoning: string[];
}

export interface AggregateScore {
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  meanLatencyMs: number;
  totalScenarios: number;
  passed: number;
  failed: number;
}

export interface ScoreReport {
  generatedAt: string;
  scenarios: ScenarioScore[];
  aggregate: AggregateScore;
}

/* ------------------------------------------------------------------ */
/*  Positive / Negative Definitions                                   */
/*  "Positive" = scenario expects likely_attack or possible_attack    */
/* ------------------------------------------------------------------ */

const POSITIVE_CLASSES = new Set<string>(['likely_attack', 'possible_attack']);

function isPositive(classification: string): boolean {
  return POSITIVE_CLASSES.has(classification);
}

/* ------------------------------------------------------------------ */
/*  Per-Scenario Scoring                                              */
/* ------------------------------------------------------------------ */

export function scoreScenario(result: ScenarioResult): ScenarioScore {
  const actual = result.classification?.classification ?? 'none';
  const classificationMatch = actual === result.expectedClassification;

  // Coordination score: pick the highest from any coordinated event, or 0
  const actualCoordination = result.coordinatedEvents.length > 0
    ? Math.max(...result.coordinatedEvents.map(c => c.coordinationScore))
    : 0;

  const [lo, hi] = result.expectedCoordinationRange;
  const coordinationInRange = actualCoordination >= lo && actualCoordination <= hi;

  const passed = classificationMatch && coordinationInRange;

  const reasoning: string[] = [];
  if (!classificationMatch) {
    reasoning.push(`Classification mismatch: expected "${result.expectedClassification}", got "${actual}"`);
  }
  if (!coordinationInRange) {
    reasoning.push(`Coordination ${actualCoordination.toFixed(3)} outside expected range [${lo}, ${hi}]`);
  }
  if (result.classification) {
    for (const r of result.classification.reasoning) {
      reasoning.push(`[${r.effect}] ${r.rule}: ${r.detail}`);
    }
  }

  return {
    scenarioName: result.scenarioName,
    description: result.description,
    passed,
    classificationMatch,
    coordinationInRange,
    actualClassification: actual,
    expectedClassification: result.expectedClassification,
    actualCoordination,
    expectedCoordinationRange: result.expectedCoordinationRange,
    threatScore: result.classification?.threatScore ?? 0,
    detectionLatencyMs: result.detectionLatencyMs,
    eventsGenerated: result.eventsGenerated,
    hucsScored: result.scoredHucs.length,
    reasoning,
  };
}

/* ------------------------------------------------------------------ */
/*  Aggregate Scoring                                                 */
/* ------------------------------------------------------------------ */

export function aggregateScores(scores: ScenarioScore[]): AggregateScore {
  let tp = 0;   // true positive: expected positive, predicted positive
  let fp = 0;   // false positive: expected negative, predicted positive
  let fn = 0;   // false negative: expected positive, predicted negative
  let tn = 0;   // true negative: expected negative, predicted negative

  for (const s of scores) {
    const expectedPos = isPositive(s.expectedClassification);
    const predictedPos = isPositive(s.actualClassification);

    if (expectedPos && predictedPos) tp++;
    else if (!expectedPos && predictedPos) fp++;
    else if (expectedPos && !predictedPos) fn++;
    else tn++;
  }

  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 1;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 1;
  const f1 = (precision + recall) > 0
    ? 2 * (precision * recall) / (precision + recall)
    : 0;
  const accuracy = scores.length > 0
    ? (tp + tn) / scores.length
    : 0;

  const meanLatencyMs = scores.length > 0
    ? scores.reduce((sum, s) => sum + s.detectionLatencyMs, 0) / scores.length
    : 0;

  return {
    precision: round(precision),
    recall: round(recall),
    f1: round(f1),
    accuracy: round(accuracy),
    meanLatencyMs: Math.round(meanLatencyMs),
    totalScenarios: scores.length,
    passed: scores.filter(s => s.passed).length,
    failed: scores.filter(s => !s.passed).length,
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
