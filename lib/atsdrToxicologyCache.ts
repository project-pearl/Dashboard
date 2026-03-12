/**
 * ATSDR Toxicology Cache
 * Agency for Toxic Substances and Disease Registry toxicological profiles
 * Part of Tier 1 HHS integration - critical for environmental health intelligence
 */

import { HHSAPIClient, type HHSHealthRecord, addMilitaryProximity, correlateWithWaterViolations } from './hhsDataUtils';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

export type ToxicSubstanceCategory = 'heavy_metals' | 'volatile_organic' | 'pesticides' | 'industrial_chemicals' | 'radioactive' | 'biological' | 'air_pollutants' | 'water_contaminants';

export interface ATSDRToxicologyRecord extends HHSHealthRecord {
  atsdrSpecific: {
    substanceId: string;
    substanceName: string;
    casNumber?: string;
    category: ToxicSubstanceCategory;
    toxicityRating: 'low' | 'moderate' | 'high' | 'severe' | 'critical';
    exposureRoutes: string[];
    healthEffects: {
      acute: string[];
      chronic: string[];
      carcinogenic: boolean;
      developmentalToxicity: boolean;
    };
    environmentalFate: {
      persistence: 'low' | 'medium' | 'high';
      bioaccumulation: boolean;
      mobility: 'immobile' | 'moderate' | 'highly_mobile';
    };
    exposureLimits: {
      twa?: number; // Time-weighted average
      stel?: number; // Short-term exposure limit
      ceiling?: number; // Ceiling limit
      unit: string;
    };
    waterRelevance: {
      isWaterContaminant: boolean;
      drinkingWaterStandard?: number;
      groundwaterConcern: boolean;
    };
    militaryRelevance: {
      isUsedInMilitary: boolean;
      deploymentConcern: boolean;
      baseContaminationRisk: 'low' | 'medium' | 'high';
    };
    profileCompletionDate: string;
    lastUpdated: string;
  };
}

interface ATSDRToxicologyCacheData {
  records: ATSDRToxicologyRecord[];
  summary: {
    totalSubstances: number;
    categoryDistribution: Record<ToxicSubstanceCategory, number>;
    toxicityLevelCounts: Record<string, number>;
    waterContaminants: number;
    carcinogenicSubstances: number;
    militaryRelevantSubstances: number;
    highPersistenceSubstances: number;
    criticalExposureThreats: number;
  };
  correlations: {
    waterContaminationRisks: any[];
    militaryInstallationThreats: any[];
    environmentalPersistenceConcerns: any[];
  };
  metadata: { lastUpdated: string; dataVersion: string; };
}

let atsdrToxicologyCache: ATSDRToxicologyCacheData | null = null;
let lastFetched: string | null = null;
let _buildInProgress = false;
let _buildStartedAt: string | null = null;
let _atsdrToxicologyCacheLoaded = false;
let _lastDelta: CacheDelta | null = null;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
const CACHE_FILE = 'atsdr-toxicology.json';

export function getATSDRToxicologyCacheStatus() {
  return {
    loaded: _atsdrToxicologyCacheLoaded && atsdrToxicologyCache !== null,
    built: lastFetched,
    recordCount: atsdrToxicologyCache?.records?.length || 0,
    criticalThreats: atsdrToxicologyCache?.summary?.criticalExposureThreats || 0,
    buildInProgress: isBuildInProgress(),
    lastDelta: _lastDelta,
  };
}

export function getATSDRToxicologyCache(): ATSDRToxicologyRecord[] { return atsdrToxicologyCache?.records || []; }

export async function setATSDRToxicologyCache(data: ATSDRToxicologyCacheData): Promise<void> {
  if (!data.records?.length) { console.warn('No ATSDR Toxicology data to cache'); return; }
  const prevCounts = atsdrToxicologyCache ? { recordCount: atsdrToxicologyCache.summary.totalSubstances } : null;
  _lastDelta = computeCacheDelta(prevCounts, { recordCount: data.summary.totalSubstances }, lastFetched);
  atsdrToxicologyCache = data; lastFetched = new Date().toISOString(); _atsdrToxicologyCacheLoaded = true;
  await saveToDisk(data); await saveCacheToBlob(CACHE_FILE, data);
}

export function setBuildInProgress(inProgress: boolean): void { _buildInProgress = inProgress; _buildStartedAt = inProgress ? new Date().toISOString() : null; }
export function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;
  if (_buildStartedAt && Date.now() - new Date(_buildStartedAt).getTime() > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('ATSDR Toxicology build lock expired'); _buildInProgress = false; _buildStartedAt = null; return false;
  }
  return _buildInProgress;
}

export async function ensureWarmed(): Promise<void> {
  if (_atsdrToxicologyCacheLoaded) return;
  try {
    const diskData = await loadFromDisk();
    if (diskData?.records?.length) { atsdrToxicologyCache = diskData; _atsdrToxicologyCacheLoaded = true; return; }
  } catch (e) { console.warn('ATSDR Toxicology disk load failed:', e); }
  try {
    const blobData = await loadCacheFromBlob<ATSDRToxicologyCacheData>(CACHE_FILE);
    if (blobData?.records?.length) { atsdrToxicologyCache = blobData; _atsdrToxicologyCacheLoaded = true; await saveToDisk(blobData); }
  } catch (e) { console.warn('ATSDR Toxicology blob load failed:', e); }
}

async function loadFromDisk(): Promise<ATSDRToxicologyCacheData | null> {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs'); const path = require('path');
    const file = path.join(process.cwd(), '.cache', CACHE_FILE);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!data?.records) return null;
    console.log(`[ATSDR Toxicology Cache] Loaded from disk (${data.records.length} records)`);
    return data;
  } catch (e) { return null; }
}

async function saveToDisk(data: ATSDRToxicologyCacheData): Promise<void> {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs'); const path = require('path');
    const cacheDir = path.join(process.cwd(), '.cache'); const file = path.join(cacheDir, CACHE_FILE);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
    console.log(`[ATSDR Toxicology Cache] Saved to disk (${data.records.length} records)`);
  } catch (e) { console.warn('ATSDR Toxicology disk save failed:', e); }
}

export function processATSDRToxicologyData(rawRecords: any[]): ATSDRToxicologyRecord[] {
  return rawRecords.map(raw => ({
    id: `atsdr_tox_${raw.id || raw.substance_id || Date.now()}`,
    source: 'atsdr_toxicology',
    location: { state: 'US' },
    temporal: { reportDate: raw.profile_completion_date || raw.last_updated || new Date().toISOString(), year: new Date(raw.profile_completion_date || new Date()).getFullYear() },
    healthMetrics: [{ category: 'toxicology', measure: 'toxicity_rating', value: getToxicityScore(raw.toxicity_rating), unit: 'score' }],
    atsdrSpecific: {
      substanceId: raw.id || raw.substance_id,
      substanceName: raw.substance_name || raw.name || 'Unknown Substance',
      casNumber: raw.cas_number || raw.cas,
      category: categorizeToxicSubstance(raw.category, raw.substance_name),
      toxicityRating: normalizeToxicityRating(raw.toxicity_rating || raw.hazard_level),
      exposureRoutes: parseExposureRoutes(raw.exposure_routes || raw.routes),
      healthEffects: {
        acute: parseHealthEffects(raw.acute_effects || raw.acute_health_effects),
        chronic: parseHealthEffects(raw.chronic_effects || raw.chronic_health_effects),
        carcinogenic: parseBoolean(raw.carcinogenic || raw.is_carcinogen),
        developmentalToxicity: parseBoolean(raw.developmental_toxicity || raw.teratogenic),
      },
      environmentalFate: {
        persistence: normalizePersistence(raw.environmental_persistence),
        bioaccumulation: parseBoolean(raw.bioaccumulation || raw.bioaccumulative),
        mobility: normalizeMobility(raw.environmental_mobility || raw.mobility),
      },
      exposureLimits: {
        twa: parseFloat(raw.twa) || undefined,
        stel: parseFloat(raw.stel) || undefined,
        ceiling: parseFloat(raw.ceiling) || undefined,
        unit: raw.exposure_unit || raw.unit || 'ppm',
      },
      waterRelevance: {
        isWaterContaminant: isWaterContaminant(raw.substance_name, raw.environmental_fate),
        drinkingWaterStandard: parseFloat(raw.drinking_water_standard) || undefined,
        groundwaterConcern: parseBoolean(raw.groundwater_concern || raw.groundwater_contamination),
      },
      militaryRelevance: {
        isUsedInMilitary: isMilitarySubstance(raw.substance_name, raw.uses),
        deploymentConcern: isDeploymentConcern(raw.substance_name, raw.exposure_routes),
        baseContaminationRisk: assessMilitaryBaseRisk(raw.environmental_persistence, raw.toxicity_rating),
      },
      profileCompletionDate: raw.profile_completion_date || raw.completed_date || new Date().toISOString(),
      lastUpdated: raw.last_updated || raw.updated || new Date().toISOString(),
    }
  }));
}

function categorizeToxicSubstance(category: string, substanceName: string): ToxicSubstanceCategory {
  const catLower = (category || '').toLowerCase();
  const nameLower = (substanceName || '').toLowerCase();

  if (catLower.includes('metal') || ['lead', 'mercury', 'cadmium', 'arsenic', 'chromium'].some(m => nameLower.includes(m))) return 'heavy_metals';
  if (catLower.includes('volatile') || catLower.includes('voc') || ['benzene', 'toluene', 'xylene'].some(v => nameLower.includes(v))) return 'volatile_organic';
  if (catLower.includes('pesticide') || catLower.includes('herbicide') || ['ddt', 'atrazine', 'glyphosate'].some(p => nameLower.includes(p))) return 'pesticides';
  if (catLower.includes('radioactive') || catLower.includes('uranium') || nameLower.includes('radon')) return 'radioactive';
  if (catLower.includes('biological') || catLower.includes('toxin')) return 'biological';
  if (catLower.includes('air') || nameLower.includes('particulate')) return 'air_pollutants';
  if (catLower.includes('water') || nameLower.includes('pfas')) return 'water_contaminants';
  return 'industrial_chemicals';
}

function normalizeToxicityRating(rating: string): 'low' | 'moderate' | 'high' | 'severe' | 'critical' {
  const r = (rating || '').toLowerCase();
  if (r.includes('critical') || r.includes('lethal')) return 'critical';
  if (r.includes('severe') || r.includes('high') || r.includes('4') || r.includes('5')) return 'severe';
  if (r.includes('moderate') || r.includes('medium') || r.includes('3')) return 'high';
  if (r.includes('low') || r.includes('mild') || r.includes('1') || r.includes('2')) return 'moderate';
  return 'low';
}

function parseExposureRoutes(routes: any): string[] {
  if (Array.isArray(routes)) return routes.map(r => String(r));
  if (typeof routes === 'string') return routes.split(',').map(r => r.trim());
  return ['inhalation', 'ingestion', 'dermal']; // Default routes
}

function parseHealthEffects(effects: any): string[] {
  if (Array.isArray(effects)) return effects.map(e => String(e));
  if (typeof effects === 'string') return effects.split(',').map(e => e.trim());
  return [];
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', 'yes', '1', 'positive'].includes(value.toLowerCase());
  return false;
}

function normalizePersistence(persistence: string): 'low' | 'medium' | 'high' {
  const p = (persistence || '').toLowerCase();
  if (p.includes('high') || p.includes('persistent') || p.includes('long')) return 'high';
  if (p.includes('medium') || p.includes('moderate')) return 'medium';
  return 'low';
}

function normalizeMobility(mobility: string): 'immobile' | 'moderate' | 'highly_mobile' {
  const m = (mobility || '').toLowerCase();
  if (m.includes('high') || m.includes('mobile')) return 'highly_mobile';
  if (m.includes('moderate') || m.includes('medium')) return 'moderate';
  return 'immobile';
}

function isWaterContaminant(substanceName: string, environmentalFate: any): boolean {
  const nameLower = (substanceName || '').toLowerCase();
  const waterKeywords = ['water', 'aquatic', 'groundwater', 'drinking', 'pfas', 'tce', 'pce'];
  if (waterKeywords.some(k => nameLower.includes(k))) return true;
  return environmentalFate?.mobility === 'high' || environmentalFate?.persistence === 'high';
}

function isMilitarySubstance(substanceName: string, uses: any): boolean {
  const combined = `${substanceName} ${uses || ''}`.toLowerCase();
  const militaryKeywords = ['military', 'weapon', 'explosive', 'fuel', 'jet', 'ordnance', 'propellant', 'solvent'];
  return militaryKeywords.some(k => combined.includes(k));
}

function isDeploymentConcern(substanceName: string, exposureRoutes: string[]): boolean {
  const nameLower = (substanceName || '').toLowerCase();
  const concernSubstances = ['agent orange', 'burn pit', 'depleted uranium', 'chemical warfare'];
  if (concernSubstances.some(c => nameLower.includes(c))) return true;
  return exposureRoutes?.includes('inhalation') && nameLower.includes('particulate');
}

function assessMilitaryBaseRisk(persistence: string, toxicityRating: string): 'low' | 'medium' | 'high' {
  const persistenceLevel = normalizePersistence(persistence);
  const toxicityLevel = normalizeToxicityRating(toxicityRating);

  if ((persistenceLevel === 'high' && ['severe', 'critical'].includes(toxicityLevel)) || toxicityLevel === 'critical') return 'high';
  if (persistenceLevel === 'high' || ['high', 'severe'].includes(toxicityLevel)) return 'medium';
  return 'low';
}

function getToxicityScore(rating: string): number {
  const toxicityScores = { critical: 100, severe: 85, high: 70, moderate: 50, low: 25 };
  return toxicityScores[normalizeToxicityRating(rating)] || 25;
}

export async function fetchATSDRToxicologyData(): Promise<any[]> {
  // Mock ATSDR toxicology data - in practice would fetch from ATSDR ToxProfiles API
  const mockSubstances = [
    { id: '1', substance_name: 'Lead', cas_number: '7439-92-1', toxicity_rating: 'severe', exposure_routes: 'ingestion,inhalation,dermal', acute_effects: 'neurological damage', chronic_effects: 'developmental delays', carcinogenic: false, environmental_persistence: 'high', bioaccumulation: true, groundwater_concern: true, drinking_water_standard: 0.015, profile_completion_date: '2020-08-01' },
    { id: '2', substance_name: 'PFOA', cas_number: '335-67-1', toxicity_rating: 'high', exposure_routes: 'ingestion,inhalation', acute_effects: 'liver toxicity', chronic_effects: 'cancer,kidney disease', carcinogenic: true, environmental_persistence: 'high', bioaccumulation: true, groundwater_concern: true, drinking_water_standard: 0.000070, profile_completion_date: '2021-05-15' },
    { id: '3', substance_name: 'Jet Fuel JP-8', toxicity_rating: 'moderate', exposure_routes: 'inhalation,dermal', acute_effects: 'respiratory irritation', chronic_effects: 'neurological effects', carcinogenic: false, environmental_persistence: 'medium', bioaccumulation: false, uses: 'military aircraft fuel', profile_completion_date: '2019-03-22' },
  ];
  return mockSubstances;
}

export async function buildATSDRToxicologyCacheData(records: ATSDRToxicologyRecord[]): Promise<ATSDRToxicologyCacheData> {
  const categoryDistribution: Record<ToxicSubstanceCategory, number> = { heavy_metals: 0, volatile_organic: 0, pesticides: 0, industrial_chemicals: 0, radioactive: 0, biological: 0, air_pollutants: 0, water_contaminants: 0 };
  const toxicityLevelCounts: Record<string, number> = {};
  let waterContaminants = 0; let carcinogenicSubstances = 0; let militaryRelevantSubstances = 0; let highPersistenceSubstances = 0; let criticalExposureThreats = 0;

  records.forEach(record => {
    categoryDistribution[record.atsdrSpecific.category]++;
    toxicityLevelCounts[record.atsdrSpecific.toxicityRating] = (toxicityLevelCounts[record.atsdrSpecific.toxicityRating] || 0) + 1;
    if (record.atsdrSpecific.waterRelevance.isWaterContaminant) waterContaminants++;
    if (record.atsdrSpecific.healthEffects.carcinogenic) carcinogenicSubstances++;
    if (record.atsdrSpecific.militaryRelevance.isUsedInMilitary) militaryRelevantSubstances++;
    if (record.atsdrSpecific.environmentalFate.persistence === 'high') highPersistenceSubstances++;
    if (['severe', 'critical'].includes(record.atsdrSpecific.toxicityRating)) criticalExposureThreats++;
  });

  // Build correlations
  const waterContaminationRisks = buildWaterContaminationCorrelations(records);
  const militaryInstallationThreats = buildMilitaryInstallationCorrelations(records);
  const environmentalPersistenceConcerns = buildEnvironmentalPersistenceCorrelations(records);

  return {
    records,
    summary: { totalSubstances: records.length, categoryDistribution, toxicityLevelCounts, waterContaminants, carcinogenicSubstances, militaryRelevantSubstances, highPersistenceSubstances, criticalExposureThreats },
    correlations: { waterContaminationRisks, militaryInstallationThreats, environmentalPersistenceConcerns },
    metadata: { lastUpdated: new Date().toISOString(), dataVersion: '2.0' }
  };
}

function buildWaterContaminationCorrelations(records: ATSDRToxicologyRecord[]): any[] {
  return records
    .filter(r => r.atsdrSpecific.waterRelevance.isWaterContaminant && r.atsdrSpecific.toxicityRating !== 'low')
    .map(record => ({
      substance_name: record.atsdrSpecific.substanceName,
      cas_number: record.atsdrSpecific.casNumber,
      toxicity_level: record.atsdrSpecific.toxicityRating,
      drinking_water_standard: record.atsdrSpecific.waterRelevance.drinkingWaterStandard,
      persistence: record.atsdrSpecific.environmentalFate.persistence,
      health_effects: [...record.atsdrSpecific.healthEffects.acute, ...record.atsdrSpecific.healthEffects.chronic],
      carcinogenic: record.atsdrSpecific.healthEffects.carcinogenic,
    }))
    .sort((a, b) => {
      const severityOrder = { critical: 5, severe: 4, high: 3, moderate: 2, low: 1 };
      return (severityOrder[b.toxicity_level as keyof typeof severityOrder] || 0) - (severityOrder[a.toxicity_level as keyof typeof severityOrder] || 0);
    });
}

function buildMilitaryInstallationCorrelations(records: ATSDRToxicologyRecord[]): any[] {
  return records
    .filter(r => r.atsdrSpecific.militaryRelevance.isUsedInMilitary || r.atsdrSpecific.militaryRelevance.baseContaminationRisk !== 'low')
    .map(record => ({
      substance_name: record.atsdrSpecific.substanceName,
      military_usage: record.atsdrSpecific.militaryRelevance.isUsedInMilitary,
      deployment_concern: record.atsdrSpecific.militaryRelevance.deploymentConcern,
      base_contamination_risk: record.atsdrSpecific.militaryRelevance.baseContaminationRisk,
      toxicity_level: record.atsdrSpecific.toxicityRating,
      persistence: record.atsdrSpecific.environmentalFate.persistence,
      exposure_routes: record.atsdrSpecific.exposureRoutes,
    }))
    .sort((a, b) => {
      const riskOrder = { high: 3, medium: 2, low: 1 };
      return (riskOrder[b.base_contamination_risk as keyof typeof riskOrder] || 0) - (riskOrder[a.base_contamination_risk as keyof typeof riskOrder] || 0);
    });
}

function buildEnvironmentalPersistenceCorrelations(records: ATSDRToxicologyRecord[]): any[] {
  return records
    .filter(r => r.atsdrSpecific.environmentalFate.persistence === 'high' && ['high', 'severe', 'critical'].includes(r.atsdrSpecific.toxicityRating))
    .map(record => ({
      substance_name: record.atsdrSpecific.substanceName,
      category: record.atsdrSpecific.category,
      persistence: record.atsdrSpecific.environmentalFate.persistence,
      bioaccumulation: record.atsdrSpecific.environmentalFate.bioaccumulation,
      mobility: record.atsdrSpecific.environmentalFate.mobility,
      toxicity_level: record.atsdrSpecific.toxicityRating,
      water_concern: record.atsdrSpecific.waterRelevance.isWaterContaminant,
      military_concern: record.atsdrSpecific.militaryRelevance.isUsedInMilitary,
    }))
    .sort((a, b) => a.substance_name.localeCompare(b.substance_name));
}

export function getWaterContaminantsOfConcern(): ATSDRToxicologyRecord[] {
  return atsdrToxicologyCache?.records?.filter(r =>
    r.atsdrSpecific.waterRelevance.isWaterContaminant &&
    ['high', 'severe', 'critical'].includes(r.atsdrSpecific.toxicityRating)
  ) || [];
}

export function getMilitaryRelevantSubstances(): ATSDRToxicologyRecord[] {
  return atsdrToxicologyCache?.records?.filter(r => r.atsdrSpecific.militaryRelevance.isUsedInMilitary) || [];
}

export function getCarcinogenicSubstances(): ATSDRToxicologyRecord[] {
  return atsdrToxicologyCache?.records?.filter(r => r.atsdrSpecific.healthEffects.carcinogenic) || [];
}