import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/indices/types', () => ({}));
vi.mock('@/lib/siteIntelTypes', () => ({}));

import { computeRiskForecast } from '@/lib/riskForecast';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeReport(overrides?: Partial<any>): any {
  return {
    regulatory: {
      sdwisViolations: [], sdwisEnforcement: [], sdwisSystems: [],
      icisViolations: [], icisEnforcement: [], icisDmr: [],
      ...overrides?.regulatory,
    },
    contamination: {
      pfasDetections: 0, superfund: [], echoViolations: [],
      ...overrides?.contamination,
    },
    environmentalProfile: {
      attains: { impaired: 0, total: 10, topCauses: [] },
      ...overrides?.environmentalProfile,
    },
    femaDeclarations: [],
    waterScore: null,
    ...overrides,
  };
}

function makeHuc(overrides?: Partial<any>): any {
  const idx = (value: number, conf = 50, trend = 'stable') => ({ value, confidence: conf, trend });
  return {
    pearlLoadVelocity: idx(50), infrastructureFailure: idx(50), watershedRecovery: idx(50),
    permitRiskExposure: idx(50), perCapitaLoad: idx(50), waterfrontExposure: idx(50),
    ecologicalHealth: idx(50), ejVulnerability: idx(50), governanceResponse: idx(50),
    composite: 50,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('riskForecast', () => {
  describe('computeRiskForecast', () => {
    it('returns 8 predictions', () => {
      const result = computeRiskForecast(makeReport(), makeHuc());
      expect(result.predictions).toHaveLength(8);
    });

    it('all probabilities clamped to [0, 100]', () => {
      // Use extreme values to test clamping
      const report = makeReport({
        regulatory: {
          sdwisViolations: Array(50).fill({ isHealthBased: true, severity: 'Major' }),
          sdwisEnforcement: Array(50).fill({}),
          sdwisSystems: [{ population: 500000 }],
          icisViolations: Array(50).fill({}),
          icisEnforcement: Array(50).fill({ type: 'RNC' }),
          icisDmr: Array(50).fill({ exceedance: true }),
        },
        contamination: {
          pfasDetections: 50, superfund: Array(20).fill({}), echoViolations: Array(20).fill({}),
        },
        femaDeclarations: Array(20).fill({}),
      });
      const huc = makeHuc({
        infrastructureFailure: { value: 100, confidence: 80, trend: 'declining' },
        pearlLoadVelocity: { value: 100, confidence: 80, trend: 'declining' },
        perCapitaLoad: { value: 100, confidence: 80, trend: 'declining' },
      });

      const result = computeRiskForecast(report, huc);
      for (const pred of result.predictions) {
        expect(pred.probability).toBeGreaterThanOrEqual(0);
        expect(pred.probability).toBeLessThanOrEqual(100);
      }
    });

    it('all predictions have valid riskLevel (red, amber, green)', () => {
      const result = computeRiskForecast(makeReport(), makeHuc());
      for (const pred of result.predictions) {
        expect(['red', 'amber', 'green']).toContain(pred.riskLevel);
      }
    });

    it('high infrastructure failure index increases infrastructure-failure prediction probability', () => {
      const baseResult = computeRiskForecast(makeReport(), makeHuc());
      const basePred = baseResult.predictions.find(p => p.category === 'infrastructure-failure');

      const highInfraHuc = makeHuc({
        infrastructureFailure: { value: 95, confidence: 80, trend: 'stable' },
        perCapitaLoad: { value: 90, confidence: 80, trend: 'stable' },
      });
      const highResult = computeRiskForecast(makeReport(), highInfraHuc);
      const highPred = highResult.predictions.find(p => p.category === 'infrastructure-failure');

      expect(basePred).toBeDefined();
      expect(highPred).toBeDefined();
      expect(highPred!.probability).toBeGreaterThan(basePred!.probability);
    });

    it('no HUC indices (null) still returns 8 predictions using defaults', () => {
      const result = computeRiskForecast(makeReport(), null);
      expect(result.predictions).toHaveLength(8);
      for (const pred of result.predictions) {
        expect(pred.probability).toBeGreaterThanOrEqual(0);
        expect(pred.probability).toBeLessThanOrEqual(100);
        expect(['red', 'amber', 'green']).toContain(pred.riskLevel);
      }
    });

    it('declining trend increases probability (1.15x multiplier)', () => {
      const stableHuc = makeHuc({
        infrastructureFailure: { value: 70, confidence: 50, trend: 'stable' },
      });
      const decliningHuc = makeHuc({
        infrastructureFailure: { value: 70, confidence: 50, trend: 'declining' },
      });

      const stableResult = computeRiskForecast(makeReport(), stableHuc);
      const decliningResult = computeRiskForecast(makeReport(), decliningHuc);

      const stablePred = stableResult.predictions.find(p => p.category === 'infrastructure-failure');
      const decliningPred = decliningResult.predictions.find(p => p.category === 'infrastructure-failure');

      expect(stablePred).toBeDefined();
      expect(decliningPred).toBeDefined();
      // Declining should have higher probability due to 1.15x multiplier
      expect(decliningPred!.probability).toBeGreaterThanOrEqual(stablePred!.probability);
    });

    it('improving trend decreases probability (0.85x multiplier)', () => {
      const stableHuc = makeHuc({
        infrastructureFailure: { value: 70, confidence: 50, trend: 'stable' },
      });
      const improvingHuc = makeHuc({
        infrastructureFailure: { value: 70, confidence: 50, trend: 'improving' },
      });

      const stableResult = computeRiskForecast(makeReport(), stableHuc);
      const improvingResult = computeRiskForecast(makeReport(), improvingHuc);

      const stablePred = stableResult.predictions.find(p => p.category === 'infrastructure-failure');
      const improvingPred = improvingResult.predictions.find(p => p.category === 'infrastructure-failure');

      expect(stablePred).toBeDefined();
      expect(improvingPred).toBeDefined();
      // Improving should have lower or equal probability due to 0.85x multiplier
      expect(improvingPred!.probability).toBeLessThanOrEqual(stablePred!.probability);
    });

    it('dataCompleteness: all 9 indices present yields 100%', () => {
      const result = computeRiskForecast(makeReport(), makeHuc());
      expect(result.dataCompleteness).toBe(100);
    });

    it('dataCompleteness: no HUC indices yields 0%', () => {
      const result = computeRiskForecast(makeReport(), null);
      expect(result.dataCompleteness).toBe(0);
    });

    it('dataCompleteness: partial indices yields correct percentage', () => {
      // Only provide 3 of 9 indices
      const partialHuc = {
        pearlLoadVelocity: { value: 50, confidence: 50, trend: 'stable' },
        infrastructureFailure: { value: 50, confidence: 50, trend: 'stable' },
        watershedRecovery: { value: 50, confidence: 50, trend: 'stable' },
        composite: 50,
      };
      const result = computeRiskForecast(makeReport(), partialHuc as any);
      // 3 of 9 = 33%
      expect(result.dataCompleteness).toBe(33);
    });

    it('overallRiskLevel reflects highest non-ROI prediction', () => {
      // Create a scenario where at least one non-ROI prediction is red (>= 60)
      const report = makeReport({
        regulatory: {
          sdwisViolations: Array(10).fill({ isHealthBased: true, severity: 'Major' }),
          sdwisEnforcement: Array(5).fill({}),
          sdwisSystems: [],
          icisViolations: [], icisEnforcement: [], icisDmr: [],
        },
        femaDeclarations: Array(5).fill({}),
      });
      const highHuc = makeHuc({
        infrastructureFailure: { value: 95, confidence: 80, trend: 'declining' },
        perCapitaLoad: { value: 90, confidence: 80, trend: 'declining' },
      });

      const result = computeRiskForecast(report, highHuc);
      const nonRoi = result.predictions.filter(p => p.category !== 'intervention-roi');
      const maxProb = Math.max(...nonRoi.map(p => p.probability));

      if (maxProb >= 60) {
        expect(result.overallRiskLevel).toBe('red');
      } else if (maxProb >= 30) {
        expect(result.overallRiskLevel).toBe('amber');
      } else {
        expect(result.overallRiskLevel).toBe('green');
      }
    });

    it('each prediction has required fields', () => {
      const result = computeRiskForecast(makeReport(), makeHuc());
      for (const pred of result.predictions) {
        expect(pred).toHaveProperty('category');
        expect(pred).toHaveProperty('label');
        expect(pred).toHaveProperty('probability');
        expect(pred).toHaveProperty('riskLevel');
        expect(pred).toHaveProperty('timeframe');
        expect(pred).toHaveProperty('confidence');
        expect(pred).toHaveProperty('summary');
        expect(pred).toHaveProperty('factors');
        expect(pred).toHaveProperty('icon');
        expect(typeof pred.summary).toBe('string');
        expect(Array.isArray(pred.factors)).toBe(true);
      }
    });

    it('result has generatedAt timestamp', () => {
      const result = computeRiskForecast(makeReport(), makeHuc());
      expect(result.generatedAt).toBeDefined();
      expect(typeof result.generatedAt).toBe('string');
      // Should be a valid ISO date
      expect(new Date(result.generatedAt).toString()).not.toBe('Invalid Date');
    });

    it('prediction categories cover all 8 expected types', () => {
      const result = computeRiskForecast(makeReport(), makeHuc());
      const categories = result.predictions.map(p => p.category);
      expect(categories).toContain('infrastructure-failure');
      expect(categories).toContain('impairment-breach');
      expect(categories).toContain('enforcement-probability');
      expect(categories).toContain('capacity-exceedance');
      expect(categories).toContain('cascading-impact');
      expect(categories).toContain('recovery-timeline');
      expect(categories).toContain('public-health-exposure');
      expect(categories).toContain('intervention-roi');
    });
  });
});
