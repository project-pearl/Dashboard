/**
 * ODPHP (Office of Disease Prevention and Health Promotion) Cache
 *
 * Disease prevention and health promotion programs, including Healthy People objectives,
 * physical activity, nutrition, and preventive health measures for military readiness.
 *
 * Data Sources:
 * - Healthy People 2030 objectives
 * - Physical Activity Guidelines implementation
 * - Nutrition and dietary guidelines programs
 * - Health Promotion and Disease Prevention Programs
 * - MyHealthfinder resources
 * - HealthyPeople.gov data
 * - Workplace Health Promotion Programs
 * - Community Preventive Services Task Force recommendations
 *
 * Military Applications:
 * - Military fitness and readiness promotion
 * - Deployment health preparation programs
 * - Military family wellness initiatives
 * - Preventive health measures for service members
 * - Military installation health promotion
 * - Veteran wellness and prevention programs
 * - Military spouse and family health promotion
 * - Occupational health for military personnel
 */

import { gridKey, loadCacheFromDisk, saveCacheToDisk, neighborKeys } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';

const CACHE_FILE = '.cache/odphp-data.json';
const BLOB_KEY = 'odphp-cache';
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

interface HealthyPeopleObjective {
  objectiveId: string;
  objectiveCode: string; // e.g., "NWS-01", "PAF-02"
  topicArea: string;
  objectiveTitle: string;

  // Geographic Scope
  geographicLevel: 'national' | 'state' | 'county' | 'local' | 'tribal';
  applicableStates: string[];
  applicableCounties: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Target Population
  targetPopulation: string[];
  ageGroups: {
    children: boolean;
    adolescents: boolean;
    adults: boolean;
    olderAdults: boolean;
  };

  demographicFocus: {
    raceEthnicity: string[];
    socioeconomicStatus: string[];
    disability: boolean;
    lgbtq: boolean;
  };

  // Military Relevance
  militaryRelevance: 'high' | 'moderate' | 'low';
  applicableToMilitary: {
    activeduty: boolean;
    veterans: boolean;
    militaryFamilies: boolean;
    militaryDependents: boolean;
    reserveGuard: boolean;
  };

  // Objective Details
  objectiveStatement: string;
  baselineData: {
    year: number;
    value: number;
    dataSource: string;
  };

  targetData: {
    year: number;
    value: number;
    improvementDirection: 'increase' | 'decrease' | 'maintain';
  };

  // Current Progress
  currentData: {
    year: number;
    value: number;
    progressTowardTarget: number; // percentage
    trendDirection: 'improving' | 'stable' | 'worsening' | 'no_change';
  };

  // Military-Specific Data
  militaryBaseline: {
    activedutyValue: number | null;
    veteranValue: number | null;
    militaryFamilyValue: number | null;
  };

  // Evidence-Based Interventions
  evidenceBasedInterventions: {
    intervention: string;
    effectiveness: 'recommended' | 'sufficient_evidence' | 'insufficient_evidence';
    applicabilityToMilitary: boolean;
    implementationGuidance: string;
  }[];

  // Health Determinants
  socialDeterminants: string[];
  environmentalFactors: string[];
  behavioralFactors: string[];
  systemFactors: string[];

  // Related Objectives
  relatedObjectives: string[];
  crossCuttingObjectives: string[];

  lastDataUpdate: string;
  lastUpdated: string;
}

interface PhysicalActivityProgram {
  programId: string;
  programName: string;
  programType: 'community' | 'workplace' | 'school' | 'healthcare' | 'military' | 'family' | 'clinical';

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
  targetPopulation: {
    totalParticipants: number;
    ageGroups: {
      preschool: number;
      schoolAge: number;
      adolescents: number;
      adults: number;
      olderAdults: number;
    };
    specialPopulations: {
      disabilities: number;
      chronicConditions: number;
      lowIncome: number;
    };
  };

  // Military Participants
  militaryParticipants: {
    activedutyServiceMembers: number;
    veterans: number;
    militarySpouses: number;
    militaryChildren: number;
    reserveGuard: number;
  };

  // Program Components
  programComponents: {
    aerobicActivities: boolean;
    muscleStrengthening: boolean;
    flexibility: boolean;
    balanceTraining: boolean;
    sportActivities: boolean;
    recreationalActivities: boolean;
  };

  // Military-Specific Components
  militaryComponents: {
    combatFitnessTraining: boolean;
    deploymentPreparation: boolean;
    militaryFamilyFitness: boolean;
    veteranWellnessPrograms: boolean;
    adaptedFitnessForDisabilities: boolean;
  };

  // Intensity and Duration
  programIntensity: {
    lightIntensity: boolean;
    moderateIntensity: boolean;
    vigorousIntensity: boolean;
    mixedIntensity: boolean;
  };

  sessionDetails: {
    frequencyPerWeek: number;
    durationMinutes: number;
    programLengthWeeks: number;
  };

  // Settings and Environment
  programSettings: string[];
  facilitiesUsed: string[];
  equipmentProvided: boolean;
  accessibilityFeatures: string[];

  // Staff and Leadership
  staffing: {
    certifiedFitnessInstructors: number;
    healthcareProfessionals: number;
    volunteerLeaders: number;
    peerSupport: number;
    militaryInstructors: number;
  };

  // Outcomes Measured
  healthOutcomes: {
    physicalFitness: boolean;
    cardiovascularHealth: boolean;
    muscularStrength: boolean;
    flexibility: boolean;
    bodyComposition: boolean;
    mentalHealth: boolean;
  };

  // Results
  outcomeResults: {
    fitnessImprovement: number; // percentage of participants
    healthMarkerImprovement: number;
    retentionRate: number;
    satisfactionRating: number; // 1-10 scale
    adherenceRate: number;
  };

  // Environmental Health
  environmentalFactors: {
    airQualityConsidered: boolean;
    indoorEnvironment: boolean;
    outdoorSafety: boolean;
    weatherConsiderations: boolean;
  };

  // Funding and Sustainability
  fundingSource: string[];
  totalBudget: number;
  costPerParticipant: number;
  sustainabilityPlan: boolean;

  programYear: number;
  lastUpdated: string;
}

interface NutritionProgram {
  programId: string;
  programName: string;
  nutritionFocus: 'general_nutrition' | 'weight_management' | 'chronic_disease' | 'food_security' | 'dietary_guidelines' | 'special_populations';

  // Program Organization
  leadOrganization: string;
  organizationType: 'healthcare' | 'community' | 'school' | 'workplace' | 'military' | 'faith_based';

  // Geographic Coverage
  address: string;
  city: string;
  state: string;
  zipCode: string;
  serviceRegion: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Participant Demographics
  participantsServed: {
    totalParticipants: number;
    ageGroups: {
      infants: number;
      children: number;
      adolescents: number;
      adults: number;
      elderlyAdults: number;
    };
    specialNeeds: {
      diabetes: number;
      heartDisease: number;
      foodAllergies: number;
      eatingDisorders: number;
    };
  };

  // Military Population
  militaryParticipants: {
    activedutyServiceMembers: number;
    veterans: number;
    militarySpouses: number;
    militaryFamilies: number;
    dependents: number;
  };

  // Program Services
  nutritionServices: {
    nutritionEducation: boolean;
    individualCounseling: boolean;
    groupEducation: boolean;
    mealPlanning: boolean;
    cookingClasses: boolean;
    foodDemonstrations: boolean;
  };

  // Military-Specific Services
  militaryNutritionServices: {
    deploymentNutritionPrep: boolean;
    combatReadinessNutrition: boolean;
    militaryFamilyMealPlanning: boolean;
    fieldRationEducation: boolean;
    specialDietaryNeeds: boolean;
  };

  // Educational Components
  educationalTopics: {
    dietaryGuidelines: boolean;
    portionControl: boolean;
    foodSafety: boolean;
    nutritionLabeling: boolean;
    budgetFriendlyEating: boolean;
    culturalFoodPreferences: boolean;
  };

  // Behavior Change Support
  behaviorChangeStrategies: {
    goalSetting: boolean;
    selfMonitoring: boolean;
    motivationalInterviewing: boolean;
    stageBasedInterventions: boolean;
    socialSupport: boolean;
  };

  // Technology Integration
  technologyComponents: {
    mobileApps: boolean;
    onlineResources: boolean;
    wearableDevices: boolean;
    telehealth: boolean;
    socialMedia: boolean;
  };

  // Environmental and Policy
  environmentalChanges: {
    healthyFoodAccess: boolean;
    workplaceFoodPolicies: boolean;
    communityGardens: boolean;
    farmerMarkets: boolean;
    foodRetailImprovements: boolean;
  };

  // Outcomes and Evaluation
  healthOutcomes: {
    dietaryImprovement: number; // percentage
    weightManagement: number;
    biomarkerChanges: number;
    knowledgeIncrease: number;
    behaviorChange: number;
  };

  // Program Quality
  evidenceBased: boolean;
  culturallyAppropriate: boolean;
  staffCredentials: string[];
  qualityAssurance: boolean;

  // Military Readiness Impact
  militaryReadinessImpact: {
    physicalReadinessImprovement: boolean;
    deploymentPreparation: boolean;
    familyResilienceSupport: boolean;
    healthcareCostReduction: boolean;
  };

  fundingAmount: number;
  programDuration: number; // weeks
  lastServiceDate: string;
  lastUpdated: string;
}

interface WorkplaceWellnessProgram {
  programId: string;
  programName: string;
  workplaceType: 'corporate' | 'government' | 'healthcare' | 'education' | 'military' | 'manufacturing' | 'retail';

  // Workplace Information
  organizationName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  industry: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Employee Population
  employeePopulation: {
    totalEmployees: number;
    participatingEmployees: number;
    participationRate: number;
    eligibleEmployees: number;
  };

  // Military-Specific Information
  militaryWorkplace: boolean;
  militaryContractor: boolean;
  veteranEmployees: number;
  militarySpouseEmployees: number;
  federalEmployees: number;

  // Program Components
  wellnessPrograms: {
    healthScreenings: boolean;
    fitnessPrograms: boolean;
    nutritionPrograms: boolean;
    stressManagement: boolean;
    smokingCessation: boolean;
    mentalHealthSupport: boolean;
    ergonomics: boolean;
    vaccinationPrograms: boolean;
  };

  // Military-Specific Components
  militaryPrograms: {
    deploymentPreparation: boolean;
    familySupport: boolean;
    ptsdSupport: boolean;
    veteranTransitionSupport: boolean;
    militaryFamilyServices: boolean;
  };

  // Preventive Services
  preventiveServices: {
    annualPhysicals: boolean;
    cancerScreenings: boolean;
    cardiovascularScreenings: boolean;
    mentalHealthScreenings: boolean;
    immunizations: boolean;
    healthRiskAssessments: boolean;
  };

  // Environmental Health
  workplaceEnvironment: {
    airQualityPrograms: boolean;
    ergonomicAssessments: boolean;
    safetyTraining: boolean;
    injuryPrevention: boolean;
    chemicalExposureMonitoring: boolean;
  };

  // Health Promotion Activities
  healthPromotionActivities: {
    healthFairs: number; // annual count
    wellnessChallenes: number;
    educationalSeminars: number;
    supportGroups: number;
    peerSupport: boolean;
  };

  // Incentive Programs
  incentivePrograms: {
    financialIncentives: boolean;
    timeOffIncentives: boolean;
    recognitionPrograms: boolean;
    healthSavingsAccounts: boolean;
    gymMemberships: boolean;
  };

  // Technology Support
  technologyPlatforms: {
    wellnessPortals: boolean;
    mobileApps: boolean;
    wearableDeviceSupport: boolean;
    telehealth: boolean;
    onlineCoaching: boolean;
  };

  // Health Outcomes
  healthOutcomes: {
    healthRiskReduction: number; // percentage
    absenteeismReduction: number;
    healthcareCostReduction: number;
    employeeSatisfaction: number;
    productivityImprovement: number;
  };

  // Military Readiness Outcomes
  militaryReadinessOutcomes: {
    deploymentReadiness: number;
    physicalFitnessImprovement: number;
    mentalHealthImprovement: number;
    familyStabilityImprovement: number;
  };

  // Program Management
  programManagement: {
    dedicatedStaff: number;
    healthProfessionals: number;
    programBudget: number;
    vendorPartnerships: string[];
    healthcareIntegration: boolean;
  };

  // Evaluation and Quality
  programEvaluation: {
    roiMeasurement: boolean;
    healthOutcomesTracked: boolean;
    participantSatisfaction: number;
    programEffectiveness: number;
    dataPrivacyCompliance: boolean;
  };

  implementationYear: number;
  lastUpdated: string;
}

interface CommunityPreventionService {
  serviceId: string;
  serviceName: string;
  interventionCategory: 'behavioral' | 'environmental' | 'policy' | 'clinical' | 'educational';

  // Service Provider
  providerOrganization: string;
  providerType: 'health_department' | 'community_center' | 'healthcare_system' | 'military_facility' | 'non_profit';

  // Service Location
  address: string;
  city: string;
  state: string;
  zipCode: string;
  serviceArea: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Target Health Conditions
  healthConditionsAddressed: string[];
  riskFactorsTargeted: string[];
  populationHealth: string[];

  // Population Served
  targetPopulation: {
    totalReach: number;
    ageGroups: {
      children: number;
      adolescents: number;
      adults: number;
      olderAdults: number;
    };
    demographics: {
      minorityPopulations: number;
      lowIncomeIndividuals: number;
      ruralResidents: number;
      disablingConditions: number;
    };
  };

  // Military Population
  militaryPopulationServed: {
    activedutyMembers: number;
    veterans: number;
    militaryFamilies: number;
    militaryDependents: number;
    reserveGuardMembers: number;
  };

  // Evidence Base
  evidenceClassification: 'recommended' | 'sufficient_evidence' | 'insufficient_evidence';
  systematicReviews: number;
  taskForceRecommendation: string;
  implementationGuidance: boolean;

  // Intervention Components
  interventionComponents: {
    individualBehaviorChange: boolean;
    groupInterventions: boolean;
    communitylevelChanges: boolean;
    policyChanges: boolean;
    environmentalModifications: boolean;
  };

  // Military-Specific Adaptations
  militaryAdaptations: {
    deploymentConsiderations: boolean;
    militaryCultureIntegration: boolean;
    familySupport: boolean;
    commandSupport: boolean;
    militaryHealthcareIntegration: boolean;
  };

  // Implementation
  implementationSettings: string[];
  implementationBarriers: string[];
  implementationFacilitators: string[];
  resourceRequirements: string[];

  // Effectiveness
  effectivenessData: {
    primaryOutcome: string;
    effectSize: number;
    confidenceInterval: string;
    statisticalSignificance: boolean;
    clinicalSignificance: string;
  };

  // Economic Evidence
  economicEvidence: {
    costEffective: boolean;
    costPerQaly: number | null;
    netBenefit: number | null;
    returnOnInvestment: number | null;
  };

  // Applicability
  applicabilityFactors: {
    populationApplicability: string;
    settingApplicability: string;
    resourceApplicability: string;
    timeApplicability: string;
  };

  // Environmental Health
  environmentalConsiderations: {
    physicalEnvironment: string[];
    socialEnvironment: string[];
    economicEnvironment: string[];
    policyEnvironment: string[];
  };

  lastReview: string;
  lastUpdated: string;
}

interface ODPHPCache {
  healthyPeopleObjectives: Map<string, HealthyPeopleObjective[]>;
  physicalActivityPrograms: Map<string, PhysicalActivityProgram[]>;
  nutritionPrograms: Map<string, NutritionProgram[]>;
  workplaceWellnessPrograms: Map<string, WorkplaceWellnessProgram[]>;
  communityPreventionServices: Map<string, CommunityPreventionService[]>;
  _lastUpdated: string;
  _buildInProgress: boolean;
  _buildStartedAt: string;
}

let odphpCache: ODPHPCache = {
  healthyPeopleObjectives: new Map(),
  physicalActivityPrograms: new Map(),
  nutritionPrograms: new Map(),
  workplaceWellnessPrograms: new Map(),
  communityPreventionServices: new Map(),
  _lastUpdated: '',
  _buildInProgress: false,
  _buildStartedAt: ''
};

// Build lock management
function isBuildInProgress(): boolean {
  if (!odphpCache._buildInProgress) return false;

  const buildStartTime = new Date(odphpCache._buildStartedAt).getTime();
  const now = Date.now();

  if (now - buildStartTime > BUILD_LOCK_TIMEOUT_MS) {
    console.log('ODPHP build lock timeout reached, clearing lock');
    odphpCache._buildInProgress = false;
    odphpCache._buildStartedAt = '';
    return false;
  }

  return true;
}

// Cache warming
export async function ensureWarmed(): Promise<void> {
  if (odphpCache.healthyPeopleObjectives.size === 0) {
    await loadCacheFromDisk(odphpCache, CACHE_FILE);

    if (odphpCache.healthyPeopleObjectives.size === 0) {
      await loadCacheFromBlob(odphpCache, BLOB_KEY);
    }
  }
}

// Geographic queries
export async function getMilitaryWellnessPrograms(
  lat: number,
  lng: number,
  radius: number = 50
): Promise<{
  physicalActivityPrograms: PhysicalActivityProgram[];
  nutritionPrograms: NutritionProgram[];
  workplacePrograms: WorkplaceWellnessProgram[];
  preventionServices: CommunityPreventionService[];
}> {
  await ensureWarmed();

  const centerGrid = gridKey(lat, lng);
  const searchGrids = [centerGrid, ...neighborKeys(lat, lng, Math.ceil(radius / 11.1))];

  const physicalActivityPrograms: PhysicalActivityProgram[] = [];
  const nutritionPrograms: NutritionProgram[] = [];
  const workplacePrograms: WorkplaceWellnessProgram[] = [];
  const preventionServices: CommunityPreventionService[] = [];

  for (const grid of searchGrids) {
    // Physical activity programs serving military
    const gridPA = odphpCache.physicalActivityPrograms.get(grid) || [];
    for (const program of gridPA) {
      const distance = haversineDistance(lat, lng, program.coordinates.lat, program.coordinates.lng);
      if (distance <= radius &&
          (Object.values(program.militaryParticipants).reduce((sum, val) => sum + val, 0) > 0 ||
           program.militaryComponents.combatFitnessTraining ||
           program.programType === 'military')) {
        physicalActivityPrograms.push(program);
      }
    }

    // Nutrition programs serving military
    const gridNutrition = odphpCache.nutritionPrograms.get(grid) || [];
    for (const program of gridNutrition) {
      const distance = haversineDistance(lat, lng, program.coordinates.lat, program.coordinates.lng);
      if (distance <= radius &&
          (Object.values(program.militaryParticipants).reduce((sum, val) => sum + val, 0) > 0 ||
           program.organizationType === 'military')) {
        nutritionPrograms.push(program);
      }
    }

    // Workplace wellness programs
    const gridWorkplace = odphpCache.workplaceWellnessPrograms.get(grid) || [];
    for (const program of gridWorkplace) {
      const distance = haversineDistance(lat, lng, program.coordinates.lat, program.coordinates.lng);
      if (distance <= radius &&
          (program.militaryWorkplace || program.veteranEmployees > 0 || program.workplaceType === 'military')) {
        workplacePrograms.push(program);
      }
    }

    // Community prevention services
    const gridPrevention = odphpCache.communityPreventionServices.get(grid) || [];
    for (const service of gridPrevention) {
      const distance = haversineDistance(lat, lng, service.coordinates.lat, service.coordinates.lng);
      if (distance <= radius &&
          (Object.values(service.militaryPopulationServed).reduce((sum, val) => sum + val, 0) > 0 ||
           service.providerType === 'military_facility')) {
        preventionServices.push(service);
      }
    }
  }

  return {
    physicalActivityPrograms: physicalActivityPrograms.sort((a, b) =>
      Object.values(b.militaryParticipants).reduce((sum, val) => sum + val, 0) -
      Object.values(a.militaryParticipants).reduce((sum, val) => sum + val, 0)
    ),
    nutritionPrograms: nutritionPrograms.sort((a, b) =>
      Object.values(b.militaryParticipants).reduce((sum, val) => sum + val, 0) -
      Object.values(a.militaryParticipants).reduce((sum, val) => sum + val, 0)
    ),
    workplacePrograms: workplacePrograms.sort((a, b) => b.veteranEmployees - a.veteranEmployees),
    preventionServices: preventionServices.sort((a, b) =>
      Object.values(b.militaryPopulationServed).reduce((sum, val) => sum + val, 0) -
      Object.values(a.militaryPopulationServed).reduce((sum, val) => sum + val, 0)
    )
  };
}

export async function getMilitaryRelevantHealthyPeopleObjectives(): Promise<{
  highRelevanceObjectives: HealthyPeopleObjective[];
  moderateRelevanceObjectives: HealthyPeopleObjective[];
  improvingObjectives: number;
  worseningObjectives: number;
}> {
  await ensureWarmed();

  const highRelevanceObjectives: HealthyPeopleObjective[] = [];
  const moderateRelevanceObjectives: HealthyPeopleObjective[] = [];
  let improvingObjectives = 0;
  let worseningObjectives = 0;

  for (const [grid, objectives] of odphpCache.healthyPeopleObjectives) {
    for (const objective of objectives) {
      if (objective.militaryRelevance === 'high') {
        highRelevanceObjectives.push(objective);
      } else if (objective.militaryRelevance === 'moderate') {
        moderateRelevanceObjectives.push(objective);
      }

      if (objective.currentData.trendDirection === 'improving') {
        improvingObjectives++;
      } else if (objective.currentData.trendDirection === 'worsening') {
        worseningObjectives++;
      }
    }
  }

  return {
    highRelevanceObjectives: highRelevanceObjectives.sort((a, b) => b.currentData.progressTowardTarget - a.currentData.progressTowardTarget),
    moderateRelevanceObjectives: moderateRelevanceObjectives.sort((a, b) => b.currentData.progressTowardTarget - a.currentData.progressTowardTarget),
    improvingObjectives,
    worseningObjectives
  };
}

// Analytics
export async function calculatePreventionAndPromotionMetrics(): Promise<{
  totalProgramsWithMilitaryFocus: number;
  militaryParticipantsServed: {
    physicalActivity: number;
    nutrition: number;
    workplaceWellness: number;
    preventionServices: number;
  };
  healthyPeopleProgress: {
    onTrack: number;
    improvingSlowly: number;
    littleOrNoChange: number;
    gettingWorse: number;
  };
  evidenceBasedInterventions: {
    recommended: number;
    sufficientEvidence: number;
    insufficientEvidence: number;
  };
  totalFunding: number;
}> {
  await ensureWarmed();

  let totalProgramsWithMilitaryFocus = 0;
  const militaryParticipantsServed = {
    physicalActivity: 0,
    nutrition: 0,
    workplaceWellness: 0,
    preventionServices: 0
  };

  const healthyPeopleProgress = {
    onTrack: 0,
    improvingSlowly: 0,
    littleOrNoChange: 0,
    gettingWorse: 0
  };

  const evidenceBasedInterventions = {
    recommended: 0,
    sufficientEvidence: 0,
    insufficientEvidence: 0
  };

  let totalFunding = 0;

  // Physical Activity Programs
  for (const [grid, programs] of odphpCache.physicalActivityPrograms) {
    for (const program of programs) {
      const militaryCount = Object.values(program.militaryParticipants).reduce((sum, val) => sum + val, 0);
      if (militaryCount > 0 || program.programType === 'military') {
        totalProgramsWithMilitaryFocus++;
        militaryParticipantsServed.physicalActivity += militaryCount;
        totalFunding += program.totalBudget;
      }
    }
  }

  // Nutrition Programs
  for (const [grid, programs] of odphpCache.nutritionPrograms) {
    for (const program of programs) {
      const militaryCount = Object.values(program.militaryParticipants).reduce((sum, val) => sum + val, 0);
      if (militaryCount > 0 || program.organizationType === 'military') {
        totalProgramsWithMilitaryFocus++;
        militaryParticipantsServed.nutrition += militaryCount;
        totalFunding += program.fundingAmount;
      }
    }
  }

  // Workplace Wellness Programs
  for (const [grid, programs] of odphpCache.workplaceWellnessPrograms) {
    for (const program of programs) {
      if (program.militaryWorkplace || program.veteranEmployees > 0) {
        totalProgramsWithMilitaryFocus++;
        militaryParticipantsServed.workplaceWellness += program.veteranEmployees + program.militarySpouseEmployees;
        totalFunding += program.programManagement.programBudget;
      }
    }
  }

  // Community Prevention Services
  for (const [grid, services] of odphpCache.communityPreventionServices) {
    for (const service of services) {
      const militaryCount = Object.values(service.militaryPopulationServed).reduce((sum, val) => sum + val, 0);
      if (militaryCount > 0) {
        totalProgramsWithMilitaryFocus++;
        militaryParticipantsServed.preventionServices += militaryCount;
      }

      // Evidence classification
      switch (service.evidenceClassification) {
        case 'recommended':
          evidenceBasedInterventions.recommended++;
          break;
        case 'sufficient_evidence':
          evidenceBasedInterventions.sufficientEvidence++;
          break;
        case 'insufficient_evidence':
          evidenceBasedInterventions.insufficientEvidence++;
          break;
      }
    }
  }

  // Healthy People Objectives Progress
  for (const [grid, objectives] of odphpCache.healthyPeopleObjectives) {
    for (const objective of objectives) {
      if (objective.militaryRelevance !== 'low') {
        const progress = objective.currentData.progressTowardTarget;
        if (progress >= 80) {
          healthyPeopleProgress.onTrack++;
        } else if (progress >= 50) {
          healthyPeopleProgress.improvingSlowly++;
        } else if (objective.currentData.trendDirection === 'stable') {
          healthyPeopleProgress.littleOrNoChange++;
        } else {
          healthyPeopleProgress.gettingWorse++;
        }
      }
    }
  }

  return {
    totalProgramsWithMilitaryFocus,
    militaryParticipantsServed,
    healthyPeopleProgress,
    evidenceBasedInterventions,
    totalFunding
  };
}

// Cache management
export async function setODPHPCache(
  healthyPeopleObjectives: HealthyPeopleObjective[],
  physicalActivityPrograms: PhysicalActivityProgram[],
  nutritionPrograms: NutritionProgram[],
  workplaceWellnessPrograms: WorkplaceWellnessProgram[],
  communityPreventionServices: CommunityPreventionService[]
): Promise<void> {
  odphpCache._buildInProgress = true;
  odphpCache._buildStartedAt = new Date().toISOString();

  try {
    // Clear existing cache
    odphpCache.healthyPeopleObjectives.clear();
    odphpCache.physicalActivityPrograms.clear();
    odphpCache.nutritionPrograms.clear();
    odphpCache.workplaceWellnessPrograms.clear();
    odphpCache.communityPreventionServices.clear();

    // Grid-index all data types
    for (const objective of healthyPeopleObjectives) {
      const grid = gridKey(objective.coordinates.lat, objective.coordinates.lng);
      if (!odphpCache.healthyPeopleObjectives.has(grid)) {
        odphpCache.healthyPeopleObjectives.set(grid, []);
      }
      odphpCache.healthyPeopleObjectives.get(grid)!.push(objective);
    }

    for (const program of physicalActivityPrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!odphpCache.physicalActivityPrograms.has(grid)) {
        odphpCache.physicalActivityPrograms.set(grid, []);
      }
      odphpCache.physicalActivityPrograms.get(grid)!.push(program);
    }

    for (const program of nutritionPrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!odphpCache.nutritionPrograms.has(grid)) {
        odphpCache.nutritionPrograms.set(grid, []);
      }
      odphpCache.nutritionPrograms.get(grid)!.push(program);
    }

    for (const program of workplaceWellnessPrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!odphpCache.workplaceWellnessPrograms.has(grid)) {
        odphpCache.workplaceWellnessPrograms.set(grid, []);
      }
      odphpCache.workplaceWellnessPrograms.get(grid)!.push(program);
    }

    for (const service of communityPreventionServices) {
      const grid = gridKey(service.coordinates.lat, service.coordinates.lng);
      if (!odphpCache.communityPreventionServices.has(grid)) {
        odphpCache.communityPreventionServices.set(grid, []);
      }
      odphpCache.communityPreventionServices.get(grid)!.push(service);
    }

    odphpCache._lastUpdated = new Date().toISOString();

    await saveCacheToDisk(odphpCache, CACHE_FILE);
    await saveCacheToBlob(odphpCache, BLOB_KEY);

  } finally {
    odphpCache._buildInProgress = false;
    odphpCache._buildStartedAt = '';
  }
}

export function getODPHPCacheInfo(): {
  healthyPeopleObjectiveCount: number;
  physicalActivityProgramCount: number;
  nutritionProgramCount: number;
  workplaceWellnessProgramCount: number;
  communityPreventionServiceCount: number;
  lastUpdated: string;
  isBuilding: boolean;
} {
  let healthyPeopleObjectiveCount = 0;
  let physicalActivityProgramCount = 0;
  let nutritionProgramCount = 0;
  let workplaceWellnessProgramCount = 0;
  let communityPreventionServiceCount = 0;

  for (const objectives of odphpCache.healthyPeopleObjectives.values()) {
    healthyPeopleObjectiveCount += objectives.length;
  }

  for (const programs of odphpCache.physicalActivityPrograms.values()) {
    physicalActivityProgramCount += programs.length;
  }

  for (const programs of odphpCache.nutritionPrograms.values()) {
    nutritionProgramCount += programs.length;
  }

  for (const programs of odphpCache.workplaceWellnessPrograms.values()) {
    workplaceWellnessProgramCount += programs.length;
  }

  for (const services of odphpCache.communityPreventionServices.values()) {
    communityPreventionServiceCount += services.length;
  }

  return {
    healthyPeopleObjectiveCount,
    physicalActivityProgramCount,
    nutritionProgramCount,
    workplaceWellnessProgramCount,
    communityPreventionServiceCount,
    lastUpdated: odphpCache._lastUpdated,
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