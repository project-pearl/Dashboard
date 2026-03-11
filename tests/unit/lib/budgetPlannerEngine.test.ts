import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/interventionLibrary', () => ({
  INTERVENTION_LIBRARY: [
    {
      id: 'riparian-buffer', name: 'Riparian Buffer', category: 'nature-based',
      cost: { capitalPerUnit: { min: 30000, expected: 60000, max: 90000 }, annualOMPerUnit: { min: 2000, expected: 4000, max: 6000 }, unitLabel: 'mile' },
      removalRates: { TN: { min: 0.2, expected: 0.4, max: 0.6 }, TP: { min: 0.3, expected: 0.5, max: 0.7 }, TSS: { min: 0.4, expected: 0.6, max: 0.8 }, bacteria: null, DO_improvement: null },
      rampUp: { monthsToMinEfficacy: 6, monthsToFullEfficacy: 24, rampFunction: 'logarithmic' },
    },
    {
      id: 'pearl-alia', name: 'PEARL Unit', category: 'treatment',
      cost: { capitalPerUnit: { min: 100000, expected: 200000, max: 300000 }, annualOMPerUnit: { min: 10000, expected: 20000, max: 30000 }, unitLabel: 'unit' },
      removalRates: { TN: { min: 0.3, expected: 0.5, max: 0.7 }, TP: { min: 0.4, expected: 0.6, max: 0.8 }, TSS: { min: 0.7, expected: 0.85, max: 0.95 }, bacteria: { min: 0.2, expected: 0.4, max: 0.6 }, DO_improvement: { min: 0.1, expected: 0.2, max: 0.3 } },
      rampUp: { monthsToMinEfficacy: 1, monthsToFullEfficacy: 6, rampFunction: 'linear' },
    },
  ],
}));

vi.mock('@/lib/ejVulnerability', () => ({
  getEJScore: () => 55,
}));

import { allocateBudget, type BudgetPlannerInputs } from '@/lib/budgetPlannerEngine';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeInputs(overrides?: Partial<BudgetPlannerInputs>): BudgetPlannerInputs {
  return {
    totalBudget: 1000000,
    weights: {
      ecological: 30,
      economic: 20,
      environmentalJustice: 20,
      regulatoryCompliance: 15,
      climateResilience: 15,
    },
    stateAbbr: 'MD',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('budgetPlannerEngine', () => {
  describe('allocateBudget', () => {
    it('total allocated budget is approximately equal to input total budget', () => {
      const result = allocateBudget(makeInputs());
      // Budget is split via Math.round, so may differ by a few dollars
      const totalAllocated = result.allocations.reduce((s, a) => s + a.allocatedBudget, 0);
      // Within 1% of budget or $1000
      expect(Math.abs(totalAllocated - 1000000)).toBeLessThan(1000);
    });

    it('each allocation has compositeScore and normalizedScore', () => {
      const result = allocateBudget(makeInputs());

      for (const alloc of result.allocations) {
        expect(typeof alloc.compositeScore).toBe('number');
        expect(typeof alloc.normalizedScore).toBe('number');
      }
    });

    it('normalizedScores sum to approximately 1.0', () => {
      const result = allocateBudget(makeInputs());
      const totalNormalized = result.allocations.reduce((s, a) => s + a.normalizedScore, 0);
      expect(totalNormalized).toBeCloseTo(1.0, 1);
    });

    it('upstream interventions get 1.3x position multiplier', () => {
      const result = allocateBudget(makeInputs());
      const riparian = result.allocations.find(a => a.intervention.id === 'riparian-buffer');
      expect(riparian).toBeDefined();
      // riparian-buffer is classified as 'upstream' in the source
      expect(riparian!.position).toBe('upstream');
      expect(riparian!.positionMultiplier).toBe(1.3);
    });

    it('downstream interventions get 0.8x position multiplier', () => {
      const result = allocateBudget(makeInputs());
      const pearl = result.allocations.find(a => a.intervention.id === 'pearl-alia');
      expect(pearl).toBeDefined();
      // pearl-alia is classified as 'downstream'
      expect(pearl!.position).toBe('downstream');
      expect(pearl!.positionMultiplier).toBe(0.8);
    });

    it('all 5 axis scores are between 0 and 1', () => {
      const result = allocateBudget(makeInputs());

      for (const alloc of result.allocations) {
        for (const axis of ['ecological', 'economic', 'environmentalJustice', 'regulatoryCompliance', 'climateResilience'] as const) {
          expect(alloc.axisScores[axis]).toBeGreaterThanOrEqual(0);
          expect(alloc.axisScores[axis]).toBeLessThanOrEqual(1);
        }
      }
    });

    it('summary has combinedRemovalRates for all 5 pollutants', () => {
      const result = allocateBudget(makeInputs());
      const rates = result.summary.combinedRemovalRates;

      for (const pollutant of ['TN', 'TP', 'TSS', 'bacteria', 'DO_improvement']) {
        expect(rates[pollutant as keyof typeof rates]).toBeDefined();
        expect(rates[pollutant as keyof typeof rates]).toHaveProperty('min');
        expect(rates[pollutant as keyof typeof rates]).toHaveProperty('expected');
        expect(rates[pollutant as keyof typeof rates]).toHaveProperty('max');
      }
    });

    it('summary totalAllocated matches sum of allocation budgets', () => {
      const result = allocateBudget(makeInputs());
      const summed = result.allocations.reduce((s, a) => s + a.allocatedBudget, 0);
      expect(result.summary.totalAllocated).toBe(summed);
    });

    it('summary ejScore reflects mocked getEJScore value', () => {
      const result = allocateBudget(makeInputs());
      expect(result.summary.ejScore).toBe(55);
    });

    it('estimatedUnits is floor(allocatedBudget / capitalCost)', () => {
      const result = allocateBudget(makeInputs());

      for (const alloc of result.allocations) {
        if (alloc.allocatedBudget > 0) {
          const expectedUnits = Math.floor(alloc.allocatedBudget / alloc.intervention.cost.capitalPerUnit.expected);
          expect(alloc.estimatedUnits).toBe(expectedUnits);
        }
      }
    });

    it('returns the original inputs in the result', () => {
      const inputs = makeInputs();
      const result = allocateBudget(inputs);
      expect(result.inputs).toEqual(inputs);
    });

    it('allocations are sorted by allocatedBudget descending', () => {
      const result = allocateBudget(makeInputs());
      for (let i = 1; i < result.allocations.length; i++) {
        expect(result.allocations[i - 1].allocatedBudget).toBeGreaterThanOrEqual(
          result.allocations[i].allocatedBudget,
        );
      }
    });
  });
});
