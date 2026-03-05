/* ------------------------------------------------------------------ */
/*  Flood Forecast API — Returns predicted flood exceedances           */
/*  from NWPS gauge stageflow forecasts vs flood stage thresholds.     */
/* ------------------------------------------------------------------ */

import { NextResponse } from 'next/server';
import { getNwpsAllGauges, ensureWarmed as warmNwps } from '@/lib/nwpsCache';
import { ensureWarmed as warmLookup, getByLid } from '@/lib/nwpsGaugeLookup';

export const dynamic = 'force-dynamic';

export interface FloodForecastGauge {
  lid: string;
  name: string;
  state: string;
  county: string;
  lat: number;
  lng: number;
  currentStage: number | null;
  currentStatus: string;
  forecastPeak: number | null;
  forecastPeakTime: string | null;
  actionStage: number | null;
  minorStage: number | null;
  moderateStage: number | null;
  majorStage: number | null;
  unit: string;
  predictedCategory: 'none' | 'action' | 'minor' | 'moderate' | 'major';
  hoursUntilExceedance: number | null;
  percentAboveFlood: number | null;
  stageflow: Array<{ time: string; stage: number | null; flow: number | null }>;
}

export async function GET() {
  await Promise.all([warmNwps(), warmLookup()]);

  const allGauges = getNwpsAllGauges();
  const forecasts: FloodForecastGauge[] = [];
  const now = Date.now();

  for (const gauge of allGauges) {
    if (!gauge.lid || !gauge.stageflow || gauge.stageflow.length === 0) continue;

    const thresholds = getByLid(gauge.lid);
    const currentStage = gauge.observed?.primary ?? null;

    // Find the peak forecast stage
    let peakStage = -Infinity;
    let peakTime: string | null = null;

    for (const entry of gauge.stageflow) {
      if (entry.stage != null && entry.stage > peakStage) {
        peakStage = entry.stage;
        peakTime = entry.time;
      }
    }

    if (peakStage === -Infinity) continue;

    // Determine predicted flood category
    const actionStage = thresholds?.actionStage ?? null;
    const minorStage = thresholds?.minorStage ?? null;
    const moderateStage = thresholds?.moderateStage ?? null;
    const majorStage = thresholds?.majorStage ?? null;

    let predictedCategory: FloodForecastGauge['predictedCategory'] = 'none';
    let thresholdUsed: number | null = null;

    if (majorStage != null && peakStage >= majorStage) {
      predictedCategory = 'major';
      thresholdUsed = majorStage;
    } else if (moderateStage != null && peakStage >= moderateStage) {
      predictedCategory = 'moderate';
      thresholdUsed = moderateStage;
    } else if (minorStage != null && peakStage >= minorStage) {
      predictedCategory = 'minor';
      thresholdUsed = minorStage;
    } else if (actionStage != null && peakStage >= actionStage) {
      predictedCategory = 'action';
      thresholdUsed = actionStage;
    }

    // Only include gauges that are currently flooding, predicted to flood,
    // or have significant rising trend
    const isFlooding = gauge.status !== 'no_flooding' && gauge.status !== 'not_defined';
    const willFlood = predictedCategory !== 'none';
    const risingFast = currentStage != null && currentStage > 0 && peakStage > currentStage * 1.25;

    if (!isFlooding && !willFlood && !risingFast) continue;

    // Find hours until first exceedance of the predicted category threshold
    let hoursUntilExceedance: number | null = null;
    if (willFlood && thresholdUsed != null) {
      for (const entry of gauge.stageflow) {
        if (entry.stage != null && entry.stage >= thresholdUsed) {
          const entryMs = new Date(entry.time).getTime();
          if (!isNaN(entryMs)) {
            hoursUntilExceedance = Math.max(0, (entryMs - now) / (1000 * 60 * 60));
            break;
          }
        }
      }
    }

    const percentAboveFlood = thresholdUsed != null && thresholdUsed > 0
      ? Math.round(((peakStage - thresholdUsed) / thresholdUsed) * 100)
      : null;

    forecasts.push({
      lid: gauge.lid,
      name: gauge.name,
      state: gauge.state,
      county: gauge.county,
      lat: gauge.lat,
      lng: gauge.lng,
      currentStage,
      currentStatus: gauge.status,
      forecastPeak: Math.round(peakStage * 100) / 100,
      forecastPeakTime: peakTime,
      actionStage,
      minorStage,
      moderateStage,
      majorStage,
      unit: thresholds?.unit || 'ft',
      predictedCategory,
      hoursUntilExceedance: hoursUntilExceedance != null ? Math.round(hoursUntilExceedance * 10) / 10 : null,
      percentAboveFlood,
      stageflow: gauge.stageflow || [],
    });
  }

  // Sort: major first, then moderate, minor, action; then by hours until exceedance
  const categoryOrder = { major: 0, moderate: 1, minor: 2, action: 3, none: 4 };
  forecasts.sort((a, b) => {
    const catDiff = categoryOrder[a.predictedCategory] - categoryOrder[b.predictedCategory];
    if (catDiff !== 0) return catDiff;
    return (a.hoursUntilExceedance ?? 999) - (b.hoursUntilExceedance ?? 999);
  });

  const summary = {
    total: forecasts.length,
    major: forecasts.filter(f => f.predictedCategory === 'major').length,
    moderate: forecasts.filter(f => f.predictedCategory === 'moderate').length,
    minor: forecasts.filter(f => f.predictedCategory === 'minor').length,
    action: forecasts.filter(f => f.predictedCategory === 'action').length,
    currentlyFlooding: forecasts.filter(f => f.currentStatus !== 'no_flooding' && f.currentStatus !== 'not_defined').length,
  };

  return NextResponse.json({
    forecasts: forecasts.slice(0, 100), // cap response size
    summary,
    updatedAt: new Date().toISOString(),
  });
}
