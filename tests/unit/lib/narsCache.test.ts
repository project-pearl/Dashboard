import { describe, it, expect, vi } from 'vitest';
import {
  getNarsCache,
  setNarsCache,
  isNarsBuildInProgress,
  setNarsBuildInProgress,
  getNarsAllSites,
  getNarsCacheStatus,
  gridKey,
} from '@/lib/narsCache';
import { makeNarsSite } from '../../mocks/fixtures/nars-sample-data';

describe('narsCache', () => {
  describe('getNarsCache', () => {
    it('returns null when cache is cold', () => {
      const result = getNarsCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns sites after setNarsCache', async () => {
      const key = gridKey(39.42, -76.55);
      await setNarsCache({
        _meta: {
          built: new Date().toISOString(),
          siteCount: 1,
          surveys: ['NLA'],
          statesWithData: ['MD'],
          gridCells: 1,
        },
        grid: {
          [key]: {
            sites: [makeNarsSite()],
          },
        },
      });

      const result = getNarsCache(39.42, -76.55);
      expect(result).not.toBeNull();
      expect(result!.sites).toHaveLength(1);
      expect(result!.fromCache).toBe(true);
    });

    it('returns null for coords outside grid', () => {
      const result = getNarsCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setNarsCache({
        _meta: {
          built: new Date().toISOString(),
          siteCount: 2,
          surveys: ['NLA'],
          statesWithData: ['MD'],
          gridCells: 2,
        },
        grid: {
          [key1]: { sites: [makeNarsSite({ siteId: 'A' })] },
          [key2]: { sites: [makeNarsSite({ siteId: 'B' })] },
        },
      });

      const result = getNarsCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.sites.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isNarsBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isNarsBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setNarsBuildInProgress(true);
      expect(isNarsBuildInProgress()).toBe(true);
      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isNarsBuildInProgress()).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('getNarsAllSites', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setNarsCache({
        _meta: {
          built: new Date().toISOString(),
          siteCount: 3,
          surveys: ['NLA'],
          statesWithData: ['MD'],
          gridCells: 2,
        },
        grid: {
          [key1]: { sites: [makeNarsSite({ siteId: 'A' }), makeNarsSite({ siteId: 'B' })] },
          [key2]: { sites: [makeNarsSite({ siteId: 'C' })] },
        },
      });

      const all = getNarsAllSites();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getNarsCacheStatus', () => {
    it('returns cache metadata', () => {
      const status = getNarsCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
