import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/interventionLibrary', () => ({
  getIntervention: (id: string) => ({
    id, name: 'Test Intervention',
    removalRates: { TN: { min: 0.2, expected: 0.4, max: 0.6 }, TP: { min: 0.3, expected: 0.5, max: 0.7 }, TSS: null, bacteria: null, DO_improvement: null },
    rampUp: { monthsToMinEfficacy: 1, monthsToFullEfficacy: 6, rampFunction: 'linear' as const },
  }),
}));

vi.mock('@/lib/waterQualityScore', () => ({
  scoreParameter: (paramKey: string, value: number) => ({
    score: Math.max(0, Math.min(100, 100 - value * 20)),
  }),
}));

import { projectTrajectory } from '@/lib/trajectoryEngine';
import type { Portfolio, PortfolioAllocation } from '@/lib/portfolioEngine';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeAllocation(overrides?: Partial<PortfolioAllocation>): PortfolioAllocation {
  return {
    interventionId: 'test-intervention',
    interventionName: 'Test Intervention',
    quantity: 1,
    unitLabel: 'unit',
    capitalCost: { min: 50000, expected: 100000, max: 150000 },
    annualOM: { min: 5000, expected: 10000, max: 15000 },
    monthsToFull: 6,
    phase: 1,
    ...overrides,
  };
}

function makePortfolio(allocations: PortfolioAllocation[]): Portfolio {
  return {
    strategy: 'cheapest',
    label: 'Test Portfolio',
    description: 'Test portfolio for unit tests',
    allocations,
    phases: [],
    totalCapital: { min: 0, expected: 0, max: 0 },
    totalAnnualOM: { min: 0, expected: 0, max: 0 },
    projectedScore: 70,
    monthsToTarget: 6,
    residualGaps: {},
    interventionTypeCount: 1,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('trajectoryEngine', () => {
  describe('projectTrajectory', () => {
    it('returns correct number of points (totalMonths + 1)', () => {
      const portfolio = makePortfolio([makeAllocation()]);
      const result = projectTrajectory(portfolio, 50, { TN: 2.0, TP: 0.3 }, 'freshwater', 12);
      expect(result.points).toHaveLength(13); // months 0-12 inclusive
    });

    it('returns correct number of points for different totalMonths', () => {
      const portfolio = makePortfolio([makeAllocation()]);
      const result = projectTrajectory(portfolio, 50, { TN: 2.0 }, 'freshwater', 24);
      expect(result.points).toHaveLength(25); // months 0-24 inclusive
    });

    it('month 0 has cumulativeCost of 0 when allocations deploy at phase > 1', () => {
      // Phase 2 deploys at month 6, phase 3 at month 18
      const alloc = makeAllocation({ phase: 2 });
      const portfolio = makePortfolio([alloc]);
      const result = projectTrajectory(portfolio, 50, { TN: 2.0 }, 'freshwater', 12);

      // Month 0: phase 2 has not deployed yet (deployMonth=6)
      expect(result.points[0].cumulativeCost.expected).toBe(0);
    });

    it('cumulative cost increases over time', () => {
      const portfolio = makePortfolio([makeAllocation()]);
      const result = projectTrajectory(portfolio, 50, { TN: 2.0, TP: 0.3 }, 'freshwater', 12);

      // Phase 1 deploys at month 0, so cost should be > 0 from month 0
      // and increase over time due to O&M
      const costMonth0 = result.points[0].cumulativeCost.expected;
      const costMonth6 = result.points[6].cumulativeCost.expected;
      const costMonth12 = result.points[12].cumulativeCost.expected;

      expect(costMonth6).toBeGreaterThan(costMonth0);
      expect(costMonth12).toBeGreaterThan(costMonth6);
    });

    it('projectTrajectory with no allocations returns all points with baseline score', () => {
      const portfolio = makePortfolio([]);
      const baseline = 60;
      const result = projectTrajectory(portfolio, baseline, { TN: 2.0 }, 'freshwater', 6);

      expect(result.points).toHaveLength(7);
      for (const point of result.points) {
        // With no allocations and projectedParamScores empty, score stays at baseline
        expect(point.projectedScore.expected).toBe(baseline);
        expect(point.cumulativeCost.expected).toBe(0);
      }
    });

    it('linear ramp: at 50% of ramp period, removal should be approximately 50% of full', () => {
      // Mock intervention: monthsToMinEfficacy=1, monthsToFullEfficacy=6, rampFunction=linear
      // At month 0: no deployment
      // At month 1: ramp starts (monthsToMin=1)
      // Linear ramp from month 1 to month 6 (span=5)
      // At month 3.5: elapsed=2.5, t=2.5/5=0.5 → 50% of full removal
      //
      // We test this indirectly via the trajectory output: the param values should
      // reflect the partial removal at intermediate months
      const alloc = makeAllocation({ phase: 1 });
      const portfolio = makePortfolio([alloc]);
      const baseline = { TN: 2.0 };
      const result = projectTrajectory(portfolio, 50, baseline, 'freshwater', 12);

      // At month 0: no removal yet (rampFraction=0 since monthsSinceDeployment=0)
      const paramMonth0 = result.points[0].paramBreakdown.TN;
      expect(paramMonth0).toBeDefined();
      expect(paramMonth0!.expected).toBe(2.0); // no removal

      // At month 6 (full ramp): expected removal = 0.4 → value = 2.0 * (1-0.4) = 1.2
      const paramMonth6 = result.points[6].paramBreakdown.TN;
      expect(paramMonth6).toBeDefined();
      expect(paramMonth6!.expected).toBeCloseTo(1.2, 1);

      // At midpoint (month 3 or 4), removal should be partially applied
      // month 3: elapsed from min=1 is 2, span=5, t=0.4 → removal=0.4*0.4=0.16
      // value = 2.0 * (1 - 0.16) = 1.68
      const paramMonth3 = result.points[3].paramBreakdown.TN;
      expect(paramMonth3).toBeDefined();
      expect(paramMonth3!.expected).toBeGreaterThan(1.2); // less removal than full
      expect(paramMonth3!.expected).toBeLessThan(2.0);    // some removal applied
    });

    it('monthToTarget set when score crosses target', () => {
      const alloc = makeAllocation({ phase: 1 });
      const portfolio = makePortfolio([alloc]);
      // With scoreParameter mock: score = 100 - value*20
      // baseline TN=2.0 → score = 100 - 2.0*20 = 60
      // At full ramp: TN=1.2 → score = 100 - 1.2*20 = 76
      // Target=70: should cross somewhere during ramp
      const result = projectTrajectory(portfolio, 50, { TN: 2.0 }, 'freshwater', 12, 70);

      // monthToTarget should be set since projected score reaches 76 at full ramp
      expect(result.monthToTarget).not.toBeNull();
      expect(result.monthToTarget).toBeGreaterThan(0);
      expect(result.monthToTarget).toBeLessThanOrEqual(12);
    });

    it('monthToTarget is null when score never reaches target', () => {
      const alloc = makeAllocation({ phase: 1 });
      const portfolio = makePortfolio([alloc]);
      // baseline TN=2.0 → score = 60
      // At full ramp: TN=1.2 → score = 76
      // Target=90: never reached
      const result = projectTrajectory(portfolio, 50, { TN: 2.0 }, 'freshwater', 12, 90);

      expect(result.monthToTarget).toBeNull();
    });

    it('targetScore defaults to 80', () => {
      const portfolio = makePortfolio([]);
      const result = projectTrajectory(portfolio, 50, {}, 'freshwater', 6);
      expect(result.targetScore).toBe(80);
    });

    it('each point has month, projectedScore, paramBreakdown, cumulativeCost, milestones', () => {
      const portfolio = makePortfolio([makeAllocation()]);
      const result = projectTrajectory(portfolio, 50, { TN: 2.0 }, 'freshwater', 6);

      for (const point of result.points) {
        expect(typeof point.month).toBe('number');
        expect(point.projectedScore).toHaveProperty('min');
        expect(point.projectedScore).toHaveProperty('expected');
        expect(point.projectedScore).toHaveProperty('max');
        expect(point.paramBreakdown).toBeDefined();
        expect(point.cumulativeCost).toHaveProperty('min');
        expect(point.cumulativeCost).toHaveProperty('expected');
        expect(point.cumulativeCost).toHaveProperty('max');
        expect(Array.isArray(point.milestones)).toBe(true);
      }
    });

    it('milestones are generated at min efficacy and full efficacy months', () => {
      // Mock intervention: monthsToMinEfficacy=1, monthsToFullEfficacy=6
      const portfolio = makePortfolio([makeAllocation()]);
      const result = projectTrajectory(portfolio, 50, { TN: 2.0 }, 'freshwater', 12);

      // At month 1: "begins efficacy" milestone
      const month1Milestones = result.points[1].milestones;
      expect(month1Milestones.length).toBeGreaterThan(0);
      expect(month1Milestones.some(m => m.label.includes('begins efficacy'))).toBe(true);

      // At month 6: "reaches full efficacy" milestone
      const month6Milestones = result.points[6].milestones;
      expect(month6Milestones.length).toBeGreaterThan(0);
      expect(month6Milestones.some(m => m.label.includes('full efficacy'))).toBe(true);
    });
  });
});
