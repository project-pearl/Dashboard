import { describe, it, expect, vi } from 'vitest';
import type { WaterQualityData, WaterQualityParameter } from '@/lib/types';

vi.mock('@/lib/mockData', () => ({
  getParameterStatus: (value: number, param: any) => {
    if (param.type === 'decreasing-bad') {
      return value >= 6 ? 'green' : value >= 5 ? 'yellow' : value >= 4 ? 'orange' : 'red';
    }
    const max = param.thresholds?.green?.max ?? 999;
    return value <= max ? 'green' : value <= (param.thresholds?.yellow?.max ?? max * 2) ? 'yellow' : 'red';
  },
}));

import {
  detectWaterQualityAlerts,
  getAlertColor,
  getAlertBadgeColor,
  getAlertIcon,
} from '@/lib/alertDetection';

function makeWQData(overrides?: Partial<Record<string, number>>): WaterQualityData {
  const mkParam = (
    name: string,
    value: number,
    unit: string,
    type: 'increasing-bad' | 'decreasing-bad',
  ): WaterQualityParameter => ({
    name,
    value,
    unit,
    min: 0,
    max: 100,
    type,
    thresholds:
      type === 'decreasing-bad'
        ? { green: { min: 6 }, yellow: { min: 5 }, orange: { min: 4 }, red: { min: 0 } }
        : { green: { max: 1 }, yellow: { max: 2 }, red: { max: 999 } },
  });

  return {
    location: 'Test',
    timestamp: new Date(),
    parameters: {
      DO: mkParam('DO', overrides?.DO ?? 8, 'mg/L', 'decreasing-bad'),
      turbidity: mkParam('Turbidity', overrides?.turbidity ?? 5, 'NTU', 'increasing-bad'),
      TN: mkParam('TN', overrides?.TN ?? 0.5, 'mg/L', 'increasing-bad'),
      TP: mkParam('TP', overrides?.TP ?? 0.05, 'mg/L', 'increasing-bad'),
      TSS: mkParam('TSS', overrides?.TSS ?? 10, 'mg/L', 'increasing-bad'),
      salinity: mkParam('Salinity', overrides?.salinity ?? 12, 'ppt', 'increasing-bad'),
    },
  };
}

describe('alertDetection', () => {
  describe('detectWaterQualityAlerts — DO alerts', () => {
    it('returns severe-low-do when DO < 4', () => {
      const data = makeWQData({ DO: 3 });
      const alerts = detectWaterQualityAlerts(data);
      const doAlert = alerts.find(a => a.type === 'severe-low-do');
      expect(doAlert).toBeDefined();
      expect(doAlert!.severity).toBe('severe');
    });

    it('returns low-do when DO is between 4 and 5', () => {
      const data = makeWQData({ DO: 4.5 });
      const alerts = detectWaterQualityAlerts(data);
      const doAlert = alerts.find(a => a.type === 'low-do');
      expect(doAlert).toBeDefined();
      expect(doAlert!.severity).toBe('caution');
    });

    it('returns no DO alerts when DO >= 5', () => {
      const data = makeWQData({ DO: 7 });
      const alerts = detectWaterQualityAlerts(data);
      const doAlerts = alerts.filter(a => a.type === 'low-do' || a.type === 'severe-low-do');
      expect(doAlerts).toHaveLength(0);
    });
  });

  describe('detectWaterQualityAlerts — nutrient alerts', () => {
    it('returns severe-nutrients when TN > 1.5', () => {
      const data = makeWQData({ TN: 2.0 });
      const alerts = detectWaterQualityAlerts(data);
      const nutrientAlert = alerts.find(a => a.type === 'severe-nutrients');
      expect(nutrientAlert).toBeDefined();
      expect(nutrientAlert!.severity).toBe('severe');
    });

    it('returns high-nutrients when TN is 1.0-1.5 and TP < 0.5', () => {
      const data = makeWQData({ TN: 1.2, TP: 0.3 });
      const alerts = detectWaterQualityAlerts(data);
      const nutrientAlert = alerts.find(a => a.type === 'high-nutrients');
      expect(nutrientAlert).toBeDefined();
      expect(nutrientAlert!.severity).toBe('caution');
    });

    it('returns no nutrient alerts when TN and TP are low', () => {
      const data = makeWQData({ TN: 0.5, TP: 0.1 });
      const alerts = detectWaterQualityAlerts(data);
      const nutrientAlerts = alerts.filter(
        a => a.type === 'severe-nutrients' || a.type === 'high-nutrients',
      );
      expect(nutrientAlerts).toHaveLength(0);
    });
  });

  describe('detectWaterQualityAlerts — salinity alerts', () => {
    it('returns salinity-anomaly when salinity < 5', () => {
      const data = makeWQData({ salinity: 3 });
      const alerts = detectWaterQualityAlerts(data);
      const salAlert = alerts.find(a => a.type === 'salinity-anomaly');
      expect(salAlert).toBeDefined();
      expect(salAlert!.severity).toBe('caution');
    });

    it('returns salinity-anomaly when salinity > 25', () => {
      const data = makeWQData({ salinity: 30 });
      const alerts = detectWaterQualityAlerts(data);
      const salAlert = alerts.find(a => a.type === 'salinity-anomaly');
      expect(salAlert).toBeDefined();
    });

    it('returns no salinity alert when salinity is in normal range', () => {
      const data = makeWQData({ salinity: 12 });
      const alerts = detectWaterQualityAlerts(data);
      const salAlerts = alerts.filter(a => a.type === 'salinity-anomaly');
      expect(salAlerts).toHaveLength(0);
    });
  });

  describe('detectWaterQualityAlerts — EJ area', () => {
    it('includes EJ text in alert message', () => {
      const data = makeWQData({ DO: 3 });
      const ejMetrics = {
        isEJArea: true,
        locationName: 'EJ Test',
        percentLowIncome: 40,
        percentMinority: 60,
        ejIndexScore: 75,
        dataSource: 'EPA EJScreen 2023',
        state: 'MD',
      };
      const alerts = detectWaterQualityAlerts(data, 'ambient', undefined, ejMetrics);
      const doAlert = alerts.find(a => a.type === 'severe-low-do');
      expect(doAlert).toBeDefined();
      expect(doAlert!.message).toContain('EJ');
    });

    it('includes EJ-specific recommendation', () => {
      const data = makeWQData({ DO: 3 });
      const ejMetrics = {
        isEJArea: true,
        locationName: 'EJ Test',
        percentLowIncome: 40,
        percentMinority: 60,
        ejIndexScore: 75,
        dataSource: 'EPA EJScreen 2023',
        state: 'MD',
      };
      const alerts = detectWaterQualityAlerts(data, 'ambient', undefined, ejMetrics);
      const doAlert = alerts.find(a => a.type === 'severe-low-do');
      expect(doAlert!.recommendations).toBeDefined();
      const ejRec = doAlert!.recommendations!.find(r => r.includes('EJ'));
      expect(ejRec).toBeDefined();
    });
  });

  describe('getAlertColor', () => {
    it('returns class containing red for severe', () => {
      expect(getAlertColor('severe')).toContain('red');
    });

    it('returns class containing yellow for caution', () => {
      expect(getAlertColor('caution')).toContain('yellow');
    });

    it('returns class containing blue for info', () => {
      expect(getAlertColor('info')).toContain('blue');
    });
  });

  describe('getAlertBadgeColor', () => {
    it('returns a string for severe', () => {
      expect(typeof getAlertBadgeColor('severe')).toBe('string');
      expect(getAlertBadgeColor('severe')).toContain('red');
    });

    it('returns a string for caution', () => {
      expect(typeof getAlertBadgeColor('caution')).toBe('string');
      expect(getAlertBadgeColor('caution')).toContain('yellow');
    });

    it('returns a string for info', () => {
      expect(typeof getAlertBadgeColor('info')).toBe('string');
      expect(getAlertBadgeColor('info')).toContain('blue');
    });
  });

  describe('getAlertIcon', () => {
    it('returns a string for each severity', () => {
      expect(typeof getAlertIcon('severe')).toBe('string');
      expect(typeof getAlertIcon('caution')).toBe('string');
      expect(typeof getAlertIcon('info')).toBe('string');
    });

    it('contains red for severe', () => {
      expect(getAlertIcon('severe')).toContain('red');
    });

    it('contains yellow for caution', () => {
      expect(getAlertIcon('caution')).toContain('yellow');
    });
  });
});
