/**
 * EPA Environmental Health Cache
 *
 * Environmental Protection Agency health-related data including environmental health risks,
 * contamination sites, air/water quality health impacts, and environmental justice data
 * affecting military installations and surrounding communities.
 *
 * Data Sources:
 * - Toxic Release Inventory (TRI) health impacts
 * - Superfund Sites health assessments
 * - Environmental Justice screening data
 * - Air Quality Health Index
 * - Drinking Water Health advisories
 * - Chemical exposure health effects
 * - Environmental health disparities
 * - Community health assessments
 *
 * Military Applications:
 * - Military installation environmental health
 * - Base environmental health compliance
 * - Military family environmental exposure assessment
 * - Veteran environmental health outcomes
 * - Military community environmental justice
 * - Deployment environmental health preparedness
 * - Military environmental remediation health impacts
 * - Environmental readiness and force protection
 */

import { gridKey, loadCacheFromDisk, saveCacheToDisk, neighborKeys } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';

const CACHE_FILE = '.cache/epa-health-data.json';
const BLOB_KEY = 'epa-health-cache';
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

interface EnvironmentalHealthRisk {
  riskId: string;
  siteName: string;
  riskType: 'air_pollution' | 'water_contamination' | 'soil_contamination' | 'chemical_exposure' | 'radiation' | 'noise_pollution';

  // Geographic Information
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  epaRegion: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Environmental Contaminants
  contaminants: {
    chemical: string;
    casNumber: string;
    concentration: number;
    unit: string;
    healthBenchmark: number;
    exceedsStandard: boolean;
  }[];

  // Health Impacts
  healthEffects: {
    acuteEffects: string[];
    chronicEffects: string[];
    carcinogenicity: 'known' | 'probable' | 'possible' | 'not_classified';
    targetOrgans: string[];
    sensitivePopulations: string[];
  };

  // Population at Risk
  populationAtRisk: {
    totalPopulation: number;
    children: number;
    elderly: number;
    pregnant: number;
    immunocompromised: number;
    lowIncome: number;
    minorities: number;
  };

  // Military Population
  militaryPopulationAtRisk: {
    activedutyPersonnel: number;
    veterans: number;
    militaryFamilies: number;
    militaryDependents: number;
    contractorPersonnel: number;
    proximityToMilitaryBase: number; // km
    militaryInstallationAffected: string | null;
  };

  // Exposure Pathways
  exposurePathways: {
    inhalation: boolean;
    ingestion: boolean;
    dermalContact: boolean;
    soilContact: boolean;
    groundwaterContact: boolean;
    foodChainBioaccumulation: boolean;
  };

  // Health Surveillance
  healthSurveillance: {
    cancerCluster: boolean;
    birthDefectCluster: boolean;
    respiratoryIssues: boolean;
    neurologicalEffects: boolean;
    immunologicalEffects: boolean;
    developmentalEffects: boolean;
  };

  // Environmental Justice
  environmentalJustice: {
    lowIncomePopulation: boolean;
    minorityPopulation: boolean;
    limitedEnglishProficiency: boolean;
    ejScreenPercentile: number; // 0-100
    cumulativeImpacts: boolean;
  };

  // Remediation Status
  remediationStatus: {
    remediationRequired: boolean;
    remediationInProgress: boolean;
    remediationCompleted: boolean;
    ongoingMonitoring: boolean;
    healthAdvisories: boolean;
    communityNotification: boolean;
  };

  // Risk Assessment
  riskAssessment: {
    hazardQuotient: number;
    cancerRisk: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    uncertaintyFactors: string[];
    riskCharacterization: string;
  };

  lastHealthAssessment: string;
  lastUpdated: string;
}

interface SuperfundHealthData {
  siteId: string;
  siteName: string;
  nplStatus: 'final' | 'proposed' | 'deleted' | 'construction_complete';

  // Site Information
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Site Characteristics
  siteType: 'industrial' | 'landfill' | 'mining' | 'military' | 'manufacturing' | 'agricultural';
  contaminationSource: string[];
  areaSqKm: number;
  groundwaterContamination: boolean;
  surfaceWaterContamination: boolean;

  // Military Connection
  militaryConnection: {
    militaryInstallation: boolean;
    defenseContractor: boolean;
    militaryWaste: boolean;
    proximityToBase: number; // km
    affectedMilitaryPersonnel: number;
    veteranExposure: boolean;
  };

  // Contaminants of Concern
  contaminantsOfConcern: {
    chemical: string;
    casNumber: string;
    mediaContaminated: string[]; // soil, groundwater, surface water, air
    maxConcentration: number;
    unit: string;
    humanHealthBenchmark: number;
    ecologicalBenchmark: number;
  }[];

  // Health Assessment
  healthAssessment: {
    healthConsultation: boolean;
    publicHealthAssessment: boolean;
    healthSurveillance: boolean;
    epidemiologicalStudy: boolean;
    communityHealthConcerns: string[];
  };

  // Population Health
  populationHealth: {
    residentsNearSite: number;
    workersOnSite: number;
    schoolsNearby: number;
    hospitalsNearby: number;
    vulnerablePopulations: string[];
  };

  // Military Health Impact
  militaryHealthImpact: {
    currentMilitaryExposure: boolean;
    historicalMilitaryExposure: boolean;
    veteranHealthClaims: number;
    militaryHealthStudy: boolean;
    deploymentHealthConcerns: boolean;
  };

  // Exposure Assessment
  exposureAssessment: {
    completeExposurePathways: string[];
    incompleteExposurePathways: string[];
    potentialExposurePathways: string[];
    noApparentPublicHealth: boolean;
    publicHealthHazard: boolean;
  };

  // Health Effects
  healthEffects: {
    acuteHealthEffects: string[];
    chronicHealthEffects: string[];
    cancer: boolean;
    reproductiveEffects: boolean;
    developmentalEffects: boolean;
    immuneSystemEffects: boolean;
  };

  // Remediation
  remediation: {
    remediationObjectives: string[];
  remedialAction: string;
    constructionComplete: boolean;
    operationsAndMaintenance: boolean;
    institutionalControls: string[];
  };

  // Community Health
  communityHealthPrograms: {
    healthEducation: boolean;
    medicalMonitoring: boolean;
    exposureRegistries: boolean;
    communityAssistance: boolean;
    alternativeWaterSupply: boolean;
  };

  // Environmental Monitoring
  environmentalMonitoring: {
    airMonitoring: boolean;
    waterMonitoring: boolean;
    soilMonitoring: boolean;
    biota监测: boolean;
    indoorAirMonitoring: boolean;
  };

  lastHealthEvaluation: string;
  lastUpdated: string;
}

interface AirQualityHealthIndex {
  monitoringStationId: string;
  stationName: string;

  // Station Information
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Monitoring Details
  monitoringNetwork: 'state_local' | 'federal' | 'tribal' | 'military';
  stationtype: 'background' | 'urban' | 'suburban' | 'rural' | 'industrial' | 'military';
  elevationMeters: number;
  landUse: string;

  // Air Quality Measurements
  pollutantConcentrations: {
    pm25: number; // µg/m³
    pm10: number;
    ozone: number; // ppm
    no2: number; // ppb
    so2: number; // ppb
    co: number; // ppm
    lead: number; // µg/m³
  };

  // Health-Based Air Quality Index
  healthIndex: {
    aqiValue: number; // 0-500
    aqiCategory: 'good' | 'moderate' | 'unhealthy_sensitive' | 'unhealthy' | 'very_unhealthy' | 'hazardous';
    primaryPollutant: string;
    healthMessage: string;
  };

  // Health Effects
  healthEffects: {
    respiratoryEffects: string[];
    cardiovascularEffects: string[];
    neurologicalEffects: string[];
    cancerRisk: number;
    prematureMortality: number; // cases per 100,000
  };

  // Vulnerable Populations
  vulnerablePopulations: {
    children: number;
    elderly: number;
    asthmaPatients: number;
    heartDiseasePatients: number;
    pregnantWomen: number;
  };

  // Military Population Impact
  militaryImpact: {
    militaryPersonnelExposed: number;
    militaryFamiliesExposed: number;
    veteransExposed: number;
    militaryInstallationsAffected: string[];
    deploymentHealthImpact: boolean;
  };

  // Health Recommendations
  healthRecommendations: {
    generalPublic: string[];
    sensitiveGroups: string[];
    outdoorActivity: string;
    windowsOpen: string;
    airPurifier: string;
  };

  // Forecast and Trends
  healthForecast: {
    tomorrowAQI: number;
    weeklyTrend: 'improving' | 'stable' | 'worsening';
    seasonalVariation: string;
    climateTrend: string;
  };

  // Environmental Justice
  environmentalJusticeArea: {
    lowIncomeArea: boolean;
    minorityCommunity: boolean;
    cumulativePollutionBurden: number;
    healthDisparities: boolean;
  };

  monitoringDate: string;
  lastUpdated: string;
}

interface WaterHealthAdvisory {
  advisoryId: string;
  waterSystemName: string;
  advisoryType: 'health_advisory' | 'emergency_notice' | 'boil_water' | 'do_not_drink' | 'do_not_use';

  // Water System Information
  pwsId: string; // Public Water System ID
  systemType: 'community' | 'non_community' | 'military' | 'tribal';
  address: string;
  city: string;
  state: string;
  zipCode: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Advisory Details
  advisoryReason: string;
  contaminant: string;
  contaminantLevel: number;
  unit: string;
  maxContaminantLevel: number;
  healthGuideline: number;

  // Health Effects
  healthEffects: {
    acuteEffects: string[];
    chronicEffects: string[];
    targetPopulations: string[];
    symptomsToWatch: string[];
    medicalGuidance: string;
  };

  // Population Affected
  populationAffected: {
    totalPersons: number;
    households: number;
    businesses: number;
    schools: number;
    hospitals: number;
    nurseries: number;
  };

  // Military Population
  militaryPopulationAffected: {
    militaryInstallations: string[];
    militaryPersonnel: number;
    militaryFamilies: number;
    veteranCommunities: number;
    contractorPersonnel: number;
  };

  // Health Recommendations
  healthRecommendations: {
    drinkingWaterAdvice: string;
    cookingAdvice: string;
    bathingAdvice: string;
    infantFormula: string;
    vulnerablePopulations: string;
    medicalAdvice: string;
  };

  // Alternative Water Sources
  alternativeWaterSources: {
    bottledWaterDistribution: boolean;
    alternativeSupplyConnections: boolean;
    tankersProvided: boolean;
    publicWaterSources: string[];
  };

  // Remedial Actions
  remedialActions: {
    sourceWaterProtection: boolean;
    treatmentUpgrades: boolean;
    systemFlushing: boolean;
    disinfection: boolean;
    sourceShutdown: boolean;
  };

  // Environmental Justice
  environmentalJusticeImpact: {
    lowIncomeImpact: boolean;
    minorityImpact: boolean;
    linguisticMinorities: boolean;
    cumulativeImpacts: boolean;
    disproportionateImpact: boolean;
  };

  // Monitoring and Testing
  monitoringPlan: {
    increasedTesting: boolean;
    publicNotificationPlan: boolean;
    healthSurveillance: boolean;
    communityMeetings: boolean;
  };

  advisoryIssued: string;
  advisoryLifted: string | null;
  lastUpdated: string;
}

interface EnvironmentalJusticeAssessment {
  assessmentId: string;
  communityName: string;
  assessmentType: 'ej_screen' | 'community_assessment' | 'cumulative_impact' | 'health_disparities';

  // Geographic Scope
  address: string;
  city: string;
  state: string;
  zipCode: string;
  censusTracts: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Demographics
  demographics: {
    totalPopulation: number;
    minorities: number;
    lowIncome: number;
    limitedEnglish: number;
    under5: number;
    over64: number;
  };

  // Military Demographics
  militaryDemographics: {
    militaryPersonnel: number;
    veterans: number;
    militaryFamilies: number;
    militaryDependents: number;
    proximityToMilitaryInstallation: number; // km
  };

  // Environmental Indicators
  environmentalIndicators: {
    airQualityIndex: number;
    waterQualityIndex: number;
    soilContaminationIndex: number;
    toxicReleases: number;
    hazardousWasteSites: number;
    proximityToSuperfundSites: number; // km to nearest
  };

  // Health Disparities
  healthDisparities: {
    asthmaRate: number;
    cancerRate: number;
    heartDiseaseRate: number;
    diabetesRate: number;
    lowBirthWeightRate: number;
    lifeExpectancy: number;
    mentalhealthDisorders: number;
  };

  // Military Health Disparities
  militaryHealthDisparities: {
    veteranHealthOutcomes: {
      ptsdRate: number;
      respiratoryConditions: number;
      cancerRate: number;
      neurologicalConditions: number;
      tbi: number;
    };
    militaryFamilyHealth: {
      childAsthmaRate: number;
      adultsWithChronicConditions: number;
      mentalHealthIssues: number;
    };
  };

  // Cumulative Environmental burden
  cumulativeBurden: {
    ej ScreenPercentile: number;
    pollutionBurdenScore: number;
    vulnerabilityScore: number;
    cumulativeImpactScore: number;
  };

  // Environmental Exposures
  exposures: {
    trafficProximity: number;
    industrialProximity: number;
    hazardousWasteProximity: number;
    airToxicExposure: number;
    waterContamination: boolean;
  };

  // Social Vulnerability
  socialVulnerability: {
    povertyRate: number;
    unemploymentRate: number;
    educationLevel: number;
    linguisticIsolation: number;
    householdComposition: number;
    disability: number;
  };

  // Access to Resources
  resourceAccess: {
    healthcareFacilities: number; // per 10,000 people
    healthInsurance: number; // percentage
    transportation: string;
    groceryStores: number; // per 10,000 people
    greenSpace: number; // percentage of area
  };

  // Military Resource Access
  militaryResourceAccess: {
    vaFacilities: number;
    militaryTreatmentFacilities: number;
    tricarePoviders: number;
    veteranServices: number;
    militaryFamilySupport: number;
  };

  // Community Engagement
  communityEngagement: {
    publicParticipation: boolean;
    communityOrganizations: number;
    stakeholderEngagement: boolean;
    culturalCompetency: boolean;
    languageAccess: boolean;
  };

  // Mitigation and Solutions
  mitigationOpportunities: {
    pollutionReduction: string[];
    healthcareAccess: string[];
    communityprograms: string[];
    policyInterventions: string[];
    environmentalRemediation: string[];
  };

  assessmentDate: string;
  lastUpdated: string;
}

interface EPAHealthCache {
  environmentalHealthRisks: Map<string, EnvironmentalHealthRisk[]>;
  superfundHealthData: Map<string, SuperfundHealthData[]>;
  airQualityHealthIndex: Map<string, AirQualityHealthIndex[]>;
  waterHealthAdvisories: Map<string, WaterHealthAdvisory[]>;
  environmentalJusticeAssessments: Map<string, EnvironmentalJusticeAssessment[]>;
  _lastUpdated: string;
  _buildInProgress: boolean;
  _buildStartedAt: string;
}

let epaHealthCache: EPAHealthCache = {
  environmentalHealthRisks: new Map(),
  superfundHealthData: new Map(),
  airQualityHealthIndex: new Map(),
  waterHealthAdvisories: new Map(),
  environmentalJusticeAssessments: new Map(),
  _lastUpdated: '',
  _buildInProgress: false,
  _buildStartedAt: ''
};

// Build lock management
function isBuildInProgress(): boolean {
  if (!epaHealthCache._buildInProgress) return false;

  const buildStartTime = new Date(epaHealthCache._buildStartedAt).getTime();
  const now = Date.now();

  if (now - buildStartTime > BUILD_LOCK_TIMEOUT_MS) {
    console.log('EPA Health build lock timeout reached, clearing lock');
    epaHealthCache._buildInProgress = false;
    epaHealthCache._buildStartedAt = '';
    return false;
  }

  return true;
}

// Cache warming
export async function ensureWarmed(): Promise<void> {
  if (epaHealthCache.environmentalHealthRisks.size === 0) {
    await loadCacheFromDisk(epaHealthCache, CACHE_FILE);

    if (epaHealthCache.environmentalHealthRisks.size === 0) {
      await loadCacheFromBlob(epaHealthCache, BLOB_KEY);
    }
  }
}

// Geographic queries
export async function getEnvironmentalHealthRisksNearMilitary(
  lat: number,
  lng: number,
  radius: number = 50
): Promise<{
  healthRisks: EnvironmentalHealthRisk[];
  superfundSites: SuperfundHealthData[];
  airQualityIssues: AirQualityHealthIndex[];
  waterAdvisories: WaterHealthAdvisory[];
}> {
  await ensureWarmed();

  const centerGrid = gridKey(lat, lng);
  const searchGrids = [centerGrid, ...neighborKeys(lat, lng, Math.ceil(radius / 11.1))];

  const healthRisks: EnvironmentalHealthRisk[] = [];
  const superfundSites: SuperfundHealthData[] = [];
  const airQualityIssues: AirQualityHealthIndex[] = [];
  const waterAdvisories: WaterHealthAdvisory[] = [];

  for (const grid of searchGrids) {
    // Environmental health risks affecting military
    const gridRisks = epaHealthCache.environmentalHealthRisks.get(grid) || [];
    for (const risk of gridRisks) {
      const distance = haversineDistance(lat, lng, risk.coordinates.lat, risk.coordinates.lng);
      if (distance <= radius &&
          (risk.militaryPopulationAtRisk.activedutyPersonnel > 0 ||
           risk.militaryPopulationAtRisk.proximityToMilitaryBase <= 25)) {
        healthRisks.push(risk);
      }
    }

    // Superfund sites with military connections
    const gridSuperfund = epaHealthCache.superfundHealthData.get(grid) || [];
    for (const site of gridSuperfund) {
      const distance = haversineDistance(lat, lng, site.coordinates.lat, site.coordinates.lng);
      if (distance <= radius &&
          (site.militaryConnection.militaryInstallation ||
           site.militaryConnection.proximityToBase <= 25 ||
           site.siteType === 'military')) {
        superfundSites.push(site);
      }
    }

    // Air quality monitoring near military
    const gridAirQuality = epaHealthCache.airQualityHealthIndex.get(grid) || [];
    for (const monitor of gridAirQuality) {
      const distance = haversineDistance(lat, lng, monitor.coordinates.lat, monitor.coordinates.lng);
      if (distance <= radius &&
          (monitor.healthIndex.aqiValue >= 101 ||
           monitor.militaryImpact.militaryPersonnelExposed > 0 ||
           monitor.stationtype === 'military')) {
        airQualityIssues.push(monitor);
      }
    }

    // Water advisories affecting military
    const gridWaterAdvisories = epaHealthCache.waterHealthAdvisories.get(grid) || [];
    for (const advisory of gridWaterAdvisories) {
      const distance = haversineDistance(lat, lng, advisory.coordinates.lat, advisory.coordinates.lng);
      if (distance <= radius &&
          (advisory.militaryPopulationAffected.militaryInstallations.length > 0 ||
           advisory.systemType === 'military' ||
           !advisory.advisoryLifted)) {
        waterAdvisories.push(advisory);
      }
    }
  }

  return {
    healthRisks: healthRisks.sort((a, b) => b.militaryPopulationAtRisk.activedutyPersonnel - a.militaryPopulationAtRisk.activedutyPersonnel),
    superfundSites: superfundSites.sort((a, b) => a.militaryConnection.proximityToBase - b.militaryConnection.proximityToBase),
    airQualityIssues: airQualityIssues.sort((a, b) => b.healthIndex.aqiValue - a.healthIndex.aqiValue),
    waterAdvisories: waterAdvisories.sort((a, b) => b.militaryPopulationAffected.militaryPersonnel - a.militaryPopulationAffected.militaryPersonnel)
  };
}

export async function getMilitaryEnvironmentalJusticeAssessment(): Promise<{
  assessments: EnvironmentalJusticeAssessment[];
  totalMilitaryPopulationAtRisk: number;
  averageVeteranHealthDisparities: {
    ptsdRate: number;
    respiratoryConditions: number;
    cancerRate: number;
  };
  highBurdenCommunities: number;
}> {
  await ensureWarmed();

  const assessments: EnvironmentalJusticeAssessment[] = [];
  let totalMilitaryPopulationAtRisk = 0;
  let highBurdenCommunities = 0;
  let totalPtsdRate = 0;
  let totalRespiratoryConditions = 0;
  let totalCancerRate = 0;
  let assessmentCount = 0;

  for (const [grid, gridAssessments] of epaHealthCache.environmentalJusticeAssessments) {
    for (const assessment of gridAssessments) {
      const militaryPop = assessment.militaryDemographics.militaryPersonnel +
                         assessment.militaryDemographics.veterans +
                         assessment.militaryDemographics.militaryFamilies;

      if (militaryPop > 0 || assessment.militaryDemographics.proximityToMilitaryInstallation <= 25) {
        assessments.push(assessment);
        totalMilitaryPopulationAtRisk += militaryPop;

        if (assessment.cumulativeBurden.ej ScreenPercentile >= 80) {
          highBurdenCommunities++;
        }

        totalPtsdRate += assessment.militaryHealthDisparities.veteranHealthOutcomes.ptsdRate;
        totalRespiratoryConditions += assessment.militaryHealthDisparities.veteranHealthOutcomes.respiratoryConditions;
        totalCancerRate += assessment.militaryHealthDisparities.veteranHealthOutcomes.cancerRate;
        assessmentCount++;
      }
    }
  }

  return {
    assessments: assessments.sort((a, b) => b.cumulativeBurden.ej ScreenPercentile - a.cumulativeBurden.ej ScreenPercentile),
    totalMilitaryPopulationAtRisk,
    averageVeteranHealthDisparities: {
      ptsdRate: assessmentCount > 0 ? totalPtsdRate / assessmentCount : 0,
      respiratoryConditions: assessmentCount > 0 ? totalRespiratoryConditions / assessmentCount : 0,
      cancerRate: assessmentCount > 0 ? totalCancerRate / assessmentCount : 0
    },
    highBurdenCommunities
  };
}

// Analytics
export async function calculateEnvironmentalHealthMetrics(): Promise<{
  totalHealthRisks: number;
  militaryPopulationAtRisk: number;
  activeWaterAdvisories: number;
  superfundSitesNearMilitary: number;
  airQualityExceedances: number;
  environmentalJusticeConcerns: {
    highBurdenCommunities: number;
    militaryCommunitiesAffected: number;
    veteranHealthDisparities: number;
  };
  remediationStatus: {
    sitesUnderRemediation: number;
    sitesCompleted: number;
    ongoingMonitoring: number;
  };
}> {
  await ensureWarmed();

  let totalHealthRisks = 0;
  let militaryPopulationAtRisk = 0;
  let activeWaterAdvisories = 0;
  let superfundSitesNearMilitary = 0;
  let airQualityExceedances = 0;
  let highBurdenCommunities = 0;
  let militaryCommunitiesAffected = 0;
  let veteranHealthDisparities = 0;
  let sitesUnderRemediation = 0;
  let sitesCompleted = 0;
  let ongoingMonitoring = 0;

  // Environmental health risks
  for (const [grid, risks] of epaHealthCache.environmentalHealthRisks) {
    for (const risk of risks) {
      totalHealthRisks++;
      militaryPopulationAtRisk += risk.militaryPopulationAtRisk.activedutyPersonnel +
                                  risk.militaryPopulationAtRisk.veterans +
                                  risk.militaryPopulationAtRisk.militaryFamilies;

      if (risk.remediationStatus.remediationInProgress) sitesUnderRemediation++;
      if (risk.remediationStatus.remediationCompleted) sitesCompleted++;
      if (risk.remediationStatus.ongoingMonitoring) ongoingMonitoring++;
    }
  }

  // Superfund sites
  for (const [grid, sites] of epaHealthCache.superfundHealthData) {
    for (const site of sites) {
      if (site.militaryConnection.militaryInstallation ||
          site.militaryConnection.proximityToBase <= 25 ||
          site.siteType === 'military') {
        superfundSitesNearMilitary++;
      }
    }
  }

  // Air quality
  for (const [grid, monitors] of epaHealthCache.airQualityHealthIndex) {
    for (const monitor of monitors) {
      if (monitor.healthIndex.aqiValue > 100) {
        airQualityExceedances++;
      }
    }
  }

  // Water advisories
  for (const [grid, advisories] of epaHealthCache.waterHealthAdvisories) {
    for (const advisory of advisories) {
      if (!advisory.advisoryLifted) {
        activeWaterAdvisories++;
      }
    }
  }

  // Environmental justice
  for (const [grid, assessments] of epaHealthCache.environmentalJusticeAssessments) {
    for (const assessment of assessments) {
      if (assessment.cumulativeBurden.ej ScreenPercentile >= 80) {
        highBurdenCommunities++;
      }

      const militaryPop = assessment.militaryDemographics.militaryPersonnel +
                         assessment.militaryDemographics.veterans +
                         assessment.militaryDemographics.militaryFamilies;

      if (militaryPop > 0) {
        militaryCommunitiesAffected++;

        if (assessment.militaryHealthDisparities.veteranHealthOutcomes.ptsdRate > 20 ||
            assessment.militaryHealthDisparities.veteranHealthOutcomes.respiratoryConditions > 15 ||
            assessment.militaryHealthDisparities.veteranHealthOutcomes.cancerRate > 10) {
          veteranHealthDisparities++;
        }
      }
    }
  }

  return {
    totalHealthRisks,
    militaryPopulationAtRisk,
    activeWaterAdvisories,
    superfundSitesNearMilitary,
    airQualityExceedances,
    environmentalJusticeConcerns: {
      highBurdenCommunities,
      militaryCommunitiesAffected,
      veteranHealthDisparities
    },
    remediationStatus: {
      sitesUnderRemediation,
      sitesCompleted,
      ongoingMonitoring
    }
  };
}

// Cache management
export async function setEPAHealthCache(
  environmentalHealthRisks: EnvironmentalHealthRisk[],
  superfundHealthData: SuperfundHealthData[],
  airQualityHealthIndex: AirQualityHealthIndex[],
  waterHealthAdvisories: WaterHealthAdvisory[],
  environmentalJusticeAssessments: EnvironmentalJusticeAssessment[]
): Promise<void> {
  epaHealthCache._buildInProgress = true;
  epaHealthCache._buildStartedAt = new Date().toISOString();

  try {
    // Clear existing cache
    epaHealthCache.environmentalHealthRisks.clear();
    epaHealthCache.superfundHealthData.clear();
    epaHealthCache.airQualityHealthIndex.clear();
    epaHealthCache.waterHealthAdvisories.clear();
    epaHealthCache.environmentalJusticeAssessments.clear();

    // Grid-index all data types
    for (const risk of environmentalHealthRisks) {
      const grid = gridKey(risk.coordinates.lat, risk.coordinates.lng);
      if (!epaHealthCache.environmentalHealthRisks.has(grid)) {
        epaHealthCache.environmentalHealthRisks.set(grid, []);
      }
      epaHealthCache.environmentalHealthRisks.get(grid)!.push(risk);
    }

    for (const site of superfundHealthData) {
      const grid = gridKey(site.coordinates.lat, site.coordinates.lng);
      if (!epaHealthCache.superfundHealthData.has(grid)) {
        epaHealthCache.superfundHealthData.set(grid, []);
      }
      epaHealthCache.superfundHealthData.get(grid)!.push(site);
    }

    for (const monitor of airQualityHealthIndex) {
      const grid = gridKey(monitor.coordinates.lat, monitor.coordinates.lng);
      if (!epaHealthCache.airQualityHealthIndex.has(grid)) {
        epaHealthCache.airQualityHealthIndex.set(grid, []);
      }
      epaHealthCache.airQualityHealthIndex.get(grid)!.push(monitor);
    }

    for (const advisory of waterHealthAdvisories) {
      const grid = gridKey(advisory.coordinates.lat, advisory.coordinates.lng);
      if (!epaHealthCache.waterHealthAdvisories.has(grid)) {
        epaHealthCache.waterHealthAdvisories.set(grid, []);
      }
      epaHealthCache.waterHealthAdvisories.get(grid)!.push(advisory);
    }

    for (const assessment of environmentalJusticeAssessments) {
      const grid = gridKey(assessment.coordinates.lat, assessment.coordinates.lng);
      if (!epaHealthCache.environmentalJusticeAssessments.has(grid)) {
        epaHealthCache.environmentalJusticeAssessments.set(grid, []);
      }
      epaHealthCache.environmentalJusticeAssessments.get(grid)!.push(assessment);
    }

    epaHealthCache._lastUpdated = new Date().toISOString();

    await saveCacheToDisk(epaHealthCache, CACHE_FILE);
    await saveCacheToBlob(epaHealthCache, BLOB_KEY);

  } finally {
    epaHealthCache._buildInProgress = false;
    epaHealthCache._buildStartedAt = '';
  }
}

export function getEPAHealthCacheInfo(): {
  environmentalHealthRiskCount: number;
  superfundHealthSiteCount: number;
  airQualityMonitorCount: number;
  waterAdvisoryCount: number;
  environmentalJusticeAssessmentCount: number;
  lastUpdated: string;
  isBuilding: boolean;
} {
  let environmentalHealthRiskCount = 0;
  let superfundHealthSiteCount = 0;
  let airQualityMonitorCount = 0;
  let waterAdvisoryCount = 0;
  let environmentalJusticeAssessmentCount = 0;

  for (const risks of epaHealthCache.environmentalHealthRisks.values()) {
    environmentalHealthRiskCount += risks.length;
  }

  for (const sites of epaHealthCache.superfundHealthData.values()) {
    superfundHealthSiteCount += sites.length;
  }

  for (const monitors of epaHealthCache.airQualityHealthIndex.values()) {
    airQualityMonitorCount += monitors.length;
  }

  for (const advisories of epaHealthCache.waterHealthAdvisories.values()) {
    waterAdvisoryCount += advisories.length;
  }

  for (const assessments of epaHealthCache.environmentalJusticeAssessments.values()) {
    environmentalJusticeAssessmentCount += assessments.length;
  }

  return {
    environmentalHealthRiskCount,
    superfundHealthSiteCount,
    airQualityMonitorCount,
    waterAdvisoryCount,
    environmentalJusticeAssessmentCount,
    lastUpdated: epaHealthCache._lastUpdated,
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