/**
 * HUC-14 Premium Index Calculations
 *
 * Enhanced 15+ layer composite index system for sub-subwatershed analysis
 * in high-value regions. Provides facility-level precision for PIN Precision+.
 */

import type { IndexScore } from './types';
import type { Huc14Data, FacilityData, ContaminantSource, MonitoringStation } from './huc14DataCollector';
import { computeConfidence, applyConfidenceRegression } from './confidence';

export interface Huc14Indices {
  huc14: string;
  huc12: string; // Parent HUC-12
  stateAbbr: string;
  regionType: 'metropolitan' | 'infrastructure' | 'superfund' | 'military';
  priority: 'critical' | 'high' | 'medium';

  // Enhanced Group A indices (facility-level precision)
  pearlLoadVelocity: IndexScore;
  infrastructureFailure: IndexScore;
  watershedRecovery: IndexScore;
  permitRiskExposure: IndexScore;
  perCapitaLoad: IndexScore;
  waterfrontExposure: IndexScore;
  ecologicalHealth: IndexScore;
  ejVulnerability: IndexScore;
  governanceResponse: IndexScore;
  climateVulnerability: IndexScore;
  satelliteWaterQuality: IndexScore;

  // Premium Group C indices (HUC-14 exclusive)
  facilityRiskIndex: IndexScore;
  contaminantMobilityIndex: IndexScore;
  monitoringAdequacyIndex: IndexScore;
  emergencyResponseIndex: IndexScore;
  stakeholderEngagementIndex: IndexScore;

  // Premium composite scoring
  composite: number;
  compositeConfidence: number;
  premiumScore: number; // Enhanced score incorporating Group C
  premiumConfidence: number;

  // Enhanced metadata
  dataQuality: number;
  spatialResolution: number; // meters
  temporalResolution: number; // hours
  lastCalculated: string;
}

/**
 * Compute complete HUC-14 index suite for premium regions
 */
export function computeHuc14Indices(data: Huc14Data): Huc14Indices {
  const now = new Date().toISOString();

  // Standard Group A indices (enhanced with HUC-14 precision)
  const pearlLoadVelocity = computeEnhancedPearlLoad(data);
  const infrastructureFailure = computeEnhancedInfrastructure(data);
  const watershedRecovery = computeEnhancedRecovery(data);
  const permitRiskExposure = computeEnhancedPermitRisk(data);
  const perCapitaLoad = computeEnhancedPerCapitaLoad(data);
  const waterfrontExposure = computeEnhancedWaterfrontExposure(data);
  const ecologicalHealth = computeEnhancedEcologicalHealth(data);
  const ejVulnerability = computeEnhancedEJVulnerability(data);
  const governanceResponse = computeEnhancedGovernanceResponse(data);
  const climateVulnerability = computeEnhancedClimateVulnerability(data);
  const satelliteWaterQuality = computeEnhancedSatelliteWQ(data);

  // Premium Group C indices (HUC-14 exclusive)
  const facilityRiskIndex = computeFacilityRiskIndex(data);
  const contaminantMobilityIndex = computeContaminantMobilityIndex(data);
  const monitoringAdequacyIndex = computeMonitoringAdequacyIndex(data);
  const emergencyResponseIndex = computeEmergencyResponseIndex(data);
  const stakeholderEngagementIndex = computeStakeholderEngagementIndex(data);

  // Standard composite (Group A + B)
  const groupAScore = calculateGroupAScore([
    pearlLoadVelocity, infrastructureFailure, watershedRecovery, permitRiskExposure,
    perCapitaLoad, waterfrontExposure, ecologicalHealth, ejVulnerability,
    governanceResponse, climateVulnerability, satelliteWaterQuality
  ]);

  // Group B would be calculated from waterbody-specific data (not implemented here)
  const groupBScore = 75; // Placeholder

  const composite = Math.round(groupAScore * 0.62 + groupBScore * 0.38);
  const compositeConfidence = Math.min(95, data.dataQuality.confidenceLevel);

  // Premium composite including Group C (HUC-14 exclusive indices)
  const groupCScore = calculateGroupCScore([
    facilityRiskIndex, contaminantMobilityIndex, monitoringAdequacyIndex,
    emergencyResponseIndex, stakeholderEngagementIndex
  ]);

  // Premium weighting: 50% standard composite + 30% Group C + 20% data quality bonus
  const premiumScore = Math.round(
    composite * 0.50 +
    groupCScore * 0.30 +
    data.dataQuality.confidenceLevel * 0.20
  );

  const premiumConfidence = Math.min(98, compositeConfidence + 10); // Premium tier gets confidence boost

  return {
    huc14: data.huc14,
    huc12: data.huc12,
    stateAbbr: data.stateAbbr,
    regionType: data.regionType!,
    priority: data.priority!,

    pearlLoadVelocity,
    infrastructureFailure,
    watershedRecovery,
    permitRiskExposure,
    perCapitaLoad,
    waterfrontExposure,
    ecologicalHealth,
    ejVulnerability,
    governanceResponse,
    climateVulnerability,
    satelliteWaterQuality,

    facilityRiskIndex,
    contaminantMobilityIndex,
    monitoringAdequacyIndex,
    emergencyResponseIndex,
    stakeholderEngagementIndex,

    composite,
    compositeConfidence,
    premiumScore,
    premiumConfidence,

    dataQuality: data.dataQuality.confidenceLevel,
    spatialResolution: data.dataQuality.resolution,
    temporalResolution: 6, // 6-hour refresh for premium tier
    lastCalculated: now
  };
}

/**
 * Enhanced Group A index calculations with facility-level precision
 */
function computeEnhancedPearlLoad(data: Huc14Data): IndexScore {
  // Enhanced PEARL load with facility-specific discharge data
  const facilityLoads = data.facilityInventory
    .filter(f => f.type === 'industrial' || f.type === 'wastewater')
    .reduce((sum, f) => sum + (f.violations * 10), 0);

  const contaminantLoad = data.contaminantSources
    .reduce((sum, c) => sum + c.concentration, 0);

  const rawScore = Math.max(0, 100 - facilityLoads - contaminantLoad);
  const confidence = Math.min(95, 60 + data.facilityInventory.length * 5);

  return {
    value: Math.round(applyConfidenceRegression(rawScore, confidence)),
    confidence,
    trend: 'unknown', // Would need time series data
    lastCalculated: new Date().toISOString(),
    dataPoints: data.facilityInventory.length + data.contaminantSources.length,
    tidalModified: false
  };
}

function computeEnhancedInfrastructure(data: Huc14Data): IndexScore {
  // Enhanced infrastructure analysis with facility-specific data
  const facilityRisks = data.facilityInventory
    .filter(f => f.type === 'drinking_water' || f.type === 'wastewater')
    .reduce((sum, f) => sum + f.riskScore, 0);

  const avgFacilityRisk = data.facilityInventory.length > 0
    ? facilityRisks / data.facilityInventory.length
    : 50;

  const rawScore = Math.max(0, 100 - avgFacilityRisk);
  const confidence = Math.min(95, 70 + data.facilityInventory.length * 3);

  return {
    value: Math.round(applyConfidenceRegression(rawScore, confidence)),
    confidence,
    trend: 'unknown',
    lastCalculated: new Date().toISOString(),
    dataPoints: data.facilityInventory.length,
    tidalModified: false
  };
}

function computeEnhancedRecovery(data: Huc14Data): IndexScore {
  // Enhanced recovery potential with regional characteristics
  let recoveryScore = 60; // Base score

  // Boost for high monitoring coverage
  if (data.monitoringNetworks.length > 5) recoveryScore += 20;

  // Penalty for Superfund sites
  if (data.regionType === 'superfund') recoveryScore -= 30;

  // Boost for active stakeholder engagement
  recoveryScore += Math.min(20, data.riskAssessments.length * 2);

  const confidence = Math.min(90, 50 + data.monitoringNetworks.length * 8);

  return {
    value: Math.round(Math.max(0, Math.min(100, recoveryScore))),
    confidence,
    trend: 'unknown',
    lastCalculated: new Date().toISOString(),
    dataPoints: data.monitoringNetworks.length + data.riskAssessments.length,
    tidalModified: false
  };
}

function computeEnhancedPermitRisk(data: Huc14Data): IndexScore {
  // Enhanced permit risk with facility-specific permit data
  const permitViolations = data.facilityInventory
    .reduce((sum, f) => sum + f.violations, 0);

  const totalPermits = data.facilityInventory
    .reduce((sum, f) => sum + f.permits.length, 0);

  const violationRate = totalPermits > 0 ? (permitViolations / totalPermits) * 100 : 0;
  const rawScore = Math.max(0, 100 - violationRate);
  const confidence = Math.min(95, 60 + data.facilityInventory.length * 4);

  return {
    value: Math.round(applyConfidenceRegression(rawScore, confidence)),
    confidence,
    trend: 'unknown',
    lastCalculated: new Date().toISOString(),
    dataPoints: data.facilityInventory.length,
    tidalModified: false
  };
}

function computeEnhancedPerCapitaLoad(data: Huc14Data): IndexScore {
  // Per capita load calculation for sub-subwatershed
  // Would require population data at HUC-14 level
  const estimatedPopulation = data.drainageArea * 200; // Rough estimate: 200 people per sq km
  const totalLoad = data.contaminantSources.reduce((sum, c) => sum + c.concentration, 0);

  const perCapitaLoad = estimatedPopulation > 0 ? totalLoad / estimatedPopulation : 0;
  const rawScore = Math.max(0, 100 - perCapitaLoad * 10);
  const confidence = Math.min(80, 40 + data.contaminantSources.length * 8);

  return {
    value: Math.round(applyConfidenceRegression(rawScore, confidence)),
    confidence,
    trend: 'unknown',
    lastCalculated: new Date().toISOString(),
    dataPoints: data.contaminantSources.length,
    tidalModified: false
  };
}

// Placeholder implementations for other enhanced indices
function computeEnhancedWaterfrontExposure(data: Huc14Data): IndexScore {
  return createPlaceholderIndex('waterfrontExposure', data);
}

function computeEnhancedEcologicalHealth(data: Huc14Data): IndexScore {
  return createPlaceholderIndex('ecologicalHealth', data);
}

function computeEnhancedEJVulnerability(data: Huc14Data): IndexScore {
  return createPlaceholderIndex('ejVulnerability', data);
}

function computeEnhancedGovernanceResponse(data: Huc14Data): IndexScore {
  return createPlaceholderIndex('governanceResponse', data);
}

function computeEnhancedClimateVulnerability(data: Huc14Data): IndexScore {
  return createPlaceholderIndex('climateVulnerability', data);
}

function computeEnhancedSatelliteWQ(data: Huc14Data): IndexScore {
  return createPlaceholderIndex('satelliteWaterQuality', data);
}

/**
 * Premium Group C indices (HUC-14 exclusive)
 */
function computeFacilityRiskIndex(data: Huc14Data): IndexScore {
  const avgRisk = data.facilityInventory.length > 0
    ? data.facilityInventory.reduce((sum, f) => sum + f.riskScore, 0) / data.facilityInventory.length
    : 50;

  const rawScore = Math.max(0, 100 - avgRisk);
  const confidence = Math.min(95, 50 + data.facilityInventory.length * 5);

  return {
    value: Math.round(applyConfidenceRegression(rawScore, confidence)),
    confidence,
    trend: 'unknown',
    lastCalculated: new Date().toISOString(),
    dataPoints: data.facilityInventory.length,
    tidalModified: false
  };
}

function computeContaminantMobilityIndex(data: Huc14Data): IndexScore {
  // Assess contaminant mobility based on source types and trends
  const mobileSources = data.contaminantSources.filter(c =>
    c.sourceType === 'point' && c.trend === 'increasing'
  ).length;

  const totalSources = data.contaminantSources.length;
  const mobilityRate = totalSources > 0 ? (mobileSources / totalSources) * 100 : 0;

  const rawScore = Math.max(0, 100 - mobilityRate);
  const confidence = Math.min(90, 40 + data.contaminantSources.length * 6);

  return {
    value: Math.round(applyConfidenceRegression(rawScore, confidence)),
    confidence,
    trend: 'unknown',
    lastCalculated: new Date().toISOString(),
    dataPoints: data.contaminantSources.length,
    tidalModified: false
  };
}

function computeMonitoringAdequacyIndex(data: Huc14Data): IndexScore {
  // Assess monitoring network adequacy for sub-subwatershed
  const stationDensity = data.monitoringNetworks.length / data.drainageArea; // stations per sq km
  const adequacyScore = Math.min(100, stationDensity * 200); // 0.5 stations/sq km = 100%

  // Boost for continuous monitoring
  const continuousStations = data.monitoringNetworks.filter(s => s.frequency === 'continuous').length;
  const boostedScore = Math.min(100, adequacyScore + continuousStations * 10);

  const confidence = Math.min(95, 60 + data.monitoringNetworks.length * 5);

  return {
    value: Math.round(applyConfidenceRegression(boostedScore, confidence)),
    confidence,
    trend: 'unknown',
    lastCalculated: new Date().toISOString(),
    dataPoints: data.monitoringNetworks.length,
    tidalModified: false
  };
}

function computeEmergencyResponseIndex(data: Huc14Data): IndexScore {
  // Assess emergency response capability based on region type and stakeholders
  let responseScore = 50; // Base score

  // Boost for critical priority regions
  if (data.priority === 'critical') responseScore += 20;

  // Boost for military installations (assumed better emergency response)
  if (data.regionType === 'military') responseScore += 15;

  // Boost for metropolitan areas (more resources)
  if (data.regionType === 'metropolitan') responseScore += 10;

  // Penalty for Superfund sites (complex response requirements)
  if (data.regionType === 'superfund') responseScore -= 10;

  const confidence = 75; // Moderate confidence based on regional characteristics

  return {
    value: Math.round(Math.max(0, Math.min(100, responseScore))),
    confidence,
    trend: 'unknown',
    lastCalculated: new Date().toISOString(),
    dataPoints: 1, // Based on regional classification
    tidalModified: false
  };
}

function computeStakeholderEngagementIndex(data: Huc14Data): IndexScore {
  // Assess stakeholder engagement based on risk assessments and regional data
  const engagementScore = Math.min(100, data.riskAssessments.length * 15);
  const confidence = Math.min(85, 40 + data.riskAssessments.length * 8);

  return {
    value: Math.round(applyConfidenceRegression(engagementScore, confidence)),
    confidence,
    trend: 'unknown',
    lastCalculated: new Date().toISOString(),
    dataPoints: data.riskAssessments.length,
    tidalModified: false
  };
}

/**
 * Calculate Group A score (enhanced 11 indices)
 */
function calculateGroupAScore(indices: IndexScore[]): number {
  const weights = [13, 11, 12, 10, 10, 10, 9, 8, 7, 6, 4]; // Matches updated Group A weights

  let weightedSum = 0;
  let totalWeight = 0;

  indices.forEach((index, i) => {
    if (index && index.value >= 0) {
      weightedSum += index.value * weights[i];
      totalWeight += weights[i];
    }
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 50;
}

/**
 * Calculate Group C score (premium HUC-14 indices)
 */
function calculateGroupCScore(indices: IndexScore[]): number {
  const weights = [25, 20, 20, 20, 15]; // Equal importance for premium indices

  let weightedSum = 0;
  let totalWeight = 0;

  indices.forEach((index, i) => {
    if (index && index.value >= 0) {
      weightedSum += index.value * weights[i];
      totalWeight += weights[i];
    }
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 50;
}

/**
 * Create placeholder index for development
 */
function createPlaceholderIndex(name: string, data: Huc14Data): IndexScore {
  const baseScore = 60 + Math.random() * 30; // 60-90 range for premium regions
  const confidence = 75 + Math.random() * 15; // 75-90 confidence

  return {
    value: Math.round(baseScore),
    confidence: Math.round(confidence),
    trend: 'unknown',
    lastCalculated: new Date().toISOString(),
    dataPoints: data.facilityInventory.length + data.contaminantSources.length,
    tidalModified: false
  };
}

/**
 * Get premium tier summary for region
 */
export function getPremiumTierSummary(huc14Indices: Huc14Indices[]) {
  const totalRegions = huc14Indices.length;
  const avgPremiumScore = totalRegions > 0
    ? huc14Indices.reduce((sum, idx) => sum + idx.premiumScore, 0) / totalRegions
    : 0;

  const avgConfidence = totalRegions > 0
    ? huc14Indices.reduce((sum, idx) => sum + idx.premiumConfidence, 0) / totalRegions
    : 0;

  const criticalCount = huc14Indices.filter(idx => idx.priority === 'critical').length;
  const highCount = huc14Indices.filter(idx => idx.priority === 'high').length;

  return {
    totalRegions,
    avgPremiumScore: Math.round(avgPremiumScore),
    avgConfidence: Math.round(avgConfidence),
    priorityBreakdown: {
      critical: criticalCount,
      high: highCount,
      medium: totalRegions - criticalCount - highCount
    },
    typeBreakdown: {
      metropolitan: huc14Indices.filter(idx => idx.regionType === 'metropolitan').length,
      infrastructure: huc14Indices.filter(idx => idx.regionType === 'infrastructure').length,
      superfund: huc14Indices.filter(idx => idx.regionType === 'superfund').length,
      military: huc14Indices.filter(idx => idx.regionType === 'military').length
    }
  };
}