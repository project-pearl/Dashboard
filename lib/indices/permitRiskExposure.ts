import type { IndexScore } from './types';
import type { HucData } from './hucDataCollector';
import { computeConfidence, applyConfidenceRegression } from './confidence';

/** 24-month window for violation/DMR analysis */
const WINDOW_MS = 24 * 30 * 86_400_000;
/** 6-month recency window for extra weighting */
const RECENT_MS = 6 * 30 * 86_400_000;

function isWithinWindow(dateStr: string, windowMs: number): boolean {
  const age = Date.now() - new Date(dateStr).getTime();
  return !Number.isNaN(age) && age >= 0 && age <= windowMs;
}

/**
 * Permit Risk Exposure Index (0-100, higher = more risk)
 *
 * Components:
 *   Violation Rate (30%): violations / permits over 24 months
 *   RNC Prevalence (25%): RNC count / total violations, recent RNC = severe
 *   DMR Exceedance Rate (25%): exceedances / total DMRs over 12 months
 *   Enforcement Intensity (20%): penalty $ + action count, log-scaled
 */
export function computePermitRiskExposure(data: HucData): IndexScore {
  const now = new Date().toISOString();
  const { icisPermits, icisViolations, icisDmrs, icisEnforcement } = data;

  // Filter to 24-month window
  const recentViolations = icisViolations.filter(v => v.date && isWithinWindow(v.date, WINDOW_MS));
  const recentRecentViolations = recentViolations.filter(v => v.date && isWithinWindow(v.date, RECENT_MS));

  // Filter DMRs to 12-month window
  const dmrWindow = 12 * 30 * 86_400_000;
  const recentDmrs = icisDmrs.filter(d => d.period && isWithinWindow(d.period, dmrWindow));

  const permitCount = Math.max(1, icisPermits.length);

  // 1. Violation Rate (30%) — with 2x weighting for recent 6 months
  const olderViolations = recentViolations.length - recentRecentViolations.length;
  const weightedViolationCount = olderViolations + recentRecentViolations.length * 2;
  const violationRate = Math.min(100, (weightedViolationCount / permitCount) * 20);

  // 2. RNC Prevalence (25%)
  const rncCount = recentViolations.filter(v => v.rnc).length;
  const rncInRecent = recentRecentViolations.some(v => v.rnc);
  let rncScore = recentViolations.length > 0
    ? (rncCount / recentViolations.length) * 80
    : 0;
  if (rncInRecent) rncScore = Math.max(rncScore, 70); // severe penalty for recent RNC

  // 3. DMR Exceedance Rate (25%)
  const exceedanceCount = recentDmrs.filter(d => d.exceedance).length;
  const dmrExceedanceRate = recentDmrs.length > 0
    ? (exceedanceCount / recentDmrs.length) * 100
    : 0;

  // 4. Enforcement Intensity (20%) — log-scaled
  const totalPenalty = icisEnforcement.reduce((sum, e) => sum + (e.penaltyAssessed || 0), 0);
  const actionCount = icisEnforcement.length;
  const enforcementRaw = Math.log10(Math.max(1, totalPenalty + 1)) * 10 + actionCount * 5;
  const enforcementScore = Math.min(100, enforcementRaw);

  // Weighted composite
  const rawScore =
    violationRate * 0.30 +
    rncScore * 0.25 +
    dmrExceedanceRate * 0.25 +
    enforcementScore * 0.20;

  const totalDataPoints = icisPermits.length + recentViolations.length + recentDmrs.length + icisEnforcement.length;
  const dates = [
    ...recentViolations.map(v => v.date),
    ...recentDmrs.map(d => d.period),
    ...icisEnforcement.map(e => e.settlementDate),
  ];
  const sources = new Set<string>();
  if (icisPermits.length > 0) sources.add('permits');
  if (recentViolations.length > 0) sources.add('violations');
  if (recentDmrs.length > 0) sources.add('dmr');
  if (icisEnforcement.length > 0) sources.add('enforcement');

  const confidence = computeConfidence('permitRiskExposure', totalDataPoints, dates, sources.size);
  const value = Math.round(Math.max(0, Math.min(100, applyConfidenceRegression(rawScore, confidence))));

  // Trend: compare recent 6mo violation rate to older period
  let trend: IndexScore['trend'] = 'unknown';
  if (recentViolations.length >= 3) {
    const recentRate = recentRecentViolations.length / Math.max(1, recentViolations.length);
    trend = recentRate > 0.6 ? 'declining' : recentRate < 0.3 ? 'improving' : 'stable';
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
