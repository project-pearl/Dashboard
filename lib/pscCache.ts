/**
 * PSC (Public Health Service Commissioned Corps) Cache
 *
 * Federal uniformed health service data including deployments, assignments,
 * and interservice coordination affecting military health and readiness.
 *
 * Data Sources:
 * - Officer Assignment and Deployment records
 * - Public Health Emergency Response deployments
 * - Indian Health Service assignments
 * - CDC field assignments
 * - Clinical care assignments
 * - Research and laboratory assignments
 * - Border health missions
 * - International health assignments
 *
 * Military Applications:
 * - Inter-service medical coordination and cooperation
 * - Joint military-PHS emergency response planning
 * - Shared medical expertise and knowledge transfer
 * - Cross-service healthcare provider exchange
 * - Federal emergency medical response capabilities
 * - Military-civilian health partnership assessment
 * - Public health threat response coordination
 * - Medical readiness and surge capacity planning
 */

import { gridKey, loadCacheFromDisk, saveCacheToDisk, neighborKeys } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';

const CACHE_FILE = '.cache/psc-data.json';
const BLOB_KEY = 'psc-cache';
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

interface CommissionedOfficer {
  officerId: string;
  rank: 'Ensign' | 'Lieutenant_JG' | 'Lieutenant' | 'Lieutenant_Commander' | 'Commander' | 'Captain' | 'Rear_Admiral_LH' | 'Rear_Admiral_UH' | 'Vice_Admiral' | 'Admiral';
  payGrade: string; // O-1 through O-10

  // Personal Information (anonymized/aggregated)
  professionalCategory: 'physician' | 'dentist' | 'nurse' | 'pharmacist' | 'veterinarian' | 'engineer' | 'scientist' | 'therapist' | 'dietitian' | 'sanitarian';
  specialty: string;
  boardCertifications: string[];
  yearsOfService: number;

  // Current Assignment
  currentAssignment: {
    agency: 'CDC' | 'FDA' | 'NIH' | 'IHS' | 'HRSA' | 'SAMHSA' | 'Other_HHS';
    location: string;
    assignmentType: 'clinical_care' | 'research' | 'administration' | 'policy' | 'field_assignment' | 'emergency_response';
    startDate: string;
    scheduledEndDate: string;
  };

  // Geographic Assignment
  assignmentLocation: {
    facility: string;
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

  // Military Coordination
  interserviceExperience: boolean;
  militaryCollaborations: string[];
  jointExerciseParticipation: boolean;
  militaryMedicalTraining: string[];

  // Emergency Response History
  emergencyDeployments: {
    deployment: string;
    location: string;
    duration: number; // days
    role: string;
    coordinatedWithMilitary: boolean;
  }[];

  // Specializations
  publicHealthSpecialty: string[];
  emergencyResponseCertifications: string[];
  linguisticCapabilities: string[];
  culturalCompetencies: string[];

  // Training and Education
  medicalEducation: {
    medicalSchool: string;
    graduationYear: number;
    residencySpecialty: string;
    fellowshipSpecialty: string;
  };

  continuingEducation: {
    course: string;
    completionDate: string;
    militaryRelevant: boolean;
  }[];

  // Performance Metrics
  publicHealthImpact: {
    populationsServed: number;
    programsLed: number;
    researchPublications: number;
    policyContributions: number;
  };

  lastUpdated: string;
}

interface EmergencyResponseDeployment {
  deploymentId: string;
  incidentName: string;
  incidentType: 'natural_disaster' | 'infectious_disease' | 'bioterrorism' | 'chemical_incident' | 'radiological_incident' | 'mass_casualty';

  // Deployment Details
  activationDate: string;
  deploymentDuration: number; // days
  deploymentLocation: {
    state: string;
    county: string;
    city: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };

  // Response Team Composition
  officersDeployed: number;
  byProfessionalCategory: {
    physicians: number;
    nurses: number;
    pharmacists: number;
    veterinarians: number;
    engineers: number;
    epidemiologists: number;
    other: number;
  };

  // Military Coordination
  coordinatedWithMilitary: boolean;
  militaryBranches: string[];
  jointCommandStructure: boolean;
  militaryAssetsUtilized: string[];

  // Mission Scope
  populationServed: number;
  servicesProvided: string[];
  medicinesDispensed: number;
  vaccinesAdministered: number;
  medicalExaminationsPerformed: number;

  // Capabilities Deployed
  fieldHospitals: number;
  medicalEquipment: string[];
  laboratoryCapabilities: string[];
  communicationSystems: string[];

  // Environmental Health
  waterSystemAssessments: number;
  foodSafetyInspections: number;
  airQualityMonitoring: boolean;
  wasteManagementSupport: boolean;

  // Outcomes
  livesImpacted: number;
  healthOutcomesImproved: number;
  diseaseOutbreaksPrevented: number;
  publicHealthThreatsMitigated: string[];

  // Lessons Learned
  operationalChallenges: string[];
  successFactors: string[];
  improvementRecommendations: string[];
  militaryCooperationLessons: string[];

  deploymentClosed: string;
  lastUpdated: string;
}

interface FieldAssignment {
  assignmentId: string;
  assignmentType: 'epidemic_intelligence_service' | 'field_epidemiology' | 'border_health' | 'tribal_health' | 'rural_health' | 'international_health';

  // Assignment Location
  hostOrganization: string;
  location: {
    facility: string;
    address: string;
    city: string;
    state: string;
    country: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };

  // Officer Details
  officerRank: string;
  officerSpecialty: string;
  assignmentDuration: number; // months
  assignmentObjectives: string[];

  // Project Focus
  healthIssuesAddressed: string[];
  populationFocus: string[];
  researchProjects: {
    project: string;
    participants: number;
    findings: string[];
    policyImpact: string;
  }[];

  // Military Relevance
  militaryHealthRelevance: 'high' | 'moderate' | 'low';
  deploymentHealthResearch: boolean;
  militaryPopulationStudied: boolean;
  veteranHealthFocus: boolean;

  // Surveillance Activities
  diseaseSupveillance: string[];
  outbreakInvestigations: number;
  epidemiologicalStudies: number;
  healthSystemAssessments: number;

  // Prevention Programs
  preventionProgramsDeveloped: {
    program: string;
    targetPopulation: number;
    interventionType: string;
    effectiveness: string;
  }[];

  // Environmental Health
  environmentalHealthAssessments: number;
  waterQualityStudies: number;
  occupationalHealthStudies: number;
  climateHealthResearch: boolean;

  // Capacity Building
  localStaffTrained: number;
  systemsStrengthened: string[];
  partnerOrganizations: string[];

  // Outcomes and Impact
  healthImprovements: string[];
  policiesInfluenced: string[];
  programsImplemented: string[];
  knowledgeTransfer: string[];

  assignmentCompleted: string;
  lastUpdated: string;
}

interface InterServiceCollaboration {
  collaborationId: string;
  collaborationType: 'joint_training' | 'personnel_exchange' | 'research_partnership' | 'emergency_response' | 'policy_development';

  // Participating Services
  phsOfficers: number;
  armyMedical: number;
  navyMedical: number;
  airForceMedical: number;
  spaceForeMedical: number;
  coastGuardMedical: number;

  // Collaboration Details
  startDate: string;
  duration: number; // months
  primaryObjective: string;
  collaborationScope: string[];

  // Geographic Scope
  locations: {
    location: string;
    state: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  }[];

  // Medical Specialties Involved
  specialtiesCollaborating: string[];
  clinicalFocusAreas: string[];
  researchDomains: string[];

  // Training and Education
  jointTrainingExercises: number;
  crossServiceEducation: number;
  knowledgeExchangeSessions: number;
  bestPracticesShared: string[];

  // Research Collaborations
  jointResearchProjects: {
    project: string;
    leadService: string;
    participants: number;
    researchFocus: string;
    militaryApplicability: boolean;
  }[];

  // Emergency Preparedness
  jointEmergencyExercises: number;
  responseProtocolsDeveloped: string[];
  interoperabilityTesting: boolean;
  communicationProtocols: string[];

  // Clinical Cooperation
  patientCareProtocols: string[];
  clinicalConsultations: number;
  medicalResourceSharing: string[];
  specialtyReferrals: number;

  // Technology and Innovation
  medicalTechnologySharing: boolean;
  innovationProjects: string[];
  equipmentStandardization: string[];
  informationSystemsIntegration: boolean;

  // Outcomes
  improvementsMeasured: string[];
  efficienciesGained: string[];
  costSavingsAchieved: number;
  readinessEnhanced: string[];

  // Future Planning
  plannedExtensions: boolean;
  scalabilityAssessment: string;
  replicationOpportunities: string[];

  lastReview: string;
  lastUpdated: string;
}

interface PublicHealthProgram {
  programId: string;
  programName: string;
  programType: 'disease_prevention' | 'health_promotion' | 'surveillance' | 'emergency_preparedness' | 'research' | 'clinical_care';

  // Program Management
  leadAgency: string;
  pscOfficersAssigned: number;
  totalStaffing: number;
  programBudget: number;

  // Geographic Coverage
  programLocation: {
    address: string;
    city: string;
    state: string;
    serviceRegion: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };

  // Target Population
  populationServed: number;
  demographics: {
    children: number;
    adults: number;
    elderly: number;
    veterans: number;
    militaryFamilies: number;
    tribalPopulations: number;
  };

  // Health Focus Areas
  healthPriorities: string[];
  diseaseTargets: string[];
  riskFactorsAddressed: string[];
  preventiveServices: string[];

  // Military Coordination
  militaryPartnership: boolean;
  veteranServicesIntegration: boolean;
  militaryHealthDataSharing: boolean;
  jointProgramElements: string[];

  // Service Delivery
  clinicalServices: {
    primaryCare: number; // patients served
    specialtyCare: number;
    preventiveCare: number;
    emergencyCare: number;
  };

  publicHealthServices: {
    vaccinations: number;
    healthScreenings: number;
    healthEducation: number;
    counselingServices: number;
  };

  // Research Activities
  researchStudies: {
    study: string;
    participants: number;
    focus: string;
    militaryRelevance: boolean;
  }[];

  // Environmental Health
  environmentalAssessments: number;
  waterQualityMonitoring: boolean;
  foodSafetyPrograms: boolean;
  occupationalHealthServices: boolean;

  // Quality Metrics
  healthOutcomes: {
    outcome: string;
    baseline: number;
    current: number;
    target: number;
  }[];

  patientSatisfaction: number; // percentage
  qualityIndicators: {
    indicator: string;
    performance: number;
    benchmark: number;
  }[];

  // Innovation and Technology
  telemedicineServices: boolean;
  electronicHealthRecords: boolean;
  mobileHealthApplications: string[];
  dataAnalyticsCapabilities: boolean;

  fiscalYear: number;
  lastUpdated: string;
}

interface PSCCache {
  officers: Map<string, CommissionedOfficer[]>;
  emergencyDeployments: Map<string, EmergencyResponseDeployment[]>;
  fieldAssignments: Map<string, FieldAssignment[]>;
  interServiceCollaborations: InterServiceCollaboration[];
  publicHealthPrograms: Map<string, PublicHealthProgram[]>;
  _lastUpdated: string;
  _buildInProgress: boolean;
  _buildStartedAt: string;
}

let pscCache: PSCCache = {
  officers: new Map(),
  emergencyDeployments: new Map(),
  fieldAssignments: new Map(),
  interServiceCollaborations: [],
  publicHealthPrograms: new Map(),
  _lastUpdated: '',
  _buildInProgress: false,
  _buildStartedAt: ''
};

// Build lock management
function isBuildInProgress(): boolean {
  if (!pscCache._buildInProgress) return false;

  const buildStartTime = new Date(pscCache._buildStartedAt).getTime();
  const now = Date.now();

  if (now - buildStartTime > BUILD_LOCK_TIMEOUT_MS) {
    console.log('PSC build lock timeout reached, clearing lock');
    pscCache._buildInProgress = false;
    pscCache._buildStartedAt = '';
    return false;
  }

  return true;
}

// Cache warming
export async function ensureWarmed(): Promise<void> {
  if (pscCache.officers.size === 0) {
    await loadCacheFromDisk(pscCache, CACHE_FILE);

    if (pscCache.officers.size === 0) {
      await loadCacheFromBlob(pscCache, BLOB_KEY);
    }
  }
}

// Geographic queries
export async function getPHSOfficersNearMilitary(
  lat: number,
  lng: number,
  radius: number = 50
): Promise<{
  officers: CommissionedOfficer[];
  programs: PublicHealthProgram[];
  totalOfficers: number;
  militaryCollaborators: number;
}> {
  await ensureWarmed();

  const centerGrid = gridKey(lat, lng);
  const searchGrids = [centerGrid, ...neighborKeys(lat, lng, Math.ceil(radius / 11.1))];

  const officers: CommissionedOfficer[] = [];
  const programs: PublicHealthProgram[] = [];

  for (const grid of searchGrids) {
    // Officers with military collaboration experience
    const gridOfficers = pscCache.officers.get(grid) || [];
    for (const officer of gridOfficers) {
      const distance = haversineDistance(
        lat,
        lng,
        officer.assignmentLocation.coordinates.lat,
        officer.assignmentLocation.coordinates.lng
      );
      if (distance <= radius &&
          (officer.interserviceExperience || officer.militaryCollaborations.length > 0)) {
        officers.push(officer);
      }
    }

    // Programs with military partnerships
    const gridPrograms = pscCache.publicHealthPrograms.get(grid) || [];
    for (const program of gridPrograms) {
      const distance = haversineDistance(
        lat,
        lng,
        program.programLocation.coordinates.lat,
        program.programLocation.coordinates.lng
      );
      if (distance <= radius && program.militaryPartnership) {
        programs.push(program);
      }
    }
  }

  const totalOfficers = officers.length;
  const militaryCollaborators = officers.filter(o => o.interserviceExperience).length;

  return {
    officers: officers.sort((a, b) => b.yearsOfService - a.yearsOfService),
    programs: programs.sort((a, b) => b.populationServed - a.populationServed),
    totalOfficers,
    militaryCollaborators
  };
}

export async function getInterServiceCollaborations(): Promise<{
  activeCollaborations: InterServiceCollaboration[];
  totalPHSOfficers: number;
  totalMilitaryPersonnel: number;
  focusAreas: { [area: string]: number };
}> {
  await ensureWarmed();

  const activeCollaborations = pscCache.interServiceCollaborations.filter(
    collab => new Date(collab.lastReview) > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Within last year
  );

  const totalPHSOfficers = activeCollaborations.reduce((sum, collab) => sum + collab.phsOfficers, 0);
  const totalMilitaryPersonnel = activeCollaborations.reduce((sum, collab) =>
    sum + collab.armyMedical + collab.navyMedical + collab.airForceMedical +
    collab.spaceForeMedical + collab.coastGuardMedical, 0
  );

  const focusAreas: { [area: string]: number } = {};
  for (const collab of activeCollaborations) {
    for (const area of collab.clinicalFocusAreas) {
      focusAreas[area] = (focusAreas[area] || 0) + 1;
    }
  }

  return {
    activeCollaborations: activeCollaborations.sort((a, b) => b.phsOfficers - a.phsOfficers),
    totalPHSOfficers,
    totalMilitaryPersonnel,
    focusAreas
  };
}

export async function getEmergencyResponseCapabilities(): Promise<{
  recentDeployments: EmergencyResponseDeployment[];
  totalOfficersDeployed: number;
  militaryCoordinatedResponses: number;
  responseCapacityByType: { [type: string]: number };
}> {
  await ensureWarmed();

  const recentDeployments: EmergencyResponseDeployment[] = [];
  let totalOfficersDeployed = 0;
  let militaryCoordinatedResponses = 0;
  const responseCapacityByType: { [type: string]: number } = {};

  for (const [grid, deployments] of pscCache.emergencyDeployments) {
    for (const deployment of deployments) {
      // Consider deployments in the last 2 years
      if (new Date(deployment.activationDate) > new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)) {
        recentDeployments.push(deployment);
        totalOfficersDeployed += deployment.officersDeployed;

        if (deployment.coordinatedWithMilitary) {
          militaryCoordinatedResponses++;
        }

        responseCapacityByType[deployment.incidentType] =
          (responseCapacityByType[deployment.incidentType] || 0) + deployment.officersDeployed;
      }
    }
  }

  return {
    recentDeployments: recentDeployments.sort((a, b) =>
      new Date(b.activationDate).getTime() - new Date(a.activationDate).getTime()
    ),
    totalOfficersDeployed,
    militaryCoordinatedResponses,
    responseCapacityByType
  };
}

export async function getFieldAssignmentsByType(assignmentType: string): Promise<{
  assignments: FieldAssignment[];
  officersAssigned: number;
  militaryRelevantAssignments: number;
  avgAssignmentDuration: number;
}> {
  await ensureWarmed();

  const assignments: FieldAssignment[] = [];

  for (const [grid, gridAssignments] of pscCache.fieldAssignments) {
    for (const assignment of gridAssignments) {
      if (assignment.assignmentType === assignmentType) {
        assignments.push(assignment);
      }
    }
  }

  const militaryRelevantAssignments = assignments.filter(a =>
    a.militaryHealthRelevance === 'high' || a.deploymentHealthResearch || a.militaryPopulationStudied
  ).length;

  const avgAssignmentDuration = assignments.length > 0
    ? assignments.reduce((sum, a) => sum + a.assignmentDuration, 0) / assignments.length
    : 0;

  return {
    assignments: assignments.sort((a, b) =>
      new Date(b.assignmentCompleted).getTime() - new Date(a.assignmentCompleted).getTime()
    ),
    officersAssigned: assignments.length,
    militaryRelevantAssignments,
    avgAssignmentDuration
  };
}

// Analytics
export async function calculatePHSCapabilities(): Promise<{
  totalOfficers: number;
  officersByRank: { [rank: string]: number };
  officersBySpecialty: { [specialty: string]: number };
  emergencyResponseCapacity: number;
  interServiceCollaborations: number;
  militaryPartnerPrograms: number;
  geographicCoverage: {
    states: number;
    facilities: number;
    populationServed: number;
  };
}> {
  await ensureWarmed();

  let totalOfficers = 0;
  const officersByRank: { [rank: string]: number } = {};
  const officersBySpecialty: { [specialty: string]: number } = {};
  let emergencyResponseCapacity = 0;
  let militaryPartnerPrograms = 0;
  const statesServed = new Set<string>();
  const facilitiesServed = new Set<string>();
  let totalPopulationServed = 0;

  // Count officers by rank and specialty
  for (const [grid, officers] of pscCache.officers) {
    for (const officer of officers) {
      totalOfficers++;
      officersByRank[officer.rank] = (officersByRank[officer.rank] || 0) + 1;
      officersBySpecialty[officer.professionalCategory] = (officersBySpecialty[officer.professionalCategory] || 0) + 1;

      statesServed.add(officer.assignmentLocation.state);
      facilitiesServed.add(officer.assignmentLocation.facility);

      if (officer.emergencyDeployments.length > 0) {
        emergencyResponseCapacity++;
      }
    }
  }

  // Count military partner programs and population served
  for (const [grid, programs] of pscCache.publicHealthPrograms) {
    for (const program of programs) {
      if (program.militaryPartnership) {
        militaryPartnerPrograms++;
      }
      totalPopulationServed += program.populationServed;
    }
  }

  const interServiceCollaborations = pscCache.interServiceCollaborations.length;

  return {
    totalOfficers,
    officersByRank,
    officersBySpecialty,
    emergencyResponseCapacity,
    interServiceCollaborations,
    militaryPartnerPrograms,
    geographicCoverage: {
      states: statesServed.size,
      facilities: facilitiesServed.size,
      populationServed: totalPopulationServed
    }
  };
}

// Cache management
export async function setPSCCache(
  officers: CommissionedOfficer[],
  emergencyDeployments: EmergencyResponseDeployment[],
  fieldAssignments: FieldAssignment[],
  interServiceCollaborations: InterServiceCollaboration[],
  publicHealthPrograms: PublicHealthProgram[]
): Promise<void> {
  pscCache._buildInProgress = true;
  pscCache._buildStartedAt = new Date().toISOString();

  try {
    // Clear existing cache
    pscCache.officers.clear();
    pscCache.emergencyDeployments.clear();
    pscCache.fieldAssignments.clear();
    pscCache.interServiceCollaborations = [];
    pscCache.publicHealthPrograms.clear();

    // Grid-index geographic data
    for (const officer of officers) {
      const grid = gridKey(officer.assignmentLocation.coordinates.lat, officer.assignmentLocation.coordinates.lng);
      if (!pscCache.officers.has(grid)) {
        pscCache.officers.set(grid, []);
      }
      pscCache.officers.get(grid)!.push(officer);
    }

    for (const deployment of emergencyDeployments) {
      const grid = gridKey(deployment.deploymentLocation.coordinates.lat, deployment.deploymentLocation.coordinates.lng);
      if (!pscCache.emergencyDeployments.has(grid)) {
        pscCache.emergencyDeployments.set(grid, []);
      }
      pscCache.emergencyDeployments.get(grid)!.push(deployment);
    }

    for (const assignment of fieldAssignments) {
      const grid = gridKey(assignment.location.coordinates.lat, assignment.location.coordinates.lng);
      if (!pscCache.fieldAssignments.has(grid)) {
        pscCache.fieldAssignments.set(grid, []);
      }
      pscCache.fieldAssignments.get(grid)!.push(assignment);
    }

    for (const program of publicHealthPrograms) {
      const grid = gridKey(program.programLocation.coordinates.lat, program.programLocation.coordinates.lng);
      if (!pscCache.publicHealthPrograms.has(grid)) {
        pscCache.publicHealthPrograms.set(grid, []);
      }
      pscCache.publicHealthPrograms.get(grid)!.push(program);
    }

    // Store non-geographic data
    pscCache.interServiceCollaborations = interServiceCollaborations;

    pscCache._lastUpdated = new Date().toISOString();

    await saveCacheToDisk(pscCache, CACHE_FILE);
    await saveCacheToBlob(pscCache, BLOB_KEY);

  } finally {
    pscCache._buildInProgress = false;
    pscCache._buildStartedAt = '';
  }
}

export function getPSCCacheInfo(): {
  officerCount: number;
  deploymentCount: number;
  fieldAssignmentCount: number;
  collaborationCount: number;
  programCount: number;
  lastUpdated: string;
  isBuilding: boolean;
} {
  let officerCount = 0;
  let deploymentCount = 0;
  let fieldAssignmentCount = 0;
  let programCount = 0;

  for (const officers of pscCache.officers.values()) {
    officerCount += officers.length;
  }

  for (const deployments of pscCache.emergencyDeployments.values()) {
    deploymentCount += deployments.length;
  }

  for (const assignments of pscCache.fieldAssignments.values()) {
    fieldAssignmentCount += assignments.length;
  }

  for (const programs of pscCache.publicHealthPrograms.values()) {
    programCount += programs.length;
  }

  return {
    officerCount,
    deploymentCount,
    fieldAssignmentCount,
    collaborationCount: pscCache.interServiceCollaborations.length,
    programCount,
    lastUpdated: pscCache._lastUpdated,
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