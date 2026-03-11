import { describe, it, expect, vi } from 'vitest';
import {
  getCoopsCache,
  setCoopsCache,
  isCoopsBuildInProgress,
  setCoopsBuildInProgress,
  getCoopsAllStations,
  getCoopsCacheStatus,
  gridKey,
} from '@/lib/coopsCache';
import { makeCoopsStation } from '../../mocks/fixtures/coops-sample-data';

describe('coopsCache', () => {
  describe('getCoopsCache', () => {
    it('returns null when cache is cold', () => {
      const result = getCoopsCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns stations after setCoopsCache', async () => {
      const key = gridKey(39.27, -76.58);
      await setCoopsCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 1,
          gridCells: 1,
        },
        grid: {
          [key]: {
            stations: [makeCoopsStation()],
          },
        },
      });

      const result = getCoopsCache(39.27, -76.58);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
    });

    it('returns null for coords outside grid', () => {
      const result = getCoopsCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setCoopsCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 2,
          gridCells: 2,
        },
        grid: {
          [key1]: { stations: [makeCoopsStation({ id: 'A' })] },
          [key2]: { stations: [makeCoopsStation({ id: 'B' })] },
        },
      });

      const result = getCoopsCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isCoopsBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isCoopsBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setCoopsBuildInProgress(true);
      expect(isCoopsBuildInProgress()).toBe(true);
      setCoopsBuildInProgress(false);
      expect(isCoopsBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setCoopsBuildInProgress(true);
      expect(isCoopsBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isCoopsBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getCoopsAllStations', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setCoopsCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 3,
          gridCells: 2,
        },
        grid: {
          [key1]: { stations: [makeCoopsStation({ id: 'A' }), makeCoopsStation({ id: 'B' })] },
          [key2]: { stations: [makeCoopsStation({ id: 'C' })] },
        },
      });

      const all = getCoopsAllStations();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getCoopsCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setCoopsCache({
        _meta: {
          built: new Date().toISOString(),
          stationCount: 5,
          gridCells: 2,
        },
        grid: {},
      });

      const status = getCoopsCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
