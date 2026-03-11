import { describe, it, expect, vi } from 'vitest';
import {
  getCacheStatus,
  getAttainsCache,
  getAttainsCacheSummary,
  getHuc12Summary,
  setHuc12Summaries,
  type Huc12Summary,
} from '@/lib/attainsCache';
import {
  makeWaterbody,
  makeStateSummary,
} from '../../mocks/fixtures/attains-sample-state';

describe('attainsCache', () => {
  describe('getCacheStatus', () => {
    it('returns a valid CacheStatus object', () => {
      const status = getCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status.status).toBe('string');
      expect(['cold', 'building', 'ready', 'stale']).toContain(status.status);
    });

    it('has totalStates of 51 (50 states + DC)', () => {
      const status = getCacheStatus();
      expect(status.totalStates).toBe(51);
    });

    it('has loadedStates as a number', () => {
      const status = getCacheStatus();
      expect(typeof status.loadedStates).toBe('number');
      expect(status.loadedStates).toBeGreaterThanOrEqual(0);
    });

    it('statesLoaded + statesMissing = totalStates', () => {
      const status = getCacheStatus();
      expect(status.statesLoaded.length + status.statesMissing.length).toBe(status.totalStates);
    });

    it('returns arrays for statesLoaded and statesMissing', () => {
      const status = getCacheStatus();
      expect(status.statesLoaded).toBeInstanceOf(Array);
      expect(status.statesMissing).toBeInstanceOf(Array);
    });

    it('includes source field (nullable)', () => {
      const status = getCacheStatus();
      expect(status).toHaveProperty('source');
    });

    it('includes lastDelta field', () => {
      const status = getCacheStatus();
      expect(status).toHaveProperty('lastDelta');
    });
  });

  describe('getAttainsCache', () => {
    it('returns cacheStatus and states', () => {
      const response = getAttainsCache();
      expect(response).toBeDefined();
      expect(response.cacheStatus).toBeDefined();
      expect(response.states).toBeDefined();
      expect(typeof response.states).toBe('object');
    });

    it('cacheStatus has expected shape', () => {
      const { cacheStatus } = getAttainsCache();
      expect(cacheStatus).toHaveProperty('status');
      expect(cacheStatus).toHaveProperty('source');
      expect(cacheStatus).toHaveProperty('loadedStates');
      expect(cacheStatus).toHaveProperty('totalStates');
      expect(cacheStatus).toHaveProperty('lastBuilt');
      expect(cacheStatus).toHaveProperty('statesLoaded');
      expect(cacheStatus).toHaveProperty('statesMissing');
    });

    it('returns a shallow copy of states (not the internal reference)', () => {
      const resp1 = getAttainsCache();
      const resp2 = getAttainsCache();
      expect(resp1.states).not.toBe(resp2.states);
    });
  });

  describe('getAttainsCacheSummary', () => {
    it('returns cacheStatus and states', () => {
      const summary = getAttainsCacheSummary();
      expect(summary).toHaveProperty('cacheStatus');
      expect(summary).toHaveProperty('states');
    });

    it('strips waterbodies from state summaries', () => {
      const summary = getAttainsCacheSummary();
      for (const state of Object.values(summary.states)) {
        expect(state).not.toHaveProperty('waterbodies');
        // Should still have other StateSummary fields
        expect(state).toHaveProperty('state');
        expect(state).toHaveProperty('total');
        expect(state).toHaveProperty('high');
        expect(state).toHaveProperty('medium');
        expect(state).toHaveProperty('low');
        expect(state).toHaveProperty('none');
      }
    });
  });

  describe('getHuc12Summary / setHuc12Summaries', () => {
    it('returns null for unknown HUC-12', () => {
      expect(getHuc12Summary('999999999999')).toBeNull();
    });

    it('returns correct data after setHuc12Summaries', () => {
      const huc12Data: Huc12Summary = {
        huc12: '020700100101',
        assessmentUnitCount: 5,
        impairedCount: 2,
        tmdlCount: 1,
        causeCount: 3,
      };
      setHuc12Summaries([huc12Data]);
      const result = getHuc12Summary('020700100101');
      expect(result).not.toBeNull();
      expect(result!.huc12).toBe('020700100101');
      expect(result!.assessmentUnitCount).toBe(5);
      expect(result!.impairedCount).toBe(2);
      expect(result!.tmdlCount).toBe(1);
      expect(result!.causeCount).toBe(3);
    });

    it('overwrites existing HUC-12 data on re-set', () => {
      setHuc12Summaries([{
        huc12: '020700100101',
        assessmentUnitCount: 20,
        impairedCount: 8,
        tmdlCount: 4,
        causeCount: 10,
      }]);
      const result = getHuc12Summary('020700100101');
      expect(result!.assessmentUnitCount).toBe(20);
      expect(result!.impairedCount).toBe(8);
    });

    it('sets multiple HUC-12 summaries at once', () => {
      setHuc12Summaries([
        { huc12: 'ZZZ000000001', assessmentUnitCount: 5, impairedCount: 1, tmdlCount: 0, causeCount: 2 },
        { huc12: 'ZZZ000000002', assessmentUnitCount: 10, impairedCount: 3, tmdlCount: 1, causeCount: 4 },
      ]);
      expect(getHuc12Summary('ZZZ000000001')).not.toBeNull();
      expect(getHuc12Summary('ZZZ000000002')).not.toBeNull();
      expect(getHuc12Summary('ZZZ000000001')!.assessmentUnitCount).toBe(5);
      expect(getHuc12Summary('ZZZ000000002')!.assessmentUnitCount).toBe(10);
    });

    it('returns null still for unrelated HUC-12 after set', () => {
      expect(getHuc12Summary('XXXXXX999999')).toBeNull();
    });
  });

  describe('build lock auto-clear', () => {
    it('getCacheStatus never returns stuck building status in cold process', () => {
      // In a fresh fork (pool:'forks'), no build was started.
      // The cache should NOT be in 'building' state.
      const status = getCacheStatus();
      expect(['cold', 'ready', 'stale']).toContain(status.status);
    });
  });

  describe('fixture factories', () => {
    it('makeWaterbody creates a valid CachedWaterbody with defaults', () => {
      const wb = makeWaterbody();
      expect(wb.id).toBe('MD-02130903');
      expect(wb.name).toBe('Middle Branch Patapsco River');
      expect(wb.category).toBe('5');
      expect(wb.alertLevel).toBe('high');
      expect(wb.tmdlStatus).toBe('needed');
      expect(wb.causes).toEqual(['Nutrients', 'Sediment']);
      expect(wb.causeCount).toBe(2);
      expect(wb.lat).toBe(39.26);
      expect(wb.lon).toBe(-76.62);
    });

    it('makeWaterbody respects overrides', () => {
      const wb = makeWaterbody({ id: 'VA-test', alertLevel: 'low', tmdlStatus: 'completed' });
      expect(wb.id).toBe('VA-test');
      expect(wb.alertLevel).toBe('low');
      expect(wb.tmdlStatus).toBe('completed');
      // Non-overridden fields keep defaults
      expect(wb.name).toBe('Middle Branch Patapsco River');
    });

    it('makeStateSummary creates a valid StateSummary with defaults', () => {
      const ss = makeStateSummary();
      expect(ss.state).toBe('MD');
      expect(ss.total).toBe(100);
      expect(ss.fetched).toBe(80);
      expect(ss.stored).toBe(80);
      expect(ss.high).toBe(30);
      expect(ss.medium).toBe(20);
      expect(ss.low).toBe(15);
      expect(ss.none).toBe(35);
      expect(ss.tmdlNeeded).toBe(30);
      expect(ss.tmdlCompleted).toBe(15);
      expect(ss.tmdlAlternative).toBe(5);
      expect(ss.waterbodies).toHaveLength(1);
      expect(ss.topCauses).toHaveLength(5);
    });

    it('makeStateSummary respects overrides', () => {
      const ss = makeStateSummary({ state: 'VA', total: 200, high: 50 });
      expect(ss.state).toBe('VA');
      expect(ss.total).toBe(200);
      expect(ss.high).toBe(50);
      // Non-overridden fields keep defaults
      expect(ss.medium).toBe(20);
      expect(ss.low).toBe(15);
    });
  });
});
