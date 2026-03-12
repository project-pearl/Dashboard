// app/api/cron/rebuild-cdc-wonder/route.ts
// Daily CDC WONDER mortality data refresh for environmental health correlations
// Part of Tier 1 HHS integration - correlates mortality with water violations and military proximity

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for mortality data processing and correlation

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import {
  setCDCWonderCache,
  setBuildInProgress,
  isBuildInProgress,
  processCDCWonderData,
  buildCDCWonderCacheData,
  getCDCWonderCacheStatus,
  fetchCDCWonderMortalityData,
} from '@/lib/cdcWonderCache';
import { getSDWISCache } from '@/lib/sdwisCache';

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isBuildInProgress()) {
    return NextResponse.json({
      message: 'CDC WONDER cache build already in progress',
      status: getCDCWonderCacheStatus(),
    });
  }

  try {
    setBuildInProgress(true);
    console.log('Starting CDC WONDER mortality cache rebuild...');

    // Fetch environmental mortality data from CDC WONDER
    console.log('Fetching CDC WONDER environmental mortality data...');
    const rawMortalityData = await fetchCDCWonderMortalityData();

    if (rawMortalityData.length === 0) {
      console.warn('No CDC WONDER mortality data retrieved');
      return NextResponse.json({
        error: 'No CDC WONDER mortality data available',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    console.log(`Processing ${rawMortalityData.length} CDC WONDER mortality records...`);

    // Process and normalize the mortality data
    const processedRecords = processCDCWonderData(rawMortalityData);
    console.log(`Successfully processed ${processedRecords.length} mortality records`);

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
    const wonderCacheData = await buildCDCWonderCacheData(processedRecords, waterViolations);

    // Update cache
    await setCDCWonderCache(wonderCacheData);

    const status = getCDCWonderCacheStatus();
    console.log('CDC WONDER mortality cache rebuild completed successfully');

    return NextResponse.json({
      success: true,
      message: 'CDC WONDER mortality cache rebuilt successfully',
      stats: {
        total_mortality_records: wonderCacheData.records.length,
        states_covered: wonderCacheData.summary.statesCovered.length,
        years_covered: wonderCacheData.summary.yearsCovered.length,
        environmental_deaths: wonderCacheData.summary.environmentalDeaths,
        water_related_deaths: wonderCacheData.summary.waterRelatedDeaths,
        near_military_deaths: wonderCacheData.summary.nearMilitaryDeaths,
        top_causes: wonderCacheData.summary.topCauses.slice(0, 5),
        correlations: {
          with_water_violations: wonderCacheData.correlations.withWaterViolations,
          with_military_bases: wonderCacheData.correlations.withMilitaryBases,
          high_risk_areas: wonderCacheData.correlations.highRiskAreas.length,
        },
        violations_checked: waterViolations.length,
      },
      cache_status: status,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('CDC WONDER mortality cache rebuild failed:', error);

    return NextResponse.json({
      error: 'Failed to rebuild CDC WONDER mortality cache',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });

  } finally {
    setBuildInProgress(false);
  }
}

// ─── Helper Functions for Enhanced Data Processing ───────────────────────────

/**
 * Enhanced mortality data processing with advanced correlations
 */
async function processAdvancedMortalityCorrelations(
  mortalityRecords: any[],
  waterViolations: any[]
): Promise<{
  temporalCorrelations: any[];
  spatialHotspots: any[];
  demographicPatterns: any[];
}> {

  const temporalCorrelations = analyzeTemporalCorrelations(mortalityRecords, waterViolations);
  const spatialHotspots = identifySpatialHotspots(mortalityRecords);
  const demographicPatterns = analyzeDemographicPatterns(mortalityRecords);

  return {
    temporalCorrelations,
    spatialHotspots,
    demographicPatterns,
  };
}

function analyzeTemporalCorrelations(mortalityRecords: any[], waterViolations: any[]): any[] {
  // Analyze temporal patterns between water violations and mortality spikes
  const correlations: any[] = [];

  // Group violations by year and location
  const violationsByYearLocation = new Map<string, any[]>();
  waterViolations.forEach(violation => {
    const year = new Date(violation.violationDate).getFullYear();
    const location = `${violation.systemId}_${year}`;

    if (!violationsByYearLocation.has(location)) {
      violationsByYearLocation.set(location, []);
    }
    violationsByYearLocation.get(location)!.push(violation);
  });

  // Group mortality by year and location
  const mortalityByYearLocation = new Map<string, any[]>();
  mortalityRecords.forEach(record => {
    const location = `${record.location}_${record.year}`;

    if (!mortalityByYearLocation.has(location)) {
      mortalityByYearLocation.set(location, []);
    }
    mortalityByYearLocation.get(location)!.push(record);
  });

  // Find correlations
  for (const [location, violations] of violationsByYearLocation.entries()) {
    const mortality = mortalityByYearLocation.get(location);
    if (mortality && mortality.length > 0) {
      correlations.push({
        location,
        violations: violations.length,
        deaths: mortality.reduce((sum, record) => sum + (record.deaths || 0), 0),
        correlation_strength: calculateCorrelationStrength(violations, mortality),
      });
    }
  }

  return correlations.sort((a, b) => b.correlation_strength - a.correlation_strength).slice(0, 20);
}

function identifySpatialHotspots(mortalityRecords: any[]): any[] {
  // Identify geographic clusters of high environmental mortality
  const locationClusters = new Map<string, {
    location: string;
    totalDeaths: number;
    averageRate: number;
    recordCount: number;
    environmentalCauses: Set<string>;
  }>();

  mortalityRecords.forEach(record => {
    const location = record.location || 'Unknown';

    if (!locationClusters.has(location)) {
      locationClusters.set(location, {
        location,
        totalDeaths: 0,
        averageRate: 0,
        recordCount: 0,
        environmentalCauses: new Set(),
      });
    }

    const cluster = locationClusters.get(location)!;
    cluster.totalDeaths += record.deaths || 0;
    cluster.recordCount += 1;

    if (record.cause) {
      cluster.environmentalCauses.add(record.cause);
    }
  });

  // Calculate average rates and identify hotspots
  const hotspots = Array.from(locationClusters.values())
    .map(cluster => ({
      ...cluster,
      averageRate: cluster.recordCount > 0 ? cluster.totalDeaths / cluster.recordCount : 0,
      environmentalCauses: Array.from(cluster.environmentalCauses),
    }))
    .filter(hotspot => hotspot.averageRate > 5) // Minimum threshold
    .sort((a, b) => b.averageRate - a.averageRate)
    .slice(0, 15);

  return hotspots;
}

function analyzeDemographicPatterns(mortalityRecords: any[]): any[] {
  // Analyze demographic patterns in environmental mortality
  const patterns: any[] = [];

  // Age group analysis
  const ageGroups = new Map<string, { deaths: number; records: number }>();

  // Gender analysis
  const genderGroups = new Map<string, { deaths: number; records: number }>();

  mortalityRecords.forEach(record => {
    const ageGroup = record.ageGroup || 'Unknown';
    const gender = record.gender || 'Unknown';

    // Age group tracking
    if (!ageGroups.has(ageGroup)) {
      ageGroups.set(ageGroup, { deaths: 0, records: 0 });
    }
    const ageData = ageGroups.get(ageGroup)!;
    ageData.deaths += record.deaths || 0;
    ageData.records += 1;

    // Gender tracking
    if (!genderGroups.has(gender)) {
      genderGroups.set(gender, { deaths: 0, records: 0 });
    }
    const genderData = genderGroups.get(gender)!;
    genderData.deaths += record.deaths || 0;
    genderData.records += 1;
  });

  // Build patterns analysis
  patterns.push({
    category: 'age_groups',
    data: Array.from(ageGroups.entries()).map(([group, data]) => ({
      group,
      total_deaths: data.deaths,
      average_rate: data.records > 0 ? data.deaths / data.records : 0,
      record_count: data.records,
    })),
  });

  patterns.push({
    category: 'gender',
    data: Array.from(genderGroups.entries()).map(([group, data]) => ({
      group,
      total_deaths: data.deaths,
      average_rate: data.records > 0 ? data.deaths / data.records : 0,
      record_count: data.records,
    })),
  });

  return patterns;
}

function calculateCorrelationStrength(violations: any[], mortality: any[]): number {
  // Simple correlation strength calculation
  // In practice, would use more sophisticated statistical methods

  if (violations.length === 0 || mortality.length === 0) return 0;

  const violationScore = Math.min(violations.length / 10, 1); // Normalize to 0-1
  const mortalityScore = Math.min(mortality.reduce((sum, record) => sum + (record.deaths || 0), 0) / 50, 1);

  return (violationScore + mortalityScore) / 2;
}