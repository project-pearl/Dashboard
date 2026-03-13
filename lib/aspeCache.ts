/**
 * ASPE (Assistant Secretary for Planning and Evaluation) Cache
 *
 * Health policy research, evaluation data, and strategic planning information
 * for evidence-based policy decisions affecting military health and readiness.
 *
 * Data Sources:
 * - Health Policy Research
 * - Program Evaluation Studies
 * - Data Brief Series
 * - Health Insurance Research
 * - Human Services Research
 * - Disability Research
 * - Economic Analysis Reports
 * - Health Care Access and Quality Studies
 *
 * Military Applications:
 * - Military health policy impact assessment
 * - Defense health program evaluation
 * - Health care cost-effectiveness for military populations
 * - Military family health insurance research
 * - Deployment health policy analysis
 * - Military medical readiness policy research
 * - Environmental health policy for military installations
 * - Health disparities research affecting military communities
 */

import { gridKey, loadCacheFromDisk, saveCacheToDisk, neighborKeys } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';

const CACHE_FILE = '.cache/aspe-data.json';
const BLOB_KEY = 'aspe-cache';
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

interface HealthPolicyResearch {
  researchId: string;
  title: string;
  studyType: 'policy_analysis' | 'evaluation' | 'data_brief' | 'research_report' | 'issue_brief';

  // Study Details
  principalInvestigator: string;
  researchOrganization: string;
  fundingAmount: number;
  studyPeriod: {
    startDate: string;
    endDate: string;
  };

  // Geographic Scope
  geographicScope: 'national' | 'regional' | 'state' | 'local';
  statesIncluded: string[];
  populationFocus: string;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Research Focus Areas
  policyDomains: string[];
  targetPopulation: string[];
  healthConditions: string[];
  interventionTypes: string[];

  // Military Relevance
  militaryPopulationIncluded: boolean;
  veteranPopulationIncluded: boolean;
  militaryHealthSystemStudied: boolean;
  deploymentHealthFocus: boolean;
  militaryRelevanceScore: number; // 0-10

  // Methodology
  studyDesign: 'randomized_controlled_trial' | 'quasi_experimental' | 'observational' | 'systematic_review' | 'meta_analysis' | 'simulation';
  sampleSize: number;
  dataSource: string[];
  analyticalMethods: string[];

  // Key Findings
  primaryOutcomes: string[];
  effectSizes: { outcome: string; effect: number; confidence: string }[];
  costEffectivenessData: {
    costPerQALY: number | null;
    costSavings: number | null;
    returnOnInvestment: number | null;
  };

  // Policy Implications
  policyRecommendations: string[];
  implementationConsiderations: string[];
  scalabilityAssessment: string;

  // Environmental Health
  environmentalFactorsStudied: string[];
  waterQualityImpact: boolean;
  climateHealthConnections: boolean;

  // Publication and Dissemination
  publicationStatus: 'published' | 'in_review' | 'draft' | 'planned';
  peerReviewStatus: 'peer_reviewed' | 'internal_review' | 'white_paper';
  publicationDate: string;
  citationCount: number;

  lastUpdated: string;
}

interface ProgramEvaluation {
  evaluationId: string;
  programName: string;
  evaluationType: 'process' | 'outcome' | 'impact' | 'cost_effectiveness' | 'formative' | 'summative';

  // Program Details
  federalAgency: string;
  programOffice: string;
  totalProgramBudget: number;
  evaluationBudget: number;

  // Geographic Coverage
  implementationStates: string[];
  implementationSites: number;
  targetBeneficiaries: number;

  coordinates: {
    lat: number;
    lng: number;
  };

  // Evaluation Design
  evaluationPeriod: {
    baseline: string;
    followUp: string[];
    finalAssessment: string;
  };

  dataCollectionMethods: string[];
  comparisonGroups: boolean;
  randomizedDesign: boolean;

  // Military Applications
  militaryProgramEvaluation: boolean;
  veteranProgramEvaluation: boolean;
  militaryFamilyImpact: boolean;
  defenseCommunityProgram: boolean;

  // Outcomes Measured
  primaryOutcomes: {
    outcome: string;
    measurement: string;
    baselineValue: number;
    endlineValue: number;
    statisticalSignificance: boolean;
  }[];

  secondaryOutcomes: {
    outcome: string;
    measurement: string;
    change: number;
    direction: 'positive' | 'negative' | 'no_change';
  }[];

  // Cost Analysis
  costPerBeneficiary: number;
  costPerOutcome: number;
  programEfficiencyRatio: number;
  costSavingsToGovernment: number;

  // Implementation Findings
  implementationFidelity: number; // 0-1 scale
  participationRates: number;
  serviceDeliveryQuality: number;
  stakeholderSatisfaction: number;

  // Policy Impact
  policyChangesImplemented: string[];
  programModificationsRecommended: string[];
  scalabilityRecommendations: string[];

  // Health Equity Analysis
  disparitiesIdentified: boolean;
  equityAnalysisIncluded: boolean;
  subgroupAnalyses: string[];

  evaluationStatus: 'ongoing' | 'completed' | 'published' | 'under_review';
  lastUpdated: string;
}

interface HealthInsuranceAnalysis {
  analysisId: string;
  title: string;
  analysisType: 'market_analysis' | 'coverage_analysis' | 'cost_analysis' | 'access_analysis' | 'quality_analysis';

  // Data Sources
  dataSources: string[];
  analysisYear: number;
  sampleSize: number;

  // Geographic Scope
  geographicLevel: 'national' | 'state' | 'metropolitan' | 'county';
  areasAnalyzed: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Insurance Market Metrics
  marketConcentration: {
    hhi: number; // Herfindahl-Hirschman Index
    topTwoCarrierShare: number;
    numberOfCarriers: number;
  };

  // Coverage Analysis
  coverageRates: {
    totalPopulation: number;
    employerSponsored: number;
    individual: number;
    medicaid: number;
    medicare: number;
    military: number; // TRICARE, VA
    uninsured: number;
  };

  // Military Population Analysis
  militaryInsuranceData: {
    tricareBeneficiaries: number;
    vaBeneficiaries: number;
    militaryFamilyCoverage: number;
    veteranCoverageGaps: number;
    deploymentInsuranceContinuity: number;
  };

  // Cost Analysis
  premiumCosts: {
    individual: number;
    family: number;
    employerContribution: number;
    employeeContribution: number;
  };

  outOfPocketCosts: {
    deductibles: number;
    copayments: number;
    coinsurance: number;
    maximumOutOfPocket: number;
  };

  // Access Metrics
  providerNetworks: {
    adequacy: number; // 0-1 scale
    primaryCareAccess: number;
    specialtyAccess: number;
    mentalHealthAccess: number;
  };

  // Quality Measures
  qualityRatings: {
    overallRating: number;
    customerSatisfaction: number;
    clinicalQuality: number;
    preventiveCareAccess: number;
  };

  // Policy Implications
  affordabilityAssessment: string;
  accessBarriers: string[];
  qualityIssues: string[];
  policyRecommendations: string[];

  lastUpdated: string;
}

interface HealthDisparitiesResearch {
  researchId: string;
  title: string;
  disparityType: 'racial' | 'ethnic' | 'socioeconomic' | 'geographic' | 'gender' | 'disability' | 'military_status';

  // Study Population
  populationGroups: string[];
  totalSampleSize: number;
  studyPeriod: string;

  // Geographic Focus
  geographicScope: string;
  areasStudied: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Health Outcomes Studied
  healthOutcomes: {
    outcome: string;
    disparityMagnitude: number;
    statisticalSignificance: boolean;
    trendDirection: 'improving' | 'worsening' | 'stable';
  }[];

  // Military-Specific Disparities
  militaryDisparitiesStudied: boolean;
  veteranDisparitiesIncluded: boolean;
  activedutyComparison: boolean;
  deploymentHealthDisparities: boolean;

  // Contributing Factors
  socialDeterminants: {
    factor: string;
    contributionLevel: 'high' | 'moderate' | 'low';
    evidenceStrength: string;
  }[];

  accessBarriers: string[];
  systemicFactors: string[];

  // Environmental Justice
  environmentalHealthDisparities: boolean;
  waterQualityDisparities: boolean;
  airQualityDisparities: boolean;
  environmentalExposures: string[];

  // Interventions Studied
  interventionsEvaluated: {
    intervention: string;
    effectOnDisparity: number;
    implementationFeasibility: string;
    costEffectiveness: string;
  }[];

  // Policy Recommendations
  immediateActions: string[];
  longTermStrategies: string[];
  systemChangesNeeded: string[];

  // Methodological Details
  studyDesign: string;
  dataQuality: number; // 0-1 scale
  limitationsNoted: string[];

  publicationStatus: 'published' | 'in_review' | 'draft';
  lastUpdated: string;
}

interface EconomicAnalysis {
  analysisId: string;
  title: string;
  economicType: 'cost_benefit' | 'cost_effectiveness' | 'budget_impact' | 'economic_evaluation' | 'fiscal_analysis';

  // Analysis Scope
  interventionAnalyzed: string;
  comparisonInterventions: string[];
  perspective: 'societal' | 'healthcare' | 'government' | 'military';
  timeHorizon: number; // years

  // Geographic Scope
  geographicScope: string;
  applicableStates: string[];

  coordinates: {
    lat: number;
    lng: number;
  };

  // Cost Analysis
  interventionCosts: {
    directMedicalCosts: number;
    directNonMedicalCosts: number;
    indirectCosts: number;
    totalCosts: number;
  };

  costSavings: {
    healthcareSavings: number;
    productivitySavings: number;
    socialSavings: number;
    totalSavings: number;
  };

  // Outcomes Analysis
  healthOutcomes: {
    qualityAdjustedLifeYears: number;
    lifeYearsSaved: number;
    disabilityAdjustedLifeYears: number;
    casesAverted: number;
  };

  // Military Economic Impact
  militarySpecificAnalysis: boolean;
  militaryReadinessCosts: number;
  deploymentCostImpact: number;
  militaryHealthcareCosts: number;
  veteranCareCostImpact: number;

  // Economic Metrics
  incrementalCostEffectivenessRatio: number;
  netPresentValue: number;
  returnOnInvestment: number;
  paybackPeriod: number; // years
  benefitCostRatio: number;

  // Sensitivity Analysis
  sensitivityAnalysisPerformed: boolean;
  keyUncertainties: string[];
  robustnessOfFindings: string;

  // Budget Impact
  budgetImpactAnalysis: {
    year1Impact: number;
    year3Impact: number;
    year5Impact: number;
    populationImpact: number;
  };

  // Policy Implications
  fundingRecommendations: string[];
  implementationConsiderations: string[];
  scalabilityAssessment: string;

  validationStatus: 'peer_reviewed' | 'internal_review' | 'preliminary';
  lastUpdated: string;
}

interface ASPECache {
  healthPolicyResearch: Map<string, HealthPolicyResearch[]>;
  programEvaluations: Map<string, ProgramEvaluation[]>;
  insuranceAnalyses: Map<string, HealthInsuranceAnalysis[]>;
  disparitiesResearch: Map<string, HealthDisparitiesResearch[]>;
  economicAnalyses: Map<string, EconomicAnalysis[]>;
  _lastUpdated: string;
  _buildInProgress: boolean;
  _buildStartedAt: string;
}

let aspeCache: ASPECache = {
  healthPolicyResearch: new Map(),
  programEvaluations: new Map(),
  insuranceAnalyses: new Map(),
  disparitiesResearch: new Map(),
  economicAnalyses: new Map(),
  _lastUpdated: '',
  _buildInProgress: false,
  _buildStartedAt: ''
};

// Build lock management
function isBuildInProgress(): boolean {
  if (!aspeCache._buildInProgress) return false;

  const buildStartTime = new Date(aspeCache._buildStartedAt).getTime();
  const now = Date.now();

  if (now - buildStartTime > BUILD_LOCK_TIMEOUT_MS) {
    console.log('ASPE build lock timeout reached, clearing lock');
    aspeCache._buildInProgress = false;
    aspeCache._buildStartedAt = '';
    return false;
  }

  return true;
}

// Cache warming
export async function ensureWarmed(): Promise<void> {
  if (aspeCache.healthPolicyResearch.size === 0) {
    const diskData = loadCacheFromDisk<ASPECache>(CACHE_FILE);
    if (diskData) Object.assign(aspeCache, diskData);

    if (aspeCache.healthPolicyResearch.size === 0) {
      const blobData = await loadCacheFromBlob<ASPECache>(BLOB_KEY);
      if (blobData) Object.assign(aspeCache, blobData);
    }
  }
}

// Research queries
export async function getMilitaryRelevantResearch(minRelevanceScore: number = 7): Promise<{
  policyResearch: HealthPolicyResearch[];
  evaluations: ProgramEvaluation[];
  disparitiesStudies: HealthDisparitiesResearch[];
}> {
  await ensureWarmed();

  const policyResearch: HealthPolicyResearch[] = [];
  const evaluations: ProgramEvaluation[] = [];
  const disparitiesStudies: HealthDisparitiesResearch[] = [];

  // High military relevance policy research
  for (const [grid, research] of aspeCache.healthPolicyResearch) {
    for (const study of research) {
      if (study.militaryRelevanceScore >= minRelevanceScore ||
          study.militaryPopulationIncluded ||
          study.deploymentHealthFocus) {
        policyResearch.push(study);
      }
    }
  }

  // Military program evaluations
  for (const [grid, evaluations_grid] of aspeCache.programEvaluations) {
    for (const evaluation of evaluations_grid) {
      if (evaluation.militaryProgramEvaluation ||
          evaluation.veteranProgramEvaluation ||
          evaluation.militaryFamilyImpact) {
        evaluations.push(evaluation);
      }
    }
  }

  // Military disparities research
  for (const [grid, research] of aspeCache.disparitiesResearch) {
    for (const study of research) {
      if (study.militaryDisparitiesStudied ||
          study.veteranDisparitiesIncluded ||
          study.activedutyComparison) {
        disparitiesStudies.push(study);
      }
    }
  }

  return {
    policyResearch: policyResearch.sort((a, b) => b.militaryRelevanceScore - a.militaryRelevanceScore),
    evaluations: evaluations.sort((a, b) => b.totalProgramBudget - a.totalProgramBudget),
    disparitiesStudies: disparitiesStudies.sort((a, b) => b.totalSampleSize - a.totalSampleSize)
  };
}

export async function getCostEffectivenessAnalyses(
  militaryFocus: boolean = false,
  minROI: number = 1.0
): Promise<EconomicAnalysis[]> {
  await ensureWarmed();

  const analyses: EconomicAnalysis[] = [];

  for (const [grid, gridAnalyses] of aspeCache.economicAnalyses) {
    for (const analysis of gridAnalyses) {
      if (analysis.returnOnInvestment >= minROI) {
        if (!militaryFocus || analysis.militarySpecificAnalysis) {
          analyses.push(analysis);
        }
      }
    }
  }

  return analyses.sort((a, b) => b.returnOnInvestment - a.returnOnInvestment);
}

export async function getHealthInsuranceAnalysisByState(state: string): Promise<{
  analyses: HealthInsuranceAnalysis[];
  militaryCoverageData: {
    tricareBeneficiaries: number;
    vaBeneficiaries: number;
    coverageGaps: number;
  };
  marketMetrics: {
    averageConcentration: number;
    averagePremiums: number;
    accessRating: number;
  };
}> {
  await ensureWarmed();

  const analyses: HealthInsuranceAnalysis[] = [];

  for (const [grid, gridAnalyses] of aspeCache.insuranceAnalyses) {
    for (const analysis of gridAnalyses) {
      if (analysis.areasAnalyzed.includes(state.toUpperCase()) ||
          analysis.areasAnalyzed.includes(state.toLowerCase())) {
        analyses.push(analysis);
      }
    }
  }

  if (analyses.length === 0) {
    return {
      analyses: [],
      militaryCoverageData: {
        tricareBeneficiaries: 0,
        vaBeneficiaries: 0,
        coverageGaps: 0
      },
      marketMetrics: {
        averageConcentration: 0,
        averagePremiums: 0,
        accessRating: 0
      }
    };
  }

  const militaryCoverageData = {
    tricareBeneficiaries: analyses.reduce((sum, a) => sum + a.militaryInsuranceData.tricareBeneficiaries, 0),
    vaBeneficiaries: analyses.reduce((sum, a) => sum + a.militaryInsuranceData.vaBeneficiaries, 0),
    coverageGaps: analyses.reduce((sum, a) => sum + a.militaryInsuranceData.veteranCoverageGaps, 0)
  };

  const marketMetrics = {
    averageConcentration: analyses.reduce((sum, a) => sum + a.marketConcentration.hhi, 0) / analyses.length,
    averagePremiums: analyses.reduce((sum, a) => sum + a.premiumCosts.family, 0) / analyses.length,
    accessRating: analyses.reduce((sum, a) => sum + a.providerNetworks.adequacy, 0) / analyses.length
  };

  return {
    analyses: analyses.sort((a, b) => b.analysisYear - a.analysisYear),
    militaryCoverageData,
    marketMetrics
  };
}

export async function getEnvironmentalHealthPolicyResearch(): Promise<{
  waterQualityStudies: HealthPolicyResearch[];
  environmentalDisparities: HealthDisparitiesResearch[];
  policyRecommendations: string[];
}> {
  await ensureWarmed();

  const waterQualityStudies: HealthPolicyResearch[] = [];
  const environmentalDisparities: HealthDisparitiesResearch[] = [];
  const policyRecommendations: string[] = [];

  for (const [grid, research] of aspeCache.healthPolicyResearch) {
    for (const study of research) {
      if (study.waterQualityImpact || study.environmentalFactorsStudied.length > 0) {
        waterQualityStudies.push(study);
        policyRecommendations.push(...study.policyRecommendations);
      }
    }
  }

  for (const [grid, research] of aspeCache.disparitiesResearch) {
    for (const study of research) {
      if (study.environmentalHealthDisparities || study.waterQualityDisparities) {
        environmentalDisparities.push(study);
        policyRecommendations.push(...study.immediateActions, ...study.longTermStrategies);
      }
    }
  }

  // Remove duplicates from policy recommendations
  const uniquePolicyRecommendations = [...new Set(policyRecommendations)];

  return {
    waterQualityStudies: waterQualityStudies.sort((a, b) => new Date(b.publicationDate).getTime() - new Date(a.publicationDate).getTime()),
    environmentalDisparities: environmentalDisparities.sort((a, b) => b.totalSampleSize - a.totalSampleSize),
    policyRecommendations: uniquePolicyRecommendations
  };
}

// Analytics
export async function calculatePolicyResearchImpact(): Promise<{
  totalStudies: number;
  militaryRelevantStudies: number;
  averageMilitaryRelevanceScore: number;
  totalResearchFunding: number;
  policiesInfluenced: number;
  costSavingsIdentified: number;
  evidenceQuality: {
    peerReviewed: number;
    highQualityData: number;
    largeScale: number;
  };
}> {
  await ensureWarmed();

  let totalStudies = 0;
  let militaryRelevantStudies = 0;
  let totalRelevanceScore = 0;
  let totalResearchFunding = 0;
  let policiesInfluenced = 0;
  let costSavingsIdentified = 0;
  let peerReviewed = 0;
  let highQualityData = 0;
  let largeScale = 0;

  for (const [grid, research] of aspeCache.healthPolicyResearch) {
    for (const study of research) {
      totalStudies++;
      totalResearchFunding += study.fundingAmount;

      if (study.militaryRelevanceScore >= 5) {
        militaryRelevantStudies++;
        totalRelevanceScore += study.militaryRelevanceScore;
      }

      policiesInfluenced += study.policyRecommendations.length;

      if (study.peerReviewStatus === 'peer_reviewed') {
        peerReviewed++;
      }

      if (study.sampleSize >= 10000) {
        largeScale++;
      }
    }
  }

  for (const [grid, analyses] of aspeCache.economicAnalyses) {
    for (const analysis of analyses) {
      costSavingsIdentified += analysis.costSavings.totalSavings;
    }
  }

  for (const [grid, evaluations] of aspeCache.programEvaluations) {
    for (const evaluation of evaluations) {
      costSavingsIdentified += evaluation.costSavingsToGovernment;
    }
  }

  const averageMilitaryRelevanceScore = militaryRelevantStudies > 0
    ? totalRelevanceScore / militaryRelevantStudies
    : 0;

  return {
    totalStudies,
    militaryRelevantStudies,
    averageMilitaryRelevanceScore,
    totalResearchFunding,
    policiesInfluenced,
    costSavingsIdentified,
    evidenceQuality: {
      peerReviewed,
      highQualityData: highQualityData,
      largeScale
    }
  };
}

// Cache management
export async function setASPECache(
  healthPolicyResearch: HealthPolicyResearch[],
  programEvaluations: ProgramEvaluation[],
  insuranceAnalyses: HealthInsuranceAnalysis[],
  disparitiesResearch: HealthDisparitiesResearch[],
  economicAnalyses: EconomicAnalysis[]
): Promise<void> {
  aspeCache._buildInProgress = true;
  aspeCache._buildStartedAt = new Date().toISOString();

  try {
    // Clear existing cache
    aspeCache.healthPolicyResearch.clear();
    aspeCache.programEvaluations.clear();
    aspeCache.insuranceAnalyses.clear();
    aspeCache.disparitiesResearch.clear();
    aspeCache.economicAnalyses.clear();

    // Grid-index all data types
    for (const research of healthPolicyResearch) {
      const grid = gridKey(research.coordinates.lat, research.coordinates.lng);
      if (!aspeCache.healthPolicyResearch.has(grid)) {
        aspeCache.healthPolicyResearch.set(grid, []);
      }
      aspeCache.healthPolicyResearch.get(grid)!.push(research);
    }

    for (const evaluation of programEvaluations) {
      const grid = gridKey(evaluation.coordinates.lat, evaluation.coordinates.lng);
      if (!aspeCache.programEvaluations.has(grid)) {
        aspeCache.programEvaluations.set(grid, []);
      }
      aspeCache.programEvaluations.get(grid)!.push(evaluation);
    }

    for (const analysis of insuranceAnalyses) {
      const grid = gridKey(analysis.coordinates.lat, analysis.coordinates.lng);
      if (!aspeCache.insuranceAnalyses.has(grid)) {
        aspeCache.insuranceAnalyses.set(grid, []);
      }
      aspeCache.insuranceAnalyses.get(grid)!.push(analysis);
    }

    for (const research of disparitiesResearch) {
      const grid = gridKey(research.coordinates.lat, research.coordinates.lng);
      if (!aspeCache.disparitiesResearch.has(grid)) {
        aspeCache.disparitiesResearch.set(grid, []);
      }
      aspeCache.disparitiesResearch.get(grid)!.push(research);
    }

    for (const analysis of economicAnalyses) {
      const grid = gridKey(analysis.coordinates.lat, analysis.coordinates.lng);
      if (!aspeCache.economicAnalyses.has(grid)) {
        aspeCache.economicAnalyses.set(grid, []);
      }
      aspeCache.economicAnalyses.get(grid)!.push(analysis);
    }

    aspeCache._lastUpdated = new Date().toISOString();

    saveCacheToDisk(CACHE_FILE, aspeCache);
    await saveCacheToBlob(BLOB_KEY, aspeCache);

  } finally {
    aspeCache._buildInProgress = false;
    aspeCache._buildStartedAt = '';
  }
}

export function getASPECacheInfo(): {
  policyResearchCount: number;
  evaluationCount: number;
  insuranceAnalysisCount: number;
  disparitiesResearchCount: number;
  economicAnalysisCount: number;
  lastUpdated: string;
  isBuilding: boolean;
} {
  let policyResearchCount = 0;
  let evaluationCount = 0;
  let insuranceAnalysisCount = 0;
  let disparitiesResearchCount = 0;
  let economicAnalysisCount = 0;

  for (const research of aspeCache.healthPolicyResearch.values()) {
    policyResearchCount += research.length;
  }

  for (const evaluations of aspeCache.programEvaluations.values()) {
    evaluationCount += evaluations.length;
  }

  for (const analyses of aspeCache.insuranceAnalyses.values()) {
    insuranceAnalysisCount += analyses.length;
  }

  for (const research of aspeCache.disparitiesResearch.values()) {
    disparitiesResearchCount += research.length;
  }

  for (const analyses of aspeCache.economicAnalyses.values()) {
    economicAnalysisCount += analyses.length;
  }

  return {
    policyResearchCount,
    evaluationCount,
    insuranceAnalysisCount,
    disparitiesResearchCount,
    economicAnalysisCount,
    lastUpdated: aspeCache._lastUpdated,
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