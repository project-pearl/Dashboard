import type { IndexScore } from './types';
import type { HucData } from './hucDataCollector';
import { computeConfidence, applyConfidenceRegression } from './confidence';

// ── Embedded USFWS T&E Species Counts by State ──────────────────────────────
// Source: USFWS ECOS species-by-state reports (2024-2025)

const STATE_TE_DATA: Record<string, { total: number; aquatic: number; critHab: number }> = {
  AL: { total: 127, aquatic: 98, critHab: 68 },
  AK: { total: 22,  aquatic: 12, critHab: 14 },
  AZ: { total: 64,  aquatic: 22, critHab: 48 },
  AR: { total: 44,  aquatic: 28, critHab: 20 },
  CA: { total: 299, aquatic: 68, critHab: 195 },
  CO: { total: 36,  aquatic: 14, critHab: 22 },
  CT: { total: 18,  aquatic: 8,  critHab: 6 },
  DE: { total: 17,  aquatic: 8,  critHab: 5 },
  DC: { total: 8,   aquatic: 3,  critHab: 2 },
  FL: { total: 135, aquatic: 42, critHab: 78 },
  GA: { total: 75,  aquatic: 42, critHab: 38 },
  HI: { total: 503, aquatic: 8,  critHab: 285 },
  ID: { total: 24,  aquatic: 12, critHab: 16 },
  IL: { total: 38,  aquatic: 22, critHab: 12 },
  IN: { total: 30,  aquatic: 18, critHab: 10 },
  IA: { total: 20,  aquatic: 10, critHab: 6 },
  KS: { total: 22,  aquatic: 10, critHab: 8 },
  KY: { total: 52,  aquatic: 38, critHab: 22 },
  LA: { total: 36,  aquatic: 16, critHab: 14 },
  ME: { total: 18,  aquatic: 10, critHab: 8 },
  MD: { total: 24,  aquatic: 12, critHab: 8 },
  MA: { total: 22,  aquatic: 12, critHab: 10 },
  MI: { total: 26,  aquatic: 14, critHab: 10 },
  MN: { total: 18,  aquatic: 8,  critHab: 6 },
  MS: { total: 55,  aquatic: 32, critHab: 24 },
  MO: { total: 42,  aquatic: 22, critHab: 16 },
  MT: { total: 18,  aquatic: 8,  critHab: 10 },
  NE: { total: 18,  aquatic: 6,  critHab: 8 },
  NV: { total: 38,  aquatic: 18, critHab: 24 },
  NH: { total: 14,  aquatic: 6,  critHab: 4 },
  NJ: { total: 20,  aquatic: 8,  critHab: 6 },
  NM: { total: 52,  aquatic: 18, critHab: 34 },
  NY: { total: 28,  aquatic: 12, critHab: 10 },
  NC: { total: 72,  aquatic: 42, critHab: 36 },
  ND: { total: 12,  aquatic: 4,  critHab: 4 },
  OH: { total: 30,  aquatic: 18, critHab: 10 },
  OK: { total: 30,  aquatic: 14, critHab: 12 },
  OR: { total: 62,  aquatic: 28, critHab: 42 },
  PA: { total: 24,  aquatic: 14, critHab: 8 },
  RI: { total: 12,  aquatic: 6,  critHab: 4 },
  SC: { total: 42,  aquatic: 20, critHab: 18 },
  SD: { total: 14,  aquatic: 4,  critHab: 6 },
  TN: { total: 102, aquatic: 78, critHab: 48 },
  TX: { total: 105, aquatic: 36, critHab: 62 },
  UT: { total: 42,  aquatic: 16, critHab: 28 },
  VT: { total: 12,  aquatic: 4,  critHab: 4 },
  VA: { total: 72,  aquatic: 42, critHab: 32 },
  WA: { total: 52,  aquatic: 26, critHab: 36 },
  WV: { total: 28,  aquatic: 18, critHab: 10 },
  WI: { total: 20,  aquatic: 8,  critHab: 6 },
  WY: { total: 14,  aquatic: 6,  critHab: 8 },
};

/**
 * Ecological Health Index (0-100, higher = more ecological stress)
 *
 * Components:
 *   Aquatic T&E Baseline (30%): state aquatic T&E species count
 *   Total T&E + CritHab (15%): total species + critical habitat density
 *   ATTAINS Impairment Stress (35%): impairment ratio + cause complexity
 *   Recovery Gap (20%): TMDL coverage deficit
 */
export function computeEcologicalHealth(data: HucData): IndexScore {
  const now = new Date().toISOString();
  const { stateAbbr, attainsWaterbodies } = data;

  const te = STATE_TE_DATA[stateAbbr];

  // No state data → neutral with low confidence
  if (!te) {
    return {
      value: 50,
      confidence: Math.min(computeConfidence('ecologicalHealth', 0, [], 0), 30),
      trend: 'unknown',
      lastCalculated: now,
      dataPoints: 0,
      tidalModified: false,
    };
  }

  // ── 1. Aquatic T&E Baseline (30%) ──
  const aquaticScore = Math.min(100, (te.aquatic / 80) * 100);

  // ── 2. Total T&E + Critical Habitat (15%) ──
  const totalNorm = Math.min(100, (te.total / 200) * 100);
  const critHabNorm = Math.min(100, (te.critHab / 80) * 100);
  const teCritScore = (totalNorm + critHabNorm) / 2;

  // ── 3. ATTAINS Impairment Stress (35%) ──
  let impairmentStress = 50; // neutral fallback
  if (attainsWaterbodies.length > 0) {
    const impaired = attainsWaterbodies.filter(wb =>
      wb.category.startsWith('4') || wb.category.startsWith('5')
    ).length;
    const impairmentRatio = impaired / attainsWaterbodies.length;
    const avgCauses = attainsWaterbodies.reduce((s, wb) => s + wb.causeCount, 0) / attainsWaterbodies.length;
    const causeStress = Math.min(1, avgCauses / 5);
    impairmentStress = (impairmentRatio * 0.7 + causeStress * 0.3) * 100;
  }

  // ── 4. Recovery Gap (20%) ──
  let recoveryGap = 50; // neutral fallback
  if (attainsWaterbodies.length > 0) {
    const completed = attainsWaterbodies.filter(wb => wb.tmdlStatus === 'completed').length;
    const needed = attainsWaterbodies.filter(wb => wb.tmdlStatus === 'needed').length;
    const total = completed + needed;
    recoveryGap = total > 0 ? (1 - completed / total) * 100 : 50;
  }

  // ── Weighted composite ──
  const rawScore =
    aquaticScore * 0.30 +
    teCritScore * 0.15 +
    impairmentStress * 0.35 +
    recoveryGap * 0.20;

  // ── Confidence ──
  const dataPoints = attainsWaterbodies.length + 1; // +1 for state baseline
  const sources = new Set<string>();
  sources.add('usfws'); // always present
  if (attainsWaterbodies.length > 0) sources.add('attains');

  const confidence = computeConfidence('ecologicalHealth', dataPoints, [], sources.size);
  const value = Math.round(Math.max(0, Math.min(100, applyConfidenceRegression(rawScore, confidence))));

  // ── Trend ──
  let trend: IndexScore['trend'] = 'unknown';
  if (attainsWaterbodies.length >= 3) {
    const impairedRatio = attainsWaterbodies.filter(wb =>
      wb.category.startsWith('4') || wb.category.startsWith('5')
    ).length / attainsWaterbodies.length;
    const tmdlCompleted = attainsWaterbodies.filter(wb => wb.tmdlStatus === 'completed').length;
    const tmdlNeeded = attainsWaterbodies.filter(wb => wb.tmdlStatus === 'needed').length;
    if (tmdlCompleted > tmdlNeeded && impairedRatio < 0.3) {
      trend = 'improving';
    } else if (impairedRatio > 0.6) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }
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
