// lib/waterfrontExposure.ts
// Waterfront Value Exposure Score — hedonic pricing model for economic risk
//
// Combines Census ACS median home values, BEA water-dependent GDP data,
// and live WQ degradation from wqpCache/attainsCache to estimate
// waterfront property value at risk from water quality degradation.
//
// Sources:
//   - U.S. Census Bureau, ACS 5-Year Estimates B25077 (2018-2022)
//   - NOAA Coastal Economy Reports (waterfront premium research)
//   - Bureau of Economic Analysis, Regional GDP by Industry (2022)
//   - EPA Water Quality Portal (live WQP cache data)
//   - EPA ATTAINS 303(d) impairment data (fallback)
//
// Follows lib/ejVulnerability.ts pattern: embedded state data + on-demand scoring.

import { getWqpAllRecords, type WqpRecord } from './wqpCache';
import { getAttainsCache } from './attainsCache';
import { getThresholds, KEY_PARAMS, type KeyParam } from './waterQualityScore';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WaterfrontExposureResult {
  stateAbbr: string;
  medianHomeValue: number;
  waterfrontPremiumPct: number;
  estimatedWaterfrontValue: number;
  waterfrontSharePct: number;
  wqDegradationIndex: number;
  worstParameter: string | null;
  parameterCount: number;
  waterDepGdpPct: number;
  economicDependencyScore: number;   // 0-100
  exposureScore: number;             // 0-100
  depreciationPct: number;           // 2-25%
  estimatedValueAtRisk: number;      // $ per waterfront home
  aggregateStateRisk: number;        // $ millions total state exposure
  riskLabel: string;
}

// ── Embedded Reference Data ──────────────────────────────────────────────────
// Census ACS B25077 (2018-2022 5-Year): Median home value
// NOAA Coastal Economy: Waterfront premium % and share of housing stock
// BEA Regional GDP by Industry (2022): Water-dependent sector percentages

interface StateEconData {
  medianHomeValue: number;       // Census ACS B25077 (2018-2022)
  waterfrontPremiumPct: number;  // % premium for waterfront properties
  waterfrontSharePct: number;    // % housing stock within 1mi of waterbody
  waterDepGdpPct: number;        // % state GDP from water-dependent sectors
  tourismGdpPct: number;         // tourism/recreation GDP share
  fishingGdpPct: number;         // fishing/aquaculture GDP share
  realEstateGdpPct: number;      // real estate GDP share
}

const STATE_ECON_DATA: Record<string, StateEconData> = {
  AL: { medianHomeValue: 172800, waterfrontPremiumPct: 45, waterfrontSharePct: 8,  waterDepGdpPct: 4.2, tourismGdpPct: 3.8, fishingGdpPct: 0.4, realEstateGdpPct: 12.1 },
  AK: { medianHomeValue: 318200, waterfrontPremiumPct: 65, waterfrontSharePct: 22, waterDepGdpPct: 12.8, tourismGdpPct: 4.2, fishingGdpPct: 5.1, realEstateGdpPct: 9.8 },
  AZ: { medianHomeValue: 321200, waterfrontPremiumPct: 55, waterfrontSharePct: 3,  waterDepGdpPct: 2.1, tourismGdpPct: 4.5, fishingGdpPct: 0.1, realEstateGdpPct: 14.2 },
  AR: { medianHomeValue: 142100, waterfrontPremiumPct: 40, waterfrontSharePct: 6,  waterDepGdpPct: 3.1, tourismGdpPct: 2.8, fishingGdpPct: 0.3, realEstateGdpPct: 11.4 },
  CA: { medianHomeValue: 659300, waterfrontPremiumPct: 95, waterfrontSharePct: 12, waterDepGdpPct: 5.2, tourismGdpPct: 5.8, fishingGdpPct: 0.3, realEstateGdpPct: 16.8 },
  CO: { medianHomeValue: 476900, waterfrontPremiumPct: 50, waterfrontSharePct: 4,  waterDepGdpPct: 2.8, tourismGdpPct: 5.2, fishingGdpPct: 0.1, realEstateGdpPct: 14.5 },
  CT: { medianHomeValue: 315200, waterfrontPremiumPct: 80, waterfrontSharePct: 14, waterDepGdpPct: 4.8, tourismGdpPct: 3.2, fishingGdpPct: 0.4, realEstateGdpPct: 15.2 },
  DE: { medianHomeValue: 306500, waterfrontPremiumPct: 75, waterfrontSharePct: 18, waterDepGdpPct: 5.5, tourismGdpPct: 4.8, fishingGdpPct: 0.3, realEstateGdpPct: 13.8 },
  DC: { medianHomeValue: 668800, waterfrontPremiumPct: 70, waterfrontSharePct: 8,  waterDepGdpPct: 1.8, tourismGdpPct: 5.5, fishingGdpPct: 0.0, realEstateGdpPct: 18.2 },
  FL: { medianHomeValue: 321200, waterfrontPremiumPct: 110, waterfrontSharePct: 20, waterDepGdpPct: 8.4, tourismGdpPct: 9.2, fishingGdpPct: 0.5, realEstateGdpPct: 16.4 },
  GA: { medianHomeValue: 245900, waterfrontPremiumPct: 55, waterfrontSharePct: 7,  waterDepGdpPct: 3.4, tourismGdpPct: 3.8, fishingGdpPct: 0.3, realEstateGdpPct: 13.1 },
  HI: { medianHomeValue: 722500, waterfrontPremiumPct: 120, waterfrontSharePct: 25, waterDepGdpPct: 14.2, tourismGdpPct: 10.8, fishingGdpPct: 0.6, realEstateGdpPct: 17.5 },
  ID: { medianHomeValue: 350400, waterfrontPremiumPct: 55, waterfrontSharePct: 5,  waterDepGdpPct: 3.2, tourismGdpPct: 3.5, fishingGdpPct: 0.2, realEstateGdpPct: 12.8 },
  IL: { medianHomeValue: 239100, waterfrontPremiumPct: 60, waterfrontSharePct: 6,  waterDepGdpPct: 3.1, tourismGdpPct: 3.4, fishingGdpPct: 0.1, realEstateGdpPct: 14.2 },
  IN: { medianHomeValue: 183200, waterfrontPremiumPct: 45, waterfrontSharePct: 5,  waterDepGdpPct: 2.4, tourismGdpPct: 2.8, fishingGdpPct: 0.1, realEstateGdpPct: 11.8 },
  IA: { medianHomeValue: 160900, waterfrontPremiumPct: 40, waterfrontSharePct: 4,  waterDepGdpPct: 2.2, tourismGdpPct: 2.4, fishingGdpPct: 0.1, realEstateGdpPct: 11.2 },
  KS: { medianHomeValue: 174000, waterfrontPremiumPct: 35, waterfrontSharePct: 3,  waterDepGdpPct: 1.8, tourismGdpPct: 2.2, fishingGdpPct: 0.1, realEstateGdpPct: 11.5 },
  KY: { medianHomeValue: 164900, waterfrontPremiumPct: 40, waterfrontSharePct: 6,  waterDepGdpPct: 2.6, tourismGdpPct: 3.2, fishingGdpPct: 0.1, realEstateGdpPct: 11.4 },
  LA: { medianHomeValue: 192800, waterfrontPremiumPct: 60, waterfrontSharePct: 15, waterDepGdpPct: 8.8, tourismGdpPct: 5.2, fishingGdpPct: 1.8, realEstateGdpPct: 11.8 },
  ME: { medianHomeValue: 262100, waterfrontPremiumPct: 85, waterfrontSharePct: 18, waterDepGdpPct: 7.2, tourismGdpPct: 5.8, fishingGdpPct: 1.2, realEstateGdpPct: 14.2 },
  MD: { medianHomeValue: 380100, waterfrontPremiumPct: 75, waterfrontSharePct: 16, waterDepGdpPct: 5.8, tourismGdpPct: 4.2, fishingGdpPct: 0.5, realEstateGdpPct: 15.8 },
  MA: { medianHomeValue: 498800, waterfrontPremiumPct: 90, waterfrontSharePct: 16, waterDepGdpPct: 6.4, tourismGdpPct: 4.8, fishingGdpPct: 0.8, realEstateGdpPct: 16.2 },
  MI: { medianHomeValue: 201100, waterfrontPremiumPct: 65, waterfrontSharePct: 12, waterDepGdpPct: 4.8, tourismGdpPct: 3.8, fishingGdpPct: 0.2, realEstateGdpPct: 12.4 },
  MN: { medianHomeValue: 286800, waterfrontPremiumPct: 55, waterfrontSharePct: 10, waterDepGdpPct: 3.2, tourismGdpPct: 3.2, fishingGdpPct: 0.1, realEstateGdpPct: 13.2 },
  MS: { medianHomeValue: 140300, waterfrontPremiumPct: 50, waterfrontSharePct: 8,  waterDepGdpPct: 5.2, tourismGdpPct: 3.8, fishingGdpPct: 0.8, realEstateGdpPct: 10.8 },
  MO: { medianHomeValue: 183200, waterfrontPremiumPct: 45, waterfrontSharePct: 5,  waterDepGdpPct: 2.4, tourismGdpPct: 3.2, fishingGdpPct: 0.1, realEstateGdpPct: 12.2 },
  MT: { medianHomeValue: 339500, waterfrontPremiumPct: 60, waterfrontSharePct: 5,  waterDepGdpPct: 3.8, tourismGdpPct: 4.2, fishingGdpPct: 0.2, realEstateGdpPct: 12.5 },
  NE: { medianHomeValue: 187500, waterfrontPremiumPct: 35, waterfrontSharePct: 3,  waterDepGdpPct: 1.8, tourismGdpPct: 2.2, fishingGdpPct: 0.1, realEstateGdpPct: 11.4 },
  NV: { medianHomeValue: 383600, waterfrontPremiumPct: 65, waterfrontSharePct: 3,  waterDepGdpPct: 2.2, tourismGdpPct: 14.8, fishingGdpPct: 0.0, realEstateGdpPct: 14.8 },
  NH: { medianHomeValue: 336200, waterfrontPremiumPct: 80, waterfrontSharePct: 12, waterDepGdpPct: 4.4, tourismGdpPct: 4.8, fishingGdpPct: 0.3, realEstateGdpPct: 14.8 },
  NJ: { medianHomeValue: 401400, waterfrontPremiumPct: 85, waterfrontSharePct: 18, waterDepGdpPct: 6.2, tourismGdpPct: 5.2, fishingGdpPct: 0.4, realEstateGdpPct: 15.8 },
  NM: { medianHomeValue: 217400, waterfrontPremiumPct: 35, waterfrontSharePct: 2,  waterDepGdpPct: 1.4, tourismGdpPct: 3.2, fishingGdpPct: 0.0, realEstateGdpPct: 11.2 },
  NY: { medianHomeValue: 383700, waterfrontPremiumPct: 90, waterfrontSharePct: 14, waterDepGdpPct: 5.4, tourismGdpPct: 5.8, fishingGdpPct: 0.3, realEstateGdpPct: 17.2 },
  NC: { medianHomeValue: 250000, waterfrontPremiumPct: 65, waterfrontSharePct: 10, waterDepGdpPct: 4.2, tourismGdpPct: 4.5, fishingGdpPct: 0.3, realEstateGdpPct: 13.5 },
  ND: { medianHomeValue: 220600, waterfrontPremiumPct: 30, waterfrontSharePct: 3,  waterDepGdpPct: 1.5, tourismGdpPct: 2.0, fishingGdpPct: 0.1, realEstateGdpPct: 10.2 },
  OH: { medianHomeValue: 180200, waterfrontPremiumPct: 50, waterfrontSharePct: 7,  waterDepGdpPct: 3.0, tourismGdpPct: 3.2, fishingGdpPct: 0.1, realEstateGdpPct: 12.4 },
  OK: { medianHomeValue: 158200, waterfrontPremiumPct: 40, waterfrontSharePct: 5,  waterDepGdpPct: 2.2, tourismGdpPct: 2.8, fishingGdpPct: 0.1, realEstateGdpPct: 11.2 },
  OR: { medianHomeValue: 423600, waterfrontPremiumPct: 70, waterfrontSharePct: 8,  waterDepGdpPct: 4.8, tourismGdpPct: 4.2, fishingGdpPct: 0.5, realEstateGdpPct: 14.2 },
  PA: { medianHomeValue: 230800, waterfrontPremiumPct: 55, waterfrontSharePct: 8,  waterDepGdpPct: 3.2, tourismGdpPct: 3.4, fishingGdpPct: 0.2, realEstateGdpPct: 13.8 },
  RI: { medianHomeValue: 350600, waterfrontPremiumPct: 85, waterfrontSharePct: 20, waterDepGdpPct: 6.8, tourismGdpPct: 4.8, fishingGdpPct: 0.6, realEstateGdpPct: 15.4 },
  SC: { medianHomeValue: 210700, waterfrontPremiumPct: 70, waterfrontSharePct: 12, waterDepGdpPct: 5.2, tourismGdpPct: 5.5, fishingGdpPct: 0.3, realEstateGdpPct: 13.2 },
  SD: { medianHomeValue: 219900, waterfrontPremiumPct: 35, waterfrontSharePct: 3,  waterDepGdpPct: 1.6, tourismGdpPct: 2.5, fishingGdpPct: 0.1, realEstateGdpPct: 10.8 },
  TN: { medianHomeValue: 232100, waterfrontPremiumPct: 50, waterfrontSharePct: 7,  waterDepGdpPct: 2.8, tourismGdpPct: 3.8, fishingGdpPct: 0.1, realEstateGdpPct: 12.8 },
  TX: { medianHomeValue: 243600, waterfrontPremiumPct: 60, waterfrontSharePct: 8,  waterDepGdpPct: 4.5, tourismGdpPct: 4.8, fishingGdpPct: 0.4, realEstateGdpPct: 13.5 },
  UT: { medianHomeValue: 429500, waterfrontPremiumPct: 50, waterfrontSharePct: 3,  waterDepGdpPct: 2.2, tourismGdpPct: 4.5, fishingGdpPct: 0.1, realEstateGdpPct: 13.2 },
  VT: { medianHomeValue: 272400, waterfrontPremiumPct: 70, waterfrontSharePct: 10, waterDepGdpPct: 4.2, tourismGdpPct: 5.2, fishingGdpPct: 0.2, realEstateGdpPct: 14.2 },
  VA: { medianHomeValue: 339800, waterfrontPremiumPct: 70, waterfrontSharePct: 12, waterDepGdpPct: 4.8, tourismGdpPct: 4.2, fishingGdpPct: 0.4, realEstateGdpPct: 14.8 },
  WA: { medianHomeValue: 504200, waterfrontPremiumPct: 85, waterfrontSharePct: 14, waterDepGdpPct: 5.8, tourismGdpPct: 4.8, fishingGdpPct: 0.6, realEstateGdpPct: 15.2 },
  WV: { medianHomeValue: 128600, waterfrontPremiumPct: 35, waterfrontSharePct: 5,  waterDepGdpPct: 2.2, tourismGdpPct: 2.8, fishingGdpPct: 0.1, realEstateGdpPct: 10.8 },
  WI: { medianHomeValue: 230200, waterfrontPremiumPct: 60, waterfrontSharePct: 10, waterDepGdpPct: 3.5, tourismGdpPct: 3.5, fishingGdpPct: 0.1, realEstateGdpPct: 12.8 },
  WY: { medianHomeValue: 264400, waterfrontPremiumPct: 45, waterfrontSharePct: 3,  waterDepGdpPct: 2.0, tourismGdpPct: 4.2, fishingGdpPct: 0.1, realEstateGdpPct: 11.2 },
};

// ── WQ Degradation Index ─────────────────────────────────────────────────────
// Uses live WQP cache data to compute per-state water quality degradation.
// Falls back to ATTAINS impairment ratios, then default 0.5.

// Parameters relevant to hedonic property value impact
const HEDONIC_PARAMS: KeyParam[] = ['DO', 'TN', 'TP', 'TSS', 'turbidity', 'pH'];

function computeWqDegradation(stateAbbr: string): { index: number; worstParam: string | null; paramCount: number } {
  const thresholds = getThresholds('freshwater');
  const allRecords = getWqpAllRecords();
  const stateRecords = allRecords.filter(r => r.state === stateAbbr);

  if (stateRecords.length === 0) {
    return computeAttainsFallback(stateAbbr);
  }

  // Group by parameter
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

  // Compute ratio for each parameter: how far past the "poor" threshold
  const ratios: { param: string; ratio: number }[] = [];
  for (const [param, values] of byParam) {
    const t = thresholds[param];
    if (!t) continue;

    // Median value
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    let ratio: number;
    if (t.direction === 'below') {
      // Lower is worse (DO): ratio = threshold / value
      ratio = median > 0 ? t.poor / median : 2.0;
    } else if (t.direction === 'range') {
      // pH: distance from acceptable range
      const mid = ((t.rangeMin ?? 6.5) + (t.rangeMax ?? 8.5)) / 2;
      const halfRange = ((t.rangeMax ?? 8.5) - (t.rangeMin ?? 6.5)) / 2;
      const deviation = Math.abs(median - mid);
      ratio = deviation / halfRange;
    } else {
      // Higher is worse: ratio = value / threshold
      ratio = t.poor > 0 ? median / t.poor : 0;
    }

    ratios.push({ param, ratio: Math.max(0, ratio) });
  }

  if (ratios.length === 0) {
    return computeAttainsFallback(stateAbbr);
  }

  // Blend: 70% worst single parameter + 30% average
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

// ── Hedonic Scoring Formula ──────────────────────────────────────────────────

function computeExposure(stateAbbr: string): WaterfrontExposureResult {
  const econ = STATE_ECON_DATA[stateAbbr];
  if (!econ) {
    return {
      stateAbbr,
      medianHomeValue: 0, waterfrontPremiumPct: 0, estimatedWaterfrontValue: 0,
      waterfrontSharePct: 0, wqDegradationIndex: 0, worstParameter: null,
      parameterCount: 0, waterDepGdpPct: 0, economicDependencyScore: 0,
      exposureScore: 0, depreciationPct: 2, estimatedValueAtRisk: 0,
      aggregateStateRisk: 0, riskLabel: 'Minimal',
    };
  }

  const { index: degradation, worstParam, paramCount } = computeWqDegradation(stateAbbr);

  // Waterfront value = median home value × (1 + premium%)
  const waterfrontValue = econ.medianHomeValue * (1 + econ.waterfrontPremiumPct / 100);

  // Proximity factor: what fraction of housing stock is at risk
  const proximityFactor = Math.min(1.0, econ.waterfrontSharePct / 25);

  // Economic dependency multiplier
  const dependencyMult = 1 + (econ.waterDepGdpPct / 100) * 2;

  // Raw exposure
  const rawExposure = (waterfrontValue * proximityFactor) * degradation;

  // Depreciation %: 2-25% based on degradation
  const depreciationPct = Math.min(25, Math.max(2, 2 + (degradation - 0.5) * 15.3));

  // Value at risk per waterfront home
  const valueAtRisk = waterfrontValue * (depreciationPct / 100);

  // Economic dependency score (0-100)
  const economicDependencyScore = Math.min(100, Math.round(econ.waterDepGdpPct / 15 * 100));

  // Normalize exposure to 0-100
  // Calibrated so FL (high waterfront value, coastal dep, moderate degradation) ~ 65-75
  const rawWithDep = rawExposure * dependencyMult;
  const MAX_RAW = 800000; // calibration ceiling
  const exposureScore = Math.min(100, Math.max(0, Math.round((rawWithDep / MAX_RAW) * 100)));

  // Aggregate state risk (millions): waterfront homes × value at risk
  // Estimate waterfront home count from share of total housing
  // US avg ~140M housing units / 50 states ≈ 2.8M per state (rough)
  const estStateHousingUnits = 2_800_000;
  const waterfrontUnits = estStateHousingUnits * (econ.waterfrontSharePct / 100);
  const aggregateRisk = (waterfrontUnits * valueAtRisk) / 1_000_000;

  return {
    stateAbbr,
    medianHomeValue: econ.medianHomeValue,
    waterfrontPremiumPct: econ.waterfrontPremiumPct,
    estimatedWaterfrontValue: Math.round(waterfrontValue),
    waterfrontSharePct: econ.waterfrontSharePct,
    wqDegradationIndex: Math.round(degradation * 100) / 100,
    worstParameter: worstParam,
    parameterCount: paramCount,
    waterDepGdpPct: econ.waterDepGdpPct,
    economicDependencyScore,
    exposureScore,
    depreciationPct: Math.round(depreciationPct * 10) / 10,
    estimatedValueAtRisk: Math.round(valueAtRisk),
    aggregateStateRisk: Math.round(aggregateRisk),
    riskLabel: exposureRiskLabel(exposureScore),
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getExposureScore(stateAbbr: string): number {
  return computeExposure(stateAbbr.toUpperCase()).exposureScore;
}

export function getExposureData(stateAbbr: string): WaterfrontExposureResult {
  return computeExposure(stateAbbr.toUpperCase());
}

export function getAllExposureScores(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const abbr of Object.keys(STATE_ECON_DATA)) {
    result[abbr] = computeExposure(abbr).exposureScore;
  }
  return result;
}

export function getAllExposureData(): Record<string, WaterfrontExposureResult> {
  const result: Record<string, WaterfrontExposureResult> = {};
  for (const abbr of Object.keys(STATE_ECON_DATA)) {
    result[abbr] = computeExposure(abbr);
  }
  return result;
}

export function exposureRiskLabel(score: number): string {
  if (score >= 70) return 'High';
  if (score >= 50) return 'Elevated';
  if (score >= 35) return 'Moderate';
  if (score >= 20) return 'Low';
  return 'Minimal';
}
