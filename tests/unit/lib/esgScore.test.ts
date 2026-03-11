import { describe, it, expect, vi } from 'vitest';
import type { WaterQualityData, WaterQualityParameter } from '@/lib/types';

vi.mock('@/lib/mockData', () => ({
  getParameterStatus: (value: number, param: any) => {
    if (param.type === 'decreasing-bad') {
      return value >= 6 ? 'green' : value >= 5 ? 'yellow' : value >= 4 ? 'orange' : 'red';
    }
    // increasing-bad: lower is better
    const max = param.thresholds?.green?.max ?? 999;
    return value <= max ? 'green' : value <= (param.thresholds?.yellow?.max ?? max * 2) ? 'yellow' : 'red';
  },
}));

import {
  calculateESGScore,
  generateESGTrendData,
  generateESGReport,
} from '@/lib/esgScore';

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
      turbidity: mkParam('Turbidity', overrides?.turbidity ?? 0.5, 'NTU', 'increasing-bad'),
      TN: mkParam('TN', overrides?.TN ?? 0.5, 'mg/L', 'increasing-bad'),
      TP: mkParam('TP', overrides?.TP ?? 0.05, 'mg/L', 'increasing-bad'),
      TSS: mkParam('TSS', overrides?.TSS ?? 0.8, 'mg/L', 'increasing-bad'),
      salinity: mkParam('Salinity', overrides?.salinity ?? 0.5, 'ppt', 'increasing-bad'),
    },
  };
}

describe('esgScore', () => {
  describe('calculateESGScore', () => {
    it('returns grade A or B for good parameters', () => {
      const data = makeWQData();
      const result = calculateESGScore(data);
      expect(result.overall).toBeGreaterThanOrEqual(80);
      expect(['A', 'B']).toContain(result.grade);
    });

    it('returns grade D or F for poor parameters', () => {
      const data = makeWQData({ DO: 3, TN: 3, TP: 2 });
      const result = calculateESGScore(data);
      expect(['D', 'F']).toContain(result.grade);
    });

    it('includes all component fields in the 0-100 range', () => {
      const data = makeWQData();
      const result = calculateESGScore(data);
      const { waterQuality, pollutantReduction, riskManagement, transparency } =
        result.components;

      expect(waterQuality).toBeGreaterThanOrEqual(0);
      expect(waterQuality).toBeLessThanOrEqual(100);
      expect(pollutantReduction).toBeGreaterThanOrEqual(0);
      expect(pollutantReduction).toBeLessThanOrEqual(100);
      expect(riskManagement).toBeGreaterThanOrEqual(0);
      expect(riskManagement).toBeLessThanOrEqual(100);
      expect(transparency).toBeGreaterThanOrEqual(0);
      expect(transparency).toBeLessThanOrEqual(100);
    });

    it('sets pollutantReduction near 90 when removal efficiencies are 90%', () => {
      const data = makeWQData();
      const removal = { TSS: 90, TN: 90, TP: 90, turbidity: 90, DO: 90 };
      const result = calculateESGScore(data, removal);
      expect(result.components.pollutantReduction).toBe(90);
    });

    it('defaults pollutantReduction to 50 without removal efficiencies', () => {
      const data = makeWQData();
      const result = calculateESGScore(data);
      expect(result.components.pollutantReduction).toBe(50);
    });

    it('reduces riskManagement score with alert count', () => {
      const data = makeWQData();
      const noAlerts = calculateESGScore(data, undefined, undefined, 0);
      const withAlerts = calculateESGScore(data, undefined, undefined, 3);
      expect(withAlerts.components.riskManagement).toBeLessThan(
        noAlerts.components.riskManagement,
      );
    });

    it('returns waterRiskLevel High when alertCount > 2', () => {
      const data = makeWQData();
      const result = calculateESGScore(data, undefined, undefined, 3);
      expect(result.waterRiskLevel).toBe('High');
    });

    it('returns waterRiskLevel Low when no alerts and good quality', () => {
      const data = makeWQData();
      const result = calculateESGScore(data, undefined, undefined, 0);
      expect(result.waterRiskLevel).toBe('Low');
    });

    it('includes improvementTips array', () => {
      const data = makeWQData({ DO: 3 });
      const result = calculateESGScore(data, undefined, undefined, 2);
      expect(Array.isArray(result.improvementTips)).toBe(true);
      expect(result.improvementTips.length).toBeGreaterThan(0);
    });
  });

  describe('generateESGTrendData', () => {
    it('returns exactly 12 monthly points', () => {
      const points = generateESGTrendData(75);
      expect(points).toHaveLength(12);
    });

    it('returns scores between 0 and 100', () => {
      const points = generateESGTrendData(50);
      for (const p of points) {
        expect(p.score).toBeGreaterThanOrEqual(0);
        expect(p.score).toBeLessThanOrEqual(100);
      }
    });

    it('each point has a date and score', () => {
      const points = generateESGTrendData(80);
      for (const p of points) {
        expect(p.date).toBeInstanceOf(Date);
        expect(typeof p.score).toBe('number');
      }
    });
  });

  describe('generateESGReport', () => {
    it('contains SUSTAINABILITY in the report', () => {
      const data = makeWQData();
      const score = calculateESGScore(data);
      const report = generateESGReport(score, 'Chesapeake Bay', data);
      expect(report).toContain('SUSTAINABILITY');
    });

    it('contains the region name', () => {
      const data = makeWQData();
      const score = calculateESGScore(data);
      const report = generateESGReport(score, 'Chesapeake Bay', data);
      expect(report).toContain('Chesapeake Bay');
    });

    it('contains the overall score', () => {
      const data = makeWQData();
      const score = calculateESGScore(data);
      const report = generateESGReport(score, 'Test Region', data);
      expect(report).toContain(`${score.overall}/100`);
    });

    it('includes EJ section when ejMetrics provided', () => {
      const data = makeWQData();
      const score = calculateESGScore(data);
      const ejMetrics = {
        isEJArea: true,
        locationName: 'Test EJ',
        percentLowIncome: 40,
        percentMinority: 60,
        ejIndexScore: 75,
        dataSource: 'EPA EJScreen 2023',
        state: 'MD',
      };
      const report = generateESGReport(score, 'Test Region', data, ejMetrics);
      expect(report).toContain('EJ-Designated Area: YES');
      expect(report).toContain('40%');
    });

    it('says NO EJ designation when ejMetrics not provided', () => {
      const data = makeWQData();
      const score = calculateESGScore(data);
      const report = generateESGReport(score, 'Test Region', data);
      expect(report).toContain('EJ-Designated Area: NO');
    });
  });
});
