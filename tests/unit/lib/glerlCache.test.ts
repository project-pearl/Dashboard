import { describe, it, expect, vi } from 'vitest';
import {
  getGlerlCache,
  setGlerlCache,
  isGlerlBuildInProgress,
  setGlerlBuildInProgress,
  getGlerlAll,
  getGlerlCacheStatus,
  gridKey,
} from '@/lib/glerlCache';
import { makeGlerlPixel } from '../../mocks/fixtures/glerl-sample-data';

describe('glerlCache', () => {
  describe('getGlerlCache', () => {
    it('returns null when cache is cold', () => {
      const result = getGlerlCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns pixels after setGlerlCache', async () => {
      const key = gridKey(43.5, -82.0);
      await setGlerlCache({
        _meta: {
          built: new Date().toISOString(),
          pixelCount: 1,
          gridCells: 1,
        },
        grid: {
          [key]: {
            pixels: [makeGlerlPixel()],
          },
        },
      });

      const result = getGlerlCache(43.5, -82.0);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(1);
    });

    it('returns null for coords outside grid', () => {
      const result = getGlerlCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(43.0, -82.0);
      const key2 = gridKey(43.1, -82.0);
      await setGlerlCache({
        _meta: {
          built: new Date().toISOString(),
          pixelCount: 2,
          gridCells: 2,
        },
        grid: {
          [key1]: { pixels: [makeGlerlPixel({ lat: 43.0 })] },
          [key2]: { pixels: [makeGlerlPixel({ lat: 43.1 })] },
        },
      });

      const result = getGlerlCache(43.0, -82.0);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isGlerlBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isGlerlBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setGlerlBuildInProgress(true);
      expect(isGlerlBuildInProgress()).toBe(true);
      setGlerlBuildInProgress(false);
      expect(isGlerlBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setGlerlBuildInProgress(true);
      expect(isGlerlBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isGlerlBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getGlerlAll', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(43.0, -82.0);
      const key2 = gridKey(43.1, -82.1);
      await setGlerlCache({
        _meta: {
          built: new Date().toISOString(),
          pixelCount: 3,
          gridCells: 2,
        },
        grid: {
          [key1]: { pixels: [makeGlerlPixel({ lat: 43.0 }), makeGlerlPixel({ lat: 43.01 })] },
          [key2]: { pixels: [makeGlerlPixel({ lat: 43.1 })] },
        },
      });

      const all = getGlerlAll();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getGlerlCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setGlerlCache({
        _meta: {
          built: new Date().toISOString(),
          pixelCount: 5,
          gridCells: 2,
        },
        grid: {},
      });

      const status = getGlerlCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
