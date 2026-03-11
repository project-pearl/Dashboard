import { describe, it, expect, vi } from 'vitest';
import {
  getHefsCache,
  setHefsCache,
  isHefsBuildInProgress,
  setHefsBuildInProgress,
  getHefsAll,
  getHefsCacheStatus,
  gridKey,
} from '@/lib/hefsCache';
import { makeHefsEnsemble } from '../../mocks/fixtures/hefs-sample-data';

describe('hefsCache', () => {
  describe('getHefsCache', () => {
    it('returns null when cache is cold', () => {
      const result = getHefsCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns ensembles after setHefsCache', async () => {
      const key = gridKey(39.28, -76.61);
      await setHefsCache({
        _meta: {
          built: new Date().toISOString(),
          ensembleCount: 1,
          gridCells: 1,
        },
        grid: {
          [key]: {
            ensembles: [makeHefsEnsemble()],
          },
        },
      });

      const result = getHefsCache(39.28, -76.61);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].lid).toBe('BLTM2');
    });

    it('returns null for coords outside grid', () => {
      const result = getHefsCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setHefsCache({
        _meta: {
          built: new Date().toISOString(),
          ensembleCount: 2,
          gridCells: 2,
        },
        grid: {
          [key1]: {
            ensembles: [makeHefsEnsemble({ lid: 'A' })],
          },
          [key2]: {
            ensembles: [makeHefsEnsemble({ lid: 'B' })],
          },
        },
      });

      const result = getHefsCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isHefsBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isHefsBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setHefsBuildInProgress(true);
      expect(isHefsBuildInProgress()).toBe(true);
      setHefsBuildInProgress(false);
      expect(isHefsBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setHefsBuildInProgress(true);
      expect(isHefsBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isHefsBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getHefsAll', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setHefsCache({
        _meta: {
          built: new Date().toISOString(),
          ensembleCount: 3,
          gridCells: 2,
        },
        grid: {
          [key1]: {
            ensembles: [makeHefsEnsemble({ lid: 'A' }), makeHefsEnsemble({ lid: 'B' })],
          },
          [key2]: {
            ensembles: [makeHefsEnsemble({ lid: 'C' })],
          },
        },
      });

      const all = getHefsAll();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getHefsCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setHefsCache({
        _meta: {
          built: new Date().toISOString(),
          ensembleCount: 5,
          gridCells: 2,
        },
        grid: {},
      });

      const status = getHefsCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
