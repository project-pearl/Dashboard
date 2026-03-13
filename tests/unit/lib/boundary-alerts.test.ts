import { describe, it, expect } from 'vitest';
import {
  buildWaterbodyPermitMap,
  findBoundaryWaterbodies,
  evaluateThreshold,
  detectTrend,
  formatAlertMessage,
  formatAlertSummary,
} from '@/lib/boundary-alerts';

/* ------------------------------------------------------------------ */
/*  Test Data Factories                                                */
/* ------------------------------------------------------------------ */

function makePermit(overrides: Partial<{
  permitId: string;
  permitteeName: string;
  contactName: string;
  contactEmail: string;
  state: string;
  assignedWaterbodyIds: string[];
}> = {}) {
  return {
    permitId: overrides.permitId ?? 'PERMIT-001',
    permitteeName: overrides.permitteeName ?? 'Test County',
    contactName: overrides.contactName ?? 'Jane Doe',
    contactEmail: overrides.contactEmail ?? 'jane@example.com',
    state: overrides.state ?? 'MD',
    assignedWaterbodyIds: overrides.assignedWaterbodyIds ?? ['WB-A', 'WB-B'],
  };
}

function makeWaterbody(overrides: Partial<{
  assessmentUnitId: string;
  name: string;
  upstreamIds: string[];
  downstreamIds: string[];
  currentImpairments: Array<{
    parameter: string;
    category: string;
    value: number | null;
    threshold: number;
    unit: string;
  }>;
}> = {}) {
  return {
    assessmentUnitId: overrides.assessmentUnitId ?? 'WB-A',
    name: overrides.name ?? 'Test Creek',
    upstreamIds: overrides.upstreamIds ?? [],
    downstreamIds: overrides.downstreamIds ?? [],
    currentImpairments: overrides.currentImpairments ?? [],
  };
}

function makeImpairment(overrides: Partial<{
  parameter: string;
  category: string;
  value: number | null;
  threshold: number;
  unit: string;
}> = {}) {
  return {
    parameter: overrides.parameter ?? 'phosphorus',
    category: overrides.category ?? 'nutrients',
    value: overrides.value ?? 0.5,
    threshold: overrides.threshold ?? 1.0,
    unit: overrides.unit ?? 'mg/L',
  };
}

function makeThresholdConfig(overrides: Partial<{
  parameter: string;
  category: string;
  warningPercent: number;
  criticalPercent: number;
}> = {}) {
  return {
    parameter: overrides.parameter ?? 'phosphorus',
    category: overrides.category ?? 'nutrients',
    warningPercent: overrides.warningPercent ?? 100,
    criticalPercent: overrides.criticalPercent ?? 150,
  };
}

function makeAlert(overrides: Partial<{
  severity: string;
  relationship: string;
  parameter: string;
  sourceWaterbodyName: string;
  sourceWaterbodyId: string;
  neighborPermitteeName: string;
  neighborContactName: string;
  direction: string;
  percentOverThreshold: number;
  currentValue: number;
  threshold: number;
  unit: string;
}> = {}) {
  return {
    id: 'BA-test123',
    timestamp: '2024-01-15T00:00:00.000Z',
    severity: overrides.severity ?? 'warning',
    type: 'threshold_exceeded',
    sourceWaterbodyId: overrides.sourceWaterbodyId ?? 'WB-UP1',
    sourceWaterbodyName: overrides.sourceWaterbodyName ?? 'Upstream Creek',
    parameter: overrides.parameter ?? 'phosphorus',
    category: 'nutrients',
    currentValue: overrides.currentValue ?? 1.2,
    threshold: overrides.threshold ?? 1.0,
    unit: overrides.unit ?? 'mg/L',
    direction: overrides.direction ?? 'rising',
    percentOverThreshold: overrides.percentOverThreshold ?? 20,
    neighborPermitId: 'PERMIT-002',
    neighborPermitteeName: overrides.neighborPermitteeName ?? 'Neighbor County',
    neighborContactName: overrides.neighborContactName ?? 'John Smith',
    recipientPermitId: 'PERMIT-001',
    relationship: overrides.relationship ?? 'upstream',
    status: 'new',
    acknowledgedAt: null,
    resolvedAt: null,
    notes: [],
  } as any;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('boundary-alerts', () => {
  describe('buildWaterbodyPermitMap', () => {
    it('maps shared waterbody to both permits', () => {
      const permit1 = makePermit({ permitId: 'P1', assignedWaterbodyIds: ['WB-SHARED', 'WB-1'] });
      const permit2 = makePermit({ permitId: 'P2', assignedWaterbodyIds: ['WB-SHARED', 'WB-2'] });

      const map = buildWaterbodyPermitMap([permit1, permit2]);

      expect(map.get('WB-SHARED')).toHaveLength(2);
      expect(map.get('WB-SHARED')!.map(p => p.permitId)).toContain('P1');
      expect(map.get('WB-SHARED')!.map(p => p.permitId)).toContain('P2');
    });

    it('maps unique waterbodies to single permit', () => {
      const permit1 = makePermit({ permitId: 'P1', assignedWaterbodyIds: ['WB-1'] });
      const permit2 = makePermit({ permitId: 'P2', assignedWaterbodyIds: ['WB-2'] });

      const map = buildWaterbodyPermitMap([permit1, permit2]);

      expect(map.get('WB-1')).toHaveLength(1);
      expect(map.get('WB-2')).toHaveLength(1);
    });
  });

  describe('findBoundaryWaterbodies', () => {
    it('finds upstream waterbodies not in assigned set', () => {
      const permit = makePermit({ assignedWaterbodyIds: ['WB-A'] });

      const wbA = makeWaterbody({
        assessmentUnitId: 'WB-A',
        upstreamIds: ['WB-UP1', 'WB-UP2'],
      });
      const wbUp1 = makeWaterbody({ assessmentUnitId: 'WB-UP1', name: 'Upstream 1' });
      const wbUp2 = makeWaterbody({ assessmentUnitId: 'WB-UP2', name: 'Upstream 2' });

      const allWaterbodies = new Map([
        ['WB-A', wbA],
        ['WB-UP1', wbUp1],
        ['WB-UP2', wbUp2],
      ]) as any;

      const result = findBoundaryWaterbodies(permit as any, allWaterbodies);

      expect(result.upstream).toHaveLength(2);
      expect(result.upstream.map((w: any) => w.assessmentUnitId)).toContain('WB-UP1');
      expect(result.upstream.map((w: any) => w.assessmentUnitId)).toContain('WB-UP2');
    });

    it('deduplicates boundary waterbodies referenced by multiple assigned waterbodies', () => {
      // Both WB-A and WB-B reference WB-UP1 as upstream
      const permit = makePermit({ assignedWaterbodyIds: ['WB-A', 'WB-B'] });

      const wbA = makeWaterbody({
        assessmentUnitId: 'WB-A',
        upstreamIds: ['WB-UP1'],
      });
      const wbB = makeWaterbody({
        assessmentUnitId: 'WB-B',
        upstreamIds: ['WB-UP1'],
      });
      const wbUp1 = makeWaterbody({ assessmentUnitId: 'WB-UP1', name: 'Shared Upstream' });

      const allWaterbodies = new Map([
        ['WB-A', wbA],
        ['WB-B', wbB],
        ['WB-UP1', wbUp1],
      ]) as any;

      const result = findBoundaryWaterbodies(permit as any, allWaterbodies);

      // Should only appear once despite being upstream of both WB-A and WB-B
      expect(result.upstream).toHaveLength(1);
      expect(result.upstream[0].assessmentUnitId).toBe('WB-UP1');
    });

    it('excludes waterbodies already in the assigned set', () => {
      const permit = makePermit({ assignedWaterbodyIds: ['WB-A', 'WB-B'] });

      const wbA = makeWaterbody({
        assessmentUnitId: 'WB-A',
        upstreamIds: ['WB-B'], // WB-B is assigned, so not a boundary
      });
      const wbB = makeWaterbody({ assessmentUnitId: 'WB-B' });

      const allWaterbodies = new Map([
        ['WB-A', wbA],
        ['WB-B', wbB],
      ]) as any;

      const result = findBoundaryWaterbodies(permit as any, allWaterbodies);

      expect(result.upstream).toHaveLength(0);
    });

    it('finds downstream waterbodies correctly', () => {
      const permit = makePermit({ assignedWaterbodyIds: ['WB-A'] });

      const wbA = makeWaterbody({
        assessmentUnitId: 'WB-A',
        downstreamIds: ['WB-DOWN1'],
      });
      const wbDown1 = makeWaterbody({ assessmentUnitId: 'WB-DOWN1', name: 'Downstream 1' });

      const allWaterbodies = new Map([
        ['WB-A', wbA],
        ['WB-DOWN1', wbDown1],
      ]) as any;

      const result = findBoundaryWaterbodies(permit as any, allWaterbodies);

      expect(result.downstream).toHaveLength(1);
      expect(result.downstream[0].assessmentUnitId).toBe('WB-DOWN1');
    });
  });

  describe('evaluateThreshold', () => {
    it('returns warning when value is at 120% of threshold with warningPercent=100, criticalPercent=150', () => {
      const impairment = makeImpairment({ value: 1.2, threshold: 1.0 });
      const config = makeThresholdConfig({ warningPercent: 100, criticalPercent: 150 });

      const result = evaluateThreshold(impairment as any, config as any);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
      expect(result!.percentOver).toBeCloseTo(20, 1);
    });

    it('returns critical when value is at 160% of threshold with criticalPercent=150', () => {
      const impairment = makeImpairment({ value: 1.6, threshold: 1.0 });
      const config = makeThresholdConfig({ warningPercent: 100, criticalPercent: 150 });

      const result = evaluateThreshold(impairment as any, config as any);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe('critical');
      expect(result!.percentOver).toBeCloseTo(60, 1);
    });

    it('returns null when value is below threshold', () => {
      const impairment = makeImpairment({ value: 0.8, threshold: 1.0 });
      const config = makeThresholdConfig({ warningPercent: 100, criticalPercent: 150 });

      const result = evaluateThreshold(impairment as any, config as any);

      expect(result).toBeNull();
    });

    it('returns null when value is null', () => {
      const impairment = makeImpairment({ value: null, threshold: 1.0 });
      const config = makeThresholdConfig();

      const result = evaluateThreshold(impairment as any, config as any);

      expect(result).toBeNull();
    });

    it('handles dissolved_oxygen: value below threshold returns severity', () => {
      const impairment = makeImpairment({
        parameter: 'dissolved_oxygen',
        category: 'dissolved_oxygen',
        value: 3.0,
        threshold: 5.0,
        unit: 'mg/L',
      });
      const config = makeThresholdConfig({
        parameter: 'dissolved_oxygen',
        category: 'dissolved_oxygen',
      });

      const result = evaluateThreshold(impairment as any, config as any);

      expect(result).not.toBeNull();
      // (5 - 3) / 5 = 40% which is >= 20 so critical
      expect(result!.severity).toBe('critical');
      expect(result!.percentOver).toBeCloseTo(40, 1);
    });

    it('handles dissolved_oxygen: value slightly below threshold returns warning', () => {
      const impairment = makeImpairment({
        parameter: 'dissolved_oxygen',
        category: 'dissolved_oxygen',
        value: 4.5,
        threshold: 5.0,
        unit: 'mg/L',
      });
      const config = makeThresholdConfig({
        parameter: 'dissolved_oxygen',
        category: 'dissolved_oxygen',
      });

      const result = evaluateThreshold(impairment as any, config as any);

      expect(result).not.toBeNull();
      // (5 - 4.5) / 5 = 10% which is < 20 so warning
      expect(result!.severity).toBe('warning');
      expect(result!.percentOver).toBeCloseTo(10, 1);
    });

    it('handles dissolved_oxygen: value above threshold returns null', () => {
      const impairment = makeImpairment({
        parameter: 'dissolved_oxygen',
        category: 'dissolved_oxygen',
        value: 6.0,
        threshold: 5.0,
        unit: 'mg/L',
      });
      const config = makeThresholdConfig({
        parameter: 'dissolved_oxygen',
        category: 'dissolved_oxygen',
      });

      const result = evaluateThreshold(impairment as any, config as any);

      expect(result).toBeNull();
    });
  });

  describe('detectTrend', () => {
    it('returns rising for increasing values', () => {
      const values = [
        { value: 1.0, date: '2024-01-01' },
        { value: 2.0, date: '2024-01-02' },
        { value: 3.0, date: '2024-01-03' },
        { value: 4.0, date: '2024-01-04' },
      ];

      expect(detectTrend(values)).toBe('rising');
    });

    it('returns falling for decreasing values', () => {
      const values = [
        { value: 4.0, date: '2024-01-01' },
        { value: 3.0, date: '2024-01-02' },
        { value: 2.0, date: '2024-01-03' },
        { value: 1.0, date: '2024-01-04' },
      ];

      expect(detectTrend(values)).toBe('falling');
    });

    it('returns rising for a single value', () => {
      const values = [{ value: 5.0, date: '2024-01-01' }];

      expect(detectTrend(values)).toBe('rising');
    });

    it('returns rising for equal values', () => {
      const values = [
        { value: 3.0, date: '2024-01-01' },
        { value: 3.0, date: '2024-01-02' },
      ];

      expect(detectTrend(values)).toBe('rising');
    });
  });

  describe('formatAlertMessage', () => {
    it('includes waterbody name and parameter in message', () => {
      const alert = makeAlert({
        sourceWaterbodyName: 'Rock Creek',
        parameter: 'phosphorus',
        direction: 'rising',
      });

      const message = formatAlertMessage(alert);

      expect(message).toContain('Rock Creek');
      expect(message).toContain('phosphorus');
    });

    it('includes neighbor contact information', () => {
      const alert = makeAlert({
        neighborPermitteeName: 'Fairfax County',
        neighborContactName: 'Bob Smith',
      });

      const message = formatAlertMessage(alert);

      expect(message).toContain('Fairfax County');
      expect(message).toContain('Bob Smith');
    });

    it('uses "upstream" language for upstream relationship', () => {
      const alert = makeAlert({ relationship: 'upstream' });

      const message = formatAlertMessage(alert);

      expect(message).toContain('upstream');
    });

    it('uses "downstream" language for downstream relationship', () => {
      const alert = makeAlert({ relationship: 'downstream' });

      const message = formatAlertMessage(alert);

      expect(message).toContain('downstream');
    });

    it('includes privacy disclaimer', () => {
      const alert = makeAlert();

      const message = formatAlertMessage(alert);

      expect(message).toContain('No compliance data from the neighboring jurisdiction is included');
    });
  });

  describe('formatAlertSummary', () => {
    it('returns a one-line string with parameter and waterbody name', () => {
      const alert = makeAlert({
        parameter: 'phosphorus',
        sourceWaterbodyName: 'Rock Creek',
        neighborPermitteeName: 'Fairfax County',
      });

      const summary = formatAlertSummary(alert);

      expect(summary).toContain('phosphorus');
      expect(summary).toContain('Rock Creek');
      expect(summary).toContain('Fairfax County');
    });

    it('includes severity icon for warning', () => {
      const alert = makeAlert({ severity: 'warning' });

      const summary = formatAlertSummary(alert);

      expect(summary).toContain('\uD83D\uDFE1'); // yellow circle
    });

    it('includes severity icon for critical', () => {
      const alert = makeAlert({ severity: 'critical' });

      const summary = formatAlertSummary(alert);

      expect(summary).toContain('\uD83D\uDD34'); // red circle
    });
  });
});
