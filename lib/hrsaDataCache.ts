/**
 * HRSA Data API Cache
 * Health Professional Shortage Areas, healthcare facility locations, and access metrics
 * Part of Tier 1 HHS integration - critical for healthcare infrastructure assessment
 */

import {
  HHSAPIClient,
  type HHSHealthRecord,
  addMilitaryProximity,
  correlateWithWaterViolations,
  calculateHealthRiskScore,
  normalizeLocation,
  normalizeTemporal,
} from './hhsDataUtils';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';
import { PRIORITY_STATES } from './constants';
const militaryInstallations: any[] = require('../data/military-installations').militaryInstallations ?? require('../data/military-installations').default ?? require('../data/military-installations');

// ─── Types & Interfaces ──────────────────────────────────────────────────────

export type HRSADataCategory =
  | 'hpsa_primary_care'
  | 'hpsa_dental'
  | 'hpsa_mental_health'
  | 'medically_underserved'
  | 'health_centers'
  | 'rural_health'
  | 'provider_shortage';

export interface HRSARecord extends HHSHealthRecord {
  hrsaSpecific: {
    dataType: HRSADataCategory;
    hpsaId?: string;
    hpsaName?: string;
    hpsaScore?: number;
    shortageType?: string;
    populationServed?: number;
    providersNeeded?: number;
    currentProviders?: number;
    facilityName?: string;
    facilityType?: string;
    serviceArea?: string;
    ruralStatus?: 'rural' | 'urban' | 'frontier';
    accessBarriers?: string[];
    lastUpdate?: string;
    serviceCapacity?: number;
  };
}

interface HRSADataCacheData {
  records: HRSARecord[];
  summary: {
    totalRecords: number;
    categoryCounts: Record<HRSADataCategory, number>;
    statesCovered: string[];
    totalPopulationAffected: number;
    totalProvidersNeeded: number;
    severityDistribution: Record<string, number>;
    ruralUrbanBreakdown: Record<string, number>;
  };
  correlations: {
    nearMilitaryFacilities: number;
    correlatedWithViolations: number;
    highSeverityShortages: Array<{
      location: string;
      shortageType: string;
      severity: number;
      populationAffected: number;
      nearMilitary: boolean;
    }>;
    accessGaps: Array<{
      location: string;
      gapType: string;
      providersNeeded: number;
      currentProviders: number;
      deficitPercent: number;
    }>;
  };
  metadata: {
    lastUpdated: string;
    dataVersion: string;
    dataSourcesQueried: string[];
  };
}

// ─── Cache State Management ──────────────────────────────────────────────────

let hrsaDataCache: HRSADataCacheData | null = null;
let lastFetched: string | null = null;
let _buildInProgress = false;
let _buildStartedAt: string | null = null;
let _hrsaDataCacheLoaded = false;
let _lastDelta: CacheDelta | null = null;

const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
const CACHE_FILE = 'hrsa-data.json';

// ─── HRSA API Endpoints ──────────────────────────────────────────────────────

export const HRSA_ENDPOINTS = {
  HPSA_PRIMARY_CARE: 'https://data.hrsa.gov/api/1/datastore/query/gkzj-vxs9',
  HPSA_DENTAL: 'https://data.hrsa.gov/api/1/datastore/query/yq5x-z8qr',
  HPSA_MENTAL_HEALTH: 'https://data.hrsa.gov/api/1/datastore/query/css8-nprz',
  MEDICALLY_UNDERSERVED: 'https://data.hrsa.gov/api/1/datastore/query/e6xy-7q2h',
  HEALTH_CENTERS: 'https://data.hrsa.gov/api/1/datastore/query/4kjm-xkxy',
  RURAL_HEALTH: 'https://data.hrsa.gov/api/1/datastore/query/3vkn-8h4a',
};

// ─── Core Cache Functions ─────────────────────────────────────────────────────

export function getHRSADataCacheStatus(): {
  loaded: boolean;
  built: string | null;
  recordCount: number;
  statesCovered: number;
  buildInProgress: boolean;
  lastDelta: CacheDelta | null;
} {
  return {
    loaded: _hrsaDataCacheLoaded && hrsaDataCache !== null,
    built: lastFetched,
    recordCount: hrsaDataCache?.records?.length || 0,
    statesCovered: hrsaDataCache?.summary?.statesCovered?.length || 0,
    buildInProgress: isBuildInProgress(),
    lastDelta: _lastDelta,
  };
}

export function getHRSADataCache(): HRSARecord[] {
  return hrsaDataCache?.records || [];
}

export function getHRSADataCacheWithMetadata(): HRSADataCacheData | null {
  return hrsaDataCache;
}

export async function setHRSADataCache(data: HRSADataCacheData): Promise<void> {
  if (!data.records || data.records.length === 0) {
    console.warn('No HRSA data to cache, preserving existing blob');
    return;
  }

  const prevCounts = hrsaDataCache ? { recordCount: hrsaDataCache.summary.totalRecords } : null;
  const newCounts = { recordCount: data.summary.totalRecords };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, lastFetched);

  hrsaDataCache = data;
  lastFetched = new Date().toISOString();
  _hrsaDataCacheLoaded = true;

  await saveToDisk(data);
  await saveCacheToBlob(CACHE_FILE, data);
}

export function setBuildInProgress(inProgress: boolean): void {
  _buildInProgress = inProgress;
  _buildStartedAt = inProgress ? new Date().toISOString() : null;
}

export function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;
  if (_buildStartedAt) {
    const lockAge = Date.now() - new Date(_buildStartedAt).getTime();
    if (lockAge > BUILD_LOCK_TIMEOUT_MS) {
      console.warn('HRSA Data build lock expired, auto-clearing');
      _buildInProgress = false;
      _buildStartedAt = null;
      return false;
    }
  }
  return _buildInProgress;
}

export async function ensureWarmed(): Promise<void> {
  if (_hrsaDataCacheLoaded) return;

  try {
    const diskData = await loadFromDisk();
    if (diskData?.records?.length && diskData.records.length > 0) {
      hrsaDataCache = diskData;
      _hrsaDataCacheLoaded = true;
      return;
    }
  } catch (error) {
    console.warn('Failed to load HRSA Data cache from disk:', error);
  }

  try {
    const blobData = await loadCacheFromBlob<HRSADataCacheData>(CACHE_FILE);
    if (blobData?.records?.length && blobData.records.length > 0) {
      hrsaDataCache = blobData;
      _hrsaDataCacheLoaded = true;
      await saveToDisk(blobData!);
    }
  } catch (error) {
    console.warn('Failed to load HRSA Data cache from blob:', error);
  }
}

async function loadFromDisk(): Promise<HRSADataCacheData | null> {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', CACHE_FILE);
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.records || !Array.isArray(data.records)) return null;
    console.log(`[HRSA Data Cache] Loaded from disk (${data.records.length} records)`);
    return data;
  } catch (error) {
    console.warn('Failed to load HRSA Data cache from disk:', error);
    return null;
  }
}

async function saveToDisk(data: HRSADataCacheData): Promise<void> {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs');
    const path = require('path');
    const cacheDir = path.join(process.cwd(), '.cache');
    const file = path.join(cacheDir, CACHE_FILE);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
    console.log(`[HRSA Data Cache] Saved to disk (${data.records.length} records)`);
  } catch (error) {
    console.warn('Failed to save HRSA Data cache to disk:', error);
  }
}

// ─── Data Processing Functions ────────────────────────────────────────────────

export function processHRSAData(rawRecords: any[], dataType: HRSADataCategory): HRSARecord[] {
  const processedRecords: HRSARecord[] = [];

  for (const raw of rawRecords) {
    try {
      const healthRecord: HHSHealthRecord = {
        id: `hrsa_${dataType}_${raw.hpsa_id || raw.mua_id || raw.facility_id || Date.now()}`,
        source: 'hrsa_data',
        location: normalizeLocation({
          state: raw.state_name || raw.state_abbreviation,
          county: raw.county_name || raw.primary_county,
          city: raw.city || raw.primary_city,
          lat: parseFloat(raw.latitude) || undefined,
          lng: parseFloat(raw.longitude) || undefined,
        }),
        temporal: normalizeTemporal({
          year: new Date().getFullYear(),
          reportDate: raw.last_update || new Date().toISOString(),
        }),
        healthMetrics: extractHRSAMetrics(raw, dataType),
      };

      const hrsaRecord: HRSARecord = {
        ...healthRecord,
        hrsaSpecific: {
          dataType,
          hpsaId: raw.hpsa_id || raw.mua_id,
          hpsaName: raw.hpsa_name || raw.mua_name || raw.facility_name,
          hpsaScore: parseFloat(raw.hpsa_score) || undefined,
          shortageType: raw.designation_type || raw.shortage_type,
          populationServed: parseInt(raw.population_served) || parseInt(raw.total_population) || undefined,
          providersNeeded: parseInt(raw.providers_needed) || undefined,
          currentProviders: parseInt(raw.current_providers) || undefined,
          facilityName: raw.facility_name || raw.organization_name,
          facilityType: raw.facility_type || raw.organization_type,
          serviceArea: raw.service_area || raw.geographic_area,
          ruralStatus: determineRuralStatus(raw.rural_status || raw.designation),
          accessBarriers: extractAccessBarriers(raw),
          lastUpdate: raw.last_update,
          serviceCapacity: parseInt(raw.service_capacity) || undefined,
        },
      };

      const withProximity = addMilitaryProximity(hrsaRecord, militaryInstallations);
      processedRecords.push(withProximity as HRSARecord);

    } catch (error) {
      console.error('Error processing HRSA record:', error, { dataType, record: raw });
    }
  }

  return processedRecords;
}

function extractHRSAMetrics(raw: any, dataType: HRSADataCategory): HHSHealthRecord['healthMetrics'] {
  const metrics: HHSHealthRecord['healthMetrics'] = [];

  if (raw.hpsa_score) {
    metrics.push({
      category: 'healthcare_access',
      measure: 'shortage_severity',
      value: parseFloat(raw.hpsa_score),
      unit: 'score',
    });
  }

  if (raw.population_served || raw.total_population) {
    metrics.push({
      category: 'healthcare_access',
      measure: 'population_affected',
      value: parseInt(raw.population_served) || parseInt(raw.total_population),
      unit: 'people',
    });
  }

  if (raw.providers_needed) {
    metrics.push({
      category: 'healthcare_access',
      measure: 'provider_shortage',
      value: parseInt(raw.providers_needed),
      unit: 'providers',
    });
  }

  return metrics;
}

function determineRuralStatus(status: string): 'rural' | 'urban' | 'frontier' {
  if (!status) return 'urban';
  const lowerStatus = status.toLowerCase();
  if (lowerStatus.includes('frontier')) return 'frontier';
  if (lowerStatus.includes('rural')) return 'rural';
  return 'urban';
}

function extractAccessBarriers(raw: any): string[] {
  const barriers: string[] = [];
  const barrierFields = ['access_barriers', 'barriers', 'constraints'];

  barrierFields.forEach(field => {
    if (raw[field]) {
      if (typeof raw[field] === 'string') {
        barriers.push(...raw[field].split(',').map((b: string) => b.trim()));
      }
    }
  });

  return [...new Set(barriers)];
}

// ─── Data Fetching Functions ──────────────────────────────────────────────────

export async function fetchHRSAData(): Promise<{ dataType: HRSADataCategory; records: any[] }[]> {
  const hrsaClient = new HHSAPIClient('https://data.hrsa.gov');
  const allData: Array<{ dataType: HRSADataCategory; records: any[] }> = [];

  const endpointMap = [
    { url: HRSA_ENDPOINTS.HPSA_PRIMARY_CARE, type: 'hpsa_primary_care' as HRSADataCategory },
    { url: HRSA_ENDPOINTS.HPSA_DENTAL, type: 'hpsa_dental' as HRSADataCategory },
    { url: HRSA_ENDPOINTS.HPSA_MENTAL_HEALTH, type: 'hpsa_mental_health' as HRSADataCategory },
    { url: HRSA_ENDPOINTS.HEALTH_CENTERS, type: 'health_centers' as HRSADataCategory },
  ];

  for (const endpoint of endpointMap) {
    try {
      console.log(`Fetching HRSA ${endpoint.type} data...`);

      const queryParams = {
        limit: '5000',
        filters: JSON.stringify({
          state_abbreviation: PRIORITY_STATES.slice(0, 8)
        })
      };

      const response = await hrsaClient.request(
        `${endpoint.url}?${new URLSearchParams(queryParams)}`,
        {},
        300000
      );

      if (response?.result?.records && Array.isArray(response.result.records)) {
        allData.push({
          dataType: endpoint.type,
          records: response.result.records
        });
        console.log(`Retrieved ${response.result.records.length} ${endpoint.type} records`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error fetching HRSA ${endpoint.type}:`, error);
    }
  }

  return allData;
}

export async function buildHRSADataCacheData(
  endpointResults: Array<{ dataType: HRSADataCategory; records: any[] }>,
  waterViolations: Array<{ id: string; lat?: number; lng?: number; violationDate: string; systemId: string; violationType?: string; }>
): Promise<HRSADataCacheData> {
  const allRecords: HRSARecord[] = [];
  const dataSourcesQueried: string[] = [];

  for (const result of endpointResults) {
    const processedRecords = processHRSAData(result.records, result.dataType);
    allRecords.push(...processedRecords);
    dataSourcesQueried.push(result.dataType);
  }

  const recordsWithCorrelations = correlateWithWaterViolations(allRecords, waterViolations) as HRSARecord[];
  const recordsWithRiskScores = recordsWithCorrelations.map(record => ({
    ...record,
    riskScore: calculateHealthRiskScore(record),
  }));

  const summary = buildHRSASummary(recordsWithRiskScores);
  const correlations = buildHRSACorrelations(recordsWithRiskScores);

  return {
    records: recordsWithRiskScores,
    summary,
    correlations,
    metadata: {
      lastUpdated: new Date().toISOString(),
      dataVersion: '2.0',
      dataSourcesQueried,
    },
  };
}

function buildHRSASummary(records: HRSARecord[]): HRSADataCacheData['summary'] {
  const categoryCounts: Record<HRSADataCategory, number> = {
    hpsa_primary_care: 0,
    hpsa_dental: 0,
    hpsa_mental_health: 0,
    medically_underserved: 0,
    health_centers: 0,
    rural_health: 0,
    provider_shortage: 0,
  };

  let totalPopulationAffected = 0;
  let totalProvidersNeeded = 0;
  const severityDistribution: Record<string, number> = {};
  const ruralUrbanBreakdown: Record<string, number> = {};

  records.forEach(record => {
    categoryCounts[record.hrsaSpecific.dataType]++;
    totalPopulationAffected += record.hrsaSpecific.populationServed || 0;
    totalProvidersNeeded += record.hrsaSpecific.providersNeeded || 0;

    const severity = record.hrsaSpecific.hpsaScore ?
      (record.hrsaSpecific.hpsaScore > 20 ? 'high' : record.hrsaSpecific.hpsaScore > 10 ? 'medium' : 'low') : 'unknown';
    severityDistribution[severity] = (severityDistribution[severity] || 0) + 1;

    const ruralStatus = record.hrsaSpecific.ruralStatus || 'unknown';
    ruralUrbanBreakdown[ruralStatus] = (ruralUrbanBreakdown[ruralStatus] || 0) + 1;
  });

  return {
    totalRecords: records.length,
    categoryCounts,
    statesCovered: [...new Set(records.map(r => r.location.state).filter((s): s is string => Boolean(s)))],
    totalPopulationAffected,
    totalProvidersNeeded,
    severityDistribution,
    ruralUrbanBreakdown,
  };
}

function buildHRSACorrelations(records: HRSARecord[]): HRSADataCacheData['correlations'] {
  const nearMilitaryFacilities = records.filter(r => r.proximityToMilitary?.isNearBase).length;
  const correlatedWithViolations = records.filter(r => r.correlationFlags?.hasWaterViolation).length;

  const highSeverityShortages = records
    .filter(r => (r.hrsaSpecific.hpsaScore || 0) > 15)
    .map(record => ({
      location: `${record.location.county || 'Unknown'}, ${record.location.state || 'Unknown'}`,
      shortageType: record.hrsaSpecific.shortageType || 'Unknown',
      severity: record.hrsaSpecific.hpsaScore || 0,
      populationAffected: record.hrsaSpecific.populationServed || 0,
      nearMilitary: record.proximityToMilitary?.isNearBase || false,
    }))
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 15);

  const accessGaps = records
    .filter(r => r.hrsaSpecific.providersNeeded && r.hrsaSpecific.currentProviders)
    .map(record => {
      const needed = record.hrsaSpecific.providersNeeded || 0;
      const current = record.hrsaSpecific.currentProviders || 0;
      const deficitPercent = needed > 0 ? ((needed - current) / needed) * 100 : 0;

      return {
        location: `${record.location.county || 'Unknown'}, ${record.location.state || 'Unknown'}`,
        gapType: record.hrsaSpecific.dataType,
        providersNeeded: needed,
        currentProviders: current,
        deficitPercent: Math.round(deficitPercent),
      };
    })
    .filter(gap => gap.deficitPercent > 50)
    .sort((a, b) => b.deficitPercent - a.deficitPercent)
    .slice(0, 20);

  return {
    nearMilitaryFacilities,
    correlatedWithViolations,
    highSeverityShortages,
    accessGaps,
  };
}

export function getHealthcareShortagesNearMilitary(maxDistanceKm = 100): HRSARecord[] {
  if (!hrsaDataCache?.records) return [];
  return hrsaDataCache.records.filter(record => {
    return record.proximityToMilitary?.isNearBase &&
           (record.proximityToMilitary.distanceKm || Infinity) <= maxDistanceKm;
  });
}