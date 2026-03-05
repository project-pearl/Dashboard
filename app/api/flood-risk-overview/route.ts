/* ------------------------------------------------------------------ */
/*  Flood Risk Overview API — Watershed-level flood probability        */
/*  Groups NWPS gauge forecasts by RFC (River Forecast Center) basin   */
/*  and computes a 0–100 risk score per major waterway.                */
/* ------------------------------------------------------------------ */

import { NextResponse } from 'next/server';
import { getNwpsAllGauges, ensureWarmed as warmNwps } from '@/lib/nwpsCache';
import { ensureWarmed as warmLookup, getByLid } from '@/lib/nwpsGaugeLookup';

export const dynamic = 'force-dynamic';

// ── RFC Metadata ────────────────────────────────────────────────────────────

const RFC_META: Record<string, { name: string; region: string }> = {
  APRFC: { name: 'Alaska Pacific RFC', region: 'Alaska' },
  ABRFC: { name: 'Arkansas-Red Basin RFC', region: 'Arkansas & Red River Basins' },
  CNRFC: { name: 'California Nevada RFC', region: 'California & Nevada' },
  CBRFC: { name: 'Colorado Basin RFC', region: 'Upper Colorado & Great Basin' },
  LMRFC: { name: 'Lower Mississippi RFC', region: 'Lower Mississippi Basin' },
  MARFC: { name: 'Middle Atlantic RFC', region: 'Mid-Atlantic' },
  MBRFC: { name: 'Missouri Basin RFC', region: 'Missouri & Upper Mississippi' },
  NCRFC: { name: 'North Central RFC', region: 'Upper Mississippi & Northern Plains' },
  NERFC: { name: 'Northeast RFC', region: 'New England & Northeast' },
  NWRFC: { name: 'Northwest RFC', region: 'Pacific Northwest' },
  OHRFC: { name: 'Ohio RFC', region: 'Ohio & Tennessee Basins' },
  SERFC: { name: 'Southeast RFC', region: 'Southeast' },
  WGRFC: { name: 'West Gulf RFC', region: 'Texas & Gulf Coast' },
};

// ── Types ───────────────────────────────────────────────────────────────────

export interface BasinRisk {
  rfcCode: string;
  rfcName: string;
  region: string;
  riskScore: number;            // 0–100
  riskLevel: 'critical' | 'high' | 'elevated' | 'moderate' | 'low';
  totalGauges: number;
  gaugesWithData: number;
  major: number;
  moderate: number;
  minor: number;
  action: number;
  currentlyFlooding: number;
  risingTrend: number;          // gauges with significant upward trend
  nearThreshold: number;        // gauges within 15% of action stage
  topGauges: BasinTopGauge[];   // worst 3 gauges for drill-down
}

export interface BasinTopGauge {
  lid: string;
  name: string;
  state: string;
  predictedCategory: string;
  currentStage: number | null;
  forecastPeak: number | null;
  hoursUntilExceedance: number | null;
  unit: string;
}

// ── Risk Score Computation ──────────────────────────────────────────────────

const CATEGORY_WEIGHT = { major: 30, moderate: 18, minor: 8, action: 3 };
const CURRENTLY_FLOODING_WEIGHT = 12;
const RISING_TREND_WEIGHT = 4;
const NEAR_THRESHOLD_WEIGHT = 2;

function computeRiskScore(basin: {
  major: number;
  moderate: number;
  minor: number;
  action: number;
  currentlyFlooding: number;
  risingTrend: number;
  nearThreshold: number;
  gaugesWithData: number;
}): number {
  if (basin.gaugesWithData === 0) return 0;

  // Raw score from weighted counts
  const raw =
    basin.major * CATEGORY_WEIGHT.major +
    basin.moderate * CATEGORY_WEIGHT.moderate +
    basin.minor * CATEGORY_WEIGHT.minor +
    basin.action * CATEGORY_WEIGHT.action +
    basin.currentlyFlooding * CURRENTLY_FLOODING_WEIGHT +
    basin.risingTrend * RISING_TREND_WEIGHT +
    basin.nearThreshold * NEAR_THRESHOLD_WEIGHT;

  // Normalize: scale based on basin size (more gauges = harder to hit 100)
  // Use log scale so large basins aren't unfairly penalized
  const scaleFactor = Math.max(1, Math.log2(basin.gaugesWithData + 1));
  const normalized = (raw / scaleFactor) * 2;

  return Math.min(100, Math.round(normalized));
}

function scoreToLevel(score: number): BasinRisk['riskLevel'] {
  if (score >= 80) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 30) return 'elevated';
  if (score >= 10) return 'moderate';
  return 'low';
}

// ── GET Handler ─────────────────────────────────────────────────────────────

export async function GET() {
  await Promise.all([warmNwps(), warmLookup()]);

  const allGauges = getNwpsAllGauges();

  // Group gauges by RFC
  const rfcGroups = new Map<string, typeof allGauges>();
  for (const gauge of allGauges) {
    const rfcCode = gauge.rfc?.abbreviation || 'UNKNOWN';
    if (!rfcGroups.has(rfcCode)) rfcGroups.set(rfcCode, []);
    rfcGroups.get(rfcCode)!.push(gauge);
  }

  const basins: BasinRisk[] = [];

  for (const [rfcCode, gauges] of rfcGroups) {
    if (rfcCode === 'UNKNOWN') continue; // skip gauges without RFC

    const meta = RFC_META[rfcCode] || { name: rfcCode, region: rfcCode };

    let major = 0, moderate = 0, minor = 0, action = 0;
    let currentlyFlooding = 0, risingTrend = 0, nearThreshold = 0;
    let gaugesWithData = 0;

    const topCandidates: BasinTopGauge[] = [];

    for (const gauge of gauges) {
      if (!gauge.lid || !gauge.stageflow || gauge.stageflow.length === 0) continue;
      gaugesWithData++;

      const thresholds = getByLid(gauge.lid);
      const currentStage = gauge.observed?.primary ?? null;

      // Find peak forecast
      let peakStage = -Infinity;
      let peakTime: string | null = null;
      for (const entry of gauge.stageflow) {
        if (entry.stage != null && entry.stage > peakStage) {
          peakStage = entry.stage;
          peakTime = entry.time;
        }
      }
      if (peakStage === -Infinity) continue;

      // Determine category
      const majorStage = thresholds?.majorStage ?? null;
      const moderateStage = thresholds?.moderateStage ?? null;
      const minorStage = thresholds?.minorStage ?? null;
      const actionStage = thresholds?.actionStage ?? null;

      let category = 'none';
      let thresholdUsed: number | null = null;

      if (majorStage != null && peakStage >= majorStage) {
        category = 'major'; thresholdUsed = majorStage; major++;
      } else if (moderateStage != null && peakStage >= moderateStage) {
        category = 'moderate'; thresholdUsed = moderateStage; moderate++;
      } else if (minorStage != null && peakStage >= minorStage) {
        category = 'minor'; thresholdUsed = minorStage; minor++;
      } else if (actionStage != null && peakStage >= actionStage) {
        category = 'action'; thresholdUsed = actionStage; action++;
      }

      // Currently flooding?
      if (gauge.status !== 'no_flooding' && gauge.status !== 'not_defined') {
        currentlyFlooding++;
      }

      // Rising trend: peak > current * 1.25
      if (currentStage != null && currentStage > 0 && peakStage > currentStage * 1.25) {
        risingTrend++;
      }

      // Near threshold: within 15% of action stage but not yet exceeding
      if (category === 'none' && actionStage != null && actionStage > 0 && currentStage != null) {
        const margin = (actionStage - currentStage) / actionStage;
        if (margin >= 0 && margin <= 0.15) nearThreshold++;
      }

      // Track top gauge candidates (any with a predicted category or flooding)
      if (category !== 'none' || gauge.status !== 'no_flooding') {
        let hoursUntil: number | null = null;
        if (thresholdUsed != null) {
          for (const entry of gauge.stageflow) {
            if (entry.stage != null && entry.stage >= thresholdUsed) {
              const entryMs = new Date(entry.time).getTime();
              if (!isNaN(entryMs)) {
                hoursUntil = Math.max(0, (entryMs - Date.now()) / (1000 * 60 * 60));
                break;
              }
            }
          }
        }

        topCandidates.push({
          lid: gauge.lid,
          name: gauge.name,
          state: gauge.state,
          predictedCategory: category,
          currentStage,
          forecastPeak: Math.round(peakStage * 100) / 100,
          hoursUntilExceedance: hoursUntil != null ? Math.round(hoursUntil * 10) / 10 : null,
          unit: thresholds?.unit || 'ft',
        });
      }
    }

    // Sort top candidates: major first, then by hours
    const catOrder: Record<string, number> = { major: 0, moderate: 1, minor: 2, action: 3, none: 4 };
    topCandidates.sort((a, b) => {
      const diff = (catOrder[a.predictedCategory] ?? 4) - (catOrder[b.predictedCategory] ?? 4);
      if (diff !== 0) return diff;
      return (a.hoursUntilExceedance ?? 999) - (b.hoursUntilExceedance ?? 999);
    });

    const riskScore = computeRiskScore({
      major, moderate, minor, action,
      currentlyFlooding, risingTrend, nearThreshold, gaugesWithData,
    });

    basins.push({
      rfcCode,
      rfcName: meta.name,
      region: meta.region,
      riskScore,
      riskLevel: scoreToLevel(riskScore),
      totalGauges: gauges.length,
      gaugesWithData,
      major,
      moderate,
      minor,
      action,
      currentlyFlooding,
      risingTrend,
      nearThreshold,
      topGauges: topCandidates.slice(0, 3),
    });
  }

  // Sort by risk score descending
  basins.sort((a, b) => b.riskScore - a.riskScore);

  const national = {
    totalBasins: basins.length,
    totalGauges: basins.reduce((s, b) => s + b.totalGauges, 0),
    criticalBasins: basins.filter(b => b.riskLevel === 'critical').length,
    highBasins: basins.filter(b => b.riskLevel === 'high').length,
    elevatedBasins: basins.filter(b => b.riskLevel === 'elevated').length,
    totalMajor: basins.reduce((s, b) => s + b.major, 0),
    totalModerate: basins.reduce((s, b) => s + b.moderate, 0),
    totalMinor: basins.reduce((s, b) => s + b.minor, 0),
    totalFlooding: basins.reduce((s, b) => s + b.currentlyFlooding, 0),
    maxRiskScore: basins.length > 0 ? basins[0].riskScore : 0,
  };

  return NextResponse.json({
    basins,
    national,
    updatedAt: new Date().toISOString(),
  });
}
