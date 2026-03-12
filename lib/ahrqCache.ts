/**
 * AHRQ (Agency for Healthcare Research and Quality) Cache
 *
 * Comprehensive healthcare quality metrics, patient safety indicators, and clinical outcomes data
 * for military installations, healthcare facilities, and water quality correlation analysis.
 *
 * Data Sources:
 * - Healthcare Cost and Utilization Project (HCUP)
 * - National Quality Measures Clearinghouse
 * - Patient Safety Indicators (PSI)
 * - Quality Indicator modules
 * - Comparative Effectiveness Research
 * - Healthcare disparities data
 *
 * Military Applications:
 * - Military Treatment Facility (MTF) quality benchmarking
 * - Veteran healthcare access and outcomes analysis
 * - Defense health quality assurance programs
 * - Environmental health impact on clinical outcomes
 * - Water contamination correlation with hospital-acquired infections
 * - Readiness-affecting healthcare quality gaps
 */

import { gridKey, loadCacheFromDisk, saveCacheToDisk, neighborKeys } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';

const CACHE_FILE = '.cache/ahrq-data.json';
const BLOB_KEY = 'ahrq-cache';
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

interface AHRQFacility {
  facilityId: string;
  facilityName: string;
  facilityType: 'hospital' | 'ambulatory' | 'nursing_home' | 'rehabilitation' | 'psychiatric' | 'specialty';
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  coordinates: {
    lat: number;
    lng: number;
  };

  // Quality Metrics
  overallQualityRating: number; // 1-5 stars
  patientSafetyRating: number;
  mortalityRating: number;
  readmissionRating: number;
  experienceRating: number;
  effectivenessRating: number;
  timelinessRating: number;
  efficiencyRating: number;

  // Patient Safety Indicators (PSI)
  centralLineInfectionRate: number;
  catheterInfectionRate: number;
  surgicalSiteInfectionRate: number;
  fallsWithInjuryRate: number;
  pressureUlcerRate: number;

  // Clinical Outcomes
  heartAttackMortality: number;
  heartFailureMortality: number;
  pneumoniaMortality: number;
  strokeMortality: number;
  sepsisMortality: number;

  // Readmission Rates
  heartAttackReadmission: number;
  heartFailureReadmission: number;
  pneumoniaReadmission: number;
  copd30DayReadmission: number;
  hipKneeReadmission: number;

  // Military-Specific
  militaryFriendly: boolean;
  veteranServices: boolean;
  tricarAccepted: boolean;
  defenseHealthPartner: boolean;

  // Environmental Correlations
  waterQualityScore: number;
  airQualityIndex: number;
  environmentalRiskFactors: string[];

  // Proximity Analysis
  nearestMilitaryBase: string | null;
  distanceToMilitary: number; // km

  lastUpdated: string;
}

interface AHRQQualityIndicator {
  indicatorId: string;
  indicatorName: string;
  category: 'prevention' | 'inpatient' | 'pediatric' | 'patient_safety' | 'maternal';
  description: string;

  // Geographic Data
  state: string;
  county: string;
  hospitalReferralRegion: string;

  // Performance Metrics
  observedRate: number;
  expectedRate: number;
  riskAdjustedRate: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };

  // Comparative Performance
  nationalBenchmark: number;
  stateAverage: number;
  percentileRank: number;

  // Military Relevance
  militaryRelevanceScore: number; // 0-10
  defenseHealthPriority: boolean;

  // Water Quality Correlation
  waterViolationCorrelation: number; // -1 to 1

  coordinates: {
    lat: number;
    lng: number;
  };

  lastUpdated: string;
}

interface AHRQComparativeEffectiveness {
  studyId: string;
  title: string;
  researchQuestion: string;
  population: string;
  interventions: string[];
  outcomes: string[];

  // Study Design
  studyType: 'systematic_review' | 'rct' | 'observational' | 'registry_study';
  evidenceLevel: string;
  qualityRating: 'high' | 'moderate' | 'low';

  // Military Applications
  militaryApplicability: number; // 0-10
  deploymentRelevance: boolean;
  fieldMedicineApplicable: boolean;

  // Environmental Health
  environmentalFactors: string[];
  waterQualityRelevant: boolean;

  // Key Findings
  effectSize: number;
  statisticalSignificance: boolean;
  clinicalSignificance: string;
  recommendationStrength: 'strong' | 'conditional' | 'insufficient';

  publicationDate: string;
  lastReviewed: string;
}

interface AHRQHospitalAcquiredCondition {
  conditionId: string;
  conditionName: string;
  icd10Codes: string[];

  // Geographic Data
  facilityId: string;
  state: string;
  county: string;
  coordinates: {
    lat: number;
    lng: number;
  };

  // Incidence Data
  observedCases: number;
  expectedCases: number;
  excessCases: number;
  incidenceRate: number; // per 1000 discharges

  // Risk Factors
  patientComplexityIndex: number;
  facilityRiskProfile: string;
  environmentalRiskFactors: string[];

  // Water Quality Correlation
  waterContaminantLevels: {
    bacteria: number;
    chemicals: number;
    disinfectionByproducts: number;
  };
  waterQualityCorrelation: number;

  // Military Impact
  militaryPopulationAffected: number;
  veteranCasePercentage: number;
  readinessImpact: 'high' | 'moderate' | 'low';

  // Prevention Measures
  preventionStrategies: string[];
  interventionEffectiveness: number; // 0-1

  reportingPeriod: string;
  lastUpdated: string;
}

interface AHRQCache {
  facilities: Map<string, AHRQFacility[]>;
  qualityIndicators: Map<string, AHRQQualityIndicator[]>;
  comparativeEffectiveness: AHRQComparativeEffectiveness[];
  hospitalConditions: Map<string, AHRQHospitalAcquiredCondition[]>;
  _lastUpdated: string;
  _buildInProgress: boolean;
  _buildStartedAt: string;
}

let ahrqCache: AHRQCache = {
  facilities: new Map(),
  qualityIndicators: new Map(),
  comparativeEffectiveness: [],
  hospitalConditions: new Map(),
  _lastUpdated: '',
  _buildInProgress: false,
  _buildStartedAt: ''
};

// Build lock management
function isBuildInProgress(): boolean {
  if (!ahrqCache._buildInProgress) return false;

  const buildStartTime = new Date(ahrqCache._buildStartedAt).getTime();
  const now = Date.now();

  // Auto-clear stuck locks after timeout
  if (now - buildStartTime > BUILD_LOCK_TIMEOUT_MS) {
    console.log('AHRQ build lock timeout reached, clearing lock');
    ahrqCache._buildInProgress = false;
    ahrqCache._buildStartedAt = '';
    return false;
  }

  return true;
}

// Cache warming and persistence
export async function ensureWarmed(): Promise<void> {
  if (ahrqCache.facilities.size === 0) {
    await loadCacheFromDisk(ahrqCache, CACHE_FILE);

    if (ahrqCache.facilities.size === 0) {
      await loadCacheFromBlob(ahrqCache, BLOB_KEY);
    }
  }
}

// Geographic queries
export async function getAHRQFacilitiesByLocation(lat: number, lng: number, radius: number = 50): Promise<AHRQFacility[]> {
  await ensureWarmed();

  const centerGrid = gridKey(lat, lng);
  const searchGrids = [centerGrid, ...neighborKeys(lat, lng, Math.ceil(radius / 11.1))];

  const facilities: AHRQFacility[] = [];

  for (const grid of searchGrids) {
    const gridFacilities = ahrqCache.facilities.get(grid) || [];

    for (const facility of gridFacilities) {
      const distance = haversineDistance(lat, lng, facility.coordinates.lat, facility.coordinates.lng);
      if (distance <= radius) {
        facilities.push(facility);
      }
    }
  }

  return facilities.sort((a, b) => {
    const distA = haversineDistance(lat, lng, a.coordinates.lat, a.coordinates.lng);
    const distB = haversineDistance(lat, lng, b.coordinates.lat, b.coordinates.lng);
    return distA - distB;
  });
}

export async function getQualityIndicatorsByState(state: string): Promise<AHRQQualityIndicator[]> {
  await ensureWarmed();

  const stateData: AHRQQualityIndicator[] = [];

  for (const [grid, indicators] of ahrqCache.qualityIndicators) {
    for (const indicator of indicators) {
      if (indicator.state.toLowerCase() === state.toLowerCase()) {
        stateData.push(indicator);
      }
    }
  }

  return stateData.sort((a, b) => b.militaryRelevanceScore - a.militaryRelevanceScore);
}

export async function getMilitaryFriendlyFacilities(): Promise<AHRQFacility[]> {
  await ensureWarmed();

  const militaryFacilities: AHRQFacility[] = [];

  for (const [grid, facilities] of ahrqCache.facilities) {
    for (const facility of facilities) {
      if (facility.militaryFriendly || facility.veteranServices || facility.tricarAccepted) {
        militaryFacilities.push(facility);
      }
    }
  }

  return militaryFacilities.sort((a, b) => b.overallQualityRating - a.overallQualityRating);
}

export async function getHospitalConditionsByWaterQuality(minCorrelation: number = 0.3): Promise<AHRQHospitalAcquiredCondition[]> {
  await ensureWarmed();

  const correlatedConditions: AHRQHospitalAcquiredCondition[] = [];

  for (const [grid, conditions] of ahrqCache.hospitalConditions) {
    for (const condition of conditions) {
      if (Math.abs(condition.waterQualityCorrelation) >= minCorrelation) {
        correlatedConditions.push(condition);
      }
    }
  }

  return correlatedConditions.sort((a, b) =>
    Math.abs(b.waterQualityCorrelation) - Math.abs(a.waterQualityCorrelation)
  );
}

// Comparative effectiveness research queries
export async function getComparativeEffectivenessResearch(
  militaryRelevant: boolean = false,
  environmentalHealth: boolean = false
): Promise<AHRQComparativeEffectiveness[]> {
  await ensureWarmed();

  let research = ahrqCache.comparativeEffectiveness;

  if (militaryRelevant) {
    research = research.filter(study => study.militaryApplicability >= 7 || study.deploymentRelevance);
  }

  if (environmentalHealth) {
    research = research.filter(study =>
      study.environmentalFactors.length > 0 || study.waterQualityRelevant
    );
  }

  return research.sort((a, b) => {
    if (a.qualityRating !== b.qualityRating) {
      const qualityOrder = { 'high': 3, 'moderate': 2, 'low': 1 };
      return qualityOrder[b.qualityRating] - qualityOrder[a.qualityRating];
    }
    return b.militaryApplicability - a.militaryApplicability;
  });
}

// Quality analytics
export async function calculateQualityTrends(state?: string): Promise<{
  overallTrend: number;
  patientSafetyTrend: number;
  mortalityTrend: number;
  readmissionTrend: number;
  militaryFacilityPerformance: number;
  waterQualityImpact: number;
}> {
  await ensureWarmed();

  let facilities: AHRQFacility[] = [];

  if (state) {
    for (const [grid, gridFacilities] of ahrqCache.facilities) {
      facilities.push(...gridFacilities.filter(f => f.state.toLowerCase() === state.toLowerCase()));
    }
  } else {
    for (const [grid, gridFacilities] of ahrqCache.facilities) {
      facilities.push(...gridFacilities);
    }
  }

  if (facilities.length === 0) {
    return {
      overallTrend: 0,
      patientSafetyTrend: 0,
      mortalityTrend: 0,
      readmissionTrend: 0,
      militaryFacilityPerformance: 0,
      waterQualityImpact: 0
    };
  }

  // Calculate averages
  const avgOverall = facilities.reduce((sum, f) => sum + f.overallQualityRating, 0) / facilities.length;
  const avgSafety = facilities.reduce((sum, f) => sum + f.patientSafetyRating, 0) / facilities.length;
  const avgMortality = facilities.reduce((sum, f) => sum + f.mortalityRating, 0) / facilities.length;
  const avgReadmission = facilities.reduce((sum, f) => sum + f.readmissionRating, 0) / facilities.length;

  // Military facility performance
  const militaryFacilities = facilities.filter(f => f.militaryFriendly || f.veteranServices);
  const militaryAvgQuality = militaryFacilities.length > 0
    ? militaryFacilities.reduce((sum, f) => sum + f.overallQualityRating, 0) / militaryFacilities.length
    : 0;

  // Water quality correlation
  const waterCorrelation = facilities.reduce((sum, f) => sum + f.waterQualityScore, 0) / facilities.length;

  return {
    overallTrend: avgOverall,
    patientSafetyTrend: avgSafety,
    mortalityTrend: avgMortality,
    readmissionTrend: avgReadmission,
    militaryFacilityPerformance: militaryAvgQuality,
    waterQualityImpact: waterCorrelation
  };
}

// Cache management
export async function setAHRQCache(
  facilities: AHRQFacility[],
  qualityIndicators: AHRQQualityIndicator[],
  comparativeEffectiveness: AHRQComparativeEffectiveness[],
  hospitalConditions: AHRQHospitalAcquiredCondition[]
): Promise<void> {
  // Set build lock
  ahrqCache._buildInProgress = true;
  ahrqCache._buildStartedAt = new Date().toISOString();

  try {
    // Clear existing cache
    ahrqCache.facilities.clear();
    ahrqCache.qualityIndicators.clear();
    ahrqCache.hospitalConditions.clear();
    ahrqCache.comparativeEffectiveness = [];

    // Grid-index facilities
    for (const facility of facilities) {
      const grid = gridKey(facility.coordinates.lat, facility.coordinates.lng);
      if (!ahrqCache.facilities.has(grid)) {
        ahrqCache.facilities.set(grid, []);
      }
      ahrqCache.facilities.get(grid)!.push(facility);
    }

    // Grid-index quality indicators
    for (const indicator of qualityIndicators) {
      const grid = gridKey(indicator.coordinates.lat, indicator.coordinates.lng);
      if (!ahrqCache.qualityIndicators.has(grid)) {
        ahrqCache.qualityIndicators.set(grid, []);
      }
      ahrqCache.qualityIndicators.get(grid)!.push(indicator);
    }

    // Grid-index hospital conditions
    for (const condition of hospitalConditions) {
      const grid = gridKey(condition.coordinates.lat, condition.coordinates.lng);
      if (!ahrqCache.hospitalConditions.has(grid)) {
        ahrqCache.hospitalConditions.set(grid, []);
      }
      ahrqCache.hospitalConditions.get(grid)!.push(condition);
    }

    // Store comparative effectiveness research
    ahrqCache.comparativeEffectiveness = comparativeEffectiveness;

    // Update metadata
    ahrqCache._lastUpdated = new Date().toISOString();

    // Persist to disk and blob
    await saveCacheToDisk(ahrqCache, CACHE_FILE);
    await saveCacheToBlob(ahrqCache, BLOB_KEY);

  } finally {
    // Clear build lock
    ahrqCache._buildInProgress = false;
    ahrqCache._buildStartedAt = '';
  }
}

export function getAHRQCacheInfo(): {
  facilityCount: number;
  qualityIndicatorCount: number;
  researchStudyCount: number;
  hospitalConditionCount: number;
  lastUpdated: string;
  isBuilding: boolean;
} {
  let facilityCount = 0;
  let qualityIndicatorCount = 0;
  let hospitalConditionCount = 0;

  for (const facilities of ahrqCache.facilities.values()) {
    facilityCount += facilities.length;
  }

  for (const indicators of ahrqCache.qualityIndicators.values()) {
    qualityIndicatorCount += indicators.length;
  }

  for (const conditions of ahrqCache.hospitalConditions.values()) {
    hospitalConditionCount += conditions.length;
  }

  return {
    facilityCount,
    qualityIndicatorCount,
    researchStudyCount: ahrqCache.comparativeEffectiveness.length,
    hospitalConditionCount,
    lastUpdated: ahrqCache._lastUpdated,
    isBuilding: isBuildInProgress()
  };
}

// Utility function for distance calculations
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}