import { describe, it, expect, vi } from 'vitest';
import {
  getTriCache,
  setTriCache,
  isTriBuildInProgress,
  setTriBuildInProgress,
  getTriAllFacilities,
  getTriCacheStatus,
  gridKey,
} from '@/lib/triCache';
import { makeTriFacility } from '../../mocks/fixtures/tri-sample-data';

describe('triCache', () => {
  describe('getTriCache', () => {
    it('returns null when cache is cold', () => {
      const result = getTriCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns facilities after setTriCache', async () => {
      const key = gridKey(39.22, -76.45);
      await setTriCache({
        _meta: {
          built: new Date().toISOString(),
          facilityCount: 1,
          gridCells: 1,
          year: 2023,
        },
        grid: {
          [key]: {
            facilities: [makeTriFacility()],
          },
        },
      });

      const result = getTriCache(39.22, -76.45);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
    });

    it('returns null for coords outside grid', () => {
      const result = getTriCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setTriCache({
        _meta: {
          built: new Date().toISOString(),
          facilityCount: 2,
          gridCells: 2,
          year: 2023,
        },
        grid: {
          [key1]: { facilities: [makeTriFacility({ triId: 'A' })] },
          [key2]: { facilities: [makeTriFacility({ triId: 'B' })] },
        },
      });

      const result = getTriCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isTriBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isTriBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setTriBuildInProgress(true);
      expect(isTriBuildInProgress()).toBe(true);
      setTriBuildInProgress(false);
      expect(isTriBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setTriBuildInProgress(true);
      expect(isTriBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isTriBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getTriAllFacilities', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setTriCache({
        _meta: {
          built: new Date().toISOString(),
          facilityCount: 3,
          gridCells: 2,
          year: 2023,
        },
        grid: {
          [key1]: { facilities: [makeTriFacility({ triId: 'A' }), makeTriFacility({ triId: 'B' })] },
          [key2]: { facilities: [makeTriFacility({ triId: 'C' })] },
        },
      });

      const all = getTriAllFacilities();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getTriCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setTriCache({
        _meta: {
          built: new Date().toISOString(),
          facilityCount: 5,
          gridCells: 2,
          year: 2023,
        },
        grid: {},
      });

      const status = getTriCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
