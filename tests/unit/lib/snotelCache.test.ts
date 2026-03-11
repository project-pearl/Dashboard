import { describe, it, expect, vi } from 'vitest';
import {
  getSnotelCache,
  setSnotelCache,
  isSnotelBuildInProgress,
  setSnotelBuildInProgress,
  getSnotelAllStations,
  getSnotelCacheStatus,
  gridKey,
} from '@/lib/snotelCache';
import { makeSnotelStation } from '../../mocks/fixtures/snotel-sample-data';

describe('snotelCache', () => {
  describe('getSnotelCache', () => {
    it('returns null when cache is cold', () => {
      const result = getSnotelCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns stations after setSnotelCache', async () => {
      const key = gridKey(44.42, -121.85);
      await setSnotelCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 1,
          gridCells: 1,
        },
        grid: {
          [key]: {
            stations: [makeSnotelStation()],
          },
        },
      });

      const result = getSnotelCache(44.42, -121.85);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
    });

    it('returns null for coords outside grid', () => {
      const result = getSnotelCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setSnotelCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 2,
          gridCells: 2,
        },
        grid: {
          [key1]: { stations: [makeSnotelStation({ id: 'A' })] },
          [key2]: { stations: [makeSnotelStation({ id: 'B' })] },
        },
      });

      const result = getSnotelCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isSnotelBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isSnotelBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setSnotelBuildInProgress(true);
      expect(isSnotelBuildInProgress()).toBe(true);
      setSnotelBuildInProgress(false);
      expect(isSnotelBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setSnotelBuildInProgress(true);
      expect(isSnotelBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isSnotelBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getSnotelAllStations', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setSnotelCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 3,
          gridCells: 2,
        },
        grid: {
          [key1]: { stations: [makeSnotelStation({ id: 'A' }), makeSnotelStation({ id: 'B' })] },
          [key2]: { stations: [makeSnotelStation({ id: 'C' })] },
        },
      });

      const all = getSnotelAllStations();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getSnotelCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setSnotelCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 5,
          gridCells: 2,
        },
        grid: {},
      });

      const status = getSnotelCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
