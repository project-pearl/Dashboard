import type { IndexScore } from './types';
import type { HucData } from './hucDataCollector';
import { computeConfidence, applyConfidenceRegression } from './confidence';

/** 12-month DMR window */
const DMR_WINDOW_MS = 12 * 30 * 86_400_000;

function isWithinWindow(dateStr: string, windowMs: number): boolean {
  const age = Date.now() - new Date(dateStr).getTime();
  return !Number.isNaN(age) && age >= 0 && age <= windowMs;
}

// ── Embedded State Economic Data ──────────────────────────────────────────────
// Census ACS B25077 (2018-2022), NOAA Coastal Economy, BEA Regional GDP (2022)

interface StateEconData {
  medianHomeValue: number;
  waterfrontPremiumPct: number;
  waterfrontSharePct: number;
  waterDepGdpPct: number;
}

const STATE_ECON_DATA: Record<string, StateEconData> = {
  AL: { medianHomeValue: 172800, waterfrontPremiumPct: 45, waterfrontSharePct: 8,  waterDepGdpPct: 4.2 },
  AK: { medianHomeValue: 318200, waterfrontPremiumPct: 65, waterfrontSharePct: 22, waterDepGdpPct: 12.8 },
  AZ: { medianHomeValue: 321200, waterfrontPremiumPct: 55, waterfrontSharePct: 3,  waterDepGdpPct: 2.1 },
  AR: { medianHomeValue: 142100, waterfrontPremiumPct: 40, waterfrontSharePct: 6,  waterDepGdpPct: 3.1 },
  CA: { medianHomeValue: 659300, waterfrontPremiumPct: 95, waterfrontSharePct: 12, waterDepGdpPct: 5.2 },
  CO: { medianHomeValue: 476900, waterfrontPremiumPct: 50, waterfrontSharePct: 4,  waterDepGdpPct: 2.8 },
  CT: { medianHomeValue: 315200, waterfrontPremiumPct: 80, waterfrontSharePct: 14, waterDepGdpPct: 4.8 },
  DE: { medianHomeValue: 306500, waterfrontPremiumPct: 75, waterfrontSharePct: 18, waterDepGdpPct: 5.5 },
  DC: { medianHomeValue: 668800, waterfrontPremiumPct: 70, waterfrontSharePct: 8,  waterDepGdpPct: 1.8 },
  FL: { medianHomeValue: 321200, waterfrontPremiumPct: 110, waterfrontSharePct: 20, waterDepGdpPct: 8.4 },
  GA: { medianHomeValue: 245900, waterfrontPremiumPct: 55, waterfrontSharePct: 7,  waterDepGdpPct: 3.4 },
  HI: { medianHomeValue: 722500, waterfrontPremiumPct: 120, waterfrontSharePct: 25, waterDepGdpPct: 14.2 },
  ID: { medianHomeValue: 350400, waterfrontPremiumPct: 55, waterfrontSharePct: 5,  waterDepGdpPct: 3.2 },
  IL: { medianHomeValue: 239100, waterfrontPremiumPct: 60, waterfrontSharePct: 6,  waterDepGdpPct: 3.1 },
  IN: { medianHomeValue: 183200, waterfrontPremiumPct: 45, waterfrontSharePct: 5,  waterDepGdpPct: 2.4 },
  IA: { medianHomeValue: 160900, waterfrontPremiumPct: 40, waterfrontSharePct: 4,  waterDepGdpPct: 2.2 },
  KS: { medianHomeValue: 174000, waterfrontPremiumPct: 35, waterfrontSharePct: 3,  waterDepGdpPct: 1.8 },
  KY: { medianHomeValue: 164900, waterfrontPremiumPct: 40, waterfrontSharePct: 6,  waterDepGdpPct: 2.6 },
  LA: { medianHomeValue: 192800, waterfrontPremiumPct: 60, waterfrontSharePct: 15, waterDepGdpPct: 8.8 },
  ME: { medianHomeValue: 262100, waterfrontPremiumPct: 85, waterfrontSharePct: 18, waterDepGdpPct: 7.2 },
  MD: { medianHomeValue: 380100, waterfrontPremiumPct: 75, waterfrontSharePct: 16, waterDepGdpPct: 5.8 },
  MA: { medianHomeValue: 498800, waterfrontPremiumPct: 90, waterfrontSharePct: 16, waterDepGdpPct: 6.4 },
  MI: { medianHomeValue: 201100, waterfrontPremiumPct: 65, waterfrontSharePct: 12, waterDepGdpPct: 4.8 },
  MN: { medianHomeValue: 286800, waterfrontPremiumPct: 55, waterfrontSharePct: 10, waterDepGdpPct: 3.2 },
  MS: { medianHomeValue: 140300, waterfrontPremiumPct: 50, waterfrontSharePct: 8,  waterDepGdpPct: 5.2 },
  MO: { medianHomeValue: 183200, waterfrontPremiumPct: 45, waterfrontSharePct: 5,  waterDepGdpPct: 2.4 },
  MT: { medianHomeValue: 339500, waterfrontPremiumPct: 60, waterfrontSharePct: 5,  waterDepGdpPct: 3.8 },
  NE: { medianHomeValue: 187500, waterfrontPremiumPct: 35, waterfrontSharePct: 3,  waterDepGdpPct: 1.8 },
  NV: { medianHomeValue: 383600, waterfrontPremiumPct: 65, waterfrontSharePct: 3,  waterDepGdpPct: 2.2 },
  NH: { medianHomeValue: 336200, waterfrontPremiumPct: 80, waterfrontSharePct: 12, waterDepGdpPct: 4.4 },
  NJ: { medianHomeValue: 401400, waterfrontPremiumPct: 85, waterfrontSharePct: 18, waterDepGdpPct: 6.2 },
  NM: { medianHomeValue: 217400, waterfrontPremiumPct: 35, waterfrontSharePct: 2,  waterDepGdpPct: 1.4 },
  NY: { medianHomeValue: 383700, waterfrontPremiumPct: 90, waterfrontSharePct: 14, waterDepGdpPct: 5.4 },
  NC: { medianHomeValue: 250000, waterfrontPremiumPct: 65, waterfrontSharePct: 10, waterDepGdpPct: 4.2 },
  ND: { medianHomeValue: 220600, waterfrontPremiumPct: 30, waterfrontSharePct: 3,  waterDepGdpPct: 1.5 },
  OH: { medianHomeValue: 180200, waterfrontPremiumPct: 50, waterfrontSharePct: 7,  waterDepGdpPct: 3.0 },
  OK: { medianHomeValue: 158200, waterfrontPremiumPct: 40, waterfrontSharePct: 5,  waterDepGdpPct: 2.2 },
  OR: { medianHomeValue: 423600, waterfrontPremiumPct: 70, waterfrontSharePct: 8,  waterDepGdpPct: 4.8 },
  PA: { medianHomeValue: 230800, waterfrontPremiumPct: 55, waterfrontSharePct: 8,  waterDepGdpPct: 3.2 },
  RI: { medianHomeValue: 350600, waterfrontPremiumPct: 85, waterfrontSharePct: 20, waterDepGdpPct: 6.8 },
  SC: { medianHomeValue: 210700, waterfrontPremiumPct: 70, waterfrontSharePct: 12, waterDepGdpPct: 5.2 },
  SD: { medianHomeValue: 219900, waterfrontPremiumPct: 35, waterfrontSharePct: 3,  waterDepGdpPct: 1.6 },
  TN: { medianHomeValue: 232100, waterfrontPremiumPct: 50, waterfrontSharePct: 7,  waterDepGdpPct: 2.8 },
  TX: { medianHomeValue: 243600, waterfrontPremiumPct: 60, waterfrontSharePct: 8,  waterDepGdpPct: 4.5 },
  UT: { medianHomeValue: 429500, waterfrontPremiumPct: 50, waterfrontSharePct: 3,  waterDepGdpPct: 2.2 },
  VT: { medianHomeValue: 272400, waterfrontPremiumPct: 70, waterfrontSharePct: 10, waterDepGdpPct: 4.2 },
  VA: { medianHomeValue: 339800, waterfrontPremiumPct: 70, waterfrontSharePct: 12, waterDepGdpPct: 4.8 },
  WA: { medianHomeValue: 504200, waterfrontPremiumPct: 85, waterfrontSharePct: 14, waterDepGdpPct: 5.8 },
  WV: { medianHomeValue: 128600, waterfrontPremiumPct: 35, waterfrontSharePct: 5,  waterDepGdpPct: 2.2 },
  WI: { medianHomeValue: 230200, waterfrontPremiumPct: 60, waterfrontSharePct: 10, waterDepGdpPct: 3.5 },
  WY: { medianHomeValue: 264400, waterfrontPremiumPct: 45, waterfrontSharePct: 3,  waterDepGdpPct: 2.0 },
};

// ── WQ Thresholds for hedonic impact parameters ──
const HEDONIC_KEYS = new Set(['DO', 'TN', 'TP', 'TSS', 'turbidity', 'pH']);

interface Threshold { poor: number; direction: 'above' | 'below' | 'range'; rangeMin?: number; rangeMax?: number }
const WQ_THRESHOLDS: Record<string, Threshold> = {
  DO:        { poor: 5,    direction: 'below' },
  TN:        { poor: 2,    direction: 'above' },
  TP:        { poor: 0.1,  direction: 'above' },
  TSS:       { poor: 25,   direction: 'above' },
  turbidity: { poor: 10,   direction: 'above' },
  pH:        { poor: 0,    direction: 'range', rangeMin: 6.5, rangeMax: 8.5 },
};

/**
 * Waterfront Value Exposure Index (0-100, higher = more economic risk from WQ degradation)
 *
 * Components:
 *   State Economic Baseline (30%): waterfront value × proximity × dependency
 *   HUC WQ Degradation (35%): WQP hedonic params median vs thresholds
 *   ATTAINS Impairment (20%): cat4+cat5 fraction
 *   DMR Exceedance Pressure (15%): nutrient DMR exceedance rate
 */
export function computeWaterfrontExposure(data: HucData): IndexScore {
  const now = new Date().toISOString();
  const { stateAbbr, wqpRecords, attainsWaterbodies, icisDmrs } = data;

  const econ = STATE_ECON_DATA[stateAbbr];

  // No state data → neutral with low confidence
  if (!econ) {
    return {
      value: 50,
      confidence: Math.min(computeConfidence('waterfrontExposure', 0, [], 0), 30),
      trend: 'unknown',
      lastCalculated: now,
      dataPoints: 0,
      tidalModified: false,
    };
  }

  // ── 1. State Economic Baseline (30%) ──
  const waterfrontValue = econ.medianHomeValue * (1 + econ.waterfrontPremiumPct / 100);
  const proximityFactor = Math.min(1.0, econ.waterfrontSharePct / 25);
  const dependencyMult = 1 + (econ.waterDepGdpPct / 100) * 2;
  const rawEcon = waterfrontValue * proximityFactor * dependencyMult;
  const MAX_RAW = 800000;
  const econBaseline = Math.min(100, Math.max(0, (rawEcon / MAX_RAW) * 100));

  // ── 2. HUC WQ Degradation (35%) ──
  const byParam = new Map<string, number[]>();
  for (const r of wqpRecords) {
    if (!HEDONIC_KEYS.has(r.key)) continue;
    if (!byParam.has(r.key)) byParam.set(r.key, []);
    byParam.get(r.key)!.push(r.val);
  }

  let wqDegradation = 50; // neutral fallback
  if (byParam.size > 0) {
    const ratios: number[] = [];
    for (const [param, values] of byParam) {
      const t = WQ_THRESHOLDS[param];
      if (!t) continue;
      const sorted = [...values].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];

      let ratio: number;
      if (t.direction === 'below') {
        ratio = median > 0 ? t.poor / median : 2.0;
      } else if (t.direction === 'range') {
        const mid = ((t.rangeMin ?? 6.5) + (t.rangeMax ?? 8.5)) / 2;
        const halfRange = ((t.rangeMax ?? 8.5) - (t.rangeMin ?? 6.5)) / 2;
        ratio = Math.abs(median - mid) / halfRange;
      } else {
        ratio = t.poor > 0 ? median / t.poor : 0;
      }
      ratios.push(Math.max(0, ratio));
    }

    if (ratios.length > 0) {
      const worst = Math.max(...ratios);
      const avg = ratios.reduce((s, r) => s + r, 0) / ratios.length;
      const blended = Math.min(3.0, worst * 0.7 + avg * 0.3);
      wqDegradation = Math.min(100, (blended / 3.0) * 100);
    }
  }

  // ── 3. ATTAINS Impairment (20%) ──
  let attainsImpairment = 50;
  if (attainsWaterbodies.length > 0) {
    const impaired = attainsWaterbodies.filter(wb =>
      wb.category.startsWith('4') || wb.category.startsWith('5')
    ).length;
    attainsImpairment = (impaired / attainsWaterbodies.length) * 100;
  }

  // ── 4. DMR Exceedance Pressure (15%) ──
  const nutrientKeys = new Set(['TN', 'TP']);
  const nutrientDmrs = icisDmrs.filter(d =>
    nutrientKeys.has(d.pearlKey) &&
    d.period && isWithinWindow(d.period, DMR_WINDOW_MS)
  );
  let dmrPressure = 50;
  if (nutrientDmrs.length > 0) {
    const exceedanceRate = nutrientDmrs.filter(d => d.exceedance).length / nutrientDmrs.length;
    dmrPressure = exceedanceRate * 100;
  }

  // ── Weighted composite ──
  const rawScore =
    econBaseline * 0.30 +
    wqDegradation * 0.35 +
    attainsImpairment * 0.20 +
    dmrPressure * 0.15;

  // ── Confidence ──
  const dataPoints = byParam.size + attainsWaterbodies.length + nutrientDmrs.length;
  const dates = [
    ...wqpRecords.filter(r => HEDONIC_KEYS.has(r.key)).map(r => r.date),
    ...nutrientDmrs.map(d => d.period),
  ];
  const sources = new Set<string>();
  sources.add('state-econ'); // always present
  if (byParam.size > 0) sources.add('wqp');
  if (attainsWaterbodies.length > 0) sources.add('attains');
  if (nutrientDmrs.length > 0) sources.add('icis-dmr');

  const confidence = computeConfidence('waterfrontExposure', dataPoints, dates, sources.size);
  const value = Math.round(Math.max(0, Math.min(100, applyConfidenceRegression(rawScore, confidence))));

  // ── Trend ──
  let trend: IndexScore['trend'] = 'unknown';
  if (wqpRecords.length >= 5 && attainsWaterbodies.length > 0) {
    const impairedRatio = attainsWaterbodies.filter(wb =>
      wb.category.startsWith('4') || wb.category.startsWith('5')
    ).length / attainsWaterbodies.length;
    trend = impairedRatio > 0.5 ? 'declining' : impairedRatio < 0.2 ? 'improving' : 'stable';
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
