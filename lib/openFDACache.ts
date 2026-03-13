/**
 * Open FDA API Cache
 * FDA enforcement reports, recalls, adverse events, and contamination alerts
 * Part of Tier 1 HHS integration - critical for force protection and supply chain security
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
// @ts-ignore - JSON module without type declarations
import militaryInstallationsData from '../data/military-installations.json';
const militaryInstallations = militaryInstallationsData as any[];

// ─── Types & Interfaces ──────────────────────────────────────────────────────

export type OpenFDACategory =
  | 'enforcement'
  | 'drug_adverse_events'
  | 'food_enforcement'
  | 'device_adverse_events'
  | 'drug_labeling'
  | 'food_recalls'
  | 'device_recalls';

export type RecallClassification = 'Class I' | 'Class II' | 'Class III';
export type RecallStatus = 'Ongoing' | 'Completed' | 'Pending' | 'Terminated';

export interface OpenFDARecord extends HHSHealthRecord {
  fdaSpecific: {
    recordType: OpenFDACategory;
    recallNumber?: string;
    recallInitiationDate?: string;
    recallStatus?: RecallStatus;
    recallClassification?: RecallClassification;
    productDescription?: string;
    reasonForRecall?: string;
    firmName?: string;
    distributionPattern?: string;
    productQuantity?: string;
    codeInfo?: string;
    actionTaken?: string;
    voluntaryMandated?: string;
    initialFirmNotification?: string;
    safetyReportId?: string;
    adverseEventCount?: number;
    seriousAdverseEvents?: number;
    contaminationType?: string;
    waterRelated?: boolean;
    supplyChainRisk?: 'low' | 'medium' | 'high' | 'critical';
  };
}

interface OpenFDACacheData {
  records: OpenFDARecord[];
  summary: {
    totalRecords: number;
    categoryCounts: Record<OpenFDACategory, number>;
    recallClassificationCounts: Record<RecallClassification, number>;
    statesCovered: string[];
    waterRelatedIncidents: number;
    criticalSupplyChainAlerts: number;
    dateRange: { earliest: string; latest: string };
    activeRecalls: number;
  };
  correlations: {
    nearMilitaryFacilities: number;
    correlatedWithViolations: number;
    supplyChainRisks: Array<{
      location: string;
      category: OpenFDACategory;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      firmName: string;
      productDescription: string;
      reasonForRecall: string;
    }>;
    contaminationAlerts: Array<{
      location: string;
      contaminationType: string;
      productType: string;
      severity: RecallClassification;
      nearMilitary: boolean;
      alertDate: string;
    }>;
  };
  metadata: {
    lastUpdated: string;
    dataVersion: string;
    apiEndpointsQueried: string[];
    searchCriteria: {
      dateRange: { start: string; end: string };
      categories: OpenFDACategory[];
      geographicScope: string[];
    };
  };
}

// ─── Cache State Management ──────────────────────────────────────────────────

let openFDACache: OpenFDACacheData | null = null;
let lastFetched: string | null = null;
let _buildInProgress = false;
let _buildStartedAt: string | null = null;
let _openFDACacheLoaded = false;
let _lastDelta: CacheDelta | null = null;

const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes
const CACHE_FILE = 'open-fda.json';

// ─── Open FDA API Endpoints Configuration ────────────────────────────────────

export const OPEN_FDA_ENDPOINTS = {
  ENFORCEMENT: {
    url: '/drug/enforcement.json',
    category: 'enforcement' as OpenFDACategory,
    description: 'Drug enforcement reports and recalls',
    priority: 1,
  },
  FOOD_ENFORCEMENT: {
    url: '/food/enforcement.json',
    category: 'food_enforcement' as OpenFDACategory,
    description: 'Food safety enforcement and recalls',
    priority: 1,
  },
  DEVICE_ENFORCEMENT: {
    url: '/device/enforcement.json',
    category: 'device_recalls' as OpenFDACategory,
    description: 'Medical device recalls and safety alerts',
    priority: 1,
  },
  DRUG_ADVERSE_EVENTS: {
    url: '/drug/event.json',
    category: 'drug_adverse_events' as OpenFDACategory,
    description: 'Drug adverse event reports',
    priority: 2,
  },
  DEVICE_ADVERSE_EVENTS: {
    url: '/device/event.json',
    category: 'device_adverse_events' as OpenFDACategory,
    description: 'Medical device adverse event reports',
    priority: 2,
  },
} as const;

// ─── Core Cache Functions ─────────────────────────────────────────────────────

/**
 * Get current Open FDA cache status
 */
export function getOpenFDACacheStatus(): {
  loaded: boolean;
  built: string | null;
  recordCount: number;
  activeRecalls: number;
  buildInProgress: boolean;
  lastDelta: CacheDelta | null;
} {
  return {
    loaded: _openFDACacheLoaded && openFDACache !== null,
    built: lastFetched,
    recordCount: openFDACache?.records?.length || 0,
    activeRecalls: openFDACache?.summary?.activeRecalls || 0,
    buildInProgress: isBuildInProgress(),
    lastDelta: _lastDelta,
  };
}

/**
 * Get Open FDA cache data
 */
export function getOpenFDACache(): OpenFDARecord[] {
  return openFDACache?.records || [];
}

/**
 * Get Open FDA cache with metadata
 */
export function getOpenFDACacheWithMetadata(): OpenFDACacheData | null {
  return openFDACache;
}

/**
 * Update Open FDA cache
 */
export async function setOpenFDACache(data: OpenFDACacheData): Promise<void> {
  if (!data.records || data.records.length === 0) {
    console.warn('No Open FDA data to cache, preserving existing blob');
    return;
  }

  const prevCounts = openFDACache ? { recordCount: openFDACache.summary.totalRecords } : null;
  const newCounts = { recordCount: data.summary.totalRecords };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, lastFetched);

  openFDACache = data;
  lastFetched = new Date().toISOString();
  _openFDACacheLoaded = true;

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
      console.warn('Open FDA build lock expired, auto-clearing');
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
  if (_openFDACacheLoaded) return;

  try {
    // Try disk first
    const diskData = await loadFromDisk();
    if (diskData && diskData.records && diskData.records.length > 0) {
      openFDACache = diskData;
      _openFDACacheLoaded = true;
      return;
    }
  } catch (error) {
    console.warn('Failed to load Open FDA cache from disk:', error);
  }

  try {
    // Fallback to blob
    const blobData = await loadCacheFromBlob<OpenFDACacheData>(CACHE_FILE);
    if (blobData && blobData.records && blobData.records.length > 0) {
      openFDACache = blobData;
      _openFDACacheLoaded = true;
      await saveToDisk(blobData);
    }
  } catch (error) {
    console.warn('Failed to load Open FDA cache from blob:', error);
  }
}

// ─── Disk Persistence ────────────────────────────────────────────────────────

async function loadFromDisk(): Promise<OpenFDACacheData | null> {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', CACHE_FILE);
    if (!fs.existsSync(file)) return null;

    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);

    if (!data?.records || !Array.isArray(data.records)) return null;

    console.log(`[Open FDA Cache] Loaded from disk (${data.records.length} records)`);
    return data;
  } catch (error) {
    console.warn('Failed to load Open FDA cache from disk:', error);
    return null;
  }
}

async function saveToDisk(data: OpenFDACacheData): Promise<void> {
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
    console.log(`[Open FDA Cache] Saved to disk (${data.records.length} records)`);
  } catch (error) {
    console.warn('Failed to save Open FDA cache to disk:', error);
  }
}

// ─── Data Processing Functions ────────────────────────────────────────────────

/**
 * Process and normalize Open FDA data
 */
export function processOpenFDAData(
  rawRecords: any[],
  endpointInfo: { category: OpenFDACategory; url: string }
): OpenFDARecord[] {
  const processedRecords: OpenFDARecord[] = [];

  for (const raw of rawRecords) {
    try {
      // Create base health record
      const healthRecord: HHSHealthRecord = {
        id: `openfda_${endpointInfo.category}_${raw.recall_number || raw.safetyreportid || Date.now()}`,
        source: 'open_fda',
        location: normalizeLocation(extractLocationFromFDARecord(raw, endpointInfo.category)),
        temporal: normalizeTemporal(extractTemporalFromFDARecord(raw, endpointInfo.category)),
        healthMetrics: extractFDAHealthMetrics(raw, endpointInfo.category),
      };

      // Check if water-related
      const waterRelated = isWaterRelated(raw);
      const contaminationType = identifyContaminationType(raw);
      const supplyChainRisk = assessSupplyChainRisk(raw, endpointInfo.category);

      // Create Open FDA specific record
      const fdaRecord: OpenFDARecord = {
        ...healthRecord,
        fdaSpecific: {
          recordType: endpointInfo.category,
          recallNumber: raw.recall_number,
          recallInitiationDate: raw.recall_initiation_date,
          recallStatus: normalizeRecallStatus(raw.status),
          recallClassification: raw.classification as RecallClassification,
          productDescription: raw.product_description || raw.product_type,
          reasonForRecall: raw.reason_for_recall,
          firmName: raw.recalling_firm || raw.primarysource?.qualification,
          distributionPattern: raw.distribution_pattern,
          productQuantity: raw.product_quantity,
          codeInfo: raw.code_info,
          actionTaken: raw.action_taken,
          voluntaryMandated: raw.voluntary_mandated,
          initialFirmNotification: raw.initial_firm_notification,
          safetyReportId: raw.safetyreportid,
          adverseEventCount: parseInt(raw.serious) || 0,
          seriousAdverseEvents: parseInt(raw.seriousnessdeath) || 0,
          contaminationType,
          waterRelated,
          supplyChainRisk,
        },
      };

      // Add military proximity
      const withProximity = addMilitaryProximity(fdaRecord, militaryInstallations);

      processedRecords.push(withProximity as OpenFDARecord);

    } catch (error) {
      console.error('Error processing Open FDA record:', error, { endpoint: endpointInfo.url, record: raw });
    }
  }

  return processedRecords;
}

function extractLocationFromFDARecord(raw: any, category: OpenFDACategory): any {
  const location: any = {};

  // FDA records often have limited location data
  if (raw.state) {
    location.state = raw.state;
  }

  if (raw.city) {
    location.city = raw.city;
  }

  // For enforcement records
  if (category === 'enforcement' || category.includes('enforcement')) {
    if (raw.distribution_pattern) {
      // Parse distribution pattern for geographic info
      const distributionText = raw.distribution_pattern.toLowerCase();

      // Extract state codes from distribution pattern
      const stateMatches = distributionText.match(/\b[A-Z]{2}\b/g);
      if (stateMatches && stateMatches.length === 1) {
        location.state = stateMatches[0];
      }

      // Check for nationwide distribution
      if (distributionText.includes('nationwide') || distributionText.includes('us')) {
        location.nationwide = true;
      }
    }

    if (raw.recalling_firm) {
      location.firmName = raw.recalling_firm;
    }
  }

  // For adverse event records
  if (category.includes('adverse_events')) {
    if (raw.occurcountry) {
      location.country = raw.occurcountry;
    }
    if (raw.primarysource?.reportercountry) {
      location.reporterCountry = raw.primarysource.reportercountry;
    }
  }

  return location;
}

function extractTemporalFromFDARecord(raw: any, category: OpenFDACategory): any {
  const temporal: any = {};

  // Common temporal fields across FDA data types
  if (raw.recall_initiation_date) {
    temporal.reportDate = raw.recall_initiation_date;
    temporal.recallDate = raw.recall_initiation_date;
  }

  if (raw.report_date) {
    temporal.reportDate = raw.report_date;
  }

  if (raw.receivedate) {
    temporal.reportDate = raw.receivedate;
  }

  if (raw.transmissiondate) {
    temporal.effectiveDate = raw.transmissiondate;
  }

  // Extract year from date strings
  const dateStr = temporal.reportDate || temporal.recallDate;
  if (dateStr) {
    const year = new Date(dateStr).getFullYear();
    if (!isNaN(year)) {
      temporal.year = year;
    }
  }

  return temporal;
}

function extractFDAHealthMetrics(raw: any, category: OpenFDACategory): HHSHealthRecord['healthMetrics'] {
  const metrics: HHSHealthRecord['healthMetrics'] = [];

  // Category-specific metric extraction
  switch (category) {
    case 'enforcement':
    case 'food_enforcement':
    case 'device_recalls':
      extractEnforcementMetrics(raw, metrics);
      break;
    case 'drug_adverse_events':
    case 'device_adverse_events':
      extractAdverseEventMetrics(raw, metrics);
      break;
  }

  return metrics;
}

function extractEnforcementMetrics(raw: any, metrics: HHSHealthRecord['healthMetrics']): void {
  // Classification severity scoring
  const classificationScore = getClassificationScore(raw.classification);
  if (classificationScore > 0) {
    metrics.push({
      category: 'enforcement',
      measure: 'recall_severity',
      value: classificationScore,
      unit: 'score',
    });
  }

  // Product quantity affected
  if (raw.product_quantity) {
    const quantityNumber = extractNumberFromText(raw.product_quantity);
    if (quantityNumber > 0) {
      metrics.push({
        category: 'enforcement',
        measure: 'product_quantity',
        value: quantityNumber,
        unit: 'units',
      });
    }
  }

  // Distribution pattern scope
  if (raw.distribution_pattern) {
    const scopeScore = calculateDistributionScope(raw.distribution_pattern);
    metrics.push({
      category: 'enforcement',
      measure: 'distribution_scope',
      value: scopeScore,
      unit: 'score',
    });
  }
}

function extractAdverseEventMetrics(raw: any, metrics: HHSHealthRecord['healthMetrics']): void {
  // Serious adverse events
  if (raw.serious && parseInt(raw.serious) > 0) {
    metrics.push({
      category: 'adverse_event',
      measure: 'serious_events',
      value: parseInt(raw.serious),
      unit: 'count',
    });
  }

  // Death events
  if (raw.seriousnessdeath && parseInt(raw.seriousnessdeath) > 0) {
    metrics.push({
      category: 'adverse_event',
      measure: 'death_events',
      value: parseInt(raw.seriousnessdeath),
      unit: 'count',
    });
  }

  // Hospitalization events
  if (raw.seriousnesshospitalization && parseInt(raw.seriousnesshospitalization) > 0) {
    metrics.push({
      category: 'adverse_event',
      measure: 'hospitalization_events',
      value: parseInt(raw.seriousnesshospitalization),
      unit: 'count',
    });
  }
}

function isWaterRelated(record: any): boolean {
  const waterKeywords = ['water', 'aqua', 'H2O', 'hydration', 'beverage', 'drink', 'contamination', 'bacteria', 'e. coli', 'salmonella', 'listeria'];

  const textFields = [
    record.product_description,
    record.reason_for_recall,
    record.product_type,
    record.indication,
  ].filter(Boolean);

  return textFields.some(text =>
    waterKeywords.some(keyword =>
      text.toLowerCase().includes(keyword.toLowerCase())
    )
  );
}

function identifyContaminationType(record: any): string {
  const contaminationTypes = {
    bacterial: ['bacteria', 'e. coli', 'salmonella', 'listeria', 'campylobacter'],
    chemical: ['chemical', 'pesticide', 'herbicide', 'heavy metal', 'lead', 'mercury'],
    viral: ['virus', 'norovirus', 'hepatitis'],
    physical: ['glass', 'metal', 'plastic', 'foreign object'],
    allergen: ['allergen', 'undeclared', 'milk', 'eggs', 'peanuts', 'tree nuts'],
  };

  const textFields = [
    record.product_description,
    record.reason_for_recall,
  ].filter(Boolean).join(' ').toLowerCase();

  for (const [type, keywords] of Object.entries(contaminationTypes)) {
    if (keywords.some(keyword => textFields.includes(keyword))) {
      return type;
    }
  }

  return 'unknown';
}

function assessSupplyChainRisk(record: any, category: OpenFDACategory): 'low' | 'medium' | 'high' | 'critical' {
  let riskScore = 0;

  // Classification-based risk
  if (record.classification === 'Class I') riskScore += 40;
  else if (record.classification === 'Class II') riskScore += 20;
  else if (record.classification === 'Class III') riskScore += 10;

  // Distribution scope risk
  if (record.distribution_pattern) {
    const pattern = record.distribution_pattern.toLowerCase();
    if (pattern.includes('nationwide')) riskScore += 30;
    else if (pattern.includes('multi-state')) riskScore += 20;
    else if (pattern.includes('state')) riskScore += 10;
  }

  // Product quantity risk
  const quantity = extractNumberFromText(record.product_quantity || '');
  if (quantity > 1000000) riskScore += 20;
  else if (quantity > 100000) riskScore += 15;
  else if (quantity > 10000) riskScore += 10;

  // Water-related products get higher risk for military
  if (isWaterRelated(record)) riskScore += 15;

  // Contamination type risk
  const contaminationType = identifyContaminationType(record);
  if (['bacterial', 'chemical', 'viral'].includes(contaminationType)) riskScore += 15;

  if (riskScore >= 80) return 'critical';
  if (riskScore >= 60) return 'high';
  if (riskScore >= 30) return 'medium';
  return 'low';
}

function getClassificationScore(classification: string): number {
  switch (classification) {
    case 'Class I': return 100;
    case 'Class II': return 60;
    case 'Class III': return 30;
    default: return 0;
  }
}

function calculateDistributionScope(distributionPattern: string): number {
  const pattern = distributionPattern.toLowerCase();
  if (pattern.includes('nationwide')) return 100;
  if (pattern.includes('multi-state')) return 70;
  if (pattern.includes('state')) return 40;
  if (pattern.includes('regional')) return 25;
  return 10;
}

function extractNumberFromText(text: string): number {
  if (!text) return 0;
  const matches = text.match(/\d+(?:,\d+)*/);
  return matches ? parseInt(matches[0].replace(/,/g, '')) : 0;
}

function normalizeRecallStatus(status: string): RecallStatus {
  if (!status) return 'Pending';
  const lowerStatus = status.toLowerCase();
  if (lowerStatus.includes('ongoing')) return 'Ongoing';
  if (lowerStatus.includes('completed')) return 'Completed';
  if (lowerStatus.includes('terminated')) return 'Terminated';
  return 'Pending';
}

// ─── Data Fetching Functions ──────────────────────────────────────────────────

/**
 * Fetch data from Open FDA API for priority endpoints
 */
export async function fetchOpenFDAData(): Promise<{
  endpoint: string;
  category: OpenFDACategory;
  records: any[];
}[]> {
  const openFDAClient = new HHSAPIClient('https://api.fda.gov');
  const allEndpointData: Array<{
    endpoint: string;
    category: OpenFDACategory;
    records: any[];
  }> = [];

  try {
    // Get priority endpoints (enforcement data for immediate value)
    const priorityEndpoints = Object.values(OPEN_FDA_ENDPOINTS)
      .filter(endpoint => endpoint.priority === 1);

    console.log(`Fetching data from ${priorityEndpoints.length} priority Open FDA endpoints...`);

    for (const endpoint of priorityEndpoints) {
      try {
        console.log(`Fetching ${endpoint.description}...`);

        // Build search parameters for efficiency and relevance
        const searchParams: Record<string, string> = {
          'limit': '1000', // FDA API limit
          'skip': '0',
        };

        // Add date filtering for recent data
        const currentDate = new Date();
        const pastYear = new Date(currentDate);
        pastYear.setFullYear(currentDate.getFullYear() - 1);

        if (endpoint.category.includes('enforcement')) {
          // Search for recent recalls and high-priority items
          searchParams['search'] = [
            `recall_initiation_date:[${pastYear.toISOString().split('T')[0]} TO ${currentDate.toISOString().split('T')[0]}]`,
            'AND',
            '(classification:"Class I" OR classification:"Class II")',
          ].join(' ');
        } else if (endpoint.category.includes('adverse_events')) {
          // Search for serious adverse events
          searchParams['search'] = [
            `receivedate:[${pastYear.toISOString().slice(0, 8).replace(/-/g, '')}01 TO ${currentDate.toISOString().slice(0, 8).replace(/-/g, '')}31]`,
            'AND',
            'serious:1',
          ].join(' ');
        }

        const records = await openFDAClient.request(
          `${endpoint.url}?${new URLSearchParams(searchParams)}`,
          {},
          300000 // 5 minute cache
        );

        if (records?.results && Array.isArray(records.results) && records.results.length > 0) {
          allEndpointData.push({
            endpoint: endpoint.url,
            category: endpoint.category,
            records: records.results,
          });
          console.log(`Retrieved ${records.results.length} records from ${endpoint.description}`);
        } else {
          console.warn(`No records found for ${endpoint.description}`);
        }

        // Rate limiting between endpoints
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error) {
        console.error(`Error fetching ${endpoint.description}:`, error);
        // Continue with other endpoints
      }
    }

    console.log(`Successfully fetched data from ${allEndpointData.length} FDA endpoints`);
    return allEndpointData;

  } catch (error) {
    console.error('Failed to fetch Open FDA data:', error);
    return [];
  }
}

/**
 * Build comprehensive Open FDA cache data with analysis
 */
export async function buildOpenFDACacheData(
  endpointResults: Array<{ endpoint: string; category: OpenFDACategory; records: any[] }>,
  waterViolations: Array<{
    id: string;
    lat?: number;
    lng?: number;
    violationDate: string;
    systemId: string;
    violationType?: string;
  }>
): Promise<OpenFDACacheData> {
  const allRecords: OpenFDARecord[] = [];
  const apiEndpointsQueried: string[] = [];

  // Process each endpoint
  for (const endpointResult of endpointResults) {
    const processedRecords = processOpenFDAData(
      endpointResult.records,
      {
        category: endpointResult.category,
        url: endpointResult.endpoint,
      }
    );

    allRecords.push(...processedRecords);
    apiEndpointsQueried.push(endpointResult.endpoint);
  }

  // Add water violation correlations
  const recordsWithCorrelations = correlateWithWaterViolations(allRecords, waterViolations) as OpenFDARecord[];

  // Calculate risk scores
  const recordsWithRiskScores = recordsWithCorrelations.map(record => ({
    ...record,
    riskScore: calculateHealthRiskScore(record),
  }));

  // Build summary and correlation analysis
  const summary = buildOpenFDASummary(recordsWithRiskScores);
  const correlations = buildOpenFDACorrelations(recordsWithRiskScores, waterViolations);

  const currentDate = new Date().toISOString();
  const pastYear = new Date();
  pastYear.setFullYear(pastYear.getFullYear() - 1);

  return {
    records: recordsWithRiskScores,
    summary,
    correlations,
    metadata: {
      lastUpdated: currentDate,
      dataVersion: '2.0',
      apiEndpointsQueried,
      searchCriteria: {
        dateRange: {
          start: pastYear.toISOString(),
          end: currentDate,
        },
        categories: [...new Set(endpointResults.map(e => e.category))],
        geographicScope: PRIORITY_STATES.slice(0, 10),
      },
    },
  };
}

function buildOpenFDASummary(records: OpenFDARecord[]): OpenFDACacheData['summary'] {
  const statesCovered = [...new Set(records.map(r => r.location.state).filter((s): s is string => !!s))];

  // Category counts
  const categoryCounts: Record<OpenFDACategory, number> = {
    enforcement: 0,
    drug_adverse_events: 0,
    food_enforcement: 0,
    device_adverse_events: 0,
    drug_labeling: 0,
    food_recalls: 0,
    device_recalls: 0,
  };

  const recallClassificationCounts: Record<RecallClassification, number> = {
    'Class I': 0,
    'Class II': 0,
    'Class III': 0,
  };

  let waterRelatedIncidents = 0;
  let criticalSupplyChainAlerts = 0;
  let activeRecalls = 0;

  records.forEach(record => {
    categoryCounts[record.fdaSpecific.recordType]++;

    if (record.fdaSpecific.recallClassification) {
      recallClassificationCounts[record.fdaSpecific.recallClassification]++;
    }

    if (record.fdaSpecific.waterRelated) {
      waterRelatedIncidents++;
    }

    if (record.fdaSpecific.supplyChainRisk === 'critical') {
      criticalSupplyChainAlerts++;
    }

    if (record.fdaSpecific.recallStatus === 'Ongoing') {
      activeRecalls++;
    }
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

  return {
    totalRecords: records.length,
    categoryCounts,
    recallClassificationCounts,
    statesCovered,
    waterRelatedIncidents,
    criticalSupplyChainAlerts,
    dateRange,
    activeRecalls,
  };
}

function buildOpenFDACorrelations(
  records: OpenFDARecord[],
  waterViolations: any[]
): OpenFDACacheData['correlations'] {
  const nearMilitaryFacilities = records.filter(r => r.proximityToMilitary?.isNearBase).length;
  const correlatedWithViolations = records.filter(r => r.correlationFlags?.hasWaterViolation).length;

  // Build supply chain risks
  const supplyChainRisks = records
    .filter(r => r.fdaSpecific.supplyChainRisk && ['high', 'critical'].includes(r.fdaSpecific.supplyChainRisk))
    .map(record => ({
      location: `${record.location.county || 'Unknown'}, ${record.location.state || 'Unknown'}`,
      category: record.fdaSpecific.recordType,
      riskLevel: record.fdaSpecific.supplyChainRisk!,
      firmName: record.fdaSpecific.firmName || 'Unknown',
      productDescription: record.fdaSpecific.productDescription || 'Unknown Product',
      reasonForRecall: record.fdaSpecific.reasonForRecall || 'Unknown Reason',
    }))
    .sort((a, b) => {
      const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return (riskOrder[b.riskLevel as keyof typeof riskOrder] || 0) -
             (riskOrder[a.riskLevel as keyof typeof riskOrder] || 0);
    })
    .slice(0, 20);

  // Build contamination alerts
  const contaminationAlerts = records
    .filter(r => r.fdaSpecific.contaminationType && r.fdaSpecific.contaminationType !== 'unknown')
    .map(record => ({
      location: `${record.location.county || record.location.state || 'Unknown'}`,
      contaminationType: record.fdaSpecific.contaminationType || 'Unknown',
      productType: record.fdaSpecific.productDescription || 'Unknown Product',
      severity: record.fdaSpecific.recallClassification || 'Class III' as RecallClassification,
      nearMilitary: record.proximityToMilitary?.isNearBase || false,
      alertDate: record.fdaSpecific.recallInitiationDate || record.temporal.reportDate,
    }))
    .sort((a, b) => {
      const severityOrder = { 'Class I': 3, 'Class II': 2, 'Class III': 1 };
      return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    })
    .slice(0, 25);

  return {
    nearMilitaryFacilities,
    correlatedWithViolations,
    supplyChainRisks,
    contaminationAlerts,
  };
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Get active recalls for specific location or category
 */
export function getActiveRecalls(
  state?: string,
  category?: OpenFDACategory,
  classification?: RecallClassification
): OpenFDARecord[] {
  if (!openFDACache?.records) return [];

  return openFDACache.records.filter(record => {
    if (record.fdaSpecific.recallStatus !== 'Ongoing') return false;
    if (state && record.location.state !== state.toUpperCase()) return false;
    if (category && record.fdaSpecific.recordType !== category) return false;
    if (classification && record.fdaSpecific.recallClassification !== classification) return false;
    return true;
  }).sort((a, b) => {
    // Sort by classification severity and date
    const classOrder = { 'Class I': 3, 'Class II': 2, 'Class III': 1 };
    const aClass = classOrder[a.fdaSpecific.recallClassification as keyof typeof classOrder] || 0;
    const bClass = classOrder[b.fdaSpecific.recallClassification as keyof typeof classOrder] || 0;

    if (aClass !== bClass) return bClass - aClass;

    return new Date(b.temporal.reportDate).getTime() - new Date(a.temporal.reportDate).getTime();
  });
}

/**
 * Get water-related contamination incidents near military installations
 */
export function getWaterRelatedIncidentsNearMilitary(maxDistanceKm = 100): OpenFDARecord[] {
  if (!openFDACache?.records) return [];

  return openFDACache.records.filter(record => {
    return record.fdaSpecific.waterRelated &&
           record.proximityToMilitary?.isNearBase &&
           (record.proximityToMilitary.distanceKm || Infinity) <= maxDistanceKm;
  });
}

/**
 * Get critical supply chain alerts
 */
export function getCriticalSupplyChainAlerts(): OpenFDARecord[] {
  if (!openFDACache?.records) return [];

  return openFDACache.records.filter(record => {
    return record.fdaSpecific.supplyChainRisk === 'critical' ||
           record.fdaSpecific.recallClassification === 'Class I';
  }).sort((a, b) =>
    new Date(b.temporal.reportDate).getTime() - new Date(a.temporal.reportDate).getTime()
  );
}