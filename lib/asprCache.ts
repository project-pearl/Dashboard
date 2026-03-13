/**
 * ASPR (Assistant Secretary for Preparedness and Response) Cache
 *
 * Emergency preparedness, response capabilities, and medical countermeasures data
 * for public health emergencies affecting military installations and communities.
 *
 * Data Sources:
 * - Hospital Preparedness Program (HPP)
 * - Strategic National Stockpile (SNS)
 * - Biomedical Advanced Research and Development Authority (BARDA)
 * - Medical Reserve Corps (MRC)
 * - Emergency System for Advance Registration of Volunteer Health Professionals (ESAR-VHP)
 * - Public Health Emergency Preparedness (PHEP) Program
 * - National Disaster Medical System (NDMS)
 * - Regional Disaster Health Response System
 *
 * Military Applications:
 * - Military installation emergency preparedness assessment
 * - Civil-military medical cooperation during emergencies
 * - Defense Support of Civil Authorities (DSCA) planning
 * - Military medical countermeasure distribution
 * - Base resilience and continuity of operations
 * - Chemical, biological, radiological, nuclear (CBRN) preparedness
 * - Military family emergency support systems
 * - Joint military-civilian disaster response capabilities
 */

import { gridKey, loadCacheFromDisk, saveCacheToDisk, neighborKeys } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';

const CACHE_FILE = '.cache/aspr-data.json';
const BLOB_KEY = 'aspr-cache';
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

interface HospitalPreparedness {
  hppId: string;
  facilityName: string;
  facilityType: 'general_acute' | 'specialty' | 'critical_access' | 'military' | 'va' | 'psychiatric';

  // Location Data
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  healthcareCoalition: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Capacity Metrics
  licensedBeds: number;
  icuBeds: number;
  emergencyDepartmentBeds: number;
  surgicalSuites: number;
  isolationRooms: number;
  pedsCapacity: number;

  // Surge Capacity
  surgeCapacityBeds: number;
  rapidDischargeCapability: number;
  alternativeCareCapacity: number;
  decontaminationCapability: boolean;

  // Specialty Capabilities
  traumaCenter: 'level_1' | 'level_2' | 'level_3' | 'level_4' | 'none';
  burnCenter: boolean;
  pediatricCapabilities: boolean;
  mentalHealthCapabilities: boolean;
  poisonControlAccess: boolean;

  // Emergency Preparedness
  emergencyOperationsCenter: boolean;
  hazardVulnerabilityAssessment: boolean;
  incidentCommandSystem: boolean;
  emergencyPlan: boolean;
  exerciseParticipation: number; // exercises per year

  // CBRN Preparedness
  chemicalDecontamination: boolean;
  biologicalContainment: boolean;
  radiationDetection: boolean;
  nuclearIncidentResponse: boolean;

  // Military Coordination
  militaryPartnership: boolean;
  defenseCoordination: boolean;
  veteranCareCapability: boolean;
  militaryFamilyServices: boolean;
  proximityToMilitaryBase: number; // km

  // Stockpile and Supplies
  strategicNationalStockpileAccess: boolean;
  pharmaceuticalCache: boolean;
  medicalEquipmentCache: boolean;
  personalProtectiveEquipment: boolean;

  // Staffing Preparedness
  surgeStaffing: number;
  credentialingAgreements: boolean;
  volunteerHealthProfessionals: number;
  medicalReserveCorpsPartnership: boolean;

  // Communication Systems
  healthAlertNetwork: boolean;
  emergencyCommunications: boolean;
  interoperableCommunications: boolean;

  lastAssessment: string;
  lastUpdated: string;
}

interface StrategicNationalStockpile {
  snsLocationId: string;
  locationType: 'federal' | 'state' | 'local' | 'military' | 'vendor';

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

  // Stockpile Categories
  pharmaceuticals: {
    antibiotics: number; // courses
    antivirals: number;
    vaccines: number; // doses
    analgesics: number;
    antidotes: number;
  };

  medicalSupplies: {
    ventilators: number;
    hospitalBeds: number;
    personalProtectiveEquipment: number; // sets
    decontaminationSupplies: number;
    surgicalSupplies: number;
  };

  // Specialty Countermeasures
  chemicalCountermeasures: string[];
  biologicalCountermeasures: string[];
  radiologicalCountermeasures: string[];
  nuclearCountermeasures: string[];

  // Distribution Capabilities
  distributionCapacity: number; // people served in 48 hours
  deliveryRadius: number; // km
  transportationAssets: string[];
  deploymentTimeframes: {
    local: number; // hours
    regional: number;
    national: number;
  };

  // Military Integration
  militaryCoordination: boolean;
  defenseLogisticsSupport: boolean;
  dualUseCapabilities: boolean;
  militaryRequestSupport: boolean;

  // Emergency Response
  activationTriggers: string[];
  distributionProtocols: string[];
  prioritizationCriteria: string[];

  // Inventory Management
  inventoryValue: number;
  rotationSchedule: string;
  expirationTracking: boolean;
  qualityAssurance: boolean;

  lastInventoryDate: string;
  lastUpdated: string;
}

interface MedicalCountermeasure {
  mcmId: string;
  productName: string;
  productType: 'vaccine' | 'therapeutic' | 'diagnostic' | 'device' | 'antidote';

  // Product Details
  manufacturer: string;
  fdaStatus: 'approved' | 'eua' | 'investigational' | 'development';
  indicatedUse: string[];
  targetPopulation: string[];

  // Threat Coverage
  chemicalThreats: string[];
  biologicalThreats: string[];
  radiologicalThreats: string[];
  nuclearThreats: string[];

  // Development Status
  bardaSupport: boolean;
  developmentPhase: 'preclinical' | 'phase1' | 'phase2' | 'phase3' | 'approved';
  fundingAmount: number;
  developmentTimeline: string;

  // Manufacturing
  manufacturingCapacity: number; // units per year
  surgeManufacturingCapacity: number;
  distributedManufacturing: boolean;
  qualityAssurance: string;

  // Military Applications
  militaryRelevance: 'high' | 'moderate' | 'low';
  deploymentApplicable: boolean;
  fieldUseCapable: boolean;
  combatCasualtyCare: boolean;

  // Storage and Distribution
  storageRequirements: string;
  shelfLife: number; // months
  distributionComplexity: 'simple' | 'moderate' | 'complex';

  // Clinical Data
  efficacyData: {
    effectivenessRate: number;
    adverseEventRate: number;
    contraindications: string[];
  };

  regulatoryMilestones: {
    milestone: string;
    date: string;
    status: 'completed' | 'pending' | 'delayed';
  }[];

  lastUpdated: string;
}

interface MedicalReserveCorps {
  mrcUnitId: string;
  unitName: string;
  sponsoringOrganization: string;

  // Geographic Coverage
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

  // Unit Statistics
  totalVolunteers: number;
  medicalVolunteers: number;
  nonMedicalVolunteers: number;
  youthCorpsVolunteers: number;

  // Professional Composition
  physicians: number;
  nurses: number;
  pharmacists: number;
  dentalProfessionals: number;
  mentalHealthProfessionals: number;
  veterinarians: number;
  emergencyMedicalServices: number;

  // Military Volunteers
  veteranVolunteers: number;
  activeReserveVolunteers: number;
  militarySpouseVolunteers: number;
  retiredMilitaryMedical: number;

  // Capabilities
  primaryCapabilities: string[];
  specialtyCapabilities: string[];
  languageCapabilities: string[];
  deployabilityRating: 'high' | 'moderate' | 'limited';

  // Training and Readiness
  trainingPrograms: string[];
  exerciseParticipation: number; // per year
  credentialingStatus: number; // percentage verified
  backgroundCheckCompliance: number; // percentage

  // Activation History
  activations: {
    event: string;
    date: string;
    volunteersDeployed: number;
    hoursServed: number;
    impactArea: string;
  }[];

  // Partnerships
  hospitalPartnerships: string[];
  publicHealthPartnerships: string[];
  emergencyManagementPartnerships: string[];
  militaryPartnerships: string[];

  lastAssessment: string;
  lastUpdated: string;
}

interface EmergencyPreparednessProgram {
  programId: string;
  programName: string;
  programType: 'hpp' | 'phep' | 'ndms' | 'esar-vhp' | 'regional_coalition';

  // Grantee Information
  granteeOrganization: string;
  granteeTtype: 'state' | 'local' | 'tribal' | 'territorial' | 'hospital' | 'coalition';

  // Geographic Coverage
  address: string;
  city: string;
  state: string;
  zipCode: string;
  serviceJurisdiction: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Funding
  federalAward: number;
  matchingFunds: number;
  totalBudget: number;
  fundingYear: number;

  // Population Served
  totalPopulation: number;
  vulnerablePopulations: {
    pediatric: number;
    elderly: number;
    disabled: number;
    institutionalized: number;
    homeless: number;
  };

  // Preparedness Capabilities
  capabilities: {
    capability: string;
    proficiencyLevel: 'basic' | 'intermediate' | 'advanced';
    lastAssessed: string;
  }[];

  // Healthcare System Integration
  hospitalParticipants: number;
  healthcareCoalitions: number;
  emergencyMedicalServices: number;
  publicHealthDepartments: number;

  // Military Coordination
  militaryInstallationCoordination: boolean;
  defenseSupportPlanning: boolean;
  civilMilitaryCooperation: string;
  jointExerciseParticipation: boolean;

  // Emergency Response Experience
  responseActivations: {
    incident: string;
    date: string;
    responseType: string;
    resourcesDeployed: string[];
    lessonsLearned: string[];
  }[];

  // Training and Exercises
  exercisesAnnually: number;
  trainingPrograms: string[];
  participationRates: number; // percentage
  improvementPlans: string[];

  performanceMetrics: {
    metric: string;
    target: number;
    current: number;
    trend: 'improving' | 'stable' | 'declining';
  }[];

  lastReporting: string;
  lastUpdated: string;
}

interface DisasterMedicalResponse {
  responseTeamId: string;
  teamType: 'dmat' | 'dmort' | 'dvet' | 'ims' | 'nmo';
  teamName: string;

  // Team Composition
  teamSize: number;
  medicalPersonnel: number;
  supportPersonnel: number;
  logisticsPersonnel: number;

  // Geographic Assignment
  baseLocation: string;
  state: string;
  responseRegion: string[];
  mobilizationRange: number; // km

  coordinates: {
    lat: number;
    lng: number;
  };

  // Capabilities
  primaryCapabilities: string[];
  specialtyCapabilities: string[];
  equipmentCache: string[];
  deploymentTimeframe: number; // hours

  // Military Personnel
  militaryMembers: number;
  veteranMembers: number;
  reserveMembers: number;
  militaryMedicalSpecialties: string[];

  // Training Status
  trainingStatus: 'ready' | 'training' | 'limited' | 'not_ready';
  lastTrainingExercise: string;
  certificationExpiry: string;
  readinessAssessment: number; // 0-100 scale

  // Deployment History
  deployments: {
    incident: string;
    location: string;
    startDate: string;
    duration: number; // days
    patientsServed: number;
    militaryCoordination: boolean;
  }[];

  // Equipment and Resources
  selfSufficiencyDays: number;
  medicalEquipment: string[];
  communicationsEquipment: string[];
  transportationAssets: string[];

  // Performance Metrics
  responseTime: number; // hours from activation
  deploymentSuccess: number; // percentage
  interoperabilityRating: number; // 1-10 scale

  lastActivation: string;
  lastUpdated: string;
}

interface ASPRCache {
  hospitalPreparedness: Map<string, HospitalPreparedness[]>;
  nationalStockpile: Map<string, StrategicNationalStockpile[]>;
  medicalCountermeasures: MedicalCountermeasure[];
  medicalReserveCorps: Map<string, MedicalReserveCorps[]>;
  preparednessPrograms: Map<string, EmergencyPreparednessProgram[]>;
  disasterResponse: Map<string, DisasterMedicalResponse[]>;
  _lastUpdated: string;
  _buildInProgress: boolean;
  _buildStartedAt: string;
}

let asprCache: ASPRCache = {
  hospitalPreparedness: new Map(),
  nationalStockpile: new Map(),
  medicalCountermeasures: [],
  medicalReserveCorps: new Map(),
  preparednessPrograms: new Map(),
  disasterResponse: new Map(),
  _lastUpdated: '',
  _buildInProgress: false,
  _buildStartedAt: ''
};

// Build lock management
function isBuildInProgress(): boolean {
  if (!asprCache._buildInProgress) return false;

  const buildStartTime = new Date(asprCache._buildStartedAt).getTime();
  const now = Date.now();

  if (now - buildStartTime > BUILD_LOCK_TIMEOUT_MS) {
    console.log('ASPR build lock timeout reached, clearing lock');
    asprCache._buildInProgress = false;
    asprCache._buildStartedAt = '';
    return false;
  }

  return true;
}

// Cache warming
export async function ensureWarmed(): Promise<void> {
  if (asprCache.hospitalPreparedness.size === 0) {
    const diskData = loadCacheFromDisk<ASPRCache>(CACHE_FILE);
    if (diskData) Object.assign(asprCache, diskData);

    if (asprCache.hospitalPreparedness.size === 0) {
      const blobData = await loadCacheFromBlob<ASPRCache>(BLOB_KEY);
      if (blobData) Object.assign(asprCache, blobData);
    }
  }
}

// Geographic queries
export async function getEmergencyPreparednessNearMilitary(
  lat: number,
  lng: number,
  radius: number = 50
): Promise<{
  hospitals: HospitalPreparedness[];
  stockpiles: StrategicNationalStockpile[];
  mrcUnits: MedicalReserveCorps[];
  responseTeams: DisasterMedicalResponse[];
}> {
  await ensureWarmed();

  const centerGrid = gridKey(lat, lng);
  const searchGrids = [centerGrid, ...neighborKeys(lat, lng)];

  const hospitals: HospitalPreparedness[] = [];
  const stockpiles: StrategicNationalStockpile[] = [];
  const mrcUnits: MedicalReserveCorps[] = [];
  const responseTeams: DisasterMedicalResponse[] = [];

  for (const grid of searchGrids) {
    // Hospitals with military partnerships
    const gridHospitals = asprCache.hospitalPreparedness.get(grid) || [];
    for (const hospital of gridHospitals) {
      const distance = haversineDistance(lat, lng, hospital.coordinates.lat, hospital.coordinates.lng);
      if (distance <= radius && (hospital.militaryPartnership || hospital.proximityToMilitaryBase <= 25)) {
        hospitals.push(hospital);
      }
    }

    // SNS locations with military coordination
    const gridStockpiles = asprCache.nationalStockpile.get(grid) || [];
    for (const stockpile of gridStockpiles) {
      const distance = haversineDistance(lat, lng, stockpile.coordinates.lat, stockpile.coordinates.lng);
      if (distance <= radius && (stockpile.militaryCoordination || stockpile.defenseLogisticsSupport)) {
        stockpiles.push(stockpile);
      }
    }

    // MRC units with veteran volunteers
    const gridMRC = asprCache.medicalReserveCorps.get(grid) || [];
    for (const unit of gridMRC) {
      const distance = haversineDistance(lat, lng, unit.coordinates.lat, unit.coordinates.lng);
      if (distance <= radius && (unit.veteranVolunteers > 0 || unit.militaryPartnerships.length > 0)) {
        mrcUnits.push(unit);
      }
    }

    // Disaster response teams with military members
    const gridResponse = asprCache.disasterResponse.get(grid) || [];
    for (const team of gridResponse) {
      const distance = haversineDistance(lat, lng, team.coordinates.lat, team.coordinates.lng);
      if (distance <= radius && (team.militaryMembers > 0 || team.veteranMembers > 0)) {
        responseTeams.push(team);
      }
    }
  }

  return {
    hospitals: hospitals.sort((a, b) => a.proximityToMilitaryBase - b.proximityToMilitaryBase),
    stockpiles: stockpiles.sort((a, b) => b.distributionCapacity - a.distributionCapacity),
    mrcUnits: mrcUnits.sort((a, b) => b.veteranVolunteers - a.veteranVolunteers),
    responseTeams: responseTeams.sort((a, b) => b.militaryMembers - a.militaryMembers)
  };
}

export async function getMilitaryRelevantCountermeasures(): Promise<{
  highRelevance: MedicalCountermeasure[];
  deploymentCapable: MedicalCountermeasure[];
  combatCare: MedicalCountermeasure[];
  cbrn: MedicalCountermeasure[];
}> {
  await ensureWarmed();

  const highRelevance = asprCache.medicalCountermeasures.filter(mcm => mcm.militaryRelevance === 'high');
  const deploymentCapable = asprCache.medicalCountermeasures.filter(mcm => mcm.deploymentApplicable);
  const combatCare = asprCache.medicalCountermeasures.filter(mcm => mcm.combatCasualtyCare);
  const cbrn = asprCache.medicalCountermeasures.filter(mcm =>
    mcm.chemicalThreats.length > 0 ||
    mcm.biologicalThreats.length > 0 ||
    mcm.radiologicalThreats.length > 0 ||
    mcm.nuclearThreats.length > 0
  );

  return {
    highRelevance: highRelevance.sort((a, b) => b.fundingAmount - a.fundingAmount),
    deploymentCapable: deploymentCapable.sort((a, b) => b.manufacturingCapacity - a.manufacturingCapacity),
    combatCare: combatCare.sort((a, b) => b.efficacyData.effectivenessRate - a.efficacyData.effectivenessRate),
    cbrn: cbrn.sort((a, b) => {
      const aThreatCount = a.chemicalThreats.length + a.biologicalThreats.length + a.radiologicalThreats.length + a.nuclearThreats.length;
      const bThreatCount = b.chemicalThreats.length + b.biologicalThreats.length + b.radiologicalThreats.length + b.nuclearThreats.length;
      return bThreatCount - aThreatCount;
    })
  };
}

export async function getPreparednessCapabilityByState(state: string): Promise<{
  programs: EmergencyPreparednessProgram[];
  totalFunding: number;
  totalPopulationServed: number;
  averageCapabilityLevel: number;
  militaryCoordination: number;
}> {
  await ensureWarmed();

  const programs: EmergencyPreparednessProgram[] = [];

  for (const [grid, gridPrograms] of asprCache.preparednessPrograms) {
    for (const program of gridPrograms) {
      if (program.state.toLowerCase() === state.toLowerCase()) {
        programs.push(program);
      }
    }
  }

  if (programs.length === 0) {
    return {
      programs: [],
      totalFunding: 0,
      totalPopulationServed: 0,
      averageCapabilityLevel: 0,
      militaryCoordination: 0
    };
  }

  const totalFunding = programs.reduce((sum, p) => sum + p.federalAward, 0);
  const totalPopulationServed = programs.reduce((sum, p) => sum + p.totalPopulation, 0);
  const militaryCoordination = programs.filter(p => p.militaryInstallationCoordination).length;

  // Calculate average capability level
  let totalCapabilityScore = 0;
  let capabilityCount = 0;

  for (const program of programs) {
    for (const capability of program.capabilities) {
      const score = capability.proficiencyLevel === 'advanced' ? 3 :
                    capability.proficiencyLevel === 'intermediate' ? 2 : 1;
      totalCapabilityScore += score;
      capabilityCount++;
    }
  }

  const averageCapabilityLevel = capabilityCount > 0 ? totalCapabilityScore / capabilityCount : 0;

  return {
    programs: programs.sort((a, b) => b.federalAward - a.federalAward),
    totalFunding,
    totalPopulationServed,
    averageCapabilityLevel,
    militaryCoordination
  };
}

// Analytics
export async function calculateEmergencyResponseCapacity(): Promise<{
  totalHospitalBeds: number;
  totalSurgeBeds: number;
  totalVolunteers: number;
  veteranVolunteers: number;
  stockpileDistributionCapacity: number;
  responseTeamReadiness: number;
  cbrneCapabilities: {
    chemical: number;
    biological: number;
    radiological: number;
    nuclear: number;
  };
}> {
  await ensureWarmed();

  let totalHospitalBeds = 0;
  let totalSurgeBeds = 0;
  let totalVolunteers = 0;
  let veteranVolunteers = 0;
  let stockpileDistributionCapacity = 0;
  let responseTeamReadiness = 0;
  let responseTeamCount = 0;

  // Hospital capacity
  for (const [grid, hospitals] of asprCache.hospitalPreparedness) {
    for (const hospital of hospitals) {
      totalHospitalBeds += hospital.licensedBeds;
      totalSurgeBeds += hospital.surgeCapacityBeds;
    }
  }

  // Volunteer capacity
  for (const [grid, units] of asprCache.medicalReserveCorps) {
    for (const unit of units) {
      totalVolunteers += unit.totalVolunteers;
      veteranVolunteers += unit.veteranVolunteers;
    }
  }

  // Stockpile distribution capacity
  for (const [grid, stockpiles] of asprCache.nationalStockpile) {
    for (const stockpile of stockpiles) {
      stockpileDistributionCapacity += stockpile.distributionCapacity;
    }
  }

  // Response team readiness
  for (const [grid, teams] of asprCache.disasterResponse) {
    for (const team of teams) {
      responseTeamReadiness += team.readinessAssessment;
      responseTeamCount++;
    }
  }

  const avgResponseTeamReadiness = responseTeamCount > 0 ? responseTeamReadiness / responseTeamCount : 0;

  // CBRNE capabilities
  let chemicalCapable = 0;
  let biologicalCapable = 0;
  let radiologicalCapable = 0;
  let nuclearCapable = 0;

  for (const [grid, hospitals] of asprCache.hospitalPreparedness) {
    for (const hospital of hospitals) {
      if (hospital.chemicalDecontamination) chemicalCapable++;
      if (hospital.biologicalContainment) biologicalCapable++;
      if (hospital.radiationDetection) radiologicalCapable++;
      if (hospital.nuclearIncidentResponse) nuclearCapable++;
    }
  }

  return {
    totalHospitalBeds,
    totalSurgeBeds,
    totalVolunteers,
    veteranVolunteers,
    stockpileDistributionCapacity,
    responseTeamReadiness: avgResponseTeamReadiness,
    cbrneCapabilities: {
      chemical: chemicalCapable,
      biological: biologicalCapable,
      radiological: radiologicalCapable,
      nuclear: nuclearCapable
    }
  };
}

// Cache management
export async function setASPRCache(
  hospitalPreparedness: HospitalPreparedness[],
  nationalStockpile: StrategicNationalStockpile[],
  medicalCountermeasures: MedicalCountermeasure[],
  medicalReserveCorps: MedicalReserveCorps[],
  preparednessPrograms: EmergencyPreparednessProgram[],
  disasterResponse: DisasterMedicalResponse[]
): Promise<void> {
  asprCache._buildInProgress = true;
  asprCache._buildStartedAt = new Date().toISOString();

  try {
    // Clear existing cache
    asprCache.hospitalPreparedness.clear();
    asprCache.nationalStockpile.clear();
    asprCache.medicalCountermeasures = [];
    asprCache.medicalReserveCorps.clear();
    asprCache.preparednessPrograms.clear();
    asprCache.disasterResponse.clear();

    // Grid-index geographic data
    for (const hospital of hospitalPreparedness) {
      const grid = gridKey(hospital.coordinates.lat, hospital.coordinates.lng);
      if (!asprCache.hospitalPreparedness.has(grid)) {
        asprCache.hospitalPreparedness.set(grid, []);
      }
      asprCache.hospitalPreparedness.get(grid)!.push(hospital);
    }

    for (const stockpile of nationalStockpile) {
      const grid = gridKey(stockpile.coordinates.lat, stockpile.coordinates.lng);
      if (!asprCache.nationalStockpile.has(grid)) {
        asprCache.nationalStockpile.set(grid, []);
      }
      asprCache.nationalStockpile.get(grid)!.push(stockpile);
    }

    for (const unit of medicalReserveCorps) {
      const grid = gridKey(unit.coordinates.lat, unit.coordinates.lng);
      if (!asprCache.medicalReserveCorps.has(grid)) {
        asprCache.medicalReserveCorps.set(grid, []);
      }
      asprCache.medicalReserveCorps.get(grid)!.push(unit);
    }

    for (const program of preparednessPrograms) {
      const grid = gridKey(program.coordinates.lat, program.coordinates.lng);
      if (!asprCache.preparednessPrograms.has(grid)) {
        asprCache.preparednessPrograms.set(grid, []);
      }
      asprCache.preparednessPrograms.get(grid)!.push(program);
    }

    for (const team of disasterResponse) {
      const grid = gridKey(team.coordinates.lat, team.coordinates.lng);
      if (!asprCache.disasterResponse.has(grid)) {
        asprCache.disasterResponse.set(grid, []);
      }
      asprCache.disasterResponse.get(grid)!.push(team);
    }

    // Store non-geographic data
    asprCache.medicalCountermeasures = medicalCountermeasures;

    asprCache._lastUpdated = new Date().toISOString();

    saveCacheToDisk(CACHE_FILE, asprCache);
    await saveCacheToBlob(BLOB_KEY, asprCache);

  } finally {
    asprCache._buildInProgress = false;
    asprCache._buildStartedAt = '';
  }
}

export function getASPRCacheInfo(): {
  hospitalCount: number;
  stockpileLocationCount: number;
  countermeasureCount: number;
  mrcUnitCount: number;
  preparednessProjectCount: number;
  responseTeamCount: number;
  lastUpdated: string;
  isBuilding: boolean;
} {
  let hospitalCount = 0;
  let stockpileLocationCount = 0;
  let mrcUnitCount = 0;
  let preparednessProjectCount = 0;
  let responseTeamCount = 0;

  for (const hospitals of asprCache.hospitalPreparedness.values()) {
    hospitalCount += hospitals.length;
  }

  for (const stockpiles of asprCache.nationalStockpile.values()) {
    stockpileLocationCount += stockpiles.length;
  }

  for (const units of asprCache.medicalReserveCorps.values()) {
    mrcUnitCount += units.length;
  }

  for (const programs of asprCache.preparednessPrograms.values()) {
    preparednessProjectCount += programs.length;
  }

  for (const teams of asprCache.disasterResponse.values()) {
    responseTeamCount += teams.length;
  }

  return {
    hospitalCount,
    stockpileLocationCount,
    countermeasureCount: asprCache.medicalCountermeasures.length,
    mrcUnitCount,
    preparednessProjectCount,
    responseTeamCount,
    lastUpdated: asprCache._lastUpdated,
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