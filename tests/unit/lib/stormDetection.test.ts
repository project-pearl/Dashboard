import { describe, it, expect } from 'vitest';
import type { WaterQualityData, WaterQualityParameter, TimeSeriesPoint } from '@/lib/types';
import { detectStormEvent, analyzeStormPerformance } from '@/lib/stormDetection';

function makeStormData(
  tssBaseline: number,
  tssCurrent: number,
  turbBaseline?: number,
  turbCurrent?: number,
): WaterQualityData {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);

  const mkParam = (
    name: string,
    value: number,
    unit: string,
    history?: TimeSeriesPoint[],
  ): WaterQualityParameter => ({
    name,
    value,
    unit,
    min: 0,
    max: 500,
    type: 'increasing-bad' as const,
    thresholds: { green: { max: 50 }, yellow: { max: 100 }, red: { max: 999 } },
    history,
  });

  return {
    location: 'Test',
    timestamp: now,
    parameters: {
      DO: mkParam('DO', 7, 'mg/L', [
        { timestamp: oneHourAgo, value: 7 },
        { timestamp: now, value: 7 },
      ]),
      turbidity: mkParam(
        'Turbidity',
        turbCurrent ?? 10,
        'NTU',
        turbBaseline != null
          ? [
              { timestamp: oneHourAgo, value: turbBaseline },
              { timestamp: now, value: turbCurrent! },
            ]
          : undefined,
      ),
      TN: mkParam('TN', 0.5, 'mg/L'),
      TP: mkParam('TP', 0.05, 'mg/L'),
      TSS: mkParam('TSS', tssCurrent, 'mg/L', [
        { timestamp: oneHourAgo, value: tssBaseline },
        { timestamp: now, value: tssCurrent },
      ]),
      salinity: mkParam('Salinity', 12, 'ppt'),
    },
  };
}

describe('stormDetection', () => {
  describe('detectStormEvent', () => {
    it('detects a storm when TSS increases by 300%', () => {
      // baseline 50 → current 200 = 300% increase
      const data = makeStormData(50, 200);
      const result = detectStormEvent(data);
      expect(result).not.toBeNull();
      expect(result!.detected).toBe(true);
      expect(result!.triggers.tss).toBeDefined();
      expect(result!.triggers.tss!.increase).toBeGreaterThanOrEqual(200);
    });

    it('returns primary trigger type for TSS-only spike', () => {
      const data = makeStormData(50, 200);
      const result = detectStormEvent(data);
      expect(result).not.toBeNull();
      expect(result!.triggerType).toBe('primary');
    });

    it('returns null when TSS increase is only 100% with no other triggers', () => {
      // baseline 50 → current 100 = 100% increase (below 200% primary threshold)
      const data = makeStormData(50, 100);
      const result = detectStormEvent(data);
      expect(result).toBeNull();
    });

    it('detects combined trigger when TSS 200%+ and turbidity 100%+', () => {
      // TSS: 50 → 200 = 300% increase (primary)
      // Turbidity: 10 → 25 = 150% increase (supporting)
      const data = makeStormData(50, 200, 10, 25);
      const result = detectStormEvent(data);
      expect(result).not.toBeNull();
      expect(result!.triggerType).toBe('combined');
      expect(result!.triggers.tss).toBeDefined();
      expect(result!.triggers.turbidity).toBeDefined();
    });

    it('returns higher severity for combined triggers', () => {
      // Primary + supporting = at least moderate
      const data = makeStormData(50, 200, 10, 25);
      const result = detectStormEvent(data);
      expect(result).not.toBeNull();
      expect(['moderate', 'high']).toContain(result!.severity);
    });

    it('returns null when there is no TSS history', () => {
      const data: WaterQualityData = {
        location: 'Test',
        timestamp: new Date(),
        parameters: {
          DO: { name: 'DO', value: 7, unit: 'mg/L', min: 0, max: 15, type: 'decreasing-bad', thresholds: { green: { min: 6 }, yellow: { min: 5 }, red: { min: 0 } } },
          turbidity: { name: 'Turbidity', value: 10, unit: 'NTU', min: 0, max: 500, type: 'increasing-bad', thresholds: { green: { max: 50 }, yellow: { max: 100 }, red: { max: 999 } } },
          TN: { name: 'TN', value: 0.5, unit: 'mg/L', min: 0, max: 10, type: 'increasing-bad', thresholds: { green: { max: 1 }, yellow: { max: 2 }, red: { max: 999 } } },
          TP: { name: 'TP', value: 0.05, unit: 'mg/L', min: 0, max: 5, type: 'increasing-bad', thresholds: { green: { max: 0.5 }, yellow: { max: 1 }, red: { max: 999 } } },
          TSS: { name: 'TSS', value: 50, unit: 'mg/L', min: 0, max: 500, type: 'increasing-bad', thresholds: { green: { max: 50 }, yellow: { max: 100 }, red: { max: 999 } } },
          salinity: { name: 'Salinity', value: 12, unit: 'ppt', min: 0, max: 40, type: 'increasing-bad', thresholds: { green: { max: 20 }, yellow: { max: 30 }, red: { max: 999 } } },
        },
      };
      const result = detectStormEvent(data);
      expect(result).toBeNull();
    });

    it('includes description text when storm is detected', () => {
      const data = makeStormData(50, 200);
      const result = detectStormEvent(data);
      expect(result).not.toBeNull();
      expect(result!.description).toContain('Stormwater event detected');
      expect(result!.description).toContain('TSS');
    });

    it('includes recommendations when storm is detected', () => {
      const data = makeStormData(50, 200);
      const result = detectStormEvent(data);
      expect(result).not.toBeNull();
      expect(result!.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeStormPerformance', () => {
    function makeEvent(severity: 'high' | 'moderate' | 'low' = 'moderate') {
      const data = makeStormData(50, 200);
      const event = detectStormEvent(data)!;
      // Override severity for test control
      return { ...event, severity };
    }

    it('rates excellent for high removal efficiencies', () => {
      const event = makeEvent();
      const removal = { TSS: 95, TN: 80, TP: 80, turbidity: 90, DO: 5 };
      const result = analyzeStormPerformance(event, removal);
      expect(result.performanceRating).toBe('excellent');
    });

    it('rates good for adequate removal efficiencies', () => {
      const event = makeEvent();
      const removal = { TSS: 85, TN: 65, TP: 65, turbidity: 85, DO: 5 };
      const result = analyzeStormPerformance(event, removal);
      expect(result.performanceRating).toBe('good');
    });

    it('rates poor for very low removal efficiencies', () => {
      const event = makeEvent();
      const removal = { TSS: 40, TN: 30, TP: 30, turbidity: 40, DO: 5 };
      const result = analyzeStormPerformance(event, removal);
      expect(result.performanceRating).toBe('poor');
    });

    it('rates marginal for borderline removal efficiencies', () => {
      const event = makeEvent();
      const removal = { TSS: 65, TN: 50, TP: 50, turbidity: 60, DO: 5 };
      const result = analyzeStormPerformance(event, removal);
      expect(result.performanceRating).toBe('marginal');
    });

    it('returns insights array', () => {
      const event = makeEvent();
      const removal = { TSS: 95, TN: 80, TP: 80, turbidity: 90, DO: 5 };
      const result = analyzeStormPerformance(event, removal);
      expect(Array.isArray(result.insights)).toBe(true);
      expect(result.insights.length).toBeGreaterThan(0);
    });

    it('returns risks for poor TSS removal', () => {
      const event = makeEvent();
      const removal = { TSS: 40, TN: 30, TP: 30, turbidity: 40, DO: 5 };
      const result = analyzeStormPerformance(event, removal);
      expect(result.risks.length).toBeGreaterThan(0);
      const sedimentRisk = result.risks.find(r => r.includes('sediment'));
      expect(sedimentRisk).toBeDefined();
    });

    it('returns maintenance actions for poor performance', () => {
      const event = makeEvent();
      const removal = { TSS: 40, TN: 30, TP: 30, turbidity: 40, DO: 5 };
      const result = analyzeStormPerformance(event, removal);
      expect(result.maintenanceActions.length).toBeGreaterThan(0);
    });

    it('notes BMP capacity validated for excellent performance in high-severity storm', () => {
      const event = makeEvent('high');
      const removal = { TSS: 95, TN: 80, TP: 80, turbidity: 90, DO: 5 };
      const result = analyzeStormPerformance(event, removal);
      const capacityInsight = result.insights.find(i => i.includes('capacity validated'));
      expect(capacityInsight).toBeDefined();
    });
  });
});
