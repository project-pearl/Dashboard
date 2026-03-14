import { describe, it, expect } from 'vitest';
import {
  scoreToGrade,
  ALERT_LEVEL_SCORES,
  alertLevelAvgScore,
  ecoScoreStyle,
  ejScoreStyle,
  letterGrade,
} from '@/lib/scoringUtils';

describe('scoringUtils', () => {
  describe('scoreToGrade', () => {
    it('returns A+ for score >= 97', () => {
      const result = scoreToGrade(98);
      expect(result.letter).toBe('A+');
      expect(result.color).toContain('green');
    });

    it('returns A for score 93-96', () => {
      const result = scoreToGrade(95);
      expect(result.letter).toBe('A');
    });

    it('returns B for score 83-86', () => {
      const result = scoreToGrade(85);
      expect(result.letter).toBe('B');
      expect(result.color).toContain('emerald');
    });

    it('returns C for score 73-76', () => {
      const result = scoreToGrade(75);
      expect(result.letter).toBe('C');
      expect(result.color).toContain('yellow');
    });

    it('returns D for score 63-66', () => {
      const result = scoreToGrade(65);
      expect(result.letter).toBe('D');
      expect(result.color).toContain('orange');
    });

    it('returns F for score < 60', () => {
      const result = scoreToGrade(50);
      expect(result.letter).toBe('F');
      expect(result.color).toContain('red');
    });

    it('always returns a dark textColor matching the grade color family', () => {
      const expected: Record<number, string> = {
        98: 'text-green-800',   // A+
        85: 'text-emerald-700', // B
        75: 'text-yellow-800',  // C
        65: 'text-orange-700',  // D
        50: 'text-red-800',     // F
      };
      for (const [score, color] of Object.entries(expected)) {
        expect(scoreToGrade(Number(score)).textColor).toBe(color);
      }
    });
  });

  describe('ALERT_LEVEL_SCORES', () => {
    it('maps none to 100', () => {
      expect(ALERT_LEVEL_SCORES.none).toBe(100);
    });

    it('maps high to 40', () => {
      expect(ALERT_LEVEL_SCORES.high).toBe(40);
    });

    it('has all four levels', () => {
      expect(Object.keys(ALERT_LEVEL_SCORES)).toEqual(
        expect.arrayContaining(['none', 'low', 'medium', 'high']),
      );
    });
  });

  describe('alertLevelAvgScore', () => {
    it('returns -1 for empty array', () => {
      expect(alertLevelAvgScore([])).toBe(-1);
    });

    it('returns 100 for all none', () => {
      expect(alertLevelAvgScore([{ alertLevel: 'none' }, { alertLevel: 'none' }])).toBe(100);
    });

    it('returns 40 for all high', () => {
      expect(alertLevelAvgScore([{ alertLevel: 'high' }, { alertLevel: 'high' }])).toBe(40);
    });

    it('averages mixed levels', () => {
      const result = alertLevelAvgScore([{ alertLevel: 'none' }, { alertLevel: 'high' }]);
      // (100 + 40) / 2 = 70
      expect(result).toBe(70);
    });

    it('filters out unknown levels', () => {
      const result = alertLevelAvgScore([{ alertLevel: 'unknown' }, { alertLevel: 'none' }]);
      expect(result).toBe(100);
    });
  });

  describe('ecoScoreStyle', () => {
    it('returns Very High for >= 80', () => {
      const result = ecoScoreStyle(85);
      expect(result.label).toBe('Very High');
      expect(result.bg).toContain('red');
    });

    it('returns High for >= 60', () => {
      const result = ecoScoreStyle(65);
      expect(result.label).toBe('High');
      expect(result.bg).toContain('orange');
    });

    it('returns Moderate for >= 40', () => {
      const result = ecoScoreStyle(45);
      expect(result.label).toBe('Moderate');
    });

    it('returns Minimal for < 20', () => {
      const result = ecoScoreStyle(10);
      expect(result.label).toBe('Minimal');
    });
  });

  describe('ejScoreStyle', () => {
    it('returns red for >= 70', () => {
      const result = ejScoreStyle(75);
      expect(result.bg).toContain('red');
      expect(result.color).toBe('#dc2626');
    });

    it('returns orange for >= 50', () => {
      const result = ejScoreStyle(55);
      expect(result.bg).toContain('orange');
    });

    it('returns green for < 30', () => {
      const result = ejScoreStyle(20);
      expect(result.bg).toContain('green');
    });
  });

  describe('letterGrade', () => {
    it('returns A for >= 90', () => {
      expect(letterGrade(95)).toBe('A');
    });

    it('returns B for >= 80', () => {
      expect(letterGrade(85)).toBe('B');
    });

    it('returns C for >= 70', () => {
      expect(letterGrade(75)).toBe('C');
    });

    it('returns D for >= 60', () => {
      expect(letterGrade(65)).toBe('D');
    });

    it('returns F for < 60', () => {
      expect(letterGrade(50)).toBe('F');
    });

    it('returns N/A for negative', () => {
      expect(letterGrade(-1)).toBe('N/A');
    });

    it('handles boundary at exactly 90', () => {
      expect(letterGrade(90)).toBe('A');
    });
  });
});
