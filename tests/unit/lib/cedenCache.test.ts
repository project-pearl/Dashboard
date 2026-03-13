import { describe, it, expect, vi } from 'vitest';
import {
  getCedenCache,
  setCedenCache,
  isCedenBuildInProgress,
  setCedenBuildInProgress,
  getCedenCacheStatus,
  gridKey,
} from '@/lib/cedenCache';
import { makeChemRecord, makeToxRecord } from '../../mocks/fixtures/ceden-sample-data';

describe('cedenCache', () => {
  describe('getCedenCache', () => {
    it('returns null when cache is cold', () => {
      const result = getCedenCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns both arrays after setCedenCache', async () => {
      const key = gridKey(38.46, -121.50);
      await setCedenCache({
        _meta: {
          built: new Date().toISOString(),
          chemistry_records: 1,
          toxicity_records: 1,
          grid_resolution: 0.1,
          chemistry_stations: 1,
          toxicity_stations: 1,
        },
        grid: {
          [key]: {
            chemistry: [makeChemRecord()],
            toxicity: [makeToxRecord()],
          },
        },
      });

      const result = getCedenCache(38.46, -121.50);
      expect(result).not.toBeNull();
      expect(result!.chemistry).toHaveLength(1);
      expect(result!.toxicity).toHaveLength(1);
      expect(result!.fromCache).toBe(true);
    });

    it('returns null for coords outside grid', () => {
      const result = getCedenCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(38.0, -121.0);
      const key2 = gridKey(38.1, -121.0);
      await setCedenCache({
        _meta: {
          built: new Date().toISOString(),
          chemistry_records: 2,
          toxicity_records: 0,
          grid_resolution: 0.1,
          chemistry_stations: 2,
          toxicity_stations: 0,
        },
        grid: {
          [key1]: { chemistry: [makeChemRecord({ stn: 'A' })], toxicity: [] },
          [key2]: { chemistry: [makeChemRecord({ stn: 'B' })], toxicity: [] },
        },
      });

      const result = getCedenCache(38.0, -121.0);
      expect(result).not.toBeNull();
      expect(result!.chemistry.length).toBeGreaterThanOrEqual(2);
    });

    it('preserves chemistry record fields', async () => {
      const key = gridKey(38.46, -121.50);
      await setCedenCache({
        _meta: {
          built: new Date().toISOString(),
          chemistry_records: 1,
          toxicity_records: 0,
          grid_resolution: 0.1,
          chemistry_stations: 1,
          toxicity_stations: 0,
        },
        grid: {
          [key]: {
            chemistry: [makeChemRecord({ analyte: 'Dissolved Oxygen', val: 8.5 })],
            toxicity: [],
          },
        },
      });

      const result = getCedenCache(38.46, -121.50);
      expect(result!.chemistry[0].analyte).toBe('Dissolved Oxygen');
      expect(result!.chemistry[0].val).toBe(8.5);
    });

    it('preserves toxicity record fields', async () => {
      const key = gridKey(38.46, -121.50);
      await setCedenCache({
        _meta: {
          built: new Date().toISOString(),
          chemistry_records: 0,
          toxicity_records: 1,
          grid_resolution: 0.1,
          chemistry_stations: 0,
          toxicity_stations: 1,
        },
        grid: {
          [key]: {
            chemistry: [],
            toxicity: [makeToxRecord({ organism: 'Ceriodaphnia dubia', sig: 'SL' })],
          },
        },
      });

      const result = getCedenCache(38.46, -121.50);
      expect(result!.toxicity[0].organism).toBe('Ceriodaphnia dubia');
      expect(result!.toxicity[0].sig).toBe('SL');
    });
  });

  describe('isCedenBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isCedenBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setCedenBuildInProgress(true);
      expect(isCedenBuildInProgress()).toBe(true);
      setCedenBuildInProgress(false);
      expect(isCedenBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setCedenBuildInProgress(true);
      expect(isCedenBuildInProgress()).toBe(true);
      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isCedenBuildInProgress()).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('getCedenCacheStatus', () => {
    it('returns cache metadata', () => {
      const status = getCedenCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
