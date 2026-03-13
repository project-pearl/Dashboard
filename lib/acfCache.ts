/**
 * ACF (Administration for Children and Families) Cache
 *
 * Social determinants of health data including child welfare, family services,
 * and community support programs that impact military families and readiness.
 *
 * Data Sources:
 * - Temporary Assistance for Needy Families (TANF)
 * - Adoption and Foster Care Analysis and Reporting System (AFCARS)
 * - Child Care and Development Fund (CCDF)
 * - Head Start Program Information Report (PIR)
 * - Office of Refugee Resettlement (ORR)
 * - Low Income Home Energy Assistance Program (LIHEAP)
 * - Community Services Block Grant (CSBG)
 * - Healthy Marriage and Responsible Fatherhood (HMRF)
 *
 * Military Applications:
 * - Military family stress assessment and support
 * - Deployment impact on child welfare
 * - Military spouse employment support programs
 * - Child care access for military families
 * - Social service utilization near military installations
 * - Community resilience factors affecting military readiness
 * - Military family reintegration support services
 */

import { gridKey, loadCacheFromDisk, saveCacheToDisk, neighborKeys } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';

const CACHE_FILE = '.cache/acf-data.json';
const BLOB_KEY = 'acf-cache';
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

interface TANFProgram {
  programId: string;
  state: string;
  county: string;
  granteeOrganization: string;

  // Geographic Data
  address: string;
  city: string;
  zipCode: string;
  serviceArea: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Program Statistics
  totalFamilies: number;
  totalRecipients: number;
  adultRecipients: number;
  childRecipients: number;

  // Demographics
  singleParentFamilies: number;
  twoParentFamilies: number;
  teenParentFamilies: number;
  disabledAdultFamilies: number;

  // Employment Services
  workParticipationRate: number;
  jobTrainingPrograms: number;
  educationPrograms: number;
  supportiveServicesOffered: string[];

  // Military Family Support
  militaryFamiliesServed: number;
  deploymentSupportServices: boolean;
  militarySpouseEmploymentPrograms: boolean;
  childCareForMilitaryFamilies: boolean;

  // Financial Assistance
  averageMonthlyBenefit: number;
  totalExpenditures: number;
  emergencyAssistance: number;

  // Outcomes
  familiesMovedToSelfSufficiency: number;
  averageTimeOnAssistance: number; // months
  recidivismRate: number;

  // Environmental Factors
  waterQualityImpact: number; // correlation with local water issues
  housingQuality: number; // 1-5 rating

  fiscalYear: number;
  lastUpdated: string;
}

interface ChildCareProgram {
  programId: string;
  providerName: string;
  providerType: 'center' | 'family_home' | 'group_home' | 'school_age' | 'military_cdc';

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

  // Licensing and Quality
  licensed: boolean;
  accredited: boolean;
  qualityRating: number; // 1-5 star rating
  lastInspectionDate: string;
  violationsOnRecord: number;

  // Capacity and Enrollment
  totalCapacity: number;
  currentEnrollment: number;
  waitlistSize: number;

  // Age Groups Served
  infantCapacity: number;
  toddlerCapacity: number;
  preschoolCapacity: number;
  schoolAgeCapacity: number;

  // Staffing
  totalStaff: number;
  credentialedTeachers: number;
  staffTurnoverRate: number;
  backgroundChecksCurrent: boolean;

  // Services
  fullDayProgram: boolean;
  partTimeProgram: boolean;
  extendedHoursAvailable: boolean;
  transportationProvided: boolean;
  mealProgram: boolean;
  specialNeedsAccommodation: boolean;

  // Military Family Services
  militaryChildCareAct: boolean; // Serves military families
  hourlyChildCare: boolean; // For military training/deployment
  deploymentSupport: boolean;
  militaryDiscounts: boolean;
  proximityToMilitaryBase: number; // km

  // Financial
  averageWeeklyCost: number;
  ccdfSubsidiesAccepted: boolean;
  militaryChildCareActAccepted: boolean;
  scholarshipsAvailable: boolean;

  // Quality Indicators
  teacherToChildRatio: {
    infants: string;
    toddlers: string;
    preschool: string;
    schoolAge: string;
  };

  lastUpdated: string;
}

interface HeadStartProgram {
  granteeId: string;
  granteeName: string;
  programType: 'head_start' | 'early_head_start' | 'american_indian_alaska_native' | 'migrant_seasonal';

  // Geographic Data
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  serviceArea: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Program Details
  totalFundedEnrollment: number;
  actualEnrollment: number;
  averageDailyAttendance: number;
  programOperationDays: number;

  // Demographics Served
  eligibleChildren: number;
  childrenInPoverty: number;
  childrenReceivingTANF: number;
  homelessChildren: number;
  childrenWithDisabilities: number;
  childrenInFosterCare: number;

  // Family Characteristics
  singleParentFamilies: number;
  teenParentFamilies: number;
  parentsWithoutHighSchoolDiploma: number;
  unemployedParents: number;

  // Military Family Demographics
  militaryFamilyEnrollment: number;
  childrenOfDeployedParents: number;
  militarySpouseParents: number;
  veteranFamilyEnrollment: number;

  // Services Provided
  fullDayServices: number;
  partDayServices: number;
  homeBasedServices: number;
  healthServices: boolean;
  mentalHealthServices: boolean;
  nutritionServices: boolean;
  socialServices: boolean;

  // Educational Outcomes
  schoolReadinessScores: {
    literacy: number;
    numeracy: number;
    socialEmotional: number;
    physical: number;
  };

  // Family Engagement
  parentVolunteerHours: number;
  parentEducationActivities: number;
  familyGoalAchievementRate: number;

  // Health and Nutrition
  childrenReceivingMedicalExams: number;
  childrenReceivingDentalExams: number;
  immunizationComplianceRate: number;
  nutritionEducationProvided: boolean;

  // Environmental Health
  facilitySafetyScore: number;
  waterQualityTested: boolean;
  environmentalHealthProgram: boolean;

  grantYear: number;
  lastUpdated: string;
}

interface FosterCareSystem {
  systemId: string;
  state: string;
  county: string;
  agency: string;
  agencyType: 'public' | 'private' | 'tribal';

  // Geographic Data
  address: string;
  city: string;
  zipCode: string;
  serviceJurisdiction: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Foster Care Statistics
  childrenInCare: number;
  childrenEnteringCare: number;
  childrenExitingCare: number;
  childrenAwaitingAdoption: number;

  // Placement Types
  fosterFamilyHomes: number;
  relativePlacements: number;
  groupHomes: number;
  institutionalCare: number;
  independentLivingPrograms: number;

  // Military-Connected Cases
  militaryFamilyChildren: number;
  childrenOfDeployedParents: number;
  militaryFamilyReunifications: number;
  deploymentRelatedRemovals: number;

  // Demographics
  ageGroups: {
    under1: number;
    ages1to5: number;
    ages6to12: number;
    ages13to17: number;
    age18Plus: number;
  };

  raceEthnicity: {
    white: number;
    black: number;
    hispanic: number;
    americanIndian: number;
    asian: number;
    multiRacial: number;
  };

  // Outcomes
  permanencyAchieved: number;
  familyReunification: number;
  adoptionFinalized: number;
  guardianshipEstablished: number;
  emancipated: number;

  // Case Management
  averageCaseload: number;
  socialWorkerTurnoverRate: number;
  investigationResponseTime: number; // hours
  courtHearingCompliance: number; // percentage

  // Services
  familyPreservationServices: boolean;
  reunificationServices: boolean;
  adoptionServices: boolean;
  independentLivingServices: boolean;
  mentalHealthServices: boolean;

  reportingYear: number;
  lastUpdated: string;
}

interface CommunityServiceProgram {
  programId: string;
  csbgGrantee: string; // Community Services Block Grant recipient

  // Geographic Data
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  serviceAreas: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Grant Information
  federalAward: number;
  matchingFunds: number;
  totalBudget: number;
  grantYear: number;

  // Population Served
  eligibleLowIncomePopulation: number;
  totalIndividualsServed: number;
  totalFamiliesServed: number;

  // Services Provided
  emergencyServices: {
    foodAssistance: number;
    housingAssistance: number;
    utilityAssistance: number;
    transportationAssistance: number;
    healthcareAssistance: number;
  };

  // Employment and Education
  employmentServices: number;
  jobTrainingPrograms: number;
  educationServices: number;
  adultEducationPrograms: number;

  // Military Community Services
  militaryFamiliesServed: number;
  veteranServicesProvided: number;
  deploymentSupportPrograms: boolean;
  militarySpouseSupport: boolean;

  // Housing and Asset Building
  housingCounseling: number;
  homelessPreventionServices: number;
  assetBuildingPrograms: number;
  financialEducationServices: number;

  // Health and Nutrition
  healthServices: number;
  nutritionPrograms: number;
  mentalHealthServices: number;
  substanceAbuseServices: number;

  // Advocacy and Coordination
  communityAdvocacy: boolean;
  serviceCoordination: boolean;
  coalitionBuilding: boolean;

  // Outcomes
  individualsAchievingSelfSufficiency: number;
  familiesMovedOutOfPoverty: number;
  individualsObtainingEmployment: number;
  childrenImprovedEducationOutcomes: number;

  // Environmental Justice
  environmentalHealthAdvocacy: boolean;
  waterQualityAdvocacy: boolean;
  communityHealthAssessment: boolean;

  lastUpdated: string;
}

interface RefugeeResettlement {
  programId: string;
  resettlementAgency: string;

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

  // Arrivals
  refugeesArrived: number;
  asylumSeekersServed: number;
  unaccompaniedMinorsServed: number;
  traffickingVictimsServed: number;

  // Demographics
  countryOfOrigin: { [country: string]: number };
  ageGroups: {
    children: number;
    adults: number;
    elderly: number;
  };

  // Services Provided
  caseManagementsServices: number;
  englishLanguageServices: number;
  employmentServices: number;
  healthScreenings: number;
  mentalHealthServices: number;
  schoolEnrollmentSupport: number;

  // Military Connections
  militaryInterpreters: number; // Former military interpreters
  specialImmigrantVisas: number; // Military-connected SIVs
  afghanEvacuees: number; // Operation Allies Welcome
  militaryFamilySponsorship: number;

  // Integration Outcomes
  employmentPlacement: number;
  englishProficiencyGains: number;
  healthInsuranceEnrollment: number;
  schoolEnrollmentRate: number;

  // Community Health
  healthOutcomes: {
    tuberculosisScreening: number;
    mentlHealthReferrals: number;
    chronicDiseaseManagement: number;
  };

  fiscalYear: number;
  lastUpdated: string;
}

interface ACFCache {
  tanfPrograms: Map<string, TANFProgram[]>;
  childCarePrograms: Map<string, ChildCareProgram[]>;
  headStartPrograms: Map<string, HeadStartProgram[]>;
  fosterCareSystems: Map<string, FosterCareSystem[]>;
  communityServices: Map<string, CommunityServiceProgram[]>;
  refugeeResettlement: Map<string, RefugeeResettlement[]>;
  _lastUpdated: string;
  _buildInProgress: boolean;
  _buildStartedAt: string;
}

let acfCache: ACFCache = {
  tanfPrograms: new Map(),
  childCarePrograms: new Map(),
  headStartPrograms: new Map(),
  fosterCareSystems: new Map(),
  communityServices: new Map(),
  refugeeResettlement: new Map(),
  _lastUpdated: '',
  _buildInProgress: false,
  _buildStartedAt: ''
};

// Build lock management
function isBuildInProgress(): boolean {
  if (!acfCache._buildInProgress) return false;

  const buildStartTime = new Date(acfCache._buildStartedAt).getTime();
  const now = Date.now();

  if (now - buildStartTime > BUILD_LOCK_TIMEOUT_MS) {
    console.log('ACF build lock timeout reached, clearing lock');
    acfCache._buildInProgress = false;
    acfCache._buildStartedAt = '';
    return false;
  }

  return true;
}

// Cache warming
export async function ensureWarmed(): Promise<void> {
  if (acfCache.tanfPrograms.size === 0) {
    const diskData = loadCacheFromDisk<ACFCache>(CACHE_FILE);
    if (diskData) Object.assign(acfCache, diskData);

    if (acfCache.tanfPrograms.size === 0) {
      const blobData = await loadCacheFromBlob<ACFCache>(BLOB_KEY);
      if (blobData) Object.assign(acfCache, blobData);
    }
  }
}

// Geographic queries
export async function getMilitaryFamilySupportServices(lat: number, lng: number, radius: number = 50): Promise<{
  tanf: TANFProgram[];
  childCare: ChildCareProgram[];
  headStart: HeadStartProgram[];
  communityServices: CommunityServiceProgram[];
}> {
  await ensureWarmed();

  const centerGrid = gridKey(lat, lng);
  const searchGrids = [centerGrid, ...neighborKeys(lat, lng)];

  const tanf: TANFProgram[] = [];
  const childCare: ChildCareProgram[] = [];
  const headStart: HeadStartProgram[] = [];
  const communityServices: CommunityServiceProgram[] = [];

  for (const grid of searchGrids) {
    // TANF programs serving military families
    const gridTanf = acfCache.tanfPrograms.get(grid) || [];
    for (const program of gridTanf) {
      if (program.militaryFamiliesServed > 0 || program.deploymentSupportServices) {
        const distance = haversineDistance(lat, lng, program.coordinates.lat, program.coordinates.lng);
        if (distance <= radius) {
          tanf.push(program);
        }
      }
    }

    // Child care programs near military bases
    const gridChildCare = acfCache.childCarePrograms.get(grid) || [];
    for (const program of gridChildCare) {
      if (program.militaryChildCareAct || program.proximityToMilitaryBase <= 25) {
        const distance = haversineDistance(lat, lng, program.coordinates.lat, program.coordinates.lng);
        if (distance <= radius) {
          childCare.push(program);
        }
      }
    }

    // Head Start programs serving military families
    const gridHeadStart = acfCache.headStartPrograms.get(grid) || [];
    for (const program of gridHeadStart) {
      if (program.militaryFamilyEnrollment > 0 || program.childrenOfDeployedParents > 0) {
        const distance = haversineDistance(lat, lng, program.coordinates.lat, program.coordinates.lng);
        if (distance <= radius) {
          headStart.push(program);
        }
      }
    }

    // Community services for military families
    const gridCommunity = acfCache.communityServices.get(grid) || [];
    for (const program of gridCommunity) {
      if (program.militaryFamiliesServed > 0 || program.veteranServicesProvided > 0) {
        const distance = haversineDistance(lat, lng, program.coordinates.lat, program.coordinates.lng);
        if (distance <= radius) {
          communityServices.push(program);
        }
      }
    }
  }

  return {
    tanf: tanf.sort((a, b) => b.militaryFamiliesServed - a.militaryFamiliesServed),
    childCare: childCare.sort((a, b) => a.proximityToMilitaryBase - b.proximityToMilitaryBase),
    headStart: headStart.sort((a, b) => b.militaryFamilyEnrollment - a.militaryFamilyEnrollment),
    communityServices: communityServices.sort((a, b) => b.militaryFamiliesServed - a.militaryFamiliesServed)
  };
}

export async function getChildWelfareDataByState(state: string): Promise<{
  fosterCareSystems: FosterCareSystem[];
  militaryConnectedChildren: number;
  deploymentRelatedCases: number;
  totalChildrenInCare: number;
}> {
  await ensureWarmed();

  const fosterCareSystems: FosterCareSystem[] = [];

  for (const [grid, systems] of acfCache.fosterCareSystems) {
    for (const system of systems) {
      if (system.state.toLowerCase() === state.toLowerCase()) {
        fosterCareSystems.push(system);
      }
    }
  }

  const militaryConnectedChildren = fosterCareSystems.reduce((sum, s) => sum + s.militaryFamilyChildren, 0);
  const deploymentRelatedCases = fosterCareSystems.reduce((sum, s) => sum + s.deploymentRelatedRemovals, 0);
  const totalChildrenInCare = fosterCareSystems.reduce((sum, s) => sum + s.childrenInCare, 0);

  return {
    fosterCareSystems: fosterCareSystems.sort((a, b) => b.childrenInCare - a.childrenInCare),
    militaryConnectedChildren,
    deploymentRelatedCases,
    totalChildrenInCare
  };
}

export async function getRefugeeResettlementWithMilitaryConnections(): Promise<RefugeeResettlement[]> {
  await ensureWarmed();

  const militaryConnectedPrograms: RefugeeResettlement[] = [];

  for (const [grid, programs] of acfCache.refugeeResettlement) {
    for (const program of programs) {
      if (program.militaryInterpreters > 0 || program.specialImmigrantVisas > 0 || program.afghanEvacuees > 0) {
        militaryConnectedPrograms.push(program);
      }
    }
  }

  return militaryConnectedPrograms.sort((a, b) =>
    (b.militaryInterpreters + b.specialImmigrantVisas + b.afghanEvacuees) -
    (a.militaryInterpreters + a.specialImmigrantVisas + a.afghanEvacuees)
  );
}

// Analytics
export async function calculateSocialDeterminantsImpact(state?: string): Promise<{
  familiesInPoverty: number;
  childrenInFosterCare: number;
  childCareAccessGap: number;
  militaryFamilySupport: {
    tanfSupported: number;
    childCareSupported: number;
    headStartSupported: number;
    deploymentSupport: number;
  };
  communityResilience: number;
}> {
  await ensureWarmed();

  let tanfPrograms: TANFProgram[] = [];
  let childCarePrograms: ChildCareProgram[] = [];
  let headStartPrograms: HeadStartProgram[] = [];
  let fosterCareSystems: FosterCareSystem[] = [];

  if (state) {
    for (const [grid, programs] of acfCache.tanfPrograms) {
      tanfPrograms.push(...programs.filter(p => p.state.toLowerCase() === state.toLowerCase()));
    }
    for (const [grid, programs] of acfCache.childCarePrograms) {
      childCarePrograms.push(...programs.filter(p => p.state.toLowerCase() === state.toLowerCase()));
    }
    for (const [grid, programs] of acfCache.headStartPrograms) {
      headStartPrograms.push(...programs.filter(p => p.state.toLowerCase() === state.toLowerCase()));
    }
    for (const [grid, systems] of acfCache.fosterCareSystems) {
      fosterCareSystems.push(...systems.filter(s => s.state.toLowerCase() === state.toLowerCase()));
    }
  } else {
    for (const [grid, programs] of acfCache.tanfPrograms) {
      tanfPrograms.push(...programs);
    }
    for (const [grid, programs] of acfCache.childCarePrograms) {
      childCarePrograms.push(...programs);
    }
    for (const [grid, programs] of acfCache.headStartPrograms) {
      headStartPrograms.push(...programs);
    }
    for (const [grid, systems] of acfCache.fosterCareSystems) {
      fosterCareSystems.push(...systems);
    }
  }

  const familiesInPoverty = tanfPrograms.reduce((sum, p) => sum + p.totalFamilies, 0);
  const childrenInFosterCare = fosterCareSystems.reduce((sum, s) => sum + s.childrenInCare, 0);

  const childCareCapacity = childCarePrograms.reduce((sum, p) => sum + p.totalCapacity, 0);
  const childCareEnrollment = childCarePrograms.reduce((sum, p) => sum + p.currentEnrollment, 0);
  const childCareWaitlist = childCarePrograms.reduce((sum, p) => sum + p.waitlistSize, 0);
  const childCareAccessGap = Math.max(0, childCareWaitlist - (childCareCapacity - childCareEnrollment));

  const militaryFamilySupport = {
    tanfSupported: tanfPrograms.reduce((sum, p) => sum + p.militaryFamiliesServed, 0),
    childCareSupported: childCarePrograms.filter(p => p.militaryChildCareAct).length,
    headStartSupported: headStartPrograms.reduce((sum, p) => sum + p.militaryFamilyEnrollment, 0),
    deploymentSupport: tanfPrograms.filter(p => p.deploymentSupportServices).length +
                      childCarePrograms.filter(p => p.deploymentSupport).length +
                      headStartPrograms.reduce((sum, p) => sum + p.childrenOfDeployedParents, 0)
  };

  // Community resilience score based on service availability and outcomes
  const serviceDensity = (tanfPrograms.length + childCarePrograms.length + headStartPrograms.length) / Math.max(familiesInPoverty / 1000, 1);
  const outcomeQuality = tanfPrograms.reduce((sum, p) => sum + p.familiesMovedToSelfSufficiency, 0) / Math.max(familiesInPoverty, 1);
  const communityResilience = Math.min(10, (serviceDensity + outcomeQuality * 10) / 2);

  return {
    familiesInPoverty,
    childrenInFosterCare,
    childCareAccessGap,
    militaryFamilySupport,
    communityResilience
  };
}

// Cache management
export async function setACFCache(
  tanfPrograms: TANFProgram[],
  childCarePrograms: ChildCareProgram[],
  headStartPrograms: HeadStartProgram[],
  fosterCareSystems: FosterCareSystem[],
  communityServices: CommunityServiceProgram[],
  refugeeResettlement: RefugeeResettlement[]
): Promise<void> {
  acfCache._buildInProgress = true;
  acfCache._buildStartedAt = new Date().toISOString();

  try {
    // Clear existing cache
    acfCache.tanfPrograms.clear();
    acfCache.childCarePrograms.clear();
    acfCache.headStartPrograms.clear();
    acfCache.fosterCareSystems.clear();
    acfCache.communityServices.clear();
    acfCache.refugeeResettlement.clear();

    // Grid-index all data types
    for (const program of tanfPrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!acfCache.tanfPrograms.has(grid)) {
        acfCache.tanfPrograms.set(grid, []);
      }
      acfCache.tanfPrograms.get(grid)!.push(program);
    }

    for (const program of childCarePrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!acfCache.childCarePrograms.has(grid)) {
        acfCache.childCarePrograms.set(grid, []);
      }
      acfCache.childCarePrograms.get(grid)!.push(program);
    }

    for (const program of headStartPrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!acfCache.headStartPrograms.has(grid)) {
        acfCache.headStartPrograms.set(grid, []);
      }
      acfCache.headStartPrograms.get(grid)!.push(program);
    }

    for (const system of fosterCareSystems) {
      const grid = gridKey(system.coordinates.lat, system.coordinates.lng);
      if (!acfCache.fosterCareSystems.has(grid)) {
        acfCache.fosterCareSystems.set(grid, []);
      }
      acfCache.fosterCareSystems.get(grid)!.push(system);
    }

    for (const service of communityServices) {
      const grid = gridKey(service.coordinates.lat, service.coordinates.lng);
      if (!acfCache.communityServices.has(grid)) {
        acfCache.communityServices.set(grid, []);
      }
      acfCache.communityServices.get(grid)!.push(service);
    }

    for (const resettlement of refugeeResettlement) {
      const grid = gridKey(resettlement.coordinates.lat, resettlement.coordinates.lng);
      if (!acfCache.refugeeResettlement.has(grid)) {
        acfCache.refugeeResettlement.set(grid, []);
      }
      acfCache.refugeeResettlement.get(grid)!.push(resettlement);
    }

    acfCache._lastUpdated = new Date().toISOString();

    saveCacheToDisk(CACHE_FILE, acfCache);
    await saveCacheToBlob(BLOB_KEY, acfCache);

  } finally {
    acfCache._buildInProgress = false;
    acfCache._buildStartedAt = '';
  }
}

export function getACFCacheInfo(): {
  tanfProgramCount: number;
  childCareProgramCount: number;
  headStartProgramCount: number;
  fosterCareSystemCount: number;
  communityServiceCount: number;
  refugeeResettlementCount: number;
  lastUpdated: string;
  isBuilding: boolean;
} {
  let tanfProgramCount = 0;
  let childCareProgramCount = 0;
  let headStartProgramCount = 0;
  let fosterCareSystemCount = 0;
  let communityServiceCount = 0;
  let refugeeResettlementCount = 0;

  for (const programs of acfCache.tanfPrograms.values()) {
    tanfProgramCount += programs.length;
  }

  for (const programs of acfCache.childCarePrograms.values()) {
    childCareProgramCount += programs.length;
  }

  for (const programs of acfCache.headStartPrograms.values()) {
    headStartProgramCount += programs.length;
  }

  for (const systems of acfCache.fosterCareSystems.values()) {
    fosterCareSystemCount += systems.length;
  }

  for (const services of acfCache.communityServices.values()) {
    communityServiceCount += services.length;
  }

  for (const resettlements of acfCache.refugeeResettlement.values()) {
    refugeeResettlementCount += resettlements.length;
  }

  return {
    tanfProgramCount,
    childCareProgramCount,
    headStartProgramCount,
    fosterCareSystemCount,
    communityServiceCount,
    refugeeResettlementCount,
    lastUpdated: acfCache._lastUpdated,
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