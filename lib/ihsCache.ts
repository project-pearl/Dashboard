/**
 * IHS (Indian Health Service) Cache
 *
 * Comprehensive tribal health data, service delivery, and health outcomes for
 * American Indian and Alaska Native populations, including military service members.
 *
 * Data Sources:
 * - IHS Service Units and Facilities
 * - Tribal Health Programs
 * - Contract Health Services (CHS)
 * - Government Performance and Results Act (GPRA)
 * - Resource and Patient Management System (RPMS)
 * - Tribal Self-Determination programs
 * - Urban Indian Health Programs
 *
 * Military Applications:
 * - Native American military service member health tracking
 * - Tribal land military installation coordination
 * - Veteran reintegration in tribal communities
 * - Cultural competency in military healthcare
 * - Traditional healing integration with military medicine
 * - Environmental health on tribal lands near military bases
 * - Emergency response coordination in tribal areas
 */

import { gridKey, loadCacheFromDisk, saveCacheToDisk, neighborKeys } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';

const CACHE_FILE = '.cache/ihs-data.json';
const BLOB_KEY = 'ihs-cache';
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

interface IHSServiceUnit {
  serviceUnitId: string;
  serviceUnitName: string;
  area: string; // IHS Area (e.g., Alaska, Albuquerque, Bemidji, etc.)

  // Geographic Data
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  tribalLands: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Service Delivery
  servicePopulation: number;
  registeredUsers: number;
  activePatients: number;
  annualVisits: number;

  // Facilities
  hospitalFacilities: number;
  healthCenterFacilities: number;
  healthStationFacilities: number;
  alaskaVillageClinics: number;

  // Staffing
  physicians: number;
  nurses: number;
  dentists: number;
  mentalHealthProviders: number;
  communityHealthRepresentatives: number;
  traditionalHealers: number;

  // Health Programs
  diabetesProgram: boolean;
  elderCareProgram: boolean;
  maternalChildHealthProgram: boolean;
  mentalHealthProgram: boolean;
  substanceAbuseProgram: boolean;
  environmentalHealthProgram: boolean;

  // Military Connections
  nativeVeteransServed: number;
  militaryServiceMembersServed: number;
  veteranHealthcarePartnership: boolean;
  militaryFamiliesInTribalCommunity: number;

  // Cultural Services
  traditionalHealingPrograms: boolean;
  culturalCompetencyTraining: boolean;
  nativeLanguageServices: boolean;
  ceremonialAccommodations: boolean;

  // Environmental Health
  waterQualityMonitoring: boolean;
  environmentalHealthSpecialists: number;
  waterSystemCompliance: number; // percentage
  wasteManagementPrograms: boolean;

  lastUpdated: string;
}

interface TribalHealthProgram {
  programId: string;
  programName: string;
  programType: 'direct_service' | 'tribal_638' | 'urban_indian' | 'special_diabetes';
  tribe: string;
  tribalNation: string;

  // Location
  address: string;
  city: string;
  state: string;
  zipCode: string;
  serviceArea: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Program Details
  contractType: 'self_determination' | 'self_governance' | 'direct_service' | 'urban';
  annualFunding: number;
  federalFiscalYear: number;

  // Service Delivery
  eligiblePopulation: number;
  activeUsers: number;
  totalEncounters: number;
  primaryCareVisits: number;
  specialtyReferrals: number;

  // Health Services
  primaryCarePoviders: number;
  behavioralHealthProviders: number;
  dentalProviders: number;
  pharmacyServices: boolean;
  laboratoryServices: boolean;
  radiologyServices: boolean;

  // Special Programs
  diabetesPrevention: boolean;
  elderCare: boolean;
  maternalHealth: boolean;
  schoolHealthPrograms: boolean;
  environmentalHealth: boolean;

  // Cultural Integration
  traditionalMedicineIntegration: boolean;
  culturalHealingPractices: boolean;
  languagePreservation: boolean;
  spiritualCareServices: boolean;

  // Military Community
  veteranTribalMembers: number;
  activeMillitaryTribalMembers: number;
  militaryPartnership: boolean;
  veteranReintegrationServices: boolean;

  // Health Outcomes
  diabetesPrevalence: number;
  hypertensionPrevalence: number;
  obesityRate: number;
  substanceAbuseRate: number;
  mentalHealthDisorderRate: number;
  infantMortalityRate: number;

  lastUpdated: string;
}

interface UrbanIndianHealthProgram {
  programId: string;
  organizationName: string;

  // Location Data
  address: string;
  city: string;
  state: string;
  zipCode: string;
  metropolitanArea: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Program Characteristics
  title5Status: boolean; // Title V of Indian Health Care Improvement Act
  ihsFunding: number;
  otherFunding: number;
  totalBudget: number;

  // Population Served
  eligibleNativeAmericans: number;
  activePatients: number;
  newPatientsAnnually: number;
  tribesRepresented: string[];

  // Services Provided
  primaryMedicalCare: boolean;
  dentalCare: boolean;
  mentalHealthServices: boolean;
  substanceAbuseServices: boolean;
  communityHealthEducation: boolean;
  traditionalHealingServices: boolean;

  // Staffing
  medicalProviders: number;
  communityHealthWorkers: number;
  culturalLiaisons: number;
  administrativeStaff: number;

  // Military Community Integration
  nativeVeteransPatients: number;
  militaryFamiliesServed: number;
  veteranOutreachPrograms: boolean;
  militaryHospitalPartnerships: string[];

  // Cultural Programs
  culturalActivities: boolean;
  languagePrograms: boolean;
  elderPrograms: boolean;
  youthPrograms: boolean;

  // Community Health
  diabetesEducation: boolean;
  cardiovascularHealthPrograms: boolean;
  maternalChildHealthServices: boolean;
  cancerScreeningPrograms: boolean;

  lastUpdated: string;
}

interface TribalHealthOutcome {
  outcomeId: string;
  tribe: string;
  serviceUnit: string;
  area: string;

  // Demographics
  totalPopulation: number;
  servicePopulation: number;
  ageGroups: {
    under18: number;
    age18to64: number;
    age65plus: number;
  };

  coordinates: {
    lat: number;
    lng: number;
  };

  // Health Indicators
  lifeExpectancy: number;
  infantMortalityRate: number;
  maternalMortalityRate: number;
  cancerIncidenceRate: number;
  heartDiseaseRate: number;
  diabetesRate: number;

  // Behavioral Health
  suicideRate: number;
  substanceAbuseRate: number;
  mentalHealthDisorderPrevalence: number;
  traumaPrevalence: number;

  // Preventive Care
  immunizationRates: {
    children: number;
    adults: number;
    elderly: number;
  };

  cancerScreeningRates: {
    cervical: number;
    breast: number;
    colorectal: number;
  };

  // Military Health Integration
  militaryHealthCareUtilization: number;
  veteranHealthOutcomes: {
    ptsdRate: number;
    tbinTraumaRate: number;
    substanceAbuseRate: number;
    suicideRate: number;
  };

  // Environmental Health
  environmentalExposureRisks: string[];
  waterQualityScore: number;
  airQualityScore: number;
  soilContaminationRisk: number;

  // Social Determinants
  povertyRate: number;
  educationAttainment: number;
  unemploymentRate: number;
  housingQuality: number;
  foodSecurity: number;

  reportingYear: number;
  lastUpdated: string;
}

interface ContractHealthService {
  chsId: string;
  serviceUnit: string;
  area: string;

  // Provider Information
  providerName: string;
  providerType: 'hospital' | 'specialist' | 'clinic' | 'emergency' | 'pharmacy';
  address: string;
  city: string;
  state: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Contract Details
  contractAmount: number;
  serviceTypes: string[];
  specialtyServices: string[];

  // Utilization
  referralsMade: number;
  totalExpenditure: number;
  averageCostPerService: number;
  patientSatisfactionScore: number;

  // Emergency Services
  emergencyServicesAvailable: boolean;
  traumaCenterLevel: string | null;
  distanceFromReservation: number; // km

  // Military Coordination
  veteranServicesAvailable: boolean;
  tricarePaneled: boolean;
  militaryEmergencyPartnership: boolean;

  lastUpdated: string;
}

interface IHSCache {
  serviceUnits: Map<string, IHSServiceUnit[]>;
  tribalPrograms: Map<string, TribalHealthProgram[]>;
  urbanPrograms: Map<string, UrbanIndianHealthProgram[]>;
  healthOutcomes: Map<string, TribalHealthOutcome[]>;
  contractServices: Map<string, ContractHealthService[]>;
  _lastUpdated: string;
  _buildInProgress: boolean;
  _buildStartedAt: string;
}

let ihsCache: IHSCache = {
  serviceUnits: new Map(),
  tribalPrograms: new Map(),
  urbanPrograms: new Map(),
  healthOutcomes: new Map(),
  contractServices: new Map(),
  _lastUpdated: '',
  _buildInProgress: false,
  _buildStartedAt: ''
};

// Build lock management
function isBuildInProgress(): boolean {
  if (!ihsCache._buildInProgress) return false;

  const buildStartTime = new Date(ihsCache._buildStartedAt).getTime();
  const now = Date.now();

  if (now - buildStartTime > BUILD_LOCK_TIMEOUT_MS) {
    console.log('IHS build lock timeout reached, clearing lock');
    ihsCache._buildInProgress = false;
    ihsCache._buildStartedAt = '';
    return false;
  }

  return true;
}

// Cache warming
export async function ensureWarmed(): Promise<void> {
  if (ihsCache.serviceUnits.size === 0) {
    await loadCacheFromDisk(ihsCache, CACHE_FILE);

    if (ihsCache.serviceUnits.size === 0) {
      await loadCacheFromBlob(ihsCache, BLOB_KEY);
    }
  }
}

// Geographic queries
export async function getIHSServicesByLocation(lat: number, lng: number, radius: number = 100): Promise<IHSServiceUnit[]> {
  await ensureWarmed();

  const centerGrid = gridKey(lat, lng);
  const searchGrids = [centerGrid, ...neighborKeys(lat, lng, Math.ceil(radius / 11.1))];

  const serviceUnits: IHSServiceUnit[] = [];

  for (const grid of searchGrids) {
    const gridUnits = ihsCache.serviceUnits.get(grid) || [];

    for (const unit of gridUnits) {
      const distance = haversineDistance(lat, lng, unit.coordinates.lat, unit.coordinates.lng);
      if (distance <= radius) {
        serviceUnits.push(unit);
      }
    }
  }

  return serviceUnits.sort((a, b) => {
    const distA = haversineDistance(lat, lng, a.coordinates.lat, a.coordinates.lng);
    const distB = haversineDistance(lat, lng, b.coordinates.lat, b.coordinates.lng);
    return distA - distB;
  });
}

export async function getTribalProgramsByState(state: string): Promise<TribalHealthProgram[]> {
  await ensureWarmed();

  const programs: TribalHealthProgram[] = [];

  for (const [grid, gridPrograms] of ihsCache.tribalPrograms) {
    for (const program of gridPrograms) {
      if (program.state.toLowerCase() === state.toLowerCase()) {
        programs.push(program);
      }
    }
  }

  return programs.sort((a, b) => b.annualFunding - a.annualFunding);
}

export async function getMilitaryConnectedTribalServices(): Promise<{
  serviceUnits: IHSServiceUnit[];
  programs: TribalHealthProgram[];
  urbanPrograms: UrbanIndianHealthProgram[];
}> {
  await ensureWarmed();

  const serviceUnits: IHSServiceUnit[] = [];
  const programs: TribalHealthProgram[] = [];
  const urbanPrograms: UrbanIndianHealthProgram[] = [];

  // Service units serving veterans or military families
  for (const [grid, units] of ihsCache.serviceUnits) {
    for (const unit of units) {
      if (unit.nativeVeteransServed > 0 || unit.militaryServiceMembersServed > 0 || unit.veteranHealthcarePartnership) {
        serviceUnits.push(unit);
      }
    }
  }

  // Tribal programs with military components
  for (const [grid, gridPrograms] of ihsCache.tribalPrograms) {
    for (const program of gridPrograms) {
      if (program.veteranTribalMembers > 0 || program.militaryPartnership || program.veteranReintegrationServices) {
        programs.push(program);
      }
    }
  }

  // Urban programs serving military families
  for (const [grid, gridPrograms] of ihsCache.urbanPrograms) {
    for (const program of gridPrograms) {
      if (program.nativeVeteransPatients > 0 || program.veteranOutreachPrograms) {
        urbanPrograms.push(program);
      }
    }
  }

  return {
    serviceUnits: serviceUnits.sort((a, b) => b.nativeVeteransServed - a.nativeVeteransServed),
    programs: programs.sort((a, b) => b.veteranTribalMembers - a.veteranTribalMembers),
    urbanPrograms: urbanPrograms.sort((a, b) => b.nativeVeteransPatients - a.nativeVeteransPatients)
  };
}

export async function getTribalHealthOutcomesWithMilitaryCorrelation(): Promise<{
  outcomes: TribalHealthOutcome[];
  avgVeteranPTSDRate: number;
  avgVeteranSubstanceAbuseRate: number;
  avgVeteranSuicideRate: number;
  totalMilitaryPopulation: number;
}> {
  await ensureWarmed();

  const outcomes: TribalHealthOutcome[] = [];

  for (const [grid, gridOutcomes] of ihsCache.healthOutcomes) {
    outcomes.push(...gridOutcomes);
  }

  if (outcomes.length === 0) {
    return {
      outcomes: [],
      avgVeteranPTSDRate: 0,
      avgVeteranSubstanceAbuseRate: 0,
      avgVeteranSuicideRate: 0,
      totalMilitaryPopulation: 0
    };
  }

  const avgVeteranPTSDRate = outcomes.reduce((sum, o) => sum + o.veteranHealthOutcomes.ptsdRate, 0) / outcomes.length;
  const avgVeteranSubstanceAbuseRate = outcomes.reduce((sum, o) => sum + o.veteranHealthOutcomes.substanceAbuseRate, 0) / outcomes.length;
  const avgVeteranSuicideRate = outcomes.reduce((sum, o) => sum + o.veteranHealthOutcomes.suicideRate, 0) / outcomes.length;
  const totalMilitaryPopulation = outcomes.reduce((sum, o) => sum + o.militaryHealthCareUtilization, 0);

  return {
    outcomes: outcomes.sort((a, b) => b.veteranHealthOutcomes.ptsdRate - a.veteranHealthOutcomes.ptsdRate),
    avgVeteranPTSDRate,
    avgVeteranSubstanceAbuseRate,
    avgVeteranSuicideRate,
    totalMilitaryPopulation
  };
}

// Environmental health analysis
export async function getTribalEnvironmentalHealthRisks(
  minWaterQualityImpact: number = 0.5
): Promise<{
  riskAreas: TribalHealthOutcome[];
  serviceUnitsAffected: IHSServiceUnit[];
  totalPopulationAtRisk: number;
}> {
  await ensureWarmed();

  const riskAreas: TribalHealthOutcome[] = [];
  const serviceUnitsAffected: IHSServiceUnit[] = [];

  // Find tribal areas with environmental health risks
  for (const [grid, outcomes] of ihsCache.healthOutcomes) {
    for (const outcome of outcomes) {
      if (outcome.waterQualityScore <= minWaterQualityImpact || outcome.environmentalExposureRisks.length > 0) {
        riskAreas.push(outcome);
      }
    }
  }

  // Find corresponding service units
  for (const [grid, units] of ihsCache.serviceUnits) {
    for (const unit of units) {
      if (unit.waterSystemCompliance < 90 || !unit.environmentalHealthProgram) {
        serviceUnitsAffected.push(unit);
      }
    }
  }

  const totalPopulationAtRisk = riskAreas.reduce((sum, area) => sum + area.totalPopulation, 0);

  return {
    riskAreas: riskAreas.sort((a, b) => a.waterQualityScore - b.waterQualityScore),
    serviceUnitsAffected: serviceUnitsAffected.sort((a, b) => a.waterSystemCompliance - b.waterSystemCompliance),
    totalPopulationAtRisk
  };
}

// Analytics
export async function calculateTribalHealthMetrics(area?: string): Promise<{
  totalServicePopulation: number;
  averageLifeExpectancy: number;
  diabetesRate: number;
  mentalHealthServiceGap: number;
  traditionallHealingIntegration: number;
  militaryServiceMemberHealth: {
    totalServed: number;
    avgPTSDRate: number;
    avgSubstanceAbuseRate: number;
  };
}> {
  await ensureWarmed();

  let serviceUnits: IHSServiceUnit[] = [];
  let outcomes: TribalHealthOutcome[] = [];

  if (area) {
    for (const [grid, units] of ihsCache.serviceUnits) {
      serviceUnits.push(...units.filter(u => u.area.toLowerCase() === area.toLowerCase()));
    }
    for (const [grid, gridOutcomes] of ihsCache.healthOutcomes) {
      outcomes.push(...gridOutcomes.filter(o => o.area.toLowerCase() === area.toLowerCase()));
    }
  } else {
    for (const [grid, units] of ihsCache.serviceUnits) {
      serviceUnits.push(...units);
    }
    for (const [grid, gridOutcomes] of ihsCache.healthOutcomes) {
      outcomes.push(...gridOutcomes);
    }
  }

  if (serviceUnits.length === 0 || outcomes.length === 0) {
    return {
      totalServicePopulation: 0,
      averageLifeExpectancy: 0,
      diabetesRate: 0,
      mentalHealthServiceGap: 0,
      traditionallHealingIntegration: 0,
      militaryServiceMemberHealth: {
        totalServed: 0,
        avgPTSDRate: 0,
        avgSubstanceAbuseRate: 0
      }
    };
  }

  const totalServicePopulation = serviceUnits.reduce((sum, unit) => sum + unit.servicePopulation, 0);
  const averageLifeExpectancy = outcomes.reduce((sum, o) => sum + o.lifeExpectancy, 0) / outcomes.length;
  const diabetesRate = outcomes.reduce((sum, o) => sum + o.diabetesRate, 0) / outcomes.length;

  const totalProviders = serviceUnits.reduce((sum, unit) => sum + unit.mentalHealthProviders, 0);
  const totalNeedingServices = outcomes.reduce((sum, o) => sum + (o.mentalHealthDisorderPrevalence * o.totalPopulation), 0);
  const mentalHealthServiceGap = Math.max(0, totalNeedingServices - (totalProviders * 100)); // Assume each provider serves 100 patients

  const unitsWithTraditionalHealing = serviceUnits.filter(unit => unit.traditionalHealingPrograms).length;
  const traditionallHealingIntegration = unitsWithTraditionalHealing / serviceUnits.length;

  const totalMilitaryServed = serviceUnits.reduce((sum, unit) => sum + unit.militaryServiceMembersServed + unit.nativeVeteransServed, 0);
  const avgPTSDRate = outcomes.reduce((sum, o) => sum + o.veteranHealthOutcomes.ptsdRate, 0) / outcomes.length;
  const avgSubstanceAbuseRate = outcomes.reduce((sum, o) => sum + o.veteranHealthOutcomes.substanceAbuseRate, 0) / outcomes.length;

  return {
    totalServicePopulation,
    averageLifeExpectancy,
    diabetesRate,
    mentalHealthServiceGap,
    traditionallHealingIntegration,
    militaryServiceMemberHealth: {
      totalServed: totalMilitaryServed,
      avgPTSDRate,
      avgSubstanceAbuseRate
    }
  };
}

// Cache management
export async function setIHSCache(
  serviceUnits: IHSServiceUnit[],
  tribalPrograms: TribalHealthProgram[],
  urbanPrograms: UrbanIndianHealthProgram[],
  healthOutcomes: TribalHealthOutcome[],
  contractServices: ContractHealthService[]
): Promise<void> {
  ihsCache._buildInProgress = true;
  ihsCache._buildStartedAt = new Date().toISOString();

  try {
    // Clear existing cache
    ihsCache.serviceUnits.clear();
    ihsCache.tribalPrograms.clear();
    ihsCache.urbanPrograms.clear();
    ihsCache.healthOutcomes.clear();
    ihsCache.contractServices.clear();

    // Grid-index all data
    for (const unit of serviceUnits) {
      const grid = gridKey(unit.coordinates.lat, unit.coordinates.lng);
      if (!ihsCache.serviceUnits.has(grid)) {
        ihsCache.serviceUnits.set(grid, []);
      }
      ihsCache.serviceUnits.get(grid)!.push(unit);
    }

    for (const program of tribalPrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!ihsCache.tribalPrograms.has(grid)) {
        ihsCache.tribalPrograms.set(grid, []);
      }
      ihsCache.tribalPrograms.get(grid)!.push(program);
    }

    for (const program of urbanPrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!ihsCache.urbanPrograms.has(grid)) {
        ihsCache.urbanPrograms.set(grid, []);
      }
      ihsCache.urbanPrograms.get(grid)!.push(program);
    }

    for (const outcome of healthOutcomes) {
      const grid = gridKey(outcome.coordinates.lat, outcome.coordinates.lng);
      if (!ihsCache.healthOutcomes.has(grid)) {
        ihsCache.healthOutcomes.set(grid, []);
      }
      ihsCache.healthOutcomes.get(grid)!.push(outcome);
    }

    for (const service of contractServices) {
      const grid = gridKey(service.coordinates.lat, service.coordinates.lng);
      if (!ihsCache.contractServices.has(grid)) {
        ihsCache.contractServices.set(grid, []);
      }
      ihsCache.contractServices.get(grid)!.push(service);
    }

    ihsCache._lastUpdated = new Date().toISOString();

    await saveCacheToDisk(ihsCache, CACHE_FILE);
    await saveCacheToBlob(ihsCache, BLOB_KEY);

  } finally {
    ihsCache._buildInProgress = false;
    ihsCache._buildStartedAt = '';
  }
}

export function getIHSCacheInfo(): {
  serviceUnitCount: number;
  tribalProgramCount: number;
  urbanProgramCount: number;
  outcomeRecordCount: number;
  contractServiceCount: number;
  lastUpdated: string;
  isBuilding: boolean;
} {
  let serviceUnitCount = 0;
  let tribalProgramCount = 0;
  let urbanProgramCount = 0;
  let outcomeRecordCount = 0;
  let contractServiceCount = 0;

  for (const units of ihsCache.serviceUnits.values()) {
    serviceUnitCount += units.length;
  }

  for (const programs of ihsCache.tribalPrograms.values()) {
    tribalProgramCount += programs.length;
  }

  for (const programs of ihsCache.urbanPrograms.values()) {
    urbanProgramCount += programs.length;
  }

  for (const outcomes of ihsCache.healthOutcomes.values()) {
    outcomeRecordCount += outcomes.length;
  }

  for (const services of ihsCache.contractServices.values()) {
    contractServiceCount += services.length;
  }

  return {
    serviceUnitCount,
    tribalProgramCount,
    urbanProgramCount,
    outcomeRecordCount,
    contractServiceCount,
    lastUpdated: ihsCache._lastUpdated,
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