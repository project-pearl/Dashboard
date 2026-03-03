/* ------------------------------------------------------------------ */
/*  CDC NWSS — Baseline Calculation & Anomaly Detection               */
/*                                                                    */
/*  For each sewershed + pathogen pair, maintain a 30-day rolling     */
/*  baseline (mean + std deviation) of normalized concentration.      */
/*                                                                    */
/*  Anomaly scoring (sigma):                                          */
/*    |σ| < 2.0         → normal                                     */
/*    2.0 ≤ |σ| < 3.0   → elevated (log only)                        */
/*    3.0 ≤ |σ| < 4.0   → anomalous (WARNING)                        */
/*    |σ| ≥ 4.0          → extreme (CRITICAL)                         */
/*                                                                    */
/*  Only POSITIVE deviations (spikes) trigger alerts.                 */
/* ------------------------------------------------------------------ */

import type {
  NWSSRecord, NWSSSewershedBaseline, NWSSAnomaly, PathogenType, AnomalyLevel,
} from './types';
import { normalizeRecords, type NormalizedRecord } from './normalize';

const MIN_SAMPLES_30D = 4;          // minimum samples for 30-day window
const MIN_SAMPLES_60D = 4;          // fallback 60-day window
const WINDOW_30D_MS = 30 * 24 * 60 * 60 * 1000;
const WINDOW_60D_MS = 60 * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/*  Baseline Key                                                      */
/* ------------------------------------------------------------------ */

export function baselineKey(sewershedId: string, pathogen: PathogenType): string {
  return `${sewershedId}_${pathogen}`;
}

/* ------------------------------------------------------------------ */
/*  Compute Baselines                                                 */
/* ------------------------------------------------------------------ */

/**
 * Compute rolling baselines for all sewershed/pathogen combinations
 * from the provided records.
 */
export function computeBaselines(
  records: NWSSRecord[],
): Record<string, NWSSSewershedBaseline> {
  const normalized = normalizeRecords(records);
  const now = Date.now();
  const baselines: Record<string, NWSSSewershedBaseline> = {};

  // Group by sewershed + pathogen
  const groups = new Map<string, NormalizedRecord[]>();
  for (const nr of normalized) {
    const key = baselineKey(nr.record.sewershedId, nr.record.pathogen);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(nr);
  }

  for (const [key, groupRecords] of groups) {
    const sewershedId = groupRecords[0].record.sewershedId;
    const pathogen = groupRecords[0].record.pathogen;

    // Try 30-day window first, fall back to 60
    let windowMs = WINDOW_30D_MS;
    let minSamples = MIN_SAMPLES_30D;
    let windowRecords = groupRecords.filter(nr => {
      const t = new Date(nr.record.sampleCollectDate).getTime();
      return !isNaN(t) && (now - t) <= windowMs;
    });

    if (windowRecords.length < minSamples) {
      windowMs = WINDOW_60D_MS;
      minSamples = MIN_SAMPLES_60D;
      windowRecords = groupRecords.filter(nr => {
        const t = new Date(nr.record.sampleCollectDate).getTime();
        return !isNaN(t) && (now - t) <= windowMs;
      });
    }

    if (windowRecords.length < minSamples) continue; // insufficient data

    const values = windowRecords.map(nr => nr.normalizedConcentration);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    baselines[key] = {
      sewershedId,
      pathogen,
      rollingMean30d: mean,
      rollingStdDev30d: stdDev,
      lastUpdated: new Date().toISOString().split('T')[0],
      sampleCount: windowRecords.length,
    };
  }

  return baselines;
}

/* ------------------------------------------------------------------ */
/*  Anomaly Detection                                                 */
/* ------------------------------------------------------------------ */

function classifySigma(sigma: number): AnomalyLevel {
  const abs = Math.abs(sigma);
  if (abs >= 4.0) return 'extreme';
  if (abs >= 3.0) return 'anomalous';
  if (abs >= 2.0) return 'elevated';
  return 'normal';
}

/**
 * Detect anomalies by comparing the most recent sample for each
 * sewershed/pathogen against its rolling baseline.
 *
 * Only POSITIVE deviations (concentration spikes) are flagged as
 * anomalies for bio-threat correlation purposes.
 */
export function detectAnomalies(
  records: NWSSRecord[],
  baselines: Record<string, NWSSSewershedBaseline>,
): NWSSAnomaly[] {
  const normalized = normalizeRecords(records);
  const anomalies: NWSSAnomaly[] = [];

  // Get the most recent record per sewershed/pathogen
  const latest = new Map<string, NormalizedRecord>();
  for (const nr of normalized) {
    const key = baselineKey(nr.record.sewershedId, nr.record.pathogen);
    const existing = latest.get(key);
    if (!existing || nr.record.sampleCollectDate > existing.record.sampleCollectDate) {
      latest.set(key, nr);
    }
  }

  for (const [key, nr] of latest) {
    const bl = baselines[key];
    if (!bl) continue;
    if (bl.rollingStdDev30d <= 0) continue; // can't compute sigma

    const sigma = (nr.normalizedConcentration - bl.rollingMean30d) / bl.rollingStdDev30d;

    // Only flag positive deviations (spikes)
    if (sigma < 2.0) continue;

    const level = classifySigma(sigma);

    anomalies.push({
      sewershedId: nr.record.sewershedId,
      countyFips: nr.record.countyFips,
      pathogen: nr.record.pathogen,
      concentration: nr.normalizedConcentration,
      baseline: bl.rollingMean30d,
      sigma: Math.round(sigma * 100) / 100,
      level,
      date: nr.record.sampleCollectDate,
      populationServed: nr.record.populationServed,
      jurisdiction: nr.record.jurisdiction,
      countiesServed: nr.record.countiesServed,
    });
  }

  // Sort by sigma descending (most severe first)
  anomalies.sort((a, b) => b.sigma - a.sigma);

  return anomalies;
}
