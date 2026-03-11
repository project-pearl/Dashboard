import { describe, it, expect, vi } from 'vitest';
import {
  getCdcNwssCache,
  setCdcNwssCache,
  isCdcNwssBuildInProgress,
  setCdcNwssBuildInProgress,
  getCdcNwssAllStates,
  getCdcNwssCacheStatus,
} from '@/lib/cdcNwssCache';
import { makeCdcNwssRecord } from '../../mocks/fixtures/cdc-nwss-sample-data';

describe('cdcNwssCache', () => {
  describe('getCdcNwssCache', () => {
    it('returns null when cache is cold', () => {
      const result = getCdcNwssCache('MD');
      expect(result).toBeNull();
    });

    it('returns records after setCdcNwssCache', async () => {
      await setCdcNwssCache({
        _meta: {
          built: new Date().toISOString(),
          recordCount: 1,
          stateCount: 1,
          countyCount: 1,
          totalPopulationServed: 620000,
        },
        states: {
          MD: {
            records: [makeCdcNwssRecord()],
            counties: 1,
            totalPopulationServed: 620000,
          },
        },
      });

      const result = getCdcNwssCache('MD');
      expect(result).not.toBeNull();
      expect(result!.records).toHaveLength(1);
      expect(result!.fromCache).toBe(true);
    });

    it('returns null for unknown state', () => {
      const result = getCdcNwssCache('ZZ');
      expect(result).toBeNull();
    });
  });

  describe('getCdcNwssAllStates', () => {
    it('returns all states record after set', async () => {
      await setCdcNwssCache({
        _meta: {
          built: new Date().toISOString(),
          recordCount: 2,
          stateCount: 2,
          countyCount: 2,
          totalPopulationServed: 1000000,
        },
        states: {
          MD: {
            records: [makeCdcNwssRecord()],
            counties: 1,
            totalPopulationServed: 620000,
          },
          VA: {
            records: [makeCdcNwssRecord({ wwtpJurisdiction: 'VA', countyFips: '51510' })],
            counties: 1,
            totalPopulationServed: 380000,
          },
        },
      });

      const all = getCdcNwssAllStates();
      expect(all).not.toBeNull();
      expect(Object.keys(all!)).toContain('MD');
      expect(Object.keys(all!)).toContain('VA');
    });
  });

  describe('isCdcNwssBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isCdcNwssBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setCdcNwssBuildInProgress(true);
      expect(isCdcNwssBuildInProgress()).toBe(true);
      setCdcNwssBuildInProgress(false);
      expect(isCdcNwssBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setCdcNwssBuildInProgress(true);
      expect(isCdcNwssBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isCdcNwssBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getCdcNwssCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setCdcNwssCache({
        _meta: {
          built: new Date().toISOString(),
          recordCount: 5,
          stateCount: 3,
          countyCount: 10,
          totalPopulationServed: 2000000,
        },
        states: {},
      });

      const status = getCdcNwssCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
