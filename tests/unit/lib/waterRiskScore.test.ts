import { describe, it, expect, vi } from 'vitest';

// Mock confidence regression to identity (score passes through unchanged)
vi.mock('@/lib/indices/confidence', () => ({
  applyConfidenceRegression: (score: number, _conf: number) => score,
}));

import { computeWaterRiskScore, type RiskScoreInput } from '@/lib/waterRiskScore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a fully-null input (no data at all). */
function emptyInput(): RiskScoreInput {
  return {
    wqpGrade: null,
    hucIndices: null,
    sdwis: null,
    icis: null,
    echo: null,
    pfas: null,
    tri: null,
    attains: null,
    ejscreen: null,
  };
}

/** Build a "high quality" input with good WQP grade and clean records. */
function highScoreInput(): RiskScoreInput {
  return {
    wqpGrade: { canBeGraded: true, score: 95, letter: 'A', gradedParamCount: 6, gradedParamTotal: 7 } as any,
    hucIndices: {
      infrastructureFailure: { value: 15, confidence: 70, trend: 'stable' } as any,
      permitRiskExposure: { value: 10, confidence: 70, trend: 'improving' } as any,
      ejVulnerability: { value: 20, confidence: 60, trend: 'stable' } as any,
    } as any,
    sdwis: { systems: [{}], violations: [], enforcement: [] },
    icis: { permits: [{}], violations: [], enforcement: [] },
    echo: { facilities: [{}], violations: [] },
    pfas: { results: [] },
    tri: [],
    attains: { impaired: 0, total: 10, topCauses: [] },
    ejscreen: null,
  };
}

/** Build a "low quality" input with poor WQP grade and many violations. */
function lowScoreInput(): RiskScoreInput {
  return {
    wqpGrade: { canBeGraded: true, score: 30, letter: 'F', gradedParamCount: 5, gradedParamTotal: 7 } as any,
    hucIndices: {
      infrastructureFailure: { value: 80, confidence: 70, trend: 'declining' } as any,
      permitRiskExposure: { value: 75, confidence: 70, trend: 'declining' } as any,
      ejVulnerability: { value: 85, confidence: 60, trend: 'declining' } as any,
    } as any,
    sdwis: { systems: [{}], violations: [{}, {}, {}], enforcement: [] },
    icis: { permits: [{}], violations: [{}, {}, {}, {}], enforcement: [{}, {}] },
    echo: { facilities: [{}], violations: [{}, {}, {}] },
    pfas: { results: [{}, {}, {}, {}, {}] },
    tri: [{}, {}, {}, {}],
    attains: { impaired: 8, total: 10, topCauses: ['Nutrients', 'Sediment'] },
    ejscreen: null,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('waterRiskScore', () => {
  // ── All null input → neutral fallback ──────────────────────────────────────

  describe('all null input', () => {
    it('composite score is around 50 (neutral fallback)', () => {
      const result = computeWaterRiskScore(emptyInput());
      expect(result.composite.score).toBeGreaterThanOrEqual(45);
      expect(result.composite.score).toBeLessThanOrEqual(55);
    });

    it('letter is F for a score around 50', () => {
      const result = computeWaterRiskScore(emptyInput());
      expect(result.composite.letter).toBe('F');
    });

    it('has 5 category keys', () => {
      const result = computeWaterRiskScore(emptyInput());
      const keys = Object.keys(result.categories);
      expect(keys).toHaveLength(5);
      expect(keys).toEqual(
        expect.arrayContaining([
          'waterQuality',
          'infrastructure',
          'compliance',
          'contamination',
          'environmentalJustice',
        ]),
      );
    });

    it('dataSources is empty when no data present', () => {
      const result = computeWaterRiskScore(emptyInput());
      expect(result.dataSources).toHaveLength(0);
    });

    it('details violations are all zero', () => {
      const result = computeWaterRiskScore(emptyInput());
      expect(result.details.violations).toBe(0);
      expect(result.details.pfasDetections).toBe(0);
      expect(result.details.triFacilities).toBe(0);
      expect(result.details.impairments).toBe(0);
    });
  });

  // ── High score scenario ────────────────────────────────────────────────────

  describe('high score scenario', () => {
    it('composite is 80+ with good data and no violations', () => {
      const result = computeWaterRiskScore(highScoreInput());
      expect(result.composite.score).toBeGreaterThanOrEqual(80);
    });

    it('letter is B or better', () => {
      const result = computeWaterRiskScore(highScoreInput());
      expect(['A+', 'A', 'A-', 'B+', 'B', 'B-']).toContain(result.composite.letter);
    });

    it('all category scores are >= 70', () => {
      const result = computeWaterRiskScore(highScoreInput());
      for (const key of Object.keys(result.categories) as Array<keyof typeof result.categories>) {
        expect(result.categories[key].score).toBeGreaterThanOrEqual(70);
      }
    });

    it('details violations is 0', () => {
      const result = computeWaterRiskScore(highScoreInput());
      expect(result.details.violations).toBe(0);
    });

    it('composite style uses green colors for A/B letter', () => {
      const result = computeWaterRiskScore(highScoreInput());
      const letter = result.composite.letter.charAt(0);
      if (letter === 'A') {
        expect(result.composite.color).toContain('green');
        expect(result.composite.bgColor).toContain('green');
      } else if (letter === 'B') {
        expect(result.composite.color).toContain('emerald');
        expect(result.composite.bgColor).toContain('emerald');
      }
    });
  });

  // ── Low score scenario ─────────────────────────────────────────────────────

  describe('low score scenario', () => {
    it('composite is below 50 with poor data and many violations', () => {
      const result = computeWaterRiskScore(lowScoreInput());
      expect(result.composite.score).toBeLessThanOrEqual(50);
    });

    it('letter is D or F', () => {
      const result = computeWaterRiskScore(lowScoreInput());
      expect(['D+', 'D', 'D-', 'F']).toContain(result.composite.letter);
    });

    it('waterQuality category score matches low WQP grade', () => {
      const result = computeWaterRiskScore(lowScoreInput());
      expect(result.categories.waterQuality.score).toBe(30);
    });
  });

  // ── 5 categories always present ────────────────────────────────────────────

  describe('result structure', () => {
    it('always returns exactly 5 categories', () => {
      const inputs = [emptyInput(), highScoreInput(), lowScoreInput()];
      for (const input of inputs) {
        const result = computeWaterRiskScore(input);
        expect(Object.keys(result.categories)).toHaveLength(5);
      }
    });

    it('each category has score, label, confidence, and factors', () => {
      const result = computeWaterRiskScore(highScoreInput());
      for (const key of Object.keys(result.categories) as Array<keyof typeof result.categories>) {
        const cat = result.categories[key];
        expect(typeof cat.score).toBe('number');
        expect(typeof cat.label).toBe('string');
        expect(typeof cat.confidence).toBe('number');
        expect(Array.isArray(cat.factors)).toBe(true);
      }
    });

    it('composite has score, letter, confidence, color, bgColor', () => {
      const result = computeWaterRiskScore(highScoreInput());
      expect(typeof result.composite.score).toBe('number');
      expect(typeof result.composite.letter).toBe('string');
      expect(typeof result.composite.confidence).toBe('number');
      expect(typeof result.composite.color).toBe('string');
      expect(typeof result.composite.bgColor).toBe('string');
    });

    it('details has observations and implications arrays', () => {
      const result = computeWaterRiskScore(highScoreInput());
      expect(Array.isArray(result.details.observations)).toBe(true);
      expect(Array.isArray(result.details.implications)).toBe(true);
    });
  });

  // ── Violation summation ────────────────────────────────────────────────────

  describe('details.violations', () => {
    it('sums SDWIS + ICIS + ECHO violations', () => {
      const input = emptyInput();
      input.sdwis = { systems: [{}], violations: [{}, {}], enforcement: [] };
      input.icis = { permits: [{}], violations: [{}, {}, {}], enforcement: [] };
      input.echo = { facilities: [{}], violations: [{}] };

      const result = computeWaterRiskScore(input);
      // 2 + 3 + 1 = 6
      expect(result.details.violations).toBe(6);
    });

    it('counts pfasDetections from pfas.results length', () => {
      const input = emptyInput();
      input.pfas = { results: [{}, {}, {}] };

      const result = computeWaterRiskScore(input);
      expect(result.details.pfasDetections).toBe(3);
    });

    it('counts triFacilities from tri array length', () => {
      const input = emptyInput();
      input.tri = [{}, {}, {}, {}, {}];

      const result = computeWaterRiskScore(input);
      expect(result.details.triFacilities).toBe(5);
    });

    it('counts impairments from attains.impaired', () => {
      const input = emptyInput();
      input.attains = { impaired: 7, total: 12, topCauses: ['Nitrogen'] };

      const result = computeWaterRiskScore(input);
      expect(result.details.impairments).toBe(7);
    });
  });

  // ── dataSources populated when data present ────────────────────────────────

  describe('dataSources', () => {
    it('includes WQP when wqpGrade is gradable', () => {
      const input = emptyInput();
      input.wqpGrade = { canBeGraded: true, score: 80, letter: 'B-', gradedParamCount: 3, gradedParamTotal: 7 } as any;

      const result = computeWaterRiskScore(input);
      expect(result.dataSources).toContain('EPA Water Quality Portal');
    });

    it('does not include WQP when canBeGraded is false', () => {
      const input = emptyInput();
      input.wqpGrade = { canBeGraded: false, score: null, letter: 'F', gradedParamCount: 0, gradedParamTotal: 7 } as any;

      const result = computeWaterRiskScore(input);
      expect(result.dataSources).not.toContain('EPA Water Quality Portal');
    });

    it('includes SDWIS when sdwis is present', () => {
      const input = emptyInput();
      input.sdwis = { systems: [], violations: [], enforcement: [] };

      const result = computeWaterRiskScore(input);
      expect(result.dataSources).toContain('EPA SDWIS (Safe Drinking Water)');
    });

    it('includes ICIS when icis is present', () => {
      const input = emptyInput();
      input.icis = { permits: [], violations: [] };

      const result = computeWaterRiskScore(input);
      expect(result.dataSources).toContain('EPA ICIS-NPDES (Permits)');
    });

    it('includes ECHO when echo is present', () => {
      const input = emptyInput();
      input.echo = { facilities: [], violations: [] };

      const result = computeWaterRiskScore(input);
      expect(result.dataSources).toContain('EPA ECHO (Enforcement)');
    });

    it('includes PFAS when pfas is present', () => {
      const input = emptyInput();
      input.pfas = { results: [] };

      const result = computeWaterRiskScore(input);
      expect(result.dataSources).toContain('EPA PFAS Analytic Tools');
    });

    it('includes TRI when tri is present', () => {
      const input = emptyInput();
      input.tri = [];

      const result = computeWaterRiskScore(input);
      expect(result.dataSources).toContain('EPA Toxics Release Inventory');
    });

    it('includes ATTAINS when attains is present', () => {
      const input = emptyInput();
      input.attains = { impaired: 2, total: 5, topCauses: [] };

      const result = computeWaterRiskScore(input);
      expect(result.dataSources).toContain('EPA ATTAINS (Impaired Waters)');
    });

    it('includes EJScreen when ejscreen is present', () => {
      const input = emptyInput();
      input.ejscreen = { EJINDEX: 50 };

      const result = computeWaterRiskScore(input);
      expect(result.dataSources).toContain('EPA EJScreen');
    });

    it('includes EJScreen fallback label when _degraded flag set', () => {
      const input = emptyInput();
      input.ejscreen = { _degraded: true };

      const result = computeWaterRiskScore(input);
      expect(result.dataSources).toContain('Census ACS / SDWIS (EJScreen fallback)');
    });

    it('includes PEARL HUC-8 Indices when hucIndices is present', () => {
      const input = emptyInput();
      input.hucIndices = {
        infrastructureFailure: { value: 30, confidence: 50, trend: 'stable' },
      } as any;

      const result = computeWaterRiskScore(input);
      expect(result.dataSources).toContain('PEARL HUC-8 Indices');
    });

    it('populates multiple sources when multiple data present', () => {
      const result = computeWaterRiskScore(highScoreInput());
      expect(result.dataSources.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ── Category weight impact ─────────────────────────────────────────────────

  describe('category weight impact', () => {
    it('changing waterQuality (0.30) has more impact than environmentalJustice (0.15)', () => {
      // Baseline: both at neutral 50
      const baseline = emptyInput();
      const baselineResult = computeWaterRiskScore(baseline);

      // Boost waterQuality to 95 via wqpGrade
      const wqBoost = emptyInput();
      wqBoost.wqpGrade = { canBeGraded: true, score: 95, letter: 'A', gradedParamCount: 6, gradedParamTotal: 7 } as any;
      const wqResult = computeWaterRiskScore(wqBoost);

      // Boost EJ to a high score via hucIndices
      const ejBoost = emptyInput();
      ejBoost.hucIndices = { ejVulnerability: { value: 5, confidence: 70, trend: 'stable' } } as any;
      const ejResult = computeWaterRiskScore(ejBoost);

      const wqDelta = wqResult.composite.score - baselineResult.composite.score;
      const ejDelta = ejResult.composite.score - baselineResult.composite.score;

      // waterQuality weight (0.30) should cause a larger delta than EJ weight (0.15)
      expect(wqDelta).toBeGreaterThan(ejDelta);
    });

    it('waterQuality at weight 0.30 dominates compliance at 0.20', () => {
      // Both boosted from 50 to ~90+
      const wqBoost = emptyInput();
      wqBoost.wqpGrade = { canBeGraded: true, score: 95, letter: 'A', gradedParamCount: 6, gradedParamTotal: 7 } as any;
      const wqResult = computeWaterRiskScore(wqBoost);

      const compBoost = emptyInput();
      compBoost.hucIndices = { permitRiskExposure: { value: 5, confidence: 70, trend: 'stable' } } as any;
      // Also add permits with no violations to boost compliance
      compBoost.icis = { permits: [{}], violations: [], enforcement: [] };
      const compResult = computeWaterRiskScore(compBoost);

      const baseline = computeWaterRiskScore(emptyInput());
      const wqDelta = wqResult.composite.score - baseline.composite.score;
      const compDelta = compResult.composite.score - baseline.composite.score;

      expect(wqDelta).toBeGreaterThan(compDelta);
    });
  });

  // ── Observations and implications ──────────────────────────────────────────

  describe('observations and implications', () => {
    it('includes a composite-level observation', () => {
      const result = computeWaterRiskScore(highScoreInput());
      expect(result.details.observations.length).toBeGreaterThan(0);
      const compositeObs = result.details.observations[0];
      expect(compositeObs.text).toContain('water risk score');
    });

    it('flags critical categories in observations', () => {
      const result = computeWaterRiskScore(lowScoreInput());
      const criticalObs = result.details.observations.filter(o => o.severity === 'critical');
      expect(criticalObs.length).toBeGreaterThan(0);
    });

    it('generates PFAS implication when PFAS detected', () => {
      const input = emptyInput();
      input.pfas = { results: [{}] };

      const result = computeWaterRiskScore(input);
      const pfasImplication = result.details.implications.find(i => i.text.includes('PFAS'));
      expect(pfasImplication).toBeDefined();
    });

    it('generates violation implication when > 5 total violations', () => {
      const input = emptyInput();
      input.sdwis = { systems: [{}], violations: [{}, {}, {}], enforcement: [] };
      input.icis = { permits: [{}], violations: [{}, {}, {}], enforcement: [] };
      // total = 3 + 3 = 6 > 5

      const result = computeWaterRiskScore(input);
      const violImplication = result.details.implications.find(i => i.text.includes('violations'));
      expect(violImplication).toBeDefined();
    });
  });

  // ── Contamination sub-scoring ──────────────────────────────────────────────

  describe('contamination category', () => {
    it('scores 90 when PFAS, TRI, and ECHO all have zero issues', () => {
      const input = emptyInput();
      input.pfas = { results: [] };
      input.tri = [];
      input.echo = { facilities: [], violations: [] };

      const result = computeWaterRiskScore(input);
      expect(result.categories.contamination.score).toBe(90);
    });

    it('decreases with more PFAS detections', () => {
      const clean = emptyInput();
      clean.pfas = { results: [] };

      const dirty = emptyInput();
      dirty.pfas = { results: [{}, {}, {}, {}, {}, {}, {}, {}] };

      const cleanResult = computeWaterRiskScore(clean);
      const dirtyResult = computeWaterRiskScore(dirty);

      expect(dirtyResult.categories.contamination.score).toBeLessThan(
        cleanResult.categories.contamination.score,
      );
    });
  });

  // ── ATTAINS fallback for waterQuality when wqpGrade is null ────────────────

  describe('ATTAINS fallback for waterQuality', () => {
    it('uses ATTAINS ratio when wqpGrade is null but attains present', () => {
      const input = emptyInput();
      input.attains = { impaired: 2, total: 10, topCauses: ['Sediment'] };

      const result = computeWaterRiskScore(input);
      // ratio = 1 - 2/10 = 0.8 → score = 80
      expect(result.categories.waterQuality.score).toBe(80);
    });

    it('scores low when most waterbodies impaired', () => {
      const input = emptyInput();
      input.attains = { impaired: 9, total: 10, topCauses: ['Nutrients'] };

      const result = computeWaterRiskScore(input);
      // ratio = 1 - 9/10 = 0.1 → score = 10
      expect(result.categories.waterQuality.score).toBe(10);
    });
  });

  // ── Compliance scoring ─────────────────────────────────────────────────────

  describe('compliance category', () => {
    it('gets a bonus when permits exist but no violations', () => {
      const input = emptyInput();
      input.icis = { permits: [{}], violations: [] };

      const result = computeWaterRiskScore(input);
      // 50 (base) + 5 (clean permit bonus) = 55
      expect(result.categories.compliance.score).toBe(55);
    });

    it('penalizes NPDES violations', () => {
      const input = emptyInput();
      input.icis = { permits: [{}], violations: [{}, {}, {}] };

      const result = computeWaterRiskScore(input);
      // 50 - min(25, 3*4) = 50 - 12 = 38
      expect(result.categories.compliance.score).toBe(38);
    });

    it('penalizes enforcement actions', () => {
      const input = emptyInput();
      input.icis = { permits: [{}], violations: [], enforcement: [{}, {}] };

      const result = computeWaterRiskScore(input);
      // 50 + 5 (clean permits) - min(10, 2*3) = 55 - 6 = 49
      expect(result.categories.compliance.score).toBe(49);
    });
  });

  // ── Infrastructure scoring ─────────────────────────────────────────────────

  describe('infrastructure category', () => {
    it('inverts HUC index: low infrastructure failure index => high score', () => {
      const input = emptyInput();
      input.hucIndices = { infrastructureFailure: { value: 10, confidence: 70, trend: 'stable' } } as any;

      const result = computeWaterRiskScore(input);
      expect(result.categories.infrastructure.score).toBe(90);
    });

    it('penalizes SDWIS violations', () => {
      const input = emptyInput();
      input.sdwis = { systems: [{}], violations: [{}, {}, {}], enforcement: [] };

      const result = computeWaterRiskScore(input);
      // base 50, penalty = min(20, 3*3) = 9 → 50 - 9 = 41
      expect(result.categories.infrastructure.score).toBe(41);
    });
  });

  // ── Score clamping ─────────────────────────────────────────────────────────

  describe('score clamping', () => {
    it('composite score is always between 0 and 100', () => {
      const inputs = [emptyInput(), highScoreInput(), lowScoreInput()];
      for (const input of inputs) {
        const result = computeWaterRiskScore(input);
        expect(result.composite.score).toBeGreaterThanOrEqual(0);
        expect(result.composite.score).toBeLessThanOrEqual(100);
      }
    });

    it('category scores are always between 0 and 100', () => {
      const result = computeWaterRiskScore(lowScoreInput());
      for (const key of Object.keys(result.categories) as Array<keyof typeof result.categories>) {
        expect(result.categories[key].score).toBeGreaterThanOrEqual(0);
        expect(result.categories[key].score).toBeLessThanOrEqual(100);
      }
    });
  });
});
