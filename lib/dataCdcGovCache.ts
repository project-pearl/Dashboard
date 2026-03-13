/**
 * Data.CDC.gov Extended Cache
 * Comprehensive CDC public health surveillance datasets
 * Part of Tier 1 HHS integration - critical for public health intelligence
 */

import { HHSAPIClient, type HHSHealthRecord, addMilitaryProximity, correlateWithWaterViolations } from './hhsDataUtils';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

export type CDCDataCategory = 'chronic_disease' | 'infectious_disease' | 'environmental_health' | 'injury_violence' | 'maternal_child_health' | 'behavioral_health' | 'emergency_preparedness' | 'health_disparities';
export type CDCDataType = 'surveillance' | 'vital_statistics' | 'behavioral_risk' | 'outbreak_investigation' | 'laboratory_data' | 'syndromic_surveillance';
export type CDCReportingLevel = 'national' | 'state' | 'county' | 'city' | 'zip_code' | 'tract';

export interface DataCDCGovRecord extends HHSHealthRecord {
  cdcDataSpecific: {
    datasetId: string;
    datasetTitle: string;
    category: CDCDataCategory;
    dataType: CDCDataType;
    reportingLevel: CDCReportingLevel;
    indicatorName: string;
    indicatorValue?: number;
    indicatorUnit: string;
    confidenceInterval?: {
      lower: number;
      upper: number;
    };
    dataQuality: 'high' | 'medium' | 'low' | 'suppressed';
    populationDenominator?: number;
    demographicBreakdown?: {
      ageGroup?: string;
      sex?: string;
      race?: string;
      ethnicity?: string;
    };
    riskFactors: string[];
    environmentalFactors: string[];
    waterRelatedHealth: boolean;
    emergencyRelevance: boolean;
    healthDisparityFlag: boolean;
    publicHealthPriority: 'routine' | 'elevated' | 'high' | 'urgent' | 'critical';
    surveillancePeriod: string;
    dataSource: string;
    methodologyNotes?: string;
  };
}

interface DataCDCGovCacheData {
  records: DataCDCGovRecord[];
  summary: {
    totalDatasets: number;
    categoryDistribution: Record<CDCDataCategory, number>;
    dataTypeDistribution: Record<CDCDataType, number>;
    reportingLevelBreakdown: Record<CDCReportingLevel, number>;
    waterRelatedIndicators: number;
    emergencyRelevantDatasets: number;
    healthDisparityIndicators: number;
    highPriorityAlerts: number;
    criticalPriorityAlerts: number;
    statesCovered: number;
    surveillancePeriodRange: { earliest: string; latest: string; };
  };
  correlations: {
    waterHealthCorrelations: any[];
    emergencyPreparednessGaps: any[];
    healthDisparityAlerts: any[];
    militaryPopulationHealth: any[];
  };
  metadata: { lastUpdated: string; dataVersion: string; };
}

let dataCdcGovCache: DataCDCGovCacheData | null = null;
let lastFetched: string | null = null;
let _buildInProgress = false;
let _buildStartedAt: string | null = null;
let _dataCdcGovCacheLoaded = false;
let _lastDelta: CacheDelta | null = null;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
const CACHE_FILE = 'data-cdc-gov.json';

export function getDataCDCGovCacheStatus() {
  return {
    loaded: _dataCdcGovCacheLoaded && dataCdcGovCache !== null,
    built: lastFetched,
    recordCount: dataCdcGovCache?.records?.length || 0,
    criticalAlerts: dataCdcGovCache?.summary?.criticalPriorityAlerts || 0,
    buildInProgress: isBuildInProgress(),
    lastDelta: _lastDelta,
  };
}

export function getDataCDCGovCache(): DataCDCGovRecord[] { return dataCdcGovCache?.records || []; }

export async function setDataCDCGovCache(data: DataCDCGovCacheData): Promise<void> {
  if (!data.records?.length) { console.warn('No Data.CDC.gov data to cache'); return; }
  const prevCounts = dataCdcGovCache ? { recordCount: dataCdcGovCache.summary.totalDatasets } : null;
  _lastDelta = computeCacheDelta(prevCounts, { recordCount: data.summary.totalDatasets }, lastFetched);
  dataCdcGovCache = data; lastFetched = new Date().toISOString(); _dataCdcGovCacheLoaded = true;
  await saveToDisk(data); await saveCacheToBlob(CACHE_FILE, data);
}

export function setBuildInProgress(inProgress: boolean): void { _buildInProgress = inProgress; _buildStartedAt = inProgress ? new Date().toISOString() : null; }
export function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;
  if (_buildStartedAt && Date.now() - new Date(_buildStartedAt).getTime() > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('Data.CDC.gov build lock expired'); _buildInProgress = false; _buildStartedAt = null; return false;
  }
  return _buildInProgress;
}

export async function ensureWarmed(): Promise<void> {
  if (_dataCdcGovCacheLoaded) return;
  try {
    const diskData = await loadFromDisk();
    if (diskData?.records?.length) { dataCdcGovCache = diskData; _dataCdcGovCacheLoaded = true; return; }
  } catch (e) { console.warn('Data.CDC.gov disk load failed:', e); }
  try {
    const blobData = await loadCacheFromBlob<DataCDCGovCacheData>(CACHE_FILE);
    if (blobData?.records?.length) { dataCdcGovCache = blobData; _dataCdcGovCacheLoaded = true; await saveToDisk(blobData); }
  } catch (e) { console.warn('Data.CDC.gov blob load failed:', e); }
}

async function loadFromDisk(): Promise<DataCDCGovCacheData | null> {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs'); const path = require('path');
    const file = path.join(process.cwd(), '.cache', CACHE_FILE);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!data?.records) return null;
    console.log(`[Data.CDC.gov Cache] Loaded from disk (${data.records.length} records)`);
    return data;
  } catch (e) { return null; }
}

async function saveToDisk(data: DataCDCGovCacheData): Promise<void> {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs'); const path = require('path');
    const cacheDir = path.join(process.cwd(), '.cache'); const file = path.join(cacheDir, CACHE_FILE);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
    console.log(`[Data.CDC.gov Cache] Saved to disk (${data.records.length} records)`);
  } catch (e) { console.warn('Data.CDC.gov disk save failed:', e); }
}

export function processDataCDCGovData(rawRecords: any[]): DataCDCGovRecord[] {
  return rawRecords.map(raw => ({
    id: `data_cdc_gov_${raw.dataset_id || raw.id || Date.now()}`,
    source: 'data_cdc_gov',
    location: {
      state: raw.location_abbr || raw.state || 'US',
      county: raw.county || raw.geographic_level === 'County' ? raw.location_desc : undefined,
      city: raw.city || raw.geographic_level === 'City' ? raw.location_desc : undefined,
    },
    temporal: {
      reportDate: raw.data_period || raw.year_period || new Date().toISOString(),
      year: parseInt(raw.year_end || raw.year || new Date().getFullYear().toString()) || new Date().getFullYear(),
    },
    healthMetrics: [{
      category: raw.category || 'public_health',
      measure: raw.indicator || raw.measure_desc || 'unknown_indicator',
      value: parseFloat(raw.data_value || raw.value || 0),
      unit: raw.data_value_unit || raw.unit || 'percent',
    }],
    cdcDataSpecific: {
      datasetId: raw.dataset_id || raw.id || 'unknown',
      datasetTitle: raw.dataset_title || raw.title || 'Unknown Dataset',
      category: categorizeCDCData(raw.category, raw.topic, raw.indicator),
      dataType: determineCDCDataType(raw.data_source, raw.dataset_title),
      reportingLevel: normalizeReportingLevel(raw.geographic_level),
      indicatorName: raw.indicator || raw.measure_desc || 'Unknown Indicator',
      indicatorValue: parseFloat(raw.data_value || raw.value) || undefined,
      indicatorUnit: raw.data_value_unit || raw.unit || 'percent',
      confidenceInterval: raw.confidence_limit_low && raw.confidence_limit_high ? {
        lower: parseFloat(raw.confidence_limit_low),
        upper: parseFloat(raw.confidence_limit_high),
      } : undefined,
      dataQuality: assessDataQuality(raw.data_value, raw.sample_size, raw.confidence_limit_low),
      populationDenominator: parseFloat(raw.sample_size || raw.population) || undefined,
      demographicBreakdown: {
        ageGroup: raw.age_group || raw.age_category,
        sex: raw.sex || raw.gender,
        race: raw.race || raw.race_ethnicity,
        ethnicity: raw.ethnicity,
      },
      riskFactors: extractRiskFactors(raw.indicator, raw.topic, raw.category),
      environmentalFactors: extractEnvironmentalFactors(raw.indicator, raw.topic),
      waterRelatedHealth: isWaterRelatedHealth(raw.indicator, raw.topic, raw.category),
      emergencyRelevance: isEmergencyRelevant(raw.indicator, raw.topic, raw.category),
      healthDisparityFlag: isHealthDisparity(raw.race, raw.ethnicity, raw.data_value),
      publicHealthPriority: assessPublicHealthPriority(raw.data_value, raw.indicator, raw.category),
      surveillancePeriod: raw.data_period || raw.year_period || 'unknown',
      dataSource: raw.data_source || raw.source || 'CDC',
      methodologyNotes: raw.methodology_notes || raw.notes,
    }
  }));
}

function categorizeCDCData(category: string, topic: string, indicator: string): CDCDataCategory {
  const combined = `${category || ''} ${topic || ''} ${indicator || ''}`.toLowerCase();

  if (combined.includes('chronic') || combined.includes('diabetes') || combined.includes('heart') || combined.includes('cancer')) return 'chronic_disease';
  if (combined.includes('infectious') || combined.includes('flu') || combined.includes('covid') || combined.includes('hepatitis')) return 'infectious_disease';
  if (combined.includes('environment') || combined.includes('air quality') || combined.includes('water') || combined.includes('chemical')) return 'environmental_health';
  if (combined.includes('injury') || combined.includes('violence') || combined.includes('suicide') || combined.includes('overdose')) return 'injury_violence';
  if (combined.includes('maternal') || combined.includes('infant') || combined.includes('pregnancy') || combined.includes('birth')) return 'maternal_child_health';
  if (combined.includes('mental') || combined.includes('behavioral') || combined.includes('depression') || combined.includes('substance')) return 'behavioral_health';
  if (combined.includes('emergency') || combined.includes('preparedness') || combined.includes('disaster')) return 'emergency_preparedness';
  if (combined.includes('disparity') || combined.includes('equity') || combined.includes('social')) return 'health_disparities';

  return 'chronic_disease'; // Default fallback
}

function determineCDCDataType(dataSource: string, datasetTitle: string): CDCDataType {
  const combined = `${dataSource || ''} ${datasetTitle || ''}`.toLowerCase();

  if (combined.includes('brfss') || combined.includes('behavioral risk')) return 'behavioral_risk';
  if (combined.includes('vital') || combined.includes('mortality') || combined.includes('birth') || combined.includes('death')) return 'vital_statistics';
  if (combined.includes('outbreak') || combined.includes('investigation') || combined.includes('foodborne')) return 'outbreak_investigation';
  if (combined.includes('laboratory') || combined.includes('lab data') || combined.includes('testing')) return 'laboratory_data';
  if (combined.includes('syndromic') || combined.includes('emergency department') || combined.includes('ed visits')) return 'syndromic_surveillance';

  return 'surveillance'; // Default fallback
}

function normalizeReportingLevel(geographicLevel: string): CDCReportingLevel {
  const level = (geographicLevel || '').toLowerCase();

  if (level.includes('national') || level.includes('us') || level.includes('overall')) return 'national';
  if (level.includes('state')) return 'state';
  if (level.includes('county')) return 'county';
  if (level.includes('city') || level.includes('metropolitan')) return 'city';
  if (level.includes('zip') || level.includes('postal')) return 'zip_code';
  if (level.includes('tract') || level.includes('census')) return 'tract';

  return 'state'; // Default fallback
}

function assessDataQuality(dataValue: string, sampleSize: string, confidenceLimit: string): 'high' | 'medium' | 'low' | 'suppressed' {
  if (!dataValue || dataValue === '' || dataValue.toLowerCase().includes('suppress')) return 'suppressed';

  const sample = parseFloat(sampleSize || '0');
  const hasConfidence = confidenceLimit && confidenceLimit !== '';

  if (sample >= 1000 && hasConfidence) return 'high';
  if (sample >= 100 || hasConfidence) return 'medium';

  return 'low';
}

function extractRiskFactors(indicator: string, topic: string, category: string): string[] {
  const combined = `${indicator || ''} ${topic || ''} ${category || ''}`.toLowerCase();
  const factors: string[] = [];

  if (combined.includes('tobacco') || combined.includes('smoking')) factors.push('tobacco_use');
  if (combined.includes('alcohol') || combined.includes('drinking')) factors.push('alcohol_use');
  if (combined.includes('obesity') || combined.includes('bmi')) factors.push('obesity');
  if (combined.includes('physical activity') || combined.includes('exercise')) factors.push('physical_inactivity');
  if (combined.includes('diet') || combined.includes('nutrition')) factors.push('poor_nutrition');
  if (combined.includes('blood pressure') || combined.includes('hypertension')) factors.push('hypertension');
  if (combined.includes('cholesterol')) factors.push('high_cholesterol');
  if (combined.includes('diabetes')) factors.push('diabetes');

  return factors;
}

function extractEnvironmentalFactors(indicator: string, topic: string): string[] {
  const combined = `${indicator || ''} ${topic || ''}`.toLowerCase();
  const factors: string[] = [];

  if (combined.includes('air quality') || combined.includes('pollution')) factors.push('air_pollution');
  if (combined.includes('water') || combined.includes('drinking water')) factors.push('water_quality');
  if (combined.includes('chemical') || combined.includes('pesticide')) factors.push('chemical_exposure');
  if (combined.includes('lead') || combined.includes('heavy metal')) factors.push('heavy_metals');
  if (combined.includes('radiation') || combined.includes('radon')) factors.push('radiation');
  if (combined.includes('noise')) factors.push('noise_pollution');
  if (combined.includes('temperature') || combined.includes('heat')) factors.push('extreme_temperature');

  return factors;
}

function isWaterRelatedHealth(indicator: string, topic: string, category: string): boolean {
  const combined = `${indicator || ''} ${topic || ''} ${category || ''}`.toLowerCase();
  return ['water', 'drinking water', 'waterborne', 'gastrointestinal', 'diarrhea', 'gastroenteritis'].some(keyword => combined.includes(keyword));
}

function isEmergencyRelevant(indicator: string, topic: string, category: string): boolean {
  const combined = `${indicator || ''} ${topic || ''} ${category || ''}`.toLowerCase();
  return ['emergency', 'disaster', 'preparedness', 'response', 'evacuation', 'surge capacity'].some(keyword => combined.includes(keyword));
}

function isHealthDisparity(race: string, ethnicity: string, dataValue: string): boolean {
  if (!race && !ethnicity) return false;
  return race !== 'All Races' || ethnicity !== 'All Ethnicities';
}

function assessPublicHealthPriority(dataValue: string, indicator: string, category: string): 'routine' | 'elevated' | 'high' | 'urgent' | 'critical' {
  const value = parseFloat(dataValue || '0');
  const indicatorLower = (indicator || '').toLowerCase();
  const categoryLower = (category || '').toLowerCase();

  // Critical thresholds for specific indicators
  if (indicatorLower.includes('mortality') && value > 100) return 'critical';
  if (indicatorLower.includes('outbreak') && value > 10) return 'urgent';
  if (indicatorLower.includes('emergency') || categoryLower.includes('emergency')) return 'urgent';

  // Elevated based on value ranges (context-dependent)
  if (value > 75) return 'high';
  if (value > 50) return 'elevated';

  return 'routine';
}

export async function fetchDataCDCGovData(): Promise<any[]> {
  // Mock Data.CDC.gov data - in practice would fetch from CDC's Socrata API endpoints
  const currentDate = new Date();
  const mockData = [
    { dataset_id: '1', dataset_title: 'Chronic Disease Indicators', category: 'Chronic Disease', indicator: 'Adult obesity prevalence', data_value: '36.2', data_value_unit: 'percent', location_abbr: 'US', geographic_level: 'National', year_end: '2023', confidence_limit_low: '35.1', confidence_limit_high: '37.3', sample_size: '450000', data_source: 'BRFSS' },
    { dataset_id: '2', dataset_title: 'Environmental Health Indicators', category: 'Environmental Health', indicator: 'Drinking water system violations', data_value: '7.1', data_value_unit: 'percent', location_abbr: 'CA', geographic_level: 'State', year_end: '2023', confidence_limit_low: '6.8', confidence_limit_high: '7.4', sample_size: '15000', data_source: 'EPA SDWIS' },
    { dataset_id: '3', dataset_title: 'Infectious Disease Surveillance', category: 'Infectious Disease', indicator: 'Foodborne illness outbreaks', data_value: '23', data_value_unit: 'count', location_abbr: 'TX', geographic_level: 'State', year_end: '2024', data_source: 'CDC NNDSS' },
  ];
  return mockData;
}

export async function buildDataCDCGovCacheData(records: DataCDCGovRecord[]): Promise<DataCDCGovCacheData> {
  const categoryDistribution: Record<CDCDataCategory, number> = { chronic_disease: 0, infectious_disease: 0, environmental_health: 0, injury_violence: 0, maternal_child_health: 0, behavioral_health: 0, emergency_preparedness: 0, health_disparities: 0 };
  const dataTypeDistribution: Record<CDCDataType, number> = { surveillance: 0, vital_statistics: 0, behavioral_risk: 0, outbreak_investigation: 0, laboratory_data: 0, syndromic_surveillance: 0 };
  const reportingLevelBreakdown: Record<CDCReportingLevel, number> = { national: 0, state: 0, county: 0, city: 0, zip_code: 0, tract: 0 };

  let waterRelatedIndicators = 0; let emergencyRelevantDatasets = 0; let healthDisparityIndicators = 0;
  let highPriorityAlerts = 0; let criticalPriorityAlerts = 0;
  const statesCovered = new Set<string>();
  let earliestPeriod = '9999'; let latestPeriod = '0000';

  records.forEach(record => {
    categoryDistribution[record.cdcDataSpecific.category]++;
    dataTypeDistribution[record.cdcDataSpecific.dataType]++;
    reportingLevelBreakdown[record.cdcDataSpecific.reportingLevel]++;

    if (record.cdcDataSpecific.waterRelatedHealth) waterRelatedIndicators++;
    if (record.cdcDataSpecific.emergencyRelevance) emergencyRelevantDatasets++;
    if (record.cdcDataSpecific.healthDisparityFlag) healthDisparityIndicators++;

    if (record.cdcDataSpecific.publicHealthPriority === 'high') highPriorityAlerts++;
    if (['urgent', 'critical'].includes(record.cdcDataSpecific.publicHealthPriority)) criticalPriorityAlerts++;

    if (record.location.state && record.location.state !== 'US') statesCovered.add(record.location.state);

    const period = record.cdcDataSpecific.surveillancePeriod.slice(0, 4); // Extract year
    if (period < earliestPeriod) earliestPeriod = period;
    if (period > latestPeriod) latestPeriod = period;
  });

  // Build correlations
  const waterHealthCorrelations = buildWaterHealthCorrelations(records);
  const emergencyPreparednessGaps = buildEmergencyPreparednessGaps(records);
  const healthDisparityAlerts = buildHealthDisparityAlerts(records);
  const militaryPopulationHealth = buildMilitaryPopulationHealth(records);

  return {
    records,
    summary: {
      totalDatasets: records.length,
      categoryDistribution,
      dataTypeDistribution,
      reportingLevelBreakdown,
      waterRelatedIndicators,
      emergencyRelevantDatasets,
      healthDisparityIndicators,
      highPriorityAlerts,
      criticalPriorityAlerts,
      statesCovered: statesCovered.size,
      surveillancePeriodRange: { earliest: earliestPeriod, latest: latestPeriod },
    },
    correlations: { waterHealthCorrelations, emergencyPreparednessGaps, healthDisparityAlerts, militaryPopulationHealth },
    metadata: { lastUpdated: new Date().toISOString(), dataVersion: '2.0' }
  };
}

function buildWaterHealthCorrelations(records: DataCDCGovRecord[]): any[] {
  return records
    .filter(r => r.cdcDataSpecific.waterRelatedHealth || r.cdcDataSpecific.environmentalFactors.includes('water_quality'))
    .map(record => ({
      indicator: record.cdcDataSpecific.indicatorName,
      value: record.cdcDataSpecific.indicatorValue,
      unit: record.cdcDataSpecific.indicatorUnit,
      location: `${record.location.county || ''} ${record.location.state || ''}`.trim(),
      reporting_level: record.cdcDataSpecific.reportingLevel,
      priority: record.cdcDataSpecific.publicHealthPriority,
      surveillance_period: record.cdcDataSpecific.surveillancePeriod,
      environmental_factors: record.cdcDataSpecific.environmentalFactors,
    }))
    .sort((a, b) => {
      const priorityOrder = { critical: 5, urgent: 4, high: 3, elevated: 2, routine: 1 };
      return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
    })
    .slice(0, 20);
}

function buildEmergencyPreparednessGaps(records: DataCDCGovRecord[]): any[] {
  return records
    .filter(r => r.cdcDataSpecific.emergencyRelevance && r.cdcDataSpecific.publicHealthPriority !== 'routine')
    .map(record => ({
      indicator: record.cdcDataSpecific.indicatorName,
      value: record.cdcDataSpecific.indicatorValue,
      location: record.location.state || 'Unknown',
      priority: record.cdcDataSpecific.publicHealthPriority,
      data_quality: record.cdcDataSpecific.dataQuality,
      surveillance_period: record.cdcDataSpecific.surveillancePeriod,
      category: record.cdcDataSpecific.category,
    }))
    .sort((a, b) => {
      const priorityOrder = { critical: 5, urgent: 4, high: 3, elevated: 2, routine: 1 };
      return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
    })
    .slice(0, 15);
}

function buildHealthDisparityAlerts(records: DataCDCGovRecord[]): any[] {
  return records
    .filter(r => r.cdcDataSpecific.healthDisparityFlag)
    .map(record => ({
      indicator: record.cdcDataSpecific.indicatorName,
      value: record.cdcDataSpecific.indicatorValue,
      demographic: {
        age_group: record.cdcDataSpecific.demographicBreakdown?.ageGroup,
        sex: record.cdcDataSpecific.demographicBreakdown?.sex,
        race: record.cdcDataSpecific.demographicBreakdown?.race,
        ethnicity: record.cdcDataSpecific.demographicBreakdown?.ethnicity,
      },
      location: record.location.state || 'Unknown',
      category: record.cdcDataSpecific.category,
      priority: record.cdcDataSpecific.publicHealthPriority,
      surveillance_period: record.cdcDataSpecific.surveillancePeriod,
    }))
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 25);
}

function buildMilitaryPopulationHealth(records: DataCDCGovRecord[]): any[] {
  // Filter for states with significant military populations
  const militaryStates = ['VA', 'TX', 'CA', 'NC', 'FL', 'GA', 'WA', 'CO', 'HI', 'AK'];

  return records
    .filter(r => militaryStates.includes(r.location.state || '') && ['high', 'urgent', 'critical'].includes(r.cdcDataSpecific.publicHealthPriority))
    .map(record => ({
      state: record.location.state,
      indicator: record.cdcDataSpecific.indicatorName,
      value: record.cdcDataSpecific.indicatorValue,
      category: record.cdcDataSpecific.category,
      priority: record.cdcDataSpecific.publicHealthPriority,
      risk_factors: record.cdcDataSpecific.riskFactors,
      environmental_factors: record.cdcDataSpecific.environmentalFactors,
      surveillance_period: record.cdcDataSpecific.surveillancePeriod,
    }))
    .sort((a, b) => {
      const priorityOrder = { critical: 5, urgent: 4, high: 3, elevated: 2, routine: 1 };
      return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
    })
    .slice(0, 20);
}

export function getWaterRelatedHealthIndicators(): DataCDCGovRecord[] {
  return dataCdcGovCache?.records?.filter(r => r.cdcDataSpecific.waterRelatedHealth) || [];
}

export function getEmergencyPreparednessIndicators(): DataCDCGovRecord[] {
  return dataCdcGovCache?.records?.filter(r => r.cdcDataSpecific.emergencyRelevance) || [];
}

export function getHealthDisparityAlerts(): DataCDCGovRecord[] {
  return dataCdcGovCache?.records?.filter(r =>
    r.cdcDataSpecific.healthDisparityFlag &&
    ['high', 'urgent', 'critical'].includes(r.cdcDataSpecific.publicHealthPriority)
  ) || [];
}

export function getCriticalPublicHealthAlerts(): DataCDCGovRecord[] {
  return dataCdcGovCache?.records?.filter(r =>
    ['urgent', 'critical'].includes(r.cdcDataSpecific.publicHealthPriority)
  ) || [];
}