/**
 * NCHS (National Center for Health Statistics) Cache
 * Vital statistics, mortality, birth data, and health outcomes surveillance
 * Part of Tier 2 HHS integration - critical for population health correlations
 */

import { HHSAPIClient, type HHSHealthRecord, addMilitaryProximity, correlateWithWaterViolations } from './hhsDataUtils';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta, gridKey } from './cacheUtils';

export type NCHSDataCategory = 'vital_statistics' | 'mortality' | 'natality' | 'health_surveys' | 'disease_surveillance' | 'injury_data';
export type NCHSDataSource = 'nvss' | 'nhanes' | 'nhis' | 'brfss' | 'wonder' | 'nhamcs' | 'namcs';
export type MortalityCause = 'heart_disease' | 'cancer' | 'accidents' | 'stroke' | 'respiratory' | 'diabetes' | 'alzheimers' | 'kidney_disease' | 'suicide' | 'liver_disease';

export interface NCHSRecord extends HHSHealthRecord {
  nchsSpecific: {
    dataCategory: NCHSDataCategory;
    dataSource: NCHSDataSource;
    indicatorCode: string;
    indicatorName: string;
    measureType: 'rate' | 'count' | 'percentage' | 'ratio';
    ageGroup?: string;
    gender?: 'male' | 'female' | 'all';
    raceEthnicity?: string;
    educationLevel?: string;
    incomeLevel?: string;
    urbanRuralStatus?: 'urban' | 'suburban' | 'rural' | 'frontier';
    causeOfDeath?: MortalityCause;
    icd10Code?: string;
    ageAdjustedRate?: number;
    crudeRate?: number;
    standardError?: number;
    confidenceInterval?: {
      lower: number;
      upper: number;
    };
    dataReliability: 'reliable' | 'potentially_unreliable' | 'unreliable' | 'suppressed';
    populationDenominator?: number;
    environmentalFactors: {
      waterQualityRelated: boolean;
      airQualityRelated: boolean;
      toxicExposureRelated: boolean;
      climateRelated: boolean;
    };
    militaryRelevance: {
      affectsMilitaryPersonnel: boolean;
      deploymentRelated: boolean;
      combatRelated: boolean;
      veteranPopulationImpact: boolean;
    };
    healthDisparityFlag: boolean;
    temporalTrend: 'increasing' | 'decreasing' | 'stable' | 'fluctuating' | 'unknown';
    dataYear: number;
    reportingPeriod: string;
  };
}

interface NCHSCacheData {
  records: NCHSRecord[];
  spatialIndex: Record<string, NCHSRecord[]>;
  summary: {
    totalRecords: number;
    categoryDistribution: Record<NCHSDataCategory, number>;
    dataSourceDistribution: Record<NCHSDataSource, number>;
    mortalityCauseDistribution: Record<MortalityCause, number>;
    ageGroupDistribution: Record<string, number>;
    genderDistribution: Record<string, number>;
    raceEthnicityDistribution: Record<string, number>;
    environmentallyRelatedRecords: number;
    militaryRelevantRecords: number;
    healthDisparityRecords: number;
    stateDistribution: Record<string, number>;
    yearRange: { earliest: number; latest: number; };
    dataReliabilityBreakdown: Record<string, number>;
  };
  correlations: {
    environmentalHealthCorrelations: any[];
    militaryHealthOutcomes: any[];
    healthDisparityAlerts: any[];
    mortalityTrendAnalysis: any[];
  };
  metadata: { lastUpdated: string; dataVersion: string; };
}

let nchsCache: NCHSCacheData | null = null;
let lastFetched: string | null = null;
let _buildInProgress = false;
let _buildStartedAt: string | null = null;
let _nchsCacheLoaded = false;
let _lastDelta: CacheDelta | null = null;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
const CACHE_FILE = 'nchs.json';

export function getNCHSCacheStatus() {
  return {
    loaded: _nchsCacheLoaded && nchsCache !== null,
    built: lastFetched,
    recordCount: nchsCache?.records?.length || 0,
    militaryRelevantRecords: nchsCache?.summary?.militaryRelevantRecords || 0,
    buildInProgress: isBuildInProgress(),
    lastDelta: _lastDelta,
  };
}

export function getNCHSCache(): NCHSRecord[] { return nchsCache?.records || []; }

export async function setNCHSCache(data: NCHSCacheData): Promise<void> {
  if (!data.records?.length) { console.warn('No NCHS data to cache'); return; }
  const prevCounts = nchsCache ? { recordCount: nchsCache.summary.totalRecords } : null;
  _lastDelta = computeCacheDelta(prevCounts, { recordCount: data.summary.totalRecords }, lastFetched);
  nchsCache = data; lastFetched = new Date().toISOString(); _nchsCacheLoaded = true;
  await saveToDisk(data); await saveCacheToBlob(CACHE_FILE, data);
}

export function setBuildInProgress(inProgress: boolean): void { _buildInProgress = inProgress; _buildStartedAt = inProgress ? new Date().toISOString() : null; }
export function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;
  if (_buildStartedAt && Date.now() - new Date(_buildStartedAt).getTime() > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('NCHS build lock expired'); _buildInProgress = false; _buildStartedAt = null; return false;
  }
  return _buildInProgress;
}

export async function ensureWarmed(): Promise<void> {
  if (_nchsCacheLoaded) return;
  try {
    const diskData = await loadFromDisk();
    if (diskData?.records?.length) { nchsCache = diskData; _nchsCacheLoaded = true; return; }
  } catch (e) { console.warn('NCHS disk load failed:', e); }
  try {
    const blobData = await loadCacheFromBlob<NCHSCacheData>(CACHE_FILE);
    if (blobData?.records?.length) { nchsCache = blobData; _nchsCacheLoaded = true; await saveToDisk(blobData); }
  } catch (e) { console.warn('NCHS blob load failed:', e); }
}

async function loadFromDisk(): Promise<NCHSCacheData | null> {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs'); const path = require('path');
    const file = path.join(process.cwd(), '.cache', CACHE_FILE);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!data?.records) return null;
    console.log(`[NCHS Cache] Loaded from disk (${data.records.length} records)`);
    return data;
  } catch (e) { return null; }
}

async function saveToDisk(data: NCHSCacheData): Promise<void> {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs'); const path = require('path');
    const cacheDir = path.join(process.cwd(), '.cache'); const file = path.join(cacheDir, CACHE_FILE);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
    console.log(`[NCHS Cache] Saved to disk (${data.records.length} records)`);
  } catch (e) { console.warn('NCHS disk save failed:', e); }
}

export function processNCHSData(rawRecords: any[]): NCHSRecord[] {
  return rawRecords.map(raw => ({
    id: `nchs_${raw.indicator_code || raw.id || Date.now()}`,
    source: 'nchs',
    location: {
      state: raw.state || raw.state_abbr || 'US',
      county: raw.county || raw.county_name,
      city: raw.city,
    },
    temporal: {
      reportDate: raw.data_year ? `${raw.data_year}-12-31` : new Date().toISOString(),
      year: parseInt(raw.data_year || raw.year || new Date().getFullYear().toString()),
    },
    healthMetrics: [{
      category: 'vital_statistics',
      measure: raw.indicator_name || raw.measure || 'unknown_measure',
      value: parseFloat(raw.data_value || raw.rate || raw.count || 0),
      unit: determineMeasureUnit(raw.measure_type, raw.unit),
    }],
    nchsSpecific: {
      dataCategory: determineNCHSCategory(raw.category, raw.topic, raw.indicator_name),
      dataSource: determineNCHSDataSource(raw.data_source, raw.dataset),
      indicatorCode: raw.indicator_code || raw.code || 'unknown',
      indicatorName: raw.indicator_name || raw.measure || 'Unknown Indicator',
      measureType: normalizeMeasureType(raw.measure_type),
      ageGroup: raw.age_group || raw.age_category,
      gender: normalizeGender(raw.sex || raw.gender),
      raceEthnicity: raw.race_ethnicity || raw.race || raw.ethnicity,
      educationLevel: raw.education || raw.education_level,
      incomeLevel: raw.income || raw.income_level,
      urbanRuralStatus: normalizeUrbanRural(raw.urban_rural || raw.location_type),
      causeOfDeath: determineCauseOfDeath(raw.cause_of_death, raw.icd10_code, raw.indicator_name),
      icd10Code: raw.icd10_code || raw.icd_code,
      ageAdjustedRate: parseFloat(raw.age_adjusted_rate) || undefined,
      crudeRate: parseFloat(raw.crude_rate || raw.rate) || undefined,
      standardError: parseFloat(raw.standard_error) || undefined,
      confidenceInterval: raw.confidence_interval_low && raw.confidence_interval_high ? {
        lower: parseFloat(raw.confidence_interval_low),
        upper: parseFloat(raw.confidence_interval_high),
      } : undefined,
      dataReliability: assessDataReliability(raw.data_value, raw.standard_error, raw.flag),
      populationDenominator: parseInt(raw.population || raw.denominator) || undefined,
      environmentalFactors: {
        waterQualityRelated: isWaterQualityRelated(raw.indicator_name, raw.cause_of_death),
        airQualityRelated: isAirQualityRelated(raw.indicator_name, raw.cause_of_death),
        toxicExposureRelated: isToxicExposureRelated(raw.indicator_name, raw.cause_of_death),
        climateRelated: isClimateRelated(raw.indicator_name, raw.cause_of_death),
      },
      militaryRelevance: {
        affectsMilitaryPersonnel: assessMilitaryRelevance(raw.indicator_name, raw.age_group),
        deploymentRelated: isDeploymentRelated(raw.indicator_name, raw.cause_of_death),
        combatRelated: isCombatRelated(raw.indicator_name, raw.cause_of_death),
        veteranPopulationImpact: isVeteranRelevant(raw.indicator_name, raw.cause_of_death),
      },
      healthDisparityFlag: isHealthDisparity(raw.race_ethnicity, raw.data_value),
      temporalTrend: assessTemporalTrend(raw.trend, raw.change_from_previous),
      dataYear: parseInt(raw.data_year || raw.year || new Date().getFullYear().toString()),
      reportingPeriod: raw.reporting_period || raw.data_year || 'unknown',
    }
  }));
}

function determineNCHSCategory(category: string, topic: string, indicatorName: string): NCHSDataCategory {
  const combined = `${category || ''} ${topic || ''} ${indicatorName || ''}`.toLowerCase();

  if (combined.includes('vital') || combined.includes('birth') || combined.includes('death')) return 'vital_statistics';
  if (combined.includes('mortality') || combined.includes('death rate')) return 'mortality';
  if (combined.includes('natality') || combined.includes('birth rate') || combined.includes('fertility')) return 'natality';
  if (combined.includes('survey') || combined.includes('nhanes') || combined.includes('nhis')) return 'health_surveys';
  if (combined.includes('disease') || combined.includes('chronic') || combined.includes('cancer')) return 'disease_surveillance';
  if (combined.includes('injury') || combined.includes('accident') || combined.includes('violence')) return 'injury_data';

  return 'vital_statistics';
}

function determineNCHSDataSource(dataSource: string, dataset: string): NCHSDataSource {
  const source = (dataSource || dataset || '').toLowerCase();

  if (source.includes('nvss') || source.includes('vital statistics')) return 'nvss';
  if (source.includes('nhanes')) return 'nhanes';
  if (source.includes('nhis')) return 'nhis';
  if (source.includes('brfss')) return 'brfss';
  if (source.includes('wonder')) return 'wonder';
  if (source.includes('nhamcs')) return 'nhamcs';
  if (source.includes('namcs')) return 'namcs';

  return 'nvss';
}

function normalizeMeasureType(measureType: string): 'rate' | 'count' | 'percentage' | 'ratio' {
  const type = (measureType || '').toLowerCase();

  if (type.includes('rate') || type.includes('/100')) return 'rate';
  if (type.includes('count') || type.includes('number')) return 'count';
  if (type.includes('percent') || type.includes('%')) return 'percentage';
  if (type.includes('ratio')) return 'ratio';

  return 'rate';
}

function normalizeGender(gender: string): 'male' | 'female' | 'all' | undefined {
  const g = (gender || '').toLowerCase();

  if (g.includes('male') && !g.includes('female')) return 'male';
  if (g.includes('female')) return 'female';
  if (g.includes('all') || g.includes('total') || g.includes('both')) return 'all';

  return undefined;
}

function normalizeUrbanRural(urbanRural: string): 'urban' | 'suburban' | 'rural' | 'frontier' | undefined {
  const ur = (urbanRural || '').toLowerCase();

  if (ur.includes('urban') || ur.includes('metropolitan')) return 'urban';
  if (ur.includes('suburban')) return 'suburban';
  if (ur.includes('rural')) return 'rural';
  if (ur.includes('frontier')) return 'frontier';

  return undefined;
}

function determineCauseOfDeath(causeOfDeath: string, icd10Code: string, indicatorName: string): MortalityCause | undefined {
  const combined = `${causeOfDeath || ''} ${icd10Code || ''} ${indicatorName || ''}`.toLowerCase();

  if (combined.includes('heart') || combined.includes('cardiac') || combined.includes('i20-i25')) return 'heart_disease';
  if (combined.includes('cancer') || combined.includes('malignant') || combined.includes('c00-c97')) return 'cancer';
  if (combined.includes('accident') || combined.includes('injury') || combined.includes('v01-y36')) return 'accidents';
  if (combined.includes('stroke') || combined.includes('cerebrovascular') || combined.includes('i60-i69')) return 'stroke';
  if (combined.includes('respiratory') || combined.includes('copd') || combined.includes('j40-j47')) return 'respiratory';
  if (combined.includes('diabetes') || combined.includes('e10-e14')) return 'diabetes';
  if (combined.includes('alzheimer') || combined.includes('g30')) return 'alzheimers';
  if (combined.includes('kidney') || combined.includes('renal') || combined.includes('n00-n07')) return 'kidney_disease';
  if (combined.includes('suicide') || combined.includes('x60-x84')) return 'suicide';
  if (combined.includes('liver') || combined.includes('k70-k76')) return 'liver_disease';

  return undefined;
}

function determineMeasureUnit(measureType: string, unit: string): string {
  if (unit) return unit;
  const type = (measureType || '').toLowerCase();

  if (type.includes('rate')) return 'per 100,000';
  if (type.includes('percent')) return 'percent';
  if (type.includes('count')) return 'count';
  if (type.includes('ratio')) return 'ratio';

  return 'count';
}

function assessDataReliability(dataValue: string, standardError: string, flag: string): 'reliable' | 'potentially_unreliable' | 'unreliable' | 'suppressed' {
  if (!dataValue || dataValue === '' || (flag && flag.toLowerCase().includes('suppress'))) return 'suppressed';

  const se = parseFloat(standardError || '0');
  const value = parseFloat(dataValue || '0');

  if (se > 0 && value > 0) {
    const cv = (se / value) * 100; // Coefficient of variation
    if (cv > 30) return 'unreliable';
    if (cv > 20) return 'potentially_unreliable';
  }

  return 'reliable';
}

function isWaterQualityRelated(indicatorName: string, causeOfDeath: string): boolean {
  const combined = `${indicatorName || ''} ${causeOfDeath || ''}`.toLowerCase();
  return ['water', 'waterborne', 'gastrointestinal', 'diarrhea', 'e.coli', 'cryptosporidium', 'giardia'].some(keyword => combined.includes(keyword));
}

function isAirQualityRelated(indicatorName: string, causeOfDeath: string): boolean {
  const combined = `${indicatorName || ''} ${causeOfDeath || ''}`.toLowerCase();
  return ['respiratory', 'asthma', 'copd', 'lung', 'pneumonia', 'air pollution'].some(keyword => combined.includes(keyword));
}

function isToxicExposureRelated(indicatorName: string, causeOfDeath: string): boolean {
  const combined = `${indicatorName || ''} ${causeOfDeath || ''}`.toLowerCase();
  return ['toxic', 'chemical', 'lead', 'mercury', 'pesticide', 'occupational', 'poisoning'].some(keyword => combined.includes(keyword));
}

function isClimateRelated(indicatorName: string, causeOfDeath: string): boolean {
  const combined = `${indicatorName || ''} ${causeOfDeath || ''}`.toLowerCase();
  return ['heat', 'temperature', 'climate', 'weather', 'extreme', 'drought', 'flood'].some(keyword => combined.includes(keyword));
}

function assessMilitaryRelevance(indicatorName: string, ageGroup: string): boolean {
  const combined = `${indicatorName || ''} ${ageGroup || ''}`.toLowerCase();

  // Age groups relevant to military personnel
  const militaryAges = ['18-24', '25-34', '35-44', '18-44', '20-39'];
  const hasRelevantAge = militaryAges.some(age => (ageGroup || '').includes(age));

  // Health conditions relevant to military
  const militaryConditions = ['ptsd', 'tbi', 'suicide', 'substance', 'mental health', 'injury'];
  const hasRelevantCondition = militaryConditions.some(condition => combined.includes(condition));

  return hasRelevantAge || hasRelevantCondition;
}

function isDeploymentRelated(indicatorName: string, causeOfDeath: string): boolean {
  const combined = `${indicatorName || ''} ${causeOfDeath || ''}`.toLowerCase();
  return ['deployment', 'combat', 'ptsd', 'tbi', 'burn pit', 'gulf war'].some(keyword => combined.includes(keyword));
}

function isCombatRelated(indicatorName: string, causeOfDeath: string): boolean {
  const combined = `${indicatorName || ''} ${causeOfDeath || ''}`.toLowerCase();
  return ['combat', 'war', 'battlefield', 'tbi', 'blast', 'ied', 'shrapnel'].some(keyword => combined.includes(keyword));
}

function isVeteranRelevant(indicatorName: string, causeOfDeath: string): boolean {
  const combined = `${indicatorName || ''} ${causeOfDeath || ''}`.toLowerCase();
  return ['veteran', 'ptsd', 'suicide', 'substance abuse', 'homeless', 'disability'].some(keyword => combined.includes(keyword));
}

function isHealthDisparity(raceEthnicity: string, dataValue: string): boolean {
  return !!(raceEthnicity && raceEthnicity !== 'All Races' && raceEthnicity !== 'Total' && dataValue);
}

function assessTemporalTrend(trend: string, changeFromPrevious: string): 'increasing' | 'decreasing' | 'stable' | 'fluctuating' | 'unknown' {
  const trendText = (trend || changeFromPrevious || '').toLowerCase();

  if (trendText.includes('increas') || trendText.includes('rising') || trendText.includes('up')) return 'increasing';
  if (trendText.includes('decreas') || trendText.includes('declining') || trendText.includes('down')) return 'decreasing';
  if (trendText.includes('stable') || trendText.includes('no change') || trendText.includes('flat')) return 'stable';
  if (trendText.includes('fluctuat') || trendText.includes('variable') || trendText.includes('mixed')) return 'fluctuating';

  return 'unknown';
}

export async function fetchNCHSData(): Promise<any[]> {
  // Mock NCHS data - in practice would fetch from NCHS APIs and CDC WONDER
  const mockData = [
    { indicator_code: 'MORT_HRT_M_18_44', indicator_name: 'Heart Disease Mortality Rate, Males 18-44', data_value: '25.3', measure_type: 'rate', age_group: '18-44 years', sex: 'Male', state: 'US', data_year: '2023', cause_of_death: 'Heart Disease', icd10_code: 'I20-I25', age_adjusted_rate: '24.8' },
    { indicator_code: 'MORT_SUI_ALL_25_34', indicator_name: 'Suicide Mortality Rate, All, 25-34', data_value: '18.7', measure_type: 'rate', age_group: '25-34 years', sex: 'All', state: 'TX', data_year: '2023', cause_of_death: 'Suicide', icd10_code: 'X60-X84', age_adjusted_rate: '18.2' },
    { indicator_code: 'RESP_ASTH_F_ALL', indicator_name: 'Respiratory Disease, Asthma, Females', data_value: '8.9', measure_type: 'percentage', sex: 'Female', state: 'CA', data_year: '2023', cause_of_death: 'Respiratory Disease', environmental_factor: 'air_quality' },
  ];
  return mockData;
}

export async function buildNCHSCacheData(records: NCHSRecord[]): Promise<NCHSCacheData> {
  // Build spatial index
  const spatialIndex: Record<string, NCHSRecord[]> = {};

  const categoryDistribution: Record<NCHSDataCategory, number> = { vital_statistics: 0, mortality: 0, natality: 0, health_surveys: 0, disease_surveillance: 0, injury_data: 0 };
  const dataSourceDistribution: Record<NCHSDataSource, number> = { nvss: 0, nhanes: 0, nhis: 0, brfss: 0, wonder: 0, nhamcs: 0, namcs: 0 };
  const mortalityCauseDistribution: Record<MortalityCause, number> = { heart_disease: 0, cancer: 0, accidents: 0, stroke: 0, respiratory: 0, diabetes: 0, alzheimers: 0, kidney_disease: 0, suicide: 0, liver_disease: 0 };
  const ageGroupDistribution: Record<string, number> = {};
  const genderDistribution: Record<string, number> = {};
  const raceEthnicityDistribution: Record<string, number> = {};
  const stateDistribution: Record<string, number> = {};
  const dataReliabilityBreakdown: Record<string, number> = {};

  let environmentallyRelatedRecords = 0; let militaryRelevantRecords = 0; let healthDisparityRecords = 0;
  let earliestYear = new Date().getFullYear(); let latestYear = 1900;

  records.forEach(record => {
    // Spatial indexing (for state-level data)
    if (record.location.state && record.location.state !== 'US') {
      const stateKey = `state_${record.location.state}`;
      if (!spatialIndex[stateKey]) spatialIndex[stateKey] = [];
      spatialIndex[stateKey].push(record);
    }

    // Summary calculations
    categoryDistribution[record.nchsSpecific.dataCategory]++;
    dataSourceDistribution[record.nchsSpecific.dataSource]++;

    if (record.nchsSpecific.causeOfDeath) {
      mortalityCauseDistribution[record.nchsSpecific.causeOfDeath]++;
    }

    if (record.nchsSpecific.ageGroup) {
      ageGroupDistribution[record.nchsSpecific.ageGroup] = (ageGroupDistribution[record.nchsSpecific.ageGroup] || 0) + 1;
    }

    if (record.nchsSpecific.gender) {
      genderDistribution[record.nchsSpecific.gender] = (genderDistribution[record.nchsSpecific.gender] || 0) + 1;
    }

    if (record.nchsSpecific.raceEthnicity) {
      raceEthnicityDistribution[record.nchsSpecific.raceEthnicity] = (raceEthnicityDistribution[record.nchsSpecific.raceEthnicity] || 0) + 1;
    }

    stateDistribution[record.location.state || 'US'] = (stateDistribution[record.location.state || 'US'] || 0) + 1;
    dataReliabilityBreakdown[record.nchsSpecific.dataReliability] = (dataReliabilityBreakdown[record.nchsSpecific.dataReliability] || 0) + 1;

    if (Object.values(record.nchsSpecific.environmentalFactors).some(v => v)) environmentallyRelatedRecords++;
    if (Object.values(record.nchsSpecific.militaryRelevance).some(v => v)) militaryRelevantRecords++;
    if (record.nchsSpecific.healthDisparityFlag) healthDisparityRecords++;

    if (record.nchsSpecific.dataYear < earliestYear) earliestYear = record.nchsSpecific.dataYear;
    if (record.nchsSpecific.dataYear > latestYear) latestYear = record.nchsSpecific.dataYear;
  });

  // Build correlations
  const environmentalHealthCorrelations = buildEnvironmentalHealthCorrelations(records);
  const militaryHealthOutcomes = buildMilitaryHealthOutcomes(records);
  const healthDisparityAlerts = buildHealthDisparityAlerts(records);
  const mortalityTrendAnalysis = buildMortalityTrendAnalysis(records);

  return {
    records,
    spatialIndex,
    summary: {
      totalRecords: records.length,
      categoryDistribution,
      dataSourceDistribution,
      mortalityCauseDistribution,
      ageGroupDistribution,
      genderDistribution,
      raceEthnicityDistribution,
      environmentallyRelatedRecords,
      militaryRelevantRecords,
      healthDisparityRecords,
      stateDistribution,
      yearRange: { earliest: earliestYear, latest: latestYear },
      dataReliabilityBreakdown,
    },
    correlations: { environmentalHealthCorrelations, militaryHealthOutcomes, healthDisparityAlerts, mortalityTrendAnalysis },
    metadata: { lastUpdated: new Date().toISOString(), dataVersion: '2.0' }
  };
}

function buildEnvironmentalHealthCorrelations(records: NCHSRecord[]): any[] {
  return records
    .filter(r => Object.values(r.nchsSpecific.environmentalFactors).some(v => v))
    .map(record => ({
      indicator_code: record.nchsSpecific.indicatorCode,
      indicator_name: record.nchsSpecific.indicatorName,
      data_value: record.healthMetrics[0].value,
      environmental_factors: Object.entries(record.nchsSpecific.environmentalFactors)
        .filter(([, value]) => value)
        .map(([key]) => key),
      cause_of_death: record.nchsSpecific.causeOfDeath,
      age_group: record.nchsSpecific.ageGroup,
      location: record.location.state || 'US',
      data_reliability: record.nchsSpecific.dataReliability,
      temporal_trend: record.nchsSpecific.temporalTrend,
    }))
    .sort((a, b) => b.data_value - a.data_value)
    .slice(0, 20);
}

function buildMilitaryHealthOutcomes(records: NCHSRecord[]): any[] {
  return records
    .filter(r => Object.values(r.nchsSpecific.militaryRelevance).some(v => v))
    .map(record => ({
      indicator_code: record.nchsSpecific.indicatorCode,
      indicator_name: record.nchsSpecific.indicatorName,
      data_value: record.healthMetrics[0].value,
      age_adjusted_rate: record.nchsSpecific.ageAdjustedRate,
      military_relevance: Object.entries(record.nchsSpecific.militaryRelevance)
        .filter(([, value]) => value)
        .map(([key]) => key),
      cause_of_death: record.nchsSpecific.causeOfDeath,
      age_group: record.nchsSpecific.ageGroup,
      gender: record.nchsSpecific.gender,
      location: record.location.state || 'US',
      temporal_trend: record.nchsSpecific.temporalTrend,
    }))
    .sort((a, b) => (b.age_adjusted_rate || b.data_value) - (a.age_adjusted_rate || a.data_value))
    .slice(0, 15);
}

function buildHealthDisparityAlerts(records: NCHSRecord[]): any[] {
  return records
    .filter(r => r.nchsSpecific.healthDisparityFlag)
    .map(record => ({
      indicator_code: record.nchsSpecific.indicatorCode,
      indicator_name: record.nchsSpecific.indicatorName,
      data_value: record.healthMetrics[0].value,
      race_ethnicity: record.nchsSpecific.raceEthnicity,
      age_group: record.nchsSpecific.ageGroup,
      gender: record.nchsSpecific.gender,
      location: record.location.state || 'US',
      data_reliability: record.nchsSpecific.dataReliability,
      temporal_trend: record.nchsSpecific.temporalTrend,
    }))
    .sort((a, b) => b.data_value - a.data_value)
    .slice(0, 25);
}

function buildMortalityTrendAnalysis(records: NCHSRecord[]): any[] {
  // Group mortality records by cause and analyze trends
  const mortalityRecords = records.filter(r => r.nchsSpecific.dataCategory === 'mortality' && r.nchsSpecific.causeOfDeath);

  const trendGroups = new Map<string, any[]>();

  mortalityRecords.forEach(record => {
    const key = `${record.nchsSpecific.causeOfDeath}_${record.location.state || 'US'}`;
    if (!trendGroups.has(key)) {
      trendGroups.set(key, []);
    }
    trendGroups.get(key)!.push(record);
  });

  const trends: any[] = [];

  trendGroups.forEach((groupRecords, key) => {
    if (groupRecords.length >= 2) { // Need at least 2 data points for trend
      const [cause, location] = key.split('_');
      const avgRate = groupRecords.reduce((sum, r) => sum + (r.nchsSpecific.ageAdjustedRate || r.healthMetrics[0].value), 0) / groupRecords.length;
      const trendDirection = groupRecords[0].nchsSpecific.temporalTrend;

      if (avgRate > 10) { // Significant mortality rate threshold
        trends.push({
          cause_of_death: cause,
          location,
          average_rate: Math.round(avgRate * 10) / 10,
          trend_direction: trendDirection,
          data_points: groupRecords.length,
          latest_year: Math.max(...groupRecords.map(r => r.nchsSpecific.dataYear)),
          military_relevant: groupRecords.some(r => Object.values(r.nchsSpecific.militaryRelevance).some(v => v)),
        });
      }
    }
  });

  return trends
    .sort((a, b) => b.average_rate - a.average_rate)
    .slice(0, 20);
}

export function getEnvironmentallyRelatedRecords(): NCHSRecord[] {
  return nchsCache?.records?.filter(r => Object.values(r.nchsSpecific.environmentalFactors).some(v => v)) || [];
}

export function getMilitaryRelevantRecords(): NCHSRecord[] {
  return nchsCache?.records?.filter(r => Object.values(r.nchsSpecific.militaryRelevance).some(v => v)) || [];
}

export function getSuicideMortalityData(): NCHSRecord[] {
  return nchsCache?.records?.filter(r => r.nchsSpecific.causeOfDeath === 'suicide') || [];
}