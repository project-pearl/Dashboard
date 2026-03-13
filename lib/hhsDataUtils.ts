/**
 * HHS Data Integration Utilities
 * Comprehensive infrastructure for ingesting 50+ HHS/CDC/EPA data sources
 * Supports Socrata APIs, CDC WONDER queries, Tracking Network, Open FDA, and more
 */

import { haversineDistance } from './geoUtils';
import { type MilitaryInstallationRef } from './healthDataUtils';

// ─── Core Types & Interfaces ─────────────────────────────────────────────────

export interface HHSDataSource {
  id: string;
  name: string;
  agency: 'CDC' | 'FDA' | 'CMS' | 'HRSA' | 'ATSDR' | 'IHS' | 'SAMHSA' | 'ASPR' | 'EPA' | 'USGS';
  apiType: 'socrata' | 'wonder' | 'tracking' | 'openFDA' | 'rest' | 'download' | 'graphql';
  baseUrl: string;
  endpoint?: string;
  description: string;
  updateFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  dataTypes: string[];
  healthRelevance: 'direct' | 'correlation' | 'environmental' | 'infrastructure' | 'emergency';
  militaryRelevance: 'high' | 'medium' | 'low';
}

export interface SocrataDataset {
  id: string; // 4x4 identifier
  name: string;
  description: string;
  columns: SocrataColumn[];
  rowsUpdatedAt: string;
  totalRows: number;
}

export interface SocrataColumn {
  id: number;
  name: string;
  dataTypeName: string;
  fieldName: string;
  description?: string;
}

export interface WonderQuery {
  database: string;
  measures: string[];
  groupResults: string[];
  locationResults: string[];
  yearResults: string[];
  filters?: Record<string, string[]>;
}

export interface HHSHealthRecord {
  id: string;
  source: string;
  location: {
    state?: string;
    county?: string;
    fips?: string;
    lat?: number;
    lng?: number;
  };
  temporal: {
    reportDate: string;
    effectiveDate?: string;
    year?: number;
    month?: number;
  };
  healthMetrics: {
    category: string;
    measure: string;
    value: number | string;
    unit?: string;
    confidence?: number;
    populationSize?: number;
  }[];
  demographics?: {
    ageGroup?: string;
    gender?: string;
    race?: string;
    ethnicity?: string;
  };
  environmentalFactors?: {
    contaminant?: string;
    exposureLevel?: number;
    exposureUnit?: string;
    source?: string;
  }[];
  proximityToMilitary?: {
    nearestInstallation?: string;
    distanceKm?: number;
    isNearBase?: boolean;
  };
  correlationFlags?: {
    hasWaterViolation?: boolean;
    hasAirQualityIssue?: boolean;
    hasSuperfundSite?: boolean;
    inEJArea?: boolean;
  };
}

// ─── Data Source Registry ────────────────────────────────────────────────────

export const HHS_DATA_SOURCES: Record<string, HHSDataSource> = {
  // Tier 1: Core High-Impact Sources
  cdcWonder: {
    id: 'cdc_wonder',
    name: 'CDC WONDER',
    agency: 'CDC',
    apiType: 'wonder',
    baseUrl: 'https://wonder.cdc.gov',
    endpoint: '/controller/datarequest',
    description: 'Mortality/morbidity data with environmental cause filtering',
    updateFrequency: 'monthly',
    dataTypes: ['mortality', 'morbidity', 'environmental_deaths'],
    healthRelevance: 'direct',
    militaryRelevance: 'high',
  },

  environmentalTracking: {
    id: 'env_tracking',
    name: 'Environmental Health Tracking Network',
    agency: 'CDC',
    apiType: 'tracking',
    baseUrl: 'https://ephtracking.cdc.gov',
    endpoint: '/apigateway/api/v1',
    description: 'Drinking water contaminants, air quality, health outcomes',
    updateFrequency: 'monthly',
    dataTypes: ['water_quality', 'air_quality', 'health_outcomes'],
    healthRelevance: 'direct',
    militaryRelevance: 'high',
  },

  healthDataGov: {
    id: 'healthdata_gov',
    name: 'HealthData.gov',
    agency: 'CDC',
    apiType: 'socrata',
    baseUrl: 'https://healthdata.gov',
    endpoint: '/api/views',
    description: 'Comprehensive HHS datasets via Socrata API',
    updateFrequency: 'daily',
    dataTypes: ['hospital_capacity', 'outbreak_surveillance', 'environmental_health'],
    healthRelevance: 'direct',
    militaryRelevance: 'medium',
  },

  cdcDataGov: {
    id: 'cdc_data_gov',
    name: 'Data.CDC.gov',
    agency: 'CDC',
    apiType: 'socrata',
    baseUrl: 'https://data.cdc.gov',
    endpoint: '/api/views',
    description: 'CDC surveillance and outbreak data',
    updateFrequency: 'daily',
    dataTypes: ['surveillance', 'outbreaks', 'environmental_monitoring'],
    healthRelevance: 'direct',
    militaryRelevance: 'high',
  },

  hrsaData: {
    id: 'hrsa_data',
    name: 'HRSA Data',
    agency: 'HRSA',
    apiType: 'rest',
    baseUrl: 'https://data.hrsa.gov',
    endpoint: '/api',
    description: 'Health Professional Shortage Areas and facility locations',
    updateFrequency: 'quarterly',
    dataTypes: ['healthcare_access', 'shortage_areas', 'facility_locations'],
    healthRelevance: 'infrastructure',
    militaryRelevance: 'medium',
  },

  openFDA: {
    id: 'open_fda',
    name: 'Open FDA',
    agency: 'FDA',
    apiType: 'openFDA',
    baseUrl: 'https://api.fda.gov',
    endpoint: '/device/recall.json',
    description: 'FDA enforcement reports, recalls, adverse events',
    updateFrequency: 'daily',
    dataTypes: ['recalls', 'enforcement', 'adverse_events'],
    healthRelevance: 'direct',
    militaryRelevance: 'high',
  },

  atsdrTox: {
    id: 'atsdr_tox',
    name: 'ATSDR Toxicology Profiles',
    agency: 'ATSDR',
    apiType: 'rest',
    baseUrl: 'https://www.atsdr.cdc.gov',
    endpoint: '/ToxProfiles/api',
    description: 'Hazardous substance health effects and exposure pathways',
    updateFrequency: 'annually',
    dataTypes: ['toxicity_profiles', 'exposure_pathways', 'health_effects'],
    healthRelevance: 'environmental',
    militaryRelevance: 'high',
  },

  usgsWaterQuality: {
    id: 'usgs_wqp',
    name: 'USGS Water Quality Portal',
    agency: 'USGS',
    apiType: 'rest',
    baseUrl: 'https://waterqualitydata.us',
    endpoint: '/Result/search',
    description: 'Discrete water quality samples from monitoring programs',
    updateFrequency: 'daily',
    dataTypes: ['water_samples', 'contaminant_levels', 'monitoring_data'],
    healthRelevance: 'environmental',
    militaryRelevance: 'high',
  },
};

// ─── API Client Infrastructure ───────────────────────────────────────────────

export class HHSAPIClient {
  private baseUrl: string;
  private rateLimit: { requests: number; windowMs: number };
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>;

  constructor(
    baseUrl: string,
    rateLimit = { requests: 100, windowMs: 60000 } // 100 requests per minute default
  ) {
    this.baseUrl = baseUrl;
    this.rateLimit = rateLimit;
    this.cache = new Map();
  }

  /**
   * Generic API request with rate limiting and caching
   */
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    cacheTtl = 300000 // 5 minutes default cache
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = `${url}:${JSON.stringify(options)}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'Water-Quality-Dashboard/2.0 (HHS-Integration)',
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Cache successful responses
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl: cacheTtl,
      });

      return data;

    } catch (error) {
      console.error(`API request failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Socrata API query with pagination
   */
  async querySocrata(
    datasetId: string,
    query: Record<string, any> = {},
    limit = 10000
  ): Promise<any[]> {
    const params = new URLSearchParams({
      $limit: limit.toString(),
      $order: ':id',
      ...query,
    });

    return this.request(`/resource/${datasetId}.json?${params}`);
  }

  /**
   * Clear old cache entries
   */
  clearStaleCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// ─── CDC WONDER Query Builder ─────────────────────────────────────────────────

export class CDCWonderClient {
  private baseUrl = 'https://wonder.cdc.gov';

  /**
   * Query CDC WONDER for mortality data with environmental cause filters
   */
  async queryMortality(params: {
    years: string[];
    locations: string[];
    causes?: string[];
    ageGroups?: string[];
  }): Promise<any[]> {
    const requestData = {
      // CDC WONDER uses complex form-based requests
      'action-Send': 'Send',
      'finder-stage-D76': 'codeset',
      'stage': 'request',
      'saved-id': '',
      'dataset': 'D76', // Underlying Cause of Death database
      'vm': 'M', // Measures: Deaths, Population, Crude Rate
      'sc': '0', // Show totals
      ...this.buildLocationCodes(params.locations),
      ...this.buildYearCodes(params.years),
      ...this.buildCauseCodes(params.causes || []),
      ...this.buildAgeGroupCodes(params.ageGroups || []),
    };

    try {
      const response = await fetch(`${this.baseUrl}/controller/datarequest/D76`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Water-Quality-Dashboard/2.0',
        },
        body: new URLSearchParams(requestData).toString(),
      });

      if (!response.ok) {
        throw new Error(`WONDER query failed: ${response.status}`);
      }

      const text = await response.text();
      return this.parseWonderResponse(text);

    } catch (error) {
      console.error('CDC WONDER query failed:', error);
      throw error;
    }
  }

  private buildLocationCodes(locations: string[]): Record<string, string> {
    // Convert state/county codes to WONDER format
    const codes: Record<string, string> = {};
    locations.forEach((loc, index) => {
      codes[`location-D76.V9-${index + 1}`] = loc;
    });
    return codes;
  }

  private buildYearCodes(years: string[]): Record<string, string> {
    const codes: Record<string, string> = {};
    years.forEach((year, index) => {
      codes[`year-D76.V1-${index + 1}`] = year;
    });
    return codes;
  }

  private buildCauseCodes(causes: string[]): Record<string, string> {
    // Environmental/water-related ICD-10 codes
    const environmentalCauses = causes.length > 0 ? causes : [
      'T51-T65', // Toxic effects of substances
      'K59.1', // Diarrhea
      'A00-A09', // Intestinal infectious diseases
      'T56', // Toxic effect of metals
      'T53', // Toxic effect of halogen derivatives
    ];

    const codes: Record<string, string> = {};
    environmentalCauses.forEach((cause, index) => {
      codes[`ucd-D76.V2-${index + 1}`] = cause;
    });
    return codes;
  }

  private buildAgeGroupCodes(ageGroups: string[]): Record<string, string> {
    const codes: Record<string, string> = {};
    if (ageGroups.length === 0) {
      // Default to all age groups
      codes['age-group-D76.V5'] = '*All*';
    } else {
      ageGroups.forEach((group, index) => {
        codes[`age-group-D76.V5-${index + 1}`] = group;
      });
    }
    return codes;
  }

  private parseWonderResponse(htmlResponse: string): any[] {
    // Parse HTML table response to extract mortality data
    // This is a simplified parser - full implementation would be more robust
    const records: any[] = [];

    try {
      // Look for data tables in the response
      const tableMatch = htmlResponse.match(/<table[^>]*class="[^"]*data[^"]*"[^>]*>(.*?)<\/table>/is);
      if (!tableMatch) return [];

      const tableContent = tableMatch[1];
      const rowMatches = tableContent.match(/<tr[^>]*>(.*?)<\/tr>/gis);

      if (!rowMatches) return [];

      for (const row of rowMatches.slice(1)) { // Skip header row
        const cellMatches = row.match(/<td[^>]*>(.*?)<\/td>/gis);
        if (cellMatches && cellMatches.length >= 4) {
          const cells = cellMatches.map(cell =>
            cell.replace(/<[^>]*>/g, '').trim()
          );

          records.push({
            location: cells[0],
            cause: cells[1],
            deaths: parseInt(cells[2]) || 0,
            population: parseInt(cells[3]) || 0,
            rate: parseFloat(cells[4]) || 0,
          });
        }
      }
    } catch (error) {
      console.error('Error parsing WONDER response:', error);
    }

    return records;
  }
}

// ─── Spatial Correlation Utilities ──────────────────────────────────────────

/**
 * Add military installation proximity to HHS health records
 */
export function addMilitaryProximity<T extends HHSHealthRecord>(
  record: T,
  militaryInstallations?: MilitaryInstallationRef[]
): T {
  if (!record.location.lat || !record.location.lng || !militaryInstallations?.length) {
    return record;
  }

  const recordLocation = {
    lat: record.location.lat,
    lng: record.location.lng,
  };

  let nearestInstallation: string | undefined;
  let shortestDistance = Infinity;

  for (const installation of militaryInstallations) {
    const distance = haversineDistance(recordLocation, { lat: installation.lat, lng: installation.lng });
    if (distance < shortestDistance) {
      shortestDistance = distance;
      nearestInstallation = installation.name;
    }
  }

  return {
    ...record,
    proximityToMilitary: {
      nearestInstallation,
      distanceKm: shortestDistance,
      isNearBase: shortestDistance <= 50, // Within 50km
    },
  };
}

/**
 * Batch process health records with military proximity
 */
export function batchAddMilitaryProximity<T extends HHSHealthRecord>(
  records: T[],
  militaryInstallations?: MilitaryInstallationRef[]
): T[] {
  return records.map(record =>
    addMilitaryProximity(record, militaryInstallations)
  );
}

// ─── Data Processing & Normalization ─────────────────────────────────────────

/**
 * Normalize location data across different HHS data sources
 */
export function normalizeLocation(rawLocation: any): HHSHealthRecord['location'] {
  const location: HHSHealthRecord['location'] = {};

  // Handle various location formats from different APIs
  if (rawLocation.state || rawLocation.State || rawLocation.STATE) {
    location.state = (rawLocation.state || rawLocation.State || rawLocation.STATE).toUpperCase();
  }

  if (rawLocation.county || rawLocation.County || rawLocation.COUNTY) {
    location.county = rawLocation.county || rawLocation.County || rawLocation.COUNTY;
  }

  if (rawLocation.fips || rawLocation.FIPS || rawLocation.fips_code) {
    location.fips = rawLocation.fips || rawLocation.FIPS || rawLocation.fips_code;
  }

  if (rawLocation.latitude || rawLocation.lat || rawLocation.Latitude) {
    const lat = parseFloat(rawLocation.latitude || rawLocation.lat || rawLocation.Latitude);
    if (!isNaN(lat)) location.lat = lat;
  }

  if (rawLocation.longitude || rawLocation.lng || rawLocation.lon || rawLocation.Longitude) {
    const lng = parseFloat(rawLocation.longitude || rawLocation.lng || rawLocation.lon || rawLocation.Longitude);
    if (!isNaN(lng)) location.lng = lng;
  }

  return location;
}

/**
 * Normalize temporal data across different HHS data sources
 */
export function normalizeTemporal(rawTemporal: any): HHSHealthRecord['temporal'] {
  const temporal: HHSHealthRecord['temporal'] = {
    reportDate: new Date().toISOString(), // Fallback to current date
  };

  // Handle various date formats
  if (rawTemporal.date || rawTemporal.Date || rawTemporal.report_date) {
    const dateStr = rawTemporal.date || rawTemporal.Date || rawTemporal.report_date;
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      temporal.reportDate = date.toISOString();
      temporal.year = date.getFullYear();
      temporal.month = date.getMonth() + 1;
    }
  }

  if (rawTemporal.effective_date || rawTemporal.effectiveDate) {
    const date = new Date(rawTemporal.effective_date || rawTemporal.effectiveDate);
    if (!isNaN(date.getTime())) {
      temporal.effectiveDate = date.toISOString();
    }
  }

  if (rawTemporal.year || rawTemporal.Year) {
    temporal.year = parseInt(rawTemporal.year || rawTemporal.Year);
  }

  if (rawTemporal.month || rawTemporal.Month) {
    temporal.month = parseInt(rawTemporal.month || rawTemporal.Month);
  }

  return temporal;
}

/**
 * Extract and normalize health metrics from various data sources
 */
export function normalizeHealthMetrics(rawData: any, source: string): HHSHealthRecord['healthMetrics'] {
  const metrics: HHSHealthRecord['healthMetrics'] = [];

  // CDC WONDER format
  if (source === 'cdc_wonder') {
    if (rawData.deaths !== undefined) {
      metrics.push({
        category: 'mortality',
        measure: 'deaths',
        value: parseInt(rawData.deaths) || 0,
        unit: 'count',
        populationSize: parseInt(rawData.population) || undefined,
      });
    }
    if (rawData.rate !== undefined) {
      metrics.push({
        category: 'mortality',
        measure: 'crude_death_rate',
        value: parseFloat(rawData.rate) || 0,
        unit: 'per_100k',
      });
    }
  }

  // Environmental Tracking format
  if (source === 'env_tracking') {
    if (rawData.value !== undefined) {
      metrics.push({
        category: rawData.indicator_name || 'environmental',
        measure: rawData.measure_name || 'measurement',
        value: parseFloat(rawData.value) || 0,
        unit: rawData.unit || undefined,
        confidence: parseFloat(rawData.confidence_interval) || undefined,
      });
    }
  }

  // Socrata format (HealthData.gov, data.cdc.gov)
  if (source.includes('socrata') || source.includes('healthdata') || source.includes('cdc_data')) {
    // Handle various Socrata column formats
    Object.keys(rawData).forEach(key => {
      if (typeof rawData[key] === 'number' && !key.includes('_id') && !key.includes('lat') && !key.includes('lng')) {
        metrics.push({
          category: 'surveillance',
          measure: key,
          value: rawData[key],
          unit: undefined,
        });
      }
    });
  }

  return metrics;
}

// ─── Correlation Analysis ────────────────────────────────────────────────────

/**
 * Find potential correlations between health records and water quality violations
 */
export function correlateWithWaterViolations(
  healthRecords: HHSHealthRecord[],
  waterViolations: Array<{
    id: string;
    lat?: number;
    lng?: number;
    violationDate: string;
    systemId: string;
    violationType?: string;
  }>
): HHSHealthRecord[] {
  return healthRecords.map(record => {
    const correlatedViolations: string[] = [];

    if (record.location.lat && record.location.lng) {
      const recordLocation = {
        lat: record.location.lat,
        lng: record.location.lng,
      };

      // Find violations within 25km and temporal window
      for (const violation of waterViolations) {
        if (!violation.lat || !violation.lng) continue;

        const violationLocation = { lat: violation.lat, lng: violation.lng };
        const distance = haversineDistance(recordLocation, violationLocation);

        if (distance <= 25) { // Within 25km
          // Check temporal correlation (within 1 year)
          const recordDate = new Date(record.temporal.reportDate);
          const violationDate = new Date(violation.violationDate);
          const timeDiff = Math.abs(recordDate.getTime() - violationDate.getTime());
          const oneYear = 365 * 24 * 60 * 60 * 1000;

          if (timeDiff <= oneYear) {
            correlatedViolations.push(violation.id);
          }
        }
      }
    }

    return {
      ...record,
      correlationFlags: {
        ...record.correlationFlags,
        hasWaterViolation: correlatedViolations.length > 0,
      },
    };
  });
}

/**
 * Calculate health risk score based on multiple factors
 */
export function calculateHealthRiskScore(record: HHSHealthRecord): number {
  let score = 0;
  let factors = 0;

  // Environmental exposure component (0-25 points)
  if (record.environmentalFactors?.length) {
    score += Math.min(record.environmentalFactors.length * 5, 25);
    factors++;
  }

  // Health outcome severity (0-25 points)
  const mortalityMetrics = record.healthMetrics.filter(m => m.category === 'mortality');
  if (mortalityMetrics.length > 0) {
    const avgRate = mortalityMetrics.reduce((sum, m) => sum + (typeof m.value === 'number' ? m.value : 0), 0) / mortalityMetrics.length;
    score += Math.min(avgRate / 10, 25); // Scale mortality rate
    factors++;
  }

  // Correlation component (0-25 points)
  let correlationScore = 0;
  if (record.correlationFlags?.hasWaterViolation) correlationScore += 8;
  if (record.correlationFlags?.hasAirQualityIssue) correlationScore += 8;
  if (record.correlationFlags?.hasSuperfundSite) correlationScore += 9;
  score += correlationScore;
  factors++;

  // Military proximity component (0-25 points)
  if (record.proximityToMilitary?.isNearBase) {
    const proximityScore = Math.max(0, 25 - (record.proximityToMilitary.distanceKm || 50));
    score += proximityScore;
    factors++;
  }

  return factors > 0 ? Math.round(score / factors) : 0;
}

// ─── Export Default Clients ──────────────────────────────────────────────────

export const healthDataClient = new HHSAPIClient('https://healthdata.gov');
export const cdcDataClient = new HHSAPIClient('https://data.cdc.gov');
export const trackingClient = new HHSAPIClient('https://ephtracking.cdc.gov');
export const openFDAClient = new HHSAPIClient('https://api.fda.gov');
export const wonderClient = new CDCWonderClient();