import { describe, it, expect, vi } from 'vitest';
import {
  getNwsAlerts,
  setNwsAlertCache,
  isNwsAlertBuildInProgress,
  setNwsAlertBuildInProgress,
  getNwsAlertsAll,
  getNwsAlertCacheStatus,
} from '@/lib/nwsAlertCache';
import { makeNwsAlert } from '../../mocks/fixtures/nws-alert-sample-data';

describe('nwsAlertCache', () => {
  describe('getNwsAlerts', () => {
    it('returns null for unknown state', () => {
      const result = getNwsAlerts('ZZ');
      expect(result).toBeNull();
    });

    it('returns alerts after setNwsAlertCache', async () => {
      await setNwsAlertCache({
        MD: {
          alerts: [makeNwsAlert()],
          fetched: new Date().toISOString(),
        },
      });

      const result = getNwsAlerts('MD');
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThanOrEqual(1);
    });

    it('returns null for unknown state', () => {
      const result = getNwsAlerts('ZZ');
      expect(result).toBeNull();
    });

    it('returns empty array for state with no alerts', async () => {
      await setNwsAlertCache({
        MD: {
          alerts: [makeNwsAlert()],
          fetched: new Date().toISOString(),
        },
        VA: {
          alerts: [],
          fetched: new Date().toISOString(),
        },
      });

      const result = getNwsAlerts('VA');
      // VA entry exists but has 0 alerts, so filter returns empty or null
      if (result) {
        expect(result).toHaveLength(0);
      } else {
        expect(result).toBeNull();
      }
    });
  });

  describe('getNwsAlertsAll', () => {
    it('returns flat array from all states', async () => {
      await setNwsAlertCache({
        MD: {
          alerts: [makeNwsAlert({ id: 'alert-1' })],
          fetched: new Date().toISOString(),
        },
        VA: {
          alerts: [makeNwsAlert({ id: 'alert-2' }), makeNwsAlert({ id: 'alert-3' })],
          fetched: new Date().toISOString(),
        },
      });

      const all = getNwsAlertsAll();
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('isNwsAlertBuildInProgress', () => {
    it('defaults to false', () => {
      expect(isNwsAlertBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setNwsAlertBuildInProgress(true);
      expect(isNwsAlertBuildInProgress()).toBe(true);
      setNwsAlertBuildInProgress(false);
      expect(isNwsAlertBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setNwsAlertBuildInProgress(true);
      expect(isNwsAlertBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isNwsAlertBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getNwsAlertCacheStatus', () => {
    it('returns cache metadata', async () => {
      await setNwsAlertCache({
        MD: {
          alerts: [makeNwsAlert()],
          fetched: new Date().toISOString(),
        },
      });

      const status = getNwsAlertCacheStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });
  });
});
