// app/api/cron/rebuild-environmental-tracking/route.ts
// Daily Environmental Health Tracking Network data refresh
// Correlates environmental exposures (air/water quality) with health outcomes and water violations

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for tracking data processing and correlation

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import {
  setEnvironmentalTrackingCache,
  setBuildInProgress,
  isBuildInProgress,
  processEnvironmentalTrackingData,
  buildEnvironmentalTrackingCacheData,
  getEnvironmentalTrackingCacheStatus,
  fetchEnvironmentalTrackingData,
} from '@/lib/environmentalTrackingCache';
import { getSDWISCache } from '@/lib/sdwisCache';

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isBuildInProgress()) {
    return NextResponse.json({
      message: 'Environmental Tracking cache build already in progress',
      status: getEnvironmentalTrackingCacheStatus(),
    });
  }

  try {
    setBuildInProgress(true);
    console.log('Starting Environmental Health Tracking cache rebuild...');

    // Fetch environmental tracking data from CDC
    console.log('Fetching Environmental Health Tracking Network data...');
    const rawTrackingData = await fetchEnvironmentalTrackingData();

    if (rawTrackingData.length === 0) {
      console.warn('No Environmental Tracking data retrieved');
      return NextResponse.json({
        error: 'No Environmental Tracking data available',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    console.log(`Processing ${rawTrackingData.length} Environmental Tracking records...`);

    // Process and normalize the tracking data
    const processedRecords = processEnvironmentalTrackingData(rawTrackingData);
    console.log(`Successfully processed ${processedRecords.length} tracking records`);

    // Get water violations for correlation analysis
    console.log('Loading water violation data for correlation...');
    const sdwisCache = getSDWISCache();
    const waterViolations = Object.values(sdwisCache)
      .flatMap(stateData => stateData.violations || [])
      .filter(violation => violation.lat && violation.lng)
      .map(violation => ({
        id: violation.violationId || violation.id,
        lat: violation.lat,
        lng: violation.lng,
        violationDate: violation.compliancePeriodBeginDate || violation.violationBeginDate,
        systemId: violation.pwsId || violation.systemId,
        violationType: violation.violationType,
      }));

    console.log(`Loaded ${waterViolations.length} water violations for correlation analysis`);

    // Build comprehensive cache data with correlations
    const trackingCacheData = await buildEnvironmentalTrackingCacheData(processedRecords, waterViolations);

    // Update cache
    await setEnvironmentalTrackingCache(trackingCacheData);

    const status = getEnvironmentalTrackingCacheStatus();
    console.log('Environmental Health Tracking cache rebuild completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Environmental Health Tracking cache rebuilt successfully',
      stats: {
        total_tracking_records: trackingCacheData.records.length,
        states_covered: trackingCacheData.summary.statesCovered.length,
        years_covered: trackingCacheData.summary.yearsCovered.length,
        indicator_breakdown: trackingCacheData.summary.indicatorTypes,
        significant_findings: trackingCacheData.correlations.significantFindings,
        water_quality_indicators: trackingCacheData.correlations.waterQualityIndicators,
        health_outcomes: trackingCacheData.correlations.healthOutcomes,
        near_military_facilities: trackingCacheData.correlations.nearMilitaryFacilities,
        high_risk_areas: trackingCacheData.correlations.highRiskAreas.length,
        correlations: {
          violations_checked: waterViolations.length,
          environmental_water_correlation: trackingCacheData.records.filter(r =>
            r.trackingSpecific.indicatorType === 'drinking_water' &&
            r.correlationFlags?.hasWaterViolation
          ).length,
        },
      },
      cache_status: status,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Environmental Health Tracking cache rebuild failed:', error);

    return NextResponse.json({
      error: 'Failed to rebuild Environmental Health Tracking cache',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });

  } finally {
    setBuildInProgress(false);
  }
}

// ─── Enhanced Analysis Functions ──────────────────────────────────────────────

/**
 * Analyze temporal patterns in environmental health data
 */
async function analyzeEnvironmentalTrends(trackingRecords: any[]): Promise<{
  trendingIndicators: any[];
  seasonalPatterns: any[];
  environmentalAlerts: any[];
}> {

  const trendingIndicators = identifyTrendingIndicators(trackingRecords);
  const seasonalPatterns = analyzeSeasonalPatterns(trackingRecords);
  const environmentalAlerts = generateEnvironmentalAlerts(trackingRecords);

  return {
    trendingIndicators,
    seasonalPatterns,
    environmentalAlerts,
  };
}

function identifyTrendingIndicators(records: any[]): any[] {
  // Group by indicator and analyze year-over-year changes
  const indicatorTrends = new Map<string, any[]>();

  records.forEach(record => {
    const indicator = record.trackingSpecific.indicatorName;
    if (!indicatorTrends.has(indicator)) {
      indicatorTrends.set(indicator, []);
    }
    indicatorTrends.get(indicator)!.push(record);
  });

  const trends: any[] = [];

  indicatorTrends.forEach((indicatorRecords, indicatorName) => {
    // Sort by year and calculate trend
    const sortedByYear = indicatorRecords.sort((a, b) =>
      (a.temporal.year || 0) - (b.temporal.year || 0)
    );

    if (sortedByYear.length < 2) return;

    // Calculate average change per year
    let totalChange = 0;
    let changeCount = 0;

    for (let i = 1; i < sortedByYear.length; i++) {
      const prev = sortedByYear[i - 1];
      const curr = sortedByYear[i];

      if (prev.trackingSpecific.dataValue > 0) {
        const pctChange = ((curr.trackingSpecific.dataValue - prev.trackingSpecific.dataValue) /
                          prev.trackingSpecific.dataValue) * 100;
        totalChange += pctChange;
        changeCount++;
      }
    }

    if (changeCount > 0) {
      const avgTrend = totalChange / changeCount;

      if (Math.abs(avgTrend) > 5) { // Significant trend threshold
        trends.push({
          indicator: indicatorName,
          indicatorType: sortedByYear[0].trackingSpecific.indicatorType,
          averageTrendPercent: Math.round(avgTrend * 100) / 100,
          direction: avgTrend > 0 ? 'increasing' : 'decreasing',
          significance: Math.abs(avgTrend) > 15 ? 'high' : 'moderate',
          recordCount: sortedByYear.length,
          latestValue: sortedByYear[sortedByYear.length - 1].trackingSpecific.dataValue,
          latestYear: sortedByYear[sortedByYear.length - 1].temporal.year,
        });
      }
    }
  });

  return trends.sort((a, b) => Math.abs(b.averageTrendPercent) - Math.abs(a.averageTrendPercent)).slice(0, 15);
}

function analyzeSeasonalPatterns(records: any[]): any[] {
  // For monthly/quarterly data, identify seasonal patterns
  const monthlyData = records.filter(r => r.trackingSpecific.temporalType === 'monthly');
  const patterns: any[] = [];

  if (monthlyData.length === 0) return patterns;

  // Group by indicator and month
  const indicatorMonthData = new Map<string, Map<number, number[]>>();

  monthlyData.forEach(record => {
    const indicator = record.trackingSpecific.indicatorName;
    const month = new Date(record.temporal.reportDate).getMonth() + 1;

    if (!indicatorMonthData.has(indicator)) {
      indicatorMonthData.set(indicator, new Map());
    }

    const monthData = indicatorMonthData.get(indicator)!;
    if (!monthData.has(month)) {
      monthData.set(month, []);
    }

    monthData.get(month)!.push(record.trackingSpecific.dataValue);
  });

  // Analyze seasonal variations
  indicatorMonthData.forEach((monthData, indicator) => {
    const monthlyAverages: Array<{ month: number; average: number; count: number }> = [];

    monthData.forEach((values, month) => {
      const average = values.reduce((sum, val) => sum + val, 0) / values.length;
      monthlyAverages.push({ month, average, count: values.length });
    });

    if (monthlyAverages.length >= 6) { // Need at least 6 months of data
      // Calculate coefficient of variation
      const values = monthlyAverages.map(m => m.average);
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const cv = Math.sqrt(variance) / mean;

      if (cv > 0.15) { // Significant seasonal variation
        const peak = monthlyAverages.reduce((max, current) =>
          current.average > max.average ? current : max
        );
        const trough = monthlyAverages.reduce((min, current) =>
          current.average < min.average ? current : min
        );

        patterns.push({
          indicator,
          seasonalVariation: Math.round(cv * 100) / 100,
          peakMonth: peak.month,
          peakValue: Math.round(peak.average * 100) / 100,
          troughMonth: trough.month,
          troughValue: Math.round(trough.average * 100) / 100,
          seasonalAmplitude: Math.round((peak.average - trough.average) * 100) / 100,
        });
      }
    }
  });

  return patterns.sort((a, b) => b.seasonalVariation - a.seasonalVariation).slice(0, 10);
}

function generateEnvironmentalAlerts(records: any[]): any[] {
  const alerts: any[] = [];

  // Define alert thresholds for different indicator types
  const alertThresholds = {
    drinking_water: { high: 10, critical: 20 },
    air_quality: { high: 35, critical: 55 }, // AQI thresholds
    respiratory: { high: 15, critical: 25 }, // Prevalence %
    cancer: { high: 500, critical: 750 }, // per 100k
    cardiovascular: { high: 200, critical: 350 }, // per 100k
    environmental_health: { high: 5, critical: 10 },
  };

  records.forEach(record => {
    const indicatorType = record.trackingSpecific.indicatorType;
    const dataValue = record.trackingSpecific.dataValue;
    const thresholds = alertThresholds[indicatorType];

    if (!thresholds) return;

    let alertLevel: 'moderate' | 'high' | 'critical' | null = null;

    if (dataValue >= thresholds.critical) {
      alertLevel = 'critical';
    } else if (dataValue >= thresholds.high) {
      alertLevel = 'high';
    } else if (dataValue >= thresholds.high * 0.75) {
      alertLevel = 'moderate';
    }

    if (alertLevel) {
      alerts.push({
        location: `${record.location.county || 'Unknown'}, ${record.location.state || 'Unknown'}`,
        indicator: record.trackingSpecific.indicatorName,
        indicatorType,
        alertLevel,
        dataValue,
        threshold: alertLevel === 'critical' ? thresholds.critical : thresholds.high,
        year: record.temporal.year,
        isSignificant: record.trackingSpecific.isSignificant,
        nearMilitary: record.proximityToMilitary?.isNearBase || false,
        hasWaterViolation: record.correlationFlags?.hasWaterViolation || false,
      });
    }
  });

  return alerts
    .sort((a, b) => {
      // Sort by alert level, then by value
      const levelOrder = { critical: 3, high: 2, moderate: 1 };
      const levelDiff = (levelOrder[b.alertLevel as keyof typeof levelOrder] || 0) -
                       (levelOrder[a.alertLevel as keyof typeof levelOrder] || 0);
      if (levelDiff !== 0) return levelDiff;
      return b.dataValue - a.dataValue;
    })
    .slice(0, 25);
}