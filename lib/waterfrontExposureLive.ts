// lib/waterfrontExposureLive.ts
// Server-only live WQ computation for waterfront exposure.
// Layers real-time WQP/ATTAINS cache data on top of the base scoring engine.
// Only imported by API routes (never client components).

import { getWqpAllRecords } from './wqpCache';
import { getAttainsCache } from './attainsCache';
import { getThresholds, type KeyParam } from './waterQualityScore';
import {
  computeExposureFromData,
  STATE_ECON_DATA,
  type WaterfrontExposureResult,
} from './waterfrontExposure';

const HEDONIC_PARAMS: KeyParam[] = ['DO', 'TN', 'TP', 'TSS', 'turbidity', 'pH'];

function computeWqDegradation(stateAbbr: string): { index: number; worstParam: string | null; paramCount: number } {
  const thresholds = getThresholds('freshwater');
  const allRecords = getWqpAllRecords();
  const stateRecords = allRecords.filter(r => r.state === stateAbbr);

  if (stateRecords.length === 0) {
    return computeAttainsFallback(stateAbbr);
  }

  const byParam = new Map<string, number[]>();
  for (const r of stateRecords) {
    const key = r.key as string;
    if (!HEDONIC_PARAMS.includes(key as KeyParam)) continue;
    if (!byParam.has(key)) byParam.set(key, []);
    byParam.get(key)!.push(r.val);
  }

  if (byParam.size === 0) {
    return computeAttainsFallback(stateAbbr);
  }

  const ratios: { param: string; ratio: number }[] = [];
  for (const [param, values] of byParam) {
    const t = thresholds[param];
    if (!t) continue;

    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    let ratio: number;
    if (t.direction === 'below') {
      ratio = median > 0 ? t.poor / median : 2.0;
    } else if (t.direction === 'range') {
      const mid = ((t.rangeMin ?? 6.5) + (t.rangeMax ?? 8.5)) / 2;
      const halfRange = ((t.rangeMax ?? 8.5) - (t.rangeMin ?? 6.5)) / 2;
      const deviation = Math.abs(median - mid);
      ratio = deviation / halfRange;
    } else {
      ratio = t.poor > 0 ? median / t.poor : 0;
    }

    ratios.push({ param, ratio: Math.max(0, ratio) });
  }

  if (ratios.length === 0) {
    return computeAttainsFallback(stateAbbr);
  }

  const worst = ratios.reduce((a, b) => a.ratio > b.ratio ? a : b);
  const avg = ratios.reduce((sum, r) => sum + r.ratio, 0) / ratios.length;
  const index = Math.min(3.0, worst.ratio * 0.7 + avg * 0.3);

  return { index, worstParam: worst.param, paramCount: ratios.length };
}

function computeAttainsFallback(stateAbbr: string): { index: number; worstParam: string | null; paramCount: number } {
  try {
    const attains = getAttainsCache();
    const stateData = attains.states?.[stateAbbr];
    if (stateData && stateData.total > 0) {
      const impairmentRatio = stateData.high / stateData.total;
      return { index: Math.min(3.0, impairmentRatio * 3), worstParam: null, paramCount: 0 };
    }
  } catch {
    // ATTAINS not available
  }
  return { index: 0.5, worstParam: null, paramCount: 0 };
}

export function getExposureDataLive(stateAbbr: string): WaterfrontExposureResult {
  const abbr = stateAbbr.toUpperCase();
  const econ = STATE_ECON_DATA[abbr];
  if (!econ) {
    return {
      stateAbbr: abbr,
      medianHomeValue: 0, waterfrontPremiumPct: 0, estimatedWaterfrontValue: 0,
      waterfrontSharePct: 0, wqDegradationIndex: 0, worstParameter: null,
      parameterCount: 0, waterDepGdpPct: 0, economicDependencyScore: 0,
      exposureScore: 0, depreciationPct: 2, estimatedValueAtRisk: 0,
      aggregateStateRisk: 0, riskLabel: 'Minimal',
    };
  }

  const degradation = computeWqDegradation(abbr);
  return computeExposureFromData(econ, abbr, degradation);
}

export function getAllExposureDataLive(): Record<string, WaterfrontExposureResult> {
  const result: Record<string, WaterfrontExposureResult> = {};
  for (const abbr of Object.keys(STATE_ECON_DATA)) {
    result[abbr] = getExposureDataLive(abbr);
  }
  return result;
}
