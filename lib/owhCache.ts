/**
 * OWH (Office on Women's Health) Cache
 *
 * Women's health programs, research, and services data with focus on
 * military women, female veterans, and military spouses and families.
 *
 * Data Sources:
 * - Women's Health Research Programs
 * - Women's Preventive Services Guidelines
 * - Violence Against Women Prevention Programs
 * - Women's Health Information Resources
 * - Maternal Health Programs
 * - Reproductive Health Services
 * - Women's Health Professional Training
 * - Health Disparities in Women Programs
 *
 * Military Applications:
 * - Female military service member health outcomes
 * - Military spouse health and wellness programs
 * - Women veteran healthcare access and quality
 * - Maternal health for military families
 * - Gender-specific military healthcare services
 * - Military family planning and reproductive health
 * - Military sexual trauma and prevention programs
 * - Military women's mental health initiatives
 */

import { gridKey, loadCacheFromDisk, saveCacheToDisk, neighborKeys } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';

const CACHE_FILE = '.cache/owh-data.json';
const BLOB_KEY = 'owh-cache';
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

interface WomensHealthProgram {
  programId: string;
  programName: string;
  programType: 'research' | 'clinical_services' | 'education' | 'prevention' | 'policy' | 'training' | 'outreach';

  // Organization Information
  leadOrganization: string;
  organizationType: 'academic' | 'healthcare_system' | 'non_profit' | 'government' | 'military' | 'community';

  // Geographic Coverage
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
  targetPopulation: string[];
  ageGroups: {
    adolescent: boolean;
    reproductive_age: boolean;
    pregnancy: boolean;
    menopause: boolean;
    elderly: boolean;
  };

  // Health Focus Areas
  healthConditions: string[];
  preventiveServices: string[];
  clinicalSpecialties: string[];
  researchFoci: string[];

  // Military Connection
  militaryWomenFocus: boolean;
  militarySpouseFocus: boolean;
  femaleVeteranFocus: boolean;
  militaryFamilyServices: boolean;

  // Specific Military Services
  militaryServices: {
    deploymentHealthSupport: boolean;
    militarySpouseEmploymentHealth: boolean;
    childcareHealthSupport: boolean;
    militaryTraumaServices: boolean;
    familyPlanningForMilitary: boolean;
  };

  // Service Delivery
  participantsServed: {
    totalWomen: number;
    militaryWomen: number;
    militarySpouses: number;
    femaleVeterans: number;
    dependentDaughters: number;
  };

  servicesProvided: {
    clinicalCare: number;
    healthEducation: number;
    counselingServices: number;
    screeningServices: number;
    referrals: number;
  };

  // Clinical Outcomes
  clinicalOutcomes: {
    cancerScreeningRates: number;
    maternalHealthOutcomes: number;
    mentalHealthImprovements: number;
    preventiveCareUtilization: number;
    chronicDiseaseManagement: number;
  };

  // Research Activities
  researchStudies: {
    study: string;
    participants: number;
    militaryParticipants: number;
    focusArea: string;
    status: 'active' | 'completed' | 'planned';
  }[];

  // Training and Education
  trainingPrograms: {
    healthcareProfessionals: number;
    militaryProviders: number;
    militarySpouses: number;
    communityEducators: number;
  };

  // Violence Prevention
  violencePreventionServices: {
    domesticViolencePrevention: boolean;
    sexualAssaultPrevention: boolean;
    militaryTraumaPrevention: boolean;
    safetylPlanning: number;
    supportServices: number;
  };

  // Funding
  owhFunding: number;
  otherFederalFunding: number;
  stateFunding: number;
  privateFunding: number;
  totalBudget: number;

  // Quality and Accreditation
  qualityMeasures: {
    patientSatisfaction: number;
    clinicalQualityRating: number;
    accessibilityRating: number;
    culturalCompetencyRating: number;
  };

  grantPeriod: string;
  lastUpdated: string;
}

interface MaternalHealthInitiative {
  initiativeId: string;
  initiativeName: string;
  initiativeType: 'maternal_mortality' | 'prenatal_care' | 'postpartum_care' | 'high_risk_pregnancy' | 'breastfeeding' | 'family_planning';

  // Geographic Scope
  implementationLocation: {
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

  serviceRegion: string[];
  implementationSites: number;

  // Target Population
  targetMothers: {
    totalTarget: number;
    teenMothers: number;
    highriskPregnancies: number;
    minorityMothers: number;
    ruralMothers: number;
    militaryMothers: number;
    militarySpouses: number;
  };

  // Military Family Components
  militaryMaternalServices: {
    deploymentPregnancySupport: boolean;
    militarySpousePregnancy: boolean;
    overseasBirthSupport: boolean;
    militaryFamilyPlanning: boolean;
    tricareCordination: boolean;
  };

  // Services and Interventions
  interventionComponents: {
    prenatalEducation: boolean;
    nutritionCounseling: boolean;
    mentalHealthScreening: boolean;
    substanceAbuseSupport: boolean;
    domesticViolenceScreening: boolean;
    sociasupport: boolean;
  };

  clinicalServices: {
    prenatalVisits: number;
    ultrasouns: number;
    laboratoryTests: number;
    specialtyReferrals: number;
    emergencyInterventions: number;
  };

  // Outcomes Tracked
  maternalOutcomes: {
    maternalMortality: number;
    severeMaternalMorbidity: number;
    cesareanRate: number;
    preeclampsia: number;
    postpartumDepression: number;
  };

  infantOutcomes: {
    infantMortality: number;
    lowBirthWeight: number;
    pretermBirth: number;
    birthDefects: number;
    breastfeedingInitiation: number;
  };

  // Military-Specific Outcomes
  militaryOutcomes: {
    deploymentBirthOutcomes: number;
    militarySpouseOutcomes: number;
    overseasBirthComplications: number;
    militaryHospitalDeliveries: number;
  };

  // Healthcare System Integration
  hospitalPartnerships: string[];
  militaryTreatmentFacilities: string[];
  communityPartners: string[];
  specialtyProviders: string[];

  // Innovation and Technology
  telemedicineServices: boolean;
  mobileHealthApplications: string[];
  remoteMonitoring: boolean;
  electronicHealthRecords: boolean;

  // Quality Improvement
  qualityMetrics: {
    timelyPrenatalCare: number;
    appropriateWeight: number;
    tobaccoUse: number;
    breastfeedingSupport: number;
    postpartumVisits: number;
  };

  // Environmental Factors
  environmentalAssessments: {
    waterQualityImpact: boolean;
    airQualityAssessment: boolean;
    toxicExposureScreening: boolean;
    occupationalHazards: boolean;
  };

  implementationYear: number;
  lastUpdated: string;
}

interface WomensResearchStudy {
  studyId: string;
  studyTitle: string;
  studyType: 'clinical_trial' | 'observational' | 'epidemiological' | 'intervention' | 'survey' | 'registry';

  // Principal Investigator
  principalInvestigator: string;
  leadInstitution: string;
  collaboratingInstitutions: string[];

  // Study Location
  studyLocations: {
    location: string;
    city: string;
    state: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  }[];

  // Study Population
  targetSampleSize: number;
  currentEnrollment: number;
  participantDemographics: {
    ageRange: string;
    raceEthnicity: { [group: string]: number };
    socioeconomicStatus: string;
  };

  // Military Participants
  militaryParticipants: {
    activedutyWomen: number;
    femaleVeterans: number;
    militarySpouses: number;
    militaryDependents: number;
  };

  // Research Focus
  primaryResearchQuestion: string;
  healthConditionsStudied: string[];
  interventionsStudied: string[];
  outcomesMeasured: string[];

  // Military Relevance
  militaryHealthRelevance: 'high' | 'moderate' | 'low';
  deploymentHealthFocus: boolean;
  militaryOccupationalHealth: boolean;
  militaryFamilyHealth: boolean;

  // Study Design
  studyDesign: string;
  randomizedControlledTrial: boolean;
  longitudinalFollowup: boolean;
  followupDuration: number; // months
  primaryEndpoints: string[];

  // Data Collection
  dataCollectionMethods: string[];
  biospecimenCollection: boolean;
  imagingStudies: boolean;
  genomicAnalysis: boolean;
  environmentalExposureData: boolean;

  // Preliminary Findings
  preliminaryResults: {
    finding: string;
    statisticalSignificance: boolean;
    clinicalSignificance: string;
    militaryApplications: string;
  }[];

  // Policy Implications
  policyRelevance: string[];
  guidelineImpact: string[];
  clinicalPracticeImplications: string[];

  // Funding
  nihFunding: number;
  owhFunding: number;
  militaryFunding: number;
  industryFunding: number;
  totalFunding: number;

  // Timeline
  studyPeriod: {
    startDate: string;
    endDate: string;
  };

  recruitmentStatus: 'planning' | 'recruiting' | 'active' | 'followup' | 'completed';
  publicationPlanned: string[];

  lastUpdated: string;
}

interface WomensHealthTraining {
  trainingId: string;
  programName: string;
  trainingType: 'professional_education' | 'continuing_education' | 'certification' | 'fellowship' | 'residency' | 'community_education';

  // Training Institution
  institution: string;
  institutionType: 'medical_school' | 'nursing_school' | 'hospital' | 'military_facility' | 'academic_center' | 'professional_organization';

  // Location
  address: string;
  city: string;
  state: string;
  zipCode: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Training Characteristics
  targetAudience: string[];
  trainingDuration: number; // hours or days
  deliveryMode: string[];
  certificationOffered: boolean;
  continuingEducationCredits: number;

  // Military Integration
  militaryPersonnelTrained: {
    militaryPhysicians: number;
    militaryNurses: number;
    militaryMedics: number;
    militaryBehavioralHealth: number;
    militaryPublicHealth: number;
  };

  militaryHealthcareFacilities: string[];
  militaryPartnership: boolean;
  deploymentPreparation: boolean;

  // Training Content
  coreTopics: string[];
  specializedTopics: string[];
  clinicalSkills: string[];
  culturalCompetency: boolean;
  traumaInformedCare: boolean;

  // Military-Specific Training
  militarySpecificComponents: {
    deploymentHealth: boolean;
    militaryTrauma: boolean;
    militaryFamilyDynamics: boolean;
    militarySexualTrauma: boolean;
    militaryOccupationalHealth: boolean;
  };

  // Participants
  totalParticipants: number;
  participantsByRole: {
    physicians: number;
    nurses: number;
    midwives: number;
    socialWorkers: number;
    counselors: number;
    communityWorkers: number;
    militaryProviders: number;
  };

  // Evaluation
  trainingEvaluation: {
    knowledgeAssessment: {
      preTestScores: number;
      postTestScores: number;
      improvementPercentage: number;
    };
    competencyAssessment: {
      clinicalSkills: number;
      communicationSkills: number;
      culturalCompetency: number;
      traumaInformedCare: number;
    };
    participantSatisfaction: number;
  };

  // Clinical Impact
  clinicalImpact: {
    practiceChanges: string[];
    improvedPatientCare: string[];
    reducedDisparities: string[];
    enhancedMilitaryReadiness: string[];
  };

  // Follow-up
  followUpPeriod: number; // months
  retentionRate: number;
  implementationSupport: boolean;

  fundingSource: string;
  accreditation: string;
  lastTrainingDate: string;
  lastUpdated: string;
}

interface ViolencePreventionProgram {
  programId: string;
  programName: string;
  violenceType: 'domestic_violence' | 'sexual_assault' | 'dating_violence' | 'stalking' | 'military_sexual_trauma' | 'human_trafficking';

  // Program Location
  organizationName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  serviceArea: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Target Population
  primaryTarget: string[];
  ageGroups: string[];
  specialPopulations: {
    militaryServiceWomen: boolean;
    militarySpouses: boolean;
    femaleVeterans: boolean;
    militaryDependents: boolean;
    tribalWomen: boolean;
    lgbtqWomen: boolean;
  };

  // Military Focus
  militaryProgram: boolean;
  militaryInstallationServiced: string[];
  militaryPartnership: string[];
  militarySexualTraumaFocus: boolean;

  // Prevention Services
  preventionActivities: {
    educationPrograms: number;
    awarenessEvents: number;
    trainingWorkshops: number;
    communityfoutreach: number;
    mediaActivisms: number;
  };

  // Support Services
  supportServices: {
    crisisCounseling: boolean;
    safetyPlanning: boolean;
    legalAdvocacy: boolean;
    emergencyShelter: boolean;
    transportationAssistance: boolean;
    childcareServices: boolean;
  };

  // Military-Specific Services
  militaryServices: {
    unrestrictedReporting: boolean;
    restrictedReporting: boolean;
    militaryLiaison: boolean;
    commandNotification: boolean;
    deploymentSafetyPlanning: boolean;
  };

  // Service Volume
  clientsServed: {
    totalClients: number;
    militaryServiceWomen: number;
    militarySpouses: number;
    femaleVeterans: number;
    newClients: number;
    ongoingClients: number;
  };

  // Crisis Response
  crisisResponse: {
    hotlineCalls: number;
    emergencyInterventions: number;
    hospitalAdvocacy: number;
    legalAdvocacy: number;
    safetyPlanningMeetings: number;
  };

  // Training and Education
  communityTraining: {
    lawEnforcement: number;
    healthcare: number;
    educationalPersonnel: number;
    militaryPersonnel: number;
    socialServices: number;
  };

  // Collaboration
  partnerOrganizations: string[];
  lawEnforcementPartnerships: string[];
  healthcarePlaterships: string[];
  militaryPartnerships: string[];

  // Outcomes
  clientOutcomes: {
    safetyImproved: number;
    independenceAchieved: number;
    housingSecured: number;
    legalResolutionAchieved: number;
    employmentObtained: number;
  };

  // Environmental Safety
  environmentalSafetyFactors: {
    communityLightingPrograms: boolean;
    safewalkPrograms: boolean;
    campusSafetyInitiatives: boolean;
    publictransportationSafety: boolean;
  };

  fundingSource: string[];
  totalBudget: number;
  lastServiceDate: string;
  lastUpdated: string;
}

interface OWHCache {
  womensHealthPrograms: Map<string, WomensHealthProgram[]>;
  maternalHealthInitiatives: Map<string, MaternalHealthInitiative[]>;
  researchStudies: Map<string, WomensResearchStudy[]>;
  trainingPrograms: Map<string, WomensHealthTraining[]>;
  violencePreventionPrograms: Map<string, ViolencePreventionProgram[]>;
  _lastUpdated: string;
  _buildInProgress: boolean;
  _buildStartedAt: string;
}

let owhCache: OWHCache = {
  womensHealthPrograms: new Map(),
  maternalHealthInitiatives: new Map(),
  researchStudies: new Map(),
  trainingPrograms: new Map(),
  violencePreventionPrograms: new Map(),
  _lastUpdated: '',
  _buildInProgress: false,
  _buildStartedAt: ''
};

// Build lock management
function isBuildInProgress(): boolean {
  if (!owhCache._buildInProgress) return false;

  const buildStartTime = new Date(owhCache._buildStartedAt).getTime();
  const now = Date.now();

  if (now - buildStartTime > BUILD_LOCK_TIMEOUT_MS) {
    console.log('OWH build lock timeout reached, clearing lock');
    owhCache._buildInProgress = false;
    owhCache._buildStartedAt = '';
    return false;
  }

  return true;
}

// Cache warming
export async function ensureWarmed(): Promise<void> {
  if (owhCache.womensHealthPrograms.size === 0) {
    await loadCacheFromDisk(owhCache, CACHE_FILE);

    if (owhCache.womensHealthPrograms.size === 0) {
      await loadCacheFromBlob(owhCache, BLOB_KEY);
    }
  }
}

// Geographic queries
export async function getMilitaryWomensHealthServices(
  lat: number,
  lng: number,
  radius: number = 50
): Promise<{
  healthPrograms: WomensHealthProgram[];
  maternalServices: MaternalHealthInitiative[];
  trainingPrograms: WomensHealthTraining[];
  violencePrevention: ViolencePreventionProgram[];
}> {
  await ensureWarmed();

  const centerGrid = gridKey(lat, lng);
  const searchGrids = [centerGrid, ...neighborKeys(lat, lng, Math.ceil(radius / 11.1))];

  const healthPrograms: WomensHealthProgram[] = [];
  const maternalServices: MaternalHealthInitiative[] = [];
  const trainingPrograms: WomensHealthTraining[] = [];
  const violencePrevention: ViolencePreventionProgram[] = [];

  for (const grid of searchGrids) {
    // Women's health programs serving military
    const gridPrograms = owhCache.womensHealthPrograms.get(grid) || [];
    for (const program of gridPrograms) {
      const distance = haversineDistance(lat, lng, program.coordinates.lat, program.coordinates.lng);
      if (distance <= radius && (program.militaryWomenFocus || program.militarySpouseFocus || program.femaleVeteranFocus)) {
        healthPrograms.push(program);
      }
    }

    // Maternal health initiatives for military families
    const gridMaternal = owhCache.maternalHealthInitiatives.get(grid) || [];
    for (const initiative of gridMaternal) {
      const distance = haversineDistance(lat, lng, initiative.implementationLocation.coordinates.lat, initiative.implementationLocation.coordinates.lng);
      if (distance <= radius && (initiative.targetMothers.militaryMothers > 0 || initiative.targetMothers.militarySpouses > 0)) {
        maternalServices.push(initiative);
      }
    }

    // Training programs for military providers
    const gridTraining = owhCache.trainingPrograms.get(grid) || [];
    for (const training of gridTraining) {
      const distance = haversineDistance(lat, lng, training.coordinates.lat, training.coordinates.lng);
      if (distance <= radius && training.militaryPartnership) {
        trainingPrograms.push(training);
      }
    }

    // Violence prevention serving military women
    const gridViolence = owhCache.violencePreventionPrograms.get(grid) || [];
    for (const program of gridViolence) {
      const distance = haversineDistance(lat, lng, program.coordinates.lat, program.coordinates.lng);
      if (distance <= radius && program.militaryProgram) {
        violencePrevention.push(program);
      }
    }
  }

  return {
    healthPrograms: healthPrograms.sort((a, b) => (b.participantsServed.militaryWomen + b.participantsServed.militarySpouses) - (a.participantsServed.militaryWomen + a.participantsServed.militarySpouses)),
    maternalServices: maternalServices.sort((a, b) => (b.targetMothers.militaryMothers + b.targetMothers.militarySpouses) - (a.targetMothers.militaryMothers + a.targetMothers.militarySpouses)),
    trainingPrograms: trainingPrograms.sort((a, b) => Object.values(b.militaryPersonnelTrained).reduce((sum, val) => sum + val, 0) - Object.values(a.militaryPersonnelTrained).reduce((sum, val) => sum + val, 0)),
    violencePrevention: violencePrevention.sort((a, b) => (b.clientsServed.militaryServiceWomen + b.clientsServed.militarySpouses) - (a.clientsServed.militaryServiceWomen + a.clientsServed.militarySpouses))
  };
}

export async function getMilitaryWomensResearch(): Promise<{
  studies: WomensResearchStudy[];
  totalMilitaryParticipants: number;
  highRelevanceStudies: number;
  totalFunding: number;
}> {
  await ensureWarmed();

  const studies: WomensResearchStudy[] = [];
  let totalMilitaryParticipants = 0;
  let highRelevanceStudies = 0;
  let totalFunding = 0;

  for (const [grid, gridStudies] of owhCache.researchStudies) {
    for (const study of gridStudies) {
      const militaryParticipants = study.militaryParticipants.activedutyWomen +
                                 study.militaryParticipants.femaleVeterans +
                                 study.militaryParticipants.militarySpouses;

      if (militaryParticipants > 0 || study.militaryHealthRelevance !== 'low') {
        studies.push(study);
        totalMilitaryParticipants += militaryParticipants;
        totalFunding += study.militaryFunding;

        if (study.militaryHealthRelevance === 'high') {
          highRelevanceStudies++;
        }
      }
    }
  }

  return {
    studies: studies.sort((a, b) =>
      (b.militaryParticipants.activedutyWomen + b.militaryParticipants.femaleVeterans + b.militaryParticipants.militarySpouses) -
      (a.militaryParticipants.activedutyWomen + a.militaryParticipants.femaleVeterans + a.militaryParticipants.militarySpouses)
    ),
    totalMilitaryParticipants,
    highRelevanceStudies,
    totalFunding
  };
}

// Analytics
export async function calculateWomensHealthMetrics(): Promise<{
  totalWomenServed: number;
  militaryWomenServed: {
    activeduty: number;
    spouses: number;
    veterans: number;
    dependents: number;
  };
  maternalHealth: {
    pregnanciesSupported: number;
    militaryPregnancies: number;
    maternalOutcomes: number;
  };
  violencePreventionReach: {
    totalClientsServed: number;
    militaryClientsServed: number;
    crisisInterventions: number;
  };
  researchCapacity: {
    activeStudies: number;
    militaryParticipants: number;
    totalFunding: number;
  };
}> {
  await ensureWarmed();

  let totalWomenServed = 0;
  const militaryWomenServed = {
    activeduty: 0,
    spouses: 0,
    veterans: 0,
    dependents: 0
  };

  const maternalHealth = {
    pregnanciesSupported: 0,
    militaryPregnancies: 0,
    maternalOutcomes: 0
  };

  const violencePreventionReach = {
    totalClientsServed: 0,
    militaryClientsServed: 0,
    crisisInterventions: 0
  };

  const researchCapacity = {
    activeStudies: 0,
    militaryParticipants: 0,
    totalFunding: 0
  };

  // Women's health programs metrics
  for (const [grid, programs] of owhCache.womensHealthPrograms) {
    for (const program of programs) {
      totalWomenServed += program.participantsServed.totalWomen;
      militaryWomenServed.activeduty += program.participantsServed.militaryWomen;
      militaryWomenServed.spouses += program.participantsServed.militarySpouses;
      militaryWomenServed.veterans += program.participantsServed.femaleVeterans;
      militaryWomenServed.dependents += program.participantsServed.dependentDaughters;
    }
  }

  // Maternal health metrics
  for (const [grid, initiatives] of owhCache.maternalHealthInitiatives) {
    for (const initiative of initiatives) {
      maternalHealth.pregnanciesSupported += initiative.targetMothers.totalTarget;
      maternalHealth.militaryPregnancies += initiative.targetMothers.militaryMothers + initiative.targetMothers.militarySpouses;
    }
  }

  // Violence prevention metrics
  for (const [grid, programs] of owhCache.violencePreventionPrograms) {
    for (const program of programs) {
      violencePreventionReach.totalClientsServed += program.clientsServed.totalClients;
      violencePreventionReach.militaryClientsServed += program.clientsServed.militaryServiceWomen + program.clientsServed.militarySpouses;
      violencePreventionReach.crisisInterventions += program.crisisResponse.emergencyInterventions;
    }
  }

  // Research metrics
  for (const [grid, studies] of owhCache.researchStudies) {
    for (const study of studies) {
      if (study.recruitmentStatus === 'recruiting' || study.recruitmentStatus === 'active') {
        researchCapacity.activeStudies++;
      }

      researchCapacity.militaryParticipants += study.militaryParticipants.activedutyWomen +
                                             study.militaryParticipants.femaleVeterans +
                                             study.militaryParticipants.militarySpouses;
      researchCapacity.totalFunding += study.totalFunding;
    }
  }

  return {
    totalWomenServed,
    militaryWomenServed,
    maternalHealth,
    violencePreventionReach,
    researchCapacity
  };
}

// Cache management
export async function setOWHCache(
  womensHealthPrograms: WomensHealthProgram[],
  maternalHealthInitiatives: MaternalHealthInitiative[],
  researchStudies: WomensResearchStudy[],
  trainingPrograms: WomensHealthTraining[],
  violencePreventionPrograms: ViolencePreventionProgram[]
): Promise<void> {
  owhCache._buildInProgress = true;
  owhCache._buildStartedAt = new Date().toISOString();

  try {
    // Clear existing cache
    owhCache.womensHealthPrograms.clear();
    owhCache.maternalHealthInitiatives.clear();
    owhCache.researchStudies.clear();
    owhCache.trainingPrograms.clear();
    owhCache.violencePreventionPrograms.clear();

    // Grid-index all data types
    for (const program of womensHealthPrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!owhCache.womensHealthPrograms.has(grid)) {
        owhCache.womensHealthPrograms.set(grid, []);
      }
      owhCache.womensHealthPrograms.get(grid)!.push(program);
    }

    for (const initiative of maternalHealthInitiatives) {
      const grid = gridKey(initiative.implementationLocation.coordinates.lat, initiative.implementationLocation.coordinates.lng);
      if (!owhCache.maternalHealthInitiatives.has(grid)) {
        owhCache.maternalHealthInitiatives.set(grid, []);
      }
      owhCache.maternalHealthInitiatives.get(grid)!.push(initiative);
    }

    for (const study of researchStudies) {
      // Use first study location for grid indexing
      if (study.studyLocations.length > 0) {
        const grid = gridKey(study.studyLocations[0].coordinates.lat, study.studyLocations[0].coordinates.lng);
        if (!owhCache.researchStudies.has(grid)) {
          owhCache.researchStudies.set(grid, []);
        }
        owhCache.researchStudies.get(grid)!.push(study);
      }
    }

    for (const training of trainingPrograms) {
      const grid = gridKey(training.coordinates.lat, training.coordinates.lng);
      if (!owhCache.trainingPrograms.has(grid)) {
        owhCache.trainingPrograms.set(grid, []);
      }
      owhCache.trainingPrograms.get(grid)!.push(training);
    }

    for (const program of violencePreventionPrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!owhCache.violencePreventionPrograms.has(grid)) {
        owhCache.violencePreventionPrograms.set(grid, []);
      }
      owhCache.violencePreventionPrograms.get(grid)!.push(program);
    }

    owhCache._lastUpdated = new Date().toISOString();

    await saveCacheToDisk(owhCache, CACHE_FILE);
    await saveCacheToBlob(owhCache, BLOB_KEY);

  } finally {
    owhCache._buildInProgress = false;
    owhCache._buildStartedAt = '';
  }
}

export function getOWHCacheInfo(): {
  womensHealthProgramCount: number;
  maternalHealthInitiativeCount: number;
  researchStudyCount: number;
  trainingProgramCount: number;
  violencePreventionProgramCount: number;
  lastUpdated: string;
  isBuilding: boolean;
} {
  let womensHealthProgramCount = 0;
  let maternalHealthInitiativeCount = 0;
  let researchStudyCount = 0;
  let trainingProgramCount = 0;
  let violencePreventionProgramCount = 0;

  for (const programs of owhCache.womensHealthPrograms.values()) {
    womensHealthProgramCount += programs.length;
  }

  for (const initiatives of owhCache.maternalHealthInitiatives.values()) {
    maternalHealthInitiativeCount += initiatives.length;
  }

  for (const studies of owhCache.researchStudies.values()) {
    researchStudyCount += studies.length;
  }

  for (const programs of owhCache.trainingPrograms.values()) {
    trainingProgramCount += programs.length;
  }

  for (const programs of owhCache.violencePreventionPrograms.values()) {
    violencePreventionProgramCount += programs.length;
  }

  return {
    womensHealthProgramCount,
    maternalHealthInitiativeCount,
    researchStudyCount,
    trainingProgramCount,
    violencePreventionProgramCount,
    lastUpdated: owhCache._lastUpdated,
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