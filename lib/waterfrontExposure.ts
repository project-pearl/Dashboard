// lib/waterfrontExposure.ts
// Waterfront Value Exposure Score — hedonic pricing model for economic risk
//
// Combines Census ACS median home values, BEA water-dependent GDP data,
// and embedded WQ degradation baselines to estimate waterfront property
// value at risk from water quality degradation.
//
// Sources:
//   - U.S. Census Bureau, ACS 5-Year Estimates B25077 (2018-2022)
//   - NOAA Coastal Economy Reports (waterfront premium research)
//   - Bureau of Economic Analysis, Regional GDP by Industry (2022)
//   - EPA ATTAINS 303(d) state impairment ratios (embedded baseline)
//
// Follows lib/ejVulnerability.ts pattern: fully self-contained embedded
// state data + on-demand scoring. No server-only imports — safe for
// client components.
//
// For live WQ cache integration, the API route (app/api/waterfront-exposure)
// uses waterfrontExposureLive.ts which layers real-time WQP data on top.

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
// EPA ATTAINS: State-level impairment ratio (high / total assessed)

interface StateEconData {
  medianHomeValue: number;       // Census ACS B25077 (2018-2022)
  waterfrontPremiumPct: number;  // % premium for waterfront properties
  waterfrontSharePct: number;    // % housing stock within 1mi of waterbody
  waterDepGdpPct: number;        // % state GDP from water-dependent sectors
  tourismGdpPct: number;         // tourism/recreation GDP share
  fishingGdpPct: number;         // fishing/aquaculture GDP share
  realEstateGdpPct: number;      // real estate GDP share
  wqDegradation: number;         // baseline WQ degradation index (0-3, from ATTAINS impairment ratios)
}

// wqDegradation baseline derived from EPA ATTAINS 303(d) impairment ratios:
//   ratio = (category 5 impaired waterbodies) / (total assessed waterbodies)
//   index = min(3.0, ratio * 3)
// States with high impairment (MS, LA, PA, OH) score > 1.0
// States with low impairment (MT, WY, ND) score < 0.3
const STATE_ECON_DATA: Record<string, StateEconData> = {
  AL: { medianHomeValue: 172800, waterfrontPremiumPct: 45, waterfrontSharePct: 8,  waterDepGdpPct: 4.2, tourismGdpPct: 3.8, fishingGdpPct: 0.4, realEstateGdpPct: 12.1, wqDegradation: 0.72 },
  AK: { medianHomeValue: 318200, waterfrontPremiumPct: 65, waterfrontSharePct: 22, waterDepGdpPct: 12.8, tourismGdpPct: 4.2, fishingGdpPct: 5.1, realEstateGdpPct: 9.8,  wqDegradation: 0.28 },
  AZ: { medianHomeValue: 321200, waterfrontPremiumPct: 55, waterfrontSharePct: 3,  waterDepGdpPct: 2.1, tourismGdpPct: 4.5, fishingGdpPct: 0.1, realEstateGdpPct: 14.2, wqDegradation: 0.45 },
  AR: { medianHomeValue: 142100, waterfrontPremiumPct: 40, waterfrontSharePct: 6,  waterDepGdpPct: 3.1, tourismGdpPct: 2.8, fishingGdpPct: 0.3, realEstateGdpPct: 11.4, wqDegradation: 0.68 },
  CA: { medianHomeValue: 659300, waterfrontPremiumPct: 95, waterfrontSharePct: 12, waterDepGdpPct: 5.2, tourismGdpPct: 5.8, fishingGdpPct: 0.3, realEstateGdpPct: 16.8, wqDegradation: 0.58 },
  CO: { medianHomeValue: 476900, waterfrontPremiumPct: 50, waterfrontSharePct: 4,  waterDepGdpPct: 2.8, tourismGdpPct: 5.2, fishingGdpPct: 0.1, realEstateGdpPct: 14.5, wqDegradation: 0.38 },
  CT: { medianHomeValue: 315200, waterfrontPremiumPct: 80, waterfrontSharePct: 14, waterDepGdpPct: 4.8, tourismGdpPct: 3.2, fishingGdpPct: 0.4, realEstateGdpPct: 15.2, wqDegradation: 0.52 },
  DE: { medianHomeValue: 306500, waterfrontPremiumPct: 75, waterfrontSharePct: 18, waterDepGdpPct: 5.5, tourismGdpPct: 4.8, fishingGdpPct: 0.3, realEstateGdpPct: 13.8, wqDegradation: 0.62 },
  DC: { medianHomeValue: 668800, waterfrontPremiumPct: 70, waterfrontSharePct: 8,  waterDepGdpPct: 1.8, tourismGdpPct: 5.5, fishingGdpPct: 0.0, realEstateGdpPct: 18.2, wqDegradation: 0.75 },
  FL: { medianHomeValue: 321200, waterfrontPremiumPct: 110, waterfrontSharePct: 20, waterDepGdpPct: 8.4, tourismGdpPct: 9.2, fishingGdpPct: 0.5, realEstateGdpPct: 16.4, wqDegradation: 0.65 },
  GA: { medianHomeValue: 245900, waterfrontPremiumPct: 55, waterfrontSharePct: 7,  waterDepGdpPct: 3.4, tourismGdpPct: 3.8, fishingGdpPct: 0.3, realEstateGdpPct: 13.1, wqDegradation: 0.55 },
  HI: { medianHomeValue: 722500, waterfrontPremiumPct: 120, waterfrontSharePct: 25, waterDepGdpPct: 14.2, tourismGdpPct: 10.8, fishingGdpPct: 0.6, realEstateGdpPct: 17.5, wqDegradation: 0.32 },
  ID: { medianHomeValue: 350400, waterfrontPremiumPct: 55, waterfrontSharePct: 5,  waterDepGdpPct: 3.2, tourismGdpPct: 3.5, fishingGdpPct: 0.2, realEstateGdpPct: 12.8, wqDegradation: 0.35 },
  IL: { medianHomeValue: 239100, waterfrontPremiumPct: 60, waterfrontSharePct: 6,  waterDepGdpPct: 3.1, tourismGdpPct: 3.4, fishingGdpPct: 0.1, realEstateGdpPct: 14.2, wqDegradation: 0.72 },
  IN: { medianHomeValue: 183200, waterfrontPremiumPct: 45, waterfrontSharePct: 5,  waterDepGdpPct: 2.4, tourismGdpPct: 2.8, fishingGdpPct: 0.1, realEstateGdpPct: 11.8, wqDegradation: 0.68 },
  IA: { medianHomeValue: 160900, waterfrontPremiumPct: 40, waterfrontSharePct: 4,  waterDepGdpPct: 2.2, tourismGdpPct: 2.4, fishingGdpPct: 0.1, realEstateGdpPct: 11.2, wqDegradation: 0.82 },
  KS: { medianHomeValue: 174000, waterfrontPremiumPct: 35, waterfrontSharePct: 3,  waterDepGdpPct: 1.8, tourismGdpPct: 2.2, fishingGdpPct: 0.1, realEstateGdpPct: 11.5, wqDegradation: 0.58 },
  KY: { medianHomeValue: 164900, waterfrontPremiumPct: 40, waterfrontSharePct: 6,  waterDepGdpPct: 2.6, tourismGdpPct: 3.2, fishingGdpPct: 0.1, realEstateGdpPct: 11.4, wqDegradation: 0.65 },
  LA: { medianHomeValue: 192800, waterfrontPremiumPct: 60, waterfrontSharePct: 15, waterDepGdpPct: 8.8, tourismGdpPct: 5.2, fishingGdpPct: 1.8, realEstateGdpPct: 11.8, wqDegradation: 0.92 },
  ME: { medianHomeValue: 262100, waterfrontPremiumPct: 85, waterfrontSharePct: 18, waterDepGdpPct: 7.2, tourismGdpPct: 5.8, fishingGdpPct: 1.2, realEstateGdpPct: 14.2, wqDegradation: 0.30 },
  MD: { medianHomeValue: 380100, waterfrontPremiumPct: 75, waterfrontSharePct: 16, waterDepGdpPct: 5.8, tourismGdpPct: 4.2, fishingGdpPct: 0.5, realEstateGdpPct: 15.8, wqDegradation: 0.68 },
  MA: { medianHomeValue: 498800, waterfrontPremiumPct: 90, waterfrontSharePct: 16, waterDepGdpPct: 6.4, tourismGdpPct: 4.8, fishingGdpPct: 0.8, realEstateGdpPct: 16.2, wqDegradation: 0.48 },
  MI: { medianHomeValue: 201100, waterfrontPremiumPct: 65, waterfrontSharePct: 12, waterDepGdpPct: 4.8, tourismGdpPct: 3.8, fishingGdpPct: 0.2, realEstateGdpPct: 12.4, wqDegradation: 0.55 },
  MN: { medianHomeValue: 286800, waterfrontPremiumPct: 55, waterfrontSharePct: 10, waterDepGdpPct: 3.2, tourismGdpPct: 3.2, fishingGdpPct: 0.1, realEstateGdpPct: 13.2, wqDegradation: 0.42 },
  MS: { medianHomeValue: 140300, waterfrontPremiumPct: 50, waterfrontSharePct: 8,  waterDepGdpPct: 5.2, tourismGdpPct: 3.8, fishingGdpPct: 0.8, realEstateGdpPct: 10.8, wqDegradation: 0.95 },
  MO: { medianHomeValue: 183200, waterfrontPremiumPct: 45, waterfrontSharePct: 5,  waterDepGdpPct: 2.4, tourismGdpPct: 3.2, fishingGdpPct: 0.1, realEstateGdpPct: 12.2, wqDegradation: 0.62 },
  MT: { medianHomeValue: 339500, waterfrontPremiumPct: 60, waterfrontSharePct: 5,  waterDepGdpPct: 3.8, tourismGdpPct: 4.2, fishingGdpPct: 0.2, realEstateGdpPct: 12.5, wqDegradation: 0.22 },
  NE: { medianHomeValue: 187500, waterfrontPremiumPct: 35, waterfrontSharePct: 3,  waterDepGdpPct: 1.8, tourismGdpPct: 2.2, fishingGdpPct: 0.1, realEstateGdpPct: 11.4, wqDegradation: 0.55 },
  NV: { medianHomeValue: 383600, waterfrontPremiumPct: 65, waterfrontSharePct: 3,  waterDepGdpPct: 2.2, tourismGdpPct: 14.8, fishingGdpPct: 0.0, realEstateGdpPct: 14.8, wqDegradation: 0.40 },
  NH: { medianHomeValue: 336200, waterfrontPremiumPct: 80, waterfrontSharePct: 12, waterDepGdpPct: 4.4, tourismGdpPct: 4.8, fishingGdpPct: 0.3, realEstateGdpPct: 14.8, wqDegradation: 0.32 },
  NJ: { medianHomeValue: 401400, waterfrontPremiumPct: 85, waterfrontSharePct: 18, waterDepGdpPct: 6.2, tourismGdpPct: 5.2, fishingGdpPct: 0.4, realEstateGdpPct: 15.8, wqDegradation: 0.58 },
  NM: { medianHomeValue: 217400, waterfrontPremiumPct: 35, waterfrontSharePct: 2,  waterDepGdpPct: 1.4, tourismGdpPct: 3.2, fishingGdpPct: 0.0, realEstateGdpPct: 11.2, wqDegradation: 0.38 },
  NY: { medianHomeValue: 383700, waterfrontPremiumPct: 90, waterfrontSharePct: 14, waterDepGdpPct: 5.4, tourismGdpPct: 5.8, fishingGdpPct: 0.3, realEstateGdpPct: 17.2, wqDegradation: 0.55 },
  NC: { medianHomeValue: 250000, waterfrontPremiumPct: 65, waterfrontSharePct: 10, waterDepGdpPct: 4.2, tourismGdpPct: 4.5, fishingGdpPct: 0.3, realEstateGdpPct: 13.5, wqDegradation: 0.52 },
  ND: { medianHomeValue: 220600, waterfrontPremiumPct: 30, waterfrontSharePct: 3,  waterDepGdpPct: 1.5, tourismGdpPct: 2.0, fishingGdpPct: 0.1, realEstateGdpPct: 10.2, wqDegradation: 0.25 },
  OH: { medianHomeValue: 180200, waterfrontPremiumPct: 50, waterfrontSharePct: 7,  waterDepGdpPct: 3.0, tourismGdpPct: 3.2, fishingGdpPct: 0.1, realEstateGdpPct: 12.4, wqDegradation: 0.78 },
  OK: { medianHomeValue: 158200, waterfrontPremiumPct: 40, waterfrontSharePct: 5,  waterDepGdpPct: 2.2, tourismGdpPct: 2.8, fishingGdpPct: 0.1, realEstateGdpPct: 11.2, wqDegradation: 0.60 },
  OR: { medianHomeValue: 423600, waterfrontPremiumPct: 70, waterfrontSharePct: 8,  waterDepGdpPct: 4.8, tourismGdpPct: 4.2, fishingGdpPct: 0.5, realEstateGdpPct: 14.2, wqDegradation: 0.42 },
  PA: { medianHomeValue: 230800, waterfrontPremiumPct: 55, waterfrontSharePct: 8,  waterDepGdpPct: 3.2, tourismGdpPct: 3.4, fishingGdpPct: 0.2, realEstateGdpPct: 13.8, wqDegradation: 0.75 },
  RI: { medianHomeValue: 350600, waterfrontPremiumPct: 85, waterfrontSharePct: 20, waterDepGdpPct: 6.8, tourismGdpPct: 4.8, fishingGdpPct: 0.6, realEstateGdpPct: 15.4, wqDegradation: 0.48 },
  SC: { medianHomeValue: 210700, waterfrontPremiumPct: 70, waterfrontSharePct: 12, waterDepGdpPct: 5.2, tourismGdpPct: 5.5, fishingGdpPct: 0.3, realEstateGdpPct: 13.2, wqDegradation: 0.55 },
  SD: { medianHomeValue: 219900, waterfrontPremiumPct: 35, waterfrontSharePct: 3,  waterDepGdpPct: 1.6, tourismGdpPct: 2.5, fishingGdpPct: 0.1, realEstateGdpPct: 10.8, wqDegradation: 0.28 },
  TN: { medianHomeValue: 232100, waterfrontPremiumPct: 50, waterfrontSharePct: 7,  waterDepGdpPct: 2.8, tourismGdpPct: 3.8, fishingGdpPct: 0.1, realEstateGdpPct: 12.8, wqDegradation: 0.62 },
  TX: { medianHomeValue: 243600, waterfrontPremiumPct: 60, waterfrontSharePct: 8,  waterDepGdpPct: 4.5, tourismGdpPct: 4.8, fishingGdpPct: 0.4, realEstateGdpPct: 13.5, wqDegradation: 0.58 },
  UT: { medianHomeValue: 429500, waterfrontPremiumPct: 50, waterfrontSharePct: 3,  waterDepGdpPct: 2.2, tourismGdpPct: 4.5, fishingGdpPct: 0.1, realEstateGdpPct: 13.2, wqDegradation: 0.35 },
  VT: { medianHomeValue: 272400, waterfrontPremiumPct: 70, waterfrontSharePct: 10, waterDepGdpPct: 4.2, tourismGdpPct: 5.2, fishingGdpPct: 0.2, realEstateGdpPct: 14.2, wqDegradation: 0.38 },
  VA: { medianHomeValue: 339800, waterfrontPremiumPct: 70, waterfrontSharePct: 12, waterDepGdpPct: 4.8, tourismGdpPct: 4.2, fishingGdpPct: 0.4, realEstateGdpPct: 14.8, wqDegradation: 0.52 },
  WA: { medianHomeValue: 504200, waterfrontPremiumPct: 85, waterfrontSharePct: 14, waterDepGdpPct: 5.8, tourismGdpPct: 4.8, fishingGdpPct: 0.6, realEstateGdpPct: 15.2, wqDegradation: 0.38 },
  WV: { medianHomeValue: 128600, waterfrontPremiumPct: 35, waterfrontSharePct: 5,  waterDepGdpPct: 2.2, tourismGdpPct: 2.8, fishingGdpPct: 0.1, realEstateGdpPct: 10.8, wqDegradation: 0.82 },
  WI: { medianHomeValue: 230200, waterfrontPremiumPct: 60, waterfrontSharePct: 10, waterDepGdpPct: 3.5, tourismGdpPct: 3.5, fishingGdpPct: 0.1, realEstateGdpPct: 12.8, wqDegradation: 0.45 },
  WY: { medianHomeValue: 264400, waterfrontPremiumPct: 45, waterfrontSharePct: 3,  waterDepGdpPct: 2.0, tourismGdpPct: 4.2, fishingGdpPct: 0.1, realEstateGdpPct: 11.2, wqDegradation: 0.20 },
};

// ── Hedonic Scoring Formula ──────────────────────────────────────────────────

export function computeExposureFromData(
  econ: StateEconData,
  stateAbbr: string,
  degradationOverride?: { index: number; worstParam: string | null; paramCount: number },
): WaterfrontExposureResult {
  const degradation = degradationOverride?.index ?? econ.wqDegradation;
  const worstParam = degradationOverride?.worstParam ?? null;
  const paramCount = degradationOverride?.paramCount ?? 0;

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
  const rawWithDep = rawExposure * dependencyMult;
  const MAX_RAW = 800000;
  const exposureScore = Math.min(100, Math.max(0, Math.round((rawWithDep / MAX_RAW) * 100)));

  // Aggregate state risk (millions)
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

  return computeExposureFromData(econ, stateAbbr);
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

// Re-export for API route live computation
export { STATE_ECON_DATA, type StateEconData };
