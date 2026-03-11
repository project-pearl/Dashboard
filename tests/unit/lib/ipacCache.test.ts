import { describe, it, expect, vi } from 'vitest';
import {
  getIpacByState,
  getIpacAll,
  setIpacCache,
  isIpacBuildInProgress,
  setIpacBuildInProgress,
  getIpacCacheStatus,
} from '@/lib/ipacCache';
import { makeIpacStateData } from '../../mocks/fixtures/ipac-sample-data';

describe('ipacCache', () => {
  describe('getIpacByState', () => {
    it('returns null when cache is cold', () => {
      const result = getIpacByState('MD');
      expect(result).toBeNull();
    });

    it('returns data after setIpacCache', async () => {
      await setIpacCache({
        _meta: {
          built: new Date().toISOString(),
          stateCount: 1,
        },
        states: {
          MD: makeIpacStateData(),
        },
      });

      const result = getIpacByState('MD');
      expect(result).not.toBeNull();
      expect(result!.totalListed).toBe(25);
      expect(result!.endangered).toBe(10);
    });

    it('returns null for unknown state', () => {
      const result = getIpacByState('ZZ');
      expect(result).toBeNull();
    });
  });

  describe('getIpacAll', () => {
    it('returns Record of all states', async () => {
      await setIpacCache({
        _meta: {
          built: new Date().toISOString(),
          stateCount: 2,
        },
        states: {
          MD: makeIpacStateData(),
          VA: makeIpacStateData({ state: 'VA', totalListed: 30 }),
        },
      });

      const all = getIpacAll();
      expect(Object.keys(all)).toContain('MD');
      expect(Object.keys(all)).toContain('VA');
      expect(all['VA'].totalListed).toBe(30);
    });
  });

  describe('isIpacBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isIpacBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setIpacBuildInProgress(true);
      expect(isIpacBuildInProgress()).toBe(true);
      setIpacBuildInProgress(false);
      expect(isIpacBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setIpacBuildInProgress(true);
      expect(isIpacBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isIpacBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getIpacCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setIpacCache({
        _meta: {
          built: new Date().toISOString(),
          stateCount: 5,
        },
        states: {},
      });

      const status = getIpacCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
