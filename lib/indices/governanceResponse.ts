import type { IndexScore } from './types';
import type { HucData } from './hucDataCollector';
import { computeConfidence, applyConfidenceRegression } from './confidence';

/**
 * Governance Response Index (0-100, higher = worse governance/oversight)
 *
 * Entirely from HucData — no state-level import needed.
 *
 * Components:
 *   TMDL Coverage Gap (30%): fraction of impaired waterbodies lacking TMDLs
 *   Enforcement Gap (25%): enforcement actions vs violations (ICIS + SDWIS)
 *   Permit Compliance Gap (25%): violation + RNC rate per permit
 *   Inspection Gap (20%): inspection coverage per permit
 */
export function computeGovernanceResponse(data: HucData): IndexScore {
  const now = new Date().toISOString();
  const {
    attainsWaterbodies,
    icisEnforcement, sdwisEnforcement,
    icisViolations, sdwisViolations,
    icisPermits,
    icisInspections,
  } = data;

  const totalData =
    attainsWaterbodies.length + icisEnforcement.length + sdwisEnforcement.length +
    icisViolations.length + sdwisViolations.length + icisPermits.length + icisInspections.length;

  // No data → neutral with low confidence
  if (totalData === 0) {
    return {
      value: 50,
      confidence: Math.min(computeConfidence('governanceResponse', 0, [], 0), 30),
      trend: 'unknown',
      lastCalculated: now,
      dataPoints: 0,
      tidalModified: false,
    };
  }

  // ── 1. TMDL Coverage Gap (30%) ──
  let tmdlGap = 50; // neutral fallback
  if (attainsWaterbodies.length > 0) {
    const completed = attainsWaterbodies.filter(wb => wb.tmdlStatus === 'completed').length;
    const needed = attainsWaterbodies.filter(wb => wb.tmdlStatus === 'needed').length;
    const total = completed + needed;
    tmdlGap = total > 0 ? (1 - completed / total) * 100 : 50;
  }

  // ── 2. Enforcement Gap (25%) ──
  const totalViolations = icisViolations.length + sdwisViolations.length;
  const totalEnforcement = icisEnforcement.length + sdwisEnforcement.length;
  let enforcementGap = 50;
  if (totalViolations > 0) {
    const enforcementRatio = totalEnforcement / totalViolations;
    enforcementGap = Math.max(0, Math.min(100, 100 - enforcementRatio * 100));
  }

  // ── 3. Permit Compliance Gap (25%) ──
  const uniquePermits = new Set(icisPermits.map(p => p.permit));
  const permitCount = uniquePermits.size;
  let complianceGap = 50;
  if (permitCount > 0) {
    const violPerPermit = icisViolations.length / permitCount;
    const rncCount = icisViolations.filter(v => v.rnc).length;
    const rncPerPermit = rncCount / permitCount;
    complianceGap = Math.min(100, violPerPermit * 20 + rncPerPermit * 50);
  }

  // ── 4. Inspection Gap (20%) ──
  let inspectionGap = 50;
  if (permitCount > 0) {
    const inspPerPermit = icisInspections.length / permitCount;
    inspectionGap = Math.max(0, 100 - Math.min(100, inspPerPermit * 100));
  }

  // ── Weighted composite ──
  const rawScore =
    tmdlGap * 0.30 +
    enforcementGap * 0.25 +
    complianceGap * 0.25 +
    inspectionGap * 0.20;

  // ── Confidence ──
  const dataPoints = totalData;
  const dates = [
    ...icisViolations.map(v => v.date),
    ...sdwisViolations.map(v => v.compliancePeriod),
    ...icisEnforcement.map(e => e.settlementDate),
    ...sdwisEnforcement.map(e => e.date),
    ...icisInspections.map(i => i.date),
  ];
  const sources = new Set<string>();
  if (attainsWaterbodies.length > 0) sources.add('attains');
  if (icisViolations.length > 0 || icisEnforcement.length > 0 || icisPermits.length > 0 || icisInspections.length > 0) sources.add('icis');
  if (sdwisViolations.length > 0 || sdwisEnforcement.length > 0) sources.add('sdwis');

  const confidence = computeConfidence('governanceResponse', dataPoints, dates, sources.size);
  const value = Math.round(Math.max(0, Math.min(100, applyConfidenceRegression(rawScore, confidence))));

  // ── Trend ──
  let trend: IndexScore['trend'] = 'unknown';
  if (totalViolations >= 3 && icisInspections.length >= 2) {
    const enfRatio = totalViolations > 0 ? totalEnforcement / totalViolations : 0;
    const inspRatio = permitCount > 0 ? icisInspections.length / permitCount : 0;
    if (enfRatio > 0.7 && inspRatio > 0.8) {
      trend = 'improving';
    } else if (enfRatio < 0.3 && inspRatio < 0.3) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }
  }

  return {
    value,
    confidence,
    trend,
    lastCalculated: now,
    dataPoints,
    tidalModified: false,
  };
}
