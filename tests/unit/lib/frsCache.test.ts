import { describe, it, expect, vi } from 'vitest';
import {
  getFrsCache,
  setFrsCache,
  isFrsBuildInProgress,
  setFrsBuildInProgress,
  getFrsAllFacilities,
  getFrsCacheStatus,
  gridKey,
} from '@/lib/frsCache';
import { makeFrsFacility } from '../../mocks/fixtures/frs-sample-data';

describe('frsCache', () => {
  describe('getFrsCache', () => {
    it('returns null when cache is cold', () => {
      const result = getFrsCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns facilities after setFrsCache', async () => {
      const key = gridKey(39.24, -76.53);
      await setFrsCache({
        _meta: {
          built: new Date().toISOString(),
          facilityCount: 1,
          statesProcessed: ['MD'],
          gridCells: 1,
        },
        grid: {
          [key]: {
            facilities: [makeFrsFacility()],
          },
        },
      });

      const result = getFrsCache(39.24, -76.53);
      expect(result).not.toBeNull();
      expect(result!.facilities).toHaveLength(1);
      expect(result!.fromCache).toBe(true);
    });

    it('returns null for coords outside grid', () => {
      const result = getFrsCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setFrsCache({
        _meta: {
          built: new Date().toISOString(),
          facilityCount: 2,
          statesProcessed: ['MD'],
          gridCells: 2,
        },
        grid: {
          [key1]: { facilities: [makeFrsFacility({ registryId: 'A' })] },
          [key2]: { facilities: [makeFrsFacility({ registryId: 'B' })] },
        },
      });

      const result = getFrsCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.facilities.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isFrsBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isFrsBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setFrsBuildInProgress(true);
      expect(isFrsBuildInProgress()).toBe(true);
      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isFrsBuildInProgress()).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('getFrsAllFacilities', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setFrsCache({
        _meta: {
          built: new Date().toISOString(),
          facilityCount: 3,
          statesProcessed: ['MD'],
          gridCells: 2,
        },
        grid: {
          [key1]: { facilities: [makeFrsFacility({ registryId: 'A' }), makeFrsFacility({ registryId: 'B' })] },
          [key2]: { facilities: [makeFrsFacility({ registryId: 'C' })] },
        },
      });

      const all = getFrsAllFacilities();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getFrsCacheStatus', () => {
    it('returns cache metadata', () => {
      const status = getFrsCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
