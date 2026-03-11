import { describe, it, expect, vi } from 'vitest';
import {
  getSsoCsoCache,
  setSsoCsoCache,
  isSsoCsoBuildInProgress,
  setSsoCsoBuildInProgress,
  getSsoCsoAll,
  getSsoCsoCacheStatus,
  gridKey,
} from '@/lib/ssoCsoCache';
import { makeSsoEvent } from '../../mocks/fixtures/sso-cso-sample-data';

describe('ssoCsoCache', () => {
  describe('getSsoCsoCache', () => {
    it('returns null when cache is cold', () => {
      const result = getSsoCsoCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns events after setSsoCsoCache', async () => {
      const key = gridKey(39.24, -76.53);
      await setSsoCsoCache({
        _meta: {
          built: new Date().toISOString(),
          eventCount: 1,
          gridCells: 1,
        },
        grid: {
          [key]: {
            events: [makeSsoEvent()],
          },
        },
      });

      const result = getSsoCsoCache(39.24, -76.53);
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].facilityName).toBe('Back River WWTP');
    });

    it('returns null for coords outside grid', () => {
      const result = getSsoCsoCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setSsoCsoCache({
        _meta: {
          built: new Date().toISOString(),
          eventCount: 2,
          gridCells: 2,
        },
        grid: {
          [key1]: {
            events: [makeSsoEvent({ npdesId: 'A' })],
          },
          [key2]: {
            events: [makeSsoEvent({ npdesId: 'B' })],
          },
        },
      });

      const result = getSsoCsoCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isSsoCsoBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isSsoCsoBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setSsoCsoBuildInProgress(true);
      expect(isSsoCsoBuildInProgress()).toBe(true);
      setSsoCsoBuildInProgress(false);
      expect(isSsoCsoBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setSsoCsoBuildInProgress(true);
      expect(isSsoCsoBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isSsoCsoBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getSsoCsoAll', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setSsoCsoCache({
        _meta: {
          built: new Date().toISOString(),
          eventCount: 3,
          gridCells: 2,
        },
        grid: {
          [key1]: {
            events: [makeSsoEvent({ npdesId: 'A' }), makeSsoEvent({ npdesId: 'B' })],
          },
          [key2]: {
            events: [makeSsoEvent({ npdesId: 'C' })],
          },
        },
      });

      const all = getSsoCsoAll();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getSsoCsoCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setSsoCsoCache({
        _meta: {
          built: new Date().toISOString(),
          eventCount: 5,
          gridCells: 2,
        },
        grid: {},
      });

      const status = getSsoCsoCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
