import { describe, it, expect, vi } from 'vitest';
import {
  getFemaDeclarations,
  getFemaDeclarationsAll,
  setFemaCache,
  isFemaBuildInProgress,
  setFemaBuildInProgress,
  getFemaCacheStatus,
  getFemaNfipCommunities,
  setFemaNfipCommunities,
  getFemaRiskIndex,
  setFemaRiskIndex,
} from '@/lib/femaCache';
import {
  makeFemaDeclaration,
  makeNfipCommunity,
  makeStateRiskIndex,
} from '../../mocks/fixtures/fema-sample-data';

vi.mock('@/lib/blobPersistence', () => ({
  saveCacheToBlob: vi.fn().mockResolvedValue(undefined),
  loadCacheFromBlob: vi.fn().mockResolvedValue(null),
}));

describe('femaCache', () => {
  describe('getFemaDeclarations', () => {
    it('returns null when cache is cold', () => {
      const result = getFemaDeclarations('ZZ');
      expect(result).toBeNull();
    });

    it('returns declarations after setFemaCache', async () => {
      await setFemaCache({
        MD: {
          declarations: [makeFemaDeclaration()],
          fetched: new Date().toISOString(),
        },
      });

      const result = getFemaDeclarations('MD');
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(1);
      expect(result![0].disasterNumber).toBe(4757);
    });

    it('returns null for unknown state after population', async () => {
      await setFemaCache({
        MD: {
          declarations: [makeFemaDeclaration()],
          fetched: new Date().toISOString(),
        },
      });

      const result = getFemaDeclarations('ZZ');
      expect(result).toBeNull();
    });

    it('preserves declaration fields', async () => {
      await setFemaCache({
        VA: {
          declarations: [
            makeFemaDeclaration({
              state: 'VA',
              incidentType: 'Hurricane',
              declarationTitle: 'Hurricane Ian',
              disasterNumber: 4680,
            }),
          ],
          fetched: new Date().toISOString(),
        },
      });

      const result = getFemaDeclarations('VA');
      expect(result).not.toBeNull();
      expect(result![0].incidentType).toBe('Hurricane');
      expect(result![0].declarationTitle).toBe('Hurricane Ian');
      expect(result![0].disasterNumber).toBe(4680);
    });
  });

  describe('getFemaDeclarationsAll', () => {
    it('returns flat array from all states', async () => {
      await setFemaCache({
        MD: {
          declarations: [makeFemaDeclaration({ disasterNumber: 1001 })],
          fetched: new Date().toISOString(),
        },
        VA: {
          declarations: [
            makeFemaDeclaration({ disasterNumber: 1002, state: 'VA' }),
            makeFemaDeclaration({ disasterNumber: 1003, state: 'VA' }),
          ],
          fetched: new Date().toISOString(),
        },
      });

      const all = getFemaDeclarationsAll();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('isFemaBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isFemaBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setFemaBuildInProgress(true);
      expect(isFemaBuildInProgress()).toBe(true);
      setFemaBuildInProgress(false);
      expect(isFemaBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setFemaBuildInProgress(true);
      expect(isFemaBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isFemaBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('NFIP Community sub-cache', () => {
    it('returns null for unknown state', () => {
      expect(getFemaNfipCommunities('ZZ')).toBeNull();
    });

    it('stores and retrieves communities by state', () => {
      setFemaNfipCommunities('MD', [makeNfipCommunity()]);
      const result = getFemaNfipCommunities('MD');
      expect(result).not.toBeNull();
      expect(result!.length).toBe(1);
      expect(result![0].communityName).toBe('Baltimore County');
    });
  });

  describe('State Risk Index sub-cache', () => {
    it('returns null for unknown state', () => {
      expect(getFemaRiskIndex('ZZ')).toBeNull();
    });

    it('stores and retrieves risk index by state', () => {
      setFemaRiskIndex('MD', makeStateRiskIndex());
      const result = getFemaRiskIndex('MD');
      expect(result).not.toBeNull();
      expect(result!.riskScore).toBe(15.3);
    });
  });

  describe('getFemaCacheStatus', () => {
    it('returns cache metadata after population', async () => {
      await setFemaCache({
        MD: {
          declarations: [makeFemaDeclaration()],
          fetched: new Date().toISOString(),
        },
      });

      const status = getFemaCacheStatus();
      expect(status).toBeDefined();
      expect(status.loaded).toBe(true);
      expect(typeof status.built).toBe('string');
      expect(typeof status.declarationCount).toBe('number');
    });
  });
});
