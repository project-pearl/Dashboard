// app/api/cron/rebuild-usgs-wqp/route.ts
// Daily USGS Water Quality Portal data refresh for national water quality surveillance
// Critical for water quality monitoring and military installation proximity analysis

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for comprehensive water quality data processing

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import {
  setUSGSWQPCache,
  setBuildInProgress,
  isBuildInProgress,
  buildUSGSWQPCacheData,
  getUSGSWQPCacheStatus,
  fetchUSGSWQPData,
  processUSGSWQPData,
} from '@/lib/usgsWqpCache';
import { getSDWISCache } from '@/lib/sdwisCache';

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isBuildInProgress()) {
    return NextResponse.json({
      message: 'USGS WQP cache build already in progress',
      status: getUSGSWQPCacheStatus(),
    });
  }

  try {
    setBuildInProgress(true);
    console.log('Starting USGS Water Quality Portal surveillance cache rebuild...');

    // Fetch water quality monitoring data from USGS WQP API
    console.log('Fetching USGS WQP water quality monitoring data...');
    const rawSamples = await fetchUSGSWQPData();

    if (rawSamples.length === 0) {
      console.warn('No USGS WQP data retrieved');
      return NextResponse.json({
        error: 'No USGS WQP data available',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    console.log(`Processing ${rawSamples.length} water quality samples from USGS WQP...`);

    // Process water quality monitoring data
    const processedRecords = processUSGSWQPData(rawSamples);
    console.log(`Processed ${processedRecords.length} water quality monitoring records`);

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

    // Build comprehensive cache data with military proximity and violation correlations
    const cacheData = await buildUSGSWQPCacheData(processedRecords, waterViolations);

    // Analyze for critical water quality alerts
    const criticalAlerts = analyzeCriticalWaterQualityAlerts(cacheData);

    // Update cache
    await setUSGSWQPCache(cacheData);

    const status = getUSGSWQPCacheStatus();
    console.log('USGS WQP cache rebuild completed successfully');

    return NextResponse.json({
      success: true,
      message: 'USGS WQP cache rebuilt successfully',
      stats: {
        total_samples: cacheData.records.length,
        unique_sites: cacheData.summary.uniqueSites,
        data_type_distribution: cacheData.summary.dataTypeDistribution,
        media_breakdown: cacheData.summary.mediaBreakdown,
        monitoring_type_distribution: cacheData.summary.monitoringTypeDistribution,
        compliance_violations: cacheData.summary.complianceViolations,
        exceeds_standard_count: cacheData.summary.exceedsStandardCount,
        high_risk_results: cacheData.summary.highRiskResults,
        critical_risk_results: cacheData.summary.criticalRiskResults,
        state_distribution: cacheData.summary.stateDistribution,
        date_range: cacheData.summary.dateRange,
        correlations: {
          military_proximity_alerts: cacheData.correlations.militaryProximityAlerts.length,
          health_risk_correlations: cacheData.correlations.healthRiskCorrelations.length,
          compliance_violation_clusters: cacheData.correlations.complianceViolationClusters.length,
        },
        critical_alerts: criticalAlerts,
        violations_checked: waterViolations.length,
      },
      cache_status: status,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('USGS WQP cache rebuild failed:', error);

    return NextResponse.json({
      error: 'Failed to rebuild USGS WQP cache',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });

  } finally {
    setBuildInProgress(false);
  }
}

// ─── Critical Water Quality Alert Analysis ──────────────────────────────────

/**
 * Analyze USGS WQP data for critical water quality alerts requiring immediate attention
 */
function analyzeCriticalWaterQualityAlerts(cacheData: any): {
  critical_contamination_alerts: any[];
  military_proximity_concerns: any[];
  compliance_violation_hotspots: any[];
  emerging_contaminant_detections: any[];
} {
  const criticalContaminationAlerts = identifyCriticalContaminationAlerts(cacheData.records);
  const militaryProximityConcerns = identifyMilitaryProximityConcerns(cacheData.records);
  const complianceViolationHotspots = identifyComplianceViolationHotspots(cacheData.records);
  const emergingContaminantDetections = identifyEmergingContaminantDetections(cacheData.records);

  return {
    critical_contamination_alerts: criticalContaminationAlerts,
    military_proximity_concerns: militaryProximityConcerns,
    compliance_violation_hotspots: complianceViolationHotspots,
    emerging_contaminant_detections: emergingContaminantDetections,
  };
}

function identifyCriticalContaminationAlerts(records: any[]): any[] {
  // Identify critical water contamination requiring immediate response
  const criticalAlerts = records.filter(record =>
    record.wqpSpecific.healthRisk === 'critical' &&
    record.wqpSpecific.qualityAssurance === 'passed'
  );

  return criticalAlerts
    .map(record => ({
      site_id: record.wqpSpecific.siteId,
      site_name: record.wqpSpecific.siteName,
      location: {
        lat: record.location.lat,
        lng: record.location.lng,
        state: record.location.state,
        county: record.location.county,
        city: record.location.city,
      },
      characteristic: record.wqpSpecific.characteristicName,
      result_value: record.wqpSpecific.resultValue,
      result_unit: record.wqpSpecific.resultUnit,
      detection_limit: record.wqpSpecific.detectionLimit,
      exceeds_standard: record.wqpSpecific.exceedsStandard,
      compliance_status: record.wqpSpecific.complianceStatus,
      sample_media: record.wqpSpecific.sampleMedia,
      monitoring_type: record.wqpSpecific.monitoringType,
      sample_date: record.wqpSpecific.sampleDateTime,
      organization_id: record.wqpSpecific.organizationId,
      waterbody_name: record.wqpSpecific.waterbodyName,
      huc_code: record.wqpSpecific.hucCode,
      military_proximity: record.proximityToMilitary?.isNearBase || false,
      distance_to_military: record.proximityToMilitary?.distanceKm,
    }))
    .sort((a, b) => {
      // Prioritize by exceeds standard and military proximity
      if (a.exceeds_standard && !b.exceeds_standard) return -1;
      if (!a.exceeds_standard && b.exceeds_standard) return 1;
      if (a.military_proximity && !b.military_proximity) return -1;
      if (!a.military_proximity && b.military_proximity) return 1;
      return new Date(b.sample_date).getTime() - new Date(a.sample_date).getTime();
    })
    .slice(0, 15);
}

function identifyMilitaryProximityConcerns(records: any[]): any[] {
  // Identify water quality concerns near military installations
  const militaryConcerns = records.filter(record =>
    record.proximityToMilitary?.isNearBase &&
    ['high', 'critical'].includes(record.wqpSpecific.healthRisk)
  );

  // Group by military installation
  const installationGroups = new Map<string, any[]>();

  militaryConcerns.forEach(record => {
    const installation = record.proximityToMilitary?.nearestInstallation || 'Unknown Installation';
    if (!installationGroups.has(installation)) {
      installationGroups.set(installation, []);
    }
    installationGroups.get(installation)!.push(record);
  });

  const proximityAnalysis: any[] = [];

  installationGroups.forEach((concerns, installation) => {
    const criticalConcerns = concerns.filter(c => c.wqpSpecific.healthRisk === 'critical').length;
    const highConcerns = concerns.filter(c => c.wqpSpecific.healthRisk === 'high').length;
    const complianceViolations = concerns.filter(c => c.wqpSpecific.complianceStatus === 'violation').length;
    const avgDistance = concerns.reduce((sum, c) => sum + (c.proximityToMilitary?.distanceKm || 0), 0) / concerns.length;

    const riskScore = calculateInstallationWaterRisk(criticalConcerns, highConcerns, complianceViolations, avgDistance);

    if (riskScore > 25) { // Significant risk threshold
      proximityAnalysis.push({
        installation,
        risk_score: riskScore,
        total_concerns: concerns.length,
        critical_concerns: criticalConcerns,
        high_concerns: highConcerns,
        compliance_violations: complianceViolations,
        average_distance_km: Math.round(avgDistance),
        unique_sites: new Set(concerns.map(c => c.wqpSpecific.siteId)).size,
        unique_characteristics: new Set(concerns.map(c => c.wqpSpecific.characteristicName)).size,
        latest_sample: Math.max(...concerns.map(c =>
          new Date(c.wqpSpecific.sampleDateTime).getTime()
        )),
        affected_waterbodies: [...new Set(concerns.map(c => c.wqpSpecific.waterbodyName).filter(w => w))],
      });
    }
  });

  return proximityAnalysis
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 12);
}

function identifyComplianceViolationHotspots(records: any[]): any[] {
  // Identify geographic hotspots of compliance violations
  const violations = records.filter(record => record.wqpSpecific.complianceStatus === 'violation');

  // Group violations by state and county
  const hotspotGroups = new Map<string, any[]>();

  violations.forEach(record => {
    const key = `${record.location.state}_${record.location.county || 'Unknown County'}`;
    if (!hotspotGroups.has(key)) {
      hotspotGroups.set(key, []);
    }
    hotspotGroups.get(key)!.push(record);
  });

  const hotspots: any[] = [];

  hotspotGroups.forEach((groupViolations, key) => {
    if (groupViolations.length >= 3) { // Hotspot threshold
      const [state, county] = key.split('_');

      const characteristicCounts = new Map<string, number>();
      groupViolations.forEach(v => {
        const char = v.wqpSpecific.characteristicName;
        characteristicCounts.set(char, (characteristicCounts.get(char) || 0) + 1);
      });

      const topCharacteristics = Array.from(characteristicCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([char, count]) => ({ characteristic: char, count }));

      hotspots.push({
        state,
        county,
        violation_count: groupViolations.length,
        unique_sites: new Set(groupViolations.map(v => v.wqpSpecific.siteId)).size,
        top_characteristics: topCharacteristics,
        critical_violations: groupViolations.filter(v => v.wqpSpecific.healthRisk === 'critical').length,
        high_violations: groupViolations.filter(v => v.wqpSpecific.healthRisk === 'high').length,
        date_range: {
          earliest: Math.min(...groupViolations.map(v => new Date(v.wqpSpecific.sampleDateTime).getTime())),
          latest: Math.max(...groupViolations.map(v => new Date(v.wqpSpecific.sampleDateTime).getTime())),
        },
        near_military: groupViolations.some(v => v.proximityToMilitary?.isNearBase),
      });
    }
  });

  return hotspots
    .sort((a, b) => {
      // Prioritize by critical violations and total count
      if (a.critical_violations !== b.critical_violations) {
        return b.critical_violations - a.critical_violations;
      }
      return b.violation_count - a.violation_count;
    })
    .slice(0, 10);
}

function identifyEmergingContaminantDetections(records: any[]): any[] {
  // Identify emerging contaminants of concern (PFAS, microplastics, pharmaceuticals, etc.)
  const emergingContaminants = ['PFOA', 'PFOS', 'PFAS', 'Microplastics', 'Pharmaceuticals', '1,4-Dioxane', 'Perchlorate'];

  const emergingDetections = records.filter(record => {
    const characteristic = record.wqpSpecific.characteristicName.toLowerCase();
    return emergingContaminants.some(contaminant => characteristic.includes(contaminant.toLowerCase()));
  });

  return emergingDetections
    .map(record => ({
      characteristic: record.wqpSpecific.characteristicName,
      result_value: record.wqpSpecific.resultValue,
      result_unit: record.wqpSpecific.resultUnit,
      detection_limit: record.wqpSpecific.detectionLimit,
      health_risk: record.wqpSpecific.healthRisk,
      exceeds_standard: record.wqpSpecific.exceedsStandard,
      site_id: record.wqpSpecific.siteId,
      site_name: record.wqpSpecific.siteName,
      waterbody_name: record.wqpSpecific.waterbodyName,
      location: `${record.location.city || 'Unknown'}, ${record.location.state}`,
      sample_date: record.wqpSpecific.sampleDateTime,
      monitoring_type: record.wqpSpecific.monitoringType,
      organization_id: record.wqpSpecific.organizationId,
      military_proximity: record.proximityToMilitary?.isNearBase || false,
      distance_to_military: record.proximityToMilitary?.distanceKm,
    }))
    .sort((a, b) => {
      // Prioritize by health risk and military proximity
      const riskOrder = { critical: 4, high: 3, moderate: 2, low: 1 };
      const aRisk = riskOrder[a.health_risk as keyof typeof riskOrder] || 0;
      const bRisk = riskOrder[b.health_risk as keyof typeof riskOrder] || 0;

      if (aRisk !== bRisk) return bRisk - aRisk;
      if (a.military_proximity && !b.military_proximity) return -1;
      if (!a.military_proximity && b.military_proximity) return 1;
      return new Date(b.sample_date).getTime() - new Date(a.sample_date).getTime();
    })
    .slice(0, 20);
}

function calculateInstallationWaterRisk(
  criticalConcerns: number,
  highConcerns: number,
  complianceViolations: number,
  avgDistance: number
): number {
  let score = 0;

  // Critical concerns contribution (highest priority)
  score += criticalConcerns * 20;

  // High concerns contribution
  score += highConcerns * 10;

  // Compliance violations contribution
  score += complianceViolations * 15;

  // Distance factor (closer = higher risk)
  const distanceFactor = Math.max(0, 15 - avgDistance / 3);
  score += distanceFactor;

  return Math.round(Math.min(score, 100)); // Cap at 100
}