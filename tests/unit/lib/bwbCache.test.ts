import { describe, it, expect, vi } from 'vitest';
import {
  getBwbCache,
  setBwbCache,
  isBwbBuildInProgress,
  setBwbBuildInProgress,
  getBwbAllStations,
  getBwbCacheStatus,
  gridKey,
} from '@/lib/bwbCache';
import { makeBwbStation } from '../../mocks/fixtures/bwb-sample-data';

describe('bwbCache', () => {
  describe('getBwbCache', () => {
    it('returns null when cache is cold', () => {
      const result = getBwbCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns stations after setBwbCache', async () => {
      const key = gridKey(38.93, -76.38);
      await setBwbCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 1,
          parameterReadings: 1,
          datasetsScanned: 1,
          gridCells: 1,
        },
        grid: {
          [key]: {
            stations: [makeBwbStation()],
          },
        },
      });

      const result = getBwbCache(38.93, -76.38);
      expect(result).not.toBeNull();
      expect(result!.stations).toHaveLength(1);
      expect(result!.fromCache).toBe(true);
    });

    it('returns null for coords outside grid', () => {
      const result = getBwbCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setBwbCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 2,
          parameterReadings: 2,
          datasetsScanned: 1,
          gridCells: 2,
        },
        grid: {
          [key1]: { stations: [makeBwbStation({ stationId: 2 })] },
          [key2]: { stations: [makeBwbStation({ stationId: 3 })] },
        },
      });

      const result = getBwbCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.stations.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isBwbBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isBwbBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setBwbBuildInProgress(true);
      expect(isBwbBuildInProgress()).toBe(true);
      setBwbBuildInProgress(false);
      expect(isBwbBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setBwbBuildInProgress(true);
      expect(isBwbBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isBwbBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getBwbAllStations', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setBwbCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 3,
          parameterReadings: 3,
          datasetsScanned: 1,
          gridCells: 2,
        },
        grid: {
          [key1]: { stations: [makeBwbStation({ stationId: 4 }), makeBwbStation({ stationId: 5 })] },
          [key2]: { stations: [makeBwbStation({ stationId: 6 })] },
        },
      });

      const all = getBwbAllStations();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getBwbCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setBwbCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 5,
          parameterReadings: 10,
          datasetsScanned: 2,
          gridCells: 2,
        },
        grid: {},
      });

      const status = getBwbCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
