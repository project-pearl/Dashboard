import { describe, it, expect, vi } from 'vitest';
import {
  getNwpsCache,
  setNwpsCache,
  isNwpsBuildInProgress,
  setNwpsBuildInProgress,
  getNwpsAllGauges,
  getNwpsCacheStatus,
  gridKey,
} from '@/lib/nwpsCache';
import { makeNwpsGauge } from '../../mocks/fixtures/nwps-sample-data';

describe('nwpsCache', () => {
  describe('getNwpsCache', () => {
    it('returns null when cache is cold', () => {
      const result = getNwpsCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns gauges after setNwpsCache', async () => {
      const key = gridKey(39.28, -76.61);
      await setNwpsCache({
        _meta: {
          built: new Date().toISOString(),
          gaugeCount: 1,
          gridCells: 1,
        },
        grid: {
          [key]: {
            gauges: [makeNwpsGauge()],
          },
        },
      });

      const result = getNwpsCache(39.28, -76.61);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(1);
    });

    it('returns null for coords outside grid', () => {
      const result = getNwpsCache(10.0, 10.0);
      expect(result).toBeNull();
    });

    it('aggregates 3x3 neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setNwpsCache({
        _meta: {
          built: new Date().toISOString(),
          gaugeCount: 2,
          gridCells: 2,
        },
        grid: {
          [key1]: { gauges: [makeNwpsGauge({ lid: 'AAA' })] },
          [key2]: { gauges: [makeNwpsGauge({ lid: 'BBB' })] },
        },
      });

      const result = getNwpsCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isNwpsBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isNwpsBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setNwpsBuildInProgress(true);
      expect(isNwpsBuildInProgress()).toBe(true);
      setNwpsBuildInProgress(false);
      expect(isNwpsBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setNwpsBuildInProgress(true);
      expect(isNwpsBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isNwpsBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getNwpsAllGauges', () => {
    it('returns flat array from all grid cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.1);
      await setNwpsCache({
        _meta: {
          built: new Date().toISOString(),
          gaugeCount: 3,
          gridCells: 2,
        },
        grid: {
          [key1]: { gauges: [makeNwpsGauge({ lid: 'A' }), makeNwpsGauge({ lid: 'B' })] },
          [key2]: { gauges: [makeNwpsGauge({ lid: 'C' })] },
        },
      });

      const all = getNwpsAllGauges();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getNwpsCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setNwpsCache({
        _meta: {
          built: new Date().toISOString(),
          gaugeCount: 5,
          gridCells: 2,
        },
        grid: {},
      });

      const status = getNwpsCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
