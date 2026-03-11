import { describe, it, expect, vi } from 'vitest';
import {
  getAlertsForState,
  setAlerts,
  setAlertsBulk,
  getAllAlerts,
  getAlertCacheStatus,
} from '@/lib/usgsAlertCache';
import { makeUsgsAlert } from '../../mocks/fixtures/usgs-alert-sample-data';

vi.mock('@/lib/blobPersistence', () => ({
  saveCacheToBlob: vi.fn().mockResolvedValue(undefined),
  loadCacheFromBlob: vi.fn().mockResolvedValue(null),
}));

describe('usgsAlertCache', () => {
  describe('getAlertsForState', () => {
    it('returns empty array when cache is cold', () => {
      const result = getAlertsForState('ZZ');
      expect(result).toEqual([]);
    });

    it('returns alerts after setAlerts', async () => {
      await setAlerts('MD', [makeUsgsAlert()]);

      const result = getAlertsForState('MD');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].siteNumber).toBe('01646500');
    });

    it('returns empty array for state with no alerts', async () => {
      await setAlerts('MD', [makeUsgsAlert()]);
      const result = getAlertsForState('ZZ');
      expect(result).toEqual([]);
    });

    it('is case-insensitive for state lookup', async () => {
      await setAlerts('md', [makeUsgsAlert({ state: 'MD' })]);
      const result = getAlertsForState('MD');
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('preserves alert severity and parameter fields', async () => {
      await setAlerts('VA', [
        makeUsgsAlert({
          state: 'VA',
          severity: 'warning',
          parameter: 'pH',
          value: 5.8,
        }),
      ]);

      const result = getAlertsForState('VA');
      expect(result.length).toBeGreaterThanOrEqual(1);
      const alert = result[0];
      expect(alert.severity).toBe('warning');
      expect(alert.parameter).toBe('pH');
      expect(alert.value).toBe(5.8);
    });
  });

  describe('setAlertsBulk', () => {
    it('sets alerts for multiple states at once', async () => {
      await setAlertsBulk({
        MD: [makeUsgsAlert({ state: 'MD', id: 'md-1' })],
        VA: [
          makeUsgsAlert({ state: 'VA', id: 'va-1' }),
          makeUsgsAlert({ state: 'VA', id: 'va-2', parameter: 'pH' }),
        ],
      });

      const md = getAlertsForState('MD');
      const va = getAlertsForState('VA');
      expect(md.length).toBeGreaterThanOrEqual(1);
      expect(va.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getAllAlerts', () => {
    it('returns flat array from all states', async () => {
      await setAlertsBulk({
        MD: [makeUsgsAlert({ state: 'MD', id: 'all-md-1' })],
        VA: [makeUsgsAlert({ state: 'VA', id: 'all-va-1' })],
      });

      const all = getAllAlerts();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getAlertCacheStatus', () => {
    it('returns cache metadata after population', async () => {
      await setAlerts('MD', [
        makeUsgsAlert({ severity: 'critical' }),
        makeUsgsAlert({ id: 'warn-1', severity: 'warning' }),
      ]);

      const status = getAlertCacheStatus();
      expect(status).toBeDefined();
      expect(status.loaded).toBe(true);
      expect(typeof status.built).toBe('string');
      expect(typeof status.alertCount).toBe('number');
    });
  });
});
