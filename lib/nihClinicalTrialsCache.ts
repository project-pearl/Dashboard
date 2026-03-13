/**
 * NIH Clinical Trials Registry Cache
 * Clinical trials, research studies, and medical research correlations
 * Part of Tier 2 HHS integration - critical for research-based health intelligence
 */

import { HHSAPIClient, type HHSHealthRecord, addMilitaryProximity, correlateWithWaterViolations } from './hhsDataUtils';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta, gridKey } from './cacheUtils';

export type StudyType = 'interventional' | 'observational' | 'expanded_access' | 'diagnostic_test' | 'prevention' | 'treatment' | 'supportive_care';
export type StudyPhase = 'early_phase_1' | 'phase_1' | 'phase_2' | 'phase_3' | 'phase_4' | 'not_applicable';
export type StudyStatus = 'recruiting' | 'active_not_recruiting' | 'completed' | 'terminated' | 'suspended' | 'withdrawn' | 'unknown';
export type InterventionType = 'drug' | 'device' | 'biological' | 'procedure' | 'behavioral' | 'dietary' | 'radiation' | 'other';

export interface NIHClinicalTrialsRecord extends HHSHealthRecord {
  nihClinicalTrialsSpecific: {
    nctId: string;
    studyTitle: string;
    studyType: StudyType;
    studyPhase?: StudyPhase;
    studyStatus: StudyStatus;
    primaryPurpose?: string;
    startDate?: string;
    completionDate?: string;
    lastUpdateDate?: string;
    enrollmentTarget?: number;
    enrollmentActual?: number;
    conditions: string[];
    interventions: {
      type: InterventionType;
      name: string;
      description?: string;
    }[];
    outcomes: {
      primary: string[];
      secondary: string[];
    };
    eligibilityCriteria: {
      ageRange: {
        minimumAge?: string;
        maximumAge?: string;
      };
      gender: 'all' | 'male' | 'female';
      healthyVolunteers: boolean;
      inclusionCriteria?: string[];
      exclusionCriteria?: string[];
    };
    sponsorInformation: {
      leadSponsor: string;
      sponsorType: 'industry' | 'nih' | 'other_federal' | 'other' | 'network';
      collaborators?: string[];
    };
    studyLocations: {
      facility: string;
      city?: string;
      state?: string;
      country: string;
      status?: string;
      contactInfo?: string;
    }[];
    environmentalHealthRelevance: {
      waterQualityRelated: boolean;
      airQualityRelated: boolean;
      chemicalExposureRelated: boolean;
      environmentalToxinStudy: boolean;
      occupationalHealthStudy: boolean;
      climateHealthRelated: boolean;
    };
    militaryRelevance: {
      veteranPopulationStudy: boolean;
      militaryPersonnelStudy: boolean;
      combatRelatedConditions: boolean;
      ptsdTbiStudy: boolean;
      deploymentHealthStudy: boolean;
      defenseRelatedResearch: boolean;
    };
    dataQuality: {
      hasResults: boolean;
      resultsPosted: boolean;
      publicationsAvailable: boolean;
      lastVerified?: string;
      responsiblePartyType?: string;
    };
    researchFocus: {
      preventiveStudy: boolean;
      therapeuticStudy: boolean;
      diagnosticStudy: boolean;
      qualityOfLifeStudy: boolean;
      healthServicesResearch: boolean;
      basicScience: boolean;
    };
    reportingPeriod: string;
    lastUpdated: string;
  };
}

interface NIHClinicalTrialsCacheData {
  records: NIHClinicalTrialsRecord[];
  spatialIndex: Record<string, NIHClinicalTrialsRecord[]>;
  summary: {
    totalTrials: number;
    activeTrials: number;
    completedTrials: number;
    studyTypeDistribution: Record<StudyType, number>;
    studyPhaseDistribution: Record<StudyPhase, number>;
    studyStatusDistribution: Record<StudyStatus, number>;
    interventionTypeDistribution: Record<InterventionType, number>;
    sponsorTypeDistribution: Record<string, number>;
    environmentalHealthTrials: number;
    militaryRelevantTrials: number;
    veteranPopulationTrials: number;
    totalEnrollmentTarget: number;
    uniqueConditions: number;
    uniqueInterventions: number;
    studiesWithResults: number;
    stateDistribution: Record<string, number>;
    topConditions: { condition: string; count: number; }[];
    topInterventions: { intervention: string; count: number; }[];
  };
  correlations: {
    environmentalHealthStudies: any[];
    militaryHealthResearch: any[];
    preventiveResearchOpportunities: any[];
    multiSiteCollaborations: any[];
  };
  metadata: { lastUpdated: string; dataVersion: string; };
}

let nihClinicalTrialsCache: NIHClinicalTrialsCacheData | null = null;
let lastFetched: string | null = null;
let _buildInProgress = false;
let _buildStartedAt: string | null = null;
let _nihClinicalTrialsCacheLoaded = false;
let _lastDelta: CacheDelta | null = null;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
const CACHE_FILE = 'nih-clinical-trials.json';

export function getNIHClinicalTrialsCacheStatus() {
  return {
    loaded: _nihClinicalTrialsCacheLoaded && nihClinicalTrialsCache !== null,
    built: lastFetched,
    recordCount: nihClinicalTrialsCache?.records?.length || 0,
    activeTrials: nihClinicalTrialsCache?.summary?.activeTrials || 0,
    buildInProgress: isBuildInProgress(),
    lastDelta: _lastDelta,
  };
}

export function getNIHClinicalTrialsCache(): NIHClinicalTrialsRecord[] { return nihClinicalTrialsCache?.records || []; }

export async function setNIHClinicalTrialsCache(data: NIHClinicalTrialsCacheData): Promise<void> {
  if (!data.records?.length) { console.warn('No NIH Clinical Trials data to cache'); return; }
  const prevCounts = nihClinicalTrialsCache ? { recordCount: nihClinicalTrialsCache.summary.totalTrials } : null;
  _lastDelta = computeCacheDelta(prevCounts, { recordCount: data.summary.totalTrials }, lastFetched);
  nihClinicalTrialsCache = data; lastFetched = new Date().toISOString(); _nihClinicalTrialsCacheLoaded = true;
  await saveToDisk(data); await saveCacheToBlob(CACHE_FILE, data);
}

export function setBuildInProgress(inProgress: boolean): void { _buildInProgress = inProgress; _buildStartedAt = inProgress ? new Date().toISOString() : null; }
export function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;
  if (_buildStartedAt && Date.now() - new Date(_buildStartedAt).getTime() > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('NIH Clinical Trials build lock expired'); _buildInProgress = false; _buildStartedAt = null; return false;
  }
  return _buildInProgress;
}

export async function ensureWarmed(): Promise<void> {
  if (_nihClinicalTrialsCacheLoaded) return;
  try {
    const diskData = await loadFromDisk();
    if (diskData?.records?.length) { nihClinicalTrialsCache = diskData; _nihClinicalTrialsCacheLoaded = true; return; }
  } catch (e) { console.warn('NIH Clinical Trials disk load failed:', e); }
  try {
    const blobData = await loadCacheFromBlob<NIHClinicalTrialsCacheData>(CACHE_FILE);
    if (blobData?.records?.length) { nihClinicalTrialsCache = blobData; _nihClinicalTrialsCacheLoaded = true; await saveToDisk(blobData); }
  } catch (e) { console.warn('NIH Clinical Trials blob load failed:', e); }
}

async function loadFromDisk(): Promise<NIHClinicalTrialsCacheData | null> {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs'); const path = require('path');
    const file = path.join(process.cwd(), '.cache', CACHE_FILE);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!data?.records) return null;
    console.log(`[NIH Clinical Trials Cache] Loaded from disk (${data.records.length} records)`);
    return data;
  } catch (e) { return null; }
}

async function saveToDisk(data: NIHClinicalTrialsCacheData): Promise<void> {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs'); const path = require('path');
    const cacheDir = path.join(process.cwd(), '.cache'); const file = path.join(cacheDir, CACHE_FILE);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
    console.log(`[NIH Clinical Trials Cache] Saved to disk (${data.records.length} records)`);
  } catch (e) { console.warn('NIH Clinical Trials disk save failed:', e); }
}

export function processNIHClinicalTrialsData(rawRecords: any[]): NIHClinicalTrialsRecord[] {
  return rawRecords.map(raw => ({
    id: `nih_ct_${raw.nct_id || raw.id || Date.now()}`,
    source: 'nih_clinical_trials',
    location: extractPrimaryLocation(raw.study_locations || raw.locations),
    temporal: {
      reportDate: raw.last_update_date || raw.start_date || new Date().toISOString(),
      year: extractStudyYear(raw.start_date, raw.completion_date),
    },
    healthMetrics: [{
      category: 'clinical_research',
      measure: 'enrollment_target',
      value: parseInt(raw.enrollment_target || raw.enrollment || 0),
      unit: 'participants',
    }],
    nihClinicalTrialsSpecific: {
      nctId: raw.nct_id || raw.id || 'unknown',
      studyTitle: raw.study_title || raw.title || 'Unknown Study',
      studyType: normalizeStudyType(raw.study_type),
      studyPhase: normalizeStudyPhase(raw.study_phase || raw.phase),
      studyStatus: normalizeStudyStatus(raw.study_status || raw.status),
      primaryPurpose: raw.primary_purpose,
      startDate: raw.start_date,
      completionDate: raw.completion_date || raw.primary_completion_date,
      lastUpdateDate: raw.last_update_date || raw.last_updated,
      enrollmentTarget: parseInt(raw.enrollment_target || raw.enrollment) || undefined,
      enrollmentActual: parseInt(raw.enrollment_actual) || undefined,
      conditions: parseConditions(raw.conditions || raw.condition_browse),
      interventions: parseInterventions(raw.interventions || raw.intervention_browse),
      outcomes: {
        primary: parseOutcomes(raw.primary_outcomes || raw.primary_outcome),
        secondary: parseOutcomes(raw.secondary_outcomes || raw.secondary_outcome),
      },
      eligibilityCriteria: {
        ageRange: {
          minimumAge: raw.minimum_age,
          maximumAge: raw.maximum_age,
        },
        gender: normalizeGender(raw.gender || raw.sex),
        healthyVolunteers: parseBoolean(raw.healthy_volunteers),
        inclusionCriteria: parseStringArray(raw.inclusion_criteria),
        exclusionCriteria: parseStringArray(raw.exclusion_criteria),
      },
      sponsorInformation: {
        leadSponsor: raw.lead_sponsor || raw.sponsor || 'Unknown Sponsor',
        sponsorType: normalizeSponsorType(raw.sponsor_type || raw.lead_sponsor_class),
        collaborators: parseStringArray(raw.collaborators),
      },
      studyLocations: parseStudyLocations(raw.study_locations || raw.locations),
      environmentalHealthRelevance: {
        waterQualityRelated: isWaterQualityRelated(raw.study_title, raw.conditions),
        airQualityRelated: isAirQualityRelated(raw.study_title, raw.conditions),
        chemicalExposureRelated: isChemicalExposureRelated(raw.study_title, raw.conditions),
        environmentalToxinStudy: isEnvironmentalToxinStudy(raw.study_title, raw.interventions),
        occupationalHealthStudy: isOccupationalHealthStudy(raw.study_title, raw.conditions),
        climateHealthRelated: isClimateHealthRelated(raw.study_title, raw.conditions),
      },
      militaryRelevance: {
        veteranPopulationStudy: isVeteranPopulationStudy(raw.study_title, raw.conditions, raw.eligibility_criteria),
        militaryPersonnelStudy: isMilitaryPersonnelStudy(raw.study_title, raw.eligibility_criteria),
        combatRelatedConditions: isCombatRelatedConditions(raw.study_title, raw.conditions),
        ptsdTbiStudy: isPtsdTbiStudy(raw.study_title, raw.conditions),
        deploymentHealthStudy: isDeploymentHealthStudy(raw.study_title, raw.conditions),
        defenseRelatedResearch: isDefenseRelatedResearch(raw.sponsor, raw.collaborators),
      },
      dataQuality: {
        hasResults: parseBoolean(raw.has_results),
        resultsPosted: parseBoolean(raw.results_posted),
        publicationsAvailable: parseBoolean(raw.has_publications),
        lastVerified: raw.last_verified_date,
        responsiblePartyType: raw.responsible_party_type,
      },
      researchFocus: {
        preventiveStudy: isPreventiveStudy(raw.primary_purpose, raw.study_title),
        therapeuticStudy: isTherapeuticStudy(raw.primary_purpose, raw.interventions),
        diagnosticStudy: isDiagnosticStudy(raw.primary_purpose, raw.study_title),
        qualityOfLifeStudy: isQualityOfLifeStudy(raw.study_title, raw.outcomes),
        healthServicesResearch: isHealthServicesResearch(raw.study_title, raw.primary_purpose),
        basicScience: isBasicScience(raw.study_title, raw.study_type),
      },
      reportingPeriod: extractReportingPeriod(raw.start_date, raw.completion_date),
      lastUpdated: raw.last_update_date || new Date().toISOString(),
    }
  }));
}

function extractPrimaryLocation(studyLocations: any): any {
  if (!studyLocations) return { state: 'Unknown' };

  let locations = [];
  if (Array.isArray(studyLocations)) {
    locations = studyLocations;
  } else if (typeof studyLocations === 'string') {
    try { locations = JSON.parse(studyLocations); } catch { locations = []; }
  }

  if (locations.length > 0) {
    const primaryLocation = locations[0];
    return {
      state: primaryLocation.state || 'Unknown',
      city: primaryLocation.city,
      country: primaryLocation.country || 'United States',
    };
  }

  return { state: 'Unknown' };
}

function extractStudyYear(startDate: string, completionDate: string): number {
  const start = startDate ? new Date(startDate).getFullYear() : null;
  const completion = completionDate ? new Date(completionDate).getFullYear() : null;
  return start || completion || new Date().getFullYear();
}

function normalizeStudyType(studyType: string): StudyType {
  const type = (studyType || '').toLowerCase();

  if (type.includes('interventional')) return 'interventional';
  if (type.includes('observational')) return 'observational';
  if (type.includes('expanded access')) return 'expanded_access';
  if (type.includes('diagnostic')) return 'diagnostic_test';
  if (type.includes('prevention')) return 'prevention';
  if (type.includes('treatment')) return 'treatment';
  if (type.includes('supportive')) return 'supportive_care';

  return 'observational';
}

function normalizeStudyPhase(studyPhase: string): StudyPhase | undefined {
  const phase = (studyPhase || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (phase.includes('earlyphase1')) return 'early_phase_1';
  if (phase.includes('phase1')) return 'phase_1';
  if (phase.includes('phase2')) return 'phase_2';
  if (phase.includes('phase3')) return 'phase_3';
  if (phase.includes('phase4')) return 'phase_4';
  if (phase.includes('notapplicable') || phase.includes('na')) return 'not_applicable';

  return undefined;
}

function normalizeStudyStatus(studyStatus: string): StudyStatus {
  const status = (studyStatus || '').toLowerCase();

  if (status.includes('recruiting')) return 'recruiting';
  if (status.includes('active') && status.includes('not recruiting')) return 'active_not_recruiting';
  if (status.includes('completed')) return 'completed';
  if (status.includes('terminated')) return 'terminated';
  if (status.includes('suspended')) return 'suspended';
  if (status.includes('withdrawn')) return 'withdrawn';

  return 'unknown';
}

function normalizeGender(gender: string): 'all' | 'male' | 'female' {
  const g = (gender || '').toLowerCase();

  if (g.includes('male') && !g.includes('female')) return 'male';
  if (g.includes('female')) return 'female';

  return 'all';
}

function normalizeSponsorType(sponsorType: string): 'industry' | 'nih' | 'other_federal' | 'other' | 'network' {
  const type = (sponsorType || '').toLowerCase();

  if (type.includes('industry')) return 'industry';
  if (type.includes('nih') || type.includes('national institutes')) return 'nih';
  if (type.includes('federal') || type.includes('government') || type.includes('dod') || type.includes('va')) return 'other_federal';
  if (type.includes('network') || type.includes('cooperative')) return 'network';

  return 'other';
}

function parseConditions(conditions: any): string[] {
  if (Array.isArray(conditions)) return conditions.map(c => String(c));
  if (typeof conditions === 'string') {
    try {
      const parsed = JSON.parse(conditions);
      return Array.isArray(parsed) ? parsed.map(c => String(c)) : [conditions];
    } catch {
      return [conditions];
    }
  }
  return [];
}

function parseInterventions(interventions: any): { type: InterventionType; name: string; description?: string; }[] {
  if (!interventions) return [];

  let interventionList = [];
  if (Array.isArray(interventions)) {
    interventionList = interventions;
  } else if (typeof interventions === 'string') {
    try { interventionList = JSON.parse(interventions); } catch { interventionList = [{ name: interventions }]; }
  }

  return interventionList.map((intervention: any) => ({
    type: determineInterventionType(intervention.type || intervention.intervention_type || intervention.name),
    name: intervention.name || intervention.intervention_name || String(intervention),
    description: intervention.description,
  }));
}

function determineInterventionType(interventionType: string): InterventionType {
  const type = (interventionType || '').toLowerCase();

  if (type.includes('drug') || type.includes('medication')) return 'drug';
  if (type.includes('device')) return 'device';
  if (type.includes('biological') || type.includes('vaccine')) return 'biological';
  if (type.includes('procedure') || type.includes('surgery')) return 'procedure';
  if (type.includes('behavioral') || type.includes('therapy')) return 'behavioral';
  if (type.includes('dietary') || type.includes('nutrition')) return 'dietary';
  if (type.includes('radiation')) return 'radiation';

  return 'other';
}

function parseOutcomes(outcomes: any): string[] {
  if (Array.isArray(outcomes)) return outcomes.map(o => String(o));
  if (typeof outcomes === 'string') return [outcomes];
  return [];
}

function parseStringArray(value: any): string[] {
  if (Array.isArray(value)) return value.map(v => String(v));
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(v => String(v)) : [value];
    } catch {
      return [value];
    }
  }
  return [];
}

function parseStudyLocations(studyLocations: any): any[] {
  if (!studyLocations) return [];

  let locations = [];
  if (Array.isArray(studyLocations)) {
    locations = studyLocations;
  } else if (typeof studyLocations === 'string') {
    try { locations = JSON.parse(studyLocations); } catch { locations = []; }
  }

  return locations.map((location: any) => ({
    facility: location.facility || location.name || 'Unknown Facility',
    city: location.city,
    state: location.state,
    country: location.country || 'United States',
    status: location.status,
    contactInfo: location.contact_info,
  }));
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', 'yes', '1'].includes(value.toLowerCase());
  return false;
}

function isWaterQualityRelated(studyTitle: string, conditions: any): boolean {
  const combined = `${studyTitle || ''} ${JSON.stringify(conditions || {})}`.toLowerCase();
  return ['water', 'drinking water', 'waterborne', 'hydration', 'dehydration', 'water contamination'].some(keyword => combined.includes(keyword));
}

function isAirQualityRelated(studyTitle: string, conditions: any): boolean {
  const combined = `${studyTitle || ''} ${JSON.stringify(conditions || {})}`.toLowerCase();
  return ['air pollution', 'respiratory', 'asthma', 'copd', 'lung', 'air quality', 'particulate matter'].some(keyword => combined.includes(keyword));
}

function isChemicalExposureRelated(studyTitle: string, conditions: any): boolean {
  const combined = `${studyTitle || ''} ${JSON.stringify(conditions || {})}`.toLowerCase();
  return ['chemical exposure', 'toxic', 'pesticide', 'lead', 'mercury', 'chemical poisoning', 'occupational exposure'].some(keyword => combined.includes(keyword));
}

function isEnvironmentalToxinStudy(studyTitle: string, interventions: any): boolean {
  const combined = `${studyTitle || ''} ${JSON.stringify(interventions || {})}`.toLowerCase();
  return ['environmental toxin', 'heavy metals', 'chemical contamination', 'environmental health', 'toxicology'].some(keyword => combined.includes(keyword));
}

function isOccupationalHealthStudy(studyTitle: string, conditions: any): boolean {
  const combined = `${studyTitle || ''} ${JSON.stringify(conditions || {})}`.toLowerCase();
  return ['occupational', 'workplace', 'work-related', 'industrial hygiene', 'occupational disease'].some(keyword => combined.includes(keyword));
}

function isClimateHealthRelated(studyTitle: string, conditions: any): boolean {
  const combined = `${studyTitle || ''} ${JSON.stringify(conditions || {})}`.toLowerCase();
  return ['climate change', 'heat stress', 'extreme weather', 'temperature', 'climate health', 'weather-related'].some(keyword => combined.includes(keyword));
}

function isVeteranPopulationStudy(studyTitle: string, conditions: any, eligibilityCriteria: any): boolean {
  const combined = `${studyTitle || ''} ${JSON.stringify(conditions || {})} ${JSON.stringify(eligibilityCriteria || {})}`.toLowerCase();
  return ['veteran', 'veterans affairs', 'va hospital', 'former military', 'ex-military'].some(keyword => combined.includes(keyword));
}

function isMilitaryPersonnelStudy(studyTitle: string, eligibilityCriteria: any): boolean {
  const combined = `${studyTitle || ''} ${JSON.stringify(eligibilityCriteria || {})}`.toLowerCase();
  return ['military personnel', 'service members', 'active duty', 'military service', 'armed forces'].some(keyword => combined.includes(keyword));
}

function isCombatRelatedConditions(studyTitle: string, conditions: any): boolean {
  const combined = `${studyTitle || ''} ${JSON.stringify(conditions || {})}`.toLowerCase();
  return ['combat', 'war', 'battlefield', 'combat exposure', 'war-related'].some(keyword => combined.includes(keyword));
}

function isPtsdTbiStudy(studyTitle: string, conditions: any): boolean {
  const combined = `${studyTitle || ''} ${JSON.stringify(conditions || {})}`.toLowerCase();
  return ['ptsd', 'post-traumatic stress', 'tbi', 'traumatic brain injury', 'blast injury'].some(keyword => combined.includes(keyword));
}

function isDeploymentHealthStudy(studyTitle: string, conditions: any): boolean {
  const combined = `${studyTitle || ''} ${JSON.stringify(conditions || {})}`.toLowerCase();
  return ['deployment', 'deployed', 'overseas service', 'deployment health', 'gulf war', 'iraq war', 'afghanistan'].some(keyword => combined.includes(keyword));
}

function isDefenseRelatedResearch(sponsor: string, collaborators: any): boolean {
  const combined = `${sponsor || ''} ${JSON.stringify(collaborators || {})}`.toLowerCase();
  return ['department of defense', 'dod', 'army', 'navy', 'air force', 'defense', 'military research'].some(keyword => combined.includes(keyword));
}

function isPreventiveStudy(primaryPurpose: string, studyTitle: string): boolean {
  const combined = `${primaryPurpose || ''} ${studyTitle || ''}`.toLowerCase();
  return ['prevention', 'preventive', 'screening', 'early detection'].some(keyword => combined.includes(keyword));
}

function isTherapeuticStudy(primaryPurpose: string, interventions: any): boolean {
  const combined = `${primaryPurpose || ''} ${JSON.stringify(interventions || {})}`.toLowerCase();
  return ['treatment', 'therapeutic', 'therapy', 'intervention'].some(keyword => combined.includes(keyword));
}

function isDiagnosticStudy(primaryPurpose: string, studyTitle: string): boolean {
  const combined = `${primaryPurpose || ''} ${studyTitle || ''}`.toLowerCase();
  return ['diagnostic', 'diagnosis', 'biomarker', 'test accuracy'].some(keyword => combined.includes(keyword));
}

function isQualityOfLifeStudy(studyTitle: string, outcomes: any): boolean {
  const combined = `${studyTitle || ''} ${JSON.stringify(outcomes || {})}`.toLowerCase();
  return ['quality of life', 'qol', 'functional', 'disability', 'patient reported outcome'].some(keyword => combined.includes(keyword));
}

function isHealthServicesResearch(studyTitle: string, primaryPurpose: string): boolean {
  const combined = `${studyTitle || ''} ${primaryPurpose || ''}`.toLowerCase();
  return ['health services', 'health care delivery', 'health policy', 'cost effectiveness', 'health economics'].some(keyword => combined.includes(keyword));
}

function isBasicScience(studyTitle: string, studyType: string): boolean {
  const combined = `${studyTitle || ''} ${studyType || ''}`.toLowerCase();
  return ['basic science', 'mechanism', 'pathophysiology', 'molecular', 'genetic'].some(keyword => combined.includes(keyword));
}

function extractReportingPeriod(startDate: string, completionDate: string): string {
  const start = startDate ? new Date(startDate).getFullYear() : null;
  const completion = completionDate ? new Date(completionDate).getFullYear() : null;

  if (start && completion) return `${start}-${completion}`;
  if (start) return `${start}-ongoing`;
  return 'unknown';
}

export async function fetchNIHClinicalTrialsData(): Promise<any[]> {
  // Mock NIH Clinical Trials data - in practice would fetch from ClinicalTrials.gov API
  const mockTrials = [
    { nct_id: 'NCT12345678', study_title: 'Water Quality and Gastrointestinal Health in Military Personnel', study_type: 'Observational', study_status: 'Recruiting', enrollment_target: 500, conditions: ['Gastrointestinal Diseases', 'Water-related illness'], sponsor: 'Walter Reed Army Institute of Research', start_date: '2024-01-01', study_locations: [{ facility: 'Walter Reed Medical Center', city: 'Bethesda', state: 'MD', country: 'United States' }] },
    { nct_id: 'NCT87654321', study_title: 'PTSD Treatment in Veterans Exposed to Environmental Toxins', study_type: 'Interventional', study_phase: 'Phase 2', study_status: 'Active, not recruiting', enrollment_target: 200, conditions: ['PTSD', 'Environmental Exposure'], interventions: [{ type: 'behavioral', name: 'Cognitive Behavioral Therapy' }], sponsor: 'Department of Veterans Affairs', start_date: '2023-06-15', study_locations: [{ facility: 'VA Medical Center', city: 'Richmond', state: 'VA', country: 'United States' }] },
    { nct_id: 'NCT11223344', study_title: 'Air Pollution Exposure and Respiratory Health in Urban Communities', study_type: 'Observational', study_status: 'Completed', enrollment_actual: 1250, conditions: ['Asthma', 'COPD', 'Air Pollution Effects'], sponsor: 'National Institute of Environmental Health Sciences', completion_date: '2023-12-31', study_locations: [{ facility: 'Johns Hopkins', city: 'Baltimore', state: 'MD', country: 'United States' }] },
  ];
  return mockTrials;
}

export async function buildNIHClinicalTrialsCacheData(records: NIHClinicalTrialsRecord[]): Promise<NIHClinicalTrialsCacheData> {
  // Build spatial index
  const spatialIndex: Record<string, NIHClinicalTrialsRecord[]> = {};

  const studyTypeDistribution: Record<StudyType, number> = { interventional: 0, observational: 0, expanded_access: 0, diagnostic_test: 0, prevention: 0, treatment: 0, supportive_care: 0 };
  const studyPhaseDistribution: Record<StudyPhase, number> = { early_phase_1: 0, phase_1: 0, phase_2: 0, phase_3: 0, phase_4: 0, not_applicable: 0 };
  const studyStatusDistribution: Record<StudyStatus, number> = { recruiting: 0, active_not_recruiting: 0, completed: 0, terminated: 0, suspended: 0, withdrawn: 0, unknown: 0 };
  const interventionTypeDistribution: Record<InterventionType, number> = { drug: 0, device: 0, biological: 0, procedure: 0, behavioral: 0, dietary: 0, radiation: 0, other: 0 };
  const sponsorTypeDistribution: Record<string, number> = {};
  const stateDistribution: Record<string, number> = {};

  let activeTrials = 0; let completedTrials = 0; let environmentalHealthTrials = 0; let militaryRelevantTrials = 0; let veteranPopulationTrials = 0;
  let totalEnrollmentTarget = 0; let studiesWithResults = 0;

  const conditionCounts = new Map<string, number>();
  const interventionCounts = new Map<string, number>();

  records.forEach(record => {
    // Spatial indexing by state
    if (record.location.state && record.location.state !== 'Unknown') {
      const stateKey = `state_${record.location.state}`;
      if (!spatialIndex[stateKey]) spatialIndex[stateKey] = [];
      spatialIndex[stateKey].push(record);
    }

    // Summary calculations
    studyTypeDistribution[record.nihClinicalTrialsSpecific.studyType]++;
    if (record.nihClinicalTrialsSpecific.studyPhase) studyPhaseDistribution[record.nihClinicalTrialsSpecific.studyPhase]++;
    studyStatusDistribution[record.nihClinicalTrialsSpecific.studyStatus]++;
    sponsorTypeDistribution[record.nihClinicalTrialsSpecific.sponsorInformation.sponsorType] = (sponsorTypeDistribution[record.nihClinicalTrialsSpecific.sponsorInformation.sponsorType] || 0) + 1;
    stateDistribution[record.location.state || 'Unknown'] = (stateDistribution[record.location.state || 'Unknown'] || 0) + 1;

    // Intervention type distribution
    record.nihClinicalTrialsSpecific.interventions.forEach(intervention => {
      interventionTypeDistribution[intervention.type]++;
    });

    // Status-based counts
    if (['recruiting', 'active_not_recruiting'].includes(record.nihClinicalTrialsSpecific.studyStatus)) activeTrials++;
    if (record.nihClinicalTrialsSpecific.studyStatus === 'completed') completedTrials++;

    if (Object.values(record.nihClinicalTrialsSpecific.environmentalHealthRelevance).some(v => v)) environmentalHealthTrials++;
    if (Object.values(record.nihClinicalTrialsSpecific.militaryRelevance).some(v => v)) militaryRelevantTrials++;
    if (record.nihClinicalTrialsSpecific.militaryRelevance.veteranPopulationStudy) veteranPopulationTrials++;

    if (record.nihClinicalTrialsSpecific.enrollmentTarget) totalEnrollmentTarget += record.nihClinicalTrialsSpecific.enrollmentTarget;
    if (record.nihClinicalTrialsSpecific.dataQuality.hasResults) studiesWithResults++;

    // Count conditions and interventions
    record.nihClinicalTrialsSpecific.conditions.forEach(condition => {
      conditionCounts.set(condition, (conditionCounts.get(condition) || 0) + 1);
    });

    record.nihClinicalTrialsSpecific.interventions.forEach(intervention => {
      interventionCounts.set(intervention.name, (interventionCounts.get(intervention.name) || 0) + 1);
    });
  });

  // Top conditions and interventions
  const topConditions = Array.from(conditionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([condition, count]) => ({ condition, count }));

  const topInterventions = Array.from(interventionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([intervention, count]) => ({ intervention, count }));

  // Build correlations
  const environmentalHealthStudies = buildEnvironmentalHealthStudies(records);
  const militaryHealthResearch = buildMilitaryHealthResearch(records);
  const preventiveResearchOpportunities = buildPreventiveResearchOpportunities(records);
  const multiSiteCollaborations = buildMultiSiteCollaborations(records);

  return {
    records,
    spatialIndex,
    summary: {
      totalTrials: records.length,
      activeTrials,
      completedTrials,
      studyTypeDistribution,
      studyPhaseDistribution,
      studyStatusDistribution,
      interventionTypeDistribution,
      sponsorTypeDistribution,
      environmentalHealthTrials,
      militaryRelevantTrials,
      veteranPopulationTrials,
      totalEnrollmentTarget,
      uniqueConditions: conditionCounts.size,
      uniqueInterventions: interventionCounts.size,
      studiesWithResults,
      stateDistribution,
      topConditions,
      topInterventions,
    },
    correlations: { environmentalHealthStudies, militaryHealthResearch, preventiveResearchOpportunities, multiSiteCollaborations },
    metadata: { lastUpdated: new Date().toISOString(), dataVersion: '2.0' }
  };
}

function buildEnvironmentalHealthStudies(records: NIHClinicalTrialsRecord[]): any[] {
  return records
    .filter(r => Object.values(r.nihClinicalTrialsSpecific.environmentalHealthRelevance).some(v => v))
    .map(record => ({
      nct_id: record.nihClinicalTrialsSpecific.nctId,
      study_title: record.nihClinicalTrialsSpecific.studyTitle,
      study_type: record.nihClinicalTrialsSpecific.studyType,
      study_status: record.nihClinicalTrialsSpecific.studyStatus,
      conditions: record.nihClinicalTrialsSpecific.conditions,
      environmental_relevance: Object.entries(record.nihClinicalTrialsSpecific.environmentalHealthRelevance)
        .filter(([, value]) => value)
        .map(([key]) => key),
      enrollment_target: record.nihClinicalTrialsSpecific.enrollmentTarget,
      sponsor: record.nihClinicalTrialsSpecific.sponsorInformation.leadSponsor,
      locations: record.nihClinicalTrialsSpecific.studyLocations.map(l => `${l.city}, ${l.state}`).join('; '),
    }))
    .slice(0, 20);
}

function buildMilitaryHealthResearch(records: NIHClinicalTrialsRecord[]): any[] {
  return records
    .filter(r => Object.values(r.nihClinicalTrialsSpecific.militaryRelevance).some(v => v))
    .map(record => ({
      nct_id: record.nihClinicalTrialsSpecific.nctId,
      study_title: record.nihClinicalTrialsSpecific.studyTitle,
      study_type: record.nihClinicalTrialsSpecific.studyType,
      study_status: record.nihClinicalTrialsSpecific.studyStatus,
      conditions: record.nihClinicalTrialsSpecific.conditions,
      military_relevance: Object.entries(record.nihClinicalTrialsSpecific.militaryRelevance)
        .filter(([, value]) => value)
        .map(([key]) => key),
      enrollment_target: record.nihClinicalTrialsSpecific.enrollmentTarget,
      sponsor: record.nihClinicalTrialsSpecific.sponsorInformation.leadSponsor,
      veteran_study: record.nihClinicalTrialsSpecific.militaryRelevance.veteranPopulationStudy,
      ptsd_tbi_focus: record.nihClinicalTrialsSpecific.militaryRelevance.ptsdTbiStudy,
    }))
    .slice(0, 15);
}

function buildPreventiveResearchOpportunities(records: NIHClinicalTrialsRecord[]): any[] {
  return records
    .filter(r => r.nihClinicalTrialsSpecific.researchFocus.preventiveStudy)
    .map(record => ({
      nct_id: record.nihClinicalTrialsSpecific.nctId,
      study_title: record.nihClinicalTrialsSpecific.studyTitle,
      conditions: record.nihClinicalTrialsSpecific.conditions,
      interventions: record.nihClinicalTrialsSpecific.interventions.map(i => i.name),
      study_status: record.nihClinicalTrialsSpecific.studyStatus,
      enrollment_target: record.nihClinicalTrialsSpecific.enrollmentTarget,
      environmental_relevance: Object.values(record.nihClinicalTrialsSpecific.environmentalHealthRelevance).some(v => v),
      military_relevance: Object.values(record.nihClinicalTrialsSpecific.militaryRelevance).some(v => v),
    }))
    .slice(0, 12);
}

function buildMultiSiteCollaborations(records: NIHClinicalTrialsRecord[]): any[] {
  return records
    .filter(r => r.nihClinicalTrialsSpecific.studyLocations.length > 1)
    .map(record => ({
      nct_id: record.nihClinicalTrialsSpecific.nctId,
      study_title: record.nihClinicalTrialsSpecific.studyTitle,
      study_type: record.nihClinicalTrialsSpecific.studyType,
      site_count: record.nihClinicalTrialsSpecific.studyLocations.length,
      states_involved: [...new Set(record.nihClinicalTrialsSpecific.studyLocations.map(l => l.state).filter(s => s))],
      enrollment_target: record.nihClinicalTrialsSpecific.enrollmentTarget,
      lead_sponsor: record.nihClinicalTrialsSpecific.sponsorInformation.leadSponsor,
      collaborators: record.nihClinicalTrialsSpecific.sponsorInformation.collaborators,
    }))
    .sort((a, b) => b.site_count - a.site_count)
    .slice(0, 10);
}

export function getEnvironmentalHealthTrials(): NIHClinicalTrialsRecord[] {
  return nihClinicalTrialsCache?.records?.filter(r => Object.values(r.nihClinicalTrialsSpecific.environmentalHealthRelevance).some(v => v)) || [];
}

export function getMilitaryRelevantTrials(): NIHClinicalTrialsRecord[] {
  return nihClinicalTrialsCache?.records?.filter(r => Object.values(r.nihClinicalTrialsSpecific.militaryRelevance).some(v => v)) || [];
}

export function getActiveTrials(): NIHClinicalTrialsRecord[] {
  return nihClinicalTrialsCache?.records?.filter(r =>
    ['recruiting', 'active_not_recruiting'].includes(r.nihClinicalTrialsSpecific.studyStatus)
  ) || [];
}