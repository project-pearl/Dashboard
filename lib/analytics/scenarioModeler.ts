/**
 * Scenario Modeler — "What If" engine for macro-level scenario analysis.
 *
 * Takes current state metrics + a scenario definition, applies perturbations,
 * and re-scores to show impact. Complements trajectoryEngine (which handles
 * micro BMP interventions) — this handles macro scenarios like drought,
 * regulation changes, or infrastructure investment.
 *
 * Pure functions, no side effects, no cache dependencies.
 */

import type {
  DailyStateSnapshot,
  ScenarioDefinition,
  ScenarioId,
  ScenarioResult,
  ScenarioSnapshot,
  Perturbation,
} from './types';

// ── Scenario Catalog ─────────────────────────────────────────────────────────

export const SCENARIO_CATALOG: ScenarioDefinition[] = [
  {
    id: 'drought',
    label: 'Extended Drought',
    description: 'Prolonged drought conditions stress water supplies and quality',
    perturbations: [
      { target: 'impairmentPct', operation: 'multiply', value: 1.3 },
      { target: 'signalCount', operation: 'multiply', value: 1.5 },
      { target: 'gwTrendFalling', operation: 'multiply', value: 2.0 },
    ],
  },
  {
    id: 'plant-offline',
    label: 'Major Plant Offline',
    description: 'A major water treatment plant goes offline unexpectedly',
    perturbations: [
      { target: 'violationCount', operation: 'add', value: 10 },
      { target: 'riskScore', operation: 'multiply', value: 1.2 },
    ],
  },
  {
    id: 'new-regulation',
    label: 'Stricter Regulations',
    description: 'EPA tightens compliance standards and enforcement thresholds',
    perturbations: [
      { target: 'violationCount', operation: 'multiply', value: 1.4 },
      { target: 'enforcementActions', operation: 'multiply', value: 1.5 },
    ],
  },
  {
    id: 'funding-increase',
    label: 'Infrastructure Investment',
    description: '$10M+ investment in water infrastructure and monitoring',
    perturbations: [
      { target: 'riskScore', operation: 'multiply', value: 0.85 },
      { target: 'aiReadinessScore', operation: 'multiply', value: 1.15 },
    ],
  },
  {
    id: 'contamination-event',
    label: 'Contamination Event',
    description: 'Industrial spill or chemical release into waterways',
    perturbations: [
      { target: 'pfasDetections', operation: 'add', value: 5 },
      { target: 'highSeveritySignals', operation: 'add', value: 3 },
      { target: 'riskScore', operation: 'multiply', value: 1.25 },
    ],
  },
  {
    id: 'population-growth',
    label: 'Population Growth',
    description: '10% population increase strains existing water infrastructure',
    perturbations: [
      { target: 'riskScore', operation: 'multiply', value: 1.1 },
      { target: 'violationCount', operation: 'multiply', value: 1.15 },
    ],
  },
  {
    id: 'climate-stress',
    label: 'Climate Stress',
    description: 'Warming temperatures and extreme weather patterns',
    perturbations: [
      { target: 'impairmentPct', operation: 'multiply', value: 1.2 },
      { target: 'gwTrendFalling', operation: 'multiply', value: 1.5 },
      { target: 'signalCount', operation: 'multiply', value: 1.3 },
    ],
  },
];

// ── Scoring ──────────────────────────────────────────────────────────────────

/** Metric weights for aggregate risk scoring (simplified from waterRiskScore). */
const CATEGORY_WEIGHTS: Record<string, { metrics: string[]; weight: number }> = {
  waterQuality: {
    metrics: ['impairmentPct', 'impairedWaterbodies'],
    weight: 0.30,
  },
  compliance: {
    metrics: ['violationCount', 'enforcementActions'],
    weight: 0.25,
  },
  contamination: {
    metrics: ['pfasDetections', 'highSeveritySignals'],
    weight: 0.20,
  },
  infrastructure: {
    metrics: ['riskScore', 'gwTrendFalling'],
    weight: 0.15,
  },
  monitoring: {
    metrics: ['signalCount', 'aiReadinessScore'],
    weight: 0.10,
  },
};

/**
 * Compute category scores from snapshot metrics.
 * Each category is 0-100. Higher = worse risk (except aiReadinessScore where higher = better).
 */
function computeCategoryScores(snapshot: DailyStateSnapshot): Record<string, number> {
  const scores: Record<string, number> = {};

  // Water Quality: impairment percentage is already 0-100
  scores.waterQuality = Math.min(100, snapshot.impairmentPct);

  // Compliance: violations + enforcement → 0-100 scale
  scores.compliance = Math.min(100, (snapshot.violationCount * 2) + (snapshot.enforcementActions * 5));

  // Contamination: PFAS + high-severity signals → 0-100
  scores.contamination = Math.min(100, (snapshot.pfasDetections * 8) + (snapshot.highSeveritySignals * 10));

  // Infrastructure: riskScore is already 0-100, blend with groundwater
  scores.infrastructure = Math.min(100, snapshot.riskScore * 0.7 + snapshot.gwTrendFalling * 3);

  // Monitoring: inverse of readiness (higher readiness = lower risk)
  scores.monitoring = Math.max(0, 100 - snapshot.aiReadinessScore);

  return scores;
}

/** Derive aggregate risk score from category scores. */
function aggregateRiskScore(categoryScores: Record<string, number>): number {
  let total = 0;
  for (const [cat, config] of Object.entries(CATEGORY_WEIGHTS)) {
    total += (categoryScores[cat] ?? 0) * config.weight;
  }
  return Math.round(Math.min(100, Math.max(0, total)) * 10) / 10;
}

/** Map score to risk level. */
function riskLevel(score: number): 'green' | 'amber' | 'red' {
  if (score < 35) return 'green';
  if (score < 65) return 'amber';
  return 'red';
}

/** Build a ScenarioSnapshot from metrics. */
function buildSnapshot(metrics: DailyStateSnapshot): ScenarioSnapshot {
  const categoryScores = computeCategoryScores(metrics);
  const score = aggregateRiskScore(categoryScores);
  return {
    riskScore: score,
    riskLevel: riskLevel(score),
    categoryScores,
  };
}

// ── Perturbation Application ─────────────────────────────────────────────────

/** Apply perturbations to a snapshot copy. */
function applyPerturbations(
  base: DailyStateSnapshot,
  perturbations: Perturbation[],
): DailyStateSnapshot {
  const perturbed = { ...base };

  for (const p of perturbations) {
    const key = p.target as keyof DailyStateSnapshot;
    if (key === 'date') continue; // never modify date
    const current = perturbed[key] as number;
    if (typeof current !== 'number') continue;

    let newVal: number;
    switch (p.operation) {
      case 'multiply':
        newVal = current * p.value;
        break;
      case 'add':
        newVal = current + p.value;
        break;
      case 'set':
        newVal = p.value;
        break;
    }
    (perturbed as Record<string, unknown>)[key] = Math.max(0, Math.round(newVal * 100) / 100);
  }

  return perturbed;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a single scenario against current state metrics.
 */
export function runScenario(
  currentMetrics: DailyStateSnapshot,
  scenario: ScenarioDefinition,
): ScenarioResult {
  const baseline = buildSnapshot(currentMetrics);
  const perturbed = applyPerturbations(currentMetrics, scenario.perturbations);
  const projected = buildSnapshot(perturbed);

  const delta = projected.riskScore - baseline.riskScore;

  // Find worst-affected category
  let worstCat = '';
  let worstDelta = 0;
  for (const cat of Object.keys(projected.categoryScores)) {
    const catDelta = (projected.categoryScores[cat] ?? 0) - (baseline.categoryScores[cat] ?? 0);
    if (Math.abs(catDelta) > Math.abs(worstDelta)) {
      worstDelta = catDelta;
      worstCat = cat;
    }
  }

  const direction = delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'no change in';
  const impactSummary =
    `${scenario.label} would ${direction} overall risk by ${Math.abs(delta).toFixed(1)} points` +
    (worstCat ? `, with ${worstCat} most affected (${worstDelta > 0 ? '+' : ''}${worstDelta.toFixed(1)})` : '');

  // Confidence based on number of perturbations (more = less certain)
  const confidence: ScenarioResult['confidence'] =
    scenario.perturbations.length <= 2 ? 'HIGH' :
    scenario.perturbations.length <= 4 ? 'MODERATE' : 'LOW';

  return {
    scenarioId: scenario.id,
    label: scenario.label,
    baseline,
    projected,
    delta: {
      riskScoreChange: Math.round(delta * 10) / 10,
      worstCategory: worstCat,
      impactSummary,
    },
    timeframe: '6-12 months',
    confidence,
  };
}

/**
 * Run all 7 standard scenarios for a state.
 */
export function runAllScenarios(
  currentMetrics: DailyStateSnapshot,
): ScenarioResult[] {
  return SCENARIO_CATALOG.map(scenario => runScenario(currentMetrics, scenario));
}
