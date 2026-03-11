import { describe, it, expect, vi } from 'vitest';
import {
  getNceiByState,
  getNceiAll,
  setNceiCache,
  isNceiBuildInProgress,
  setNceiBuildInProgress,
  getNceiCacheStatus,
} from '@/lib/nceiCache';
import { makeNceiStateClimate } from '../../mocks/fixtures/ncei-sample-data';

describe('nceiCache', () => {
  describe('getNceiByState', () => {
    it('returns null when cache is cold', () => {
      const result = getNceiByState('MD');
      expect(result).toBeNull();
    });

    it('returns data after setNceiCache', async () => {
      await setNceiCache({
        _meta: {
          built: new Date().toISOString(),
          stateCount: 1,
        },
        states: {
          MD: makeNceiStateClimate(),
        },
      });

      const result = getNceiByState('MD');
      expect(result).not.toBeNull();
      expect(result!.recentPrecip).toBe(3.8);
      expect(result!.precipAnomaly).toBe(0.5);
    });

    it('returns null for unknown state', () => {
      const result = getNceiByState('ZZ');
      expect(result).toBeNull();
    });
  });

  describe('getNceiAll', () => {
    it('returns Record of all states', async () => {
      await setNceiCache({
        _meta: {
          built: new Date().toISOString(),
          stateCount: 2,
        },
        states: {
          MD: makeNceiStateClimate(),
          VA: makeNceiStateClimate({ state: 'VA', fips: '51', recentPrecip: 4.2 }),
        },
      });

      const all = getNceiAll();
      expect(Object.keys(all)).toContain('MD');
      expect(Object.keys(all)).toContain('VA');
      expect(all['VA'].recentPrecip).toBe(4.2);
    });
  });

  describe('isNceiBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isNceiBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setNceiBuildInProgress(true);
      expect(isNceiBuildInProgress()).toBe(true);
      setNceiBuildInProgress(false);
      expect(isNceiBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setNceiBuildInProgress(true);
      expect(isNceiBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isNceiBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getNceiCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setNceiCache({
        _meta: {
          built: new Date().toISOString(),
          stateCount: 5,
        },
        states: {},
      });

      const status = getNceiCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
