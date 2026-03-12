/**
 * HealthData.gov Socrata API Cache
 * Hospital capacity, outbreak surveillance, and comprehensive HHS datasets via Socrata API
 * Part of Tier 1 HHS integration - accesses 1000+ government health datasets
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
import { militaryInstallations } from '../data/military-installations';

// ─── Types & Interfaces ──────────────────────────────────────────────────────

export type HealthDataGovCategory =
  | 'hospital_capacity'
  | 'outbreak_surveillance'
  | 'emergency_preparedness'
  | 'healthcare_quality'
  | 'disease_surveillance'
  | 'public_health'
  | 'medical_countermeasures';

export interface HealthDataGovRecord extends HHSHealthRecord {
  socrataSpecific: {
    datasetId: string;
    datasetName: string;
    category: HealthDataGovCategory;
    recordId: string;
    lastModified: string;
    dataProvider: string;
    geographicScope: 'national' | 'state' | 'county' | 'facility';
    qualityScore: number; // Data quality/completeness score
    metadata: Record<string, any>;
  };
}

interface HealthDataGovCacheData {
  records: HealthDataGovRecord[];
  summary: {
    totalRecords: number;
    datasetCount: number;
    categoryCounts: Record<HealthDataGovCategory, number>;
    statesCovered: string[];
    dateRange: { earliest: string; latest: string };
    qualityMetrics: {
      averageQualityScore: number;
      highQualityRecords: number;
      completenessRate: number;
    };
  };
  correlations: {
    hospitalCapacityRecords: number;
    outbreakSurveillanceRecords: number;
    emergencyPreparednessRecords: number;
    nearMilitaryFacilities: number;
    correlatedWithViolations: number;
    highRiskAlerts: Array<{
      location: string;
      category: HealthDataGovCategory;
      alertLevel: 'moderate' | 'high' | 'critical';
      datasetName: string;
      value: number | string;
    }>;
  };
  metadata: {
    lastUpdated: string;
    dataVersion: string;
    datasetsQueried: Array<{
      id: string;
      name: string;
      category: HealthDataGovCategory;
      recordCount: number;
      lastRefresh: string;
    }>;
  };
}

// ─── Cache State Management ──────────────────────────────────────────────────

let healthDataGovCache: HealthDataGovCacheData | null = null;
let lastFetched: string | null = null;
let _buildInProgress = false;
let _buildStartedAt: string | null = null;
let _healthDataGovCacheLoaded = false;
let _lastDelta: CacheDelta | null = null;

const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes
const CACHE_FILE = 'healthdata-gov.json';

// ─── HealthData.gov Priority Datasets ────────────────────────────────────────

export const HEALTHDATA_GOV_DATASETS = {
  // Hospital Capacity & Infrastructure
  HOSPITAL_CAPACITY: {
    id: 'g62h-syeh',
    name: 'Hospital Capacity Data',
    category: 'hospital_capacity' as HealthDataGovCategory,
    description: 'COVID-era hospital capacity and utilization data',
    priority: 1,
  },
  HOSPITAL_GENERAL_INFO: {
    id: 'xubh-q36u',
    name: 'Hospital General Information',
    category: 'hospital_capacity' as HealthDataGovCategory,
    description: 'CMS hospital general information and characteristics',
    priority: 1,
  },
  HOSPITAL_QUALITY: {
    id: 'yv7e-xc69',
    name: 'Hospital Quality Ratings',
    category: 'healthcare_quality' as HealthDataGovCategory,
    description: 'Hospital overall ratings and quality measures',
    priority: 1,
  },

  // Outbreak & Disease Surveillance
  NORS_OUTBREAKS: {
    id: 'vaux-rurv',
    name: 'NORS Outbreak Surveillance',
    category: 'outbreak_surveillance' as HealthDataGovCategory,
    description: 'National Outbreak Reporting System surveillance data',
    priority: 1,
  },
  WATERBORNE_OUTBREAKS: {
    id: 'mr8w-325u',
    name: 'Waterborne Disease Outbreaks',
    category: 'outbreak_surveillance' as HealthDataGovCategory,
    description: 'Surveillance summaries for waterborne disease outbreaks',
    priority: 1,
  },
  FOODBORNE_OUTBREAKS: {
    id: 'vz6k-d2zh',
    name: 'Foodborne Disease Outbreaks',
    category: 'outbreak_surveillance' as HealthDataGovCategory,
    description: 'Foodborne disease outbreak surveillance',
    priority: 2,
  },

  // Emergency Preparedness
  SNS_LOCATIONS: {
    id: 'adx2-q3z8',
    name: 'Strategic National Stockpile',
    category: 'emergency_preparedness' as HealthDataGovCategory,
    description: 'Medical countermeasure distribution points',
    priority: 2,
  },
  EMERGENCY_DEPARTMENTS: {
    id: 'rdj4-yq5b',
    name: 'Emergency Department Visits',
    category: 'emergency_preparedness' as HealthDataGovCategory,
    description: 'Emergency department syndromic surveillance',
    priority: 2,
  },

  // Public Health Surveillance
  HEALTH_TRACKING: {
    id: 'cjae-szjv',
    name: 'Environmental Public Health Tracking',
    category: 'disease_surveillance' as HealthDataGovCategory,
    description: 'Environmental health tracking program data',
    priority: 2,
  },
  CHRONIC_DISEASE: {
    id: 'ezfx-8h3w',
    name: 'Chronic Disease Indicators',
    category: 'disease_surveillance' as HealthDataGovCategory,
    description: 'State-level chronic disease surveillance',
    priority: 3,
  },

  // Medical Countermeasures
  VACCINE_DISTRIBUTION: {
    id: 'saz5-9hgg',
    name: 'Vaccine Distribution Data',
    category: 'medical_countermeasures' as HealthDataGovCategory,
    description: 'COVID-19 vaccine distribution and administration',
    priority: 3,
  },
  MEDICAL_DEVICES: {
    id: 'h5kb-wnqr',
    name: 'Medical Device Reports',
    category: 'medical_countermeasures' as HealthDataGovCategory,
    description: 'FDA medical device adverse event reports',
    priority: 3,
  },
} as const;

// ─── Core Cache Functions ─────────────────────────────────────────────────────

/**
 * Get current HealthData.gov cache status
 */
export function getHealthDataGovCacheStatus(): {
  loaded: boolean;
  built: string | null;
  recordCount: number;
  datasetCount: number;
  buildInProgress: boolean;
  lastDelta: CacheDelta | null;
} {
  return {
    loaded: _healthDataGovCacheLoaded && healthDataGovCache !== null,
    built: lastFetched,
    recordCount: healthDataGovCache?.records?.length || 0,
    datasetCount: healthDataGovCache?.summary?.datasetCount || 0,
    buildInProgress: isBuildInProgress(),
    lastDelta: _lastDelta,
  };
}

/**
 * Get HealthData.gov cache data
 */
export function getHealthDataGovCache(): HealthDataGovRecord[] {
  return healthDataGovCache?.records || [];
}

/**
 * Get HealthData.gov cache with metadata
 */
export function getHealthDataGovCacheWithMetadata(): HealthDataGovCacheData | null {
  return healthDataGovCache;
}

/**
 * Update HealthData.gov cache
 */
export async function setHealthDataGovCache(data: HealthDataGovCacheData): Promise<void> {
  if (!data.records || data.records.length === 0) {
    console.warn('No HealthData.gov data to cache, preserving existing blob');
    return;
  }

  const prevCounts = healthDataGovCache ? { recordCount: healthDataGovCache.summary.totalRecords } : null;
  const newCounts = { recordCount: data.summary.totalRecords };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, lastFetched);

  healthDataGovCache = data;
  lastFetched = new Date().toISOString();
  _healthDataGovCacheLoaded = true;

  await saveToDisk(data);
  await saveCacheToBlob(CACHE_FILE, data);
}

/**
 * Build lock management
 */
export function setBuildInProgress(inProgress: boolean): void {
  _buildInProgress = inProgress;
  _buildStartedAt = inProgress ? new Date().toISOString() : null;
}

export function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;

  if (_buildStartedAt) {
    const lockAge = Date.now() - new Date(_buildStartedAt).getTime();
    if (lockAge > BUILD_LOCK_TIMEOUT_MS) {
      console.warn('HealthData.gov build lock expired, auto-clearing');
      _buildInProgress = false;
      _buildStartedAt = null;
      return false;
    }
  }

  return _buildInProgress;
}

/**
 * Ensure cache is warmed from disk or blob storage
 */
export async function ensureWarmed(): Promise<void> {
  if (_healthDataGovCacheLoaded) return;

  try {
    // Try disk first
    const diskData = await loadFromDisk();
    if (diskData?.records?.length > 0) {
      healthDataGovCache = diskData;
      _healthDataGovCacheLoaded = true;
      return;
    }
  } catch (error) {
    console.warn('Failed to load HealthData.gov cache from disk:', error);
  }

  try {
    // Fallback to blob
    const blobData = await loadCacheFromBlob<HealthDataGovCacheData>(CACHE_FILE);
    if (blobData?.records?.length > 0) {
      healthDataGovCache = blobData;
      _healthDataGovCacheLoaded = true;
      await saveToDisk(blobData);
    }
  } catch (error) {
    console.warn('Failed to load HealthData.gov cache from blob:', error);
  }
}

// ─── Disk Persistence ────────────────────────────────────────────────────────

async function loadFromDisk(): Promise<HealthDataGovCacheData | null> {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', CACHE_FILE);
    if (!fs.existsSync(file)) return null;

    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);

    if (!data?.records || !Array.isArray(data.records)) return null;

    console.log(`[HealthData.gov Cache] Loaded from disk (${data.records.length} records)`);
    return data;
  } catch (error) {
    console.warn('Failed to load HealthData.gov cache from disk:', error);
    return null;
  }
}

async function saveToDisk(data: HealthDataGovCacheData): Promise<void> {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs');
    const path = require('path');

    const cacheDir = path.join(process.cwd(), '.cache');
    const file = path.join(cacheDir, CACHE_FILE);

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
    console.log(`[HealthData.gov Cache] Saved to disk (${data.records.length} records)`);
  } catch (error) {
    console.warn('Failed to save HealthData.gov cache to disk:', error);
  }
}

// ─── Data Processing Functions ────────────────────────────────────────────────

/**
 * Process and normalize HealthData.gov Socrata data
 */
export function processHealthDataGovData(
  rawRecords: any[],
  datasetInfo: { id: string; name: string; category: HealthDataGovCategory }
): HealthDataGovRecord[] {
  const processedRecords: HealthDataGovRecord[] = [];

  for (const raw of rawRecords) {
    try {
      // Create base health record
      const healthRecord: HHSHealthRecord = {
        id: `healthdata_${datasetInfo.id}_${raw[':id'] || raw.id || Date.now()}`,
        source: 'healthdata_gov',
        location: normalizeLocation(extractLocationFromRecord(raw, datasetInfo.category)),
        temporal: normalizeTemporal(extractTemporalFromRecord(raw, datasetInfo.category)),
        healthMetrics: extractHealthMetrics(raw, datasetInfo),
      };

      // Calculate quality score based on data completeness
      const qualityScore = calculateRecordQuality(raw);

      // Create HealthData.gov specific record
      const healthDataRecord: HealthDataGovRecord = {
        ...healthRecord,
        socrataSpecific: {
          datasetId: datasetInfo.id,
          datasetName: datasetInfo.name,
          category: datasetInfo.category,
          recordId: raw[':id'] || raw.id || 'unknown',
          lastModified: raw[':updated_at'] || raw.last_modified || new Date().toISOString(),
          dataProvider: extractDataProvider(raw) || 'HealthData.gov',
          geographicScope: determineGeographicScope(raw, datasetInfo.category),
          qualityScore,
          metadata: extractRelevantMetadata(raw, datasetInfo.category),
        },
      };

      // Add military proximity
      const withProximity = addMilitaryProximity(healthDataRecord, militaryInstallations);

      processedRecords.push(withProximity as HealthDataGovRecord);

    } catch (error) {
      console.error('Error processing HealthData.gov record:', error, { dataset: datasetInfo.id, record: raw });
    }
  }

  return processedRecords;
}

function extractLocationFromRecord(raw: any, category: HealthDataGovCategory): any {
  const location: any = {};

  // Common location fields across datasets
  const locationFields = {
    state: ['state', 'provider_state', 'facility_state', 'reporting_area'],
    county: ['county', 'provider_county', 'facility_county', 'county_name'],
    city: ['city', 'provider_city', 'facility_city', 'city_name'],
    zip: ['zip', 'zip_code', 'postal_code'],
    lat: ['latitude', 'lat', 'facility_latitude'],
    lng: ['longitude', 'lng', 'lon', 'facility_longitude'],
  };

  // Extract location data based on available fields
  Object.entries(locationFields).forEach(([key, fieldNames]) => {
    for (const fieldName of fieldNames) {
      if (raw[fieldName] !== undefined && raw[fieldName] !== null && raw[fieldName] !== '') {
        location[key] = raw[fieldName];
        break;
      }
    }
  });

  // Category-specific location handling
  if (category === 'hospital_capacity') {
    location.facilityName = raw.hospital_name || raw.facility_name || raw.provider_name;
    location.facilityId = raw.hospital_pk || raw.facility_id || raw.provider_id;
  }

  return location;
}

function extractTemporalFromRecord(raw: any, category: HealthDataGovCategory): any {
  const temporal: any = {};

  // Common temporal fields
  const temporalFields = {
    reportDate: ['report_date', 'collection_date', 'submission_date', 'date_updated'],
    effectiveDate: ['effective_date', 'period_start', 'outbreak_start_date'],
    year: ['year', 'collection_year', 'report_year'],
    month: ['month', 'collection_month'],
  };

  Object.entries(temporalFields).forEach(([key, fieldNames]) => {
    for (const fieldName of fieldNames) {
      if (raw[fieldName] !== undefined && raw[fieldName] !== null) {
        temporal[key] = raw[fieldName];
        break;
      }
    }
  });

  // Category-specific temporal handling
  if (category === 'outbreak_surveillance') {
    temporal.outbreakStartDate = raw.outbreak_start_date || raw.first_illness_onset;
    temporal.outbreakEndDate = raw.outbreak_end_date || raw.last_illness_onset;
  }

  return temporal;
}

function extractHealthMetrics(raw: any, datasetInfo: { id: string; name: string; category: HealthDataGovCategory }): HHSHealthRecord['healthMetrics'] {
  const metrics: HHSHealthRecord['healthMetrics'] = [];

  // Category-specific metric extraction
  switch (datasetInfo.category) {
    case 'hospital_capacity':
      extractHospitalCapacityMetrics(raw, metrics);
      break;
    case 'outbreak_surveillance':
      extractOutbreakMetrics(raw, metrics);
      break;
    case 'healthcare_quality':
      extractQualityMetrics(raw, metrics);
      break;
    case 'disease_surveillance':
      extractSurveillanceMetrics(raw, metrics);
      break;
    case 'emergency_preparedness':
      extractEmergencyMetrics(raw, metrics);
      break;
    default:
      extractGenericMetrics(raw, metrics);
  }

  return metrics;
}

function extractHospitalCapacityMetrics(raw: any, metrics: HHSHealthRecord['healthMetrics']): void {
  const capacityFields = [
    { field: 'inpatient_beds', measure: 'inpatient_bed_count', unit: 'beds' },
    { field: 'inpatient_bed_covid_utilization', measure: 'covid_bed_utilization', unit: 'count' },
    { field: 'adult_icu_bed_utilization', measure: 'icu_bed_utilization', unit: 'count' },
    { field: 'staffed_icu_adult_patients_confirmed_covid', measure: 'covid_icu_patients', unit: 'count' },
    { field: 'total_staffed_adult_icu_beds', measure: 'total_icu_beds', unit: 'beds' },
  ];

  capacityFields.forEach(({ field, measure, unit }) => {
    if (raw[field] !== undefined && raw[field] !== null && !isNaN(Number(raw[field]))) {
      metrics.push({
        category: 'hospital_capacity',
        measure,
        value: Number(raw[field]),
        unit,
      });
    }
  });
}

function extractOutbreakMetrics(raw: any, metrics: HHSHealthRecord['healthMetrics']): void {
  const outbreakFields = [
    { field: 'illnesses', measure: 'illness_count', unit: 'cases' },
    { field: 'hospitalizations', measure: 'hospitalization_count', unit: 'cases' },
    { field: 'deaths', measure: 'death_count', unit: 'cases' },
    { field: 'primary_mode', measure: 'transmission_mode', unit: 'category' },
  ];

  outbreakFields.forEach(({ field, measure, unit }) => {
    if (raw[field] !== undefined && raw[field] !== null) {
      metrics.push({
        category: 'outbreak',
        measure,
        value: unit === 'category' ? raw[field] : Number(raw[field]) || 0,
        unit,
      });
    }
  });
}

function extractQualityMetrics(raw: any, metrics: HHSHealthRecord['healthMetrics']): void {
  const qualityFields = [
    { field: 'hospital_overall_rating', measure: 'overall_rating', unit: 'stars' },
    { field: 'mortality_national_comparison', measure: 'mortality_rating', unit: 'category' },
    { field: 'safety_of_care_national_comparison', measure: 'safety_rating', unit: 'category' },
    { field: 'readmission_national_comparison', measure: 'readmission_rating', unit: 'category' },
  ];

  qualityFields.forEach(({ field, measure, unit }) => {
    if (raw[field] !== undefined && raw[field] !== null) {
      metrics.push({
        category: 'quality',
        measure,
        value: unit === 'category' ? raw[field] : Number(raw[field]) || 0,
        unit,
      });
    }
  });
}

function extractSurveillanceMetrics(raw: any, metrics: HHSHealthRecord['healthMetrics']): void {
  // Generic surveillance metric extraction
  const numericFields = Object.keys(raw).filter(key =>
    !isNaN(Number(raw[key])) &&
    !['id', 'year', 'month', 'latitude', 'longitude'].includes(key.toLowerCase())
  );

  numericFields.forEach(field => {
    if (Number(raw[field]) > 0) {
      metrics.push({
        category: 'surveillance',
        measure: field,
        value: Number(raw[field]),
        unit: 'count',
      });
    }
  });
}

function extractEmergencyMetrics(raw: any, metrics: HHSHealthRecord['healthMetrics']): void {
  const emergencyFields = [
    { field: 'total_visits', measure: 'ed_visits', unit: 'visits' },
    { field: 'cli_percent', measure: 'covid_like_illness_percent', unit: 'percent' },
    { field: 'ili_percent', measure: 'influenza_like_illness_percent', unit: 'percent' },
  ];

  emergencyFields.forEach(({ field, measure, unit }) => {
    if (raw[field] !== undefined && raw[field] !== null && !isNaN(Number(raw[field]))) {
      metrics.push({
        category: 'emergency',
        measure,
        value: Number(raw[field]),
        unit,
      });
    }
  });
}

function extractGenericMetrics(raw: any, metrics: HHSHealthRecord['healthMetrics']): void {
  // Extract all numeric fields as generic metrics
  Object.keys(raw).forEach(key => {
    const value = raw[key];
    if (typeof value === 'number' || (!isNaN(Number(value)) && value !== '')) {
      metrics.push({
        category: 'generic',
        measure: key,
        value: Number(value),
        unit: 'count',
      });
    }
  });
}

function calculateRecordQuality(raw: any): number {
  const totalFields = Object.keys(raw).length;
  const filledFields = Object.values(raw).filter(val =>
    val !== null && val !== undefined && val !== ''
  ).length;

  const completenessScore = totalFields > 0 ? (filledFields / totalFields) * 100 : 0;

  // Boost score for records with location data
  const hasLocation = raw.latitude || raw.longitude || raw.state || raw.county;
  const locationBonus = hasLocation ? 10 : 0;

  // Boost score for recent data
  const lastModified = new Date(raw[':updated_at'] || raw.last_modified || '2020-01-01');
  const monthsOld = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const recencyBonus = Math.max(0, 10 - monthsOld); // Up to 10 points for recent data

  return Math.min(100, Math.round(completenessScore + locationBonus + recencyBonus));
}

function extractDataProvider(raw: any): string | undefined {
  const providerFields = ['data_provider', 'source_organization', 'reporting_facility', 'submitter'];
  for (const field of providerFields) {
    if (raw[field]) return raw[field];
  }
  return undefined;
}

function determineGeographicScope(raw: any, category: HealthDataGovCategory): 'national' | 'state' | 'county' | 'facility' {
  if (category === 'hospital_capacity' && (raw.hospital_name || raw.facility_name)) {
    return 'facility';
  }
  if (raw.county || raw.county_name) return 'county';
  if (raw.state || raw.provider_state) return 'state';
  return 'national';
}

function extractRelevantMetadata(raw: any, category: HealthDataGovCategory): Record<string, any> {
  const metadata: Record<string, any> = {};

  // Common metadata fields
  const metadataFields = ['data_source', 'collection_method', 'notes', 'limitations'];
  metadataFields.forEach(field => {
    if (raw[field]) metadata[field] = raw[field];
  });

  // Category-specific metadata
  switch (category) {
    case 'hospital_capacity':
      if (raw.hospital_subtype) metadata.facilityType = raw.hospital_subtype;
      if (raw.hospital_ownership) metadata.ownership = raw.hospital_ownership;
      break;
    case 'outbreak_surveillance':
      if (raw.etiology_confirmed) metadata.confirmedEtiology = raw.etiology_confirmed;
      if (raw.setting_general) metadata.outbreakSetting = raw.setting_general;
      break;
  }

  return metadata;
}

// ─── Data Fetching Functions ──────────────────────────────────────────────────

/**
 * Fetch data from HealthData.gov Socrata API for priority datasets
 */
export async function fetchHealthDataGovData(): Promise<{
  datasetId: string;
  datasetName: string;
  category: HealthDataGovCategory;
  records: any[];
}[]> {
  const healthDataClient = new HHSAPIClient('https://healthdata.gov');
  const allDatasets: Array<{
    datasetId: string;
    datasetName: string;
    category: HealthDataGovCategory;
    records: any[];
  }> = [];

  try {
    // Get priority datasets (top tier for immediate value)
    const priorityDatasets = Object.values(HEALTHDATA_GOV_DATASETS)
      .filter(dataset => dataset.priority === 1)
      .slice(0, 6); // Limit to top 6 for performance

    console.log(`Fetching data from ${priorityDatasets.length} priority HealthData.gov datasets...`);

    for (const dataset of priorityDatasets) {
      try {
        console.log(`Fetching dataset: ${dataset.name} (${dataset.id})...`);

        // Build query parameters for efficiency
        const queryParams: Record<string, string> = {
          '$limit': '10000', // Reasonable limit
          '$order': ':updated_at DESC',
        };

        // Add state filtering for location-based datasets
        if (['hospital_capacity', 'outbreak_surveillance', 'healthcare_quality'].includes(dataset.category)) {
          const priorityStates = PRIORITY_STATES.slice(0, 8); // Top 8 states
          queryParams['$where'] = `state IN (${priorityStates.map(s => `'${s}'`).join(',')})`;
        }

        // Add date filtering for recent data
        if (['outbreak_surveillance', 'emergency_preparedness'].includes(dataset.category)) {
          const recentDate = new Date();
          recentDate.setFullYear(recentDate.getFullYear() - 2); // Last 2 years
          queryParams['$where'] = (queryParams['$where'] ? queryParams['$where'] + ' AND ' : '') +
                                  `:updated_at >= '${recentDate.toISOString()}'`;
        }

        const records = await healthDataClient.querySocrata(dataset.id, queryParams);

        if (Array.isArray(records) && records.length > 0) {
          allDatasets.push({
            datasetId: dataset.id,
            datasetName: dataset.name,
            category: dataset.category,
            records,
          });
          console.log(`Retrieved ${records.length} records from ${dataset.name}`);
        } else {
          console.warn(`No records found for dataset ${dataset.name}`);
        }

        // Rate limiting between datasets
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error fetching dataset ${dataset.name}:`, error);
        // Continue with other datasets
      }
    }

    console.log(`Successfully fetched data from ${allDatasets.length} datasets`);
    return allDatasets;

  } catch (error) {
    console.error('Failed to fetch HealthData.gov data:', error);
    return [];
  }
}

/**
 * Build comprehensive HealthData.gov cache data with analysis
 */
export async function buildHealthDataGovCacheData(
  datasetResults: Array<{ datasetId: string; datasetName: string; category: HealthDataGovCategory; records: any[] }>,
  waterViolations: Array<{
    id: string;
    lat?: number;
    lng?: number;
    violationDate: string;
    systemId: string;
    violationType?: string;
  }>
): Promise<HealthDataGovCacheData> {
  const allRecords: HealthDataGovRecord[] = [];
  const datasetsQueried: Array<{
    id: string;
    name: string;
    category: HealthDataGovCategory;
    recordCount: number;
    lastRefresh: string;
  }> = [];

  // Process each dataset
  for (const datasetResult of datasetResults) {
    const processedRecords = processHealthDataGovData(
      datasetResult.records,
      {
        id: datasetResult.datasetId,
        name: datasetResult.datasetName,
        category: datasetResult.category,
      }
    );

    allRecords.push(...processedRecords);

    datasetsQueried.push({
      id: datasetResult.datasetId,
      name: datasetResult.datasetName,
      category: datasetResult.category,
      recordCount: processedRecords.length,
      lastRefresh: new Date().toISOString(),
    });
  }

  // Add water violation correlations
  const recordsWithCorrelations = correlateWithWaterViolations(allRecords, waterViolations) as HealthDataGovRecord[];

  // Calculate risk scores
  const recordsWithRiskScores = recordsWithCorrelations.map(record => ({
    ...record,
    riskScore: calculateHealthRiskScore(record),
  }));

  // Build summary and correlation analysis
  const summary = buildHealthDataGovSummary(recordsWithRiskScores);
  const correlations = buildHealthDataGovCorrelations(recordsWithRiskScores, waterViolations);

  return {
    records: recordsWithRiskScores,
    summary,
    correlations,
    metadata: {
      lastUpdated: new Date().toISOString(),
      dataVersion: '2.0',
      datasetsQueried,
    },
  };
}

function buildHealthDataGovSummary(records: HealthDataGovRecord[]): HealthDataGovCacheData['summary'] {
  const statesCovered = [...new Set(records.map(r => r.location.state).filter(Boolean))];
  const datasetCount = [...new Set(records.map(r => r.socrataSpecific.datasetId))].length;

  // Category counts
  const categoryCounts: Record<HealthDataGovCategory, number> = {
    hospital_capacity: 0,
    outbreak_surveillance: 0,
    emergency_preparedness: 0,
    healthcare_quality: 0,
    disease_surveillance: 0,
    public_health: 0,
    medical_countermeasures: 0,
  };

  records.forEach(record => {
    categoryCounts[record.socrataSpecific.category]++;
  });

  // Date range
  const dates = records
    .map(r => new Date(r.temporal.reportDate).getTime())
    .filter(d => !isNaN(d))
    .sort((a, b) => a - b);

  const dateRange = dates.length > 0 ? {
    earliest: new Date(dates[0]).toISOString(),
    latest: new Date(dates[dates.length - 1]).toISOString(),
  } : { earliest: '', latest: '' };

  // Quality metrics
  const qualityScores = records.map(r => r.socrataSpecific.qualityScore);
  const averageQualityScore = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
  const highQualityRecords = qualityScores.filter(score => score >= 80).length;
  const completenessRate = highQualityRecords / records.length;

  return {
    totalRecords: records.length,
    datasetCount,
    categoryCounts,
    statesCovered,
    dateRange,
    qualityMetrics: {
      averageQualityScore: Math.round(averageQualityScore),
      highQualityRecords,
      completenessRate: Math.round(completenessRate * 100) / 100,
    },
  };
}

function buildHealthDataGovCorrelations(
  records: HealthDataGovRecord[],
  waterViolations: any[]
): HealthDataGovCacheData['correlations'] {
  const hospitalCapacityRecords = records.filter(r => r.socrataSpecific.category === 'hospital_capacity').length;
  const outbreakSurveillanceRecords = records.filter(r => r.socrataSpecific.category === 'outbreak_surveillance').length;
  const emergencyPreparednessRecords = records.filter(r => r.socrataSpecific.category === 'emergency_preparedness').length;
  const nearMilitaryFacilities = records.filter(r => r.proximityToMilitary?.isNearBase).length;
  const correlatedWithViolations = records.filter(r => r.correlationFlags?.hasWaterViolation).length;

  // Generate high-risk alerts
  const highRiskAlerts: Array<{
    location: string;
    category: HealthDataGovCategory;
    alertLevel: 'moderate' | 'high' | 'critical';
    datasetName: string;
    value: number | string;
  }> = [];

  records.forEach(record => {
    const riskScore = (record as any).riskScore || 0;

    if (riskScore >= 70) {
      const primaryMetric = record.healthMetrics[0];
      highRiskAlerts.push({
        location: `${record.location.county || 'Unknown'}, ${record.location.state || 'Unknown'}`,
        category: record.socrataSpecific.category,
        alertLevel: riskScore >= 85 ? 'critical' : riskScore >= 70 ? 'high' : 'moderate',
        datasetName: record.socrataSpecific.datasetName,
        value: primaryMetric?.value || 'Unknown',
      });
    }
  });

  return {
    hospitalCapacityRecords,
    outbreakSurveillanceRecords,
    emergencyPreparednessRecords,
    nearMilitaryFacilities,
    correlatedWithViolations,
    highRiskAreas: highRiskAlerts
      .sort((a, b) => {
        const levelOrder = { critical: 3, high: 2, moderate: 1 };
        return (levelOrder[b.alertLevel] || 0) - (levelOrder[a.alertLevel] || 0);
      })
      .slice(0, 20),
  };
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Get hospital capacity data for specific location
 */
export function getHospitalCapacityData(state?: string, county?: string): HealthDataGovRecord[] {
  if (!healthDataGovCache?.records) return [];

  return healthDataGovCache.records.filter(record => {
    if (record.socrataSpecific.category !== 'hospital_capacity') return false;
    if (state && record.location.state !== state.toUpperCase()) return false;
    if (county && record.location.county !== county) return false;
    return true;
  });
}

/**
 * Get outbreak surveillance data near military installations
 */
export function getOutbreakSurveillanceNearMilitary(maxDistanceKm = 50): HealthDataGovRecord[] {
  if (!healthDataGovCache?.records) return [];

  return healthDataGovCache.records.filter(record => {
    return record.socrataSpecific.category === 'outbreak_surveillance' &&
           record.proximityToMilitary?.isNearBase &&
           (record.proximityToMilitary.distanceKm || Infinity) <= maxDistanceKm;
  });
}

/**
 * Get high-quality healthcare data records
 */
export function getHighQualityRecords(category?: HealthDataGovCategory, minQualityScore = 80): HealthDataGovRecord[] {
  if (!healthDataGovCache?.records) return [];

  return healthDataGovCache.records.filter(record => {
    if (record.socrataSpecific.qualityScore < minQualityScore) return false;
    if (category && record.socrataSpecific.category !== category) return false;
    return true;
  }).sort((a, b) => b.socrataSpecific.qualityScore - a.socrataSpecific.qualityScore);
}