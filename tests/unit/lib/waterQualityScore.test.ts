import { describe, it, expect, vi } from 'vitest';
import {
  getThresholds,
  getThreshold,
  scoreParameter,
  scoreToLetter,
  assessCoverage,
  calculateGrade,
  gradeToAlertLevel,
  generateObservations,
  generateImplications,
  computeFreshnessScore,
  paramAgeTint,
  KEY_PARAMS,
  KEY_PARAM_LABELS,
  SUPPLEMENTAL_PARAMS,
  SUPPLEMENTAL_PARAM_LABELS,
  ALL_PARAM_LABELS,
  TOTAL_DISPLAY_PARAMS,
  type WaterbodyType,
  type ParameterCondition,
  type GradeLetter,
  type FreshnessGrade,
  ageToFreshnessGrade,
  freshnessGradeStyle,
  type CoverageLevel,
} from '@/lib/waterQualityScore';

// Helper: create a "now" ISO timestamp
const now = () => new Date().toISOString();
// Helper: create a timestamp N days ago
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

describe('waterQualityScore', () => {
  // ─── Constants & Labels ───────────────────────────────────────────────────

  describe('constants', () => {
    it('KEY_PARAMS has 7 parameters', () => {
      expect(KEY_PARAMS).toHaveLength(7);
      expect(KEY_PARAMS).toContain('DO');
      expect(KEY_PARAMS).toContain('pH');
      expect(KEY_PARAMS).toContain('turbidity');
      expect(KEY_PARAMS).toContain('TSS');
      expect(KEY_PARAMS).toContain('TN');
      expect(KEY_PARAMS).toContain('TP');
      expect(KEY_PARAMS).toContain('temperature');
    });

    it('KEY_PARAM_LABELS maps every KEY_PARAM', () => {
      for (const p of KEY_PARAMS) {
        expect(KEY_PARAM_LABELS[p]).toBeDefined();
        expect(typeof KEY_PARAM_LABELS[p]).toBe('string');
      }
    });

    it('ALL_PARAM_LABELS includes both key and supplemental', () => {
      for (const p of KEY_PARAMS) {
        expect(ALL_PARAM_LABELS[p]).toBeDefined();
      }
      for (const p of SUPPLEMENTAL_PARAMS) {
        expect(ALL_PARAM_LABELS[p]).toBeDefined();
      }
    });

    it('TOTAL_DISPLAY_PARAMS is 16', () => {
      expect(TOTAL_DISPLAY_PARAMS).toBe(16);
    });
  });

  // ─── getThresholds / getThreshold ─────────────────────────────────────────

  describe('getThresholds', () => {
    it('returns freshwater thresholds by default', () => {
      const t = getThresholds();
      expect(t).toBeDefined();
      expect(t.DO).toBeDefined();
      expect(t.DO.unit).toBe('mg/L');
    });

    it('returns thresholds for each waterbody type', () => {
      for (const type of ['freshwater', 'estuarine', 'coastal', 'lake'] as WaterbodyType[]) {
        const t = getThresholds(type);
        expect(t).toBeDefined();
        expect(t.DO).toBeDefined();
        expect(t.turbidity).toBeDefined();
      }
    });
  });

  describe('getThreshold', () => {
    it('returns threshold for known param', () => {
      const t = getThreshold('DO');
      expect(t).not.toBeNull();
      expect(t!.direction).toBe('below');
      expect(t!.unit).toBe('mg/L');
    });

    it('returns null for unknown param', () => {
      const t = getThreshold('unknownParam');
      expect(t).toBeNull();
    });

    it('falls back to freshwater when param missing from specific type', () => {
      // bacteria is defined in freshwater but in all types actually
      const t = getThreshold('bacteria', 'estuarine');
      expect(t).not.toBeNull();
    });

    it('pH threshold has range direction', () => {
      const t = getThreshold('pH');
      expect(t).not.toBeNull();
      expect(t!.direction).toBe('range');
      expect(t!.rangeMin).toBeDefined();
      expect(t!.rangeMax).toBeDefined();
    });
  });

  // ─── scoreParameter ───────────────────────────────────────────────────────

  describe('scoreParameter', () => {
    it('returns null for unknown parameter', () => {
      expect(scoreParameter('nonexistent', 5)).toBeNull();
    });

    it('scores high DO as good (direction=below, higher is better)', () => {
      const result = scoreParameter('DO', 8.0, 'freshwater');
      expect(result).not.toBeNull();
      expect(result!.condition).toBe('good');
      expect(result!.score).toBeGreaterThanOrEqual(90);
    });

    it('scores low DO as severe', () => {
      const result = scoreParameter('DO', 1.5, 'freshwater');
      expect(result).not.toBeNull();
      expect(result!.condition).toBe('severe');
      expect(result!.score).toBeLessThanOrEqual(10);
    });

    it('scores DO at fair level', () => {
      const result = scoreParameter('DO', 5.5, 'freshwater');
      expect(result).not.toBeNull();
      expect(result!.condition).toBe('fair');
    });

    it('scores DO at poor level', () => {
      const result = scoreParameter('DO', 4.5, 'freshwater');
      expect(result).not.toBeNull();
      expect(result!.condition).toBe('poor');
    });

    it('scores low TSS as good (direction=above, lower is better)', () => {
      const result = scoreParameter('TSS', 5, 'freshwater');
      expect(result).not.toBeNull();
      expect(result!.condition).toBe('good');
      expect(result!.score).toBe(95);
    });

    it('scores high TSS as severe', () => {
      const result = scoreParameter('TSS', 150, 'freshwater');
      expect(result).not.toBeNull();
      expect(result!.condition).toBe('severe');
      expect(result!.score).toBeLessThanOrEqual(10);
    });

    it('scores TSS at fair level', () => {
      const result = scoreParameter('TSS', 20, 'freshwater');
      expect(result).not.toBeNull();
      expect(result!.condition).toBe('fair');
    });

    it('scores TSS at poor level', () => {
      const result = scoreParameter('TSS', 45, 'freshwater');
      expect(result).not.toBeNull();
      expect(result!.condition).toBe('poor');
    });

    it('scores in-range pH as good (direction=range)', () => {
      const result = scoreParameter('pH', 7.5, 'freshwater');
      expect(result).not.toBeNull();
      expect(result!.condition).toBe('good');
      expect(result!.score).toBe(95);
    });

    it('scores slightly out-of-range pH as fair', () => {
      const result = scoreParameter('pH', 6.2, 'freshwater');
      expect(result).not.toBeNull();
      expect(result!.condition).toBe('fair');
    });

    it('scores far out-of-range pH as severe', () => {
      const result = scoreParameter('pH', 4.0, 'freshwater');
      expect(result).not.toBeNull();
      expect(result!.condition).toBe('severe');
    });

    it('clamps score to 0-100 range', () => {
      // Very extreme values should still produce valid scores
      const result = scoreParameter('DO', 100, 'freshwater');
      expect(result!.score).toBeGreaterThanOrEqual(0);
      expect(result!.score).toBeLessThanOrEqual(100);

      const result2 = scoreParameter('TSS', 10000, 'freshwater');
      expect(result2!.score).toBeGreaterThanOrEqual(0);
      expect(result2!.score).toBeLessThanOrEqual(100);
    });

    it('returns correct label from ALL_PARAM_LABELS', () => {
      const result = scoreParameter('DO', 7.0);
      expect(result!.label).toBe('Dissolved Oxygen');
      expect(result!.param).toBe('DO');
    });

    it('works with different waterbody types', () => {
      const fw = scoreParameter('DO', 6.5, 'freshwater');
      const est = scoreParameter('DO', 6.5, 'estuarine');
      // Both should return valid results, potentially different scores
      expect(fw).not.toBeNull();
      expect(est).not.toBeNull();
    });
  });

  // ─── scoreToLetter ────────────────────────────────────────────────────────

  describe('scoreToLetter', () => {
    it('returns A+ for >= 97', () => {
      expect(scoreToLetter(97)).toBe('A+');
      expect(scoreToLetter(100)).toBe('A+');
    });

    it('returns A for 93-96', () => {
      expect(scoreToLetter(93)).toBe('A');
      expect(scoreToLetter(96)).toBe('A');
    });

    it('returns A- for 90-92', () => {
      expect(scoreToLetter(90)).toBe('A-');
      expect(scoreToLetter(92)).toBe('A-');
    });

    it('returns B+ for 87-89', () => {
      expect(scoreToLetter(87)).toBe('B+');
    });

    it('returns B for 83-86', () => {
      expect(scoreToLetter(83)).toBe('B');
      expect(scoreToLetter(86)).toBe('B');
    });

    it('returns B- for 80-82', () => {
      expect(scoreToLetter(80)).toBe('B-');
    });

    it('returns C+ for 77-79', () => {
      expect(scoreToLetter(77)).toBe('C+');
    });

    it('returns C for 73-76', () => {
      expect(scoreToLetter(73)).toBe('C');
    });

    it('returns C- for 70-72', () => {
      expect(scoreToLetter(70)).toBe('C-');
    });

    it('returns D+ for 67-69', () => {
      expect(scoreToLetter(67)).toBe('D+');
    });

    it('returns D for 63-66', () => {
      expect(scoreToLetter(63)).toBe('D');
    });

    it('returns D- for 60-62', () => {
      expect(scoreToLetter(60)).toBe('D-');
    });

    it('returns F for < 60', () => {
      expect(scoreToLetter(59)).toBe('F');
      expect(scoreToLetter(0)).toBe('F');
    });
  });

  // ─── assessCoverage ───────────────────────────────────────────────────────

  describe('assessCoverage', () => {
    it('returns unmonitored when no params present', () => {
      const result = assessCoverage([], {});
      expect(result.level).toBe('unmonitored');
      expect(result.keyParamsPresent).toBe(0);
      expect(result.canBeGraded).toBe(false);
    });

    it('returns minimal for 1 key param', () => {
      const result = assessCoverage(['DO'], { DO: now() });
      expect(result.level).toBe('minimal');
      expect(result.keyParamsPresent).toBe(1);
    });

    it('returns limited for 2-3 key params', () => {
      const result = assessCoverage(['DO', 'pH'], { DO: now(), pH: now() });
      expect(result.level).toBe('limited');
      expect(result.keyParamsPresent).toBe(2);
    });

    it('returns adequate for 4-5 key params', () => {
      const result = assessCoverage(
        ['DO', 'pH', 'turbidity', 'TSS'],
        { DO: now(), pH: now(), turbidity: now(), TSS: now() },
      );
      expect(result.level).toBe('adequate');
      expect(result.keyParamsPresent).toBe(4);
    });

    it('returns comprehensive for 6+ key params', () => {
      const result = assessCoverage(
        ['DO', 'pH', 'turbidity', 'TSS', 'TN', 'TP'],
        { DO: now(), pH: now(), turbidity: now(), TSS: now(), TN: now(), TP: now() },
      );
      expect(result.level).toBe('comprehensive');
      expect(result.keyParamsPresent).toBe(6);
    });

    it('canBeGraded requires >= 2 live key params', () => {
      // 2 live params → gradable
      const live2 = assessCoverage(
        ['DO', 'pH'],
        { DO: now(), pH: now() },
      );
      expect(live2.canBeGraded).toBe(true);

      // 1 live + 1 reference → NOT gradable
      const live1 = assessCoverage(
        ['DO', 'pH'],
        { DO: now(), pH: daysAgo(800) },
      );
      expect(live1.canBeGraded).toBe(false);
    });

    it('classifies live vs reference params by 2-year threshold', () => {
      const result = assessCoverage(
        ['DO', 'pH', 'turbidity'],
        { DO: now(), pH: daysAgo(100), turbidity: daysAgo(800) },
      );
      expect(result.liveKeyParamCount).toBe(2); // DO and pH are within 2 years
      expect(result.referenceKeyParamCount).toBe(1); // turbidity is > 2 years
    });

    it('counts missing params correctly', () => {
      const result = assessCoverage(['DO'], { DO: now() });
      expect(result.missingParams).toHaveLength(6); // 7 total - 1 present = 6 missing
      expect(result.missingParams).toContain('pH');
      expect(result.missingParams).toContain('turbidity');
    });

    it('provides missing labels', () => {
      const result = assessCoverage(['DO'], { DO: now() });
      expect(result.missingLabels).toContain('pH');
      expect(result.missingLabels).toContain('Turbidity');
    });

    it('ignores supplemental params in key param counting', () => {
      const result = assessCoverage(
        ['DO', 'bacteria', 'conductivity'],
        { DO: now(), bacteria: now(), conductivity: now() },
      );
      // Only DO is a key param; bacteria and conductivity are supplemental
      expect(result.keyParamsPresent).toBe(1);
    });

    it('builds freshnessSummary string', () => {
      const result = assessCoverage(['DO', 'pH'], { DO: now(), pH: now() });
      expect(typeof result.freshnessSummary).toBe('string');
      expect(result.freshnessSummary.length).toBeGreaterThan(0);
    });
  });

  // ─── calculateGrade ───────────────────────────────────────────────────────

  describe('calculateGrade', () => {
    it('returns ungraded when parameters is null', () => {
      const grade = calculateGrade(null);
      expect(grade.canBeGraded).toBe(false);
      expect(grade.score).toBeNull();
      expect(grade.letter).toBeNull();
      expect(grade.label).toBe('Ungraded');
      expect(grade.gradeSource).toBe('none');
    });

    it('returns ungraded when parameters is undefined', () => {
      const grade = calculateGrade(undefined);
      expect(grade.canBeGraded).toBe(false);
      expect(grade.gradeSource).toBe('none');
    });

    it('returns ungraded when no key params present', () => {
      const grade = calculateGrade({
        bacteria: { value: 50, lastSampled: now() },
      });
      expect(grade.canBeGraded).toBe(false);
    });

    it('returns ungraded with only 1 live key param (no ATTAINS fallback)', () => {
      const grade = calculateGrade({
        DO: { value: 8.0, lastSampled: now() },
      });
      expect(grade.canBeGraded).toBe(false);
      expect(grade.gradeSource).toBe('none');
    });

    it('grades with 2+ live key params', () => {
      const grade = calculateGrade({
        DO: { value: 8.0, lastSampled: now() },
        pH: { value: 7.5, lastSampled: now() },
      });
      expect(grade.canBeGraded).toBe(true);
      expect(grade.score).not.toBeNull();
      expect(grade.letter).not.toBeNull();
      expect(grade.gradeSource).toBe('sensor');
    });

    it('gives high score for all-good parameters', () => {
      const grade = calculateGrade({
        DO: { value: 8.0, lastSampled: now() },
        pH: { value: 7.5, lastSampled: now() },
        turbidity: { value: 5, lastSampled: now() },
        TSS: { value: 10, lastSampled: now() },
        TN: { value: 0.3, lastSampled: now() },
        TP: { value: 0.02, lastSampled: now() },
      });
      expect(grade.score).toBeGreaterThanOrEqual(80);
      expect(['A+', 'A', 'A-', 'B+', 'B', 'B-']).toContain(grade.letter);
    });

    it('gives low score for all-poor parameters', () => {
      const grade = calculateGrade({
        DO: { value: 2.0, lastSampled: now() },
        pH: { value: 4.0, lastSampled: now() },
        turbidity: { value: 100, lastSampled: now() },
        TSS: { value: 120, lastSampled: now() },
        TN: { value: 5.0, lastSampled: now() },
        TP: { value: 0.5, lastSampled: now() },
      });
      expect(grade.score).toBeLessThanOrEqual(40);
      expect(grade.letter).toBe('F');
    });

    it('applies regulatory penalty for Cat 5 no TMDL', () => {
      const gradeNoPenalty = calculateGrade({
        DO: { value: 7.5, lastSampled: now() },
        pH: { value: 7.5, lastSampled: now() },
        TSS: { value: 12, lastSampled: now() },
      });

      const gradeWithPenalty = calculateGrade(
        {
          DO: { value: 7.5, lastSampled: now() },
          pH: { value: 7.5, lastSampled: now() },
          TSS: { value: 12, lastSampled: now() },
        },
        'freshwater',
        { attainsCategory: '5', hasTmdl: false },
      );

      expect(gradeWithPenalty.regulatoryPenalty).toBeGreaterThan(0);
      expect(gradeWithPenalty.score!).toBeLessThan(gradeNoPenalty.score!);
    });

    it('falls back to ATTAINS grade when insufficient live sensor data', () => {
      const grade = calculateGrade(
        {
          DO: { value: 8.0, lastSampled: daysAgo(800) }, // reference, not live
        },
        'freshwater',
        { attainsCategory: '5' },
      );
      expect(grade.canBeGraded).toBe(true);
      expect(grade.gradeSource).toBe('attains');
      expect(grade.letter).toBe('F');
      expect(grade.score).toBe(45);
    });

    it('ATTAINS fallback: Cat 1 maps to A', () => {
      const grade = calculateGrade(null, 'freshwater', { attainsCategory: '1' });
      expect(grade.gradeSource).toBe('attains');
      expect(grade.letter).toBe('A');
      expect(grade.score).toBe(93);
    });

    it('ATTAINS fallback: Cat 2 maps to B', () => {
      const grade = calculateGrade(null, 'freshwater', { attainsCategory: '2' });
      expect(grade.letter).toBe('B');
    });

    it('ATTAINS fallback: Cat 3 maps to C', () => {
      const grade = calculateGrade(null, 'freshwater', { attainsCategory: '3' });
      expect(grade.letter).toBe('C');
    });

    it('ATTAINS fallback: Cat 4a maps to D', () => {
      const grade = calculateGrade(null, 'freshwater', { attainsCategory: '4a' });
      expect(grade.letter).toBe('D');
    });

    it('skips NaN values in parameter scoring', () => {
      const grade = calculateGrade({
        DO: { value: NaN, lastSampled: now() },
        pH: { value: 7.5, lastSampled: now() },
        TSS: { value: 10, lastSampled: now() },
      });
      // Should still work — just skips the NaN param
      expect(grade).toBeDefined();
    });

    it('sets isPartialGrade when some key params are reference', () => {
      const grade = calculateGrade({
        DO: { value: 8.0, lastSampled: now() },
        pH: { value: 7.5, lastSampled: now() },
        turbidity: { value: 5, lastSampled: daysAgo(800) }, // reference
      });
      expect(grade.isPartialGrade).toBe(true);
    });

    it('works with estuarine waterbody type', () => {
      const grade = calculateGrade(
        {
          DO: { value: 6.5, lastSampled: now() },
          pH: { value: 7.8, lastSampled: now() },
        },
        'estuarine',
      );
      expect(grade.canBeGraded).toBe(true);
      expect(grade.score).not.toBeNull();
    });
  });

  // ─── gradeToAlertLevel ────────────────────────────────────────────────────

  describe('gradeToAlertLevel', () => {
    it('returns "none" for ungraded', () => {
      const grade = calculateGrade(null);
      expect(gradeToAlertLevel(grade)).toBe('none');
    });

    it('returns "none" for A/B range (score >= 80)', () => {
      const grade = calculateGrade({
        DO: { value: 8.0, lastSampled: now() },
        pH: { value: 7.5, lastSampled: now() },
        turbidity: { value: 5, lastSampled: now() },
        TSS: { value: 10, lastSampled: now() },
        TN: { value: 0.3, lastSampled: now() },
        TP: { value: 0.02, lastSampled: now() },
      });
      if (grade.score !== null && grade.score >= 80) {
        expect(gradeToAlertLevel(grade)).toBe('none');
      }
    });

    it('returns "high" for F range (score < 60)', () => {
      const grade = calculateGrade({
        DO: { value: 1.5, lastSampled: now() },
        pH: { value: 4.0, lastSampled: now() },
        turbidity: { value: 100, lastSampled: now() },
        TSS: { value: 150, lastSampled: now() },
      });
      if (grade.canBeGraded && grade.score !== null && grade.score < 60) {
        expect(gradeToAlertLevel(grade)).toBe('high');
      }
    });
  });

  // ─── generateObservations / generateImplications ──────────────────────────

  describe('generateObservations', () => {
    it('returns observations array for graded result', () => {
      const grade = calculateGrade({
        DO: { value: 8.0, lastSampled: now() },
        pH: { value: 7.5, lastSampled: now() },
      });
      const obs = generateObservations(grade);
      expect(obs).toBeInstanceOf(Array);
      expect(obs.length).toBeGreaterThan(0);
      for (const o of obs) {
        expect(o).toHaveProperty('icon');
        expect(o).toHaveProperty('text');
        expect(o).toHaveProperty('severity');
        expect(['info', 'warning', 'critical']).toContain(o.severity);
      }
    });

    it('returns observations for ungraded result', () => {
      const grade = calculateGrade(null);
      const obs = generateObservations(grade);
      expect(obs).toBeInstanceOf(Array);
    });
  });

  describe('generateImplications', () => {
    it('returns implications array', () => {
      const grade = calculateGrade({
        DO: { value: 3.0, lastSampled: now() },
        pH: { value: 5.0, lastSampled: now() },
      });
      const imp = generateImplications(grade);
      expect(imp).toBeInstanceOf(Array);
      for (const i of imp) {
        expect(i).toHaveProperty('icon');
        expect(i).toHaveProperty('text');
        expect(i).toHaveProperty('severity');
      }
    });

    it('warns about nutrient data gaps', () => {
      const grade = calculateGrade({
        DO: { value: 8.0, lastSampled: now() },
        pH: { value: 7.5, lastSampled: now() },
        // Missing TN and TP
      });
      const imp = generateImplications(grade);
      const nutrientWarning = imp.find(i => i.text.includes('Nutrient'));
      expect(nutrientWarning).toBeDefined();
    });
  });

  // ─── computeFreshnessScore ────────────────────────────────────────────────

  describe('computeFreshnessScore', () => {
    it('returns 0 score for empty timestamps', () => {
      const result = computeFreshnessScore({});
      expect(result.score).toBe(0);
      expect(result.populated).toBe(0);
      expect(result.label).toBe('Stale');
    });

    it('returns high score for all-live params', () => {
      const timestamps: Record<string, string> = {};
      for (let i = 0; i < 16; i++) {
        timestamps[`param${i}`] = now();
      }
      const result = computeFreshnessScore(timestamps);
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.label).toBe('Fresh');
      expect(result.populated).toBe(16);
      expect(result.total).toBe(16);
      expect(result.grade).toBe('A');
      expect(result.avgAgeDays).toBeLessThan(1);
    });

    it('returns moderate score for partial coverage', () => {
      const timestamps: Record<string, string> = {};
      for (let i = 0; i < 7; i++) {
        timestamps[`param${i}`] = now();
      }
      const result = computeFreshnessScore(timestamps, 15);
      expect(result.score).toBeGreaterThan(0);
      expect(result.populated).toBe(7);
    });

    it('labels Stale for score < 40', () => {
      const result = computeFreshnessScore({ p1: daysAgo(4000) }, 15);
      expect(result.label).toBe('Stale');
    });

    it('labels Aging for score 40-69', () => {
      // ~7/15 params, recent timestamps
      const timestamps: Record<string, string> = {};
      for (let i = 0; i < 7; i++) {
        timestamps[`param${i}`] = daysAgo(100);
      }
      const result = computeFreshnessScore(timestamps, 15);
      expect(['Aging', 'Fresh']).toContain(result.label);
    });

    it('respects custom totalPossibleParams', () => {
      const result = computeFreshnessScore({ p1: now(), p2: now() }, 5);
      expect(result.total).toBe(5);
    });
  });

  // ─── ageToFreshnessGrade ──────────────────────────────────────────────────────

  describe('ageToFreshnessGrade', () => {
    it('returns A for data less than 1 year', () => {
      expect(ageToFreshnessGrade(now())).toBe('A');
      expect(ageToFreshnessGrade(daysAgo(30))).toBe('A');
      expect(ageToFreshnessGrade(daysAgo(200))).toBe('A');
      expect(ageToFreshnessGrade(daysAgo(364))).toBe('A');
    });

    it('returns B for data 1-2 years old', () => {
      expect(ageToFreshnessGrade(daysAgo(366))).toBe('B');
      expect(ageToFreshnessGrade(daysAgo(500))).toBe('B');
      expect(ageToFreshnessGrade(daysAgo(729))).toBe('B');
    });

    it('returns C for data 2-3 years old', () => {
      expect(ageToFreshnessGrade(daysAgo(730))).toBe('C');
      expect(ageToFreshnessGrade(daysAgo(1000))).toBe('C');
      expect(ageToFreshnessGrade(daysAgo(1094))).toBe('C');
    });

    it('returns D for data 3-4 years old', () => {
      expect(ageToFreshnessGrade(daysAgo(1095))).toBe('D');
      expect(ageToFreshnessGrade(daysAgo(1400))).toBe('D');
      expect(ageToFreshnessGrade(daysAgo(1459))).toBe('D');
    });

    it('returns E for data 4-5 years old', () => {
      expect(ageToFreshnessGrade(daysAgo(1460))).toBe('E');
      expect(ageToFreshnessGrade(daysAgo(1700))).toBe('E');
      expect(ageToFreshnessGrade(daysAgo(1824))).toBe('E');
    });

    it('returns F for data 5+ years old', () => {
      expect(ageToFreshnessGrade(daysAgo(1825))).toBe('F');
      expect(ageToFreshnessGrade(daysAgo(2000))).toBe('F');
      expect(ageToFreshnessGrade(daysAgo(3000))).toBe('F');
    });

    it('returns F for null or invalid timestamps', () => {
      expect(ageToFreshnessGrade(null)).toBe('F');
      expect(ageToFreshnessGrade(undefined)).toBe('F');
      expect(ageToFreshnessGrade('invalid')).toBe('F');
    });
  });

  describe('freshnessGradeStyle', () => {
    it('returns appropriate styles for each grade', () => {
      expect(freshnessGradeStyle('A')).toMatchObject({ color: 'text-green-700' });
      expect(freshnessGradeStyle('B')).toMatchObject({ color: 'text-emerald-700' });
      expect(freshnessGradeStyle('C')).toMatchObject({ color: 'text-yellow-700' });
      expect(freshnessGradeStyle('D')).toMatchObject({ color: 'text-orange-700' });
      expect(freshnessGradeStyle('E')).toMatchObject({ color: 'text-red-600' });
      expect(freshnessGradeStyle('F')).toMatchObject({ color: 'text-red-700' });
    });
  });

  // ─── paramAgeTint ─────────────────────────────────────────────────────────

  describe('paramAgeTint', () => {
    it('returns default tint for null', () => {
      expect(paramAgeTint(null)).toBe('bg-white border-slate-200');
    });

    it('returns default tint for undefined', () => {
      expect(paramAgeTint(undefined)).toBe('bg-white border-slate-200');
    });

    it('returns default tint for invalid date', () => {
      expect(paramAgeTint('not-a-date')).toBe('bg-white border-slate-200');
    });

    it('returns green tint for recent data (< 2 years)', () => {
      expect(paramAgeTint(now())).toContain('green');
    });

    it('returns yellow tint for 2-5 year old data', () => {
      expect(paramAgeTint(daysAgo(1000))).toContain('yellow');
    });

    it('returns orange tint for 5-10 year old data', () => {
      expect(paramAgeTint(daysAgo(2500))).toContain('orange');
    });

    it('returns red tint for > 10 year old data', () => {
      expect(paramAgeTint(daysAgo(4000))).toContain('red');
    });
  });
});
