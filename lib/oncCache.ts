/**
 * ONC (Office of the National Coordinator for Health IT) Cache
 *
 * Health information technology, interoperability, and digital health data
 * affecting military healthcare systems and health information exchange.
 *
 * Data Sources:
 * - Health Information Exchange (HIE) networks
 * - Electronic Health Record (EHR) adoption
 * - Health Information Technology for Economic and Clinical Health (HITECH) programs
 * - Interoperability standards and certification
 * - Health IT workforce development
 * - Patient engagement technologies
 * - Clinical Quality Measures (eCQM)
 * - Health Data Standards
 *
 * Military Applications:
 * - Military health record interoperability
 * - Military-civilian health data exchange
 * - Defense Health Agency (DHA) IT integration
 * - Military telehealth and remote monitoring
 * - Veteran health record continuity
 * - Military family health IT access
 * - Combat care documentation systems
 * - Military health data analytics and AI
 */

import { gridKey, loadCacheFromDisk, saveCacheToDisk, neighborKeys } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';

const CACHE_FILE = '.cache/onc-data.json';
const BLOB_KEY = 'onc-cache';
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

interface HealthInformationExchange {
  hieId: string;
  hieName: string;
  hieType: 'state_designated' | 'private' | 'regional' | 'community' | 'federal' | 'military';

  // Geographic Coverage
  address: string;
  city: string;
  state: string;
  zipCode: string;
  serviceStates: string[];
  serviceRegions: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Network Characteristics
  networkType: 'query_based' | 'directed_exchange' | 'consumer_mediated' | 'federated';
  governanceModel: 'centralized' | 'federated' | 'hybrid' | 'distributed';
  fundingModel: 'public' | 'private' | 'public_private' | 'subscription';

  // Participating Organizations
  participatingOrganizations: {
    hospitals: number;
    clinics: number;
    pharmacies: number;
    laboratories: number;
    imagingCenters: number;
    behavioralHealth: number;
    longTermCare: number;
    publicHealth: number;
    militaryFacilities: number;
    veteranAffairs: number;
  };

  // Military Integration
  militaryIntegration: {
    dhaMilitaryRecordsConnected: boolean;
    vaHealthRecordsConnected: boolean;
    tricarenetworkAccess: boolean;
    militaryTreatmentFacilities: string[];
    veteranAffairsMedicalCenters: string[];
    coastGuardIntegration: boolean;
  };

  // Data Exchange Volume
  dataExchangeVolume: {
    monthlyTransactions: number;
    recordsExchanged: number;
    patientMatches: number;
    documentsShared: number;
    ccdaDocuments: number; // Consolidated CDA
  };

  // Military Data Exchange
  militaryDataExchange: {
    militaryPatientRecords: number;
    veteranTransitions: number;
    deploymentRecords: number;
    medicalReadinessData: number;
    familyHealthRecords: number;
  };

  // Clinical Document Types
  clinicalDocuments: {
    dischargeSummaries: number;
    medicationLists: number;
    allergyLists: number;
    problemLists: number;
    immunizationRecords: number;
    laboratoryResults: number;
    imagingReports: number;
    progressNotes: number;
  };

  // Interoperability Standards
  standards: {
    hl7Fhir: boolean;
    hl7Cda: boolean;
    hl7V2: boolean;
    ihe: boolean; // Integrating the Healthcare Enterprise
    snomed: boolean;
    loinc: boolean;
    rxnorm: boolean;
    cpt: boolean;
  };

  // Security and Privacy
  securityMeasures: {
    encryptionInTransit: boolean;
    encryptionAtRest: boolean;
    auditLogging: boolean;
    accessControls: boolean;
    patientConsent: boolean;
    breakGlassAccess: boolean;
  };

  // Quality Measures
  qualityMetrics: {
    uptimePercentage: number;
    responseTime: number; // milliseconds
    dataQualityScore: number; // 0-100
    patientSafety: number;
    clinicalOutcomes: number;
  };

  // Patient Engagement
  patientEngagement: {
    patientPortals: boolean;
    mobileAccess: boolean;
    patientDataAccess: boolean;
    healthRecordDownload: boolean;
    directMessaging: boolean;
  };

  // Innovation and AI
  advancedCapabilities: {
    artificialIntelligence: boolean;
    machinelearning: boolean;
    naturalLanguageProcessing: boolean;
    predictiveAnalytics: boolean;
    clinicalDecisionSupport: boolean;
  };

  lastAssessment: string;
  lastUpdated: string;
}

interface EHRAdoptionData {
  facilityId: string;
  facilityName: string;
  facilityType: 'hospital' | 'clinic' | 'ambulatory_surgery' | 'military_treatment_facility' | 'va_medical_center' | 'skilled_nursing';

  // Facility Information
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  hospitalSystemAffiliation: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Facility Characteristics
  bedCount: number;
  annualAdmissions: number;
  outpatientVisits: number;
  employeeCount: number;
  medicalStaff: number;

  // Military Connection
  militaryAffiliation: {
    militaryTreatmentFacility: boolean;
    veteranAffairsCenter: boolean;
    militaryHospital: boolean;
    tricareprovider: boolean;
    veteranCommunityBased: boolean;
  };

  // EHR System Information
  ehrVendor: string;
  ehrProduct: string;
  implementationYear: number;
  lastUpgrade: string;
  systemMaturity: 'basic' | 'comprehensive' | 'advanced' | 'fully_integrated';

  // EHR Functionality
  basicEHRFunctions: {
    patientDemographics: boolean;
    providerNotes: boolean;
    medicationManagement: boolean;
    problemLists: boolean;
    vitalSigns: boolean;
    smokingStatus: boolean;
  };

  // Advanced EHR Features
  advancedFeatures: {
    computerizedPhysicianOrderEntry: boolean;
    clinicalDecisionSupport: boolean;
    medicationReconciliation: boolean;
    syntheticDerivatives: boolean;
    patientPortal: boolean;
    healthInformationExchange: boolean;
  };

  // Military-Specific Features
  militaryFeatures: {
    deploymentHealth: boolean;
    medicalReadiness: boolean;
    militaryOccupationalHealth: boolean;
    combatCasualtyCare: boolean;
    operationalMedicine: boolean;
  };

  // Interoperability
  interoperabilityCapability: {
    healthInformationExchange: boolean;
    ccda: boolean;
    hl7Fhir: boolean;
    directMessaging: boolean;
    queryBasedExchange: boolean;
  };

  // Quality Reporting
  qualityReporting: {
    meaningfulUse: boolean;
    qualityMeasures: boolean;
    publicHealthReporting: boolean;
    clinicalRegistries: boolean;
    immunizationRegistries: boolean;
    cancerRegistries: boolean;
  };

  // Patient Engagement
  patientEngagement: {
    onlinePortalAccess: boolean;
    secureMessaging: boolean;
    appointmentScheduling: boolean;
    prescriptionRefills: boolean;
    testResultsAccess: boolean;
    healthSummaryDownload: boolean;
  };

  // Data Analytics
  analyticsCapabilities: {
    clinicalAnalytics: boolean;
    operationalAnalytics: boolean;
    financialAnalytics: boolean;
    populationHealthAnalytics: boolean;
    predictiveModeling: boolean;
  };

  // Cybersecurity
  cybersecurityMeasures: {
    encryptionCompliant: boolean;
    accessManagement: boolean;
    auditTrails: boolean;
    riskAssessments: boolean;
    incidentResponse: boolean;
    staffTraining: boolean;
  };

  certificationStatus: {
    oncCertified: boolean;
    certificationEdition: string;
    certificationDate: string;
    certificationBody: string;
  };

  surveyYear: number;
  lastUpdated: string;
}

interface HealthITWorkforceProgram {
  programId: string;
  programName: string;
  programType: 'education' | 'training' | 'certification' | 'workforce_development' | 'continuing_education';

  // Institution Information
  institution: string;
  institutionType: 'university' | 'college' | 'community_college' | 'technical_school' | 'military_academy' | 'online';

  // Geographic Information
  address: string;
  city: string;
  state: string;
  zipCode: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Program Details
  degreeLevel: 'certificate' | 'associate' | 'bachelor' | 'master' | 'doctoral' | 'professional';
  programDuration: number; // months
  creditHours: number;
  deliveryMode: 'in_person' | 'online' | 'hybrid' | 'competency_based';

  // Curriculum Focus
  curriculumAreas: {
    healthInformatics: boolean;
    healthInformationManagement: boolean;
    healthITManagement: boolean;
    clinicalInformatics: boolean;
    publicHealthInformatics: boolean;
    bioinformatics: boolean;
    dataAnalytics: boolean;
    cybersecurity: boolean;
  };

  // Military Integration
  militaryPrograms: {
    militaryFriendly: boolean;
    veteranServices: boolean;
    militaryTuitionAssistance: boolean;
    gibillAccepted: boolean;
    militarySpousePrograms: boolean;
    deploymentAccommodations: boolean;
  };

  // Military-Specific Curriculum
  militaryCurriculum: {
    militaryMedicine: boolean;
    defensehealthIT: boolean;
    telehealth: boolean;
    medicalReadiness: boolean;
    combatInformatics: boolean;
    militaryStandards: boolean;
  };

  // Student Demographics
  studentBody: {
    totalStudents: number;
    activedutyStudents: number;
    veteranStudents: number;
    militarySpouseStudents: number;
    civilianStudents: number;
    internationalStudents: number;
  };

  // Employment Outcomes
  employmentOutcomes: {
    graduationRate: number;
    employmentRate: number;
    averageStartingSalary: number;
    employmentSectors: {
      hospitals: number;
      clinics: number;
      government: number;
      military: number;
      consulting: number;
      vendorandTechnology: number;
    };
  };

  // Industry Partnerships
  industryPartnerships: {
    healthcareOrganizations: string[];
    technologyVendors: string[];
    governmentAgencies: string[];
    militaryPartners: string[];
    researchInstitutions: string[];
  };

  // Accreditation
  accreditationStatus: {
    accredited: boolean;
    accreditingBody: string;
    accreditationDate: string;
    specialtyAccreditations: string[];
  };

  // Research and Innovation
  researchActivities: {
    researchProjects: number;
    industryCollaborations: number;
    governmentGrants: number;
    militaryResearchProjects: number;
    publicationsAnnually: number;
  };

  lastProgramReview: string;
  lastUpdated: string;
}

interface HealthITInnovation {
  innovationId: string;
  projectTitle: string;
  innovationType: 'artificial_intelligence' | 'machine_learning' | 'blockchain' | 'iot_devices' | 'telehealth' | 'mobile_health' | 'precision_medicine';

  // Organization Information
  leadOrganization: string;
  organizationType: 'startup' | 'healthcare_system' | 'technology_company' | 'academic' | 'government' | 'military';

  // Project Location
  address: string;
  city: string;
  state: string;
  zipCode: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Innovation Focus
  healthcareFocus: string[];
  targetConditions: string[];
  targetPopulations: string[];
  useCase: string[];

  // Military Applications
  militaryApplications: {
    combatCare: boolean;
    medicalReadiness: boolean;
    telehealth: boolean;
    mentalHealthSupport: boolean;
    rehabilationMedicine: boolean;
    epidemicResponse: boolean;
    operationalMedicine: boolean;
  };

  // Technology Description
  technologyDescription: string;
  keyFeatures: string[];
  technicalSpecifications: string[];
  platformRequirements: string[];

  // Development Stage
  developmentStage: 'concept' | 'prototype' | 'pilot' | 'clinical_trials' | 'fda_review' | 'market_ready' | 'deployed';
  fdaStatus: 'not_applicable' | 'pre_submission' | 'submitted' | 'cleared' | 'approved' | 'rejected';

  // Clinical Evidence
  clinicalEvidence: {
    clinicalTrials: number;
    studyParticipants: number;
    primaryEndpoints: string[];
    efficacyResults: string[];
    safetyProfile: string;
  };

  // Military Validation
  militaryValidation: {
    militaryTrials: boolean;
    militaryParticipants: number;
    combatEnvironmentTesting: boolean;
    militaryFeedback: string[];
    deploymentPilots: boolean;
  };

  // Interoperability
  interoperabilityFeatures: {
    hl7Fhir: boolean;
    fastHealthcareInteroperability: boolean;
    apiIntegration: boolean;
    ehrIntegration: boolean;
    mobileIntegration: boolean;
  };

  // Data and Privacy
  dataPrivacy: {
    hipaacompliant: boolean;
    gdprCompliant: boolean;
    encryptionLevel: string;
    dataMinimization: boolean;
    patientConsent: boolean;
  };

  // Market Information
  marketInformation: {
    targetMarketSize: number;
    competitiveLandscape: string[];
    uniqueValueProposition: string;
    businessModel: string;
    pricingModel: string;
  };

  // Funding and Investment
  fundingInformation: {
    totalFunding: number;
    fundingStage: string;
    investors: string[];
    governmentGrants: number;
    militaryContracts: number;
  };

  // Implementation and Adoption
  implementationStatus: {
    deploymentSites: number;
    usersActive: number;
    transactionsDaily: number;
    customerSatisfaction: number;
    clinicalOutcomes: string[];
  };

  // Future Roadmap
  futureRoadmap: {
    plannedFeatures: string[];
    expansionPlans: string[];
    partnershipGoals: string[];
    scalabilityPlans: string[];
  };

  lastTechnologyUpdate: string;
  lastUpdated: string;
}

interface TelehealthDeployment {
  deploymentId: string;
  organizationName: string;
  deploymentType: 'hospital_system' | 'clinic_network' | 'rural_health' | 'military_health' | 'home_health' | 'speciality_care';

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

  // Telehealth Modalities
  serviceModalities: {
    videoConsultation: boolean;
    audioConsultation: boolean;
    asynchronousMessaging: boolean;
    remoteMonitoring: boolean;
    mobileHealth: boolean;
    aiChatbots: boolean;
  };

  // Military Telehealth
  militaryTelehealth: {
    militaryTreatmentFacility: boolean;
    veteranAffairsProgram: boolean;
    militaryFamilyServices: boolean;
    deploymentSupport: boolean;
    combatSupport: boolean;
    ruralMilitarySupport: boolean;
  };

  // Clinical Specialties
  clinicalSpecialties: {
    primaryCare: boolean;
    mentalHealth: boolean;
    cardiology: boolean;
    neurology: boolean;
    dermatology: boolean;
    endocrinology: boolean;
    emergency_medicine: boolean;
    radiology: boolean;
  };

  // Military-Specific Specialties
  militarySpecialties: {
    militaryMedicine: boolean;
    occupationalMedicine: boolean;
    flightMedicine: boolean;
    combatMedicine: boolean;
    militaryPsychiatry: boolean;
    deploymentMedicine: boolean;
  };

  // Patient Demographics
  patientDemographics: {
    totalPatients: number;
    ruralPatients: number;
    veteranPatients: number;
    activedutyPatients: number;
    militaryFamilyPatients: number;
    elderlyPatients: number;
    pediatricPatients: number;
  };

  // Service Volume
  serviceVolume: {
    monthlyConsultations: number;
    averageConsultationLength: number; // minutes
    noShowRate: number;
    patientSatisfactionScore: number;
    providerSatisfactionScore: number;
  };

  // Technology Platform
  technologyPlatform: {
    vendor: string;
    platform: string;
    mobileApp: boolean;
    webBased: boolean;
    ehrIntegration: boolean;
    prescriptionIntegration: boolean;
  };

  // Quality and Outcomes
  qualityMetrics: {
    clinicalOutcomes: string[];
    patientSafety: number;
    diagnosticAccuracy: number;
    treatmentAdherence: number;
    healthOutcomeImprovement: number;
  };

  // Cost and Efficiency
  costEfficiency: {
    costReductionPercentage: number;
    travelTimeSaved: number; // hours
    providerEfficiency: number;
    resourceUtilization: number;
  };

  // Remote Monitoring
  remoteMonitoringCapabilities: {
    vitalSigns: boolean;
    glucoseMonitoring: boolean;
    bloodPressure: boolean;
    heartRhythm: boolean;
    oxygenSaturation: boolean;
    weightMonitoring: boolean;
  };

  // Deployment Challenges
  deploymentChallenges: {
    technologyBarriers: string[];
    regulatoryBarriers: string[];
    reimbursementChallenges: string[];
    patientAdoption: string[];
    providerTraining: string[];
  };

  // Military Deployment Challenges
  militaryDeploymentChallenges: {
    securityClearance: boolean;
    networkSecurity: boolean;
    deploymentConnectivity: boolean;
    commandStructureIntegration: boolean;
    multiserviceInteroperability: boolean;
  };

  deploymentDate: string;
  lastUpdated: string;
}

interface ONCCache {
  healthInformationExchanges: Map<string, HealthInformationExchange[]>;
  ehrAdoptionData: Map<string, EHRAdoptionData[]>;
  workforcePrograms: Map<string, HealthITWorkforceProgram[]>;
  healthItInnovations: Map<string, HealthITInnovation[]>;
  telehealthDeployments: Map<string, TelehealthDeployment[]>;
  _lastUpdated: string;
  _buildInProgress: boolean;
  _buildStartedAt: string;
}

let oncCache: ONCCache = {
  healthInformationExchanges: new Map(),
  ehrAdoptionData: new Map(),
  workforcePrograms: new Map(),
  healthItInnovations: new Map(),
  telehealthDeployments: new Map(),
  _lastUpdated: '',
  _buildInProgress: false,
  _buildStartedAt: ''
};

// Build lock management
function isBuildInProgress(): boolean {
  if (!oncCache._buildInProgress) return false;

  const buildStartTime = new Date(oncCache._buildStartedAt).getTime();
  const now = Date.now();

  if (now - buildStartTime > BUILD_LOCK_TIMEOUT_MS) {
    console.log('ONC build lock timeout reached, clearing lock');
    oncCache._buildInProgress = false;
    oncCache._buildStartedAt = '';
    return false;
  }

  return true;
}

// Cache warming
export async function ensureWarmed(): Promise<void> {
  if (oncCache.healthInformationExchanges.size === 0) {
    const diskData = loadCacheFromDisk<ONCCache>(CACHE_FILE);
    if (diskData) Object.assign(oncCache, diskData);

    if (oncCache.healthInformationExchanges.size === 0) {
      const blobData = await loadCacheFromBlob<ONCCache>(BLOB_KEY);
      if (blobData) Object.assign(oncCache, blobData);
    }
  }
}

// Geographic queries
export async function getMilitaryHealthITServices(
  lat: number,
  lng: number,
  radius: number = 100
): Promise<{
  hieNetworks: HealthInformationExchange[];
  ehrFacilities: EHRAdoptionData[];
  telehealthServices: TelehealthDeployment[];
  itInnovations: HealthITInnovation[];
}> {
  await ensureWarmed();

  const centerGrid = gridKey(lat, lng);
  const searchGrids = [centerGrid, ...neighborKeys(lat, lng)];

  const hieNetworks: HealthInformationExchange[] = [];
  const ehrFacilities: EHRAdoptionData[] = [];
  const telehealthServices: TelehealthDeployment[] = [];
  const itInnovations: HealthITInnovation[] = [];

  for (const grid of searchGrids) {
    // HIE networks with military integration
    const gridHIE = oncCache.healthInformationExchanges.get(grid) || [];
    for (const hie of gridHIE) {
      const distance = haversineDistance(lat, lng, hie.coordinates.lat, hie.coordinates.lng);
      if (distance <= radius &&
          (hie.participatingOrganizations.militaryFacilities > 0 ||
           hie.militaryIntegration.dhaMilitaryRecordsConnected ||
           hie.hieType === 'military')) {
        hieNetworks.push(hie);
      }
    }

    // EHR facilities with military affiliation
    const gridEHR = oncCache.ehrAdoptionData.get(grid) || [];
    for (const ehr of gridEHR) {
      const distance = haversineDistance(lat, lng, ehr.coordinates.lat, ehr.coordinates.lng);
      if (distance <= radius &&
          (ehr.militaryAffiliation.militaryTreatmentFacility ||
           ehr.militaryAffiliation.veteranAffairsCenter ||
           ehr.militaryAffiliation.tricareprovider)) {
        ehrFacilities.push(ehr);
      }
    }

    // Telehealth deployments serving military
    const gridTelehealth = oncCache.telehealthDeployments.get(grid) || [];
    for (const telehealth of gridTelehealth) {
      const distance = haversineDistance(lat, lng, telehealth.coordinates.lat, telehealth.coordinates.lng);
      if (distance <= radius &&
          (telehealth.militaryTelehealth.militaryTreatmentFacility ||
           telehealth.militaryTelehealth.veteranAffairsProgram ||
           telehealth.deploymentType === 'military_health')) {
        telehealthServices.push(telehealth);
      }
    }

    // Health IT innovations with military applications
    const gridInnovations = oncCache.healthItInnovations.get(grid) || [];
    for (const innovation of gridInnovations) {
      const distance = haversineDistance(lat, lng, innovation.coordinates.lat, innovation.coordinates.lng);
      if (distance <= radius &&
          (Object.values(innovation.militaryApplications).some(app => app) ||
           innovation.organizationType === 'military')) {
        itInnovations.push(innovation);
      }
    }
  }

  return {
    hieNetworks: hieNetworks.sort((a, b) => b.participatingOrganizations.militaryFacilities - a.participatingOrganizations.militaryFacilities),
    ehrFacilities: ehrFacilities.sort((a, b) => b.bedCount - a.bedCount),
    telehealthServices: telehealthServices.sort((a, b) => b.patientDemographics.veteranPatients - a.patientDemographics.veteranPatients),
    itInnovations: itInnovations.sort((a, b) => b.fundingInformation.militaryContracts - a.fundingInformation.militaryContracts)
  };
}

export async function getHealthITWorkforcePrograms(militaryFriendly: boolean = false): Promise<{
  programs: HealthITWorkforceProgram[];
  totalStudents: number;
  militaryStudents: number;
  employmentRate: number;
}> {
  await ensureWarmed();

  let programs: HealthITWorkforceProgram[] = [];

  for (const [grid, gridPrograms] of oncCache.workforcePrograms) {
    if (militaryFriendly) {
      programs.push(...gridPrograms.filter(p => p.militaryPrograms.militaryFriendly));
    } else {
      programs.push(...gridPrograms);
    }
  }

  const totalStudents = programs.reduce((sum, p) => sum + p.studentBody.totalStudents, 0);
  const militaryStudents = programs.reduce((sum, p) =>
    sum + p.studentBody.activedutyStudents + p.studentBody.veteranStudents + p.studentBody.militarySpouseStudents, 0);
  const avgEmploymentRate = programs.reduce((sum, p) => sum + p.employmentOutcomes.employmentRate, 0) / programs.length;

  return {
    programs: programs.sort((a, b) => b.studentBody.totalStudents - a.studentBody.totalStudents),
    totalStudents,
    militaryStudents,
    employmentRate: avgEmploymentRate
  };
}

// Analytics
export async function calculateHealthITCapabilities(): Promise<{
  hieNetworkCoverage: {
    totalNetworks: number;
    militaryIntegratedNetworks: number;
    statesCovered: number;
    totalFacilitiesConnected: number;
  };
  ehrAdoption: {
    totalFacilities: number;
    militaryFacilities: number;
    comprehensiveEHRAdoption: number;
    interoperabilityEnabled: number;
  };
  telehealthReach: {
    totalDeployments: number;
    militaryDeployments: number;
    patientsServed: number;
    veteransServed: number;
  };
  innovationPipeline: {
    totalInnovations: number;
    militaryApplications: number;
    fdaApproved: number;
    deployedSolutions: number;
  };
  workforceCapacity: {
    totalPrograms: number;
    militaryFriendlyPrograms: number;
    graduatesAnnually: number;
    militaryStudents: number;
  };
}> {
  await ensureWarmed();

  const hieNetworkCoverage = {
    totalNetworks: 0,
    militaryIntegratedNetworks: 0,
    statesCovered: new Set<string>(),
    totalFacilitiesConnected: 0
  };

  const ehrAdoption = {
    totalFacilities: 0,
    militaryFacilities: 0,
    comprehensiveEHRAdoption: 0,
    interoperabilityEnabled: 0
  };

  const telehealthReach = {
    totalDeployments: 0,
    militaryDeployments: 0,
    patientsServed: 0,
    veteransServed: 0
  };

  const innovationPipeline = {
    totalInnovations: 0,
    militaryApplications: 0,
    fdaApproved: 0,
    deployedSolutions: 0
  };

  const workforceCapacity = {
    totalPrograms: 0,
    militaryFriendlyPrograms: 0,
    graduatesAnnually: 0,
    militaryStudents: 0
  };

  // HIE Network analysis
  for (const [grid, networks] of oncCache.healthInformationExchanges) {
    for (const network of networks) {
      hieNetworkCoverage.totalNetworks++;
      network.serviceStates.forEach(state => hieNetworkCoverage.statesCovered.add(state));
      hieNetworkCoverage.totalFacilitiesConnected += Object.values(network.participatingOrganizations).reduce((sum, count) => sum + count, 0);

      if (network.militaryIntegration.dhaMilitaryRecordsConnected || network.participatingOrganizations.militaryFacilities > 0) {
        hieNetworkCoverage.militaryIntegratedNetworks++;
      }
    }
  }

  // EHR adoption analysis
  for (const [grid, facilities] of oncCache.ehrAdoptionData) {
    for (const facility of facilities) {
      ehrAdoption.totalFacilities++;

      if (facility.militaryAffiliation.militaryTreatmentFacility || facility.militaryAffiliation.veteranAffairsCenter) {
        ehrAdoption.militaryFacilities++;
      }

      if (facility.systemMaturity === 'comprehensive' || facility.systemMaturity === 'advanced') {
        ehrAdoption.comprehensiveEHRAdoption++;
      }

      if (facility.interoperabilityCapability.healthInformationExchange) {
        ehrAdoption.interoperabilityEnabled++;
      }
    }
  }

  // Telehealth reach analysis
  for (const [grid, deployments] of oncCache.telehealthDeployments) {
    for (const deployment of deployments) {
      telehealthReach.totalDeployments++;
      telehealthReach.patientsServed += deployment.patientDemographics.totalPatients;
      telehealthReach.veteransServed += deployment.patientDemographics.veteranPatients;

      if (deployment.militaryTelehealth.militaryTreatmentFacility || deployment.deploymentType === 'military_health') {
        telehealthReach.militaryDeployments++;
      }
    }
  }

  // Innovation pipeline analysis
  for (const [grid, innovations] of oncCache.healthItInnovations) {
    for (const innovation of innovations) {
      innovationPipeline.totalInnovations++;

      if (Object.values(innovation.militaryApplications).some(app => app)) {
        innovationPipeline.militaryApplications++;
      }

      if (innovation.fdaStatus === 'approved' || innovation.fdaStatus === 'cleared') {
        innovationPipeline.fdaApproved++;
      }

      if (innovation.developmentStage === 'deployed') {
        innovationPipeline.deployedSolutions++;
      }
    }
  }

  // Workforce capacity analysis
  for (const [grid, programs] of oncCache.workforcePrograms) {
    for (const program of programs) {
      workforceCapacity.totalPrograms++;

      // Estimate annual graduates (assuming 4-year average program)
      workforceCapacity.graduatesAnnually += Math.floor(program.studentBody.totalStudents / 4);
      workforceCapacity.militaryStudents += program.studentBody.activedutyStudents +
                                            program.studentBody.veteranStudents +
                                            program.studentBody.militarySpouseStudents;

      if (program.militaryPrograms.militaryFriendly) {
        workforceCapacity.militaryFriendlyPrograms++;
      }
    }
  }

  return {
    hieNetworkCoverage: {
      ...hieNetworkCoverage,
      statesCovered: hieNetworkCoverage.statesCovered.size
    },
    ehrAdoption,
    telehealthReach,
    innovationPipeline,
    workforceCapacity
  };
}

// Cache management
export async function setONCCache(
  healthInformationExchanges: HealthInformationExchange[],
  ehrAdoptionData: EHRAdoptionData[],
  workforcePrograms: HealthITWorkforceProgram[],
  healthItInnovations: HealthITInnovation[],
  telehealthDeployments: TelehealthDeployment[]
): Promise<void> {
  oncCache._buildInProgress = true;
  oncCache._buildStartedAt = new Date().toISOString();

  try {
    // Clear existing cache
    oncCache.healthInformationExchanges.clear();
    oncCache.ehrAdoptionData.clear();
    oncCache.workforcePrograms.clear();
    oncCache.healthItInnovations.clear();
    oncCache.telehealthDeployments.clear();

    // Grid-index all data types
    for (const hie of healthInformationExchanges) {
      const grid = gridKey(hie.coordinates.lat, hie.coordinates.lng);
      if (!oncCache.healthInformationExchanges.has(grid)) {
        oncCache.healthInformationExchanges.set(grid, []);
      }
      oncCache.healthInformationExchanges.get(grid)!.push(hie);
    }

    for (const ehr of ehrAdoptionData) {
      const grid = gridKey(ehr.coordinates.lat, ehr.coordinates.lng);
      if (!oncCache.ehrAdoptionData.has(grid)) {
        oncCache.ehrAdoptionData.set(grid, []);
      }
      oncCache.ehrAdoptionData.get(grid)!.push(ehr);
    }

    for (const program of workforcePrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!oncCache.workforcePrograms.has(grid)) {
        oncCache.workforcePrograms.set(grid, []);
      }
      oncCache.workforcePrograms.get(grid)!.push(program);
    }

    for (const innovation of healthItInnovations) {
      const grid = gridKey(innovation.coordinates.lat, innovation.coordinates.lng);
      if (!oncCache.healthItInnovations.has(grid)) {
        oncCache.healthItInnovations.set(grid, []);
      }
      oncCache.healthItInnovations.get(grid)!.push(innovation);
    }

    for (const deployment of telehealthDeployments) {
      const grid = gridKey(deployment.coordinates.lat, deployment.coordinates.lng);
      if (!oncCache.telehealthDeployments.has(grid)) {
        oncCache.telehealthDeployments.set(grid, []);
      }
      oncCache.telehealthDeployments.get(grid)!.push(deployment);
    }

    oncCache._lastUpdated = new Date().toISOString();

    saveCacheToDisk(CACHE_FILE, oncCache);
    await saveCacheToBlob(BLOB_KEY, oncCache);

  } finally {
    oncCache._buildInProgress = false;
    oncCache._buildStartedAt = '';
  }
}

export function getONCCacheInfo(): {
  hieNetworkCount: number;
  ehrFacilityCount: number;
  workforceProgramCount: number;
  innovationCount: number;
  telehealthDeploymentCount: number;
  lastUpdated: string;
  isBuilding: boolean;
} {
  let hieNetworkCount = 0;
  let ehrFacilityCount = 0;
  let workforceProgramCount = 0;
  let innovationCount = 0;
  let telehealthDeploymentCount = 0;

  for (const networks of oncCache.healthInformationExchanges.values()) {
    hieNetworkCount += networks.length;
  }

  for (const facilities of oncCache.ehrAdoptionData.values()) {
    ehrFacilityCount += facilities.length;
  }

  for (const programs of oncCache.workforcePrograms.values()) {
    workforceProgramCount += programs.length;
  }

  for (const innovations of oncCache.healthItInnovations.values()) {
    innovationCount += innovations.length;
  }

  for (const deployments of oncCache.telehealthDeployments.values()) {
    telehealthDeploymentCount += deployments.length;
  }

  return {
    hieNetworkCount,
    ehrFacilityCount,
    workforceProgramCount,
    innovationCount,
    telehealthDeploymentCount,
    lastUpdated: oncCache._lastUpdated,
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