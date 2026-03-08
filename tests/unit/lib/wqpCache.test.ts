import { describe, it, expect, vi, beforeEach } from 'vitest';

// Because wqpCache is a singleton with module-level state, we need to
// re-import for each test file run. The `pool: 'forks'` config isolates this.
import {
  getWqpCache,
  setWqpCache,
  isWqpBuildInProgress,
  setWqpBuildInProgress,
  getWqpAllRecords,
  getWqpCacheStatus,
  gridKey,
} from '@/lib/wqpCache';
import { makeWqpRecord } from '../../mocks/fixtures/wqp-sample-records';

describe('wqpCache', () => {
  describe('getWqpCache', () => {
    it('returns null when cache is cold', () => {
      const result = getWqpCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns records after setWqpCache', async () => {
      const record = makeWqpRecord({ lat: 38.93, lng: -77.12 });
      const key = gridKey(38.93, -77.12);

      await setWqpCache({
        _meta: {
          built: new Date().toISOString(),
          totalRecords: 1,
          statesProcessed: ['DC'],
          gridCells: 1,
        },
        grid: {
          [key]: { records: [record] },
        },
      });

      const result = getWqpCache(38.93, -77.12);
      expect(result).not.toBeNull();
      expect(result!.data).toHaveLength(1);
      expect(result!.data[0].stn).toBe('USGS-01646500');
      expect(result!.fromCache).toBe(true);
    });

    it('returns null for coords outside grid', async () => {
      // Cache only has data near DC; query far away
      const result = getWqpCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const centerKey = gridKey(39.0, -77.0);
      const neighborKey = gridKey(39.1, -77.0); // one cell north
      const record1 = makeWqpRecord({ stn: 'STN-1', lat: 39.0, lng: -77.0 });
      const record2 = makeWqpRecord({ stn: 'STN-2', lat: 39.1, lng: -77.0 });

      await setWqpCache({
        _meta: {
          built: new Date().toISOString(),
          totalRecords: 2,
          statesProcessed: ['MD'],
          gridCells: 2,
        },
        grid: {
          [centerKey]: { records: [record1] },
          [neighborKey]: { records: [record2] },
        },
      });

      const result = getWqpCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('setWqpCache', () => {
    it('sets status to loaded', async () => {
      await setWqpCache({
        _meta: {
          built: new Date().toISOString(),
          totalRecords: 5,
          statesProcessed: ['MD'],
          gridCells: 1,
        },
        grid: { '39_-77': { records: [makeWqpRecord()] } },
      });

      const status = getWqpCacheStatus();
      expect(status.loaded).toBe(true);
    });
  });

  describe('isWqpBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isWqpBuildInProgress()).toBe(false);
    });

    it('can be set true and false', () => {
      setWqpBuildInProgress(true);
      expect(isWqpBuildInProgress()).toBe(true);
      setWqpBuildInProgress(false);
      expect(isWqpBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setWqpBuildInProgress(true);
      expect(isWqpBuildInProgress()).toBe(true);

      // Advance 13 minutes
      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isWqpBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getWqpAllRecords', () => {
    it('returns flat array after set', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setWqpCache({
        _meta: {
          built: new Date().toISOString(),
          totalRecords: 3,
          statesProcessed: ['MD'],
          gridCells: 2,
        },
        grid: {
          [key1]: { records: [makeWqpRecord({ stn: 'A' }), makeWqpRecord({ stn: 'B' })] },
          [key2]: { records: [makeWqpRecord({ stn: 'C' })] },
        },
      });

      const all = getWqpAllRecords();
      expect(all.length).toBeGreaterThanOrEqual(3);
      const ids = all.map(r => r.stn);
      expect(ids).toContain('A');
      expect(ids).toContain('B');
      expect(ids).toContain('C');
    });
  });
});
