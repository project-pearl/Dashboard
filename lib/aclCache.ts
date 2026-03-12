/**
 * ACL (Administration for Community Living) Cache
 *
 * Aging and disability services data including long-term care, community-based services,
 * and support systems affecting military veterans, families, and aging populations.
 *
 * Data Sources:
 * - Older Americans Act programs
 * - Independent Living Centers
 * - Developmental Disabilities programs
 * - Traumatic Brain Injury programs
 * - Alzheimer's Disease programs
 * - Long-Term Care Ombudsman programs
 * - Assistive Technology programs
 * - Nutrition Services programs
 *
 * Military Applications:
 * - Aging veteran support services
 * - Military TBI and disability service coordination
 * - Military family caregiving support
 * - Veteran long-term care planning
 * - Military spouse disability services
 * - Community-based alternatives to institutional care
 * - Assistive technology for wounded warriors
 * - Social isolation prevention for military families
 */

import { gridKey, loadCacheFromDisk, saveCacheToDisk, neighborKeys } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';

const CACHE_FILE = '.cache/acl-data.json';
const BLOB_KEY = 'acl-cache';
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

interface AreaAgencyOnAging {
  agencyId: string;
  agencyName: string;
  planningServiceArea: string;

  // Geographic Coverage
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  serviceAreaCounties: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Population Served
  totalPopulation60Plus: number;
  populationTargetGroups: {
    minorityOlderAdults: number;
    lowIncomeOlderAdults: number;
    ruralOlderAdults: number;
    limitedEnglishProficiency: number;
  };

  // Military-Connected Population
  veteransServed: number;
  militarySpousesServed: number;
  goldStarFamiliesServed: number;
  veteranCaregiversSupported: number;

  // Core Services
  congregateMeals: {
    sitesOperated: number;
    mealsServedAnnually: number;
    participantsServed: number;
  };

  homeDeliveredMeals: {
    mealsDeliveredAnnually: number;
    recipientsServed: number;
    waitingList: number;
  };

  transportation: {
    tripsProvidedAnnually: number;
    individualsServed: number;
    medicalTrips: number;
    shoppingTrips: number;
  };

  // Support Services
  informationAssistance: {
    contactsAnnually: number;
    benefitsCounselingCases: number;
    healthInsuranceCounseling: number;
  };

  caregiverSupport: {
    familyCaregivers: number;
    grandfamilyCaregivers: number;
    supportGroups: number;
    respiteCareHours: number;
  };

  // Health and Wellness
  healthPromotion: {
    evidenceBasedPrograms: string[];
    participantsServed: number;
    fallsPrevention: number;
    chronicDiseaseManagement: number;
  };

  // Military-Specific Programs
  veteranDirectedCare: boolean;
  militaryFamilyLifeLine: boolean;
  ptsdCaregiverSupport: boolean;
  tbiSupportServices: boolean;

  // Elder Rights Protection
  ombudsmanProgram: {
    complaintsCases: number;
    facilitiesVisited: number;
    advocacyContacts: number;
  };

  elderAbusePrevention: {
    casesInvestigated: number;
    educationPrograms: number;
    guardiansupport: number;
  };

  // Environmental Health
  homeSafetyAssessments: number;
  weatherizationReferrals: number;
  waterQualityEducation: boolean;

  // Funding
  oaaFunding: number; // Older Americans Act
  stateFunding: number;
  localFunding: number;
  totalBudget: number;

  fiscalYear: number;
  lastUpdated: string;
}

interface IndependentLivingCenter {
  ilcId: string;
  centerName: string;

  // Location Information
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

  // Center Characteristics
  centerType: 'independent' | 'satellite' | 'associate';
  accredited: boolean;
  certificationType: 'part_c' | 'part_b' | 'state_funded';

  // Population Served
  individualsServed: number;
  disabilityTypes: {
    physicalDisability: number;
    intellectualDisability: number;
    mentalHealthDisability: number;
    sensoryDisability: number;
    chronicIllness: number;
    cognitiveDisability: number;
  };

  // Military-Connected Consumers
  veterans: number;
  activedutyServiceMembers: number;
  militaryFamilyMembers: number;
  woundedWarriors: number;
  combatVeterans: number;

  // Disability-Specific Military
  combatRelatedTBI: number;
  combatRelatedPTSD: number;
  combatRelatedAmputees: number;
  serviceConnectedDisabilities: number;

  // Core Services
  informationReferral: {
    contactsAnnually: number;
    resourcesProvided: number;
    systemsAdvocacyCases: number;
  };

  independentLivingSkills: {
    individualsServed: number;
    trainingHours: number;
    skillAreas: string[];
  };

  peerCounseling: {
    counselors: number;
    sessionsProvided: number;
    supportGroups: number;
  };

  advocacy: {
    individualAdvocacyCases: number;
    systemsAdvocacyIssues: number;
    legislativeTestimony: number;
  };

  // Transition Services
  transitionServices: {
    schoolToWork: number;
    nursingHomeTransition: number;
    hospitalDischarge: number;
    militaryDischarge: number; // Military-specific
  };

  // Assistive Technology
  assistiveTechnology: {
    assessmentsProvided: number;
    equipmentLoaned: number;
    trainingProvided: number;
    fundingAssistance: number;
  };

  // Employment Services
  employmentSupport: {
    jobPlacementsAchieved: number;
    vocationalCounseling: number;
    workplaceAccommodations: number;
    entrepreneurshipSupport: number;
  };

  // Housing Services
  housingSupport: {
    housingUnitsSecured: number;
    accessibilityModifications: number;
    housingAdvocacy: number;
    homelessnessPrevention: number;
  };

  // Federal Funding
  part_c_funding: number; // Independent Living Part C
  part_b_funding: number; // Supported Living Part B
  otherFederalFunding: number;
  totalFunding: number;

  lastReporting: string;
  lastUpdated: string;
}

interface DevelopmentalDisabilitiesCouncil {
  councilId: string;
  stateName: string;
  councilName: string;

  // Council Composition
  address: string;
  city: string;
  state: string;
  zipCode: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Council Membership
  totalMembers: number;
  individualwithDD: number;
  familyMembers: number;
  agencyRepresentatives: number;
  publicMembers: number;

  // Military Representation
  veteranCouncilMembers: number;
  militaryFamilyMembers: number;
  veteranServiceOrganizations: number;

  // Five-Year Plan Priorities
  planPriorities: string[];
  currentPlanPeriod: string;
  fundingPriorities: {
    priority: string;
    fundingAllocated: number;
    expectedOutcomes: string[];
  }[];

  // Advocacy and Systems Change
  advocacyInitiatives: {
    initiative: string;
    status: 'planning' | 'implementation' | 'completed';
    partnersInvolved: string[];
    militaryRelevance: boolean;
  }[];

  // Capacity Building
  capacityBuildingActivities: {
    activity: string;
    participantsReached: number;
    organizationsSupported: number;
  }[];

  // Military-Specific Initiatives
  veteranDDSupport: boolean;
  militaryFamilyOutreach: boolean;
  tbiAwarenessPrograms: number;
  veteranTransitionSupport: boolean;

  // Research and Evaluation
  evaluationStudies: {
    study: string;
    populationStudied: number;
    keyFindings: string[];
    policyImplications: string[];
  }[];

  // Grant Programs
  grantsAwarded: {
    grantee: string;
    amount: number;
    purpose: string;
    duration: string;
  }[];

  // Federal Funding
  ddActFunding: number; // DD Act funding
  stateFunding: number;
  otherFunding: number;
  totalBudget: number;

  fiscalYear: number;
  lastUpdated: string;
}

interface TraumaticBrainInjuryProgram {
  tbiProgramId: string;
  programName: string;
  programType: 'state_program' | 'protection_advocacy' | 'university_center';

  // Geographic Information
  address: string;
  city: string;
  state: string;
  zipCode: string;
  serviceArea: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Program Focus
  populationFocus: string[];
  ageGroupsServed: {
    children: number;
    transitionalAge: number;
    adults: number;
    olderAdults: number;
  };

  // Military-Connected TBI
  combatTBIFocus: boolean;
  veteransServed: number;
  activedutyCoordination: boolean;
  militaryFamilySupport: number;
  blastInjurySpecialization: boolean;

  // Service Categories
  directServices: {
    caseManagement: number;
    counseling: number;
    cognitivRehabilitation: number;
    skillBuilding: number;
    familySupport: number;
  };

  supportServices: {
    informationReferral: number;
    advocacyServices: number;
    assistiveTechnology: number;
    transportation: number;
    respiteCare: number;
  };

  // Clinical Partnerships
  hospitalPartnerships: string[];
  rehabilitationCenters: string[];
  mentalHealthProviders: string[];
  vaPartnerships: string[]; // VA Medical Centers

  // Research Activities
  researchProjects: {
    project: string;
    participants: number;
    militaryParticipants: number;
    findings: string[];
  }[];

  // Training and Education
  trainingActivities: {
    audience: string;
    participantsTrained: number;
    trainingTopics: string[];
  }[];

  // Outcomes
  individualsServed: number;
  serviceHours: number;
  successfulOutcomes: number;
  followUpRate: number;

  // Environmental Health
  environmentalTBIRisk: boolean;
  waterQualityEducation: boolean;
  toxicExposureAssessment: boolean;

  // Federal Funding
  tbiActFunding: number;
  cmsWaiver: number;
  otherFunding: number;
  totalBudget: number;

  grantPeriod: string;
  lastUpdated: string;
}

interface NutritionProgram {
  programId: string;
  providerName: string;
  programType: 'congregate_meals' | 'home_delivered_meals' | 'nutrition_education' | 'food_pantry';

  // Location Data
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

  // Service Delivery
  mealsServed: {
    congregateMeals: number;
    homeDeliveredMeals: number;
    emergencyMeals: number;
    specialEventMeals: number;
  };

  // Participant Demographics
  participantsServed: number;
  averageAge: number;
  minorityParticipants: number;
  lowIncomeParticipants: number;
  homeoundParticipants: number;

  // Military-Connected Participants
  veteranParticipants: number;
  militarySpouseParticipants: number;
  goldStarParticipants: number;
  caregiverParticipants: number;

  // Nutritional Quality
  nutritionStandards: boolean;
  dietaryAccommodations: string[];
  specialDiets: {
    diabetic: number;
    lowSodium: number;
    renal: number;
    culturallyAppropriate: number;
  };

  // Nutrition Education
  educationPrograms: {
    program: string;
    participants: number;
    sessions: number;
  }[];

  // Social Engagement
  socialActivities: string[];
  intergenerationalPrograms: number;
  volunteerProgram: {
    volunteers: number;
    veteranVolunteers: number;
    volunteerHours: number;
  };

  // Food Security
  foodInsecurityScreening: boolean;
  emergencyFoodProvision: number;
  benefitsEnrollmentAssistance: number;

  // Health Integration
  healthScreenings: string[];
  medicationManagement: boolean;
  healthInsuranceCounseling: number;

  // Environmental Factors
  localFoodSources: string[];
  communityGardens: boolean;
  waterQualityForMealPrep: boolean;

  // Funding Sources
  oaaTitle3C1: number; // Congregate Nutrition
  oaaTitle3C2: number; // Home-Delivered Nutrition
  stateFunding: number;
  donations: number;
  totalBudget: number;

  operatingDays: number;
  lastUpdated: string;
}

interface LongTermCareOmbudsman {
  ombudsmanId: string;
  programName: string;
  programType: 'state' | 'local' | 'regional';

  // Geographic Coverage
  address: string;
  city: string;
  state: string;
  zipCode: string;
  jurisdictionCounties: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Staffing
  staff: {
    stateOmbudsman: number;
    regionalCoordinators: number;
    localOmbudsmen: number;
    volunteers: number;
    veteranVolunteers: number;
  };

  // Facilities Covered
  facilitiesCovered: {
    nursingHomes: number;
    assistedLivingFacilities: number;
    adultDayServices: number;
    residentialCareFacilities: number;
    veteranHomes: number; // State veteran homes
  };

  // Complaint Resolution
  complaintsReceived: number;
  complaintsResolved: number;
  complaintCategories: {
    category: string;
    count: number;
    resolutionRate: number;
  }[];

  // Military-Connected Cases
  veteranComplaints: number;
  militaryFamilyComplaints: number;
  vaContractFacilities: number;
  tricareCases: number;

  // Advocacy Activities
  systemAdvocacy: {
    legislativeTestimony: number;
    regulatoryComments: number;
    facilityQualityImprovements: number;
  };

  // Education and Outreach
  communityEducation: {
    presentationsGiven: number;
    materialsDistributed: number;
    websiteVisits: number;
  };

  // Collaboration
  partnerOrganizations: string[];
  vaPartnership: boolean;
  militaryServiceOrganizations: string[];

  // Quality Measures
  resolutionTimeAverage: number; // days
  satisfactionRating: number; // 1-5 scale
  facilityImprovementRate: number;

  // Environmental Health
  environmentalHealthComplaints: number;
  waterQualityIssues: number;
  airQualityComplaints: number;

  // Federal Requirements
  olderAmericansActCompliance: boolean;
  reportingCompliance: number; // percentage
  trainingCompliance: number;

  fiscalYear: number;
  lastUpdated: string;
}

interface ACLCache {
  areaAgencies: Map<string, AreaAgencyOnAging[]>;
  independentLivingCenters: Map<string, IndependentLivingCenter[]>;
  ddCouncils: Map<string, DevelopmentalDisabilitiesCouncil[]>;
  tbiPrograms: Map<string, TraumaticBrainInjuryProgram[]>;
  nutritionPrograms: Map<string, NutritionProgram[]>;
  ombudsmanPrograms: Map<string, LongTermCareOmbudsman[]>;
  _lastUpdated: string;
  _buildInProgress: boolean;
  _buildStartedAt: string;
}

let aclCache: ACLCache = {
  areaAgencies: new Map(),
  independentLivingCenters: new Map(),
  ddCouncils: new Map(),
  tbiPrograms: new Map(),
  nutritionPrograms: new Map(),
  ombudsmanPrograms: new Map(),
  _lastUpdated: '',
  _buildInProgress: false,
  _buildStartedAt: ''
};

// Build lock management
function isBuildInProgress(): boolean {
  if (!aclCache._buildInProgress) return false;

  const buildStartTime = new Date(aclCache._buildStartedAt).getTime();
  const now = Date.now();

  if (now - buildStartTime > BUILD_LOCK_TIMEOUT_MS) {
    console.log('ACL build lock timeout reached, clearing lock');
    aclCache._buildInProgress = false;
    aclCache._buildStartedAt = '';
    return false;
  }

  return true;
}

// Cache warming
export async function ensureWarmed(): Promise<void> {
  if (aclCache.areaAgencies.size === 0) {
    await loadCacheFromDisk(aclCache, CACHE_FILE);

    if (aclCache.areaAgencies.size === 0) {
      await loadCacheFromBlob(aclCache, BLOB_KEY);
    }
  }
}

// Geographic queries
export async function getAgingServicesNearMilitary(
  lat: number,
  lng: number,
  radius: number = 50
): Promise<{
  areaAgencies: AreaAgencyOnAging[];
  nutritionPrograms: NutritionProgram[];
  ombudsmanPrograms: LongTermCareOmbudsman[];
}> {
  await ensureWarmed();

  const centerGrid = gridKey(lat, lng);
  const searchGrids = [centerGrid, ...neighborKeys(lat, lng, Math.ceil(radius / 11.1))];

  const areaAgencies: AreaAgencyOnAging[] = [];
  const nutritionPrograms: NutritionProgram[] = [];
  const ombudsmanPrograms: LongTermCareOmbudsman[] = [];

  for (const grid of searchGrids) {
    // Area Agencies serving veterans
    const gridAgencies = aclCache.areaAgencies.get(grid) || [];
    for (const agency of gridAgencies) {
      const distance = haversineDistance(lat, lng, agency.coordinates.lat, agency.coordinates.lng);
      if (distance <= radius && (agency.veteransServed > 0 || agency.veteranDirectedCare)) {
        areaAgencies.push(agency);
      }
    }

    // Nutrition programs serving veterans
    const gridNutrition = aclCache.nutritionPrograms.get(grid) || [];
    for (const program of gridNutrition) {
      const distance = haversineDistance(lat, lng, program.coordinates.lat, program.coordinates.lng);
      if (distance <= radius && program.veteranParticipants > 0) {
        nutritionPrograms.push(program);
      }
    }

    // Ombudsman programs with veteran cases
    const gridOmbudsman = aclCache.ombudsmanPrograms.get(grid) || [];
    for (const program of gridOmbudsman) {
      const distance = haversineDistance(lat, lng, program.coordinates.lat, program.coordinates.lng);
      if (distance <= radius && (program.veteranComplaints > 0 || program.vaPartnership)) {
        ombudsmanPrograms.push(program);
      }
    }
  }

  return {
    areaAgencies: areaAgencies.sort((a, b) => b.veteransServed - a.veteransServed),
    nutritionPrograms: nutritionPrograms.sort((a, b) => b.veteranParticipants - a.veteranParticipants),
    ombudsmanPrograms: ombudsmanPrograms.sort((a, b) => b.veteranComplaints - a.veteranComplaints)
  };
}

export async function getMilitaryTBIServices(): Promise<{
  combatTBIPrograms: TraumaticBrainInjuryProgram[];
  independentLivingSupport: IndependentLivingCenter[];
  veteransServed: number;
  totalServiceHours: number;
}> {
  await ensureWarmed();

  const combatTBIPrograms: TraumaticBrainInjuryProgram[] = [];
  const independentLivingSupport: IndependentLivingCenter[] = [];
  let veteransServed = 0;
  let totalServiceHours = 0;

  // TBI programs with combat focus
  for (const [grid, programs] of aclCache.tbiPrograms) {
    for (const program of programs) {
      if (program.combatTBIFocus || program.blastInjurySpecialization || program.veteransServed > 0) {
        combatTBIPrograms.push(program);
        veteransServed += program.veteransServed;
        totalServiceHours += program.serviceHours;
      }
    }
  }

  // Independent living centers serving wounded warriors
  for (const [grid, centers] of aclCache.independentLivingCenters) {
    for (const center of centers) {
      if (center.woundedWarriors > 0 || center.combatRelatedTBI > 0) {
        independentLivingSupport.push(center);
      }
    }
  }

  return {
    combatTBIPrograms: combatTBIPrograms.sort((a, b) => b.veteransServed - a.veteransServed),
    independentLivingSupport: independentLivingSupport.sort((a, b) => b.woundedWarriors - a.woundedWarriors),
    veteransServed,
    totalServiceHours
  };
}

export async function getDisabilityServicesByState(state: string): Promise<{
  independentLivingCenters: IndependentLivingCenter[];
  ddCouncil: DevelopmentalDisabilitiesCouncil | null;
  tbiPrograms: TraumaticBrainInjuryProgram[];
  totalVeteransServed: number;
  totalIndividualsServed: number;
}> {
  await ensureWarmed();

  const independentLivingCenters: IndependentLivingCenter[] = [];
  const tbiPrograms: TraumaticBrainInjuryProgram[] = [];
  let ddCouncil: DevelopmentalDisabilitiesCouncil | null = null;
  let totalVeteransServed = 0;
  let totalIndividualsServed = 0;

  // Independent Living Centers
  for (const [grid, centers] of aclCache.independentLivingCenters) {
    for (const center of centers) {
      if (center.state.toLowerCase() === state.toLowerCase()) {
        independentLivingCenters.push(center);
        totalVeteransServed += center.veterans;
        totalIndividualsServed += center.individualsServed;
      }
    }
  }

  // DD Council (one per state)
  for (const [grid, councils] of aclCache.ddCouncils) {
    for (const council of councils) {
      if (council.state.toLowerCase() === state.toLowerCase()) {
        ddCouncil = council;
        break;
      }
    }
  }

  // TBI Programs
  for (const [grid, programs] of aclCache.tbiPrograms) {
    for (const program of programs) {
      if (program.state.toLowerCase() === state.toLowerCase()) {
        tbiPrograms.push(program);
        totalVeteransServed += program.veteransServed;
        totalIndividualsServed += program.individualsServed;
      }
    }
  }

  return {
    independentLivingCenters: independentLivingCenters.sort((a, b) => b.individualsServed - a.individualsServed),
    ddCouncil,
    tbiPrograms: tbiPrograms.sort((a, b) => b.individualsServed - a.individualsServed),
    totalVeteransServed,
    totalIndividualsServed
  };
}

// Analytics
export async function calculateAgingAndDisabilitySupport(): Promise<{
  totalOlderAdultsServed: number;
  totalVeteransSupported: number;
  mealsServedAnnually: number;
  caregiversSuppported: number;
  disabilityServicesReach: number;
  tbiServicesCapacity: number;
  militaryFamilySupport: {
    agencies: number;
    programs: number;
    individuals: number;
  };
}> {
  await ensureWarmed();

  let totalOlderAdultsServed = 0;
  let totalVeteransSupported = 0;
  let mealsServedAnnually = 0;
  let caregiversSuppported = 0;
  let disabilityServicesReach = 0;
  let tbiServicesCapacity = 0;
  let militaryAgencies = 0;
  let militaryPrograms = 0;
  let militaryIndividuals = 0;

  // Area Agencies data
  for (const [grid, agencies] of aclCache.areaAgencies) {
    for (const agency of agencies) {
      totalOlderAdultsServed += agency.totalPopulation60Plus;
      totalVeteransSupported += agency.veteransServed;
      mealsServedAnnually += agency.congregateMeals.mealsServedAnnually + agency.homeDeliveredMeals.mealsDeliveredAnnually;
      caregiversSuppported += agency.caregiverSupport.familyCaregivers;

      if (agency.veteransServed > 0 || agency.veteranDirectedCare) {
        militaryAgencies++;
        militaryIndividuals += agency.veteransServed + agency.militarySpousesServed;
      }
    }
  }

  // Independent Living Centers data
  for (const [grid, centers] of aclCache.independentLivingCenters) {
    for (const center of centers) {
      disabilityServicesReach += center.individualsServed;
      totalVeteransSupported += center.veterans;

      if (center.veterans > 0 || center.woundedWarriors > 0) {
        militaryPrograms++;
        militaryIndividuals += center.veterans + center.activedutyServiceMembers + center.militaryFamilyMembers;
      }
    }
  }

  // TBI Programs data
  for (const [grid, programs] of aclCache.tbiPrograms) {
    for (const program of programs) {
      tbiServicesCapacity += program.individualsServed;
      totalVeteransSupported += program.veteransServed;

      if (program.combatTBIFocus || program.veteransServed > 0) {
        militaryPrograms++;
        militaryIndividuals += program.veteransServed + program.militaryFamilySupport;
      }
    }
  }

  return {
    totalOlderAdultsServed,
    totalVeteransSupported,
    mealsServedAnnually,
    caregiversSuppported,
    disabilityServicesReach,
    tbiServicesCapacity,
    militaryFamilySupport: {
      agencies: militaryAgencies,
      programs: militaryPrograms,
      individuals: militaryIndividuals
    }
  };
}

// Cache management
export async function setACLCache(
  areaAgencies: AreaAgencyOnAging[],
  independentLivingCenters: IndependentLivingCenter[],
  ddCouncils: DevelopmentalDisabilitiesCouncil[],
  tbiPrograms: TraumaticBrainInjuryProgram[],
  nutritionPrograms: NutritionProgram[],
  ombudsmanPrograms: LongTermCareOmbudsman[]
): Promise<void> {
  aclCache._buildInProgress = true;
  aclCache._buildStartedAt = new Date().toISOString();

  try {
    // Clear existing cache
    aclCache.areaAgencies.clear();
    aclCache.independentLivingCenters.clear();
    aclCache.ddCouncils.clear();
    aclCache.tbiPrograms.clear();
    aclCache.nutritionPrograms.clear();
    aclCache.ombudsmanPrograms.clear();

    // Grid-index all data types
    for (const agency of areaAgencies) {
      const grid = gridKey(agency.coordinates.lat, agency.coordinates.lng);
      if (!aclCache.areaAgencies.has(grid)) {
        aclCache.areaAgencies.set(grid, []);
      }
      aclCache.areaAgencies.get(grid)!.push(agency);
    }

    for (const center of independentLivingCenters) {
      const grid = gridKey(center.coordinates.lat, center.coordinates.lng);
      if (!aclCache.independentLivingCenters.has(grid)) {
        aclCache.independentLivingCenters.set(grid, []);
      }
      aclCache.independentLivingCenters.get(grid)!.push(center);
    }

    for (const council of ddCouncils) {
      const grid = gridKey(council.coordinates.lat, council.coordinates.lng);
      if (!aclCache.ddCouncils.has(grid)) {
        aclCache.ddCouncils.set(grid, []);
      }
      aclCache.ddCouncils.get(grid)!.push(council);
    }

    for (const program of tbiPrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!aclCache.tbiPrograms.has(grid)) {
        aclCache.tbiPrograms.set(grid, []);
      }
      aclCache.tbiPrograms.get(grid)!.push(program);
    }

    for (const program of nutritionPrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!aclCache.nutritionPrograms.has(grid)) {
        aclCache.nutritionPrograms.set(grid, []);
      }
      aclCache.nutritionPrograms.get(grid)!.push(program);
    }

    for (const program of ombudsmanPrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!aclCache.ombudsmanPrograms.has(grid)) {
        aclCache.ombudsmanPrograms.set(grid, []);
      }
      aclCache.ombudsmanPrograms.get(grid)!.push(program);
    }

    aclCache._lastUpdated = new Date().toISOString();

    await saveCacheToDisk(aclCache, CACHE_FILE);
    await saveCacheToBlob(aclCache, BLOB_KEY);

  } finally {
    aclCache._buildInProgress = false;
    aclCache._buildStartedAt = '';
  }
}

export function getACLCacheInfo(): {
  areaAgencyCount: number;
  independentLivingCenterCount: number;
  ddCouncilCount: number;
  tbiProgramCount: number;
  nutritionProgramCount: number;
  ombudsmanProgramCount: number;
  lastUpdated: string;
  isBuilding: boolean;
} {
  let areaAgencyCount = 0;
  let independentLivingCenterCount = 0;
  let ddCouncilCount = 0;
  let tbiProgramCount = 0;
  let nutritionProgramCount = 0;
  let ombudsmanProgramCount = 0;

  for (const agencies of aclCache.areaAgencies.values()) {
    areaAgencyCount += agencies.length;
  }

  for (const centers of aclCache.independentLivingCenters.values()) {
    independentLivingCenterCount += centers.length;
  }

  for (const councils of aclCache.ddCouncils.values()) {
    ddCouncilCount += councils.length;
  }

  for (const programs of aclCache.tbiPrograms.values()) {
    tbiProgramCount += programs.length;
  }

  for (const programs of aclCache.nutritionPrograms.values()) {
    nutritionProgramCount += programs.length;
  }

  for (const programs of aclCache.ombudsmanPrograms.values()) {
    ombudsmanProgramCount += programs.length;
  }

  return {
    areaAgencyCount,
    independentLivingCenterCount,
    ddCouncilCount,
    tbiProgramCount,
    nutritionProgramCount,
    ombudsmanProgramCount,
    lastUpdated: aclCache._lastUpdated,
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