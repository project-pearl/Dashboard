/**
 * HRSA (Health Resources and Services Administration) Cache
 *
 * Comprehensive health workforce, provider shortage, and healthcare access data
 * for military installations, rural communities, and underserved populations.
 *
 * Data Sources:
 * - Health Professional Shortage Areas (HPSA)
 * - Medically Underserved Areas/Populations (MUA/MUP)
 * - National Health Service Corps (NHSC)
 * - Health Workforce Data Warehouse
 * - Area Health Resources Files (AHRF)
 * - Rural Health Grants
 * - Community Health Centers
 *
 * Military Applications:
 * - Military base healthcare access assessment
 * - Deployment readiness workforce planning
 * - Rural military installation healthcare gaps
 * - Veteran population health access analysis
 * - Defense community health infrastructure
 * - Emergency medical response capacity
 * - Military spouse healthcare employment tracking
 */

import { gridKey, loadCacheFromDisk, saveCacheToDisk, neighborKeys } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';

const CACHE_FILE = '.cache/hrsa-data.json';
const BLOB_KEY = 'hrsa-cache';
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

interface HPSADesignation {
  hpsaId: string;
  hpsaType: 'primary_care' | 'dental' | 'mental_health';
  facilityType: 'geographic' | 'population' | 'facility';

  // Geographic Data
  state: string;
  county: string;
  geoCode: string;
  serviceName: string;
  commonStateName: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Shortage Metrics
  currentProviders: number;
  providersNeeded: number;
  shortagePercent: number;
  populationToProviderRatio: number;

  // Demographics
  totalPopulation: number;
  highNeedPopulation: number;
  lowIncomePercentage: number;
  elderlyPercentage: number;
  infantMortalityRate: number;

  // Rural/Urban Classification
  ruralStatus: 'rural' | 'urban' | 'frontier';
  rucaCode: string; // Rural-Urban Commuting Area

  // Military Impact
  militaryPopulation: number;
  veteranPopulation: number;
  militaryFamilyPercentage: number;
  nearestMilitaryBase: string | null;
  distanceToMilitary: number; // km

  // Water Quality Correlation
  waterViolationRate: number;
  environmentalHealthRisk: 'low' | 'moderate' | 'high';

  designationDate: string;
  lastUpdated: string;
}

interface CommunityHealthCenter {
  granteeId: string;
  organizationName: string;
  granteeType: 'community_health_center' | 'migrant_health' | 'homeless_health' | 'public_housing';

  // Location Data
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Service Delivery
  totalSites: number;
  servicePopulation: number;
  patientVisits: number;
  fullTimeProviders: number;
  partTimeProviders: number;

  // Demographics Served
  patientsTotal: number;
  patientsUninsured: number;
  patientsMedicaid: number;
  patientsMedicare: number;
  patientsRacialMinority: number;
  patientsBelowPoverty: number;
  patientsRural: number;
  patientsHomeless: number;
  patientsMigrant: number;

  // Clinical Services
  primaryCareServices: boolean;
  dentalServices: boolean;
  mentalHealthServices: boolean;
  substanceAbuseServices: boolean;
  pharmacyServices: boolean;
  visionServices: boolean;

  // Quality Metrics
  diabetesControlRate: number;
  hypertensionControlRate: number;
  cervicalCancerScreeningRate: number;
  colorectalCancerScreeningRate: number;
  depressionScreeningRate: number;

  // Military Connections
  veteranPatients: number;
  militaryFamilyPatients: number;
  defenseHealthPartner: boolean;

  // Environmental Health
  environmentalHealthPrograms: string[];
  waterQualityMonitoring: boolean;

  // Funding
  federalAward: number;
  totalOperatingRevenue: number;
  operatingCostPerPatient: number;

  awardYear: number;
  lastUpdated: string;
}

interface HealthWorkforceProvider {
  npi: string;
  providerType: 'physician' | 'nurse_practitioner' | 'physician_assistant' | 'dentist' | 'psychologist' | 'social_worker';
  specialty: string;

  // Practice Location
  practiceAddress: string;
  practiceCity: string;
  practiceState: string;
  practiceZip: string;
  practiceCounty: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Practice Characteristics
  practiceType: 'private' | 'group' | 'hospital' | 'clinic' | 'military' | 'va' | 'federal';
  ruralProvider: boolean;
  underservedAreaProvider: boolean;
  hpsaProvider: boolean;

  // National Health Service Corps
  nhscParticipant: boolean;
  nhscSite: string | null;
  loanRepaymentParticipant: boolean;
  scholarshipRecipient: boolean;

  // Military Connections
  militaryProvider: boolean;
  veteranProvider: boolean;
  tricarePaneled: boolean;
  militarySpouse: boolean;

  // Demographics
  gender: 'M' | 'F';
  graduationYear: number;
  medicalSchool: string;
  residencyProgram: string;

  // Capacity
  newPatientsAccepted: boolean;
  languagesSpoken: string[];
  telemedicineProvided: boolean;

  // Quality Indicators
  boardCertified: boolean;
  qualityMeasures: {
    patientSatisfaction: number;
    clinicalOutcomes: number;
    safetyRecord: number;
  };

  lastUpdated: string;
}

interface RuralHealthGrant {
  grantId: string;
  programName: string;
  grantType: 'rural_health_clinic' | 'critical_access_hospital' | 'telehealth' | 'workforce_development';

  // Recipient Information
  recipientOrganization: string;
  recipientAddress: string;
  recipientCity: string;
  recipientState: string;
  recipientZip: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Grant Details
  awardAmount: number;
  projectPeriod: {
    startDate: string;
    endDate: string;
  };
  projectTitle: string;
  projectDescription: string;

  // Service Area
  serviceStates: string[];
  serviceCounties: string[];
  populationServed: number;
  ruralPopulationServed: number;

  // Military Relevance
  militaryInstallationProximity: number; // km to nearest base
  militaryFamiliesServed: number;
  veteransServed: number;
  defenseCommunityImpact: 'high' | 'moderate' | 'low';

  // Health Outcomes
  healthImprovementGoals: string[];
  performanceMetrics: {
    metric: string;
    baseline: number;
    target: number;
    current: number;
  }[];

  // Innovation Focus
  telemedicineComponent: boolean;
  workforceTraining: boolean;
  equipmentPurchase: boolean;
  infrastructureImprovement: boolean;

  lastUpdated: string;
}

interface MedicallyUnderservedArea {
  muaId: string;
  areaName: string;
  muaType: 'geographic' | 'population_group';

  // Geographic Data
  state: string;
  county: string;
  censusTracts: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Underservice Metrics
  imuScore: number; // Index of Medical Underservice (0-100)
  primaryCarePhysicianRatio: number;
  infantMortalityRate: number;
  povertyRate: number;
  elderlyPopulationRate: number;

  // Population Demographics
  totalPopulation: number;
  ruralPopulation: number;
  urbanPopulation: number;
  minorityPopulation: number;
  lowIncomePopulation: number;

  // Health Infrastructure
  hospitalsInArea: number;
  clinicsInArea: number;
  pharmaciesInArea: number;
  emergencyServicesAvailable: boolean;

  // Military Impact
  militaryInstallationInArea: boolean;
  militaryPopulation: number;
  veteranPopulation: number;
  dependentPopulation: number;

  // Environmental Factors
  waterQualityIssues: boolean;
  airQualityIssues: boolean;
  environmentalHealthHazards: string[];

  // Access Barriers
  transportationBarriers: string[];
  languageBarriers: string[];
  culturalBarriers: string[];

  designationDate: string;
  lastReview: string;
}

interface HRSACache {
  hpsaDesignations: Map<string, HPSADesignation[]>;
  healthCenters: Map<string, CommunityHealthCenter[]>;
  workforceProviders: Map<string, HealthWorkforceProvider[]>;
  ruralGrants: Map<string, RuralHealthGrant[]>;
  underservedAreas: Map<string, MedicallyUnderservedArea[]>;
  _lastUpdated: string;
  _buildInProgress: boolean;
  _buildStartedAt: string;
}

let hrsaCache: HRSACache = {
  hpsaDesignations: new Map(),
  healthCenters: new Map(),
  workforceProviders: new Map(),
  ruralGrants: new Map(),
  underservedAreas: new Map(),
  _lastUpdated: '',
  _buildInProgress: false,
  _buildStartedAt: ''
};

// Build lock management
function isBuildInProgress(): boolean {
  if (!hrsaCache._buildInProgress) return false;

  const buildStartTime = new Date(hrsaCache._buildStartedAt).getTime();
  const now = Date.now();

  if (now - buildStartTime > BUILD_LOCK_TIMEOUT_MS) {
    console.log('HRSA build lock timeout reached, clearing lock');
    hrsaCache._buildInProgress = false;
    hrsaCache._buildStartedAt = '';
    return false;
  }

  return true;
}

// Cache warming
export async function ensureWarmed(): Promise<void> {
  if (hrsaCache.hpsaDesignations.size === 0) {
    const diskData = loadCacheFromDisk<HRSACache>(CACHE_FILE);
    if (diskData) Object.assign(hrsaCache, diskData);

    if (hrsaCache.hpsaDesignations.size === 0) {
      const blobData = await loadCacheFromBlob<HRSACache>(BLOB_KEY);
      if (blobData) Object.assign(hrsaCache, blobData);
    }
  }
}

// Geographic queries
export async function getHPSAsByLocation(lat: number, lng: number, radius: number = 50): Promise<HPSADesignation[]> {
  await ensureWarmed();

  const centerGrid = gridKey(lat, lng);
  const searchGrids = [centerGrid, ...neighborKeys(lat, lng)];

  const designations: HPSADesignation[] = [];

  for (const grid of searchGrids) {
    const gridDesignations = hrsaCache.hpsaDesignations.get(grid) || [];

    for (const designation of gridDesignations) {
      const distance = haversineDistance(lat, lng, designation.coordinates.lat, designation.coordinates.lng);
      if (distance <= radius) {
        designations.push(designation);
      }
    }
  }

  return designations.sort((a, b) => b.shortagePercent - a.shortagePercent);
}

export async function getMilitaryProximityHealthCenters(maxDistance: number = 25): Promise<CommunityHealthCenter[]> {
  await ensureWarmed();

  const militaryProximityCenters: CommunityHealthCenter[] = [];

  for (const [grid, centers] of hrsaCache.healthCenters) {
    for (const center of centers) {
      if (center.veteranPatients > 0 || center.militaryFamilyPatients > 0 || center.defenseHealthPartner) {
        militaryProximityCenters.push(center);
      }
    }
  }

  return militaryProximityCenters.sort((a, b) =>
    (b.veteranPatients + b.militaryFamilyPatients) - (a.veteranPatients + a.militaryFamilyPatients)
  );
}

export async function getProvidersBySpecialty(
  specialty: string,
  militaryConnected: boolean = false,
  state?: string
): Promise<HealthWorkforceProvider[]> {
  await ensureWarmed();

  const providers: HealthWorkforceProvider[] = [];

  for (const [grid, gridProviders] of hrsaCache.workforceProviders) {
    for (const provider of gridProviders) {
      if (provider.specialty.toLowerCase().includes(specialty.toLowerCase())) {
        if (state && provider.practiceState.toLowerCase() !== state.toLowerCase()) {
          continue;
        }

        if (militaryConnected && !(provider.militaryProvider || provider.veteranProvider || provider.tricarePaneled || provider.militarySpouse)) {
          continue;
        }

        providers.push(provider);
      }
    }
  }

  return providers.sort((a, b) => {
    // Prioritize military connections
    const aMilitary = (a.militaryProvider ? 3 : 0) + (a.veteranProvider ? 2 : 0) + (a.tricarePaneled ? 1 : 0);
    const bMilitary = (b.militaryProvider ? 3 : 0) + (b.veteranProvider ? 2 : 0) + (b.tricarePaneled ? 1 : 0);

    if (aMilitary !== bMilitary) {
      return bMilitary - aMilitary;
    }

    // Then by quality metrics
    return b.qualityMeasures.patientSatisfaction - a.qualityMeasures.patientSatisfaction;
  });
}

export async function getRuralHealthGrants(
  militaryRelevant: boolean = false,
  state?: string
): Promise<RuralHealthGrant[]> {
  await ensureWarmed();

  let grants: RuralHealthGrant[] = [];

  for (const [grid, gridGrants] of hrsaCache.ruralGrants) {
    grants.push(...gridGrants);
  }

  if (state) {
    grants = grants.filter(grant => grant.recipientState.toLowerCase() === state.toLowerCase());
  }

  if (militaryRelevant) {
    grants = grants.filter(grant =>
      grant.militaryFamiliesServed > 0 ||
      grant.veteransServed > 0 ||
      grant.defenseCommunityImpact === 'high'
    );
  }

  return grants.sort((a, b) => b.awardAmount - a.awardAmount);
}

// Analytics functions
export async function calculateHealthAccessGaps(state?: string): Promise<{
  criticalShortageAreas: number;
  totalPopulationUnderserved: number;
  primaryCareGap: number;
  dentalCareGap: number;
  mentalHealthGap: number;
  militaryPopulationImpacted: number;
  ruralPopulationImpacted: number;
}> {
  await ensureWarmed();

  let designations: HPSADesignation[] = [];
  let underservedAreas: MedicallyUnderservedArea[] = [];

  if (state) {
    for (const [grid, gridDesignations] of hrsaCache.hpsaDesignations) {
      designations.push(...gridDesignations.filter(d => d.state.toLowerCase() === state.toLowerCase()));
    }
    for (const [grid, gridAreas] of hrsaCache.underservedAreas) {
      underservedAreas.push(...gridAreas.filter(a => a.state.toLowerCase() === state.toLowerCase()));
    }
  } else {
    for (const [grid, gridDesignations] of hrsaCache.hpsaDesignations) {
      designations.push(...gridDesignations);
    }
    for (const [grid, gridAreas] of hrsaCache.underservedAreas) {
      underservedAreas.push(...gridAreas);
    }
  }

  const criticalShortageAreas = designations.filter(d => d.shortagePercent >= 75).length;
  const totalPopulationUnderserved = underservedAreas.reduce((sum, area) => sum + area.totalPopulation, 0);

  const primaryCareDesignations = designations.filter(d => d.hpsaType === 'primary_care');
  const dentalDesignations = designations.filter(d => d.hpsaType === 'dental');
  const mentalHealthDesignations = designations.filter(d => d.hpsaType === 'mental_health');

  const primaryCareGap = primaryCareDesignations.reduce((sum, d) => sum + d.providersNeeded, 0);
  const dentalCareGap = dentalDesignations.reduce((sum, d) => sum + d.providersNeeded, 0);
  const mentalHealthGap = mentalHealthDesignations.reduce((sum, d) => sum + d.providersNeeded, 0);

  const militaryPopulationImpacted = designations.reduce((sum, d) => sum + d.militaryPopulation, 0);
  const ruralPopulationImpacted = underservedAreas
    .filter(a => a.ruralPopulation > 0)
    .reduce((sum, a) => sum + a.ruralPopulation, 0);

  return {
    criticalShortageAreas,
    totalPopulationUnderserved,
    primaryCareGap,
    dentalCareGap,
    mentalHealthGap,
    militaryPopulationImpacted,
    ruralPopulationImpacted
  };
}

export async function calculateNHSCImpact(): Promise<{
  totalNHSCProviders: number;
  militaryConnectedProviders: number;
  loansRepaid: number;
  scholarshipsAwarded: number;
  underservedPopulationServed: number;
  averageDebtReduction: number;
}> {
  await ensureWarmed();

  const nhscProviders: HealthWorkforceProvider[] = [];

  for (const [grid, providers] of hrsaCache.workforceProviders) {
    nhscProviders.push(...providers.filter(p => p.nhscParticipant));
  }

  const militaryConnectedProviders = nhscProviders.filter(p =>
    p.militaryProvider || p.veteranProvider || p.militarySpouse
  ).length;

  const loanParticipants = nhscProviders.filter(p => p.loanRepaymentParticipant).length;
  const scholarshipRecipients = nhscProviders.filter(p => p.scholarshipRecipient).length;

  // Estimated population served (assumption: each provider serves ~2000 patients annually)
  const underservedPopulationServed = nhscProviders.length * 2000;

  return {
    totalNHSCProviders: nhscProviders.length,
    militaryConnectedProviders,
    loansRepaid: loanParticipants,
    scholarshipsAwarded: scholarshipRecipients,
    underservedPopulationServed,
    averageDebtReduction: 50000 // Average loan repayment amount
  };
}

// Cache management
export async function setHRSACache(
  hpsaDesignations: HPSADesignation[],
  healthCenters: CommunityHealthCenter[],
  workforceProviders: HealthWorkforceProvider[],
  ruralGrants: RuralHealthGrant[],
  underservedAreas: MedicallyUnderservedArea[]
): Promise<void> {
  hrsaCache._buildInProgress = true;
  hrsaCache._buildStartedAt = new Date().toISOString();

  try {
    // Clear existing cache
    hrsaCache.hpsaDesignations.clear();
    hrsaCache.healthCenters.clear();
    hrsaCache.workforceProviders.clear();
    hrsaCache.ruralGrants.clear();
    hrsaCache.underservedAreas.clear();

    // Grid-index all data types
    for (const designation of hpsaDesignations) {
      const grid = gridKey(designation.coordinates.lat, designation.coordinates.lng);
      if (!hrsaCache.hpsaDesignations.has(grid)) {
        hrsaCache.hpsaDesignations.set(grid, []);
      }
      hrsaCache.hpsaDesignations.get(grid)!.push(designation);
    }

    for (const center of healthCenters) {
      const grid = gridKey(center.coordinates.lat, center.coordinates.lng);
      if (!hrsaCache.healthCenters.has(grid)) {
        hrsaCache.healthCenters.set(grid, []);
      }
      hrsaCache.healthCenters.get(grid)!.push(center);
    }

    for (const provider of workforceProviders) {
      const grid = gridKey(provider.coordinates.lat, provider.coordinates.lng);
      if (!hrsaCache.workforceProviders.has(grid)) {
        hrsaCache.workforceProviders.set(grid, []);
      }
      hrsaCache.workforceProviders.get(grid)!.push(provider);
    }

    for (const grant of ruralGrants) {
      const grid = gridKey(grant.coordinates.lat, grant.coordinates.lng);
      if (!hrsaCache.ruralGrants.has(grid)) {
        hrsaCache.ruralGrants.set(grid, []);
      }
      hrsaCache.ruralGrants.get(grid)!.push(grant);
    }

    for (const area of underservedAreas) {
      const grid = gridKey(area.coordinates.lat, area.coordinates.lng);
      if (!hrsaCache.underservedAreas.has(grid)) {
        hrsaCache.underservedAreas.set(grid, []);
      }
      hrsaCache.underservedAreas.get(grid)!.push(area);
    }

    hrsaCache._lastUpdated = new Date().toISOString();

    saveCacheToDisk(CACHE_FILE, hrsaCache);
    await saveCacheToBlob(BLOB_KEY, hrsaCache);

  } finally {
    hrsaCache._buildInProgress = false;
    hrsaCache._buildStartedAt = '';
  }
}

export function getHRSACacheInfo(): {
  hpsaCount: number;
  healthCenterCount: number;
  providerCount: number;
  grantCount: number;
  underservedAreaCount: number;
  lastUpdated: string;
  isBuilding: boolean;
} {
  let hpsaCount = 0;
  let healthCenterCount = 0;
  let providerCount = 0;
  let grantCount = 0;
  let underservedAreaCount = 0;

  for (const designations of hrsaCache.hpsaDesignations.values()) {
    hpsaCount += designations.length;
  }

  for (const centers of hrsaCache.healthCenters.values()) {
    healthCenterCount += centers.length;
  }

  for (const providers of hrsaCache.workforceProviders.values()) {
    providerCount += providers.length;
  }

  for (const grants of hrsaCache.ruralGrants.values()) {
    grantCount += grants.length;
  }

  for (const areas of hrsaCache.underservedAreas.values()) {
    underservedAreaCount += areas.length;
  }

  return {
    hpsaCount,
    healthCenterCount,
    providerCount,
    grantCount,
    underservedAreaCount,
    lastUpdated: hrsaCache._lastUpdated,
    isBuilding: isBuildInProgress()
  };
}

// Utility function
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}