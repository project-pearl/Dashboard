// lib/environmentalHealthCache.ts
// Environmental health metrics cache with air/water quality health outcome correlations
// Integrates NIEHS, EPA environmental justice, and state health tracking data

import { loadCacheFromDisk, saveCacheToDisk } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';
import {
  EnvironmentalHealthMetric,
  findNearestInstallation,
  MilitaryInstallationRef,
  validateEnvironmentalHealthMetric,
  calculateEnvironmentalRiskScore,
  analyzeHealthEnvironmentCorrelation,
} from './healthDataUtils';
const militaryInstallations: any[] = require('../data/military-installations').militaryInstallations ?? require('../data/military-installations').default ?? require('../data/military-installations');

// ─── Cache State ─────────────────────────────────────────────────────────────

let environmentalHealthCache: EnvironmentalHealthMetric[] = [];
let _environmentalHealthCacheLoaded = false;
let _buildInProgress = false;
let _buildStartedAt: number | null = null;
let lastFetched: string | null = null;

const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes
const CACHE_FILE = 'environmental-health-national';

// ─── Cache Management ────────────────────────────────────────────────────────

export function getEnvironmentalHealthCache(): EnvironmentalHealthMetric[] {
  return environmentalHealthCache;
}

export async function setEnvironmentalHealthCache(metrics: EnvironmentalHealthMetric[]): Promise<void> {
  if (metrics.length === 0) {
    console.warn('No environmental health data to cache, preserving existing blob');
    return;
  }

  environmentalHealthCache = metrics;
  lastFetched = new Date().toISOString();
  _environmentalHealthCacheLoaded = true;

  saveCacheToDisk(CACHE_FILE, metrics);
  await saveCacheToBlob(CACHE_FILE, metrics);
}

export function isEnvironmentalHealthCacheLoaded(): boolean {
  return _environmentalHealthCacheLoaded;
}

export function getEnvironmentalHealthCacheStatus() {
  return {
    loaded: _environmentalHealthCacheLoaded,
    count: environmentalHealthCache.length,
    lastFetched,
    buildInProgress: isBuildInProgress(),
    buildStartedAt: _buildStartedAt,
  };
}

// ─── Build Lock Management ───────────────────────────────────────────────────

export function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;

  // Auto-clear expired locks
  if (_buildStartedAt && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('Environmental health cache build lock expired, clearing');
    _buildInProgress = false;
    _buildStartedAt = null;
    return false;
  }

  return true;
}

export function setBuildInProgress(inProgress: boolean): void {
  _buildInProgress = inProgress;
  _buildStartedAt = inProgress ? Date.now() : null;
}

// ─── Cache Warming ───────────────────────────────────────────────────────────

export async function ensureEnvironmentalHealthCacheWarmed(): Promise<void> {
  if (_environmentalHealthCacheLoaded && environmentalHealthCache.length > 0) return;

  try {
    // Try loading from disk first
    const diskData = await loadCacheFromDisk<EnvironmentalHealthMetric[]>(CACHE_FILE);
    if (diskData && diskData.length > 0) {
      environmentalHealthCache = diskData;
      _environmentalHealthCacheLoaded = true;
      console.log(`Environmental health cache warmed from disk: ${diskData.length} metrics`);
      return;
    }

    // Fallback to blob storage
    const blobData = await loadCacheFromBlob<EnvironmentalHealthMetric[]>(CACHE_FILE);
    if (blobData && blobData.length > 0) {
      environmentalHealthCache = blobData;
      _environmentalHealthCacheLoaded = true;
      console.log(`Environmental health cache warmed from blob: ${blobData.length} metrics`);

      // Save to disk for faster future access
      saveCacheToDisk(CACHE_FILE, blobData);
      return;
    }

    console.warn('No environmental health cache data available in disk or blob storage');
  } catch (error) {
    console.error('Failed to warm environmental health cache:', error);
  }
}

// ─── Data Processing ─────────────────────────────────────────────────────────

/**
 * Process raw environmental health data from multiple sources
 */
export function processEnvironmentalHealthData(
  rawData: any[],
  dataSource: 'niehs' | 'epa_ejscreen' | 'state_tracking' | 'combined' = 'combined'
): EnvironmentalHealthMetric[] {
  const processedMetrics: EnvironmentalHealthMetric[] = [];
  const installations: MilitaryInstallationRef[] = militaryInstallations.map((inst: any) => ({
    id: inst.id,
    name: inst.name,
    lat: inst.lat,
    lng: inst.lng,
    branch: inst.branch,
    country: inst.country,
  }));

  rawData.forEach(raw => {
    try {
      const metric: Partial<EnvironmentalHealthMetric> = {
        locationId: generateLocationId(raw),
        locationType: mapLocationType(raw.location_type || raw.geography_type || 'county'),
        state: raw.state || raw.state_abbr || raw.state_code,
        county: raw.county || raw.county_name,
        zipCode: raw.zip_code || raw.zipcode || undefined,
        lat: parseFloat(raw.latitude || raw.lat || raw.centroid_lat),
        lng: parseFloat(raw.longitude || raw.lng || raw.lon || raw.centroid_lng),
        population: parseInt(raw.population || raw.total_population) || 0,
        lastUpdated: new Date().toISOString(),
      };

      // Process demographics
      metric.demographics = {
        medianIncome: parseFloat(raw.median_income || raw.household_income) || undefined,
        minorityPercent: parseFloat(raw.minority_percent || raw.percent_minority) || undefined,
        under18Percent: parseFloat(raw.under_18_percent || raw.percent_under_18) || undefined,
        over65Percent: parseFloat(raw.over_65_percent || raw.percent_over_65) || undefined,
      };

      // Process health outcomes
      metric.healthOutcomes = {
        asthmaRateAdult: parseFloat(raw.adult_asthma_rate || raw.asthma_adults) || undefined,
        asthmaRateChild: parseFloat(raw.child_asthma_rate || raw.asthma_children) || undefined,
        respiratoryHospitalizations: parseFloat(raw.respiratory_hosp_rate || raw.respiratory_hospitalizations) || undefined,
        gastrointestinalHospitalizations: parseFloat(raw.gi_hosp_rate || raw.gastrointestinal_hospitalizations) || undefined,
        cancerIncidence: parseFloat(raw.cancer_incidence_rate || raw.cancer_rate) || undefined,
        lifeExpectancy: parseFloat(raw.life_expectancy || raw.avg_life_expectancy) || undefined,
      };

      // Process environmental exposures
      metric.environmentalExposures = {
        airQualityIndex: parseFloat(raw.air_quality_index || raw.aqi || raw.pm25_aqi) || undefined,
        pm25Concentration: parseFloat(raw.pm25_concentration || raw.pm25 || raw.fine_particulates) || undefined,
        ozoneConcentration: parseFloat(raw.ozone_concentration || raw.ozone || raw.o3) || undefined,
        waterViolationDensity: parseFloat(raw.water_violation_density || raw.drinking_water_violations) || undefined,
        proximityToHazardousWaste: parseFloat(raw.hazardous_waste_proximity || raw.superfund_proximity) || undefined,
        industrialFacilityDensity: parseFloat(raw.industrial_facility_density || raw.toxic_facilities) || undefined,
      };

      // Process environmental justice scores
      metric.environmentalJustice = {
        ejScreenPercentile: parseFloat(raw.ejscreen_percentile || raw.ej_index || raw.environmental_justice_index) || undefined,
        cumulativeImpactScore: calculateEnvironmentalRiskScore(metric as EnvironmentalHealthMetric),
        vulnerabilityScore: calculateVulnerabilityScore(metric),
      };

      // Validate the metric data
      if (!validateEnvironmentalHealthMetric(metric)) {
        console.warn('Invalid environmental health data:', metric.locationId);
        return;
      }

      // Calculate proximity to military installations
      const proximity = findNearestInstallation(metric, installations);
      if (proximity) {
        metric.proximityToMilitary = proximity;
      }

      processedMetrics.push(metric);
    } catch (error) {
      console.error('Error processing environmental health data:', error);
    }
  });

  return processedMetrics;
}

// ─── Data Processing Utilities ───────────────────────────────────────────────

function generateLocationId(raw: any): string {
  if (raw.location_id || raw.id) return raw.location_id || raw.id;

  const state = raw.state || raw.state_abbr || 'XX';
  const county = raw.county || raw.county_name || 'Unknown';
  const zipCode = raw.zip_code || raw.zipcode || '';
  const locationType = raw.location_type || 'county';

  if (zipCode) {
    return `${state}-${locationType}-${zipCode}`.toUpperCase();
  } else {
    return `${state}-${locationType}-${county.replace(/\s+/g, '')}`.toUpperCase();
  }
}

function mapLocationType(type: string): EnvironmentalHealthMetric['locationType'] {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('zip') || lowerType.includes('postal')) return 'zip';
  if (lowerType.includes('tract') || lowerType.includes('census')) return 'census_tract';
  if (lowerType.includes('state')) return 'state';
  return 'county';
}

function calculateVulnerabilityScore(metric: Partial<EnvironmentalHealthMetric>): number {
  let score = 0;
  let factors = 0;

  // Demographics vulnerability
  if (metric.demographics?.minorityPercent !== undefined) {
    score += (metric.demographics.minorityPercent / 100) * 25;
    factors++;
  }

  if (metric.demographics?.medianIncome !== undefined) {
    // Lower income = higher vulnerability
    const incomeScore = Math.max(0, 25 - (metric.demographics.medianIncome / 80000) * 25);
    score += incomeScore;
    factors++;
  }

  // Age vulnerability
  if (metric.demographics?.under18Percent !== undefined) {
    score += (metric.demographics.under18Percent / 100) * 15;
    factors++;
  }

  if (metric.demographics?.over65Percent !== undefined) {
    score += (metric.demographics.over65Percent / 100) * 15;
    factors++;
  }

  // Health vulnerability
  if (metric.healthOutcomes?.asthmaRateAdult !== undefined) {
    score += Math.min(20, (metric.healthOutcomes.asthmaRateAdult / 15) * 20);
    factors++;
  }

  return factors > 0 ? Math.round(score / factors * (100/25)) : 0;
}

// ─── Query Functions ─────────────────────────────────────────────────────────

/**
 * Get environmental health metrics by state
 */
export function getEnvironmentalHealthByState(stateCode: string): EnvironmentalHealthMetric[] {
  return environmentalHealthCache.filter(metric =>
    metric.state.toUpperCase() === stateCode.toUpperCase()
  );
}

/**
 * Get high-risk environmental health areas (top 20% risk score)
 */
export function getHighRiskEnvironmentalAreas(): EnvironmentalHealthMetric[] {
  const sorted = [...environmentalHealthCache].sort((a, b) =>
    (b.environmentalJustice.cumulativeImpactScore || 0) - (a.environmentalJustice.cumulativeImpactScore || 0)
  );

  const topCount = Math.ceil(sorted.length * 0.2);
  return sorted.slice(0, topCount);
}

/**
 * Get environmental health metrics near military installations
 */
export function getEnvironmentalHealthNearMilitary(maxDistanceKm: number = 80): EnvironmentalHealthMetric[] {
  return environmentalHealthCache.filter(metric =>
    metric.proximityToMilitary &&
    metric.proximityToMilitary.distanceKm <= maxDistanceKm
  );
}

/**
 * Get areas with high air pollution
 */
export function getHighAirPollutionAreas(aqiThreshold: number = 100): EnvironmentalHealthMetric[] {
  return environmentalHealthCache.filter(metric =>
    metric.environmentalExposures.airQualityIndex &&
    metric.environmentalExposures.airQualityIndex >= aqiThreshold
  );
}

/**
 * Get areas with high water violations
 */
export function getHighWaterViolationAreas(violationThreshold: number = 0.001): EnvironmentalHealthMetric[] {
  return environmentalHealthCache.filter(metric =>
    metric.environmentalExposures.waterViolationDensity &&
    metric.environmentalExposures.waterViolationDensity >= violationThreshold
  );
}

/**
 * Get environmental justice priority areas (high EJ percentile)
 */
export function getEnvironmentalJusticePriorityAreas(percentileThreshold: number = 80): EnvironmentalHealthMetric[] {
  return environmentalHealthCache.filter(metric =>
    metric.environmentalJustice.ejScreenPercentile &&
    metric.environmentalJustice.ejScreenPercentile >= percentileThreshold
  );
}

/**
 * Get areas near a specific location
 */
export function getEnvironmentalHealthNearLocation(
  lat: number,
  lng: number,
  radiusKm: number = 50
): EnvironmentalHealthMetric[] {
  const { haversineDistance } = require('./geoUtils');

  return environmentalHealthCache.filter(metric => {
    const distance = haversineDistance(lat, lng, metric.lat, metric.lng);
    return distance <= radiusKm;
  });
}

/**
 * Analyze health-environment correlations for a specific area
 */
export function analyzeAreaHealthCorrelations(locationId: string): Array<{
  metric: string;
  correlation: any;
  value: number;
  category: 'health_outcome' | 'environmental_exposure';
}> {
  const metric = environmentalHealthCache.find(m => m.locationId === locationId);
  if (!metric) return [];

  const correlations: Array<{
    metric: string;
    correlation: any;
    value: number;
    category: 'health_outcome' | 'environmental_exposure';
  }> = [];

  // Analyze air quality vs respiratory health
  if (metric.environmentalExposures.airQualityIndex && metric.healthOutcomes.asthmaRateAdult) {
    const correlation = analyzeHealthEnvironmentCorrelation(
      metric.healthOutcomes.asthmaRateAdult,
      metric.environmentalExposures.airQualityIndex / 100,
      'Adult Asthma Rate',
      'Air Quality Index'
    );

    correlations.push({
      metric: 'Air Quality vs Asthma',
      correlation,
      value: metric.healthOutcomes.asthmaRateAdult,
      category: 'health_outcome',
    });
  }

  // Analyze water violations vs gastrointestinal health
  if (metric.environmentalExposures.waterViolationDensity && metric.healthOutcomes.gastrointestinalHospitalizations) {
    const correlation = analyzeHealthEnvironmentCorrelation(
      metric.healthOutcomes.gastrointestinalHospitalizations,
      metric.environmentalExposures.waterViolationDensity * 1000,
      'GI Hospitalizations',
      'Water Violations'
    );

    correlations.push({
      metric: 'Water Violations vs GI Health',
      correlation,
      value: metric.healthOutcomes.gastrointestinalHospitalizations,
      category: 'health_outcome',
    });
  }

  return correlations;
}

/**
 * Get environmental health trends and statistics
 */
export function getEnvironmentalHealthStatistics() {
  const stats = {
    total: environmentalHealthCache.length,
    byState: {} as Record<string, number>,
    byLocationType: {} as Record<string, number>,
    averageLifeExpectancy: 0,
    highRiskAreas: 0, // top 20%
    environmentalJusticeAreas: 0, // >80th percentile
    averageAQI: 0,
    averageWaterViolations: 0,
    topHealthRisks: [] as Array<{ metric: string; average: number; unit: string }>,
    topEnvironmentalRisks: [] as Array<{ metric: string; average: number; unit: string }>,
  };

  let totalLifeExpectancy = 0;
  let lifeExpectancyCount = 0;
  let totalAQI = 0;
  let aqiCount = 0;
  let totalWaterViolations = 0;
  let waterViolationCount = 0;

  // Health outcome accumulators
  let totalAsthmaAdult = 0;
  let asthmaAdultCount = 0;
  let totalAsthmaChild = 0;
  let asthmaChildCount = 0;
  let totalRespHosp = 0;
  let respHospCount = 0;
  let totalGIHosp = 0;
  let giHospCount = 0;

  // Environmental exposure accumulators
  let totalPM25 = 0;
  let pm25Count = 0;
  let totalOzone = 0;
  let ozoneCount = 0;

  environmentalHealthCache.forEach(metric => {
    // Count by state
    stats.byState[metric.state] = (stats.byState[metric.state] || 0) + 1;

    // Count by location type
    stats.byLocationType[metric.locationType] = (stats.byLocationType[metric.locationType] || 0) + 1;

    // Count high risk areas
    if (metric.environmentalJustice.cumulativeImpactScore && metric.environmentalJustice.cumulativeImpactScore >= 80) {
      stats.highRiskAreas++;
    }

    // Count environmental justice areas
    if (metric.environmentalJustice.ejScreenPercentile && metric.environmentalJustice.ejScreenPercentile >= 80) {
      stats.environmentalJusticeAreas++;
    }

    // Accumulate averages
    if (metric.healthOutcomes.lifeExpectancy) {
      totalLifeExpectancy += metric.healthOutcomes.lifeExpectancy;
      lifeExpectancyCount++;
    }

    if (metric.environmentalExposures.airQualityIndex) {
      totalAQI += metric.environmentalExposures.airQualityIndex;
      aqiCount++;
    }

    if (metric.environmentalExposures.waterViolationDensity) {
      totalWaterViolations += metric.environmentalExposures.waterViolationDensity;
      waterViolationCount++;
    }

    // Health outcomes
    if (metric.healthOutcomes.asthmaRateAdult) {
      totalAsthmaAdult += metric.healthOutcomes.asthmaRateAdult;
      asthmaAdultCount++;
    }

    if (metric.healthOutcomes.asthmaRateChild) {
      totalAsthmaChild += metric.healthOutcomes.asthmaRateChild;
      asthmaChildCount++;
    }

    if (metric.healthOutcomes.respiratoryHospitalizations) {
      totalRespHosp += metric.healthOutcomes.respiratoryHospitalizations;
      respHospCount++;
    }

    if (metric.healthOutcomes.gastrointestinalHospitalizations) {
      totalGIHosp += metric.healthOutcomes.gastrointestinalHospitalizations;
      giHospCount++;
    }

    // Environmental exposures
    if (metric.environmentalExposures.pm25Concentration) {
      totalPM25 += metric.environmentalExposures.pm25Concentration;
      pm25Count++;
    }

    if (metric.environmentalExposures.ozoneConcentration) {
      totalOzone += metric.environmentalExposures.ozoneConcentration;
      ozoneCount++;
    }
  });

  // Calculate averages
  stats.averageLifeExpectancy = lifeExpectancyCount > 0 ? Math.round((totalLifeExpectancy / lifeExpectancyCount) * 10) / 10 : 0;
  stats.averageAQI = aqiCount > 0 ? Math.round(totalAQI / aqiCount) : 0;
  stats.averageWaterViolations = waterViolationCount > 0 ? Math.round((totalWaterViolations / waterViolationCount) * 1000000) / 1000000 : 0;

  // Top health risks
  const healthRisks = [
    { metric: 'Adult Asthma Rate', average: asthmaAdultCount > 0 ? Math.round((totalAsthmaAdult / asthmaAdultCount) * 10) / 10 : 0, unit: 'per 100k' },
    { metric: 'Child Asthma Rate', average: asthmaChildCount > 0 ? Math.round((totalAsthmaChild / asthmaChildCount) * 10) / 10 : 0, unit: 'per 100k' },
    { metric: 'Respiratory Hospitalizations', average: respHospCount > 0 ? Math.round((totalRespHosp / respHospCount) * 10) / 10 : 0, unit: 'per 100k' },
    { metric: 'GI Hospitalizations', average: giHospCount > 0 ? Math.round((totalGIHosp / giHospCount) * 10) / 10 : 0, unit: 'per 100k' },
  ].filter(risk => risk.average > 0).sort((a, b) => b.average - a.average);

  stats.topHealthRisks = healthRisks.slice(0, 3);

  // Top environmental risks
  const envRisks = [
    { metric: 'PM2.5 Concentration', average: pm25Count > 0 ? Math.round((totalPM25 / pm25Count) * 10) / 10 : 0, unit: 'μg/m³' },
    { metric: 'Ozone Concentration', average: ozoneCount > 0 ? Math.round((totalOzone / ozoneCount) * 10) / 10 : 0, unit: 'ppb' },
    { metric: 'Air Quality Index', average: stats.averageAQI, unit: 'AQI' },
    { metric: 'Water Violations', average: stats.averageWaterViolations, unit: 'per capita' },
  ].filter(risk => risk.average > 0).sort((a, b) => b.average - a.average);

  stats.topEnvironmentalRisks = envRisks.slice(0, 3);

  return stats;
}

// ─── Export Functions ────────────────────────────────────────────────────────

export {
  ensureEnvironmentalHealthCacheWarmed as ensureWarmed,
  getEnvironmentalHealthCache as getCache,
  setEnvironmentalHealthCache as setCache,
  isEnvironmentalHealthCacheLoaded as isCacheLoaded,
  getEnvironmentalHealthCacheStatus as getCacheStatus,
};