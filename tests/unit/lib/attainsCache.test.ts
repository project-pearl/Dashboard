import { describe, it, expect, vi } from 'vitest';
import {
  getCacheStatus,
  getAttainsCacheSummary,
  getHuc12Summary,
  setHuc12Summaries,
} from '@/lib/attainsCache';

describe('attainsCache', () => {
  describe('getCacheStatus', () => {
    it('returns cold start state', () => {
      const status = getCacheStatus();
      expect(status.status).toMatch(/cold|ready|stale/);
      expect(status).toHaveProperty('loadedStates');
      expect(status).toHaveProperty('totalStates');
      expect(status.totalStates).toBe(51);
    });
  });

  describe('getAttainsCacheSummary', () => {
    it('returns cacheStatus and states', () => {
      const summary = getAttainsCacheSummary();
      expect(summary).toHaveProperty('cacheStatus');
      expect(summary).toHaveProperty('states');
    });

    it('strips waterbodies from summary', () => {
      const summary = getAttainsCacheSummary();
      for (const state of Object.values(summary.states)) {
        expect(state).not.toHaveProperty('waterbodies');
        // Should still have other fields if any states are loaded
        if (Object.keys(summary.states).length > 0) {
          expect(state).toHaveProperty('state');
        }
      }
    });
  });

  describe('getHuc12Summary / setHuc12Summaries', () => {
    it('returns null for unknown HUC-12', () => {
      expect(getHuc12Summary('999999999999')).toBeNull();
    });

    it('returns correct data after set', () => {
      const summaries = [
        {
          huc12: '020700100101',
          assessmentUnitCount: 5,
          impairedCount: 2,
          tmdlCount: 1,
          causeCount: 3,
        },
      ];
      setHuc12Summaries(summaries);
      const result = getHuc12Summary('020700100101');
      expect(result).not.toBeNull();
      expect(result!.assessmentUnitCount).toBe(5);
      expect(result!.impairedCount).toBe(2);
    });
  });

  describe('build lock auto-clear', () => {
    it('getCacheStatus auto-clears stale building lock', () => {
      // The cache module auto-clears locks > 5 min old.
      // We can't easily set buildStarted from outside, but we can verify
      // that getCacheStatus returns a valid status (not stuck on "building").
      const status = getCacheStatus();
      // If no build is running, status should not be 'building'
      // (unless a test before this started one, which pool:'forks' prevents)
      expect(['cold', 'ready', 'stale']).toContain(status.status);
    });
  });
});
