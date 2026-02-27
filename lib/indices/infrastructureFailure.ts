import type { IndexScore } from './types';
import type { HucData } from './hucDataCollector';
import { computeConfidence, applyConfidenceRegression } from './confidence';

/** 12-month enforcement window */
const ENFORCEMENT_WINDOW_MS = 12 * 30 * 86_400_000;

function isWithinWindow(dateStr: string, windowMs: number): boolean {
  const age = Date.now() - new Date(dateStr).getTime();
  return !Number.isNaN(age) && age >= 0 && age <= windowMs;
}

/**
 * Infrastructure Failure Probability Index (0-100, higher = more failure risk)
 *
 * Components:
 *   Violation Density (30%): (major*3 + minor) / systemCount
 *   Health-Based Violations (25%): healthBased / totalViolations
 *   Enforcement Frequency (20%): actions per system, 12-month window
 *   Population Exposure (15%): population-weighted violation severity
 *   Inspection Failures (10%): failed / total from ICIS inspections
 */
export function computeInfrastructureFailure(data: HucData): IndexScore {
  const now = new Date().toISOString();
  const { sdwisSystems, sdwisViolations, sdwisEnforcement, icisInspections } = data;

  const systemCount = Math.max(1, sdwisSystems.length);
  const totalViolations = sdwisViolations.length;

  // 1. Violation Density (30%)
  const majorCount = sdwisViolations.filter(v => v.isMajor).length;
  const minorCount = totalViolations - majorCount;
  const densityRaw = (majorCount * 3 + minorCount) / systemCount;
  const violationDensity = Math.min(100, densityRaw * 15);

  // 2. Health-Based Violations (25%)
  const healthBasedCount = sdwisViolations.filter(v => v.isHealthBased).length;
  let healthScore = totalViolations > 0
    ? (healthBasedCount / totalViolations) * 100
    : 0;
  // 1.5x multiplier for health-based presence
  if (healthBasedCount > 0) {
    healthScore = Math.min(100, healthScore * 1.5);
  }

  // 3. Enforcement Frequency (20%) — 12-month window
  const recentEnforcement = sdwisEnforcement.filter(e => e.date && isWithinWindow(e.date, ENFORCEMENT_WINDOW_MS));
  const enforcementFreq = Math.min(100, (recentEnforcement.length / systemCount) * 30);

  // 4. Population Exposure (15%) — population-weighted violation severity
  const totalPopulation = sdwisSystems.reduce((sum, s) => sum + (s.population || 0), 0);
  let popExposure = 0;
  if (totalPopulation > 0 && totalViolations > 0) {
    // Weight each system's violations by its population share
    const systemViolationMap = new Map<string, number>();
    for (const v of sdwisViolations) {
      const weight = v.isHealthBased ? 3 : 1;
      systemViolationMap.set(v.pwsid, (systemViolationMap.get(v.pwsid) || 0) + weight);
    }
    let weightedSum = 0;
    for (const sys of sdwisSystems) {
      const vCount = systemViolationMap.get(sys.pwsid) || 0;
      weightedSum += vCount * (sys.population / totalPopulation);
    }
    popExposure = Math.min(100, weightedSum * 20);
  }

  // 5. Inspection Failures (10%)
  const failedInspections = icisInspections.filter(i =>
    i.complianceStatus && /violation|non.?comp/i.test(i.complianceStatus)
  ).length;
  const inspectionFailRate = icisInspections.length > 0
    ? (failedInspections / icisInspections.length) * 100
    : 0;

  // GW source risk multiplier — groundwater contamination harder to remediate
  const gwSystems = sdwisSystems.filter(s => s.sourceWater === 'GW').length;
  const gwFraction = gwSystems / systemCount;
  const gwMultiplier = 1 + gwFraction * 0.1; // up to 10% boost

  const rawScore = (
    violationDensity * 0.30 +
    healthScore * 0.25 +
    enforcementFreq * 0.20 +
    popExposure * 0.15 +
    inspectionFailRate * 0.10
  ) * gwMultiplier;

  const totalDataPoints = sdwisSystems.length + totalViolations + recentEnforcement.length + icisInspections.length;
  const dates = [
    ...sdwisViolations.map(v => v.compliancePeriod),
    ...sdwisEnforcement.map(e => e.date),
    ...icisInspections.map(i => i.date),
  ];
  const sources = new Set<string>();
  if (sdwisSystems.length > 0) sources.add('sdwis-systems');
  if (totalViolations > 0) sources.add('sdwis-violations');
  if (icisInspections.length > 0) sources.add('icis-inspections');

  const confidence = computeConfidence('infrastructureFailure', totalDataPoints, dates, sources.size);
  const value = Math.round(Math.max(0, Math.min(100, applyConfidenceRegression(rawScore, confidence))));

  // Trend: compare health-based violation rates
  let trend: IndexScore['trend'] = 'unknown';
  if (totalViolations >= 3) {
    const hbRatio = healthBasedCount / totalViolations;
    trend = hbRatio > 0.4 ? 'declining' : hbRatio < 0.15 ? 'improving' : 'stable';
  }

  return {
    value,
    confidence,
    trend,
    lastCalculated: now,
    dataPoints: totalDataPoints,
    tidalModified: false,
  };
}
