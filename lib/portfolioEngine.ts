// lib/portfolioEngine.ts
// Constraint-based portfolio optimizer for restoration planning
// Generates 3 ranked portfolios: cheapest, fastest, most resilient
// Pure functions — zero React, zero side effects

import type { ConfidenceRange, InterventionType, PollutantId, WaterbodyCategory } from './interventionLibrary';
import { getInterventionsForWaterbody } from './interventionLibrary';
import type { WaterQualityGrade } from './waterQualityScore';
import type { RestorationResult } from './restorationEngine';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TargetOutcome = 'healthy' | 'swimmable' | 'fishable' | 'shellfish_safe';
export type TimelineCommitment = '1yr' | '5yr' | '10yr' | '25yr';

export interface PlannerConstraints {
  target: TargetOutcome;
  timeline: TimelineCommitment;
  budgetMin: number;
  budgetMax: number;
  landAvailable: boolean;
  permittingFeasible: boolean;
  politicalSupport: boolean;
}

export interface PortfolioAllocation {
  interventionId: string;
  interventionName: string;
  quantity: number;
  unitLabel: string;
  capitalCost: ConfidenceRange;
  annualOM: ConfidenceRange;
  monthsToFull: number;
  phase: number;
}

export interface Portfolio {
  strategy: 'cheapest' | 'fastest' | 'resilient';
  label: string;
  description: string;
  allocations: PortfolioAllocation[];
  phases: PortfolioPhase[];
  totalCapital: ConfidenceRange;
  totalAnnualOM: ConfidenceRange;
  projectedScore: number;
  monthsToTarget: number;
  residualGaps: Partial<Record<PollutantId, number>>;
  interventionTypeCount: number;
}

export interface PortfolioPhase {
  phase: number;
  label: string;
  monthStart: number;
  monthEnd: number;
  allocations: PortfolioAllocation[];
  phaseCost: ConfidenceRange;
}

export interface PortfolioResult {
  portfolios: Portfolio[];
  pollutantGaps: Record<PollutantId, number>;
  targetThresholds: Partial<Record<PollutantId, number>>;
  baselineValues: Partial<Record<PollutantId, number>>;
  waterbodyType: WaterbodyCategory;
}

// ─── Target Outcome → Parameter Thresholds ──────────────────────────────────

const TARGET_THRESHOLDS: Record<TargetOutcome, Partial<Record<PollutantId, number>>> = {
  healthy:        { TN: 0.5, TP: 0.03, TSS: 15, bacteria: 50 },
  swimmable:      { TN: 1.0, TP: 0.1,  TSS: 25, bacteria: 126 },
  fishable:       { TN: 1.5, TP: 0.2,  TSS: 30, bacteria: 235 },
  shellfish_safe: { TN: 0.5, TP: 0.05, TSS: 12, bacteria: 14 },
};

// ─── Timeline → max months ─────────────────────────────────────────────────

const TIMELINE_MONTHS: Record<TimelineCommitment, number> = {
  '1yr': 12,
  '5yr': 60,
  '10yr': 120,
  '25yr': 300,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function addRange(a: ConfidenceRange, b: ConfidenceRange): ConfidenceRange {
  return { min: a.min + b.min, expected: a.expected + b.expected, max: a.max + b.max };
}

function scaleRange(r: ConfidenceRange, qty: number): ConfidenceRange {
  return { min: r.min * qty, expected: r.expected * qty, max: r.max * qty };
}

const ZERO_RANGE: ConfidenceRange = { min: 0, expected: 0, max: 0 };

/** Map waterType from restorationEngine to WaterbodyCategory */
function toWaterbodyCategory(waterType: 'brackish' | 'freshwater'): WaterbodyCategory {
  return waterType === 'brackish' ? 'estuary' : 'freshwater';
}

/** Extract current parameter values from WaterDataResult-style params */
function extractBaseline(
  waterParams: Record<string, { value: number }> | null,
): Partial<Record<PollutantId, number>> {
  if (!waterParams) return {};
  const result: Partial<Record<PollutantId, number>> = {};
  if (waterParams.TN) result.TN = waterParams.TN.value;
  if (waterParams.TP) result.TP = waterParams.TP.value;
  if (waterParams.TSS) result.TSS = waterParams.TSS.value;
  if (waterParams.bacteria) result.bacteria = waterParams.bacteria.value;
  return result;
}

/** Calculate % reduction needed per pollutant */
function calcGaps(
  baseline: Partial<Record<PollutantId, number>>,
  thresholds: Partial<Record<PollutantId, number>>,
): Record<PollutantId, number> {
  const gaps: Record<PollutantId, number> = {
    TN: 0, TP: 0, TSS: 0, bacteria: 0, DO_improvement: 0,
  };
  for (const p of Object.keys(thresholds) as PollutantId[]) {
    const current = baseline[p];
    const target = thresholds[p];
    if (current === undefined || target === undefined) continue;
    if (current <= target) continue;
    // Fractional reduction needed: e.g. 2.0 → 0.5 = 75% reduction
    gaps[p] = 1 - (target / current);
  }
  return gaps;
}

/** Filter interventions by user constraints */
function filterInterventions(
  interventions: InterventionType[],
  constraints: PlannerConstraints,
): InterventionType[] {
  return interventions.filter(i => {
    if (i.requiresLand && !constraints.landAvailable) return false;
    if (i.requiresPermitting && !constraints.permittingFeasible) return false;
    // Emerging tech requires political support
    if (i.category === 'emerging' && !constraints.politicalSupport) return false;
    return true;
  });
}

/** Combine removal rates multiplicatively: two 50% removals → 75% */
function combineRemovals(removals: number[]): number {
  let retained = 1;
  for (const r of removals) {
    retained *= (1 - r);
  }
  return 1 - retained;
}

/** Score an intervention for $/% removal efficiency */
function costEfficiency(intervention: InterventionType, gaps: Record<PollutantId, number>): number {
  const cost = intervention.cost.capitalPerUnit.expected;
  let totalRemoval = 0;
  let count = 0;
  for (const [p, gap] of Object.entries(gaps) as [PollutantId, number][]) {
    if (gap <= 0) continue;
    const rate = intervention.removalRates[p];
    if (!rate) continue;
    totalRemoval += rate.expected;
    count++;
  }
  if (count === 0 || totalRemoval === 0) return Infinity;
  return cost / totalRemoval;
}

/** Score an intervention for speed */
function speedScore(intervention: InterventionType): number {
  return intervention.rampUp.monthsToFullEfficacy;
}

// ─── Greedy Portfolio Builder ───────────────────────────────────────────────

interface GreedyConfig {
  strategy: 'cheapest' | 'fastest' | 'resilient';
  label: string;
  description: string;
  sortFn: (a: InterventionType, b: InterventionType, gaps: Record<PollutantId, number>) => number;
  diversityBonus: boolean;
}

function buildPortfolio(
  available: InterventionType[],
  gaps: Record<PollutantId, number>,
  constraints: PlannerConstraints,
  baselineScore: number,
  config: GreedyConfig,
): Portfolio {
  const maxMonths = TIMELINE_MONTHS[constraints.timeline];
  const budget = constraints.budgetMax;

  // Sort interventions by strategy
  const sorted = [...available].sort((a, b) => config.sortFn(a, b, gaps));

  const allocations: PortfolioAllocation[] = [];
  const usedTypes = new Set<string>();
  let totalCapital = { ...ZERO_RANGE };
  let totalOM = { ...ZERO_RANGE };
  const currentRemovals: Record<PollutantId, number[]> = {
    TN: [], TP: [], TSS: [], bacteria: [], DO_improvement: [],
  };

  for (const intervention of sorted) {
    // Check budget
    const unitCost = intervention.cost.capitalPerUnit.expected;
    if (totalCapital.expected + unitCost > budget) continue;

    // Check timeline
    if (intervention.rampUp.monthsToFullEfficacy > maxMonths) continue;

    // Diversity penalty for resilient strategy
    if (config.diversityBonus && usedTypes.has(intervention.category)) {
      // Still allow if there are gaps and we have < 3 types
      if (usedTypes.size >= 3) continue;
    }

    // Check if this intervention helps with any remaining gap
    let helps = false;
    for (const [p, gap] of Object.entries(gaps) as [PollutantId, number][]) {
      if (gap <= 0) continue;
      const rate = intervention.removalRates[p];
      if (!rate || rate.expected <= 0) continue;
      const currentCombined = combineRemovals(currentRemovals[p]);
      if (currentCombined < gap) {
        helps = true;
        break;
      }
    }
    if (!helps) continue;

    // Add 1 unit
    const qty = 1;
    const capCost = scaleRange(intervention.cost.capitalPerUnit, qty);
    const omCost = scaleRange(intervention.cost.annualOMPerUnit, qty);

    allocations.push({
      interventionId: intervention.id,
      interventionName: intervention.name,
      quantity: qty,
      unitLabel: intervention.cost.unitLabel,
      capitalCost: capCost,
      annualOM: omCost,
      monthsToFull: intervention.rampUp.monthsToFullEfficacy,
      phase: 0, // assigned below
    });

    totalCapital = addRange(totalCapital, capCost);
    totalOM = addRange(totalOM, omCost);
    usedTypes.add(intervention.category);

    // Track removals
    for (const p of Object.keys(currentRemovals) as PollutantId[]) {
      const rate = intervention.removalRates[p];
      if (rate) currentRemovals[p].push(rate.expected);
    }

    // Check if all gaps filled
    let allFilled = true;
    for (const [p, gap] of Object.entries(gaps) as [PollutantId, number][]) {
      if (gap <= 0) continue;
      if (combineRemovals(currentRemovals[p]) < gap) {
        allFilled = false;
        break;
      }
    }
    if (allFilled) break;
  }

  // Assign phases based on ramp-up
  const sortedByRamp = [...allocations].sort((a, b) => a.monthsToFull - b.monthsToFull);
  let phaseNum = 1;
  for (const alloc of sortedByRamp) {
    if (alloc.monthsToFull <= 6) alloc.phase = 1;
    else if (alloc.monthsToFull <= 18) alloc.phase = 2;
    else alloc.phase = 3;
  }

  // Build phases
  const phaseMap = new Map<number, PortfolioAllocation[]>();
  for (const alloc of allocations) {
    const list = phaseMap.get(alloc.phase) || [];
    list.push(alloc);
    phaseMap.set(alloc.phase, list);
  }

  const phases: PortfolioPhase[] = [];
  const PHASE_RANGES: Record<number, { label: string; start: number; end: number }> = {
    1: { label: 'Phase 1: Immediate (0-6 mo)', start: 0, end: 6 },
    2: { label: 'Phase 2: Medium-term (6-18 mo)', start: 6, end: 18 },
    3: { label: 'Phase 3: Long-term (18-36 mo)', start: 18, end: 36 },
  };

  for (const [p, allocs] of phaseMap) {
    const range = PHASE_RANGES[p] || { label: `Phase ${p}`, start: 0, end: 12 };
    let phaseCost = { ...ZERO_RANGE };
    for (const a of allocs) phaseCost = addRange(phaseCost, a.capitalCost);
    phases.push({
      phase: p,
      label: range.label,
      monthStart: range.start,
      monthEnd: range.end,
      allocations: allocs,
      phaseCost,
    });
  }
  phases.sort((a, b) => a.phase - b.phase);

  // Compute residual gaps
  const residualGaps: Partial<Record<PollutantId, number>> = {};
  for (const [p, gap] of Object.entries(gaps) as [PollutantId, number][]) {
    if (gap <= 0) continue;
    const achieved = combineRemovals(currentRemovals[p]);
    const remaining = gap - achieved;
    if (remaining > 0.01) residualGaps[p] = remaining;
  }

  // Estimate projected score improvement
  const gapPollutants = Object.entries(gaps).filter(([, g]) => g > 0);
  let avgFill = 0;
  if (gapPollutants.length > 0) {
    for (const [p] of gapPollutants as [PollutantId, number][]) {
      const achieved = combineRemovals(currentRemovals[p]);
      const gap = gaps[p];
      avgFill += gap > 0 ? Math.min(1, achieved / gap) : 1;
    }
    avgFill /= gapPollutants.length;
  } else {
    avgFill = 1;
  }

  const maxImprovement = 100 - baselineScore;
  const projectedScore = Math.round(baselineScore + maxImprovement * avgFill * 0.8);

  // Months to target = longest ramp-up of any allocation
  const monthsToTarget = allocations.length > 0
    ? Math.max(...allocations.map(a => a.monthsToFull))
    : 0;

  return {
    strategy: config.strategy,
    label: config.label,
    description: config.description,
    allocations,
    phases,
    totalCapital,
    totalAnnualOM: totalOM,
    projectedScore: Math.min(100, projectedScore),
    monthsToTarget,
    residualGaps,
    interventionTypeCount: usedTypes.size,
  };
}

// ─── Main API ───────────────────────────────────────────────────────────────

export function generatePortfolios(
  grade: WaterQualityGrade,
  restoration: RestorationResult,
  waterParams: Record<string, { value: number }> | null,
  waterbodyType: WaterbodyCategory | null,
  constraints: PlannerConstraints,
): PortfolioResult {
  const wbType = waterbodyType || toWaterbodyCategory(restoration.waterType);
  const thresholds = TARGET_THRESHOLDS[constraints.target];
  const baseline = extractBaseline(waterParams);
  const gaps = calcGaps(baseline, thresholds);

  // Get compatible + constrained interventions
  const compatible = getInterventionsForWaterbody(wbType);
  const available = filterInterventions(compatible, constraints);

  const baselineScore = grade.score ?? 50;

  // Build 3 portfolios
  const cheapest = buildPortfolio(available, gaps, constraints, baselineScore, {
    strategy: 'cheapest',
    label: 'Lowest Cost',
    description: 'Minimizes total capital investment while meeting pollutant reduction targets',
    sortFn: (a, b, g) => costEfficiency(a, g) - costEfficiency(b, g),
    diversityBonus: false,
  });

  const fastest = buildPortfolio(available, gaps, constraints, baselineScore, {
    strategy: 'fastest',
    label: 'Fastest Results',
    description: 'Prioritizes interventions with the shortest time to full efficacy',
    sortFn: (a, b) => speedScore(a) - speedScore(b),
    diversityBonus: false,
  });

  const resilient = buildPortfolio(available, gaps, constraints, baselineScore, {
    strategy: 'resilient',
    label: 'Most Resilient',
    description: 'Diversifies intervention types for redundancy and long-term ecosystem health',
    sortFn: (a, b, g) => costEfficiency(a, g) - costEfficiency(b, g),
    diversityBonus: true,
  });

  return {
    portfolios: [cheapest, fastest, resilient],
    pollutantGaps: gaps,
    targetThresholds: thresholds,
    baselineValues: baseline,
    waterbodyType: wbType,
  };
}
