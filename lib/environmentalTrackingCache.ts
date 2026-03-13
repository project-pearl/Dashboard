/**
 * EPA Environmental Health Tracking Network Cache
 * Drinking water quality indicators, air quality, and health outcomes from CDC's tracking system
 * Part of Tier 1 HHS integration - directly correlates environmental exposures with health impacts
 */

import {
  HHSAPIClient,
  type HHSHealthRecord,
  addMilitaryProximity,
  correlateWithWaterViolations,
  calculateHealthRiskScore,
  normalizeLocation,
  normalizeTemporal,
  normalizeHealthMetrics
} from './hhsDataUtils';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';
import { PRIORITY_STATES } from './constants';
// @ts-ignore - JSON module without type declarations
import militaryInstallationsData from '../data/military-installations.json';
const militaryInstallations = militaryInstallationsData as any[];

// ─── Types & Interfaces ──────────────────────────────────────────────────────

export type TrackingIndicatorType =
  | 'drinking_water'
  | 'air_quality'
  | 'birth_defects'
  | 'cancer'
  | 'respiratory'
  | 'cardiovascular'
  | 'environmental_health';

export interface EnvironmentalTrackingRecord extends HHSHealthRecord {
  trackingSpecific: {
    indicatorId: number;
    indicatorName: string;
    measureId: number;
    measureName: string;
    indicatorType: TrackingIndicatorType;
    geographicLevel: 'national' | 'state' | 'county' | 'tract';
    temporalType: 'annual' | 'monthly' | 'quarterly';
    dataValue: number;
    dataValueUnit: string;
    confidenceInterval?: {
      lower: number;
      upper: number;
    };
    isSignificant: boolean;
    suppressionFlag?: string;
    dataSource: string;
  };
}

interface EnvironmentalTrackingCacheData {
  records: EnvironmentalTrackingRecord[];
  summary: {
    totalRecords: number;
    statesCovered: string[];
    indicatorTypes: Record<TrackingIndicatorType, number>;
    yearsCovered: number[];
    dataValueRanges: Record<string, { min: number; max: number; avg: number }>;
  };
  correlations: {
    waterQualityIndicators: number;
    healthOutcomes: number;
    nearMilitaryFacilities: number;
    significantFindings: number;
    highRiskAreas: Array<{
      location: string;
      indicatorType: TrackingIndicatorType;
      riskScore: number;
      dataValue: number;
      isSignificant: boolean;
    }>;
  };
  metadata: {
    lastUpdated: string;
    dataVersion: string;
    queryCriteria: {
      indicators: number[];
      states: string[];
      years: string[];
    };
  };
}

// ─── Cache State Management ──────────────────────────────────────────────────

let environmentalTrackingCache: EnvironmentalTrackingCacheData | null = null;
let lastFetched: string | null = null;
let _buildInProgress = false;
let _buildStartedAt: string | null = null;
let _environmentalTrackingCacheLoaded = false;
let _lastDelta: CacheDelta | null = null;

const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes
const CACHE_FILE = 'environmental-tracking.json';

// ─── Environmental Health Tracking Indicators ────────────────────────────────

export const TRACKING_INDICATORS = {
  // Drinking Water Quality
  DRINKING_WATER_SYSTEMS: { id: 1, name: 'Community Water Systems', type: 'drinking_water' as TrackingIndicatorType },
  WATER_VIOLATIONS: { id: 2, name: 'Drinking Water Violations', type: 'drinking_water' as TrackingIndicatorType },
  NITRATE_LEVELS: { id: 3, name: 'Nitrate in Drinking Water', type: 'drinking_water' as TrackingIndicatorType },
  ARSENIC_LEVELS: { id: 4, name: 'Arsenic in Drinking Water', type: 'drinking_water' as TrackingIndicatorType },

  // Air Quality
  OZONE_LEVELS: { id: 10, name: 'Ozone Air Quality', type: 'air_quality' as TrackingIndicatorType },
  PM25_LEVELS: { id: 11, name: 'PM2.5 Air Quality', type: 'air_quality' as TrackingIndicatorType },

  // Health Outcomes
  ASTHMA_PREVALENCE: { id: 20, name: 'Adult Asthma Prevalence', type: 'respiratory' as TrackingIndicatorType },
  BIRTH_DEFECTS: { id: 30, name: 'Birth Defects', type: 'birth_defects' as TrackingIndicatorType },
  CANCER_INCIDENCE: { id: 40, name: 'Cancer Incidence', type: 'cancer' as TrackingIndicatorType },
  CARDIOVASCULAR_DEATHS: { id: 50, name: 'Cardiovascular Disease Deaths', type: 'cardiovascular' as TrackingIndicatorType },

  // Environmental Health
  LEAD_EXPOSURE: { id: 60, name: 'Childhood Lead Exposure', type: 'environmental_health' as TrackingIndicatorType },
  HEAT_RELATED_ILLNESS: { id: 70, name: 'Heat-Related Illness', type: 'environmental_health' as TrackingIndicatorType },
} as const;

// ─── Core Cache Functions ─────────────────────────────────────────────────────

/**
 * Get current Environmental Tracking cache status
 */
export function getEnvironmentalTrackingCacheStatus(): {
  loaded: boolean;
  built: string | null;
  recordCount: number;
  statesCovered: number;
  buildInProgress: boolean;
  lastDelta: CacheDelta | null;
} {
  return {
    loaded: _environmentalTrackingCacheLoaded && environmentalTrackingCache !== null,
    built: lastFetched,
    recordCount: environmentalTrackingCache?.records?.length || 0,
    statesCovered: environmentalTrackingCache?.summary?.statesCovered?.length || 0,
    buildInProgress: isBuildInProgress(),
    lastDelta: _lastDelta,
  };
}

/**
 * Get Environmental Tracking cache data
 */
export function getEnvironmentalTrackingCache(): EnvironmentalTrackingRecord[] {
  return environmentalTrackingCache?.records || [];
}

/**
 * Get Environmental Tracking cache with metadata
 */
export function getEnvironmentalTrackingCacheWithMetadata(): EnvironmentalTrackingCacheData | null {
  return environmentalTrackingCache;
}

/**
 * Update Environmental Tracking cache
 */
export async function setEnvironmentalTrackingCache(data: EnvironmentalTrackingCacheData): Promise<void> {
  if (!data.records || data.records.length === 0) {
    console.warn('No Environmental Tracking data to cache, preserving existing blob');
    return;
  }

  const prevCounts = environmentalTrackingCache ? { recordCount: environmentalTrackingCache.summary.totalRecords } : null;
  const newCounts = { recordCount: data.summary.totalRecords };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, lastFetched);

  environmentalTrackingCache = data;
  lastFetched = new Date().toISOString();
  _environmentalTrackingCacheLoaded = true;

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
      console.warn('Environmental Tracking build lock expired, auto-clearing');
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
  if (_environmentalTrackingCacheLoaded) return;

  try {
    // Try disk first
    const diskData = await loadFromDisk();
    if (diskData && diskData.records && diskData.records.length > 0) {
      environmentalTrackingCache = diskData;
      _environmentalTrackingCacheLoaded = true;
      return;
    }
  } catch (error) {
    console.warn('Failed to load Environmental Tracking cache from disk:', error);
  }

  try {
    // Fallback to blob
    const blobData = await loadCacheFromBlob<EnvironmentalTrackingCacheData>(CACHE_FILE);
    if (blobData && blobData.records && blobData.records.length > 0) {
      environmentalTrackingCache = blobData;
      _environmentalTrackingCacheLoaded = true;
      await saveToDisk(blobData);
    }
  } catch (error) {
    console.warn('Failed to load Environmental Tracking cache from blob:', error);
  }
}

// ─── Disk Persistence ────────────────────────────────────────────────────────

async function loadFromDisk(): Promise<EnvironmentalTrackingCacheData | null> {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', CACHE_FILE);
    if (!fs.existsSync(file)) return null;

    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);

    if (!data?.records || !Array.isArray(data.records)) return null;

    console.log(`[Environmental Tracking Cache] Loaded from disk (${data.records.length} records)`);
    return data;
  } catch (error) {
    console.warn('Failed to load Environmental Tracking cache from disk:', error);
    return null;
  }
}

async function saveToDisk(data: EnvironmentalTrackingCacheData): Promise<void> {
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
    console.log(`[Environmental Tracking Cache] Saved to disk (${data.records.length} records)`);
  } catch (error) {
    console.warn('Failed to save Environmental Tracking cache to disk:', error);
  }
}

// ─── Data Processing Functions ────────────────────────────────────────────────

/**
 * Process and normalize Environmental Tracking data
 */
export function processEnvironmentalTrackingData(rawRecords: any[]): EnvironmentalTrackingRecord[] {
  const processedRecords: EnvironmentalTrackingRecord[] = [];

  for (const raw of rawRecords) {
    try {
      // Create base health record
      const healthRecord: HHSHealthRecord = {
        id: `tracking_${raw.indicatorId || 'unknown'}_${raw.measureId || 'unknown'}_${raw.geographyValue || 'unknown'}_${raw.reportYear || Date.now()}`,
        source: 'environmental_tracking',
        location: normalizeLocation({
          state: raw.geographyValue?.length === 2 ? raw.geographyValue : raw.stateName,
          county: raw.geographyValue?.length > 2 ? raw.geographyValue : undefined,
          fips: raw.geographyValue,
        }),
        temporal: normalizeTemporal({
          year: raw.reportYear || raw.year,
          reportDate: raw.reportYear ? `${raw.reportYear}-12-31` : undefined,
        }),
        healthMetrics: [{
          category: getIndicatorCategory(raw.indicatorId),
          measure: raw.measureName || raw.indicatorName || 'Unknown Measure',
          value: parseFloat(raw.dataValue) || 0,
          unit: raw.dataValueUnit || undefined,
          confidence: raw.confidenceIntervalLower && raw.confidenceIntervalUpper ?
            Math.abs(raw.confidenceIntervalUpper - raw.confidenceIntervalLower) / 2 : undefined,
        }],
      };

      // Create Environmental Tracking specific record
      const trackingRecord: EnvironmentalTrackingRecord = {
        ...healthRecord,
        trackingSpecific: {
          indicatorId: parseInt(raw.indicatorId) || 0,
          indicatorName: raw.indicatorName || 'Unknown Indicator',
          measureId: parseInt(raw.measureId) || 0,
          measureName: raw.measureName || 'Unknown Measure',
          indicatorType: categorizeIndicator(raw.indicatorId, raw.indicatorName),
          geographicLevel: determineGeographicLevel(raw.geographyTypeCode, raw.geographyValue),
          temporalType: determineTemporalType(raw.temporalType || 'annual'),
          dataValue: parseFloat(raw.dataValue) || 0,
          dataValueUnit: raw.dataValueUnit || '',
          confidenceInterval: raw.confidenceIntervalLower && raw.confidenceIntervalUpper ? {
            lower: parseFloat(raw.confidenceIntervalLower),
            upper: parseFloat(raw.confidenceIntervalUpper),
          } : undefined,
          isSignificant: determineSignificance(raw.significanceFlag, raw.dataValue, raw.confidenceIntervalLower),
          suppressionFlag: raw.suppressionFlag || undefined,
          dataSource: raw.dataSource || 'Environmental Health Tracking Network',
        },
      };

      // Add military proximity
      const withProximity = addMilitaryProximity(trackingRecord, militaryInstallations);

      processedRecords.push(withProximity as EnvironmentalTrackingRecord);

    } catch (error) {
      console.error('Error processing Environmental Tracking record:', error, raw);
    }
  }

  return processedRecords;
}

function getIndicatorCategory(indicatorId: number | string): string {
  const id = parseInt(indicatorId?.toString()) || 0;

  if (id >= 1 && id <= 9) return 'drinking_water';
  if (id >= 10 && id <= 19) return 'air_quality';
  if (id >= 20 && id <= 29) return 'respiratory';
  if (id >= 30 && id <= 39) return 'birth_defects';
  if (id >= 40 && id <= 49) return 'cancer';
  if (id >= 50 && id <= 59) return 'cardiovascular';
  if (id >= 60) return 'environmental_health';

  return 'environmental_health';
}

function categorizeIndicator(indicatorId: number | string, indicatorName: string = ''): TrackingIndicatorType {
  const name = indicatorName.toLowerCase();
  const id = parseInt(indicatorId?.toString()) || 0;

  if (name.includes('water') || name.includes('drinking') || (id >= 1 && id <= 9)) {
    return 'drinking_water';
  }
  if (name.includes('air') || name.includes('ozone') || name.includes('pm2.5') || (id >= 10 && id <= 19)) {
    return 'air_quality';
  }
  if (name.includes('asthma') || name.includes('respiratory') || (id >= 20 && id <= 29)) {
    return 'respiratory';
  }
  if (name.includes('birth') || name.includes('defect') || (id >= 30 && id <= 39)) {
    return 'birth_defects';
  }
  if (name.includes('cancer') || (id >= 40 && id <= 49)) {
    return 'cancer';
  }
  if (name.includes('cardiovascular') || name.includes('heart') || (id >= 50 && id <= 59)) {
    return 'cardiovascular';
  }

  return 'environmental_health';
}

function determineGeographicLevel(geoTypeCode: string, geoValue: string): 'national' | 'state' | 'county' | 'tract' {
  if (!geoTypeCode || !geoValue) return 'state';

  if (geoTypeCode === 'US' || geoValue === 'US') return 'national';
  if (geoValue?.length === 2) return 'state';
  if (geoValue?.length === 5) return 'county';
  if (geoValue?.length > 5) return 'tract';

  return 'state';
}

function determineTemporalType(temporalType: string): 'annual' | 'monthly' | 'quarterly' {
  const type = temporalType?.toLowerCase() || '';

  if (type.includes('month')) return 'monthly';
  if (type.includes('quarter')) return 'quarterly';

  return 'annual';
}

function determineSignificance(significanceFlag: string, dataValue: number, lowerCI?: number): boolean {
  // If significance flag is explicitly set
  if (significanceFlag === 'Yes' || significanceFlag === 'Y' || significanceFlag === '1') return true;
  if (significanceFlag === 'No' || significanceFlag === 'N' || significanceFlag === '0') return false;

  // If we have confidence interval data, check if lower bound > 0
  if (lowerCI !== undefined && lowerCI > 0) return true;

  // Default significance based on data value magnitude
  return Math.abs(dataValue) > 1;
}

/**
 * Build comprehensive Environmental Tracking cache data with analysis
 */
export async function buildEnvironmentalTrackingCacheData(
  records: EnvironmentalTrackingRecord[],
  waterViolations: Array<{
    id: string;
    lat?: number;
    lng?: number;
    violationDate: string;
    systemId: string;
    violationType?: string;
  }>
): Promise<EnvironmentalTrackingCacheData> {

  // Add water violation correlations
  const recordsWithCorrelations = correlateWithWaterViolations(records, waterViolations) as EnvironmentalTrackingRecord[];

  // Calculate risk scores
  const recordsWithRiskScores = recordsWithCorrelations.map(record => ({
    ...record,
    riskScore: calculateHealthRiskScore(record),
  }));

  // Build summary statistics
  const summary = buildTrackingSummary(recordsWithRiskScores);
  const correlations = buildTrackingCorrelationAnalysis(recordsWithRiskScores, waterViolations);

  return {
    records: recordsWithRiskScores,
    summary,
    correlations,
    metadata: {
      lastUpdated: new Date().toISOString(),
      dataVersion: '2.0',
      queryCriteria: {
        indicators: getUniqueIndicators(recordsWithRiskScores),
        states: getUniqueStates(recordsWithRiskScores),
        years: getUniqueYears(recordsWithRiskScores),
      },
    },
  };
}

function buildTrackingSummary(records: EnvironmentalTrackingRecord[]): EnvironmentalTrackingCacheData['summary'] {
  const statesCovered = [...new Set(records.map(r => r.location.state).filter((s): s is string => !!s))];
  const yearsCovered = [...new Set(records.map(r => r.temporal.year).filter((y): y is number => !!y))];

  // Count by indicator type
  const indicatorTypes: Record<TrackingIndicatorType, number> = {
    drinking_water: 0,
    air_quality: 0,
    birth_defects: 0,
    cancer: 0,
    respiratory: 0,
    cardiovascular: 0,
    environmental_health: 0,
  };

  records.forEach(record => {
    indicatorTypes[record.trackingSpecific.indicatorType]++;
  });

  // Data value ranges by measure
  const dataValueRanges: Record<string, { min: number; max: number; avg: number }> = {};
  const measureValues = new Map<string, number[]>();

  records.forEach(record => {
    const measure = record.trackingSpecific.measureName;
    if (!measureValues.has(measure)) {
      measureValues.set(measure, []);
    }
    measureValues.get(measure)!.push(record.trackingSpecific.dataValue);
  });

  measureValues.forEach((values, measure) => {
    dataValueRanges[measure] = {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, val) => sum + val, 0) / values.length,
    };
  });

  return {
    totalRecords: records.length,
    statesCovered,
    indicatorTypes,
    yearsCovered,
    dataValueRanges,
  };
}

function buildTrackingCorrelationAnalysis(
  records: EnvironmentalTrackingRecord[],
  waterViolations: any[]
): EnvironmentalTrackingCacheData['correlations'] {
  const waterQualityIndicators = records.filter(r => r.trackingSpecific.indicatorType === 'drinking_water').length;
  const healthOutcomes = records.filter(r =>
    ['birth_defects', 'cancer', 'respiratory', 'cardiovascular'].includes(r.trackingSpecific.indicatorType)
  ).length;
  const nearMilitaryFacilities = records.filter(r => r.proximityToMilitary?.isNearBase).length;
  const significantFindings = records.filter(r => r.trackingSpecific.isSignificant).length;

  // Build high-risk areas analysis
  const locationRisks = new Map<string, {
    location: string;
    indicatorType: TrackingIndicatorType;
    riskScore: number;
    dataValue: number;
    isSignificant: boolean;
  }>();

  records.forEach(record => {
    if (!record.trackingSpecific.isSignificant) return;

    const location = `${record.location.county || 'Unknown'}, ${record.location.state || 'Unknown'}`;
    const key = `${location}_${record.trackingSpecific.indicatorType}`;

    const existing = locationRisks.get(key);
    const currentRisk = (record as any).riskScore || 0;

    if (!existing || currentRisk > existing.riskScore) {
      locationRisks.set(key, {
        location,
        indicatorType: record.trackingSpecific.indicatorType,
        riskScore: currentRisk,
        dataValue: record.trackingSpecific.dataValue,
        isSignificant: record.trackingSpecific.isSignificant,
      });
    }
  });

  const highRiskAreas = Array.from(locationRisks.values())
    .filter(area => area.riskScore > 30) // High risk threshold
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 25);

  return {
    waterQualityIndicators,
    healthOutcomes,
    nearMilitaryFacilities,
    significantFindings,
    highRiskAreas,
  };
}

function getUniqueIndicators(records: EnvironmentalTrackingRecord[]): number[] {
  return [...new Set(records.map(r => r.trackingSpecific.indicatorId).filter(Boolean))];
}

function getUniqueStates(records: EnvironmentalTrackingRecord[]): string[] {
  return [...new Set(records.map(r => r.location.state).filter((s): s is string => !!s))];
}

function getUniqueYears(records: EnvironmentalTrackingRecord[]): string[] {
  return [...new Set(records.map(r => r.temporal.year?.toString()).filter((s): s is string => !!s))];
}

// ─── Data Fetching Functions ──────────────────────────────────────────────────

/**
 * Fetch environmental tracking data from CDC's Environmental Health Tracking Network
 */
export async function fetchEnvironmentalTrackingData(): Promise<any[]> {
  const trackingClient = new HHSAPIClient('https://ephtracking.cdc.gov');
  const allRecords: any[] = [];

  try {
    // Fetch data for priority indicators and states
    const indicatorIds = [1, 2, 3, 4, 10, 11, 20, 30, 40, 50, 60, 70]; // Key indicators from our mapping
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i - 1); // Last 5 years

    console.log(`Fetching Environmental Tracking data for indicators: ${indicatorIds.join(', ')}`);

    for (const indicatorId of indicatorIds) {
      try {
        // Fetch measures for this indicator
        console.log(`Fetching measures for indicator ${indicatorId}...`);
        const measuresUrl = `/apigateway/api/v1/indicators/${indicatorId}/measures`;
        const measures = await trackingClient.request(measuresUrl, {}, 300000); // 5 minute cache

        if (!Array.isArray(measures) || measures.length === 0) {
          console.warn(`No measures found for indicator ${indicatorId}`);
          continue;
        }

        // Fetch data for each measure
        for (const measure of measures.slice(0, 3)) { // Limit to top 3 measures per indicator
          try {
            const measureId = measure.measureId || measure.id;
            console.log(`Fetching data for indicator ${indicatorId}, measure ${measureId}...`);

            // Query for state-level data for priority states
            for (const state of PRIORITY_STATES.slice(0, 8)) { // Top 8 states
              try {
                const dataUrl = `/apigateway/api/v1/indicators/${indicatorId}/measures/${measureId}/data`;
                const queryParams = {
                  geographyTypeCode: 'ST',
                  geographyValue: state,
                  temporalTypeCode: 'ANNUAL',
                  'reportYear[]': years.slice(0, 2).join(','), // Last 2 years for performance
                };

                const stateData = await trackingClient.request(
                  `${dataUrl}?${new URLSearchParams(queryParams)}`,
                  {},
                  300000 // 5 minute cache
                );

                if (Array.isArray(stateData) && stateData.length > 0) {
                  allRecords.push(...stateData);
                  console.log(`Retrieved ${stateData.length} records for ${state}, indicator ${indicatorId}, measure ${measureId}`);
                }

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

              } catch (error) {
                console.warn(`Error fetching data for ${state}, indicator ${indicatorId}, measure ${measureId}:`, error);
              }
            }

          } catch (error) {
            console.warn(`Error fetching measures for indicator ${indicatorId}, measure ${measure.measureId}:`, error);
          }
        }

        // Rate limiting between indicators
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error fetching data for indicator ${indicatorId}:`, error);
      }
    }

    console.log(`Total Environmental Tracking records fetched: ${allRecords.length}`);
    return allRecords;

  } catch (error) {
    console.error('Failed to fetch Environmental Tracking data:', error);
    return [];
  }
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Get drinking water quality indicators for specific location
 */
export function getDrinkingWaterIndicators(
  state?: string,
  county?: string
): EnvironmentalTrackingRecord[] {
  if (!environmentalTrackingCache?.records) return [];

  return environmentalTrackingCache.records.filter(record => {
    // Filter by indicator type
    if (record.trackingSpecific.indicatorType !== 'drinking_water') return false;

    // Filter by location
    if (state && record.location.state !== state.toUpperCase()) return false;
    if (county && record.location.county !== county) return false;

    return true;
  });
}

/**
 * Get environmental health correlations for military installations
 */
export function getMilitaryEnvironmentalHealth(
  maxDistanceKm = 50
): EnvironmentalTrackingRecord[] {
  if (!environmentalTrackingCache?.records) return [];

  return environmentalTrackingCache.records.filter(record => {
    return record.proximityToMilitary?.isNearBase &&
           (record.proximityToMilitary.distanceKm || Infinity) <= maxDistanceKm;
  });
}

/**
 * Get significant environmental health findings
 */
export function getSignificantFindings(
  indicatorType?: TrackingIndicatorType
): EnvironmentalTrackingRecord[] {
  if (!environmentalTrackingCache?.records) return [];

  return environmentalTrackingCache.records.filter(record => {
    if (!record.trackingSpecific.isSignificant) return false;
    if (indicatorType && record.trackingSpecific.indicatorType !== indicatorType) return false;
    return true;
  }).sort((a, b) => b.trackingSpecific.dataValue - a.trackingSpecific.dataValue);
}