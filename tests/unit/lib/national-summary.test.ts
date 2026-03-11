import { describe, it, expect } from 'vitest';
import { getNationalSummary } from '@/lib/national-summary';

describe('national-summary', () => {
  describe('getNationalSummary', () => {
    it('returns a NationalSummary object', () => {
      const summary = getNationalSummary();
      expect(summary).toBeDefined();
      expect(typeof summary).toBe('object');
    });

    it('includes generatedAt timestamp', () => {
      const summary = getNationalSummary();
      expect(summary.generatedAt).toBeDefined();
      expect(new Date(summary.generatedAt).getTime()).not.toBeNaN();
    });

    it('includes waterbody counts', () => {
      const summary = getNationalSummary();
      expect(typeof summary.totalWaterbodies).toBe('number');
      expect(typeof summary.totalImpaired).toBe('number');
      expect(typeof summary.totalHealthy).toBe('number');
    });

    it('includes TMDL statistics', () => {
      const summary = getNationalSummary();
      expect(typeof summary.tmdlGap).toBe('number');
      expect(typeof summary.tmdlCompleted).toBe('number');
      expect(typeof summary.tmdlAlternative).toBe('number');
    });

    it('includes state breakdown', () => {
      const summary = getNationalSummary();
      expect(typeof summary.stateBreakdown).toBe('object');
    });

    it('includes alert counts', () => {
      const summary = getNationalSummary();
      expect(typeof summary.highAlertStates).toBe('number');
      expect(typeof summary.activeAlerts).toBe('number');
    });

    it('returns consistent results within TTL', () => {
      const s1 = getNationalSummary();
      const s2 = getNationalSummary();
      // Should return same cached result within 30-min TTL
      expect(s1.generatedAt).toBe(s2.generatedAt);
    });

    it('includes topCauses array', () => {
      const summary = getNationalSummary();
      expect(Array.isArray(summary.topCauses)).toBe(true);
    });
  });
});
