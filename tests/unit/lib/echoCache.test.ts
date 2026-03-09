import { describe, it, expect, vi } from 'vitest';
import {
  getEchoCache,
  setEchoCache,
  isEchoBuildInProgress,
  setEchoBuildInProgress,
  getEchoAllData,
  getEchoCacheStatus,
  gridKey,
} from '@/lib/echoCache';
import {
  makeEchoFacility,
  makeEchoViolation,
} from '../../mocks/fixtures/echo-sample-data';

describe('echoCache', () => {
  describe('getEchoCache', () => {
    it('returns null when cache is cold', () => {
      const result = getEchoCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns both arrays after setEchoCache', async () => {
      const key = gridKey(39.24, -76.53);
      await setEchoCache({
        _meta: {
          built: new Date().toISOString(),
          facilityCount: 1,
          violationCount: 1,
          statesProcessed: ['MD'],
          gridCells: 1,
        },
        grid: {
          [key]: {
            facilities: [makeEchoFacility()],
            violations: [makeEchoViolation()],
          },
        },
      });

      const result = getEchoCache(39.24, -76.53);
      expect(result).not.toBeNull();
      expect(result!.facilities).toHaveLength(1);
      expect(result!.violations).toHaveLength(1);
      expect(result!.fromCache).toBe(true);
    });

    it('returns null for coords outside grid', () => {
      const result = getEchoCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setEchoCache({
        _meta: {
          built: new Date().toISOString(),
          facilityCount: 2,
          violationCount: 0,
          statesProcessed: ['MD'],
          gridCells: 2,
        },
        grid: {
          [key1]: {
            facilities: [makeEchoFacility({ registryId: 'A' })],
            violations: [],
          },
          [key2]: {
            facilities: [makeEchoFacility({ registryId: 'B' })],
            violations: [],
          },
        },
      });

      const result = getEchoCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.facilities.length).toBeGreaterThanOrEqual(2);
    });

    it('preserves snc boolean and qtrsInViolation', async () => {
      const key = gridKey(39.24, -76.53);
      await setEchoCache({
        _meta: {
          built: new Date().toISOString(),
          facilityCount: 1,
          violationCount: 0,
          statesProcessed: ['MD'],
          gridCells: 1,
        },
        grid: {
          [key]: {
            facilities: [makeEchoFacility({ snc: true, qtrsInViolation: 4 })],
            violations: [],
          },
        },
      });

      const result = getEchoCache(39.24, -76.53);
      expect(result!.facilities[0].snc).toBe(true);
      expect(result!.facilities[0].qtrsInViolation).toBe(4);
    });
  });

  describe('isEchoBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isEchoBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setEchoBuildInProgress(true);
      expect(isEchoBuildInProgress()).toBe(true);
      setEchoBuildInProgress(false);
      expect(isEchoBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setEchoBuildInProgress(true);
      expect(isEchoBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isEchoBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getEchoAllData', () => {
    it('returns flat arrays from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setEchoCache({
        _meta: {
          built: new Date().toISOString(),
          facilityCount: 3,
          violationCount: 2,
          statesProcessed: ['MD'],
          gridCells: 2,
        },
        grid: {
          [key1]: {
            facilities: [makeEchoFacility({ registryId: 'A' }), makeEchoFacility({ registryId: 'B' })],
            violations: [makeEchoViolation({ registryId: 'A' })],
          },
          [key2]: {
            facilities: [makeEchoFacility({ registryId: 'C' })],
            violations: [makeEchoViolation({ registryId: 'C' })],
          },
        },
      });

      const all = getEchoAllData();
      expect(all.facilities.length).toBeGreaterThanOrEqual(3);
      expect(all.violations.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getEchoCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setEchoCache({
        _meta: {
          built: new Date().toISOString(),
          facilityCount: 5,
          violationCount: 3,
          statesProcessed: ['MD', 'VA'],
          gridCells: 2,
        },
        grid: {},
      });

      const status = getEchoCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
