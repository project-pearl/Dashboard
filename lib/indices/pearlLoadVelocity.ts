import type { IndexScore } from './types';
import type { HucData } from './hucDataCollector';
import { getThreshold } from '@/lib/waterQualityScore';
import { computeConfidence, applyConfidenceRegression, freshnessWeight } from './confidence';

/** 24-month analysis window */
const WINDOW_MS = 24 * 30 * 86_400_000;

function isWithinWindow(dateStr: string, windowMs: number): boolean {
  const age = Date.now() - new Date(dateStr).getTime();
  return !Number.isNaN(age) && age >= 0 && age <= windowMs;
}

/** Simple linear regression: returns slope (units per day) */
function linearRegression(points: { dayOffset: number; value: number }[]): number {
  if (points.length < 2) return 0;
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const p of points) {
    sumX += p.dayOffset;
    sumY += p.value;
    sumXY += p.dayOffset * p.value;
    sumX2 += p.dayOffset * p.dayOffset;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * PEARL Load Velocity Index (0-100, higher = faster nutrient loading / worse)
 *
 * Components:
 *   TN Trend Slope (30%): linear regression of TN values over 24 months
 *   TP Trend Slope (30%): linear regression of TP values over 24 months
 *   Threshold Proximity (20%): current mean vs regulatory thresholds
 *   DMR Exceedance Trend (20%): % of DMRs exceeding nutrient limits, 12-month rolling
 */
export function computePearlLoadVelocity(data: HucData): IndexScore {
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const { wqpRecords, icisDmrs } = data;

  // Separate TN and TP records within 24-month window
  const tnRecords = wqpRecords.filter(r =>
    r.key === 'TN' && r.date && isWithinWindow(r.date, WINDOW_MS)
  );
  const tpRecords = wqpRecords.filter(r =>
    r.key === 'TP' && r.date && isWithinWindow(r.date, WINDOW_MS)
  );

  // Build regression points (freshness-weighted)
  function toPoints(records: typeof wqpRecords): { dayOffset: number; value: number }[] {
    return records
      .filter(r => r.val != null && r.date)
      .map(r => ({
        dayOffset: (nowMs - new Date(r.date).getTime()) / 86_400_000,
        value: r.val * freshnessWeight(r.date),
      }));
  }

  const tnPoints = toPoints(tnRecords);
  const tpPoints = toPoints(tpRecords);

  // 1. TN Trend Slope (30%) — positive slope = increasing load = higher score
  const tnSlope = linearRegression(tnPoints); // mg/L per day
  // Normalize: slope of +0.01 mg/L/day ≈ significant increase → score ~80
  const tnTrendScore = Math.max(0, Math.min(100, 50 + tnSlope * 5000));

  // 2. TP Trend Slope (30%)
  const tpSlope = linearRegression(tpPoints);
  // TP thresholds are ~10x lower than TN, so scale accordingly
  const tpTrendScore = Math.max(0, Math.min(100, 50 + tpSlope * 50000));

  // 3. Threshold Proximity (20%) — current mean vs regulatory thresholds
  const tnThreshold = getThreshold('TN')?.fair ?? 1.0;
  const tpThreshold = getThreshold('TP')?.fair ?? 0.1;

  const tnMean = tnRecords.length > 0
    ? tnRecords.reduce((s, r) => s + r.val, 0) / tnRecords.length
    : 0;
  const tpMean = tpRecords.length > 0
    ? tpRecords.reduce((s, r) => s + r.val, 0) / tpRecords.length
    : 0;

  const tnProximity = Math.min(100, (tnMean / tnThreshold) * 50);
  const tpProximity = Math.min(100, (tpMean / tpThreshold) * 50);
  const thresholdScore = (tnProximity + tpProximity) / 2;

  // 4. DMR Exceedance Trend (20%) — nutrient DMRs only, 12-month rolling
  const dmrWindowMs = 12 * 30 * 86_400_000;
  const nutrientDmrs = icisDmrs.filter(d =>
    (d.pearlKey === 'TN' || d.pearlKey === 'TP') &&
    d.period && isWithinWindow(d.period, dmrWindowMs)
  );
  const dmrExceedances = nutrientDmrs.filter(d => d.exceedance).length;
  const dmrExceedanceScore = nutrientDmrs.length > 0
    ? (dmrExceedances / nutrientDmrs.length) * 100
    : 0;

  // Weighted composite
  const rawScore =
    tnTrendScore * 0.30 +
    tpTrendScore * 0.30 +
    thresholdScore * 0.20 +
    dmrExceedanceScore * 0.20;

  // Minimum data check: need >= 3 TN or TP samples
  const hasMinData = tnRecords.length >= 3 || tpRecords.length >= 3;
  const totalDataPoints = tnRecords.length + tpRecords.length + nutrientDmrs.length;
  const dates = [
    ...tnRecords.map(r => r.date),
    ...tpRecords.map(r => r.date),
    ...nutrientDmrs.map(d => d.period),
  ];
  const sources = new Set<string>();
  if (tnRecords.length > 0 || tpRecords.length > 0) sources.add('wqp');
  if (nutrientDmrs.length > 0) sources.add('icis-dmr');

  let confidence = computeConfidence('pearlLoadVelocity', totalDataPoints, dates, sources.size);
  if (!hasMinData) confidence = Math.min(confidence, 30); // force LOW if insufficient data

  const value = Math.round(Math.max(0, Math.min(100, applyConfidenceRegression(rawScore, confidence))));

  // Trend from slope direction
  const avgSlope = (tnSlope + tpSlope * 10) / 2; // normalize TP scale
  let trend: IndexScore['trend'] = 'unknown';
  if (hasMinData) {
    trend = avgSlope > 0.001 ? 'declining' : avgSlope < -0.001 ? 'improving' : 'stable';
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
