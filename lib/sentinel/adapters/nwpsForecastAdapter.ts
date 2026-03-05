/* ------------------------------------------------------------------ */
/*  PIN Sentinel — NWPS Flood Forecast Adapter                        */
/*                                                                    */
/*  Reads stageflow forecast data from nwpsCache, compares against    */
/*  flood stage thresholds from nwpsGaugeLookup, and emits            */
/*  THRESHOLD_CROSSED events when a gauge is predicted to exceed      */
/*  flood stage within the forecast horizon.                          */
/*                                                                    */
/*  This is the predictive counterpart to nwpsFloodAdapter.ts which   */
/*  only detects current/active flood warnings reactively.            */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';
import { getNwpsAllGauges, type NwpsGauge } from '../../nwpsCache';
import { getByLid, type GaugeFloodInfo } from '../../nwpsGaugeLookup';

const SOURCE = 'NWPS_FORECAST' as const;

/* ------------------------------------------------------------------ */
/*  Flood Category Classification                                     */
/* ------------------------------------------------------------------ */

type FloodCategory = 'action' | 'minor' | 'moderate' | 'major';

interface ForecastExceedance {
  category: FloodCategory;
  forecastStage: number;
  threshold: number;
  forecastTime: string;
  hoursUntil: number;
}

/** Map flood category to severity */
function categoryToSeverity(category: FloodCategory): SeverityHint {
  switch (category) {
    case 'major':    return 'CRITICAL';
    case 'moderate': return 'HIGH';
    case 'minor':    return 'MODERATE';
    case 'action':   return 'LOW';
  }
}

/** Find the highest flood category exceeded in the forecast */
function analyzeStageflow(
  gauge: NwpsGauge,
  thresholds: GaugeFloodInfo,
): ForecastExceedance | null {
  if (!gauge.stageflow || gauge.stageflow.length === 0) return null;

  const now = Date.now();
  let worstExceedance: ForecastExceedance | null = null;

  for (const entry of gauge.stageflow) {
    const stage = entry.stage;
    if (stage == null) continue;

    const forecastTime = entry.time;
    const forecastMs = new Date(forecastTime).getTime();
    if (isNaN(forecastMs)) continue;

    const hoursUntil = Math.max(0, (forecastMs - now) / (1000 * 60 * 60));

    // Check each threshold from highest to lowest
    const checks: { category: FloodCategory; threshold: number | null }[] = [
      { category: 'major', threshold: thresholds.majorStage },
      { category: 'moderate', threshold: thresholds.moderateStage },
      { category: 'minor', threshold: thresholds.minorStage },
      { category: 'action', threshold: thresholds.actionStage },
    ];

    for (const check of checks) {
      if (check.threshold == null) continue;
      if (stage >= check.threshold) {
        const exceedance: ForecastExceedance = {
          category: check.category,
          forecastStage: stage,
          threshold: check.threshold,
          forecastTime,
          hoursUntil,
        };

        // Keep the worst (highest category) exceedance
        if (!worstExceedance || categoryRank(check.category) > categoryRank(worstExceedance.category)) {
          worstExceedance = exceedance;
        } else if (
          categoryRank(check.category) === categoryRank(worstExceedance.category) &&
          hoursUntil < worstExceedance.hoursUntil
        ) {
          // Same category but sooner → more urgent
          worstExceedance = exceedance;
        }
        break; // found highest category for this time step
      }
    }
  }

  return worstExceedance;
}

function categoryRank(category: FloodCategory): number {
  switch (category) {
    case 'major': return 4;
    case 'moderate': return 3;
    case 'minor': return 2;
    case 'action': return 1;
  }
}

/* ------------------------------------------------------------------ */
/*  Trend Detection — Rising Water                                    */
/* ------------------------------------------------------------------ */

interface RisingTrend {
  currentStage: number;
  forecastPeakStage: number;
  percentIncrease: number;
  peakTime: string;
  hoursUntilPeak: number;
}

/** Detect significant rising trend even when below flood stage */
function detectRisingTrend(gauge: NwpsGauge): RisingTrend | null {
  if (!gauge.stageflow || gauge.stageflow.length < 3) return null;
  if (!gauge.observed?.primary) return null;

  const currentStage = gauge.observed.primary;
  if (currentStage <= 0) return null;

  const now = Date.now();
  let peakStage = currentStage;
  let peakTime = '';
  let peakMs = now;

  for (const entry of gauge.stageflow) {
    if (entry.stage != null && entry.stage > peakStage) {
      peakStage = entry.stage;
      peakTime = entry.time;
      peakMs = new Date(entry.time).getTime();
    }
  }

  const percentIncrease = ((peakStage - currentStage) / currentStage) * 100;
  const hoursUntilPeak = Math.max(0, (peakMs - now) / (1000 * 60 * 60));

  // Only report significant rises (>25% increase)
  if (percentIncrease < 25) return null;

  return {
    currentStage,
    forecastPeakStage: peakStage,
    percentIncrease,
    peakTime,
    hoursUntilPeak,
  };
}

/* ------------------------------------------------------------------ */
/*  Poll                                                              */
/* ------------------------------------------------------------------ */

export function pollNwpsForecast(prevState: SentinelSourceState): AdapterResult {
  const allGauges = getNwpsAllGauges();
  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();
  const currentIds: string[] = [];

  const previousIds = new Set(prevState.knownIds);

  for (const gauge of allGauges) {
    if (!gauge.lid) continue;

    const thresholds = getByLid(gauge.lid);

    // Check 1: Forecast exceeds flood stage thresholds
    if (thresholds) {
      const exceedance = analyzeStageflow(gauge, thresholds);
      if (exceedance) {
        // Dedup key: lid + category (don't re-alert for same gauge at same flood level)
        const dedupId = `forecast-${gauge.lid}-${exceedance.category}`;
        currentIds.push(dedupId);

        if (!previousIds.has(dedupId)) {
          const leadTimeLabel = exceedance.hoursUntil < 1
            ? 'now'
            : exceedance.hoursUntil < 24
              ? `in ${Math.round(exceedance.hoursUntil)}h`
              : `in ${Math.round(exceedance.hoursUntil / 24)}d`;

          events.push({
            eventId: `nwps-fc-${gauge.lid}-${exceedance.category}-${Date.now().toString(36)}`,
            source: SOURCE,
            detectedAt: now,
            sourceTimestamp: exceedance.forecastTime,
            changeType: 'THRESHOLD_CROSSED',
            geography: {
              stateAbbr: gauge.state || thresholds.state || undefined,
              lat: gauge.lat,
              lng: gauge.lng,
            },
            severityHint: categoryToSeverity(exceedance.category),
            payload: {
              gaugeName: gauge.name || thresholds.name,
              lid: gauge.lid,
              usgsId: thresholds.usgsId,
              floodCategory: exceedance.category,
              forecastStage: exceedance.forecastStage,
              threshold: exceedance.threshold,
              unit: thresholds.unit || 'ft',
              hoursUntil: Math.round(exceedance.hoursUntil * 10) / 10,
              leadTime: leadTimeLabel,
              forecastTime: exceedance.forecastTime,
              currentStage: gauge.observed?.primary ?? null,
              currentStatus: gauge.status,
            },
            metadata: {
              sourceRecordId: gauge.lid,
              currentValue: exceedance.forecastStage,
              threshold: exceedance.threshold,
            },
          });
        }
      }
    }

    // Check 2: Significant rising trend (even without flood threshold data)
    const trend = detectRisingTrend(gauge);
    if (trend && trend.percentIncrease >= 50) {
      const trendId = `trend-${gauge.lid}`;
      currentIds.push(trendId);

      if (!previousIds.has(trendId)) {
        events.push({
          eventId: `nwps-trend-${gauge.lid}-${Date.now().toString(36)}`,
          source: SOURCE,
          detectedAt: now,
          sourceTimestamp: trend.peakTime,
          changeType: 'VALUE_CHANGE',
          geography: {
            stateAbbr: gauge.state || undefined,
            lat: gauge.lat,
            lng: gauge.lng,
          },
          severityHint: trend.percentIncrease >= 100 ? 'HIGH' : 'MODERATE',
          payload: {
            gaugeName: gauge.name,
            lid: gauge.lid,
            currentStage: trend.currentStage,
            forecastPeakStage: trend.forecastPeakStage,
            percentIncrease: Math.round(trend.percentIncrease),
            hoursUntilPeak: Math.round(trend.hoursUntilPeak * 10) / 10,
            peakTime: trend.peakTime,
          },
          metadata: {
            sourceRecordId: gauge.lid,
            previousValue: trend.currentStage,
            currentValue: trend.forecastPeakStage,
          },
        });
      }
    }
  }

  return {
    events,
    updatedState: {
      knownIds: currentIds,
    },
  };
}
