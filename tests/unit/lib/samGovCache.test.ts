import { describe, it, expect, vi } from 'vitest';
import {
  getSamEntities,
  getSamAllEntities,
  setSamCache,
  isSamBuildInProgress,
  setSamBuildInProgress,
  getSamCacheStatus,
} from '@/lib/samGovCache';
import { makeSamEntity } from '../../mocks/fixtures/sam-gov-sample-data';

describe('samGovCache', () => {
  describe('getSamEntities', () => {
    it('returns empty array for unknown state', () => {
      const result = getSamEntities('ZZ');
      expect(result).toEqual([]);
    });

    it('returns entities after setSamCache', async () => {
      await setSamCache(
        { MD: [makeSamEntity()] },
        {
          built: new Date().toISOString(),
          entityCount: 1,
          statesLoaded: 1,
          requestCount: 1,
        },
      );

      const result = getSamEntities('MD');
      expect(result).toHaveLength(1);
      expect(result[0].legalBusinessName).toBe('Test Environmental Services LLC');
    });

    it('returns empty array for unknown state', () => {
      const result = getSamEntities('ZZ');
      expect(result).toEqual([]);
    });
  });

  describe('getSamAllEntities', () => {
    it('returns flat array from all states', async () => {
      await setSamCache(
        {
          MD: [makeSamEntity({ ueiSAM: 'A' }), makeSamEntity({ ueiSAM: 'B' })],
          VA: [makeSamEntity({ ueiSAM: 'C', stateCode: 'VA' })],
        },
        {
          built: new Date().toISOString(),
          entityCount: 3,
          statesLoaded: 2,
          requestCount: 2,
        },
      );

      const all = getSamAllEntities();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('isSamBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isSamBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setSamBuildInProgress(true);
      expect(isSamBuildInProgress()).toBe(true);
      setSamBuildInProgress(false);
      expect(isSamBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setSamBuildInProgress(true);
      expect(isSamBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isSamBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getSamCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setSamCache(
        { MD: [makeSamEntity()] },
        {
          built: new Date().toISOString(),
          entityCount: 5,
          statesLoaded: 3,
          requestCount: 3,
        },
      );

      const status = getSamCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
