// app/api/cron/rebuild-atsdr-toxicology/route.ts
// Daily ATSDR Toxicology data refresh for environmental health and chemical exposure intelligence
// Critical for military installation safety and environmental health monitoring

export const dynamic = 'force-dynamic';
export const maxDuration = 240; // 4 minutes for toxicological profile processing

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import {
  setATSDRToxicologyCache,
  setBuildInProgress,
  isBuildInProgress,
  buildATSDRToxicologyCacheData,
  getATSDRToxicologyCacheStatus,
  fetchATSDRToxicologyData,
  processATSDRToxicologyData,
} from '@/lib/atsdrToxicologyCache';

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isBuildInProgress()) {
    return NextResponse.json({
      message: 'ATSDR Toxicology cache build already in progress',
      status: getATSDRToxicologyCacheStatus(),
    });
  }

  try {
    setBuildInProgress(true);
    console.log('Starting ATSDR Toxicology environmental health cache rebuild...');

    // Fetch toxicological substance data from ATSDR API
    console.log('Fetching ATSDR Toxicology substance profiles...');
    const rawSubstances = await fetchATSDRToxicologyData();

    if (rawSubstances.length === 0) {
      console.warn('No ATSDR Toxicology data retrieved');
      return NextResponse.json({
        error: 'No ATSDR Toxicology data available',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    console.log(`Processing ${rawSubstances.length} toxicological substances from ATSDR...`);

    // Process toxicological substance data
    const processedRecords = processATSDRToxicologyData(rawSubstances);
    console.log(`Processed ${processedRecords.length} toxicological substance records`);

    // Build comprehensive cache data with environmental health analysis
    const cacheData = await buildATSDRToxicologyCacheData(processedRecords);

    // Analyze for critical toxicological threats
    const criticalThreats = analyzeCriticalToxicologicalThreats(cacheData);

    // Update cache
    await setATSDRToxicologyCache(cacheData);

    const status = getATSDRToxicologyCacheStatus();
    console.log('ATSDR Toxicology cache rebuild completed successfully');

    return NextResponse.json({
      success: true,
      message: 'ATSDR Toxicology cache rebuilt successfully',
      stats: {
        total_substances: cacheData.records.length,
        category_distribution: cacheData.summary.categoryDistribution,
        toxicity_level_counts: cacheData.summary.toxicityLevelCounts,
        water_contaminants: cacheData.summary.waterContaminants,
        carcinogenic_substances: cacheData.summary.carcinogenicSubstances,
        military_relevant_substances: cacheData.summary.militaryRelevantSubstances,
        high_persistence_substances: cacheData.summary.highPersistenceSubstances,
        critical_exposure_threats: cacheData.summary.criticalExposureThreats,
        correlations: {
          water_contamination_risks: cacheData.correlations.waterContaminationRisks.length,
          military_installation_threats: cacheData.correlations.militaryInstallationThreats.length,
          environmental_persistence_concerns: cacheData.correlations.environmentalPersistenceConcerns.length,
        },
        critical_threats: criticalThreats,
      },
      cache_status: status,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('ATSDR Toxicology cache rebuild failed:', error);

    return NextResponse.json({
      error: 'Failed to rebuild ATSDR Toxicology cache',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });

  } finally {
    setBuildInProgress(false);
  }
}

// ─── Critical Toxicological Threat Analysis ────────────────────────────────

/**
 * Analyze ATSDR Toxicology data for critical threats requiring immediate attention
 */
function analyzeCriticalToxicologicalThreats(cacheData: any): {
  severe_water_contaminants: any[];
  military_installation_risks: any[];
  carcinogenic_exposures: any[];
  persistent_environmental_threats: any[];
} {
  const severeWaterContaminants = identifySevereWaterContaminants(cacheData.records);
  const militaryInstallationRisks = identifyMilitaryInstallationRisks(cacheData.records);
  const carcinogenicExposures = identifyCarcinogenicExposures(cacheData.records);
  const persistentEnvironmentalThreats = identifyPersistentEnvironmentalThreats(cacheData.records);

  return {
    severe_water_contaminants: severeWaterContaminants,
    military_installation_risks: militaryInstallationRisks,
    carcinogenic_exposures: carcinogenicExposures,
    persistent_environmental_threats: persistentEnvironmentalThreats,
  };
}

function identifySevereWaterContaminants(records: any[]): any[] {
  // Identify severe water contamination threats
  const severeWaterThreats = records.filter(record =>
    record.atsdrSpecific.waterRelevance.isWaterContaminant &&
    ['severe', 'critical'].includes(record.atsdrSpecific.toxicityRating)
  );

  return severeWaterThreats
    .map(record => ({
      substance_name: record.atsdrSpecific.substanceName,
      cas_number: record.atsdrSpecific.casNumber,
      category: record.atsdrSpecific.category,
      toxicity_rating: record.atsdrSpecific.toxicityRating,
      drinking_water_standard: record.atsdrSpecific.waterRelevance.drinkingWaterStandard,
      groundwater_concern: record.atsdrSpecific.waterRelevance.groundwaterConcern,
      exposure_routes: record.atsdrSpecific.exposureRoutes,
      acute_effects: record.atsdrSpecific.healthEffects.acute,
      chronic_effects: record.atsdrSpecific.healthEffects.chronic,
      carcinogenic: record.atsdrSpecific.healthEffects.carcinogenic,
      environmental_persistence: record.atsdrSpecific.environmentalFate.persistence,
      bioaccumulation: record.atsdrSpecific.environmentalFate.bioaccumulation,
      military_relevance: record.atsdrSpecific.militaryRelevance.isUsedInMilitary,
    }))
    .sort((a, b) => {
      // Prioritize by toxicity level and drinking water standard
      const toxicityOrder = { critical: 4, severe: 3, high: 2, moderate: 1 };
      const aToxicity = toxicityOrder[a.toxicity_rating as keyof typeof toxicityOrder] || 0;
      const bToxicity = toxicityOrder[b.toxicity_rating as keyof typeof toxicityOrder] || 0;

      if (aToxicity !== bToxicity) return bToxicity - aToxicity;
      if (a.carcinogenic && !b.carcinogenic) return -1;
      if (!a.carcinogenic && b.carcinogenic) return 1;
      if (a.military_relevance && !b.military_relevance) return -1;
      if (!a.military_relevance && b.military_relevance) return 1;

      return a.substance_name.localeCompare(b.substance_name);
    })
    .slice(0, 12);
}

function identifyMilitaryInstallationRisks(records: any[]): any[] {
  // Identify military installation contamination risks
  const militaryRisks = records.filter(record =>
    record.atsdrSpecific.militaryRelevance.isUsedInMilitary ||
    record.atsdrSpecific.militaryRelevance.baseContaminationRisk !== 'low'
  );

  return militaryRisks
    .map(record => ({
      substance_name: record.atsdrSpecific.substanceName,
      category: record.atsdrSpecific.category,
      toxicity_rating: record.atsdrSpecific.toxicityRating,
      military_usage: record.atsdrSpecific.militaryRelevance.isUsedInMilitary,
      deployment_concern: record.atsdrSpecific.militaryRelevance.deploymentConcern,
      base_contamination_risk: record.atsdrSpecific.militaryRelevance.baseContaminationRisk,
      exposure_routes: record.atsdrSpecific.exposureRoutes,
      environmental_persistence: record.atsdrSpecific.environmentalFate.persistence,
      water_contamination_potential: record.atsdrSpecific.waterRelevance.isWaterContaminant,
      carcinogenic: record.atsdrSpecific.healthEffects.carcinogenic,
      developmental_toxicity: record.atsdrSpecific.healthEffects.developmentalToxicity,
    }))
    .sort((a, b) => {
      // Prioritize by base contamination risk and toxicity
      const riskOrder = { high: 3, medium: 2, low: 1 };
      const aRisk = riskOrder[a.base_contamination_risk as keyof typeof riskOrder] || 0;
      const bRisk = riskOrder[b.base_contamination_risk as keyof typeof riskOrder] || 0;

      if (aRisk !== bRisk) return bRisk - aRisk;

      const toxicityOrder = { critical: 4, severe: 3, high: 2, moderate: 1 };
      const aToxicity = toxicityOrder[a.toxicity_rating as keyof typeof toxicityOrder] || 0;
      const bToxicity = toxicityOrder[b.toxicity_rating as keyof typeof toxicityOrder] || 0;

      if (aToxicity !== bToxicity) return bToxicity - aToxicity;
      if (a.deployment_concern && !b.deployment_concern) return -1;
      if (!a.deployment_concern && b.deployment_concern) return 1;

      return a.substance_name.localeCompare(b.substance_name);
    })
    .slice(0, 15);
}

function identifyCarcinogenicExposures(records: any[]): any[] {
  // Identify carcinogenic substance exposure concerns
  const carcinogenicSubstances = records.filter(record =>
    record.atsdrSpecific.healthEffects.carcinogenic &&
    ['high', 'severe', 'critical'].includes(record.atsdrSpecific.toxicityRating)
  );

  return carcinogenicSubstances
    .map(record => ({
      substance_name: record.atsdrSpecific.substanceName,
      cas_number: record.atsdrSpecific.casNumber,
      category: record.atsdrSpecific.category,
      toxicity_rating: record.atsdrSpecific.toxicityRating,
      exposure_routes: record.atsdrSpecific.exposureRoutes,
      exposure_limits: {
        twa: record.atsdrSpecific.exposureLimits.twa,
        stel: record.atsdrSpecific.exposureLimits.stel,
        ceiling: record.atsdrSpecific.exposureLimits.ceiling,
        unit: record.atsdrSpecific.exposureLimits.unit,
      },
      environmental_persistence: record.atsdrSpecific.environmentalFate.persistence,
      bioaccumulation: record.atsdrSpecific.environmentalFate.bioaccumulation,
      water_contamination_potential: record.atsdrSpecific.waterRelevance.isWaterContaminant,
      military_concern: record.atsdrSpecific.militaryRelevance.isUsedInMilitary || record.atsdrSpecific.militaryRelevance.deploymentConcern,
    }))
    .sort((a, b) => {
      // Prioritize by toxicity and environmental persistence
      const toxicityOrder = { critical: 4, severe: 3, high: 2, moderate: 1 };
      const aToxicity = toxicityOrder[a.toxicity_rating as keyof typeof toxicityOrder] || 0;
      const bToxicity = toxicityOrder[b.toxicity_rating as keyof typeof toxicityOrder] || 0;

      if (aToxicity !== bToxicity) return bToxicity - aToxicity;

      const persistenceOrder = { high: 3, medium: 2, low: 1 };
      const aPersistence = persistenceOrder[a.environmental_persistence as keyof typeof persistenceOrder] || 0;
      const bPersistence = persistenceOrder[b.environmental_persistence as keyof typeof persistenceOrder] || 0;

      if (aPersistence !== bPersistence) return bPersistence - aPersistence;
      if (a.military_concern && !b.military_concern) return -1;
      if (!a.military_concern && b.military_concern) return 1;

      return a.substance_name.localeCompare(b.substance_name);
    })
    .slice(0, 10);
}

function identifyPersistentEnvironmentalThreats(records: any[]): any[] {
  // Identify persistent environmental contamination threats
  const persistentThreats = records.filter(record =>
    record.atsdrSpecific.environmentalFate.persistence === 'high' &&
    ['high', 'severe', 'critical'].includes(record.atsdrSpecific.toxicityRating)
  );

  return persistentThreats
    .map(record => ({
      substance_name: record.atsdrSpecific.substanceName,
      category: record.atsdrSpecific.category,
      toxicity_rating: record.atsdrSpecific.toxicityRating,
      environmental_fate: {
        persistence: record.atsdrSpecific.environmentalFate.persistence,
        bioaccumulation: record.atsdrSpecific.environmentalFate.bioaccumulation,
        mobility: record.atsdrSpecific.environmentalFate.mobility,
      },
      water_contamination_risk: record.atsdrSpecific.waterRelevance.isWaterContaminant,
      groundwater_concern: record.atsdrSpecific.waterRelevance.groundwaterConcern,
      military_installation_risk: record.atsdrSpecific.militaryRelevance.baseContaminationRisk,
      carcinogenic: record.atsdrSpecific.healthEffects.carcinogenic,
      developmental_toxicity: record.atsdrSpecific.healthEffects.developmentalToxicity,
      chronic_health_effects: record.atsdrSpecific.healthEffects.chronic,
    }))
    .sort((a, b) => {
      // Prioritize by toxicity and bioaccumulation potential
      const toxicityOrder = { critical: 4, severe: 3, high: 2, moderate: 1 };
      const aToxicity = toxicityOrder[a.toxicity_rating as keyof typeof toxicityOrder] || 0;
      const bToxicity = toxicityOrder[b.toxicity_rating as keyof typeof toxicityOrder] || 0;

      if (aToxicity !== bToxicity) return bToxicity - aToxicity;
      if (a.environmental_fate.bioaccumulation && !b.environmental_fate.bioaccumulation) return -1;
      if (!a.environmental_fate.bioaccumulation && b.environmental_fate.bioaccumulation) return 1;
      if (a.carcinogenic && !b.carcinogenic) return -1;
      if (!a.carcinogenic && b.carcinogenic) return 1;

      return a.substance_name.localeCompare(b.substance_name);
    })
    .slice(0, 12);
}