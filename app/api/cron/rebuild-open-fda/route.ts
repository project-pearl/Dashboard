// app/api/cron/rebuild-open-fda/route.ts
// Daily Open FDA API data refresh for contamination alerts and supply chain security
// Critical for force protection and military supply chain monitoring

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for FDA enforcement and recall data processing

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import {
  setOpenFDACache,
  setBuildInProgress,
  isBuildInProgress,
  buildOpenFDACacheData,
  getOpenFDACacheStatus,
  fetchOpenFDAData,
  OPEN_FDA_ENDPOINTS,
} from '@/lib/openFDACache';
import { getSDWISCache } from '@/lib/sdwisCache';

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isBuildInProgress()) {
    return NextResponse.json({
      message: 'Open FDA cache build already in progress',
      status: getOpenFDACacheStatus(),
    });
  }

  try {
    setBuildInProgress(true);
    console.log('Starting Open FDA enforcement and recall cache rebuild...');

    // Fetch data from Open FDA priority endpoints
    console.log('Fetching Open FDA enforcement and recall data...');
    const endpointResults = await fetchOpenFDAData();

    if (endpointResults.length === 0) {
      console.warn('No Open FDA data retrieved');
      return NextResponse.json({
        error: 'No Open FDA data available',
        attempted_endpoints: Object.keys(OPEN_FDA_ENDPOINTS),
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    const totalRecords = endpointResults.reduce((sum, endpoint) => sum + endpoint.records.length, 0);
    console.log(`Processing ${totalRecords} records from ${endpointResults.length} Open FDA endpoints...`);

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

    // Build comprehensive cache data with correlations and supply chain analysis
    const fdaCacheData = await buildOpenFDACacheData(endpointResults, waterViolations);

    // Analyze for critical alerts
    const criticalAlerts = analyzeCriticalFDAAlerts(fdaCacheData);

    // Update cache
    await setOpenFDACache(fdaCacheData);

    const status = getOpenFDACacheStatus();
    console.log('Open FDA cache rebuild completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Open FDA cache rebuilt successfully',
      stats: {
        total_records: fdaCacheData.records.length,
        endpoints_processed: endpointResults.length,
        endpoint_summary: endpointResults.map(ep => ({
          endpoint: ep.endpoint,
          category: ep.category,
          record_count: ep.records.length,
        })),
        category_breakdown: fdaCacheData.summary.categoryCounts,
        recall_classifications: fdaCacheData.summary.recallClassificationCounts,
        water_related_incidents: fdaCacheData.summary.waterRelatedIncidents,
        critical_supply_chain_alerts: fdaCacheData.summary.criticalSupplyChainAlerts,
        active_recalls: fdaCacheData.summary.activeRecalls,
        correlations: {
          near_military: fdaCacheData.correlations.nearMilitaryFacilities,
          with_water_violations: fdaCacheData.correlations.correlatedWithViolations,
          supply_chain_risks: fdaCacheData.correlations.supplyChainRisks.length,
          contamination_alerts: fdaCacheData.correlations.contaminationAlerts.length,
        },
        critical_alerts: criticalAlerts,
        violations_checked: waterViolations.length,
        date_range: fdaCacheData.summary.dateRange,
      },
      cache_status: status,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Open FDA cache rebuild failed:', error);

    return NextResponse.json({
      error: 'Failed to rebuild Open FDA cache',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });

  } finally {
    setBuildInProgress(false);
  }
}

// ─── Critical Alert Analysis ─────────────────────────────────────────────────

/**
 * Analyze FDA data for critical alerts requiring immediate attention
 */
function analyzeCriticalFDAAlerts(cacheData: any): {
  immediate_threats: any[];
  supply_chain_risks: any[];
  water_contamination_alerts: any[];
  military_proximity_concerns: any[];
} {

  const immediateThreats = identifyImmediateThreats(cacheData.records);
  const supplyChainRisks = assessSupplyChainThreats(cacheData.records);
  const waterContaminationAlerts = identifyWaterContamination(cacheData.records);
  const militaryProximityConcerns = assessMilitaryProximityRisks(cacheData.records);

  return {
    immediate_threats: immediateThreats,
    supply_chain_risks: supplyChainRisks,
    water_contamination_alerts: waterContaminationAlerts,
    military_proximity_concerns: militaryProximityConcerns,
  };
}

function identifyImmediateThreats(records: any[]): any[] {
  // Identify Class I recalls and serious adverse events requiring immediate action
  const threats = records.filter(record => {
    // Class I recalls (life-threatening)
    if (record.fdaSpecific.recallClassification === 'Class I') return true;

    // Serious adverse events with deaths
    if (record.fdaSpecific.recordType.includes('adverse_events') &&
        record.fdaSpecific.seriousAdverseEvents > 0) return true;

    // Active recalls with nationwide distribution
    if (record.fdaSpecific.recallStatus === 'Ongoing' &&
        record.fdaSpecific.distributionPattern?.toLowerCase().includes('nationwide')) return true;

    return false;
  });

  return threats
    .map(record => ({
      alert_type: 'immediate_threat',
      classification: record.fdaSpecific.recallClassification || 'Unknown',
      product: record.fdaSpecific.productDescription,
      reason: record.fdaSpecific.reasonForRecall,
      firm: record.fdaSpecific.firmName,
      status: record.fdaSpecific.recallStatus,
      distribution: record.fdaSpecific.distributionPattern,
      date: record.fdaSpecific.recallInitiationDate || record.temporal.reportDate,
      near_military: record.proximityToMilitary?.isNearBase || false,
      water_related: record.fdaSpecific.waterRelated || false,
    }))
    .sort((a, b) => {
      // Prioritize by classification and military proximity
      if (a.classification === 'Class I' && b.classification !== 'Class I') return -1;
      if (a.classification !== 'Class I' && b.classification === 'Class I') return 1;
      if (a.near_military && !b.near_military) return -1;
      if (!a.near_military && b.near_military) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })
    .slice(0, 10);
}

function assessSupplyChainThreats(records: any[]): any[] {
  // Assess threats to military supply chain security
  const supplyChainThreats = records.filter(record => {
    // High or critical supply chain risk
    if (['high', 'critical'].includes(record.fdaSpecific.supplyChainRisk)) return true;

    // Food/beverage recalls affecting military supply
    if (record.fdaSpecific.recordType === 'food_enforcement' &&
        record.fdaSpecific.distributionPattern?.toLowerCase().includes('military')) return true;

    // Water-related contamination
    if (record.fdaSpecific.waterRelated && record.fdaSpecific.recallClassification !== 'Class III') return true;

    return false;
  });

  return supplyChainThreats
    .map(record => ({
      alert_type: 'supply_chain_risk',
      risk_level: record.fdaSpecific.supplyChainRisk,
      product_category: record.fdaSpecific.recordType,
      product: record.fdaSpecific.productDescription,
      firm: record.fdaSpecific.firmName,
      contamination_type: record.fdaSpecific.contaminationType,
      distribution_scope: calculateDistributionScope(record.fdaSpecific.distributionPattern),
      military_impact_score: calculateMilitaryImpact(record),
      date: record.fdaSpecific.recallInitiationDate || record.temporal.reportDate,
    }))
    .sort((a, b) => b.military_impact_score - a.military_impact_score)
    .slice(0, 15);
}

function identifyWaterContamination(records: any[]): any[] {
  // Identify water-related contamination incidents
  const waterAlerts = records.filter(record =>
    record.fdaSpecific.waterRelated ||
    record.fdaSpecific.contaminationType === 'bacterial' ||
    (record.fdaSpecific.productDescription &&
     record.fdaSpecific.productDescription.toLowerCase().includes('water'))
  );

  return waterAlerts
    .map(record => ({
      alert_type: 'water_contamination',
      contamination_type: record.fdaSpecific.contaminationType,
      product: record.fdaSpecific.productDescription,
      reason: record.fdaSpecific.reasonForRecall,
      severity: record.fdaSpecific.recallClassification,
      location: `${record.location.city || 'Unknown'}, ${record.location.state || 'Unknown'}`,
      near_military: record.proximityToMilitary?.isNearBase || false,
      distance_to_military: record.proximityToMilitary?.distanceKm,
      water_violation_correlation: record.correlationFlags?.hasWaterViolation || false,
      date: record.fdaSpecific.recallInitiationDate || record.temporal.reportDate,
    }))
    .sort((a, b) => {
      // Prioritize by severity and military proximity
      const severityOrder = { 'Class I': 3, 'Class II': 2, 'Class III': 1 };
      const aSeverity = severityOrder[a.severity as keyof typeof severityOrder] || 0;
      const bSeverity = severityOrder[b.severity as keyof typeof severityOrder] || 0;

      if (aSeverity !== bSeverity) return bSeverity - aSeverity;
      if (a.near_military && !b.near_military) return -1;
      if (!a.near_military && b.near_military) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })
    .slice(0, 12);
}

function assessMilitaryProximityRisks(records: any[]): any[] {
  // Assess risks to installations based on proximity to recalls/incidents
  const militaryRisks = records.filter(record => record.proximityToMilitary?.isNearBase);

  // Group by military installation
  const installationRisks = new Map<string, any[]>();

  militaryRisks.forEach(record => {
    const installation = record.proximityToMilitary.nearestInstallation || 'Unknown Installation';
    if (!installationRisks.has(installation)) {
      installationRisks.set(installation, []);
    }
    installationRisks.get(installation)!.push(record);
  });

  const proximityAnalysis: any[] = [];

  installationRisks.forEach((risks, installation) => {
    const classIRecalls = risks.filter(r => r.fdaSpecific.recallClassification === 'Class I').length;
    const waterRelated = risks.filter(r => r.fdaSpecific.waterRelated).length;
    const activeRecalls = risks.filter(r => r.fdaSpecific.recallStatus === 'Ongoing').length;
    const avgDistance = risks.reduce((sum, r) => sum + (r.proximityToMilitary?.distanceKm || 0), 0) / risks.length;

    const riskScore = calculateInstallationRiskScore(classIRecalls, waterRelated, activeRecalls, avgDistance);

    if (riskScore > 30) { // Significant risk threshold
      proximityAnalysis.push({
        installation,
        risk_score: riskScore,
        total_incidents: risks.length,
        class_i_recalls: classIRecalls,
        water_related_incidents: waterRelated,
        active_recalls: activeRecalls,
        average_distance_km: Math.round(avgDistance),
        latest_incident: Math.max(...risks.map(r =>
          new Date(r.fdaSpecific.recallInitiationDate || r.temporal.reportDate).getTime()
        )),
      });
    }
  });

  return proximityAnalysis
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 8);
}

function calculateDistributionScope(distributionPattern?: string): number {
  if (!distributionPattern) return 0;
  const pattern = distributionPattern.toLowerCase();
  if (pattern.includes('nationwide')) return 100;
  if (pattern.includes('multi-state')) return 70;
  if (pattern.includes('state')) return 40;
  if (pattern.includes('regional')) return 25;
  return 10;
}

function calculateMilitaryImpact(record: any): number {
  let impact = 0;

  // Supply chain risk contribution
  const riskScores = { critical: 40, high: 30, medium: 20, low: 10 };
  impact += riskScores[record.fdaSpecific.supplyChainRisk] || 0;

  // Classification contribution
  const classificationScores = { 'Class I': 30, 'Class II': 20, 'Class III': 10 };
  impact += classificationScores[record.fdaSpecific.recallClassification] || 0;

  // Water-related bonus
  if (record.fdaSpecific.waterRelated) impact += 15;

  // Military proximity bonus
  if (record.proximityToMilitary?.isNearBase) {
    const distanceBonus = Math.max(0, 20 - (record.proximityToMilitary.distanceKm || 0) / 5);
    impact += distanceBonus;
  }

  // Active recall bonus
  if (record.fdaSpecific.recallStatus === 'Ongoing') impact += 10;

  return Math.round(impact);
}

function calculateInstallationRiskScore(
  classIRecalls: number,
  waterRelated: number,
  activeRecalls: number,
  avgDistance: number
): number {
  let score = 0;

  // Class I recall contribution (highest priority)
  score += classIRecalls * 25;

  // Water-related incidents contribution
  score += waterRelated * 15;

  // Active recalls contribution
  score += activeRecalls * 10;

  // Distance factor (closer = higher risk)
  const distanceFactor = Math.max(0, 20 - avgDistance / 5);
  score += distanceFactor;

  return Math.round(Math.min(score, 100)); // Cap at 100
}