import { describe, it, expect, vi } from 'vitest';
import {
  getUsgsDvCache,
  setUsgsDvCache,
  isUsgsDvBuildInProgress,
  setUsgsDvBuildInProgress,
  getUsgsDvAll,
  getUsgsDvCacheStatus,
  gridKey,
} from '@/lib/usgsDvCache';
import { makeUsgsDvStation } from '../../mocks/fixtures/usgs-dv-sample-data';

describe('usgsDvCache', () => {
  describe('getUsgsDvCache', () => {
    it('returns null when cache is cold', () => {
      const result = getUsgsDvCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns stations after setUsgsDvCache', async () => {
      const key = gridKey(38.93, -77.12);
      await setUsgsDvCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 1,
          gridCells: 1,
        },
        grid: {
          [key]: {
            stations: [makeUsgsDvStation()],
          },
        },
      });

      const result = getUsgsDvCache(38.93, -77.12);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
    });

    it('returns null for coords outside grid', () => {
      const result = getUsgsDvCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setUsgsDvCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 2,
          gridCells: 2,
        },
        grid: {
          [key1]: { stations: [makeUsgsDvStation({ siteId: 'A' })] },
          [key2]: { stations: [makeUsgsDvStation({ siteId: 'B' })] },
        },
      });

      const result = getUsgsDvCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isUsgsDvBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isUsgsDvBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setUsgsDvBuildInProgress(true);
      expect(isUsgsDvBuildInProgress()).toBe(true);
      setUsgsDvBuildInProgress(false);
      expect(isUsgsDvBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setUsgsDvBuildInProgress(true);
      expect(isUsgsDvBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isUsgsDvBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getUsgsDvAll', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setUsgsDvCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 3,
          gridCells: 2,
        },
        grid: {
          [key1]: { stations: [makeUsgsDvStation({ siteId: 'A' }), makeUsgsDvStation({ siteId: 'B' })] },
          [key2]: { stations: [makeUsgsDvStation({ siteId: 'C' })] },
        },
      });

      const all = getUsgsDvAll();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getUsgsDvCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setUsgsDvCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 5,
          gridCells: 2,
        },
        grid: {},
      });

      const status = getUsgsDvCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
