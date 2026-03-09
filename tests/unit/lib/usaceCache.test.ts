import { describe, it, expect, vi } from 'vitest';
import {
  getUsaceCache,
  setUsaceCache,
  isUsaceBuildInProgress,
  setUsaceBuildInProgress,
  getUsaceAllLocations,
  getUsaceCacheStatus,
  gridKey,
} from '@/lib/usaceCache';
import { makeUsaceLocation } from '../../mocks/fixtures/usace-sample-data';

describe('usaceCache', () => {
  describe('getUsaceCache', () => {
    it('returns null when cache is cold', () => {
      const result = getUsaceCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns locations after setUsaceCache', async () => {
      const key = gridKey(39.66, -76.17);
      await setUsaceCache({
        _meta: {
          built: new Date().toISOString(),
          locationCount: 1,
          officesQueried: ['Baltimore'],
          withWaterTemp: 1,
          gridCells: 1,
        },
        grid: {
          [key]: {
            locations: [makeUsaceLocation()],
          },
        },
      });

      const result = getUsaceCache(39.66, -76.17);
      expect(result).not.toBeNull();
      expect(result!.locations).toHaveLength(1);
      expect(result!.fromCache).toBe(true);
    });

    it('returns null for coords outside grid', () => {
      const result = getUsaceCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setUsaceCache({
        _meta: {
          built: new Date().toISOString(),
          locationCount: 2,
          officesQueried: ['Baltimore'],
          withWaterTemp: 2,
          gridCells: 2,
        },
        grid: {
          [key1]: { locations: [makeUsaceLocation({ name: 'Dam A' })] },
          [key2]: { locations: [makeUsaceLocation({ name: 'Dam B' })] },
        },
      });

      const result = getUsaceCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.locations.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isUsaceBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isUsaceBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setUsaceBuildInProgress(true);
      expect(isUsaceBuildInProgress()).toBe(true);
      setUsaceBuildInProgress(false);
      expect(isUsaceBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setUsaceBuildInProgress(true);
      expect(isUsaceBuildInProgress()).toBe(true);
      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isUsaceBuildInProgress()).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('getUsaceAllLocations', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setUsaceCache({
        _meta: {
          built: new Date().toISOString(),
          locationCount: 3,
          officesQueried: ['Baltimore'],
          withWaterTemp: 2,
          gridCells: 2,
        },
        grid: {
          [key1]: { locations: [makeUsaceLocation({ name: 'A' }), makeUsaceLocation({ name: 'B' })] },
          [key2]: { locations: [makeUsaceLocation({ name: 'C' })] },
        },
      });

      const all = getUsaceAllLocations();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getUsaceCacheStatus', () => {
    it('returns cache metadata', () => {
      const status = getUsaceCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
