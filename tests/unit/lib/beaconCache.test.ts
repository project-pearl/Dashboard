import { describe, it, expect, vi } from 'vitest';
import {
  getBeaconCache,
  setBeaconCache,
  isBeaconBuildInProgress,
  setBeaconBuildInProgress,
  getBeaconAll,
  getBeaconCacheStatus,
  gridKey,
} from '@/lib/beaconCache';
import { makeBeachAdvisory } from '../../mocks/fixtures/beacon-sample-data';

describe('beaconCache', () => {
  describe('getBeaconCache', () => {
    it('returns null when cache is cold', () => {
      const result = getBeaconCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns advisories after setBeaconCache', async () => {
      const key = gridKey(39.01, -76.50);
      await setBeaconCache({
        _meta: {
          built: new Date().toISOString(),
          advisoryCount: 1,
          gridCells: 1,
        },
        grid: {
          [key]: {
            advisories: [makeBeachAdvisory()],
          },
        },
      });

      const result = getBeaconCache(39.01, -76.50);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].beachName).toBe('Sandy Point State Park');
    });

    it('returns null for coords outside grid', () => {
      const result = getBeaconCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setBeaconCache({
        _meta: {
          built: new Date().toISOString(),
          advisoryCount: 2,
          gridCells: 2,
        },
        grid: {
          [key1]: {
            advisories: [makeBeachAdvisory({ beachId: 'A' })],
          },
          [key2]: {
            advisories: [makeBeachAdvisory({ beachId: 'B' })],
          },
        },
      });

      const result = getBeaconCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isBeaconBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isBeaconBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setBeaconBuildInProgress(true);
      expect(isBeaconBuildInProgress()).toBe(true);
      setBeaconBuildInProgress(false);
      expect(isBeaconBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setBeaconBuildInProgress(true);
      expect(isBeaconBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isBeaconBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getBeaconAll', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setBeaconCache({
        _meta: {
          built: new Date().toISOString(),
          advisoryCount: 3,
          gridCells: 2,
        },
        grid: {
          [key1]: {
            advisories: [makeBeachAdvisory({ beachId: 'A' }), makeBeachAdvisory({ beachId: 'B' })],
          },
          [key2]: {
            advisories: [makeBeachAdvisory({ beachId: 'C' })],
          },
        },
      });

      const all = getBeaconAll();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getBeaconCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setBeaconCache({
        _meta: {
          built: new Date().toISOString(),
          advisoryCount: 5,
          gridCells: 2,
        },
        grid: {},
      });

      const status = getBeaconCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
