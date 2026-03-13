/**
 * ONDCP (Office of National Drug Control Policy) Cache
 *
 * Drug control, substance abuse prevention, and addiction treatment data
 * affecting military personnel, veterans, and communities around military installations.
 *
 * Data Sources:
 * - Drug Control Strategy data
 * - High Intensity Drug Trafficking Areas (HIDTA) intelligence
 * - Drug-Free Communities Support Program
 * - National Drug Control Budget
 * - Prescription Drug Monitoring Programs (PDMPs)
 * - Drug Treatment and Recovery data
 * - Prevention and Education Programs
 * - Law Enforcement and Interdiction data
 *
 * Military Applications:
 * - Military substance abuse prevention
 * - Veteran addiction treatment and recovery
 * - Military installation drug threat assessment
 * - Military family substance abuse support
 * - Military personnel drug testing and prevention
 * - Combat-related prescription drug monitoring
 * - Military community drug-free initiatives
 * - Deployment-related substance abuse patterns
 */

import { gridKey, loadCacheFromDisk, saveCacheToDisk, neighborKeys } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';

const CACHE_FILE = '.cache/ondcp-data.json';
const BLOB_KEY = 'ondcp-cache';
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

interface HIDTARegion {
  hidtaId: string;
  regionName: string;
  hidtaType: 'regional' | 'county' | 'tribal' | 'border' | 'rural' | 'metropolitan';

  // Geographic Coverage
  address: string;
  city: string;
  state: string;
  zipCode: string;
  serviceStates: string[];
  serviceCounties: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Threat Assessment
  primaryThreats: {
    fentanyl: 'high' | 'medium' | 'low';
    heroin: 'high' | 'medium' | 'low';
    cocaine: 'high' | 'medium' | 'low';
    methamphetamine: 'high' | 'medium' | 'low';
    prescriptionOpioids: 'high' | 'medium' | 'low';
    syntheticStimulants: 'high' | 'medium' | 'low';
    marijuana: 'high' | 'medium' | 'low';
  };

  // Military Installation Impact
  militaryImpact: {
    militaryInstallationsInRegion: string[];
    proximityToMilitaryBases: number; // average km
    militaryPersonnelAffected: number;
    militaryFamiliesImpacted: number;
    veteranPopulationInRegion: number;
  };

  // Drug Seizures and Interdiction
  seizureData: {
    totalSeizures: number;
    fentanylSeizures: number; // grams
    heroinSeizures: number;
    cocaineSeizures: number;
    methSeizures: number;
    prescriptionDrugSeizures: number; // pills
    streetValue: number; // USD
  };

  // Law Enforcement Coordination
  lawEnforcement: {
    participatingAgencies: number;
    federalAgencies: string[];
    stateAgencies: string[];
    localAgencies: string[];
    militaryLawEnforcement: string[];
    jointOperations: number;
  };

  // Intelligence and Information Sharing
  intelligence: {
    intelligenceProducts: number;
    threatAssessments: number;
    investigativeLeads: number;
    informationRequests: number;
    analyticalProducts: string[];
  };

  // Prevention and Treatment
  preventionPrograms: {
    communityPrograms: number;
    schoolPrograms: number;
    militaryPrograms: number;
    coalitionsSupported: number;
    educationalEvents: number;
  };

  // Outcomes and Impact
  outcomes: {
    arrestsMade: number;
    drugOffendersProsecuted: number;
    assetsSeized: number; // USD value
    drugsRemovedFromStreets: number; // grams
    livesImpacted: number;
  };

  // Environmental Health
  environmentalImpact: {
    clabSites: number; // Clandestine lab sites
    environmentalContamination: boolean;
    waterContamination: boolean;
    soilContamination: boolean;
    cleanupCosts: number;
  };

  fiscalYear: number;
  lastUpdated: string;
}

interface DrugFreeCommunitiesProgram {
  programId: string;
  coalitionName: string;
  communityType: 'urban' | 'suburban' | 'rural' | 'tribal' | 'military';

  // Coalition Information
  leadOrganization: string;
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

  // Coalition Characteristics
  coalitionType: 'community_coalition' | 'school_based' | 'faith_based' | 'military_community' | 'tribal_coalition';
  participatingOrganizations: {
    total: number;
    schools: number;
    lawEnforcement: number;
    healthcare: number;
    faith: number;
    military: number;
    veterans: number;
    business: number;
    media: number;
  };

  // Military Community Focus
  militaryFocus: {
    militaryFamilySupport: boolean;
    veteranSubstanceAbuseSupport: boolean;
    militaryYouthPrograms: boolean;
    militarySpouseSupport: boolean;
    basePartnership: boolean;
    militaryInstallationProximity: number; // km to nearest base
  };

  // Target Population
  targetPopulation: {
    totalPopulation: number;
    youth: number;
    adults: number;
    seniors: number;
    militaryPersonnel: number;
    veterans: number;
    militaryFamilies: number;
  };

  // Substance Focus Areas
  substanceFocus: {
    alcohol: boolean;
    marijuana: boolean;
    prescriptionOpioids: boolean;
    heroin: boolean;
    fentanyl: boolean;
    cocaine: boolean;
    methamphetamine: boolean;
    tobacco: boolean;
    vaping: boolean;
  };

  // Prevention Strategies
  preventionStrategies: {
    informationDissemination: boolean;
    educationSkillsBuilding: boolean;
    alternativeActivities: boolean;
    problemIdentification: boolean;
    communityBasedProcess: boolean;
    environmentalStrategies: boolean;
  };

  // Military-Specific Strategies
  militaryStrategies: {
    militaryYouthMentoring: boolean;
    veteranPeerSupport: boolean;
    familyStrengthening: boolean;
    deploymentSupport: boolean;
    militarySubstanceAbuseEducation: boolean;
    commandSupport: boolean;
  };

  // Programming and Activities
  programmingActivities: {
    evidenceBasedPrograms: string[];
    educationalEvents: number;
    mediaCampaigns: number;
    communityEvents: number;
    policyChanges: number;
    environmentalChanges: number;
  };

  // Outcomes and Evaluation
  outcomes: {
    youthReached: number;
    adultsReached: number;
    behaviorChanges: string[];
    policyChanges: string[];
    environmentalChanges: string[];
    substanceUseReduction: number; // percentage
  };

  // Military Outcomes
  militaryOutcomes: {
    militaryYouthReached: number;
    veteransSupported: number;
    militaryFamiliesEngaged: number;
    substanceAbusePreventionTraining: number;
    militaryPolicyChanges: string[];
  };

  // Funding and Resources
  dfcFunding: number;
  matchingFunds: number;
  totalBudget: number;
  volunteers: number;
  staffFTE: number;

  // Sustainability
  sustainabilityPlan: {
    diverseFundingSources: boolean;
    strongLeadership: boolean;
    broadCommunitySupport: boolean;
    effectiveProgramming: boolean;
    strategicPlanning: boolean;
  };

  grantPeriod: string;
  lastUpdated: string;
}

interface PrescriptionDrugMonitoring {
  pdmpId: string;
  stateName: string;
  pdmpName: string;

  // PDMP Characteristics
  stateWideImplementation: boolean;
  mandatoryUse: boolean;
  realTimeData: boolean;
  interstateDataSharing: boolean;

  // Geographic Coverage
  headquarters: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };

  countiesCovered: string[];
  populationCovered: number;

  // Data and Analytics
  dataMetrics: {
    registeredUsers: number;
    prescribersRegistered: number;
    pharmacistsRegistered: number;
    dispensersRegistered: number;
    queriesMonthly: number;
    prescriptionsMonitored: number;
  };

  // Military Integration
  militaryIntegration: {
    militaryProviderAccess: boolean;
    vaIntegration: boolean;
    militaryTreatmentFacilities: string[];
    tricarenetworkAccess: boolean;
    militaryPharmacies: number;
    veteranPatientMonitoring: boolean;
  };

  // Controlled Substances
  monitoredSubstances: {
    schedule2: boolean;
    schedule3: boolean;
    schedule4: boolean;
    schedule5: boolean;
    gabapentin: boolean;
    tramadol: boolean;
  };

  // Clinical Decision Support
  clinicalSupport: {
    morphineMilligramEquivalent: boolean;
    drugInteractionAlerts: boolean;
    overlappingPrescriptions: boolean;
    multiplePrescribers: boolean;
    highRiskPatients: boolean;
  };

  // Law Enforcement Features
  lawEnforcementAccess: {
    authorizedAccess: boolean;
    investigativeSupport: boolean;
    overdoseInvestigation: boolean;
    presciberInvestigation: boolean;
    divertionDetection: boolean;
  };

  // Public Health Integration
  publicHealthFeatures: {
    overdoseSurveillance: boolean;
    epidemiologicalStudies: boolean;
    populationHealthAnalytics: boolean;
    opioidUseMapping: boolean;
    trendAnalysis: boolean;
  };

  // Military Health Analytics
  militaryHealthAnalytics: {
    veteranOpioidTracking: boolean;
    militaryOverdosePreDvention: boolean;
    deploymentPrescriptionPatterns: boolean;
    militaryProviderEducation: boolean;
    combatInjuryPainManagement: boolean;
  };

  // Privacy and Security
  privacyMeasures: {
    auditTrails: boolean;
    userAuthentication: boolean;
    dataEncryption: boolean;
    accessLogging: boolean;
    patientConsent: boolean;
  };

  // Performance Metrics
  performanceMetrics: {
    systemUptime: number; // percentage
    responseTime: number; // seconds
    dataCompleteness: number; // percentage
    dataQuality: number; // score 1-10
    userSatisfaction: number; // score 1-10
  };

  implementationDate: string;
  lastUpdated: string;
}

interface SubstanceAbuseTreatment {
  facilityId: string;
  facilityName: string;
  treatmentType: 'outpatient' | 'residential' | 'detoxification' | 'medication_assisted' | 'peer_support' | 'military_specialized';

  // Facility Information
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Facility Characteristics
  ownership: 'public' | 'private_nonprofit' | 'private_for_profit' | 'federal' | 'military' | 'va';
  accreditation: string[];
  licensure: string[];
  capacity: number;
  currentCensus: number;

  // Military Specialization
  militarySpecialization: {
    veteranSpecializedPrograms: boolean;
    militaryTraumaInformed: boolean;
    combatVeteranServices: boolean;
    militaryFamilyPrograms: boolean;
    ptsdIntegratedTreatment: boolean;
    militarySexualTraumaServices: boolean;
  };

  // Services Offered
  treatmentServices: {
    detoxification: boolean;
    medicationAssistedTreatment: boolean;
    counselingServices: boolean;
    behavioralTherapy: boolean;
    groupTherapy: boolean;
    familyTherapy: boolean;
    mentalHealthServices: boolean;
    medicalServices: boolean;
  };

  // Specialized Programs
  specializedPrograms: {
    opioidTreatment: boolean;
    alcoholTreatment: boolean;
    stimulantTreatment: boolean;
    adolescentPrograms: boolean;
    womenOnlyPrograms: boolean;
    lgbtqPrograms: boolean;
    culturallySpecificPrograms: boolean;
  };

  // Military-Specific Services
  militaryServices: {
    veteranAdmissionPriority: boolean;
    militaryInsuranceAccepted: string[];
    vaContracting: boolean;
    tricareprovider: boolean;
    militaryFamilyServices: boolean;
    deploymentTransition: boolean;
  };

  // Patient Demographics
  patientDemographics: {
    totalAdmissions: number;
    veteranAdmissions: number;
    activedutyAdmissions: number;
    militaryFamilyAdmissions: number;
    averageAge: number;
    genderDistribution: {
      male: number;
      female: number;
    };
  };

  // Substance Use Patterns
  primarySubstances: {
    alcohol: number;
    opioids: number;
    heroin: number;
    fentanyl: number;
    cocaine: number;
    methamphetamine: number;
    marijuana: number;
    prescriptionDrugs: number;
  };

  // Treatment Outcomes
  treatmentOutcomes: {
    completionRate: number;
    abstinenceRate: number;
    employmentRate: number;
    housingStability: number;
    criminalJusticeInvolvement: number;
    overdoseReduction: number;
  };

  // Military Outcomes
  militaryOutcomes: {
    veteranCompletionRate: number;
    militaryRetentionRate: number;
    returnTodutyRate: number;
    familyStabilityImprovement: number;
    suicideRiskReduction: number;
  };

  // Quality Measures
  qualityIndicators: {
    evidenceBasedPractices: boolean;
    staffCredentials: string[];
    continuousQualityImprovement: boolean;
    patientSatisfaction: number;
    safetyRecord: number;
  };

  // Environmental Health
  environmentalFactors: {
    facilityEnvironment: string;
    accessibilityFeatures: boolean;
    safetyMeasures: string[];
    infectionControl: boolean;
  };

  // Funding and Financial
  fundingSources: string[];
  operatingBudget: number;
  costPerPatient: number;
  insuranceAccepted: string[];

  lastInspection: string;
  lastUpdated: string;
}

interface DrugControlBudget {
  budgetId: string;
  fiscalYear: number;
  budgetCategory: 'demand_reduction' | 'supply_reduction' | 'international' | 'interdiction' | 'research_evaluation';

  // Agency Allocation
  agencyAllocations: {
    defense: number;
    dhs: number;
    doj: number;
    hhs: number;
    education: number;
    veterans_affairs: number;
    other_agencies: number;
  };

  // Military-Specific Allocations
  militaryAllocations: {
    militarySubstanceAbusePrevention: number;
    veteranTreatmentPrograms: number;
    militaryFamilySupport: number;
    militaryDrugTesting: number;
    militaryEducationPrograms: number;
    militaryResearchInitiatives: number;
  };

  // Program Categories
  programCategories: {
    treatment: number;
    prevention: number;
    research: number;
    lawEnforcement: number;
    interdiction: number;
    international: number;
  };

  // Priority Areas
  priorityInvestments: {
    opioidCrisis: number;
    prescriptionDrugAbuse: number;
    fentanylResponse: number;
    youthPrevention: number;
    ruralCommunities: number;
    veteranSupport: number;
  };

  // Geographic Distribution
  geographicDistribution: {
    state: string;
    allocation: number;
    militaryInstallationFunding: number;
    veteranProgramFunding: number;
  }[];

  // Performance Measures
  performanceTargets: {
    treatmentAdmissions: number;
    peopleInRecovery: number;
    overdoseReduction: number;
    youthPreventionReach: number;
    militarySupport: number;
  };

  // ROI and Outcomes
  expectedOutcomes: {
    economicBenefit: number;
    livesaved: number;
    crimePrevention: number;
    productivityGains: number;
    healthcareSavings: number;
  };

  budgetJustification: string;
  lastRevision: string;
  lastUpdated: string;
}

interface ONDCPCache {
  hidtaRegions: Map<string, HIDTARegion[]>;
  drugFreeCommunitiesPrograms: Map<string, DrugFreeCommunitiesProgram[]>;
  prescriptionDrugMonitoring: Map<string, PrescriptionDrugMonitoring[]>;
  substanceAbuseTreatment: Map<string, SubstanceAbuseTreatment[]>;
  drugControlBudgets: DrugControlBudget[];
  _lastUpdated: string;
  _buildInProgress: boolean;
  _buildStartedAt: string;
}

let ondcpCache: ONDCPCache = {
  hidtaRegions: new Map(),
  drugFreeCommunitiesPrograms: new Map(),
  prescriptionDrugMonitoring: new Map(),
  substanceAbuseTreatment: new Map(),
  drugControlBudgets: [],
  _lastUpdated: '',
  _buildInProgress: false,
  _buildStartedAt: ''
};

// Build lock management
function isBuildInProgress(): boolean {
  if (!ondcpCache._buildInProgress) return false;

  const buildStartTime = new Date(ondcpCache._buildStartedAt).getTime();
  const now = Date.now();

  if (now - buildStartTime > BUILD_LOCK_TIMEOUT_MS) {
    console.log('ONDCP build lock timeout reached, clearing lock');
    ondcpCache._buildInProgress = false;
    ondcpCache._buildStartedAt = '';
    return false;
  }

  return true;
}

// Cache warming
export async function ensureWarmed(): Promise<void> {
  if (ondcpCache.hidtaRegions.size === 0) {
    await loadCacheFromDisk(ondcpCache, CACHE_FILE);

    if (ondcpCache.hidtaRegions.size === 0) {
      await loadCacheFromBlob(ondcpCache, BLOB_KEY);
    }
  }
}

// Geographic queries
export async function getDrugThreatAssessmentNearMilitary(
  lat: number,
  lng: number,
  radius: number = 100
): Promise<{
  hidtaRegions: HIDTARegion[];
  drugFreePrograms: DrugFreeCommunitiesProgram[];
  treatmentFacilities: SubstanceAbuseTreatment[];
  totalMilitaryImpact: number;
}> {
  await ensureWarmed();

  const centerGrid = gridKey(lat, lng);
  const searchGrids = [centerGrid, ...neighborKeys(lat, lng, Math.ceil(radius / 11.1))];

  const hidtaRegions: HIDTARegion[] = [];
  const drugFreePrograms: DrugFreeCommunitiesProgram[] = [];
  const treatmentFacilities: SubstanceAbuseTreatment[] = [];
  let totalMilitaryImpact = 0;

  for (const grid of searchGrids) {
    // HIDTA regions with military impact
    const gridHIDTA = ondcpCache.hidtaRegions.get(grid) || [];
    for (const hidta of gridHIDTA) {
      const distance = haversineDistance(lat, lng, hidta.coordinates.lat, hidta.coordinates.lng);
      if (distance <= radius && hidta.militaryImpact.militaryInstallationsInRegion.length > 0) {
        hidtaRegions.push(hidta);
        totalMilitaryImpact += hidta.militaryImpact.militaryPersonnelAffected;
      }
    }

    // Drug-free community programs near military
    const gridDFC = ondcpCache.drugFreeCommunitiesPrograms.get(grid) || [];
    for (const program of gridDFC) {
      const distance = haversineDistance(lat, lng, program.coordinates.lat, program.coordinates.lng);
      if (distance <= radius &&
          (program.militaryFocus.militaryFamilySupport ||
           program.targetPopulation.militaryPersonnel > 0 ||
           program.communityType === 'military')) {
        drugFreePrograms.push(program);
      }
    }

    // Treatment facilities serving military
    const gridTreatment = ondcpCache.substanceAbuseTreatment.get(grid) || [];
    for (const facility of gridTreatment) {
      const distance = haversineDistance(lat, lng, facility.coordinates.lat, facility.coordinates.lng);
      if (distance <= radius &&
          (facility.militarySpecialization.veteranSpecializedPrograms ||
           facility.treatmentType === 'military_specialized' ||
           facility.ownership === 'military' ||
           facility.ownership === 'va')) {
        treatmentFacilities.push(facility);
      }
    }
  }

  return {
    hidtaRegions: hidtaRegions.sort((a, b) => b.militaryImpact.militaryPersonnelAffected - a.militaryImpact.militaryPersonnelAffected),
    drugFreePrograms: drugFreePrograms.sort((a, b) => b.targetPopulation.militaryPersonnel - a.targetPopulation.militaryPersonnel),
    treatmentFacilities: treatmentFacilities.sort((a, b) => b.patientDemographics.veteranAdmissions - a.patientDemographics.veteranAdmissions),
    totalMilitaryImpact
  };
}

export async function getMilitarySubstanceAbuseTreatment(): Promise<{
  militarySpecializedFacilities: SubstanceAbuseTreatment[];
  veteranSpecializedPrograms: SubstanceAbuseTreatment[];
  totalVeteranAdmissions: number;
  veteranCompletionRate: number;
}> {
  await ensureWarmed();

  const militarySpecializedFacilities: SubstanceAbuseTreatment[] = [];
  const veteranSpecializedPrograms: SubstanceAbuseTreatment[] = [];
  let totalVeteranAdmissions = 0;
  let totalCompletions = 0;
  let facilitiesWithData = 0;

  for (const [grid, facilities] of ondcpCache.substanceAbuseTreatment) {
    for (const facility of facilities) {
      if (facility.treatmentType === 'military_specialized' || facility.ownership === 'military') {
        militarySpecializedFacilities.push(facility);
      }

      if (facility.militarySpecialization.veteranSpecializedPrograms || facility.ownership === 'va') {
        veteranSpecializedPrograms.push(facility);
        totalVeteranAdmissions += facility.patientDemographics.veteranAdmissions;

        if (facility.militaryOutcomes.veteranCompletionRate > 0) {
          totalCompletions += facility.militaryOutcomes.veteranCompletionRate;
          facilitiesWithData++;
        }
      }
    }
  }

  const veteranCompletionRate = facilitiesWithData > 0 ? totalCompletions / facilitiesWithData : 0;

  return {
    militarySpecializedFacilities: militarySpecializedFacilities.sort((a, b) => b.capacity - a.capacity),
    veteranSpecializedPrograms: veteranSpecializedPrograms.sort((a, b) => b.patientDemographics.veteranAdmissions - a.patientDemographics.veteranAdmissions),
    totalVeteranAdmissions,
    veteranCompletionRate
  };
}

export async function getPrescriptionDrugMonitoringByState(state: string): Promise<{
  pdmpProgram: PrescriptionDrugMonitoring | null;
  militaryIntegration: boolean;
  militaryProviderAccess: boolean;
  vaIntegration: boolean;
}> {
  await ensureWarmed();

  let pdmpProgram: PrescriptionDrugMonitoring | null = null;

  for (const [grid, programs] of ondcpCache.prescriptionDrugMonitoring) {
    for (const program of programs) {
      if (program.stateName.toLowerCase() === state.toLowerCase()) {
        pdmpProgram = program;
        break;
      }
    }
    if (pdmpProgram) break;
  }

  if (!pdmpProgram) {
    return {
      pdmpProgram: null,
      militaryIntegration: false,
      militaryProviderAccess: false,
      vaIntegration: false
    };
  }

  return {
    pdmpProgram,
    militaryIntegration: pdmpProgram.militaryIntegration.militaryProviderAccess || pdmpProgram.militaryIntegration.vaIntegration,
    militaryProviderAccess: pdmpProgram.militaryIntegration.militaryProviderAccess,
    vaIntegration: pdmpProgram.militaryIntegration.vaIntegration
  };
}

// Analytics
export async function calculateDrugControlMetrics(): Promise<{
  totalBudget: number;
  militaryAllocations: number;
  treatmentCapacity: {
    totalFacilities: number;
    militarySpecializedFacilities: number;
    veteranSpecializedPrograms: number;
    totalCapacity: number;
  };
  preventionReach: {
    totalCoalitions: number;
    militaryFocusedCoalitions: number;
    totalPopulationReached: number;
    militaryPopulationReached: number;
  };
  drugThreats: {
    highThreatRegions: number;
    militaryInstallationsAtRisk: number;
    totalSeizureValue: number;
  };
}> {
  await ensureWarmed();

  // Budget calculations
  const currentBudget = ondcpCache.drugControlBudgets[ondcpCache.drugControlBudgets.length - 1];
  const totalBudget = currentBudget ? Object.values(currentBudget.agencyAllocations).reduce((sum, val) => sum + val, 0) : 0;
  const militaryAllocations = currentBudget ? Object.values(currentBudget.militaryAllocations).reduce((sum, val) => sum + val, 0) : 0;

  // Treatment capacity
  let totalFacilities = 0;
  let militarySpecializedFacilities = 0;
  let veteranSpecializedPrograms = 0;
  let totalCapacity = 0;

  for (const [grid, facilities] of ondcpCache.substanceAbuseTreatment) {
    for (const facility of facilities) {
      totalFacilities++;
      totalCapacity += facility.capacity;

      if (facility.treatmentType === 'military_specialized' || facility.ownership === 'military') {
        militarySpecializedFacilities++;
      }

      if (facility.militarySpecialization.veteranSpecializedPrograms || facility.ownership === 'va') {
        veteranSpecializedPrograms++;
      }
    }
  }

  // Prevention reach
  let totalCoalitions = 0;
  let militaryFocusedCoalitions = 0;
  let totalPopulationReached = 0;
  let militaryPopulationReached = 0;

  for (const [grid, programs] of ondcpCache.drugFreeCommunitiesPrograms) {
    for (const program of programs) {
      totalCoalitions++;
      totalPopulationReached += program.targetPopulation.totalPopulation;

      if (program.militaryFocus.militaryFamilySupport || program.communityType === 'military') {
        militaryFocusedCoalitions++;
      }

      militaryPopulationReached += program.targetPopulation.militaryPersonnel +
                                   program.targetPopulation.veterans +
                                   program.targetPopulation.militaryFamilies;
    }
  }

  // Drug threats
  let highThreatRegions = 0;
  let militaryInstallationsAtRisk = 0;
  let totalSeizureValue = 0;

  for (const [grid, regions] of ondcpCache.hidtaRegions) {
    for (const region of regions) {
      // Count high threat regions (regions with multiple high threats)
      const highThreats = Object.values(region.primaryThreats).filter(threat => threat === 'high').length;
      if (highThreats >= 3) {
        highThreatRegions++;
      }

      militaryInstallationsAtRisk += region.militaryImpact.militaryInstallationsInRegion.length;
      totalSeizureValue += region.seizureData.streetValue;
    }
  }

  return {
    totalBudget,
    militaryAllocations,
    treatmentCapacity: {
      totalFacilities,
      militarySpecializedFacilities,
      veteranSpecializedPrograms,
      totalCapacity
    },
    preventionReach: {
      totalCoalitions,
      militaryFocusedCoalitions,
      totalPopulationReached,
      militaryPopulationReached
    },
    drugThreats: {
      highThreatRegions,
      militaryInstallationsAtRisk,
      totalSeizureValue
    }
  };
}

// Cache management
export async function setONDCPCache(
  hidtaRegions: HIDTARegion[],
  drugFreeCommunitiesPrograms: DrugFreeCommunitiesProgram[],
  prescriptionDrugMonitoring: PrescriptionDrugMonitoring[],
  substanceAbuseTreatment: SubstanceAbuseTreatment[],
  drugControlBudgets: DrugControlBudget[]
): Promise<void> {
  ondcpCache._buildInProgress = true;
  ondcpCache._buildStartedAt = new Date().toISOString();

  try {
    // Clear existing cache
    ondcpCache.hidtaRegions.clear();
    ondcpCache.drugFreeCommunitiesPrograms.clear();
    ondcpCache.prescriptionDrugMonitoring.clear();
    ondcpCache.substanceAbuseTreatment.clear();
    ondcpCache.drugControlBudgets = [];

    // Grid-index geographic data
    for (const region of hidtaRegions) {
      const grid = gridKey(region.coordinates.lat, region.coordinates.lng);
      if (!ondcpCache.hidtaRegions.has(grid)) {
        ondcpCache.hidtaRegions.set(grid, []);
      }
      ondcpCache.hidtaRegions.get(grid)!.push(region);
    }

    for (const program of drugFreeCommunitiesPrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!ondcpCache.drugFreeCommunitiesPrograms.has(grid)) {
        ondcpCache.drugFreeCommunitiesPrograms.set(grid, []);
      }
      ondcpCache.drugFreeCommunitiesPrograms.get(grid)!.push(program);
    }

    for (const pdmp of prescriptionDrugMonitoring) {
      const grid = gridKey(pdmp.headquarters.coordinates.lat, pdmp.headquarters.coordinates.lng);
      if (!ondcpCache.prescriptionDrugMonitoring.has(grid)) {
        ondcpCache.prescriptionDrugMonitoring.set(grid, []);
      }
      ondcpCache.prescriptionDrugMonitoring.get(grid)!.push(pdmp);
    }

    for (const facility of substanceAbuseTreatment) {
      const grid = gridKey(facility.coordinates.lat, facility.coordinates.lng);
      if (!ondcpCache.substanceAbuseTreatment.has(grid)) {
        ondcpCache.substanceAbuseTreatment.set(grid, []);
      }
      ondcpCache.substanceAbuseTreatment.get(grid)!.push(facility);
    }

    // Store non-geographic data
    ondcpCache.drugControlBudgets = drugControlBudgets.sort((a, b) => a.fiscalYear - b.fiscalYear);

    ondcpCache._lastUpdated = new Date().toISOString();

    await saveCacheToDisk(ondcpCache, CACHE_FILE);
    await saveCacheToBlob(ondcpCache, BLOB_KEY);

  } finally {
    ondcpCache._buildInProgress = false;
    ondcpCache._buildStartedAt = '';
  }
}

export function getONDCPCacheInfo(): {
  hidtaRegionCount: number;
  drugFreeCommunitiesProgramCount: number;
  prescriptionDrugMonitoringCount: number;
  treatmentFacilityCount: number;
  drugControlBudgetCount: number;
  lastUpdated: string;
  isBuilding: boolean;
} {
  let hidtaRegionCount = 0;
  let drugFreeCommunitiesProgramCount = 0;
  let prescriptionDrugMonitoringCount = 0;
  let treatmentFacilityCount = 0;

  for (const regions of ondcpCache.hidtaRegions.values()) {
    hidtaRegionCount += regions.length;
  }

  for (const programs of ondcpCache.drugFreeCommunitiesPrograms.values()) {
    drugFreeCommunitiesProgramCount += programs.length;
  }

  for (const pdmps of ondcpCache.prescriptionDrugMonitoring.values()) {
    prescriptionDrugMonitoringCount += pdmps.length;
  }

  for (const facilities of ondcpCache.substanceAbuseTreatment.values()) {
    treatmentFacilityCount += facilities.length;
  }

  return {
    hidtaRegionCount,
    drugFreeCommunitiesProgramCount,
    prescriptionDrugMonitoringCount,
    treatmentFacilityCount,
    drugControlBudgetCount: ondcpCache.drugControlBudgets.length,
    lastUpdated: ondcpCache._lastUpdated,
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