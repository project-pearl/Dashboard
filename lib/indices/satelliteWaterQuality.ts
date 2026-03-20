/**
 * Satellite Water Quality Index (Enhanced Layer 10)
 *
 * Real-time water quality assessment using satellite remote sensing data.
 * Integrates Landsat/Sentinel-2 for chlorophyll-a, turbidity, and harmful
 * algal bloom detection with ground-truth validation.
 */

import type { IndexScore } from './types';
import type { HucData } from './hucDataCollector';
import { computeConfidence, applyConfidenceRegression } from './confidence';

export interface SatelliteWaterQualityData {
  chlorophyllA: number | null;     // μg/L
  turbidity: number | null;        // NTU
  suspendedSediment: number | null; // mg/L
  algalBloomPresent: boolean;
  cloudCoverage: number;           // 0-100%
  acquisitionDate: string;
  spatialResolution: number;       // meters
  validPixels: number;             // count of valid water pixels
}

export interface GroundTruthData {
  chlorophyllA?: number;
  turbidity?: number;
  samplingDate: string;
  matchWithinHours: number; // hours between satellite and ground truth
}

/**
 * Satellite Water Quality Index (0-100, higher = better water quality)
 *
 * Components:
 *   Chlorophyll-a Assessment (40%): Satellite-derived vs EPA thresholds
 *   Turbidity Assessment (30%): Water clarity from reflectance
 *   Harmful Algal Bloom Detection (20%): Algorithm-detected blooms
 *   Data Quality Factor (10%): Cloud coverage, spatial resolution, validation
 */
export function computeSatelliteWaterQuality(
  data: HucData,
  satelliteData?: SatelliteWaterQualityData[],
  groundTruthData?: GroundTruthData[]
): IndexScore {
  const now = new Date().toISOString();

  if (!satelliteData || satelliteData.length === 0) {
    // Fallback to ground-based WQP data for chlorophyll/turbidity
    return computeFallbackWaterQuality(data);
  }

  // Filter to recent, high-quality satellite data (last 30 days)
  const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentData = satelliteData.filter(d =>
    new Date(d.acquisitionDate) >= cutoffDate &&
    d.cloudCoverage < 20 && // < 20% cloud coverage
    d.validPixels > 100     // sufficient water pixels
  );

  if (recentData.length === 0) {
    return computeFallbackWaterQuality(data);
  }

  // Use most recent high-quality observation
  const latest = recentData.sort((a, b) =>
    new Date(b.acquisitionDate).getTime() - new Date(a.acquisitionDate).getTime()
  )[0];

  // Component calculations
  const chlorophyllScore = computeChlorophyllScore(latest.chlorophyllA);
  const turbidityScore = computeTurbidityScore(latest.turbidity);
  const bloomScore = latest.algalBloomPresent ? 0 : 100; // 0 if bloom present
  const qualityScore = computeDataQualityScore(latest);

  // Validation adjustment using ground truth
  const validationFactor = computeValidationFactor(latest, groundTruthData);

  // Weighted composite
  const rawScore =
    chlorophyllScore * 0.40 +
    turbidityScore * 0.30 +
    bloomScore * 0.20 +
    qualityScore * 0.10;

  const adjustedScore = rawScore * validationFactor;

  // Confidence assessment
  const dataPoints = [
    latest.chlorophyllA,
    latest.turbidity,
    latest.suspendedSediment
  ].filter(v => v !== null).length;

  let confidence = computeConfidence('satelliteWaterQuality', dataPoints, [latest.acquisitionDate], 1);

  // Reduce confidence for high cloud coverage or low spatial resolution
  if (latest.cloudCoverage > 10) confidence *= 0.9;
  if (latest.spatialResolution > 30) confidence *= 0.8;

  const value = Math.round(Math.max(0, Math.min(100, applyConfidenceRegression(adjustedScore, confidence))));

  return {
    value,
    confidence,
    trend: computeTrend(recentData),
    lastCalculated: now,
    dataPoints: recentData.length,
    tidalModified: false,
  };
}

function computeChlorophyllScore(chlorophyllA: number | null): number {
  if (chlorophyllA === null) return 50;

  // EPA thresholds: <2.6 μg/L = excellent, >20 μg/L = poor
  if (chlorophyllA <= 2.6) return 100;
  if (chlorophyllA >= 20) return 0;

  // Linear interpolation between thresholds
  return Math.round(100 - ((chlorophyllA - 2.6) / (20 - 2.6)) * 100);
}

function computeTurbidityScore(turbidity: number | null): number {
  if (turbidity === null) return 50;

  // EPA thresholds: <4 NTU = excellent, >40 NTU = poor
  if (turbidity <= 4) return 100;
  if (turbidity >= 40) return 0;

  return Math.round(100 - ((turbidity - 4) / (40 - 4)) * 100);
}

function computeDataQualityScore(data: SatelliteWaterQualityData): number {
  let score = 100;

  // Penalize cloud coverage
  score -= data.cloudCoverage;

  // Penalize low spatial resolution
  if (data.spatialResolution > 30) score -= 20;
  if (data.spatialResolution > 100) score -= 30;

  // Penalize low pixel count
  if (data.validPixels < 50) score -= 30;

  return Math.max(0, score);
}

function computeValidationFactor(
  satelliteData: SatelliteWaterQualityData,
  groundTruth?: GroundTruthData[]
): number {
  if (!groundTruth || groundTruth.length === 0) return 1.0;

  // Find concurrent ground truth within 24 hours
  const satDate = new Date(satelliteData.acquisitionDate);
  const concurrent = groundTruth.find(gt => {
    const gtDate = new Date(gt.samplingDate);
    const timeDiff = Math.abs(satDate.getTime() - gtDate.getTime()) / (1000 * 60 * 60);
    return timeDiff <= 24;
  });

  if (!concurrent) return 1.0;

  // Compare satellite vs ground truth accuracy
  let agreement = 1.0;

  if (satelliteData.chlorophyllA && concurrent.chlorophyllA) {
    const error = Math.abs(satelliteData.chlorophyllA - concurrent.chlorophyllA) / concurrent.chlorophyllA;
    if (error > 0.5) agreement *= 0.8; // 50%+ error reduces factor
  }

  return agreement;
}

function computeTrend(data: SatelliteWaterQualityData[]): IndexScore['trend'] {
  if (data.length < 3) return 'unknown';

  const sorted = data.sort((a, b) =>
    new Date(a.acquisitionDate).getTime() - new Date(b.acquisitionDate).getTime()
  );

  const recent = sorted.slice(-3);
  const chlorophyllTrend = recent.every(d => d.chlorophyllA !== null)
    ? recent[2].chlorophyllA! - recent[0].chlorophyllA!
    : 0;

  if (chlorophyllTrend > 2) return 'declining'; // increasing chlorophyll = declining quality
  if (chlorophyllTrend < -2) return 'improving';
  return 'stable';
}

function computeFallbackWaterQuality(data: HucData): IndexScore {
  // Use ground-based WQP data as fallback
  const { wqpRecords } = data;
  const now = new Date().toISOString();

  const chlorophyllRecords = wqpRecords.filter(r => r.key === 'CHL');
  const turbidityRecords = wqpRecords.filter(r => r.key === 'TURB');

  if (chlorophyllRecords.length === 0 && turbidityRecords.length === 0) {
    return {
      value: 50,
      confidence: 10,
      trend: 'unknown',
      lastCalculated: now,
      dataPoints: 0,
      tidalModified: false,
    };
  }

  const avgChlorophyll = chlorophyllRecords.length > 0
    ? chlorophyllRecords.reduce((sum, r) => sum + (r.value || 0), 0) / chlorophyllRecords.length
    : null;

  const avgTurbidity = turbidityRecords.length > 0
    ? turbidityRecords.reduce((sum, r) => sum + (r.value || 0), 0) / turbidityRecords.length
    : null;

  const chlorophyllScore = computeChlorophyllScore(avgChlorophyll);
  const turbidityScore = computeTurbidityScore(avgTurbidity);

  const score = (chlorophyllScore + turbidityScore) / 2;
  const confidence = computeConfidence('waterQualityFallback',
    chlorophyllRecords.length + turbidityRecords.length,
    [...chlorophyllRecords.map(r => r.date), ...turbidityRecords.map(r => r.date)],
    1
  );

  return {
    value: Math.round(score),
    confidence,
    trend: 'unknown',
    lastCalculated: now,
    dataPoints: chlorophyllRecords.length + turbidityRecords.length,
    tidalModified: false,
  };
}