// app/api/cron/rebuild-data-cdc-gov/route.ts
// Daily Data.CDC.gov Extended data refresh for comprehensive public health surveillance
// Critical for public health intelligence and health disparity monitoring

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for comprehensive CDC public health data processing

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import {
  setDataCDCGovCache,
  setBuildInProgress,
  isBuildInProgress,
  buildDataCDCGovCacheData,
  getDataCDCGovCacheStatus,
  fetchDataCDCGovData,
  processDataCDCGovData,
} from '@/lib/dataCdcGovCache';

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isBuildInProgress()) {
    return NextResponse.json({
      message: 'Data.CDC.gov cache build already in progress',
      status: getDataCDCGovCacheStatus(),
    });
  }

  try {
    setBuildInProgress(true);
    console.log('Starting Data.CDC.gov extended public health surveillance cache rebuild...');

    // Fetch comprehensive public health surveillance data from CDC Socrata endpoints
    console.log('Fetching Data.CDC.gov comprehensive surveillance datasets...');
    const rawDatasets = await fetchDataCDCGovData();

    if (rawDatasets.length === 0) {
      console.warn('No Data.CDC.gov data retrieved');
      return NextResponse.json({
        error: 'No Data.CDC.gov data available',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    console.log(`Processing ${rawDatasets.length} public health surveillance datasets from Data.CDC.gov...`);

    // Process public health surveillance data
    const processedRecords = processDataCDCGovData(rawDatasets);
    console.log(`Processed ${processedRecords.length} public health surveillance records`);

    // Build comprehensive cache data with health disparities and emergency preparedness analysis
    const cacheData = await buildDataCDCGovCacheData(processedRecords);

    // Analyze for critical public health alerts
    const criticalAlerts = analyzeCriticalPublicHealthAlerts(cacheData);

    // Update cache
    await setDataCDCGovCache(cacheData);

    const status = getDataCDCGovCacheStatus();
    console.log('Data.CDC.gov cache rebuild completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Data.CDC.gov cache rebuilt successfully',
      stats: {
        total_datasets: cacheData.records.length,
        category_distribution: cacheData.summary.categoryDistribution,
        data_type_distribution: cacheData.summary.dataTypeDistribution,
        reporting_level_breakdown: cacheData.summary.reportingLevelBreakdown,
        water_related_indicators: cacheData.summary.waterRelatedIndicators,
        emergency_relevant_datasets: cacheData.summary.emergencyRelevantDatasets,
        health_disparity_indicators: cacheData.summary.healthDisparityIndicators,
        high_priority_alerts: cacheData.summary.highPriorityAlerts,
        critical_priority_alerts: cacheData.summary.criticalPriorityAlerts,
        states_covered: cacheData.summary.statesCovered,
        surveillance_period_range: cacheData.summary.surveillancePeriodRange,
        correlations: {
          water_health_correlations: cacheData.correlations.waterHealthCorrelations.length,
          emergency_preparedness_gaps: cacheData.correlations.emergencyPreparednessGaps.length,
          health_disparity_alerts: cacheData.correlations.healthDisparityAlerts.length,
          military_population_health: cacheData.correlations.militaryPopulationHealth.length,
        },
        critical_alerts: criticalAlerts,
      },
      cache_status: status,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Data.CDC.gov cache rebuild failed:', error);

    return NextResponse.json({
      error: 'Failed to rebuild Data.CDC.gov cache',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });

  } finally {
    setBuildInProgress(false);
  }
}

// ─── Critical Public Health Alert Analysis ──────────────────────────────────

/**
 * Analyze Data.CDC.gov data for critical public health alerts requiring immediate attention
 */
function analyzeCriticalPublicHealthAlerts(cacheData: any): {
  urgent_health_threats: any[];
  health_disparity_crises: any[];
  emergency_preparedness_gaps: any[];
  water_health_correlations: any[];
} {
  const urgentHealthThreats = identifyUrgentHealthThreats(cacheData.records);
  const healthDisparityCrises = identifyHealthDisparityCrises(cacheData.records);
  const emergencyPreparednessGaps = identifyEmergencyPreparednessGaps(cacheData.records);
  const waterHealthCorrelations = identifyWaterHealthCorrelations(cacheData.records);

  return {
    urgent_health_threats: urgentHealthThreats,
    health_disparity_crises: healthDisparityCrises,
    emergency_preparedness_gaps: emergencyPreparednessGaps,
    water_health_correlations: waterHealthCorrelations,
  };
}

function identifyUrgentHealthThreats(records: any[]): any[] {
  // Identify urgent public health threats requiring immediate response
  const urgentThreats = records.filter(record =>
    ['urgent', 'critical'].includes(record.cdcDataSpecific.publicHealthPriority) &&
    record.cdcDataSpecific.dataQuality !== 'suppressed'
  );

  return urgentThreats
    .map(record => ({
      dataset_title: record.cdcDataSpecific.datasetTitle,
      indicator_name: record.cdcDataSpecific.indicatorName,
      indicator_value: record.cdcDataSpecific.indicatorValue,
      indicator_unit: record.cdcDataSpecific.indicatorUnit,
      confidence_interval: record.cdcDataSpecific.confidenceInterval,
      category: record.cdcDataSpecific.category,
      data_type: record.cdcDataSpecific.dataType,
      reporting_level: record.cdcDataSpecific.reportingLevel,
      location: {
        state: record.location.state,
        county: record.location.county,
        city: record.location.city,
      },
      priority: record.cdcDataSpecific.publicHealthPriority,
      risk_factors: record.cdcDataSpecific.riskFactors,
      environmental_factors: record.cdcDataSpecific.environmentalFactors,
      surveillance_period: record.cdcDataSpecific.surveillancePeriod,
      data_source: record.cdcDataSpecific.dataSource,
      water_related: record.cdcDataSpecific.waterRelatedHealth,
      emergency_relevant: record.cdcDataSpecific.emergencyRelevance,
      health_disparity: record.cdcDataSpecific.healthDisparityFlag,
    }))
    .sort((a, b) => {
      // Prioritize by priority level and indicator value
      const priorityOrder = { critical: 4, urgent: 3, high: 2, elevated: 1 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;

      if (aPriority !== bPriority) return bPriority - aPriority;
      if (a.water_related && !b.water_related) return -1;
      if (!a.water_related && b.water_related) return 1;
      if (a.emergency_relevant && !b.emergency_relevant) return -1;
      if (!a.emergency_relevant && b.emergency_relevant) return 1;

      return (b.indicator_value || 0) - (a.indicator_value || 0);
    })
    .slice(0, 20);
}

function identifyHealthDisparityCrises(records: any[]): any[] {
  // Identify critical health disparities requiring intervention
  const disparityCrises = records.filter(record =>
    record.cdcDataSpecific.healthDisparityFlag &&
    ['high', 'urgent', 'critical'].includes(record.cdcDataSpecific.publicHealthPriority)
  );

  return disparityCrises
    .map(record => ({
      indicator_name: record.cdcDataSpecific.indicatorName,
      indicator_value: record.cdcDataSpecific.indicatorValue,
      indicator_unit: record.cdcDataSpecific.indicatorUnit,
      category: record.cdcDataSpecific.category,
      demographic_breakdown: record.cdcDataSpecific.demographicBreakdown,
      location: {
        state: record.location.state,
        county: record.location.county,
        city: record.location.city,
      },
      reporting_level: record.cdcDataSpecific.reportingLevel,
      priority: record.cdcDataSpecific.publicHealthPriority,
      data_quality: record.cdcDataSpecific.dataQuality,
      surveillance_period: record.cdcDataSpecific.surveillancePeriod,
      risk_factors: record.cdcDataSpecific.riskFactors,
      environmental_factors: record.cdcDataSpecific.environmentalFactors,
      water_related: record.cdcDataSpecific.waterRelatedHealth,
    }))
    .sort((a, b) => {
      // Prioritize by priority and indicator value
      const priorityOrder = { critical: 4, urgent: 3, high: 2, elevated: 1 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;

      if (aPriority !== bPriority) return bPriority - aPriority;
      return (b.indicator_value || 0) - (a.indicator_value || 0);
    })
    .slice(0, 15);
}

function identifyEmergencyPreparednessGaps(records: any[]): any[] {
  // Identify emergency preparedness gaps and vulnerabilities
  const preparednessGaps = records.filter(record =>
    record.cdcDataSpecific.emergencyRelevance &&
    ['elevated', 'high', 'urgent', 'critical'].includes(record.cdcDataSpecific.publicHealthPriority)
  );

  // Group gaps by state for analysis
  const stateGaps = new Map<string, any[]>();

  preparednessGaps.forEach(record => {
    const state = record.location.state || 'Unknown';
    if (!stateGaps.has(state)) {
      stateGaps.set(state, []);
    }
    stateGaps.get(state)!.push(record);
  });

  const gapAnalysis: any[] = [];

  stateGaps.forEach((gaps, state) => {
    if (gaps.length >= 2) { // Multiple gaps indicate systemic issues
      const highPriorityGaps = gaps.filter(g => ['high', 'urgent', 'critical'].includes(g.cdcDataSpecific.publicHealthPriority));

      if (highPriorityGaps.length > 0) {
        const categories = [...new Set(gaps.map(g => g.cdcDataSpecific.category))];
        const avgIndicatorValue = gaps.reduce((sum, g) => sum + (g.cdcDataSpecific.indicatorValue || 0), 0) / gaps.length;

        gapAnalysis.push({
          state,
          total_gaps: gaps.length,
          high_priority_gaps: highPriorityGaps.length,
          affected_categories: categories,
          average_indicator_value: Math.round(avgIndicatorValue * 100) / 100,
          indicators: gaps.map(g => ({
            name: g.cdcDataSpecific.indicatorName,
            value: g.cdcDataSpecific.indicatorValue,
            priority: g.cdcDataSpecific.publicHealthPriority,
            category: g.cdcDataSpecific.category,
          })),
          surveillance_period_range: {
            earliest: Math.min(...gaps.map(g => parseInt(g.cdcDataSpecific.surveillancePeriod.slice(0, 4)))),
            latest: Math.max(...gaps.map(g => parseInt(g.cdcDataSpecific.surveillancePeriod.slice(0, 4)))),
          },
        });
      }
    }
  });

  return gapAnalysis
    .sort((a, b) => b.high_priority_gaps - a.high_priority_gaps || b.total_gaps - a.total_gaps)
    .slice(0, 12);
}

function identifyWaterHealthCorrelations(records: any[]): any[] {
  // Identify water-related health indicators and correlations
  const waterRelatedIndicators = records.filter(record =>
    record.cdcDataSpecific.waterRelatedHealth ||
    record.cdcDataSpecific.environmentalFactors.includes('water_quality')
  );

  return waterRelatedIndicators
    .map(record => ({
      indicator_name: record.cdcDataSpecific.indicatorName,
      indicator_value: record.cdcDataSpecific.indicatorValue,
      indicator_unit: record.cdcDataSpecific.indicatorUnit,
      category: record.cdcDataSpecific.category,
      data_type: record.cdcDataSpecific.dataType,
      reporting_level: record.cdcDataSpecific.reportingLevel,
      location: {
        state: record.location.state,
        county: record.location.county,
        city: record.location.city,
      },
      priority: record.cdcDataSpecific.publicHealthPriority,
      environmental_factors: record.cdcDataSpecific.environmentalFactors,
      risk_factors: record.cdcDataSpecific.riskFactors,
      surveillance_period: record.cdcDataSpecific.surveillancePeriod,
      data_source: record.cdcDataSpecific.dataSource,
      health_disparity: record.cdcDataSpecific.healthDisparityFlag,
      demographic_breakdown: record.cdcDataSpecific.demographicBreakdown,
    }))
    .sort((a, b) => {
      // Prioritize by priority and health disparity
      const priorityOrder = { critical: 4, urgent: 3, high: 2, elevated: 1 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;

      if (aPriority !== bPriority) return bPriority - aPriority;
      if (a.health_disparity && !b.health_disparity) return -1;
      if (!a.health_disparity && b.health_disparity) return 1;
      return (b.indicator_value || 0) - (a.indicator_value || 0);
    })
    .slice(0, 18);
}