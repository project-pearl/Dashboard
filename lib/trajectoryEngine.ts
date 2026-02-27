// lib/trajectoryEngine.ts
// Monthly water quality score projection with ramp-up curves
// Projects parameter improvements over time as interventions deploy
// Pure functions — zero React, zero side effects

import type { ConfidenceRange, InterventionType, PollutantId, RampFunction, WaterbodyCategory } from './interventionLibrary';
import { getIntervention } from './interventionLibrary';
import type { Portfolio, PortfolioAllocation } from './portfolioEngine';
import { scoreParameter, type WaterbodyType } from './waterQualityScore';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TrajectoryMilestone {
  month: number;
  label: string;
  interventionId: string;
}

export interface TrajectoryPoint {
  month: number;
  projectedScore: ConfidenceRange;
  paramBreakdown: Partial<Record<PollutantId, ConfidenceRange>>;
  cumulativeCost: ConfidenceRange;
  milestones: TrajectoryMilestone[];
}

export interface Trajectory {
  points: TrajectoryPoint[];
  monthToTarget: number | null;
  targetScore: number;
}

// ─── Ramp Curves ────────────────────────────────────────────────────────────

function computeRampFraction(
  monthsSinceDeployment: number,
  monthsToMin: number,
  monthsToFull: number,
  fn: RampFunction,
): number {
  if (monthsSinceDeployment <= 0) return 0;
  if (monthsSinceDeployment >= monthsToFull) return 1;
  if (monthsSinceDeployment < monthsToMin) return 0;

  const elapsed = monthsSinceDeployment - monthsToMin;
  const span = monthsToFull - monthsToMin;
  if (span <= 0) return 1;

  const t = elapsed / span; // 0→1

  switch (fn) {
    case 'linear':
      return t;
    case 'logarithmic':
      // Fast initial ramp, then slowing — ln(1+t)/ln(2) scaled
      return Math.log(1 + t) / Math.log(2);
    case 'step':
      // Jump to full at monthsToFull
      return t >= 1 ? 1 : 0;
    default:
      return t;
  }
}

// ─── Trajectory Projection ──────────────────────────────────────────────────

/** Map WaterbodyCategory → WaterbodyType for scoreParameter */
function toWaterbodyType(wbCat: WaterbodyCategory): WaterbodyType {
  switch (wbCat) {
    case 'estuary':
    case 'tidal_river':
      return 'estuarine';
    case 'coastal':
      return 'coastal';
    case 'lake':
      return 'lake';
    default:
      return 'freshwater';
  }
}

/** Param key mapping from PollutantId to waterQualityScore param keys */
const POLLUTANT_TO_PARAM: Record<PollutantId, string> = {
  TN: 'TN',
  TP: 'TP',
  TSS: 'TSS',
  bacteria: 'bacteria',
  DO_improvement: 'DO',
};

export function projectTrajectory(
  portfolio: Portfolio,
  baselineScore: number,
  baselineParams: Partial<Record<PollutantId, number>>,
  waterbodyType: WaterbodyCategory,
  totalMonths: number,
  targetScore: number = 80,
): Trajectory {
  const wbType = toWaterbodyType(waterbodyType);
  const points: TrajectoryPoint[] = [];
  let monthToTarget: number | null = null;

  // Preload intervention data for each allocation
  const interventionData: Array<{
    alloc: PortfolioAllocation;
    intervention: InterventionType;
    deployMonth: number;
  }> = [];

  for (const alloc of portfolio.allocations) {
    const intervention = getIntervention(alloc.interventionId);
    if (!intervention) continue;
    // Deploy at the start of the allocation's phase
    const deployMonth = alloc.phase <= 1 ? 0 : alloc.phase === 2 ? 6 : 18;
    interventionData.push({ alloc, intervention, deployMonth });
  }

  for (let month = 0; month <= totalMonths; month++) {
    // Track per-pollutant combined removals (min/expected/max)
    const combinedRemovals: Record<PollutantId, { min: number; expected: number; max: number }> = {
      TN: { min: 0, expected: 0, max: 0 },
      TP: { min: 0, expected: 0, max: 0 },
      TSS: { min: 0, expected: 0, max: 0 },
      bacteria: { min: 0, expected: 0, max: 0 },
      DO_improvement: { min: 0, expected: 0, max: 0 },
    };

    // For each pollutant, collect all active removals and combine multiplicatively
    const activeRemovals: Record<PollutantId, { min: number[]; expected: number[]; max: number[] }> = {
      TN: { min: [], expected: [], max: [] },
      TP: { min: [], expected: [], max: [] },
      TSS: { min: [], expected: [], max: [] },
      bacteria: { min: [], expected: [], max: [] },
      DO_improvement: { min: [], expected: [], max: [] },
    };

    const milestones: TrajectoryMilestone[] = [];

    for (const { alloc, intervention, deployMonth } of interventionData) {
      const monthsSinceDeployment = month - deployMonth;
      if (monthsSinceDeployment < 0) continue;

      const rampFraction = computeRampFraction(
        monthsSinceDeployment,
        intervention.rampUp.monthsToMinEfficacy,
        intervention.rampUp.monthsToFullEfficacy,
        intervention.rampUp.rampFunction,
      );

      // Check for milestones
      if (monthsSinceDeployment === intervention.rampUp.monthsToMinEfficacy && intervention.rampUp.monthsToMinEfficacy > 0) {
        milestones.push({
          month,
          label: `${intervention.name} begins efficacy`,
          interventionId: intervention.id,
        });
      }
      if (monthsSinceDeployment === intervention.rampUp.monthsToFullEfficacy) {
        milestones.push({
          month,
          label: `${intervention.name} reaches full efficacy`,
          interventionId: intervention.id,
        });
      }

      // Scale removal rates by ramp fraction × quantity
      for (const p of Object.keys(activeRemovals) as PollutantId[]) {
        const rate = intervention.removalRates[p];
        if (!rate) continue;
        const qty = alloc.quantity;
        // Each unit provides full removal rate (not additive — they treat the same stream)
        // Multiple units increase coverage area, not removal percentage
        // But ramp fraction scales the instantaneous effectiveness
        activeRemovals[p].min.push(rate.min * rampFraction);
        activeRemovals[p].expected.push(rate.expected * rampFraction);
        activeRemovals[p].max.push(rate.max * rampFraction);
      }
    }

    // Combine multiplicatively
    for (const p of Object.keys(combinedRemovals) as PollutantId[]) {
      let retainedMin = 1, retainedExp = 1, retainedMax = 1;
      for (let i = 0; i < activeRemovals[p].expected.length; i++) {
        retainedMin *= (1 - activeRemovals[p].max[i]);     // max removal → min retained
        retainedExp *= (1 - activeRemovals[p].expected[i]);
        retainedMax *= (1 - activeRemovals[p].min[i]);     // min removal → max retained
      }
      combinedRemovals[p] = {
        min: 1 - retainedMax,    // worst case
        expected: 1 - retainedExp,
        max: 1 - retainedMin,    // best case
      };
    }

    // Project parameter values
    const paramBreakdown: Partial<Record<PollutantId, ConfidenceRange>> = {};
    const projectedParamScores: { min: number; expected: number; max: number }[] = [];

    for (const p of Object.keys(baselineParams) as PollutantId[]) {
      const current = baselineParams[p];
      if (current === undefined) continue;

      const removal = combinedRemovals[p];
      let projectedMin: number, projectedExp: number, projectedMax: number;

      if (p === 'DO_improvement') {
        // DO improves (goes up), not reduces
        projectedMin = current * (1 + removal.min);
        projectedExp = current * (1 + removal.expected);
        projectedMax = current * (1 + removal.max);
      } else {
        projectedMin = current * (1 - removal.max);   // best case = most removed
        projectedExp = current * (1 - removal.expected);
        projectedMax = current * (1 - removal.min);    // worst case = least removed
      }

      paramBreakdown[p] = { min: projectedMin, expected: projectedExp, max: projectedMax };

      // Score each projected value
      const paramKey = POLLUTANT_TO_PARAM[p];
      if (paramKey && paramKey !== 'DO') {
        const minScore = scoreParameter(paramKey, projectedMin, wbType);
        const expScore = scoreParameter(paramKey, projectedExp, wbType);
        const maxScore = scoreParameter(paramKey, projectedMax, wbType);
        if (expScore) {
          projectedParamScores.push({
            min: maxScore?.score ?? expScore.score,   // worst projected value → lowest score
            expected: expScore.score,
            max: minScore?.score ?? expScore.score,    // best projected value → highest score
          });
        }
      }
    }

    // Compute composite score
    let scoreMin = baselineScore, scoreExp = baselineScore, scoreMax = baselineScore;
    if (projectedParamScores.length > 0) {
      scoreMin = Math.round(projectedParamScores.reduce((s, p) => s + p.min, 0) / projectedParamScores.length);
      scoreExp = Math.round(projectedParamScores.reduce((s, p) => s + p.expected, 0) / projectedParamScores.length);
      scoreMax = Math.round(projectedParamScores.reduce((s, p) => s + p.max, 0) / projectedParamScores.length);
    }

    // Cumulative cost
    let costMin = 0, costExp = 0, costMax = 0;
    for (const { alloc, deployMonth } of interventionData) {
      if (month >= deployMonth) {
        costMin += alloc.capitalCost.min;
        costExp += alloc.capitalCost.expected;
        costMax += alloc.capitalCost.max;
        // Add O&M for months since deployment
        const omMonths = month - deployMonth;
        costMin += (alloc.annualOM.min / 12) * omMonths;
        costExp += (alloc.annualOM.expected / 12) * omMonths;
        costMax += (alloc.annualOM.max / 12) * omMonths;
      }
    }

    const point: TrajectoryPoint = {
      month,
      projectedScore: { min: scoreMin, expected: scoreExp, max: scoreMax },
      paramBreakdown,
      cumulativeCost: { min: costMin, expected: costExp, max: costMax },
      milestones,
    };
    points.push(point);

    // Track when target is reached
    if (monthToTarget === null && scoreExp >= targetScore) {
      monthToTarget = month;
    }
  }

  return {
    points,
    monthToTarget,
    targetScore,
  };
}
