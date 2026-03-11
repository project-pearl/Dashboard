import { describe, it, expect, vi } from 'vitest';
import {
  getHabsosCache,
  setHabsosCache,
  isHabsosBuildInProgress,
  setHabsosBuildInProgress,
  getHabsosAll,
  getHabsosCacheStatus,
  gridKey,
} from '@/lib/habsosCache';
import { makeHabObservation } from '../../mocks/fixtures/habsos-sample-data';

describe('habsosCache', () => {
  describe('getHabsosCache', () => {
    it('returns null when cache is cold', () => {
      const result = getHabsosCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns observations after setHabsosCache', async () => {
      const key = gridKey(30.0, -88.0);
      await setHabsosCache({
        _meta: {
          built: new Date().toISOString(),
          observationCount: 1,
          gridCells: 1,
        },
        grid: {
          [key]: {
            observations: [makeHabObservation()],
          },
        },
      });

      const result = getHabsosCache(30.0, -88.0);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].genus).toBe('Karenia');
    });

    it('returns null for coords outside grid', () => {
      const result = getHabsosCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(30.0, -88.0);
      const key2 = gridKey(30.1, -88.0);
      await setHabsosCache({
        _meta: {
          built: new Date().toISOString(),
          observationCount: 2,
          gridCells: 2,
        },
        grid: {
          [key1]: {
            observations: [makeHabObservation({ genus: 'Karenia' })],
          },
          [key2]: {
            observations: [makeHabObservation({ genus: 'Pseudo-nitzschia' })],
          },
        },
      });

      const result = getHabsosCache(30.0, -88.0);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isHabsosBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isHabsosBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setHabsosBuildInProgress(true);
      expect(isHabsosBuildInProgress()).toBe(true);
      setHabsosBuildInProgress(false);
      expect(isHabsosBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setHabsosBuildInProgress(true);
      expect(isHabsosBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isHabsosBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getHabsosAll', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(30.0, -88.0);
      const key2 = gridKey(30.1, -88.1);
      await setHabsosCache({
        _meta: {
          built: new Date().toISOString(),
          observationCount: 3,
          gridCells: 2,
        },
        grid: {
          [key1]: {
            observations: [makeHabObservation({ genus: 'A' }), makeHabObservation({ genus: 'B' })],
          },
          [key2]: {
            observations: [makeHabObservation({ genus: 'C' })],
          },
        },
      });

      const all = getHabsosAll();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getHabsosCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setHabsosCache({
        _meta: {
          built: new Date().toISOString(),
          observationCount: 5,
          gridCells: 2,
        },
        grid: {},
      });

      const status = getHabsosCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
