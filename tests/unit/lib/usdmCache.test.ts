import { describe, it, expect, vi } from 'vitest';
import {
  getUsdmByState,
  getUsdmAll,
  setUsdmCache,
  isUsdmBuildInProgress,
  setUsdmBuildInProgress,
  getUsdmCacheStatus,
} from '@/lib/usdmCache';
import { makeDroughtState } from '../../mocks/fixtures/usdm-sample-data';

describe('usdmCache', () => {
  describe('getUsdmByState', () => {
    it('returns null when cache is cold', () => {
      const result = getUsdmByState('MD');
      expect(result).toBeNull();
    });

    it('returns data after setUsdmCache', async () => {
      await setUsdmCache({
        _meta: {
          built: new Date().toISOString(),
          stateCount: 1,
        },
        states: {
          MD: makeDroughtState(),
        },
      });

      const result = getUsdmByState('MD');
      expect(result).not.toBeNull();
      expect(result!.none).toBe(65.5);
      expect(result!.d0).toBe(20.0);
    });

    it('returns null for unknown state', () => {
      const result = getUsdmByState('ZZ');
      expect(result).toBeNull();
    });
  });

  describe('getUsdmAll', () => {
    it('returns Record of all states', async () => {
      await setUsdmCache({
        _meta: {
          built: new Date().toISOString(),
          stateCount: 2,
        },
        states: {
          MD: makeDroughtState(),
          VA: makeDroughtState({ state: 'VA', fips: '51', d0: 25.0 }),
        },
      });

      const all = getUsdmAll();
      expect(Object.keys(all)).toContain('MD');
      expect(Object.keys(all)).toContain('VA');
      expect(all['VA'].d0).toBe(25.0);
    });
  });

  describe('isUsdmBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isUsdmBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setUsdmBuildInProgress(true);
      expect(isUsdmBuildInProgress()).toBe(true);
      setUsdmBuildInProgress(false);
      expect(isUsdmBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setUsdmBuildInProgress(true);
      expect(isUsdmBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isUsdmBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getUsdmCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setUsdmCache({
        _meta: {
          built: new Date().toISOString(),
          stateCount: 5,
        },
        states: {},
      });

      const status = getUsdmCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
