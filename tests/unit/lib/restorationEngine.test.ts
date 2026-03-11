import { describe, it, expect } from 'vitest';
import {
  computeRestorationPlan,
  resolveAttainsCategory,
  mergeAttainsCauses,
  type RestorationInput,
} from '@/lib/restorationEngine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a healthy waterbody input (no impairment, good params). */
function healthyInput(): RestorationInput {
  return {
    regionName: 'Test Creek',
    stateAbbr: 'VA',
    alertLevel: 'none',
    params: {
      DO: { value: 8.5, lastSampled: new Date().toISOString(), unit: 'mg/L' },
      chlorophyll: { value: 5, lastSampled: new Date().toISOString(), unit: 'ug/L' },
      turbidity: { value: 3, lastSampled: new Date().toISOString(), unit: 'FNU' },
      TN: { value: 0.5, lastSampled: new Date().toISOString(), unit: 'mg/L' },
      TP: { value: 0.03, lastSampled: new Date().toISOString(), unit: 'mg/L' },
    },
    attainsCategory: '',
    attainsCauses: [],
    attainsCycle: '2022',
  };
}

/** Build a critical waterbody input (Cat 5, high alert, bad params). */
function criticalInput(): RestorationInput {
  return {
    regionName: 'Polluted River',
    stateAbbr: 'VA',
    alertLevel: 'high',
    params: {
      DO: { value: 2.5, lastSampled: new Date().toISOString(), unit: 'mg/L' },
      chlorophyll: { value: 120, lastSampled: new Date().toISOString(), unit: 'ug/L' },
      turbidity: { value: 30, lastSampled: new Date().toISOString(), unit: 'FNU' },
      TN: { value: 4.0, lastSampled: new Date().toISOString(), unit: 'mg/L' },
      TP: { value: 0.5, lastSampled: new Date().toISOString(), unit: 'mg/L' },
    },
    attainsCategory: '5',
    attainsCauses: ['Nitrogen', 'Sediment', 'Phosphorus'],
    attainsCycle: '2022',
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('restorationEngine', () => {
  // ── resolveAttainsCategory ──────────────────────────────────────────────────

  describe('resolveAttainsCategory', () => {
    it('returns bulk category when perWb is empty', () => {
      expect(resolveAttainsCategory('', '5', 'high')).toBe('5');
    });

    it('returns worse of perWb and level-derived category', () => {
      // perWb is '4A', alertLevel 'medium' → derived '4'
      // '4A' contains '4', derived '4' contains '4' → both are numeric 4
      // They tie at 4, so worst = whichever has higher numeric = same
      const result = resolveAttainsCategory('4A', '', 'medium');
      // Both candidates have numeric 4, so result should be one of them
      expect(result).toMatch(/4/);
    });

    it('returns empty string when all sources are empty and alertLevel is none', () => {
      expect(resolveAttainsCategory('', '', 'none')).toBe('');
    });

    it('picks highest numeric category among all three sources', () => {
      // perWb='3', bulk='4A', alertLevel='high' → derived='5'
      expect(resolveAttainsCategory('3', '4A', 'high')).toBe('5');
    });

    it('returns perWb when it is the worst', () => {
      expect(resolveAttainsCategory('5', '3', 'low')).toBe('5');
    });

    it('returns bulk when it is the worst', () => {
      expect(resolveAttainsCategory('2', '5', 'low')).toBe('5');
    });

    it('derives category 5 from alertLevel high', () => {
      expect(resolveAttainsCategory('', '', 'high')).toBe('5');
    });

    it('derives category 4 from alertLevel medium', () => {
      expect(resolveAttainsCategory('', '', 'medium')).toBe('4');
    });

    it('derives nothing from alertLevel low', () => {
      // 'low' maps to '' which has no digit → not a candidate
      expect(resolveAttainsCategory('', '', 'low')).toBe('');
    });
  });

  // ── mergeAttainsCauses ──────────────────────────────────────────────────────

  describe('mergeAttainsCauses', () => {
    it('returns deduplicated union when both non-empty', () => {
      const result = mergeAttainsCauses(
        ['Nitrogen', 'Phosphorus'],
        ['Phosphorus', 'Sediment'],
      );
      expect(result).toHaveLength(3);
      expect(result).toEqual(expect.arrayContaining(['Nitrogen', 'Phosphorus', 'Sediment']));
    });

    it('returns perWb causes when bulk is empty', () => {
      const result = mergeAttainsCauses(['Nitrogen', 'Sediment'], []);
      expect(result).toEqual(['Nitrogen', 'Sediment']);
    });

    it('returns bulk causes when perWb is empty', () => {
      const result = mergeAttainsCauses([], ['Mercury', 'Temperature']);
      expect(result).toEqual(['Mercury', 'Temperature']);
    });

    it('returns empty array when both are empty', () => {
      const result = mergeAttainsCauses([], []);
      expect(result).toEqual([]);
    });

    it('deduplicates identical causes', () => {
      const result = mergeAttainsCauses(['Nitrogen'], ['Nitrogen']);
      expect(result).toEqual(['Nitrogen']);
    });
  });

  // ── computeRestorationPlan — Healthy waterbody ─────────────────────────────

  describe('healthy waterbody', () => {
    it('isHealthy is true', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.isHealthy).toBe(true);
    });

    it('siteSeverityLabel is FAIR', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.siteSeverityLabel).toBe('FAIR');
    });

    it('isCat5 is false', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.isCat5).toBe(false);
    });

    it('isImpaired is false', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.isImpaired).toBe(false);
    });

    it('doSeverity is adequate', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.doSeverity).toBe('adequate');
    });

    it('bloomSeverity is normal', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.bloomSeverity).toBe('normal');
    });

    it('turbiditySeverity is clear', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.turbiditySeverity).toBe('clear');
    });

    it('nutrientSeverity is normal', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.nutrientSeverity).toBe('normal');
    });

    it('has no impairment causes', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.attainsCauses).toHaveLength(0);
      expect(result.impairmentClassification).toHaveLength(0);
    });

    it('tmdlStatus is na', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.tmdlStatus).toBe('na');
    });
  });

  // ── computeRestorationPlan — Critical site ─────────────────────────────────

  describe('critical site', () => {
    it('isCat5 is true', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.isCat5).toBe(true);
    });

    it('isImpaired is true', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.isImpaired).toBe(true);
    });

    it('doSeverity is critical (DO=2.5 < 4.0 EPA threshold)', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.doSeverity).toBe('critical');
    });

    it('bloomSeverity is severe (chlorophyll=120 > 60 EPA threshold)', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.bloomSeverity).toBe('severe');
    });

    it('turbiditySeverity is impaired (turbidity=30 > 25 EPA threshold)', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.turbiditySeverity).toBe('impaired');
    });

    it('nutrientSeverity is excessive (TN=4 > 3, TP=0.5 > 0.3)', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.nutrientSeverity).toBe('excessive');
    });

    it('siteSeverityLabel is CRITICAL', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.siteSeverityLabel).toBe('CRITICAL');
    });

    it('isHealthy is false', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.isHealthy).toBe(false);
    });

    it('tmdlStatus is needed for Cat 5', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.tmdlStatus).toBe('needed');
    });

    it('hasNutrients is true (Nitrogen and Phosphorus causes)', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.hasNutrients).toBe(true);
    });

    it('hasSediment is true (Sediment cause)', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.hasSediment).toBe(true);
    });

    it('nutrientExceedsBiofilt is true (TN > 3.0)', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.nutrientExceedsBiofilt).toBe(true);
    });

    it('raw parameter values are captured', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.doVal).toBe(2.5);
      expect(result.chlVal).toBe(120);
      expect(result.turbVal).toBe(30);
      expect(result.tnVal).toBe(4.0);
      expect(result.tpVal).toBe(0.5);
    });

    it('impairmentClassification has entries for all 3 causes', () => {
      const result = computeRestorationPlan(criticalInput());
      // Nitrogen → tier 1, Sediment → tier 1, Phosphorus → tier 1
      // Plus possible inferred habitat
      expect(result.impairmentClassification.length).toBeGreaterThanOrEqual(3);
    });

    it('tier1Count >= 3 for directly treatable causes', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.tier1Count).toBeGreaterThanOrEqual(3);
    });
  });

  // ── MD-specific thresholds ─────────────────────────────────────────────────

  describe('MD-specific thresholds', () => {
    it('uses MD DNR thresholds when stateAbbr is MD', () => {
      const input = healthyInput();
      input.stateAbbr = 'MD';

      const result = computeRestorationPlan(input);
      expect(result.isMD).toBe(true);
      expect(result.doCritical).toBe(3.2);
      expect(result.doStressed).toBe(5.0);
      expect(result.chlBloom).toBe(15);
      expect(result.chlSignificant).toBe(50);
      expect(result.chlSevere).toBe(100);
      expect(result.turbElevated).toBe(7);
      expect(result.turbImpaired).toBe(20);
      expect(result.thresholdSourceShort).toBe('MD DNR');
    });

    it('MD: DO=3.5 is stressed (above 3.2 MD critical, below 5.0 stressed)', () => {
      const input = healthyInput();
      input.stateAbbr = 'MD';
      input.params.DO = { value: 3.5, lastSampled: new Date().toISOString() };

      const result = computeRestorationPlan(input);
      expect(result.doSeverity).toBe('stressed');
    });

    it('MD: DO=3.0 is critical (below 3.2 MD threshold)', () => {
      const input = healthyInput();
      input.stateAbbr = 'MD';
      input.params.DO = { value: 3.0, lastSampled: new Date().toISOString() };

      const result = computeRestorationPlan(input);
      expect(result.doSeverity).toBe('critical');
    });

    it('MD: chlorophyll=18 is bloom (above 15 MD threshold)', () => {
      const input = healthyInput();
      input.stateAbbr = 'MD';
      input.params.chlorophyll = { value: 18, lastSampled: new Date().toISOString() };

      const result = computeRestorationPlan(input);
      expect(result.bloomSeverity).toBe('bloom');
    });

    it('MD: turbidity=10 is elevated (above 7 MD threshold)', () => {
      const input = healthyInput();
      input.stateAbbr = 'MD';
      input.params.turbidity = { value: 10, lastSampled: new Date().toISOString() };

      const result = computeRestorationPlan(input);
      expect(result.turbiditySeverity).toBe('elevated');
    });
  });

  // ── EPA default thresholds (non-MD state) ──────────────────────────────────

  describe('EPA default thresholds', () => {
    it('uses EPA thresholds when stateAbbr is VA', () => {
      const input = healthyInput();
      input.stateAbbr = 'VA';

      const result = computeRestorationPlan(input);
      expect(result.isMD).toBe(false);
      expect(result.doCritical).toBe(4.0);
      expect(result.chlBloom).toBe(20);
      expect(result.chlSignificant).toBe(40);
      expect(result.chlSevere).toBe(60);
      expect(result.turbElevated).toBe(10);
      expect(result.turbImpaired).toBe(25);
      expect(result.thresholdSourceShort).toBe('EPA');
    });

    it('EPA: DO=3.5 is critical (below 4.0 EPA threshold)', () => {
      const input = healthyInput();
      input.stateAbbr = 'VA';
      input.params.DO = { value: 3.5, lastSampled: new Date().toISOString() };

      const result = computeRestorationPlan(input);
      expect(result.doSeverity).toBe('critical');
    });

    it('EPA: DO=4.5 is stressed (between 4.0 and 5.0)', () => {
      const input = healthyInput();
      input.stateAbbr = 'VA';
      input.params.DO = { value: 4.5, lastSampled: new Date().toISOString() };

      const result = computeRestorationPlan(input);
      expect(result.doSeverity).toBe('stressed');
    });

    it('EPA: chlorophyll=18 is normal (below 20 EPA threshold)', () => {
      const input = healthyInput();
      input.stateAbbr = 'VA';
      input.params.chlorophyll = { value: 18, lastSampled: new Date().toISOString() };

      const result = computeRestorationPlan(input);
      expect(result.bloomSeverity).toBe('normal');
    });
  });

  // ── Habitat degradation inference ──────────────────────────────────────────

  describe('habitat degradation inference', () => {
    it('infers habitat when Cat5 site has stressed DO + bloom + elevated turbidity', () => {
      const input: RestorationInput = {
        regionName: 'Eutrophic Bay',
        stateAbbr: 'VA',
        alertLevel: 'high',
        params: {
          DO: { value: 3.5, lastSampled: new Date().toISOString() },
          chlorophyll: { value: 25, lastSampled: new Date().toISOString() },
          turbidity: { value: 15, lastSampled: new Date().toISOString() },
        },
        attainsCategory: '5',
        attainsCauses: ['Trash'],  // Only trash — no explicit habitat cause
        attainsCycle: '2022',
      };

      const result = computeRestorationPlan(input);
      // DO=3.5 < 4.0 → critical, chl=25 > 20 → bloom, turb=15 > 10 → elevated
      // All 3 eutrophication signals present, isCat5=true → habitat inferred
      expect(result.hasHabitat).toBe(true);
    });

    it('does not infer habitat if only 1 eutrophication signal', () => {
      const input: RestorationInput = {
        regionName: 'Mild Creek',
        stateAbbr: 'VA',
        alertLevel: 'high',
        params: {
          DO: { value: 3.5, lastSampled: new Date().toISOString() },
          chlorophyll: { value: 10, lastSampled: new Date().toISOString() },  // normal
          turbidity: { value: 5, lastSampled: new Date().toISOString() },     // clear
        },
        attainsCategory: '5',
        attainsCauses: ['Trash'],
        attainsCycle: '2022',
      };

      const result = computeRestorationPlan(input);
      // Only DO is impaired — not enough signals for habitat inference
      expect(result.hasHabitat).toBe(false);
    });

    it('does not infer habitat for non-Cat5 sites', () => {
      const input: RestorationInput = {
        regionName: 'Non-Cat5 Creek',
        stateAbbr: 'VA',
        alertLevel: 'none',
        params: {
          DO: { value: 3.5, lastSampled: new Date().toISOString() },
          chlorophyll: { value: 25, lastSampled: new Date().toISOString() },
          turbidity: { value: 15, lastSampled: new Date().toISOString() },
        },
        attainsCategory: '3',
        attainsCauses: [],
        attainsCycle: '2022',
      };

      const result = computeRestorationPlan(input);
      // Not Cat5 and alertLevel is 'none' → isCat5 is false → no habitat inference
      expect(result.hasHabitat).toBe(false);
    });

    it('adds inferred habitat cause to impairmentClassification', () => {
      const input: RestorationInput = {
        regionName: 'Eutrophic Bay',
        stateAbbr: 'VA',
        alertLevel: 'high',
        params: {
          DO: { value: 3.0, lastSampled: new Date().toISOString() },
          chlorophyll: { value: 65, lastSampled: new Date().toISOString() },
          turbidity: { value: 30, lastSampled: new Date().toISOString() },
        },
        attainsCategory: '5',
        attainsCauses: ['Nitrogen'],
        attainsCycle: '2022',
      };

      const result = computeRestorationPlan(input);
      expect(result.hasHabitat).toBe(true);
      const habitatItem = result.impairmentClassification.find(
        i => i.cause.includes('Habitat Degradation (inferred'),
      );
      expect(habitatItem).toBeDefined();
      expect(habitatItem!.tier).toBe(2);
    });
  });

  // ── Treatment priorities ───────────────────────────────────────────────────

  describe('treatment priorities', () => {
    it('sorted by rank (ascending)', () => {
      const result = computeRestorationPlan(criticalInput());
      const ranks = result.treatmentPriorities.map(p => p.rank);
      for (let i = 1; i < ranks.length; i++) {
        expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1]);
      }
    });

    it('critical site has immediate urgency priorities', () => {
      const result = computeRestorationPlan(criticalInput());
      const immediatePriorities = result.treatmentPriorities.filter(p => p.urgency === 'immediate');
      expect(immediatePriorities.length).toBeGreaterThan(0);
    });

    it('healthy site has fewer / lower urgency priorities', () => {
      const result = computeRestorationPlan(healthyInput());
      const immediatePriorities = result.treatmentPriorities.filter(p => p.urgency === 'immediate');
      expect(immediatePriorities).toHaveLength(0);
    });

    it('includes DO priority for critical DO', () => {
      const result = computeRestorationPlan(criticalInput());
      const doPriority = result.treatmentPriorities.find(p => p.driver.includes('DO'));
      expect(doPriority).toBeDefined();
      expect(doPriority!.urgency).toBe('immediate');
    });

    it('includes bloom priority for severe chlorophyll', () => {
      const result = computeRestorationPlan(criticalInput());
      const bloomPriority = result.treatmentPriorities.find(p => p.driver.includes('bloom') || p.driver.includes('Algal'));
      expect(bloomPriority).toBeDefined();
    });

    it('includes turbidity priority for impaired turbidity', () => {
      const result = computeRestorationPlan(criticalInput());
      const turbPriority = result.treatmentPriorities.find(p => p.driver.includes('Turbidity') || p.driver.includes('turbidity'));
      expect(turbPriority).toBeDefined();
    });
  });

  // ── Impairment classification tiers ────────────────────────────────────────

  describe('impairment classification', () => {
    it('classifies Nitrogen as tier 1 (Directly Treatable)', () => {
      const input = healthyInput();
      input.attainsCauses = ['Nitrogen'];
      input.alertLevel = 'medium';

      const result = computeRestorationPlan(input);
      const nitrogenItem = result.impairmentClassification.find(i => i.cause === 'Nitrogen');
      expect(nitrogenItem).toBeDefined();
      expect(nitrogenItem!.tier).toBe(1);
    });

    it('classifies Mercury as tier 3 (Requires Different Intervention)', () => {
      const input = healthyInput();
      input.attainsCauses = ['Mercury'];
      input.alertLevel = 'medium';

      const result = computeRestorationPlan(input);
      const mercuryItem = result.impairmentClassification.find(i => i.cause === 'Mercury');
      expect(mercuryItem).toBeDefined();
      expect(mercuryItem!.tier).toBe(3);
    });

    it('classifies Dissolved Oxygen as tier 2 (Indirect/Supporting)', () => {
      const input = healthyInput();
      input.attainsCauses = ['Dissolved Oxygen'];
      input.alertLevel = 'medium';

      const result = computeRestorationPlan(input);
      const doItem = result.impairmentClassification.find(i => i.cause === 'Dissolved Oxygen');
      expect(doItem).toBeDefined();
      expect(doItem!.tier).toBe(2);
    });

    it('classifies Temperature as tier 3', () => {
      const input = healthyInput();
      input.attainsCauses = ['Temperature'];
      input.alertLevel = 'medium';

      const result = computeRestorationPlan(input);
      const tempItem = result.impairmentClassification.find(i => i.cause === 'Temperature');
      expect(tempItem).toBeDefined();
      expect(tempItem!.tier).toBe(3);
    });

    it('skips CAUSE UNKNOWN entries', () => {
      const input = healthyInput();
      input.attainsCauses = ['Cause Unknown', 'Nitrogen'];
      input.alertLevel = 'medium';

      const result = computeRestorationPlan(input);
      const unknownItem = result.impairmentClassification.find(i => i.cause === 'Cause Unknown');
      expect(unknownItem).toBeUndefined();
      expect(result.impairmentClassification).toHaveLength(1);
    });

    it('addressabilityPct only counts tier1 + tier2', () => {
      const input = healthyInput();
      input.attainsCauses = ['Nitrogen', 'Mercury', 'Sediment', 'Temperature'];
      input.alertLevel = 'high';

      const result = computeRestorationPlan(input);
      // Nitrogen → T1, Mercury → T3, Sediment → T1, Temperature → T3
      // Plus possible inferred habitat (T2) if DO/bloom/turb signals present
      expect(result.pearlAddressable).toBe(result.tier1Count + result.tier2Count);
      expect(result.addressabilityPct).toBe(
        Math.round((result.pearlAddressable / result.totalClassified) * 100),
      );
    });
  });

  // ── TMDL status ────────────────────────────────────────────────────────────

  describe('tmdlStatus', () => {
    it('returns needed for Cat 5', () => {
      const input = healthyInput();
      input.attainsCategory = '5';
      input.alertLevel = 'high';

      const result = computeRestorationPlan(input);
      expect(result.tmdlStatus).toBe('needed');
    });

    it('returns completed for Cat 4A', () => {
      const input = healthyInput();
      input.attainsCategory = '4A';
      input.alertLevel = 'medium';

      const result = computeRestorationPlan(input);
      expect(result.tmdlStatus).toBe('completed');
    });

    it('returns alternative for Cat 4B', () => {
      const input = healthyInput();
      input.attainsCategory = '4B';
      input.alertLevel = 'medium';

      const result = computeRestorationPlan(input);
      expect(result.tmdlStatus).toBe('alternative');
    });

    it('returns na for non-impaired categories', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.tmdlStatus).toBe('na');
    });
  });

  // ── Waterbody type detection ───────────────────────────────────────────────

  describe('waterbody type', () => {
    it('detects freshwater by default', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.waterType).toBe('freshwater');
    });

    it('detects brackish when salinity > 0.5', () => {
      const input = healthyInput();
      input.params.salinity = { value: 2.5, lastSampled: new Date().toISOString() };

      const result = computeRestorationPlan(input);
      expect(result.waterType).toBe('brackish');
    });

    it('detects brackish when conductivity > 1000', () => {
      const input = healthyInput();
      input.params.conductivity = { value: 1500, lastSampled: new Date().toISOString() };

      const result = computeRestorationPlan(input);
      expect(result.waterType).toBe('brackish');
    });
  });

  // ── Restoration categories structure ───────────────────────────────────────

  describe('restoration categories', () => {
    it('always returns 5 categories', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.categories).toHaveLength(5);
    });

    it('category ids are source, nature, pearl, community, regulatory', () => {
      const result = computeRestorationPlan(healthyInput());
      const ids = result.categories.map(c => c.id);
      expect(ids).toEqual(['source', 'nature', 'pearl', 'community', 'regulatory']);
    });

    it('each category has non-empty modules', () => {
      const result = computeRestorationPlan(healthyInput());
      for (const cat of result.categories) {
        expect(cat.modules.length).toBeGreaterThan(0);
      }
    });

    it('TMDL development module appears in regulatory for Cat 5', () => {
      const result = computeRestorationPlan(criticalInput());
      const regulatory = result.categories.find(c => c.id === 'regulatory');
      const tmdlModule = regulatory?.modules.find(m => m.id === 'tmdl-dev');
      expect(tmdlModule).toBeDefined();
      expect(tmdlModule!.status).toBe('warranted');
    });
  });

  // ── Sizing & cost model ────────────────────────────────────────────────────

  describe('sizing and cost', () => {
    it('critical sites get more quads than healthy ones', () => {
      const healthyResult = computeRestorationPlan(healthyInput());
      const criticalResult = computeRestorationPlan(criticalInput());

      expect(criticalResult.totalQuads).toBeGreaterThan(healthyResult.totalQuads);
    });

    it('totalUnits = totalQuads * 4', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.totalUnits).toBe(result.totalQuads * 4);
    });

    it('phase1Units = phase1Quads * 4', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.phase1Units).toBe(result.phase1Quads * 4);
    });

    it('fullAnnualCost = totalUnits * COST_PER_UNIT_YEAR', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.fullAnnualCost).toBe(result.totalUnits * 200000);
    });

    it('isPhasedDeployment is true when totalQuads > 1', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.totalQuads).toBeGreaterThan(1);
      expect(result.isPhasedDeployment).toBe(true);
    });

    it('estimatedAcres defaults to 50 for freshwater when no ATTAINS acres', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.estimatedAcres).toBe(50);
      expect(result.acresSource).toBe('estimated');
    });

    it('uses ATTAINS acres when provided', () => {
      const input = healthyInput();
      input.attainsAcres = 300;

      const result = computeRestorationPlan(input);
      expect(result.estimatedAcres).toBe(300);
      expect(result.acresSource).toBe('ATTAINS');
    });
  });

  // ── Data freshness ─────────────────────────────────────────────────────────

  describe('data freshness', () => {
    it('returns high confidence for recent data', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.dataConfidence).toBe('high');
      expect(result.dataAgeDays).not.toBeNull();
      expect(result.dataAgeDays!).toBeLessThanOrEqual(1);
    });

    it('returns unknown confidence when no lastSampled timestamps', () => {
      const input = healthyInput();
      input.params = {
        DO: { value: 8.0 },
        turbidity: { value: 3 },
      };

      const result = computeRestorationPlan(input);
      expect(result.dataConfidence).toBe('unknown');
      expect(result.dataAgeDays).toBeNull();
    });
  });

  // ── Cause flag detection ───────────────────────────────────────────────────

  describe('cause flag detection', () => {
    it('detects bacteria from E. coli cause', () => {
      const input = healthyInput();
      input.attainsCauses = ['E. Coli'];
      input.alertLevel = 'medium';

      const result = computeRestorationPlan(input);
      expect(result.hasBacteria).toBe(true);
    });

    it('detects PFAS from PFOS cause', () => {
      const input = healthyInput();
      input.attainsCauses = ['PFOS'];
      input.alertLevel = 'medium';

      const result = computeRestorationPlan(input);
      expect(result.hasPFAS).toBe(true);
    });

    it('detects PCBs from polychlorinated cause', () => {
      const input = healthyInput();
      input.attainsCauses = ['Polychlorinated Biphenyls'];
      input.alertLevel = 'medium';

      const result = computeRestorationPlan(input);
      expect(result.hasPCBs).toBe(true);
    });

    it('detects temperature from thermal cause', () => {
      const input = healthyInput();
      input.attainsCauses = ['Thermal Modifications'];
      input.alertLevel = 'medium';

      const result = computeRestorationPlan(input);
      expect(result.hasTemperature).toBe(true);
    });

    it('detects trash from debris cause', () => {
      const input = healthyInput();
      input.attainsCauses = ['Debris'];
      input.alertLevel = 'medium';

      const result = computeRestorationPlan(input);
      expect(result.hasTrash).toBe(true);
    });

    it('detects metals from Lead cause', () => {
      const input = healthyInput();
      input.attainsCauses = ['Lead'];
      input.alertLevel = 'medium';

      const result = computeRestorationPlan(input);
      expect(result.hasMetals).toBe(true);
      expect(result.hasStormwaterMetals).toBe(true);
    });
  });

  // ── whyBullets ─────────────────────────────────────────────────────────────

  describe('whyBullets', () => {
    it('healthy site has a minimal default bullet', () => {
      const result = computeRestorationPlan(healthyInput());
      expect(result.whyBullets.length).toBeGreaterThanOrEqual(1);
    });

    it('critical site has multiple problem bullets', () => {
      const result = computeRestorationPlan(criticalInput());
      expect(result.whyBullets.length).toBeGreaterThan(2);
    });

    it('includes bloom-crash DO cycle bullet when both are severe', () => {
      const result = computeRestorationPlan(criticalInput());
      const bloomCrash = result.whyBullets.find(b => b.problem.includes('Bloom-crash'));
      expect(bloomCrash).toBeDefined();
    });

    it('includes TMDL bullet for Cat 5 site', () => {
      const result = computeRestorationPlan(criticalInput());
      const tmdlBullet = result.whyBullets.find(b => b.problem.includes('TMDL'));
      expect(tmdlBullet).toBeDefined();
    });
  });
});
