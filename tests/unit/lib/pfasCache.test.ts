import { describe, it, expect, vi } from 'vitest';
import {
  getPfasCache,
  setPfasCache,
  isPfasBuildInProgress,
  setPfasBuildInProgress,
  getPfasAllResults,
  getPfasCacheStatus,
  gridKey,
} from '@/lib/pfasCache';
import { makePfasResult } from '../../mocks/fixtures/pfas-sample-data';

describe('pfasCache', () => {
  describe('getPfasCache', () => {
    it('returns null when cache is cold', () => {
      const result = getPfasCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns results after setPfasCache', async () => {
      const key = gridKey(39.0, -77.0);
      await setPfasCache({
        _meta: {
          built: new Date().toISOString(),
          resultCount: 1,
          tableName: 'UCMR5_ALL',
          gridCells: 1,
        },
        grid: {
          [key]: {
            results: [makePfasResult()],
          },
        },
      });

      const result = getPfasCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.results).toHaveLength(1);
      expect(result!.fromCache).toBe(true);
    });

    it('returns null for coords outside grid', () => {
      const result = getPfasCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setPfasCache({
        _meta: {
          built: new Date().toISOString(),
          resultCount: 2,
          tableName: 'UCMR5_ALL',
          gridCells: 2,
        },
        grid: {
          [key1]: { results: [makePfasResult({ facilityName: 'WTP-1' })] },
          [key2]: { results: [makePfasResult({ facilityName: 'WTP-2' })] },
        },
      });

      const result = getPfasCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('tableName metadata', () => {
    it('tracks UCMR5_ALL tableName', async () => {
      await setPfasCache({
        _meta: {
          built: new Date().toISOString(),
          resultCount: 1,
          tableName: 'UCMR5_ALL',
          gridCells: 1,
        },
        grid: { [gridKey(39.0, -77.0)]: { results: [makePfasResult()] } },
      });

      const status = getPfasCacheStatus();
      expect(status).toBeDefined();
    });

    it('handles null tableName (UCMR4 returned 404)', async () => {
      await setPfasCache({
        _meta: {
          built: new Date().toISOString(),
          resultCount: 0,
          tableName: null as any,
          gridCells: 0,
        },
        grid: {},
      });

      const status = getPfasCacheStatus();
      expect(status).toBeDefined();
    });
  });

  describe('isPfasBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isPfasBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setPfasBuildInProgress(true);
      expect(isPfasBuildInProgress()).toBe(true);
      setPfasBuildInProgress(false);
      expect(isPfasBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setPfasBuildInProgress(true);
      expect(isPfasBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isPfasBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getPfasAllResults', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setPfasCache({
        _meta: {
          built: new Date().toISOString(),
          resultCount: 3,
          tableName: 'UCMR5_ALL',
          gridCells: 2,
        },
        grid: {
          [key1]: { results: [makePfasResult({ facilityName: 'A' }), makePfasResult({ facilityName: 'B' })] },
          [key2]: { results: [makePfasResult({ facilityName: 'C' })] },
        },
      });

      const all = getPfasAllResults();
      expect(all.length).toBeGreaterThanOrEqual(3);
      const names = all.map(r => r.facilityName);
      expect(names).toContain('A');
      expect(names).toContain('B');
      expect(names).toContain('C');
    });
  });
});
