import { describe, it, expect, vi } from 'vitest';
import {
  getNwisGwCache,
  setNwisGwCache,
  isNwisGwBuildInProgress,
  setNwisGwBuildInProgress,
  getNwisGwAllSites,
  getNwisGwAllTrends,
  getNwisGwCacheStatus,
  gridKey,
} from '@/lib/nwisGwCache';
import {
  makeNwisGwSite,
  makeNwisGwLevel,
  makeNwisGwTrend,
} from '../../mocks/fixtures/nwis-gw-sample-data';

describe('nwisGwCache', () => {
  describe('getNwisGwCache', () => {
    it('returns null when cache is cold', () => {
      const result = getNwisGwCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns all 3 arrays after setNwisGwCache', async () => {
      const key = gridKey(39.0, -76.3);
      await setNwisGwCache({
        _meta: {
          built: new Date().toISOString(),
          siteCount: 1,
          levelCount: 1,
          trendCount: 1,
          statesProcessed: ['MD'],
          gridCells: 1,
        },
        grid: {
          [key]: {
            sites: [makeNwisGwSite()],
            levels: [makeNwisGwLevel()],
            trends: [makeNwisGwTrend()],
          },
        },
      });

      const result = getNwisGwCache(39.0, -76.3);
      expect(result).not.toBeNull();
      expect(result!.sites).toHaveLength(1);
      expect(result!.levels).toHaveLength(1);
      expect(result!.trends).toHaveLength(1);
      expect(result!.fromCache).toBe(true);
    });

    it('returns null for coords outside grid', () => {
      const result = getNwisGwCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setNwisGwCache({
        _meta: {
          built: new Date().toISOString(),
          siteCount: 2,
          levelCount: 0,
          trendCount: 0,
          statesProcessed: ['MD'],
          gridCells: 2,
        },
        grid: {
          [key1]: {
            sites: [makeNwisGwSite({ siteNumber: 'A' })],
            levels: [],
            trends: [],
          },
          [key2]: {
            sites: [makeNwisGwSite({ siteNumber: 'B' })],
            levels: [],
            trends: [],
          },
        },
      });

      const result = getNwisGwCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.sites.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isNwisGwBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isNwisGwBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setNwisGwBuildInProgress(true);
      expect(isNwisGwBuildInProgress()).toBe(true);
      setNwisGwBuildInProgress(false);
      expect(isNwisGwBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setNwisGwBuildInProgress(true);
      expect(isNwisGwBuildInProgress()).toBe(true);
      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isNwisGwBuildInProgress()).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('getNwisGwAllSites', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setNwisGwCache({
        _meta: {
          built: new Date().toISOString(),
          siteCount: 3,
          levelCount: 0,
          trendCount: 0,
          statesProcessed: ['MD'],
          gridCells: 2,
        },
        grid: {
          [key1]: { sites: [makeNwisGwSite({ siteNumber: 'A' }), makeNwisGwSite({ siteNumber: 'B' })], levels: [], trends: [] },
          [key2]: { sites: [makeNwisGwSite({ siteNumber: 'C' })], levels: [], trends: [] },
        },
      });

      const all = getNwisGwAllSites();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getNwisGwAllTrends', () => {
    it('returns flat array of trends', async () => {
      const key = gridKey(39.0, -77.0);
      await setNwisGwCache({
        _meta: {
          built: new Date().toISOString(),
          siteCount: 1,
          levelCount: 0,
          trendCount: 2,
          statesProcessed: ['MD'],
          gridCells: 1,
        },
        grid: {
          [key]: {
            sites: [makeNwisGwSite()],
            levels: [],
            trends: [makeNwisGwTrend({ siteNumber: 'A' }), makeNwisGwTrend({ siteNumber: 'B' })],
          },
        },
      });

      const trends = getNwisGwAllTrends();
      expect(trends.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getNwisGwCacheStatus', () => {
    it('returns cache metadata', () => {
      const status = getNwisGwCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
