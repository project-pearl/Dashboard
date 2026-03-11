import { describe, it, expect, vi } from 'vitest';
import {
  getNdbcCache,
  setNdbcCache,
  isNdbcBuildInProgress,
  setNdbcBuildInProgress,
  getNdbcAllStations,
  getNdbcCacheStatus,
  gridKey,
} from '@/lib/ndbcCache';
import { makeNdbcStation } from '../../mocks/fixtures/ndbc-sample-data';

describe('ndbcCache', () => {
  describe('getNdbcCache', () => {
    it('returns null when cache is cold', () => {
      const result = getNdbcCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns stations after setNdbcCache', async () => {
      const key = gridKey(38.46, -74.70);
      await setNdbcCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 1,
          wqStationCount: 0,
          gridCells: 1,
        },
        grid: {
          [key]: {
            stations: [makeNdbcStation()],
          },
        },
      });

      const result = getNdbcCache(38.46, -74.70);
      expect(result).not.toBeNull();
      expect(result!.stations).toHaveLength(1);
      expect(result!.fromCache).toBe(true);
    });

    it('returns null for coords outside grid', () => {
      const result = getNdbcCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setNdbcCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 2,
          wqStationCount: 0,
          gridCells: 2,
        },
        grid: {
          [key1]: { stations: [makeNdbcStation({ id: 'A' })] },
          [key2]: { stations: [makeNdbcStation({ id: 'B' })] },
        },
      });

      const result = getNdbcCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.stations.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isNdbcBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isNdbcBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setNdbcBuildInProgress(true);
      expect(isNdbcBuildInProgress()).toBe(true);
      setNdbcBuildInProgress(false);
      expect(isNdbcBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setNdbcBuildInProgress(true);
      expect(isNdbcBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isNdbcBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getNdbcAllStations', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setNdbcCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 3,
          wqStationCount: 1,
          gridCells: 2,
        },
        grid: {
          [key1]: { stations: [makeNdbcStation({ id: 'A' }), makeNdbcStation({ id: 'B' })] },
          [key2]: { stations: [makeNdbcStation({ id: 'C' })] },
        },
      });

      const all = getNdbcAllStations();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getNdbcCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setNdbcCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 5,
          wqStationCount: 2,
          gridCells: 2,
        },
        grid: {},
      });

      const status = getNdbcCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
