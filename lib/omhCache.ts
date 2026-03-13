/**
 * OMH (Office of Minority Health) Cache
 *
 * Health equity and disparities data focusing on minority populations,
 * including racial/ethnic minorities in military service and communities.
 *
 * Data Sources:
 * - Minority Health Disparities Research
 * - Cultural Competency Training Programs
 * - Community Health Worker Programs
 * - Health Equity Grants and Programs
 * - Minority Health Surveillance
 * - Health Professional Diversity Programs
 * - Community-Based Participatory Research
 * - Language Access and Translation Services
 *
 * Military Applications:
 * - Minority military service member health disparities
 * - Cultural competency in military healthcare
 * - Diverse military community health assessment
 * - Military family health equity analysis
 * - Veteran minority population health outcomes
 * - Military installation community diversity health
 * - Cross-cultural military medicine initiatives
 * - Health equity in military healthcare delivery
 */

import { gridKey, loadCacheFromDisk, saveCacheToDisk, neighborKeys } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';

const CACHE_FILE = '.cache/omh-data.json';
const BLOB_KEY = 'omh-cache';
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

interface HealthDisparitiesData {
  dataId: string;
  populationGroup: 'african_american' | 'hispanic_latino' | 'american_indian_alaska_native' | 'asian_american' | 'native_hawaiian_pacific_islander' | 'multiracial';

  // Geographic Information
  state: string;
  county: string;
  metropolitanArea: string;
  ruralUrbanStatus: 'urban' | 'suburban' | 'rural';

  coordinates: {
    lat: number;
    lng: number;
  };

  // Population Demographics
  totalPopulation: number;
  populationPercentage: number; // % of total area population
  ageDistribution: {
    under18: number;
    age18to64: number;
    age65plus: number;
  };

  socioeconomicIndicators: {
    medianIncome: number;
    povertyRate: number;
    unemploymentRate: number;
    educationLevelBachelorPlus: number;
    uninsuredRate: number;
  };

  // Military-Connected Demographics
  militaryServiceMembers: number;
  veteranPopulation: number;
  militaryFamilies: number;
  activedutySpouses: number;

  // Health Disparities
  healthOutcomes: {
    lifeExpectancy: number;
    infantMortalityRate: number;
    lowBirthWeightRate: number;
    maternalMortalityRate: number;
    preventableDeathRate: number;
  };

  chronicDiseaseRates: {
    diabetes: number;
    hypertension: number;
    heartDisease: number;
    cancer: number;
    stroke: number;
    asthma: number;
    obesity: number;
  };

  mentalHealthIndicators: {
    depressionRate: number;
    anxietyRate: number;
    suicideRate: number;
    substanceAbuseRate: number;
    mentalHealthServiceUtilization: number;
  };

  // Access to Care
  healthcareAccess: {
    primaryCarePhysicianRatio: number;
    specialtyAccessRating: number;
    emergencyDepartmentUtilization: number;
    preventiveCareUtilization: number;
  };

  // Military Healthcare Access
  militaryHealthcareAccess: {
    tricareBeneficiaries: number;
    vaMedicalCenterAccess: number;
    militaryTreatmentFacilityAccess: number;
    culturalCompetencyRating: number;
  };

  // Environmental Health
  environmentalFactors: {
    waterQualityScore: number;
    airQualityIndex: number;
    foodAccessScore: number;
    housingQuality: number;
    safetyConcerns: number;
  };

  // Social Determinants
  socialDeterminants: {
    transportationAccess: number;
    internetAccess: number;
    socialSupport: number;
    communityEngagement: number;
    discrimination: number;
  };

  dataYear: number;
  lastUpdated: string;
}

interface CulturalCompetencyProgram {
  programId: string;
  programName: string;
  organizationType: 'healthcare_system' | 'medical_school' | 'nursing_school' | 'community_center' | 'military_facility';

  // Location Information
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Program Details
  targetAudience: string[];
  culturalFocusGroups: string[];
  trainingModalities: string[];
  programDuration: number; // hours
  certificationOffered: boolean;

  // Military Integration
  militaryPersonnelTrained: number;
  militaryHealthcareProviders: number;
  militaryFamilyServices: boolean;
  veteranCulturalCompetency: boolean;

  // Training Components
  trainingTopics: {
    topic: string;
    hours: number;
    evaluationMethod: string;
  }[];

  languageServices: {
    interpretationServices: boolean;
    translationServices: boolean;
    languagesSupported: string[];
    certifiedInterpreters: number;
  };

  // Participants
  totalParticipantsTrained: number;
  participantsByType: {
    physicians: number;
    nurses: number;
    socialWorkers: number;
    administrators: number;
    supportStaff: number;
    militaryPersonnel: number;
  };

  // Outcomes Assessment
  competencyAssessment: {
    preTrainingScores: number;
    postTrainingScores: number;
    improvementPercentage: number;
    retentionRate: number;
  };

  patientSatisfactionImpact: {
    minorityPatientSatisfaction: number;
    culturalSensitivityRating: number;
    communicationEffectiveness: number;
  };

  // Quality Measures
  accreditationStatus: string;
  evidenceBasedPractices: boolean;
  continuousImprovement: boolean;
  outcomeTracking: boolean;

  // Funding
  omhFunding: number;
  otherFederalFunding: number;
  stateFunding: number;
  privateFunding: number;
  totalBudget: number;

  grantPeriod: string;
  lastUpdated: string;
}

interface CommunityHealthWorker {
  chwId: string;
  workerName: string; // Anonymized/aggregated data
  organizationType: 'community_health_center' | 'hospital' | 'non_profit' | 'faith_based' | 'military_support';

  // Location and Service Area
  primaryLocation: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    county: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };

  serviceArea: string[];
  populationServed: number;

  // CHW Characteristics
  culturalBackground: string[];
  languagesSpoken: string[];
  educationLevel: string;
  certificationStatus: string;
  yearsOfExperience: number;

  // Military Community Focus
  militaryFamilyServices: boolean;
  veteranCommunityWork: boolean;
  militarySpouseSupport: boolean;
  deploymentFamilySupport: boolean;

  // Services Provided
  serviceCategories: {
    healthEducation: boolean;
    navigationAssistance: boolean;
    advocacyServices: boolean;
    socialSupport: boolean;
    screeningServices: boolean;
    outreachServices: boolean;
  };

  healthConditionsFocus: string[];

  // Client Demographics
  clientsServed: {
    totalClients: number;
    africanAmerican: number;
    hispanicLatino: number;
    americanIndian: number;
    asianAmerican: number;
    pacificIslander: number;
    multiracial: number;
    veterans: number;
    militaryFamilies: number;
  };

  // Service Delivery
  serviceVolume: {
    homeVisits: number;
    phoneContacts: number;
    groupSessions: number;
    referralsMade: number;
    followUpContacts: number;
  };

  // Outcomes
  healthOutcomes: {
    healthBehaviorChanges: number;
    healthScreeningCompletion: number;
    chronicDiseaseManagement: number;
    emergencyDepartmentReductions: number;
  };

  // Training and Support
  trainingReceived: string[];
  supervisionHours: number;
  continuingEducation: number;
  peerSupportParticipation: boolean;

  // Environmental Health
  environmentalHealthActivities: boolean;
  waterQualityEducation: boolean;
  housingHealthAssessments: number;

  lastTrainingDate: string;
  lastUpdated: string;
}

interface HealthEquityGrant {
  grantId: string;
  grantTitle: string;
  grantType: 'research' | 'program_implementation' | 'capacity_building' | 'demonstration' | 'training' | 'evaluation';

  // Grantee Information
  principalInvestigator: string;
  granteeOrganization: string;
  organizationType: string;

  // Geographic Focus
  address: string;
  city: string;
  state: string;
  projectStates: string[];
  projectCounties: string[];

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
  fundingSource: string;

  // Population Focus
  targetPopulations: string[];
  priorityPopulations: {
    racialMinorities: string[];
    ethnicMinorities: string[];
    linguisticMinorities: string[];
    lgbtq: boolean;
    disabilities: boolean;
    rural: boolean;
    veterans: boolean;
    militaryFamilies: boolean;
  };

  // Health Focus Areas
  healthConditions: string[];
  healthBehaviors: string[];
  socialDeterminants: string[];
  healthSystemFactors: string[];

  // Military Relevance
  militaryPopulationIncluded: boolean;
  veteranHealthFocus: boolean;
  militaryFamilyComponents: boolean;
  militaryInstallationPartnership: boolean;

  // Intervention Approach
  interventionTypes: string[];
  theoryBased: boolean;
  evidenceBased: boolean;
  culturallyTailored: boolean;
  communityParticipatory: boolean;

  // Research Design
  studyDesign: string;
  sampleSize: number;
  dataCollectionMethods: string[];
  primaryOutcomes: string[];
  secondaryOutcomes: string[];

  // Partnerships
  partnerOrganizations: string[];
  communityPartners: string[];
  academicPartners: string[];
  healthSystemPartners: string[];
  militaryPartners: string[];

  // Implementation
  implementationSites: number;
  staffingFTE: number;
  participantsRecruited: number;
  interventionsDelivered: number;

  // Outcomes and Impact
  preliminaryFindings: string[];
  healthImprovements: string[];
  systemChanges: string[];
  policyInfluences: string[];
  sustainabilityPlans: string[];

  // Dissemination
  publicationsPlanned: number;
  publicationsCompleted: number;
  presentationsGiven: number;
  toolsResourcesDeveloped: string[];

  progressStatus: 'planning' | 'implementation' | 'analysis' | 'completed' | 'terminated';
  lastUpdated: string;
}

interface MinorityHealthSurveillance {
  surveillanceId: string;
  surveillanceSystem: string;
  surveillanceType: 'behavioral' | 'disease_specific' | 'mortality' | 'morbidity' | 'healthcare_utilization';

  // Geographic Coverage
  geographicLevel: 'national' | 'state' | 'county' | 'metropolitan' | 'tribal';
  coverageAreas: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Data Collection
  dataCollectionMethod: string;
  sampleSize: number;
  responseRate: number;
  dataCollectionPeriod: string;

  // Population Monitored
  totalPopulation: number;
  minorityPopulations: {
    africanAmerican: number;
    hispanicLatino: number;
    americanIndian: number;
    asianAmerican: number;
    pacificIslander: number;
    multiracial: number;
  };

  // Military Population
  militaryServiceMembers: number;
  veterans: number;
  militaryFamilyMembers: number;
  reserveGuardMembers: number;

  // Health Indicators Monitored
  healthIndicators: {
    indicator: string;
    overallRate: number;
    minorityRates: { [group: string]: number };
    militaryRates: { [group: string]: number };
    disparityMagnitude: number;
    trendDirection: 'improving' | 'stable' | 'worsening';
  }[];

  // Risk Factors
  riskFactors: {
    riskFactor: string;
    prevalenceOverall: number;
    prevalenceByGroup: { [group: string]: number };
    militaryPrevalence: number;
  }[];

  // Healthcare Access
  accessIndicators: {
    indicator: string;
    overallAccess: number;
    minorityAccess: { [group: string]: number };
    militaryAccess: number;
    barriers: string[];
  }[];

  // Environmental Factors
  environmentalFactors: {
    waterQuality: number;
    airQuality: number;
    foodEnvironment: number;
    builtEnvironment: number;
    socialEnvironment: number;
  };

  // Quality Measures
  dataQuality: {
    completeness: number;
    validity: number;
    reliability: number;
    timeliness: number;
  };

  // Reporting and Dissemination
  reportingFrequency: string;
  lastReportDate: string;
  dataAvailability: string;
  stakeholdersNotified: string[];

  lastDataUpdate: string;
  lastUpdated: string;
}

interface OMHCache {
  disparitiesData: Map<string, HealthDisparitiesData[]>;
  culturalCompetencyPrograms: Map<string, CulturalCompetencyProgram[]>;
  communityHealthWorkers: Map<string, CommunityHealthWorker[]>;
  healthEquityGrants: Map<string, HealthEquityGrant[]>;
  surveillanceData: Map<string, MinorityHealthSurveillance[]>;
  _lastUpdated: string;
  _buildInProgress: boolean;
  _buildStartedAt: string;
}

let omhCache: OMHCache = {
  disparitiesData: new Map(),
  culturalCompetencyPrograms: new Map(),
  communityHealthWorkers: new Map(),
  healthEquityGrants: new Map(),
  surveillanceData: new Map(),
  _lastUpdated: '',
  _buildInProgress: false,
  _buildStartedAt: ''
};

// Build lock management
function isBuildInProgress(): boolean {
  if (!omhCache._buildInProgress) return false;

  const buildStartTime = new Date(omhCache._buildStartedAt).getTime();
  const now = Date.now();

  if (now - buildStartTime > BUILD_LOCK_TIMEOUT_MS) {
    console.log('OMH build lock timeout reached, clearing lock');
    omhCache._buildInProgress = false;
    omhCache._buildStartedAt = '';
    return false;
  }

  return true;
}

// Cache warming
export async function ensureWarmed(): Promise<void> {
  if (omhCache.disparitiesData.size === 0) {
    const diskData = loadCacheFromDisk<OMHCache>(CACHE_FILE);
    if (diskData) Object.assign(omhCache, diskData);

    if (omhCache.disparitiesData.size === 0) {
      const blobData = await loadCacheFromBlob<OMHCache>(BLOB_KEY);
      if (blobData) Object.assign(omhCache, blobData);
    }
  }
}

// Geographic queries
export async function getHealthDisparitiesNearMilitary(
  lat: number,
  lng: number,
  radius: number = 50
): Promise<{
  disparitiesData: HealthDisparitiesData[];
  culturalPrograms: CommunityHealthWorker[];
  totalMinorityPopulation: number;
  totalMilitaryMinorities: number;
}> {
  await ensureWarmed();

  const centerGrid = gridKey(lat, lng);
  const searchGrids = [centerGrid, ...neighborKeys(lat, lng)];

  const disparitiesData: HealthDisparitiesData[] = [];
  const culturalPrograms: CommunityHealthWorker[] = [];
  let totalMinorityPopulation = 0;
  let totalMilitaryMinorities = 0;

  for (const grid of searchGrids) {
    // Disparities data near military installations
    const gridDisparities = omhCache.disparitiesData.get(grid) || [];
    for (const data of gridDisparities) {
      const distance = haversineDistance(lat, lng, data.coordinates.lat, data.coordinates.lng);
      if (distance <= radius) {
        disparitiesData.push(data);
        totalMinorityPopulation += data.totalPopulation;
        totalMilitaryMinorities += data.militaryServiceMembers + data.veteranPopulation;
      }
    }

    // CHWs serving military communities
    const gridCHW = omhCache.communityHealthWorkers.get(grid) || [];
    for (const chw of gridCHW) {
      const distance = haversineDistance(lat, lng, chw.primaryLocation.coordinates.lat, chw.primaryLocation.coordinates.lng);
      if (distance <= radius && (chw.militaryFamilyServices || chw.veteranCommunityWork)) {
        culturalPrograms.push(chw);
      }
    }
  }

  return {
    disparitiesData: disparitiesData.sort((a, b) => b.totalPopulation - a.totalPopulation),
    culturalPrograms: culturalPrograms.sort((a, b) => b.clientsServed.veterans - a.clientsServed.veterans),
    totalMinorityPopulation,
    totalMilitaryMinorities
  };
}

export async function getMilitaryFocusedHealthEquityPrograms(): Promise<{
  grants: HealthEquityGrant[];
  programs: CulturalCompetencyProgram[];
  totalFunding: number;
  militaryPersonnelServed: number;
}> {
  await ensureWarmed();

  const grants: HealthEquityGrant[] = [];
  const programs: CulturalCompetencyProgram[] = [];
  let totalFunding = 0;
  let militaryPersonnelServed = 0;

  // Health equity grants with military components
  for (const [grid, gridGrants] of omhCache.healthEquityGrants) {
    for (const grant of gridGrants) {
      if (grant.militaryPopulationIncluded || grant.veteranHealthFocus || grant.militaryFamilyComponents) {
        grants.push(grant);
        totalFunding += grant.awardAmount;
      }
    }
  }

  // Cultural competency programs training military personnel
  for (const [grid, gridPrograms] of omhCache.culturalCompetencyPrograms) {
    for (const program of gridPrograms) {
      if (program.militaryPersonnelTrained > 0 || program.militaryFamilyServices) {
        programs.push(program);
        militaryPersonnelServed += program.militaryPersonnelTrained;
      }
    }
  }

  return {
    grants: grants.sort((a, b) => b.awardAmount - a.awardAmount),
    programs: programs.sort((a, b) => b.militaryPersonnelTrained - a.militaryPersonnelTrained),
    totalFunding,
    militaryPersonnelServed
  };
}

export async function getMinorityHealthSurveillanceByState(state: string): Promise<{
  surveillanceSystems: MinorityHealthSurveillance[];
  totalMinorityPopulation: number;
  totalMilitaryMinorities: number;
  keyDisparities: { indicator: string; disparityMagnitude: number }[];
}> {
  await ensureWarmed();

  const surveillanceSystems: MinorityHealthSurveillance[] = [];
  let totalMinorityPopulation = 0;
  let totalMilitaryMinorities = 0;
  const keyDisparities: { indicator: string; disparityMagnitude: number }[] = [];

  for (const [grid, systems] of omhCache.surveillanceData) {
    for (const system of systems) {
      if (system.coverageAreas.includes(state.toUpperCase()) || system.coverageAreas.includes(state.toLowerCase())) {
        surveillanceSystems.push(system);

        // Aggregate population data
        totalMinorityPopulation += Object.values(system.minorityPopulations).reduce((sum, pop) => sum + pop, 0);
        totalMilitaryMinorities += system.militaryServiceMembers + system.veterans + system.militaryFamilyMembers;

        // Collect key disparities
        for (const indicator of system.healthIndicators) {
          if (indicator.disparityMagnitude > 1.5) { // Significant disparity threshold
            keyDisparities.push({
              indicator: indicator.indicator,
              disparityMagnitude: indicator.disparityMagnitude
            });
          }
        }
      }
    }
  }

  // Sort disparities by magnitude
  keyDisparities.sort((a, b) => b.disparityMagnitude - a.disparityMagnitude);

  return {
    surveillanceSystems: surveillanceSystems.sort((a, b) => b.totalPopulation - a.totalPopulation),
    totalMinorityPopulation,
    totalMilitaryMinorities,
    keyDisparities: keyDisparities.slice(0, 10) // Top 10 disparities
  };
}

// Analytics
export async function calculateHealthEquityMetrics(): Promise<{
  totalMinorityPopulation: number;
  totalMilitaryMinorities: number;
  disparityIndicators: {
    lifeExpectancyGap: number;
    infantMortalityRatio: number;
    diabetesDisparityRatio: number;
    heartDiseaseDisparityRatio: number;
  };
  interventionCapacity: {
    culturalCompetencyPrograms: number;
    communityHealthWorkers: number;
    activeGrants: number;
    totalFunding: number;
  };
  militaryHealthEquity: {
    programsServingMilitary: number;
    militaryPersonnelTrained: number;
    veteransServed: number;
  };
}> {
  await ensureWarmed();

  let totalMinorityPopulation = 0;
  let totalMilitaryMinorities = 0;
  let lifeExpectancySum = 0;
  let infantMortalitySum = 0;
  let diabetesSum = 0;
  let heartDiseaseSum = 0;
  let disparityCount = 0;

  // Calculate population and disparities
  for (const [grid, data] of omhCache.disparitiesData) {
    for (const disparity of data) {
      totalMinorityPopulation += disparity.totalPopulation;
      totalMilitaryMinorities += disparity.militaryServiceMembers + disparity.veteranPopulation;

      lifeExpectancySum += disparity.healthOutcomes.lifeExpectancy;
      infantMortalitySum += disparity.healthOutcomes.infantMortalityRate;
      diabetesSum += disparity.chronicDiseaseRates.diabetes;
      heartDiseaseSum += disparity.chronicDiseaseRates.heartDisease;
      disparityCount++;
    }
  }

  // Calculate intervention capacity
  let culturalCompetencyPrograms = 0;
  let communityHealthWorkers = 0;
  let activeGrants = 0;
  let totalFunding = 0;
  let programsServingMilitary = 0;
  let militaryPersonnelTrained = 0;
  let veteransServed = 0;

  for (const [grid, programs] of omhCache.culturalCompetencyPrograms) {
    culturalCompetencyPrograms += programs.length;
    for (const program of programs) {
      if (program.militaryPersonnelTrained > 0) {
        programsServingMilitary++;
        militaryPersonnelTrained += program.militaryPersonnelTrained;
      }
    }
  }

  for (const [grid, chws] of omhCache.communityHealthWorkers) {
    communityHealthWorkers += chws.length;
    for (const chw of chws) {
      veteransServed += chw.clientsServed.veterans;
    }
  }

  for (const [grid, grants] of omhCache.healthEquityGrants) {
    for (const grant of grants) {
      if (grant.progressStatus !== 'completed' && grant.progressStatus !== 'terminated') {
        activeGrants++;
        totalFunding += grant.awardAmount;

        if (grant.militaryPopulationIncluded) {
          programsServingMilitary++;
        }
      }
    }
  }

  const avgLifeExpectancy = disparityCount > 0 ? lifeExpectancySum / disparityCount : 0;
  const avgInfantMortality = disparityCount > 0 ? infantMortalitySum / disparityCount : 0;
  const avgDiabetes = disparityCount > 0 ? diabetesSum / disparityCount : 0;
  const avgHeartDisease = disparityCount > 0 ? heartDiseaseSum / disparityCount : 0;

  // Use national averages for comparison (these would be actual data in implementation)
  const nationalLifeExpectancy = 78.5;
  const nationalInfantMortality = 5.8;
  const nationalDiabetes = 11.0;
  const nationalHeartDisease = 6.2;

  return {
    totalMinorityPopulation,
    totalMilitaryMinorities,
    disparityIndicators: {
      lifeExpectancyGap: nationalLifeExpectancy - avgLifeExpectancy,
      infantMortalityRatio: avgInfantMortality / nationalInfantMortality,
      diabetesDisparityRatio: avgDiabetes / nationalDiabetes,
      heartDiseaseDisparityRatio: avgHeartDisease / nationalHeartDisease
    },
    interventionCapacity: {
      culturalCompetencyPrograms,
      communityHealthWorkers,
      activeGrants,
      totalFunding
    },
    militaryHealthEquity: {
      programsServingMilitary,
      militaryPersonnelTrained,
      veteransServed
    }
  };
}

// Cache management
export async function setOMHCache(
  disparitiesData: HealthDisparitiesData[],
  culturalCompetencyPrograms: CulturalCompetencyProgram[],
  communityHealthWorkers: CommunityHealthWorker[],
  healthEquityGrants: HealthEquityGrant[],
  surveillanceData: MinorityHealthSurveillance[]
): Promise<void> {
  omhCache._buildInProgress = true;
  omhCache._buildStartedAt = new Date().toISOString();

  try {
    // Clear existing cache
    omhCache.disparitiesData.clear();
    omhCache.culturalCompetencyPrograms.clear();
    omhCache.communityHealthWorkers.clear();
    omhCache.healthEquityGrants.clear();
    omhCache.surveillanceData.clear();

    // Grid-index all data types
    for (const data of disparitiesData) {
      const grid = gridKey(data.coordinates.lat, data.coordinates.lng);
      if (!omhCache.disparitiesData.has(grid)) {
        omhCache.disparitiesData.set(grid, []);
      }
      omhCache.disparitiesData.get(grid)!.push(data);
    }

    for (const program of culturalCompetencyPrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!omhCache.culturalCompetencyPrograms.has(grid)) {
        omhCache.culturalCompetencyPrograms.set(grid, []);
      }
      omhCache.culturalCompetencyPrograms.get(grid)!.push(program);
    }

    for (const chw of communityHealthWorkers) {
      const grid = gridKey(chw.primaryLocation.coordinates.lat, chw.primaryLocation.coordinates.lng);
      if (!omhCache.communityHealthWorkers.has(grid)) {
        omhCache.communityHealthWorkers.set(grid, []);
      }
      omhCache.communityHealthWorkers.get(grid)!.push(chw);
    }

    for (const grant of healthEquityGrants) {
      const grid = gridKey(grant.coordinates.lat, grant.coordinates.lng);
      if (!omhCache.healthEquityGrants.has(grid)) {
        omhCache.healthEquityGrants.set(grid, []);
      }
      omhCache.healthEquityGrants.get(grid)!.push(grant);
    }

    for (const surveillance of surveillanceData) {
      const grid = gridKey(surveillance.coordinates.lat, surveillance.coordinates.lng);
      if (!omhCache.surveillanceData.has(grid)) {
        omhCache.surveillanceData.set(grid, []);
      }
      omhCache.surveillanceData.get(grid)!.push(surveillance);
    }

    omhCache._lastUpdated = new Date().toISOString();

    saveCacheToDisk(CACHE_FILE, omhCache);
    await saveCacheToBlob(BLOB_KEY, omhCache);

  } finally {
    omhCache._buildInProgress = false;
    omhCache._buildStartedAt = '';
  }
}

export function getOMHCacheInfo(): {
  disparitiesDataCount: number;
  culturalProgramCount: number;
  communityHealthWorkerCount: number;
  healthEquityGrantCount: number;
  surveillanceSystemCount: number;
  lastUpdated: string;
  isBuilding: boolean;
} {
  let disparitiesDataCount = 0;
  let culturalProgramCount = 0;
  let communityHealthWorkerCount = 0;
  let healthEquityGrantCount = 0;
  let surveillanceSystemCount = 0;

  for (const data of omhCache.disparitiesData.values()) {
    disparitiesDataCount += data.length;
  }

  for (const programs of omhCache.culturalCompetencyPrograms.values()) {
    culturalProgramCount += programs.length;
  }

  for (const chws of omhCache.communityHealthWorkers.values()) {
    communityHealthWorkerCount += chws.length;
  }

  for (const grants of omhCache.healthEquityGrants.values()) {
    healthEquityGrantCount += grants.length;
  }

  for (const systems of omhCache.surveillanceData.values()) {
    surveillanceSystemCount += systems.length;
  }

  return {
    disparitiesDataCount,
    culturalProgramCount,
    communityHealthWorkerCount,
    healthEquityGrantCount,
    surveillanceSystemCount,
    lastUpdated: omhCache._lastUpdated,
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