import { describe, it, expect, vi } from 'vitest';
import {
  getNwmCache,
  setNwmCache,
  isNwmBuildInProgress,
  setNwmBuildInProgress,
  getNwmAllReaches,
  getNwmCacheStatus,
  gridKey,
} from '@/lib/nwmCache';
import { makeNwmReach } from '../../mocks/fixtures/nwm-sample-data';

describe('nwmCache', () => {
  describe('getNwmCache', () => {
    it('returns null when cache is cold', () => {
      const result = getNwmCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns reaches after setNwmCache', async () => {
      const key = gridKey(39.0, -77.0);
      await setNwmCache({
        _meta: {
          built: new Date().toISOString(),
          reachCount: 1,
          gridCells: 1,
        },
        grid: {
          [key]: {
            reaches: [makeNwmReach()],
          },
        },
      });

      const result = getNwmCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].featureId).toBe('2586614');
    });

    it('returns null for coords outside grid', () => {
      const result = getNwmCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setNwmCache({
        _meta: {
          built: new Date().toISOString(),
          reachCount: 2,
          gridCells: 2,
        },
        grid: {
          [key1]: {
            reaches: [makeNwmReach({ featureId: 'A' })],
          },
          [key2]: {
            reaches: [makeNwmReach({ featureId: 'B' })],
          },
        },
      });

      const result = getNwmCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isNwmBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isNwmBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setNwmBuildInProgress(true);
      expect(isNwmBuildInProgress()).toBe(true);
      setNwmBuildInProgress(false);
      expect(isNwmBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setNwmBuildInProgress(true);
      expect(isNwmBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isNwmBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getNwmAllReaches', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setNwmCache({
        _meta: {
          built: new Date().toISOString(),
          reachCount: 3,
          gridCells: 2,
        },
        grid: {
          [key1]: {
            reaches: [makeNwmReach({ featureId: 'A' }), makeNwmReach({ featureId: 'B' })],
          },
          [key2]: {
            reaches: [makeNwmReach({ featureId: 'C' })],
          },
        },
      });

      const all = getNwmAllReaches();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getNwmCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setNwmCache({
        _meta: {
          built: new Date().toISOString(),
          reachCount: 5,
          gridCells: 2,
        },
        grid: {},
      });

      const status = getNwmCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
