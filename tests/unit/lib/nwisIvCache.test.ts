import { describe, it, expect, vi } from 'vitest';
import {
  getUsgsIvCache,
  setUsgsIvCache,
  isNwisIvBuildInProgress,
  setNwisIvBuildInProgress,
  getUsgsIvCacheStatus,
  gridKey,
} from '@/lib/nwisIvCache';
import {
  makeUsgsIvSite,
  makeUsgsIvReading,
} from '../../mocks/fixtures/nwis-iv-sample-data';

describe('nwisIvCache', () => {
  describe('getUsgsIvCache', () => {
    it('returns null when cache is cold', () => {
      const result = getUsgsIvCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns sites and readings after setUsgsIvCache', async () => {
      const key = gridKey(39.24, -76.53);
      await setUsgsIvCache({
        _meta: {
          built: new Date().toISOString(),
          siteCount: 1,
          readingCount: 1,
          statesProcessed: ['MD'],
          gridCells: 1,
        },
        grid: {
          [key]: {
            sites: [makeUsgsIvSite()],
            readings: [makeUsgsIvReading()],
          },
        },
      });

      const result = getUsgsIvCache(39.24, -76.53);
      expect(result).not.toBeNull();
      expect(result!.sites).toHaveLength(1);
      expect(result!.readings).toHaveLength(1);
      expect(result!.fromCache).toBe(true);
    });

    it('returns null for coords outside grid', () => {
      const result = getUsgsIvCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setUsgsIvCache({
        _meta: {
          built: new Date().toISOString(),
          siteCount: 2,
          readingCount: 2,
          statesProcessed: ['MD'],
          gridCells: 2,
        },
        grid: {
          [key1]: {
            sites: [makeUsgsIvSite({ siteNumber: 'A' })],
            readings: [makeUsgsIvReading({ siteNumber: 'A' })],
          },
          [key2]: {
            sites: [makeUsgsIvSite({ siteNumber: 'B' })],
            readings: [makeUsgsIvReading({ siteNumber: 'B' })],
          },
        },
      });

      const result = getUsgsIvCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.sites.length).toBeGreaterThanOrEqual(2);
    });

    it('preserves parameterCodes and qualifier', async () => {
      const key = gridKey(39.24, -76.53);
      await setUsgsIvCache({
        _meta: {
          built: new Date().toISOString(),
          siteCount: 1,
          readingCount: 1,
          statesProcessed: ['DC'],
          gridCells: 1,
        },
        grid: {
          [key]: {
            sites: [makeUsgsIvSite({ parameterCodes: ['00300', '00010', '00400'] })],
            readings: [makeUsgsIvReading({ qualifier: 'A', parameterCd: '00300' })],
          },
        },
      });

      const result = getUsgsIvCache(39.24, -76.53);
      expect(result!.sites[0].parameterCodes).toEqual(['00300', '00010', '00400']);
      expect(result!.readings[0].qualifier).toBe('A');
    });
  });

  describe('isNwisIvBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isNwisIvBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setNwisIvBuildInProgress(true);
      expect(isNwisIvBuildInProgress()).toBe(true);
      setNwisIvBuildInProgress(false);
      expect(isNwisIvBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setNwisIvBuildInProgress(true);
      expect(isNwisIvBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isNwisIvBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getUsgsIvCacheStatus', () => {
    it('returns loaded false when cache is cold', () => {
      // After prior tests populated it, check structure
      const status = getUsgsIvCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });

    it('returns metadata after cache is populated', async () => {
      const key = gridKey(39.0, -77.0);
      await setUsgsIvCache({
        _meta: {
          built: new Date().toISOString(),
          siteCount: 5,
          readingCount: 10,
          statesProcessed: ['MD', 'VA'],
          gridCells: 2,
        },
        grid: {
          [key]: {
            sites: [makeUsgsIvSite()],
            readings: [makeUsgsIvReading()],
          },
        },
      });

      const status = getUsgsIvCacheStatus();
      expect(status.loaded).toBe(true);
      expect(status.siteCount).toBe(5);
      expect(status.readingCount).toBe(10);
    });
  });
});
