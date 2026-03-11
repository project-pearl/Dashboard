import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/interventionLibrary', () => ({
  getInterventionsForWaterbody: () => [
    {
      id: 'constructed-wetland', name: 'Constructed Wetland', category: 'nature-based',
      requiresLand: true, requiresPermitting: false,
      cost: { capitalPerUnit: { min: 50000, expected: 100000, max: 150000 }, annualOMPerUnit: { min: 5000, expected: 10000, max: 15000 }, unitLabel: 'acre' },
      removalRates: { TN: { min: 0.3, expected: 0.5, max: 0.7 }, TP: { min: 0.4, expected: 0.6, max: 0.8 }, TSS: { min: 0.6, expected: 0.8, max: 0.9 }, bacteria: null, DO_improvement: null },
      rampUp: { monthsToMinEfficacy: 3, monthsToFullEfficacy: 12, rampFunction: 'logarithmic' },
    },
    {
      id: 'stormwater-bmp', name: 'Stormwater BMP', category: 'infrastructure',
      requiresLand: false, requiresPermitting: false,
      cost: { capitalPerUnit: { min: 20000, expected: 50000, max: 80000 }, annualOMPerUnit: { min: 2000, expected: 5000, max: 8000 }, unitLabel: 'unit' },
      removalRates: { TN: { min: 0.1, expected: 0.3, max: 0.5 }, TP: { min: 0.2, expected: 0.4, max: 0.6 }, TSS: { min: 0.5, expected: 0.7, max: 0.85 }, bacteria: { min: 0.1, expected: 0.3, max: 0.5 }, DO_improvement: null },
      rampUp: { monthsToMinEfficacy: 1, monthsToFullEfficacy: 3, rampFunction: 'linear' },
    },
  ],
}));

vi.mock('@/lib/waterQualityScore', () => ({}));

import { generatePortfolios } from '@/lib/portfolioEngine';
import type { PlannerConstraints } from '@/lib/portfolioEngine';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeGrade(score: number) {
  return { score, letter: 'C', label: 'Fair' } as any;
}

function makeRestoration() {
  return { waterType: 'freshwater' } as any;
}

function makeWaterParams(overrides?: Record<string, { value: number }>) {
  return {
    TN: { value: 2.0 },
    TP: { value: 0.3 },
    TSS: { value: 40 },
    bacteria: { value: 200 },
    ...overrides,
  };
}

function makeConstraints(overrides?: Partial<PlannerConstraints>): PlannerConstraints {
  return {
    target: 'swimmable',
    timeline: '5yr',
    budgetMin: 50000,
    budgetMax: 500000,
    landAvailable: true,
    permittingFeasible: true,
    politicalSupport: true,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('portfolioEngine', () => {
  describe('generatePortfolios', () => {
    it('returns 3 portfolios (cheapest, fastest, resilient)', () => {
      const result = generatePortfolios(
        makeGrade(55),
        makeRestoration(),
        makeWaterParams(),
        'freshwater',
        makeConstraints(),
      );

      expect(result.portfolios).toHaveLength(3);
      expect(result.portfolios[0].strategy).toBe('cheapest');
      expect(result.portfolios[1].strategy).toBe('fastest');
      expect(result.portfolios[2].strategy).toBe('resilient');
    });

    it('each portfolio has allocations array, totalCapital, and monthsToTarget', () => {
      const result = generatePortfolios(
        makeGrade(55),
        makeRestoration(),
        makeWaterParams(),
        'freshwater',
        makeConstraints(),
      );

      for (const portfolio of result.portfolios) {
        expect(Array.isArray(portfolio.allocations)).toBe(true);
        expect(portfolio.totalCapital).toBeDefined();
        expect(portfolio.totalCapital).toHaveProperty('min');
        expect(portfolio.totalCapital).toHaveProperty('expected');
        expect(portfolio.totalCapital).toHaveProperty('max');
        expect(typeof portfolio.monthsToTarget).toBe('number');
      }
    });

    it('budget constraint respected: totalCapital.expected <= budgetMax', () => {
      const budgetMax = 200000;
      const result = generatePortfolios(
        makeGrade(55),
        makeRestoration(),
        makeWaterParams(),
        'freshwater',
        makeConstraints({ budgetMax }),
      );

      for (const portfolio of result.portfolios) {
        expect(portfolio.totalCapital.expected).toBeLessThanOrEqual(budgetMax);
      }
    });

    it('pollutantGaps calculated correctly when baseline exceeds target', () => {
      // swimmable target: TN=1.0, TP=0.1, TSS=25, bacteria=126
      // baseline: TN=2.0, TP=0.3, TSS=40, bacteria=200
      const result = generatePortfolios(
        makeGrade(55),
        makeRestoration(),
        makeWaterParams({ TN: { value: 2.0 }, TP: { value: 0.3 }, TSS: { value: 40 }, bacteria: { value: 200 } }),
        'freshwater',
        makeConstraints({ target: 'swimmable' }),
      );

      // TN gap: 1 - (1.0/2.0) = 0.5
      expect(result.pollutantGaps.TN).toBeCloseTo(0.5, 2);
      // TP gap: 1 - (0.1/0.3) = 0.6667
      expect(result.pollutantGaps.TP).toBeCloseTo(0.6667, 2);
      // TSS gap: 1 - (25/40) = 0.375
      expect(result.pollutantGaps.TSS).toBeCloseTo(0.375, 2);
      // bacteria gap: 1 - (126/200) = 0.37
      expect(result.pollutantGaps.bacteria).toBeCloseTo(0.37, 2);
    });

    it('no gap when baseline is below target', () => {
      // Set TN below the swimmable target of 1.0
      const result = generatePortfolios(
        makeGrade(90),
        makeRestoration(),
        makeWaterParams({ TN: { value: 0.5 }, TP: { value: 0.05 }, TSS: { value: 10 }, bacteria: { value: 50 } }),
        'freshwater',
        makeConstraints({ target: 'swimmable' }),
      );

      expect(result.pollutantGaps.TN).toBe(0);
      expect(result.pollutantGaps.TP).toBe(0);
      expect(result.pollutantGaps.TSS).toBe(0);
      expect(result.pollutantGaps.bacteria).toBe(0);
    });

    it('filters out land-requiring interventions when landAvailable is false', () => {
      const result = generatePortfolios(
        makeGrade(55),
        makeRestoration(),
        makeWaterParams(),
        'freshwater',
        makeConstraints({ landAvailable: false, permittingFeasible: false }),
      );

      // constructed-wetland requires land, so it should be filtered out
      for (const portfolio of result.portfolios) {
        for (const alloc of portfolio.allocations) {
          expect(alloc.interventionId).not.toBe('constructed-wetland');
        }
      }
    });

    it('portfolios have phases array', () => {
      const result = generatePortfolios(
        makeGrade(55),
        makeRestoration(),
        makeWaterParams(),
        'freshwater',
        makeConstraints(),
      );

      for (const portfolio of result.portfolios) {
        expect(Array.isArray(portfolio.phases)).toBe(true);
        for (const phase of portfolio.phases) {
          expect(phase).toHaveProperty('phase');
          expect(phase).toHaveProperty('label');
          expect(phase).toHaveProperty('monthStart');
          expect(phase).toHaveProperty('monthEnd');
          expect(Array.isArray(phase.allocations)).toBe(true);
        }
      }
    });

    it('returns waterbodyType in result', () => {
      const result = generatePortfolios(
        makeGrade(55),
        makeRestoration(),
        makeWaterParams(),
        'freshwater',
        makeConstraints(),
      );

      expect(result.waterbodyType).toBe('freshwater');
    });

    it('falls back to restoration waterType when waterbodyType is null', () => {
      const result = generatePortfolios(
        makeGrade(55),
        makeRestoration(),
        makeWaterParams(),
        null,
        makeConstraints(),
      );

      // toWaterbodyCategory('freshwater') => 'freshwater'
      expect(result.waterbodyType).toBe('freshwater');
    });

    it('handles null waterParams gracefully', () => {
      const result = generatePortfolios(
        makeGrade(50),
        makeRestoration(),
        null,
        'freshwater',
        makeConstraints(),
      );

      // All gaps should be 0 when no baseline data
      expect(result.pollutantGaps.TN).toBe(0);
      expect(result.pollutantGaps.TP).toBe(0);
      expect(result.pollutantGaps.TSS).toBe(0);
      expect(result.pollutantGaps.bacteria).toBe(0);
      expect(result.portfolios).toHaveLength(3);
    });
  });
});
