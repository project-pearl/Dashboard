import { describe, it, expect, vi } from 'vitest';
import {
  getSdwisCache,
  setSdwisCache,
  isSdwisBuildInProgress,
  setSdwisBuildInProgress,
  getSdwisAllData,
  getSdwisForState,
  getSdwisCacheStatus,
  gridKey,
} from '@/lib/sdwisCache';
import {
  makeSdwisSystem,
  makeSdwisViolation,
  makeSdwisEnforcement,
} from '../../mocks/fixtures/sdwis-sample-data';

describe('sdwisCache', () => {
  describe('getSdwisCache', () => {
    it('returns null when cache is cold', () => {
      const result = getSdwisCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns all 3 arrays after setSdwisCache', async () => {
      const key = gridKey(39.29, -76.61);
      await setSdwisCache({
        _meta: {
          built: new Date().toISOString(),
          systemCount: 1,
          violationCount: 1,
          enforcementCount: 1,
          statesProcessed: ['MD'],
          gridCells: 1,
        },
        grid: {
          [key]: {
            systems: [makeSdwisSystem()],
            violations: [makeSdwisViolation()],
            enforcement: [makeSdwisEnforcement()],
          },
        },
      });

      const result = getSdwisCache(39.29, -76.61);
      expect(result).not.toBeNull();
      expect(result!.systems).toHaveLength(1);
      expect(result!.violations).toHaveLength(1);
      expect(result!.enforcement).toHaveLength(1);
      expect(result!.fromCache).toBe(true);
    });

    it('returns null for coords outside grid', () => {
      const result = getSdwisCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setSdwisCache({
        _meta: {
          built: new Date().toISOString(),
          systemCount: 2,
          violationCount: 0,
          enforcementCount: 0,
          statesProcessed: ['MD'],
          gridCells: 2,
        },
        grid: {
          [key1]: {
            systems: [makeSdwisSystem({ pwsid: 'MD0001' })],
            violations: [],
            enforcement: [],
          },
          [key2]: {
            systems: [makeSdwisSystem({ pwsid: 'MD0002' })],
            violations: [],
            enforcement: [],
          },
        },
      });

      const result = getSdwisCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.systems.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getSdwisForState', () => {
    it('filters by state abbreviation', async () => {
      const keyMD = gridKey(39.29, -76.61);
      const keyPA = gridKey(40.0, -75.0);
      await setSdwisCache({
        _meta: {
          built: new Date().toISOString(),
          systemCount: 2,
          violationCount: 2,
          enforcementCount: 0,
          statesProcessed: ['MD', 'PA'],
          gridCells: 2,
        },
        grid: {
          [keyMD]: {
            systems: [makeSdwisSystem({ pwsid: 'MD0300001', state: 'MD' })],
            violations: [makeSdwisViolation({ pwsid: 'MD0300001' })],
            enforcement: [],
          },
          [keyPA]: {
            systems: [makeSdwisSystem({ pwsid: 'PA0100001', state: 'PA', lat: 40.0, lng: -75.0 })],
            violations: [makeSdwisViolation({ pwsid: 'PA0100001', lat: 40.0, lng: -75.0 })],
            enforcement: [],
          },
        },
      });

      const mdData = getSdwisForState('MD');
      expect(mdData.systems.every(s => s.state === 'MD')).toBe(true);
      expect(mdData.systems.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty or null for unknown state', () => {
      const result = getSdwisForState('ZZ');
      if (result) {
        expect(result.systems).toHaveLength(0);
      } else {
        expect(result).toBeNull();
      }
    });
  });

  describe('isSdwisBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isSdwisBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setSdwisBuildInProgress(true);
      expect(isSdwisBuildInProgress()).toBe(true);
      setSdwisBuildInProgress(false);
      expect(isSdwisBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setSdwisBuildInProgress(true);
      expect(isSdwisBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isSdwisBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getSdwisAllData', () => {
    it('returns flat arrays from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setSdwisCache({
        _meta: {
          built: new Date().toISOString(),
          systemCount: 3,
          violationCount: 2,
          enforcementCount: 1,
          statesProcessed: ['MD'],
          gridCells: 2,
        },
        grid: {
          [key1]: {
            systems: [makeSdwisSystem({ pwsid: 'A' }), makeSdwisSystem({ pwsid: 'B' })],
            violations: [makeSdwisViolation({ pwsid: 'A' })],
            enforcement: [makeSdwisEnforcement({ pwsid: 'A' })],
          },
          [key2]: {
            systems: [makeSdwisSystem({ pwsid: 'C' })],
            violations: [makeSdwisViolation({ pwsid: 'C' })],
            enforcement: [],
          },
        },
      });

      const all = getSdwisAllData();
      expect(all.systems.length).toBeGreaterThanOrEqual(3);
      expect(all.violations.length).toBeGreaterThanOrEqual(2);
      expect(all.enforcement.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getSdwisCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setSdwisCache({
        _meta: {
          built: new Date().toISOString(),
          systemCount: 5,
          violationCount: 3,
          enforcementCount: 1,
          statesProcessed: ['MD', 'VA'],
          gridCells: 2,
        },
        grid: {},
      });

      const status = getSdwisCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
