// lib/budgetPlannerEngine.ts
// Priority-weighted budget allocation engine for restoration planning
// Scores all 9 interventions across 5 axes, applies upstream/downstream multipliers,
// then allocates budget proportionally to weighted composite scores.
// Pure functions — zero React, zero side effects

import { INTERVENTION_LIBRARY, type InterventionType, type ConfidenceRange, type PollutantId } from './interventionLibrary';
import { getEJScore } from './ejVulnerability';

// ─── Types ──────────────────────────────────────────────────────────────────

export type PriorityAxis =
  | 'ecological'
  | 'economic'
  | 'environmentalJustice'
  | 'regulatoryCompliance'
  | 'climateResilience';

export type StreamPosition = 'upstream' | 'downstream' | 'neutral';

export interface BudgetPlannerInputs {
  totalBudget: number;
  weights: Record<PriorityAxis, number>; // each 0-100, should sum to 100
  stateAbbr: string;
}

export interface ScoredIntervention {
  intervention: InterventionType;
  position: StreamPosition;
  positionMultiplier: number;
  axisScores: Record<PriorityAxis, number>; // each 0-1
  compositeScore: number;
  normalizedScore: number; // fraction of total (sums to 1 across all)
  allocatedBudget: number;
  estimatedUnits: number;
}

export interface BudgetPlannerSummary {
  totalAllocated: number;
  ecologicalImpact: number;   // 0-100
  estimatedJobs: number;
  ejScore: number;             // 0-100
  regulatoryScore: number;     // 0-100
  climateScore: number;        // 0-100
  combinedRemovalRates: Record<PollutantId, ConfidenceRange>;
}

export interface BudgetPlannerResult {
  allocations: ScoredIntervention[];
  summary: BudgetPlannerSummary;
  inputs: BudgetPlannerInputs;
}

// ─── Stream Position Classification ─────────────────────────────────────────

const STREAM_POSITIONS: Record<string, StreamPosition> = {
  'riparian-buffer':     'upstream',
  'constructed-wetland': 'upstream',
  'stormwater-bmp':      'upstream',
  'pearl-alia':          'downstream',
  'sediment-mgmt':       'downstream',
  'oyster-reef':         'downstream',
  'sav-restoration':     'downstream',
  'nutrient-trading':    'neutral',
  'emerging-tech':       'neutral',
};

const POSITION_MULTIPLIERS: Record<StreamPosition, number> = {
  upstream:   1.3,
  downstream: 0.8,
  neutral:    1.0,
};

// ─── Climate Score Category Lookup ──────────────────────────────────────────

const CLIMATE_CATEGORY_BASE: Record<string, number> = {
  'nature-based':  0.9,
  'infrastructure': 0.5,
  'treatment':     0.4,
  'market':        0.3,
  'emerging':      0.35,
  'management':    0.55,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function addRange(a: ConfidenceRange, b: ConfidenceRange): ConfidenceRange {
  return { min: a.min + b.min, expected: a.expected + b.expected, max: a.max + b.max };
}

function scaleRange(r: ConfidenceRange, qty: number): ConfidenceRange {
  return { min: r.min * qty, expected: r.expected * qty, max: r.max * qty };
}

const ZERO_RANGE: ConfidenceRange = { min: 0, expected: 0, max: 0 };

// ─── Scoring Functions (each returns 0–1) ───────────────────────────────────

/** Ecological: avg of non-null removal rate expected values × position multiplier */
function scoreEcological(intervention: InterventionType, posMult: number): number {
  const rates = Object.values(intervention.removalRates).filter(
    (r): r is ConfidenceRange => r !== null,
  );
  if (rates.length === 0) return 0;
  const avg = rates.reduce((sum, r) => sum + r.expected, 0) / rates.length;
  return Math.min(1, avg * posMult);
}

/** Economic: higher capital cost → more jobs; normalized by max across library */
const MAX_CAPITAL = Math.max(
  ...INTERVENTION_LIBRARY.map(i => i.cost.capitalPerUnit.expected),
);

function scoreEconomic(intervention: InterventionType): number {
  return intervention.cost.capitalPerUnit.expected / MAX_CAPITAL;
}

/** EJ: state-level EJ score + 0.15 bonus for nature-based (community green infra) */
function scoreEJ(intervention: InterventionType, stateAbbr: string): number {
  const base = getEJScore(stateAbbr) / 100;
  const bonus = intervention.category === 'nature-based' ? 0.15 : 0;
  return Math.min(1, base + bonus);
}

/** Regulatory: permit-critical pollutant weighted — TSS×0.4 + bacteria×0.4 + TN×0.1 + TP×0.1 */
function scoreRegulatory(intervention: InterventionType): number {
  const tss = intervention.removalRates.TSS?.expected ?? 0;
  const bac = intervention.removalRates.bacteria?.expected ?? 0;
  const tn  = intervention.removalRates.TN?.expected ?? 0;
  const tp  = intervention.removalRates.TP?.expected ?? 0;
  return tss * 0.4 + bac * 0.4 + tn * 0.1 + tp * 0.1;
}

/** Climate: category base score adjusted by longevity (longer ramp → more durable) */
function scoreClimate(intervention: InterventionType): number {
  const base = CLIMATE_CATEGORY_BASE[intervention.category] ?? 0.4;
  // Longevity bonus: interventions with longer ramp-up tend to be more permanent
  // Scale months-to-full (1-36) into a 0-0.1 bonus
  const longevityBonus = Math.min(0.1, intervention.rampUp.monthsToFullEfficacy / 360);
  return Math.min(1, base + longevityBonus);
}

// ─── Jobs Estimator ─────────────────────────────────────────────────────────
// Rough heuristic: $150k of capital spend ≈ 1 FTE-year of construction/installation work

const DOLLARS_PER_JOB = 150_000;

function estimateJobs(allocations: ScoredIntervention[]): number {
  const totalSpend = allocations.reduce((s, a) => s + a.allocatedBudget, 0);
  return Math.round(totalSpend / DOLLARS_PER_JOB);
}

// ─── Combined Removal Rates ─────────────────────────────────────────────────
// Multiplicative combination: two 50% removals → 75% total

function combinedRemovalRates(
  allocations: ScoredIntervention[],
): Record<PollutantId, ConfidenceRange> {
  const pollutants: PollutantId[] = ['TN', 'TP', 'TSS', 'bacteria', 'DO_improvement'];
  const result: Record<string, ConfidenceRange> = {};

  for (const p of pollutants) {
    let retainedMin = 1;
    let retainedExp = 1;
    let retainedMax = 1;

    for (const a of allocations) {
      if (a.estimatedUnits < 1) continue;
      const rate = a.intervention.removalRates[p];
      if (!rate) continue;
      // Apply each unit multiplicatively
      for (let u = 0; u < a.estimatedUnits; u++) {
        retainedMin *= (1 - rate.min);
        retainedExp *= (1 - rate.expected);
        retainedMax *= (1 - rate.max);
      }
    }

    result[p] = {
      min:      Math.round((1 - retainedMin) * 1000) / 1000,
      expected: Math.round((1 - retainedExp) * 1000) / 1000,
      max:      Math.round((1 - retainedMax) * 1000) / 1000,
    };
  }

  return result as Record<PollutantId, ConfidenceRange>;
}

// ─── Main Allocation Algorithm ──────────────────────────────────────────────

export function allocateBudget(inputs: BudgetPlannerInputs): BudgetPlannerResult {
  const { totalBudget, weights, stateAbbr } = inputs;

  // 1. Score all 9 interventions across 5 axes
  const scored: ScoredIntervention[] = INTERVENTION_LIBRARY.map(intervention => {
    const position = STREAM_POSITIONS[intervention.id] ?? 'neutral';
    const posMult = POSITION_MULTIPLIERS[position];

    const axisScores: Record<PriorityAxis, number> = {
      ecological:           scoreEcological(intervention, posMult),
      economic:             scoreEconomic(intervention),
      environmentalJustice: scoreEJ(intervention, stateAbbr),
      regulatoryCompliance: scoreRegulatory(intervention),
      climateResilience:    scoreClimate(intervention),
    };

    // 2. Weighted composite: sum(axisScore × weight/100)
    let compositeScore = 0;
    for (const axis of Object.keys(axisScores) as PriorityAxis[]) {
      compositeScore += axisScores[axis] * (weights[axis] / 100);
    }

    return {
      intervention,
      position,
      positionMultiplier: posMult,
      axisScores,
      compositeScore,
      normalizedScore: 0, // filled below
      allocatedBudget: 0,
      estimatedUnits: 0,
    };
  });

  // 3. Normalize composites to sum to 1.0
  const totalComposite = scored.reduce((s, a) => s + a.compositeScore, 0);
  if (totalComposite > 0) {
    for (const a of scored) {
      a.normalizedScore = a.compositeScore / totalComposite;
    }
  }

  // 4. Allocate budget proportionally
  for (const a of scored) {
    a.allocatedBudget = Math.round(totalBudget * a.normalizedScore);
  }

  // 5. Compute estimated units
  for (const a of scored) {
    const costPerUnit = a.intervention.cost.capitalPerUnit.expected;
    a.estimatedUnits = costPerUnit > 0 ? Math.floor(a.allocatedBudget / costPerUnit) : 0;
  }

  // 6. Reallocation pass: interventions getting <1 unit redistribute to others
  let redistributed = true;
  while (redistributed) {
    redistributed = false;
    const subUnits = scored.filter(a => a.estimatedUnits < 1 && a.allocatedBudget > 0);
    const hasUnits = scored.filter(a => a.estimatedUnits >= 1);

    if (subUnits.length === 0 || hasUnits.length === 0) break;

    let freed = 0;
    for (const a of subUnits) {
      freed += a.allocatedBudget;
      a.allocatedBudget = 0;
      a.normalizedScore = 0;
      redistributed = true;
    }

    // Redistribute proportionally among those with units
    const totalRemainingScore = hasUnits.reduce((s, a) => s + a.compositeScore, 0);
    if (totalRemainingScore > 0) {
      for (const a of hasUnits) {
        const share = Math.round(freed * (a.compositeScore / totalRemainingScore));
        a.allocatedBudget += share;
        const costPerUnit = a.intervention.cost.capitalPerUnit.expected;
        a.estimatedUnits = costPerUnit > 0 ? Math.floor(a.allocatedBudget / costPerUnit) : 0;
      }
    }
  }

  // Recalc normalized scores after redistribution
  const totalAllocated = scored.reduce((s, a) => s + a.allocatedBudget, 0);
  if (totalAllocated > 0) {
    for (const a of scored) {
      a.normalizedScore = a.allocatedBudget / totalAllocated;
    }
  }

  // Sort by allocated budget descending
  scored.sort((a, b) => b.allocatedBudget - a.allocatedBudget);

  // 7. Build summary
  const activeAllocations = scored.filter(a => a.estimatedUnits >= 1);
  const removal = combinedRemovalRates(activeAllocations);

  // Ecological impact: weighted avg of ecological scores for funded interventions × 100
  const ecoImpact = activeAllocations.length > 0
    ? Math.round(
        activeAllocations.reduce((s, a) => s + a.axisScores.ecological * a.allocatedBudget, 0) /
        activeAllocations.reduce((s, a) => s + a.allocatedBudget, 0) * 100,
      )
    : 0;

  // Regulatory: weighted avg
  const regScore = activeAllocations.length > 0
    ? Math.round(
        activeAllocations.reduce((s, a) => s + a.axisScores.regulatoryCompliance * a.allocatedBudget, 0) /
        activeAllocations.reduce((s, a) => s + a.allocatedBudget, 0) * 100,
      )
    : 0;

  // Climate: weighted avg
  const climScore = activeAllocations.length > 0
    ? Math.round(
        activeAllocations.reduce((s, a) => s + a.axisScores.climateResilience * a.allocatedBudget, 0) /
        activeAllocations.reduce((s, a) => s + a.allocatedBudget, 0) * 100,
      )
    : 0;

  const summary: BudgetPlannerSummary = {
    totalAllocated,
    ecologicalImpact: ecoImpact,
    estimatedJobs:    estimateJobs(activeAllocations),
    ejScore:          getEJScore(stateAbbr),
    regulatoryScore:  regScore,
    climateScore:     climScore,
    combinedRemovalRates: removal,
  };

  return { allocations: scored, summary, inputs };
}
