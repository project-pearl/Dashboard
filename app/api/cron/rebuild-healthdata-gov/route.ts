// app/api/cron/rebuild-healthdata-gov/route.ts
// Daily HealthData.gov Socrata API data refresh
// Hospital capacity, outbreak surveillance, and comprehensive HHS datasets via unified API

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for multiple Socrata dataset processing

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import {
  setHealthDataGovCache,
  setBuildInProgress,
  isBuildInProgress,
  buildHealthDataGovCacheData,
  getHealthDataGovCacheStatus,
  fetchHealthDataGovData,
  HEALTHDATA_GOV_DATASETS,
} from '@/lib/healthDataGovCache';
import { getSdwisAllData } from '@/lib/sdwisCache';

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isBuildInProgress()) {
    return NextResponse.json({
      message: 'HealthData.gov cache build already in progress',
      status: getHealthDataGovCacheStatus(),
    });
  }

  try {
    setBuildInProgress(true);
    console.log('Starting HealthData.gov Socrata API cache rebuild...');

    // Fetch data from multiple priority datasets
    console.log('Fetching HealthData.gov priority datasets...');
    const datasetResults = await fetchHealthDataGovData();

    if (datasetResults.length === 0) {
      console.warn('No HealthData.gov datasets retrieved');
      return NextResponse.json({
        error: 'No HealthData.gov data available',
        attempted_datasets: Object.keys(HEALTHDATA_GOV_DATASETS),
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    const totalRecords = datasetResults.reduce((sum, dataset) => sum + dataset.records.length, 0);
    console.log(`Processing ${totalRecords} records from ${datasetResults.length} HealthData.gov datasets...`);

    // Get water violations for correlation analysis
    console.log('Loading water violation data for correlation...');
    const sdwisData = getSdwisAllData();
    const waterViolations = sdwisData.violations
      .filter(violation => violation.lat && violation.lng)
      .map(violation => ({
        id: violation.pwsid,
        lat: violation.lat,
        lng: violation.lng,
        violationDate: violation.compliancePeriod,
        systemId: violation.pwsid,
        violationType: violation.rule,
      }));

    console.log(`Loaded ${waterViolations.length} water violations for correlation analysis`);

    // Build comprehensive cache data with correlations and analysis
    const healthDataCacheData = await buildHealthDataGovCacheData(datasetResults, waterViolations);

    // Update cache
    await setHealthDataGovCache(healthDataCacheData);

    const status = getHealthDataGovCacheStatus();
    console.log('HealthData.gov Socrata cache rebuild completed successfully');

    return NextResponse.json({
      success: true,
      message: 'HealthData.gov Socrata cache rebuilt successfully',
      stats: {
        total_records: healthDataCacheData.records.length,
        datasets_processed: datasetResults.length,
        datasets_summary: datasetResults.map(ds => ({
          name: ds.datasetName,
          category: ds.category,
          record_count: ds.records.length,
        })),
        states_covered: healthDataCacheData.summary.statesCovered.length,
        category_breakdown: healthDataCacheData.summary.categoryCounts,
        quality_metrics: healthDataCacheData.summary.qualityMetrics,
        correlations: {
          hospital_capacity: healthDataCacheData.correlations.hospitalCapacityRecords,
          outbreak_surveillance: healthDataCacheData.correlations.outbreakSurveillanceRecords,
          emergency_preparedness: healthDataCacheData.correlations.emergencyPreparednessRecords,
          near_military: healthDataCacheData.correlations.nearMilitaryFacilities,
          with_water_violations: healthDataCacheData.correlations.correlatedWithViolations,
          high_risk_alerts: healthDataCacheData.correlations.highRiskAlerts.length,
        },
        violations_checked: waterViolations.length,
        date_range: healthDataCacheData.summary.dateRange,
      },
      cache_status: status,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('HealthData.gov cache rebuild failed:', error);

    return NextResponse.json({
      error: 'Failed to rebuild HealthData.gov cache',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });

  } finally {
    setBuildInProgress(false);
  }
}

// ─── Advanced Analysis Functions ──────────────────────────────────────────────

/**
 * Analyze hospital capacity trends and emergency preparedness
 */
async function analyzeHospitalCapacityTrends(hospitalRecords: any[]): Promise<{
  capacityTrends: any[];
  emergencyReadiness: any[];
  regionalAnalysis: any[];
}> {

  const capacityTrends = calculateCapacityTrends(hospitalRecords);
  const emergencyReadiness = assessEmergencyReadiness(hospitalRecords);
  const regionalAnalysis = analyzeRegionalPatterns(hospitalRecords);

  return {
    capacityTrends,
    emergencyReadiness,
    regionalAnalysis,
  };
}

function calculateCapacityTrends(records: any[]): any[] {
  // Group hospital records by facility and analyze trends
  const facilityData = new Map<string, any[]>();

  records.forEach(record => {
    const facilityKey = record.socrataSpecific.metadata.facilityName ||
                      `${record.location.city || 'Unknown'}_${record.location.state || 'Unknown'}`;

    if (!facilityData.has(facilityKey)) {
      facilityData.set(facilityKey, []);
    }
    facilityData.get(facilityKey)!.push(record);
  });

  const trends: any[] = [];

  facilityData.forEach((facilityRecords, facilityName) => {
    // Sort by date to analyze trends
    const sortedRecords = facilityRecords.sort((a, b) =>
      new Date(a.temporal.reportDate).getTime() - new Date(b.temporal.reportDate).getTime()
    );

    if (sortedRecords.length < 2) return;

    // Analyze bed utilization trends
    const bedUtilizationTrend = analyzeTrend(
      sortedRecords.map(r => r.healthMetrics.find((m: any) => m.measure === 'inpatient_bed_count')?.value || 0)
    );

    // Analyze ICU capacity trends
    const icuTrend = analyzeTrend(
      sortedRecords.map(r => r.healthMetrics.find((m: any) => m.measure === 'icu_bed_utilization')?.value || 0)
    );

    if (Math.abs(bedUtilizationTrend) > 5 || Math.abs(icuTrend) > 5) {
      trends.push({
        facility: facilityName,
        location: `${sortedRecords[0].location.city || 'Unknown'}, ${sortedRecords[0].location.state || 'Unknown'}`,
        bedUtilizationTrend,
        icuTrend,
        dataPoints: sortedRecords.length,
        nearMilitary: sortedRecords[0].proximityToMilitary?.isNearBase || false,
        latestDate: sortedRecords[sortedRecords.length - 1].temporal.reportDate,
      });
    }
  });

  return trends.sort((a, b) => Math.abs(b.bedUtilizationTrend) - Math.abs(a.bedUtilizationTrend)).slice(0, 20);
}

function assessEmergencyReadiness(records: any[]): any[] {
  // Assess emergency preparedness based on capacity metrics
  const readinessAssessments: any[] = [];

  // Group by location for regional assessment
  const locationData = new Map<string, any[]>();

  records.forEach(record => {
    const location = `${record.location.county || 'Unknown'}, ${record.location.state || 'Unknown'}`;

    if (!locationData.has(location)) {
      locationData.set(location, []);
    }
    locationData.get(location)!.push(record);
  });

  locationData.forEach((locationRecords, location) => {
    // Calculate aggregate metrics
    const totalBeds = locationRecords.reduce((sum, r) =>
      sum + (r.healthMetrics.find((m: any) => m.measure === 'inpatient_bed_count')?.value || 0), 0
    );

    const totalICUBeds = locationRecords.reduce((sum, r) =>
      sum + (r.healthMetrics.find((m: any) => m.measure === 'total_icu_beds')?.value || 0), 0
    );

    const currentUtilization = locationRecords.reduce((sum, r) =>
      sum + (r.healthMetrics.find((m: any) => m.measure === 'icu_bed_utilization')?.value || 0), 0
    );

    if (totalBeds > 0) {
      const utilizationRate = totalICUBeds > 0 ? (currentUtilization / totalICUBeds) * 100 : 0;
      const capacityPerCapita = totalBeds / 100000; // Beds per 100k (assuming population)

      let readinessLevel: 'high' | 'moderate' | 'low';
      if (utilizationRate < 70 && capacityPerCapita > 250) {
        readinessLevel = 'high';
      } else if (utilizationRate < 85 && capacityPerCapita > 150) {
        readinessLevel = 'moderate';
      } else {
        readinessLevel = 'low';
      }

      readinessAssessments.push({
        location,
        totalBeds,
        totalICUBeds,
        utilizationRate: Math.round(utilizationRate),
        capacityPerCapita: Math.round(capacityPerCapita),
        readinessLevel,
        facilityCount: locationRecords.length,
        nearMilitary: locationRecords.some(r => r.proximityToMilitary?.isNearBase),
        hasWaterViolations: locationRecords.some(r => r.correlationFlags?.hasWaterViolation),
      });
    }
  });

  return readinessAssessments
    .filter(assessment => assessment.readinessLevel === 'low' || assessment.nearMilitary)
    .sort((a, b) => {
      // Prioritize low readiness near military
      if (a.nearMilitary && !b.nearMilitary) return -1;
      if (!a.nearMilitary && b.nearMilitary) return 1;
      return a.utilizationRate - b.utilizationRate; // Lower utilization = better
    })
    .slice(0, 15);
}

function analyzeRegionalPatterns(records: any[]): any[] {
  // Analyze regional patterns in health data
  const stateData = new Map<string, {
    records: any[];
    hospitalCount: number;
    totalCapacity: number;
    emergencyVisits: number;
    outbreaks: number;
  }>();

  records.forEach(record => {
    const state = record.location.state || 'Unknown';

    if (!stateData.has(state)) {
      stateData.set(state, {
        records: [],
        hospitalCount: 0,
        totalCapacity: 0,
        emergencyVisits: 0,
        outbreaks: 0,
      });
    }

    const data = stateData.get(state)!;
    data.records.push(record);

    // Aggregate metrics by category
    if (record.socrataSpecific.category === 'hospital_capacity') {
      data.hospitalCount++;
      data.totalCapacity += record.healthMetrics.find((m: any) => m.measure === 'inpatient_bed_count')?.value || 0;
    }

    if (record.socrataSpecific.category === 'emergency_preparedness') {
      data.emergencyVisits += record.healthMetrics.find((m: any) => m.measure === 'ed_visits')?.value || 0;
    }

    if (record.socrataSpecific.category === 'outbreak_surveillance') {
      data.outbreaks++;
    }
  });

  const regionalPatterns: any[] = [];

  stateData.forEach((data, state) => {
    if (data.records.length > 5) { // Minimum data threshold
      const avgCapacity = data.hospitalCount > 0 ? data.totalCapacity / data.hospitalCount : 0;
      const militaryProximity = data.records.filter(r => r.proximityToMilitary?.isNearBase).length;
      const waterViolationCorrelation = data.records.filter(r => r.correlationFlags?.hasWaterViolation).length;

      regionalPatterns.push({
        state,
        recordCount: data.records.length,
        hospitalCount: data.hospitalCount,
        averageCapacity: Math.round(avgCapacity),
        totalEmergencyVisits: data.emergencyVisits,
        outbreakCount: data.outbreaks,
        militaryProximityRecords: militaryProximity,
        waterViolationCorrelations: waterViolationCorrelation,
        riskScore: calculateRegionalRiskScore(data),
      });
    }
  });

  return regionalPatterns
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 12);
}

function analyzeTrend(values: number[]): number {
  if (values.length < 2) return 0;

  // Simple linear trend calculation
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((sum, val) => sum + val, 0);
  const sumXY = values.reduce((sum, val, idx) => sum + (idx * val), 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

  const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;
  const avgY = sumY / n;

  // Return percentage change
  return avgY > 0 ? (slope * (n - 1) / avgY) * 100 : 0;
}

function calculateRegionalRiskScore(data: {
  records: any[];
  hospitalCount: number;
  totalCapacity: number;
  emergencyVisits: number;
  outbreaks: number;
}): number {
  let score = 0;

  // Outbreak density factor
  const outbreakDensity = data.records.length > 0 ? (data.outbreaks / data.records.length) * 100 : 0;
  score += Math.min(outbreakDensity * 2, 30);

  // Hospital capacity strain factor
  const capacityStrain = data.hospitalCount > 0 ? (data.emergencyVisits / data.totalCapacity) : 0;
  score += Math.min(capacityStrain * 0.5, 25);

  // Military proximity factor
  const militaryProximityRate = data.records.length > 0 ?
    (data.records.filter(r => r.proximityToMilitary?.isNearBase).length / data.records.length) * 100 : 0;
  score += militaryProximityRate * 0.3;

  // Water violation correlation factor
  const violationCorrelationRate = data.records.length > 0 ?
    (data.records.filter(r => r.correlationFlags?.hasWaterViolation).length / data.records.length) * 100 : 0;
  score += violationCorrelationRate * 0.2;

  return Math.round(Math.min(score, 100));
}