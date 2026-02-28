import type { IndexScore } from './types';
import type { HucData } from './hucDataCollector';
import { computeConfidence, applyConfidenceRegression, freshnessWeight } from './confidence';

/** 24-month analysis window */
const WINDOW_MS = 24 * 30 * 86_400_000;
/** 12-month DMR window */
const DMR_WINDOW_MS = 12 * 30 * 86_400_000;

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

/** Normalize a value into 0-100 using linear benchmarks */
function benchmarkScore(value: number, low: number, high: number): number {
  if (value <= low) return (value / low) * 20;
  if (value >= high) return 80 + ((value - high) / high) * 20;
  return 20 + ((value - low) / (high - low)) * 60;
}

/**
 * Per Capita Load Contribution Index (0-100, higher = worse per-capita loading)
 *
 * Components:
 *   Nutrient Concentration Per Capita (35%): TN+TP mean / population served
 *   DMR Discharge Per Capita (25%): total DMR nutrient discharge / population
 *   Permit Density Per Capita (20%): NPDES permits per 10K population
 *   Source Intensity (20%): exceedance ratio weighted by population normalization
 */
export function computePerCapitaLoad(data: HucData): IndexScore {
  const now = new Date().toISOString();
  const nowMs = Date.now();
  const { wqpRecords, icisDmrs, icisPermits, sdwisSystems } = data;

  // Deduplicate SDWIS systems by pwsid and sum population
  const seenPws = new Set<string>();
  let totalPopulation = 0;
  for (const sys of sdwisSystems) {
    if (!seenPws.has(sys.pwsid) && sys.population > 0) {
      seenPws.add(sys.pwsid);
      totalPopulation += sys.population;
    }
  }

  // If no population data, return neutral score with low confidence
  if (totalPopulation === 0) {
    return {
      value: 50,
      confidence: Math.min(computeConfidence('perCapitaLoad', 0, [], 0), 30),
      trend: 'unknown',
      lastCalculated: now,
      dataPoints: 0,
      tidalModified: false,
    };
  }

  const popPer1K = totalPopulation / 1000;
  const popPer10K = totalPopulation / 10000;

  // ── 1. Nutrient Concentration Per Capita (35%) ──
  const tnRecords = wqpRecords.filter(r =>
    r.key === 'TN' && r.date && isWithinWindow(r.date, WINDOW_MS)
  );
  const tpRecords = wqpRecords.filter(r =>
    r.key === 'TP' && r.date && isWithinWindow(r.date, WINDOW_MS)
  );

  const tnMean = tnRecords.length > 0
    ? tnRecords.reduce((s, r) => s + r.val, 0) / tnRecords.length
    : 0;
  const tpMean = tpRecords.length > 0
    ? tpRecords.reduce((s, r) => s + r.val, 0) / tpRecords.length
    : 0;

  const nutrientMeanPerCapita = (tnMean + tpMean) / popPer1K; // mg/L per 1K people
  // Benchmarks: < 0.5 mg/L per 1K = excellent (0-20), > 5.0 = critical (80-100)
  const nutrientScore = Math.max(0, Math.min(100, benchmarkScore(nutrientMeanPerCapita, 0.5, 5.0)));

  // ── 2. DMR Discharge Per Capita (25%) ──
  const nutrientDmrs = icisDmrs.filter(d =>
    (d.pearlKey === 'TN' || d.pearlKey === 'TP') &&
    d.dmrValue != null &&
    d.period && isWithinWindow(d.period, DMR_WINDOW_MS)
  );
  const totalDmrDischarge = nutrientDmrs.reduce((s, d) => s + (d.dmrValue ?? 0), 0);
  const dmrPerCapita = totalDmrDischarge / popPer1K;
  // Normalize: use similar benchmark scale
  const dmrScore = Math.max(0, Math.min(100, benchmarkScore(dmrPerCapita, 0.5, 5.0)));

  // ── 3. Permit Density Per Capita (20%) ──
  const uniquePermits = new Set(icisPermits.map(p => p.permit));
  const permitsPer10K = popPer10K > 0 ? uniquePermits.size / popPer10K : 0;
  // Benchmarks: < 1 per 10K = low (0-20), > 10 per 10K = high (80-100)
  const permitDensityScore = Math.max(0, Math.min(100, benchmarkScore(permitsPer10K, 1, 10)));

  // ── 4. Source Intensity (20%) ──
  const allDmrs12m = icisDmrs.filter(d =>
    d.period && isWithinWindow(d.period, DMR_WINDOW_MS)
  );
  const exceedanceCount = allDmrs12m.filter(d => d.exceedance).length;
  const exceedanceRate = allDmrs12m.length > 0 ? exceedanceCount / allDmrs12m.length : 0;
  // Weight by population density factor (more people + high exceedance = worse)
  const popDensityFactor = Math.min(2, popPer1K / 50); // normalize: 50K pop = factor 1.0
  const sourceIntensityScore = Math.max(0, Math.min(100, exceedanceRate * 100 * (0.5 + popDensityFactor * 0.5)));

  // ── Weighted composite ──
  const rawScore =
    nutrientScore * 0.35 +
    dmrScore * 0.25 +
    permitDensityScore * 0.20 +
    sourceIntensityScore * 0.20;

  // ── Confidence ──
  const totalDataPoints = seenPws.size + tnRecords.length + tpRecords.length + nutrientDmrs.length;
  const dates = [
    ...tnRecords.map(r => r.date),
    ...tpRecords.map(r => r.date),
    ...nutrientDmrs.map(d => d.period),
  ];
  const sources = new Set<string>();
  if (seenPws.size > 0) sources.add('sdwis');
  if (tnRecords.length > 0 || tpRecords.length > 0) sources.add('wqp');
  if (nutrientDmrs.length > 0) sources.add('icis-dmr');

  let confidence = computeConfidence('perCapitaLoad', totalDataPoints, dates, sources.size);

  const value = Math.round(Math.max(0, Math.min(100, applyConfidenceRegression(rawScore, confidence))));

  // ── Trend: linear regression of per-capita nutrient means over 24-month window ──
  const allNutrientRecords = [...tnRecords, ...tpRecords].filter(r => r.val != null && r.date);
  const trendPoints = allNutrientRecords.map(r => ({
    dayOffset: (nowMs - new Date(r.date).getTime()) / 86_400_000,
    value: (r.val / popPer1K) * freshnessWeight(r.date),
  }));
  const slope = linearRegression(trendPoints);
  let trend: IndexScore['trend'] = 'unknown';
  if (allNutrientRecords.length >= 3) {
    // Positive slope = per-capita load increasing over time = declining conditions
    trend = slope > 0.0001 ? 'declining' : slope < -0.0001 ? 'improving' : 'stable';
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
