/**
 * SAMHSA (Substance Abuse and Mental Health Services Administration) Cache
 * Mental health and substance use disorder surveillance and treatment data
 * Part of Tier 2 HHS integration - critical for behavioral health correlations
 */

import { HHSAPIClient, type HHSHealthRecord, addMilitaryProximity, correlateWithWaterViolations } from './hhsDataUtils';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta, gridKey } from './cacheUtils';

export type SAMHSADataType = 'treatment_facilities' | 'admissions_data' | 'outcomes_data' | 'prevention_programs' | 'surveillance_data';
export type SubstanceCategory = 'alcohol' | 'opioids' | 'stimulants' | 'cannabis' | 'tobacco' | 'prescription_drugs' | 'illicit_drugs';
export type TreatmentType = 'outpatient' | 'inpatient' | 'residential' | 'detox' | 'medication_assisted' | 'behavioral_therapy';

export interface SAMHSARecord extends HHSHealthRecord {
  samhsaSpecific: {
    facilityId?: string;
    facilityName?: string;
    dataType: SAMHSADataType;
    treatmentType?: TreatmentType;
    substanceCategories: SubstanceCategory[];
    admissionCount?: number;
    completionRate?: number;
    demographics: {
      ageGroups: Record<string, number>;
      gender: Record<string, number>;
      ethnicity: Record<string, number>;
      militaryStatus?: Record<string, number>;
    };
    facilityCapacity?: number;
    acceptsInsurance: boolean;
    acceptsMedicaid: boolean;
    acceptsMedicare: boolean;
    acceptsCash: boolean;
    militaryFriendly: boolean;
    veteranSpecialized: boolean;
    traumaInformed: boolean;
    environmentalCorrelations: {
      nearWaterViolations: boolean;
      nearSuperfundSites: boolean;
      airQualityIssues: boolean;
    };
    geospatialFactors: {
      ruralUrbanCode: string;
      povertyLevel: 'low' | 'medium' | 'high' | 'very_high';
      accessibilityScore: number;
    };
    reportingPeriod: string;
    lastUpdated: string;
  };
}

interface SAMHSACacheData {
  records: SAMHSARecord[];
  spatialIndex: Record<string, SAMHSARecord[]>;
  summary: {
    totalFacilities: number;
    totalAdmissions: number;
    dataTypeDistribution: Record<SAMHSADataType, number>;
    treatmentTypeDistribution: Record<TreatmentType, number>;
    substanceDistribution: Record<SubstanceCategory, number>;
    militaryFriendlyFacilities: number;
    veteranSpecializedFacilities: number;
    traumaInformedFacilities: number;
    averageCompletionRate: number;
    stateDistribution: Record<string, number>;
    environmentalCorrelations: {
      facilitiesNearWaterViolations: number;
      facilitiesNearSuperfundSites: number;
      facilitiesWithAirQualityIssues: number;
    };
  };
  correlations: {
    militaryInstallationProximity: any[];
    environmentalHealthCorrelations: any[];
    accessibilityGaps: any[];
    demographicDisparities: any[];
  };
  metadata: { lastUpdated: string; dataVersion: string; };
}

let samhsaCache: SAMHSACacheData | null = null;
let lastFetched: string | null = null;
let _buildInProgress = false;
let _buildStartedAt: string | null = null;
let _samhsaCacheLoaded = false;
let _lastDelta: CacheDelta | null = null;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
const CACHE_FILE = 'samhsa.json';

export function getSAMHSACacheStatus() {
  return {
    loaded: _samhsaCacheLoaded && samhsaCache !== null,
    built: lastFetched,
    recordCount: samhsaCache?.records?.length || 0,
    militaryFriendlyFacilities: samhsaCache?.summary?.militaryFriendlyFacilities || 0,
    buildInProgress: isBuildInProgress(),
    lastDelta: _lastDelta,
  };
}

export function getSAMHSACache(): SAMHSARecord[] { return samhsaCache?.records || []; }

export async function setSAMHSACache(data: SAMHSACacheData): Promise<void> {
  if (!data.records?.length) { console.warn('No SAMHSA data to cache'); return; }
  const prevCounts = samhsaCache ? { recordCount: samhsaCache.summary.totalFacilities } : null;
  _lastDelta = computeCacheDelta(prevCounts, { recordCount: data.summary.totalFacilities }, lastFetched);
  samhsaCache = data; lastFetched = new Date().toISOString(); _samhsaCacheLoaded = true;
  await saveToDisk(data); await saveCacheToBlob(CACHE_FILE, data);
}

export function setBuildInProgress(inProgress: boolean): void { _buildInProgress = inProgress; _buildStartedAt = inProgress ? new Date().toISOString() : null; }
export function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;
  if (_buildStartedAt && Date.now() - new Date(_buildStartedAt).getTime() > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('SAMHSA build lock expired'); _buildInProgress = false; _buildStartedAt = null; return false;
  }
  return _buildInProgress;
}

export async function ensureWarmed(): Promise<void> {
  if (_samhsaCacheLoaded) return;
  try {
    const diskData = await loadFromDisk();
    if (diskData?.records?.length) { samhsaCache = diskData; _samhsaCacheLoaded = true; return; }
  } catch (e) { console.warn('SAMHSA disk load failed:', e); }
  try {
    const blobData = await loadCacheFromBlob<SAMHSACacheData>(CACHE_FILE);
    if (blobData?.records?.length) { samhsaCache = blobData; _samhsaCacheLoaded = true; await saveToDisk(blobData); }
  } catch (e) { console.warn('SAMHSA blob load failed:', e); }
}

async function loadFromDisk(): Promise<SAMHSACacheData | null> {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs'); const path = require('path');
    const file = path.join(process.cwd(), '.cache', CACHE_FILE);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!data?.records) return null;
    console.log(`[SAMHSA Cache] Loaded from disk (${data.records.length} records)`);
    return data;
  } catch (e) { return null; }
}

async function saveToDisk(data: SAMHSACacheData): Promise<void> {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs'); const path = require('path');
    const cacheDir = path.join(process.cwd(), '.cache'); const file = path.join(cacheDir, CACHE_FILE);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
    console.log(`[SAMHSA Cache] Saved to disk (${data.records.length} records)`);
  } catch (e) { console.warn('SAMHSA disk save failed:', e); }
}

export function processSAMHSAData(rawRecords: any[]): SAMHSARecord[] {
  return rawRecords.map(raw => ({
    id: `samhsa_${raw.facility_id || raw.id || Date.now()}`,
    source: 'samhsa',
    location: {
      lat: parseFloat(raw.latitude || raw.lat || 0),
      lng: parseFloat(raw.longitude || raw.lng || 0),
      state: raw.state || raw.state_abbr || 'Unknown',
      county: raw.county || raw.county_name,
      city: raw.city || raw.facility_city,
    },
    temporal: {
      reportDate: raw.reporting_period || raw.last_updated || new Date().toISOString(),
      year: parseInt(raw.year || new Date().getFullYear().toString()),
    },
    healthMetrics: [{
      category: 'behavioral_health',
      measure: raw.primary_measure || 'facility_capacity',
      value: parseFloat(raw.capacity || raw.admissions || raw.value || 0),
      unit: raw.unit || 'count',
    }],
    samhsaSpecific: {
      facilityId: raw.facility_id || raw.id,
      facilityName: raw.facility_name || raw.name || 'Unknown Facility',
      dataType: determineSAMHSADataType(raw.data_type, raw.facility_type),
      treatmentType: determineTreatmentType(raw.treatment_type, raw.services),
      substanceCategories: parseSubstanceCategories(raw.substances, raw.primary_focus),
      admissionCount: parseInt(raw.admissions || raw.admission_count) || undefined,
      completionRate: parseFloat(raw.completion_rate) || undefined,
      demographics: {
        ageGroups: parseDemographics(raw.age_groups || raw.demographics?.age),
        gender: parseDemographics(raw.gender_distribution || raw.demographics?.gender),
        ethnicity: parseDemographics(raw.ethnicity_distribution || raw.demographics?.ethnicity),
        militaryStatus: parseDemographics(raw.military_status || raw.demographics?.military),
      },
      facilityCapacity: parseInt(raw.capacity || raw.facility_capacity) || undefined,
      acceptsInsurance: parseBoolean(raw.accepts_insurance || raw.insurance_accepted),
      acceptsMedicaid: parseBoolean(raw.accepts_medicaid || raw.medicaid),
      acceptsMedicare: parseBoolean(raw.accepts_medicare || raw.medicare),
      acceptsCash: parseBoolean(raw.accepts_cash || raw.cash_payment),
      militaryFriendly: isMilitaryFriendly(raw.military_friendly, raw.veteran_services, raw.services),
      veteranSpecialized: isVeteranSpecialized(raw.veteran_specialized, raw.veteran_services),
      traumaInformed: parseBoolean(raw.trauma_informed || raw.trauma_services),
      environmentalCorrelations: {
        nearWaterViolations: false, // Will be populated during correlation
        nearSuperfundSites: false,
        airQualityIssues: false,
      },
      geospatialFactors: {
        ruralUrbanCode: raw.rural_urban_code || raw.ruca_code || 'unknown',
        povertyLevel: categorizePovertyLevel(raw.poverty_rate),
        accessibilityScore: calculateAccessibilityScore(raw.location, raw.transportation),
      },
      reportingPeriod: raw.reporting_period || raw.year || 'unknown',
      lastUpdated: raw.last_updated || new Date().toISOString(),
    }
  }));
}

function determineSAMHSADataType(dataType: string, facilityType: string): SAMHSADataType {
  const type = (dataType || facilityType || '').toLowerCase();
  if (type.includes('treatment') || type.includes('facility')) return 'treatment_facilities';
  if (type.includes('admission') || type.includes('intake')) return 'admissions_data';
  if (type.includes('outcome') || type.includes('completion')) return 'outcomes_data';
  if (type.includes('prevention') || type.includes('education')) return 'prevention_programs';
  return 'surveillance_data';
}

function determineTreatmentType(treatmentType: string, services: string): TreatmentType {
  const combined = `${treatmentType || ''} ${services || ''}`.toLowerCase();
  if (combined.includes('inpatient') || combined.includes('residential')) return 'residential';
  if (combined.includes('detox') || combined.includes('withdrawal')) return 'detox';
  if (combined.includes('medication') || combined.includes('mat') || combined.includes('opioid')) return 'medication_assisted';
  if (combined.includes('therapy') || combined.includes('counseling') || combined.includes('behavioral')) return 'behavioral_therapy';
  if (combined.includes('outpatient')) return 'outpatient';
  return 'outpatient';
}

function parseSubstanceCategories(substances: string, primaryFocus: string): SubstanceCategory[] {
  const combined = `${substances || ''} ${primaryFocus || ''}`.toLowerCase();
  const categories: SubstanceCategory[] = [];

  if (combined.includes('alcohol')) categories.push('alcohol');
  if (combined.includes('opioid') || combined.includes('heroin') || combined.includes('fentanyl')) categories.push('opioids');
  if (combined.includes('stimulant') || combined.includes('cocaine') || combined.includes('meth')) categories.push('stimulants');
  if (combined.includes('cannabis') || combined.includes('marijuana')) categories.push('cannabis');
  if (combined.includes('tobacco') || combined.includes('nicotine')) categories.push('tobacco');
  if (combined.includes('prescription') || combined.includes('pharmaceutical')) categories.push('prescription_drugs');
  if (combined.includes('illicit') || combined.includes('street')) categories.push('illicit_drugs');

  return categories.length > 0 ? categories : ['alcohol']; // Default fallback
}

function parseDemographics(data: any): Record<string, number> {
  if (typeof data === 'object' && data !== null) return data;
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return {}; }
  }
  return {};
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', 'yes', '1', 'y'].includes(value.toLowerCase());
  return false;
}

function isMilitaryFriendly(militaryFriendly: any, veteranServices: any, services: any): boolean {
  if (parseBoolean(militaryFriendly)) return true;
  if (parseBoolean(veteranServices)) return true;
  const servicesText = (services || '').toLowerCase();
  return servicesText.includes('military') || servicesText.includes('veteran') || servicesText.includes('ptsd');
}

function isVeteranSpecialized(veteranSpecialized: any, veteranServices: any): boolean {
  return parseBoolean(veteranSpecialized) || parseBoolean(veteranServices);
}

function categorizePovertyLevel(povertyRate: any): 'low' | 'medium' | 'high' | 'very_high' {
  const rate = parseFloat(povertyRate || 0);
  if (rate > 25) return 'very_high';
  if (rate > 15) return 'high';
  if (rate > 8) return 'medium';
  return 'low';
}

function calculateAccessibilityScore(location: any, transportation: any): number {
  // Simple accessibility scoring based on available data
  let score = 50; // Base score

  if (location?.urban) score += 20;
  if (transportation?.public_transit) score += 15;
  if (transportation?.accessible) score += 10;

  return Math.min(score, 100);
}

export async function fetchSAMHSAData(): Promise<any[]> {
  // Mock SAMHSA data - in practice would fetch from SAMHSA Locator API and TEDS data
  const mockFacilities = [
    { facility_id: '1', facility_name: 'Metro Addiction Recovery Center', latitude: 38.9047, longitude: -77.0164, state: 'DC', city: 'Washington', treatment_type: 'outpatient', substances: 'alcohol,opioids', capacity: 150, accepts_medicaid: true, military_friendly: true, veteran_services: true, completion_rate: 0.72 },
    { facility_id: '2', facility_name: 'Coastal Mental Health Services', latitude: 36.8508, longitude: -75.9776, state: 'VA', city: 'Norfolk', treatment_type: 'residential', substances: 'alcohol,stimulants', capacity: 80, accepts_medicare: true, trauma_informed: true, completion_rate: 0.85 },
    { facility_id: '3', facility_name: 'Mountain View Treatment Facility', latitude: 39.2904, longitude: -76.6122, state: 'MD', city: 'Baltimore', treatment_type: 'medication_assisted', substances: 'opioids', capacity: 200, accepts_cash: true, military_friendly: false, completion_rate: 0.68 },
  ];
  return mockFacilities;
}

export async function buildSAMHSACacheData(records: SAMHSARecord[]): Promise<SAMHSACacheData> {
  // Build spatial index
  const spatialIndex: Record<string, SAMHSARecord[]> = {};

  const dataTypeDistribution: Record<SAMHSADataType, number> = { treatment_facilities: 0, admissions_data: 0, outcomes_data: 0, prevention_programs: 0, surveillance_data: 0 };
  const treatmentTypeDistribution: Record<TreatmentType, number> = { outpatient: 0, inpatient: 0, residential: 0, detox: 0, medication_assisted: 0, behavioral_therapy: 0 };
  const substanceDistribution: Record<SubstanceCategory, number> = { alcohol: 0, opioids: 0, stimulants: 0, cannabis: 0, tobacco: 0, prescription_drugs: 0, illicit_drugs: 0 };
  const stateDistribution: Record<string, number> = {};

  let totalAdmissions = 0; let militaryFriendlyFacilities = 0; let veteranSpecializedFacilities = 0; let traumaInformedFacilities = 0;
  let totalCompletionRates = 0; let facilitiesWithCompletionRate = 0;
  let facilitiesNearWaterViolations = 0; let facilitiesNearSuperfundSites = 0; let facilitiesWithAirQualityIssues = 0;

  // Add military proximity analysis
  const enrichedRecords = await Promise.all(records.map(async record => {
    if (record.location.lat && record.location.lng) {
      return await addMilitaryProximity(record);
    }
    return record;
  }));

  enrichedRecords.forEach(record => {
    // Spatial indexing
    const grid = gridKey(record.location.lat ?? 0, record.location.lng ?? 0);
    if (!spatialIndex[grid]) spatialIndex[grid] = [];
    spatialIndex[grid].push(record);

    // Summary calculations
    dataTypeDistribution[record.samhsaSpecific.dataType]++;
    if (record.samhsaSpecific.treatmentType) treatmentTypeDistribution[record.samhsaSpecific.treatmentType]++;

    record.samhsaSpecific.substanceCategories.forEach(substance => {
      substanceDistribution[substance]++;
    });

    const samhsaState = record.location.state ?? 'Unknown';
    stateDistribution[samhsaState] = (stateDistribution[samhsaState] || 0) + 1;

    if (record.samhsaSpecific.admissionCount) totalAdmissions += record.samhsaSpecific.admissionCount;
    if (record.samhsaSpecific.militaryFriendly) militaryFriendlyFacilities++;
    if (record.samhsaSpecific.veteranSpecialized) veteranSpecializedFacilities++;
    if (record.samhsaSpecific.traumaInformed) traumaInformedFacilities++;

    if (record.samhsaSpecific.completionRate) {
      totalCompletionRates += record.samhsaSpecific.completionRate;
      facilitiesWithCompletionRate++;
    }

    // Environmental correlations (would be populated during correlation analysis)
    if (record.samhsaSpecific.environmentalCorrelations.nearWaterViolations) facilitiesNearWaterViolations++;
    if (record.samhsaSpecific.environmentalCorrelations.nearSuperfundSites) facilitiesNearSuperfundSites++;
    if (record.samhsaSpecific.environmentalCorrelations.airQualityIssues) facilitiesWithAirQualityIssues++;
  });

  const averageCompletionRate = facilitiesWithCompletionRate > 0 ? totalCompletionRates / facilitiesWithCompletionRate : 0;

  // Build correlations
  const militaryInstallationProximity = buildMilitaryInstallationProximity(enrichedRecords);
  const environmentalHealthCorrelations = buildEnvironmentalHealthCorrelations(enrichedRecords);
  const accessibilityGaps = buildAccessibilityGaps(enrichedRecords);
  const demographicDisparities = buildDemographicDisparities(enrichedRecords);

  return {
    records: enrichedRecords,
    spatialIndex,
    summary: {
      totalFacilities: enrichedRecords.length,
      totalAdmissions,
      dataTypeDistribution,
      treatmentTypeDistribution,
      substanceDistribution,
      militaryFriendlyFacilities,
      veteranSpecializedFacilities,
      traumaInformedFacilities,
      averageCompletionRate: Math.round(averageCompletionRate * 100) / 100,
      stateDistribution,
      environmentalCorrelations: {
        facilitiesNearWaterViolations,
        facilitiesNearSuperfundSites,
        facilitiesWithAirQualityIssues,
      },
    },
    correlations: { militaryInstallationProximity, environmentalHealthCorrelations, accessibilityGaps, demographicDisparities },
    metadata: { lastUpdated: new Date().toISOString(), dataVersion: '2.0' }
  };
}

function buildMilitaryInstallationProximity(records: SAMHSARecord[]): any[] {
  return records
    .filter(r => r.proximityToMilitary?.isNearBase && r.samhsaSpecific.militaryFriendly)
    .map(record => ({
      facility_id: record.samhsaSpecific.facilityId,
      facility_name: record.samhsaSpecific.facilityName,
      military_installation: record.proximityToMilitary?.nearestInstallation,
      distance_km: record.proximityToMilitary?.distanceKm,
      treatment_type: record.samhsaSpecific.treatmentType,
      substance_categories: record.samhsaSpecific.substanceCategories,
      capacity: record.samhsaSpecific.facilityCapacity,
      completion_rate: record.samhsaSpecific.completionRate,
      veteran_specialized: record.samhsaSpecific.veteranSpecialized,
      trauma_informed: record.samhsaSpecific.traumaInformed,
    }))
    .sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999))
    .slice(0, 20);
}

function buildEnvironmentalHealthCorrelations(records: SAMHSARecord[]): any[] {
  return records
    .filter(r => Object.values(r.samhsaSpecific.environmentalCorrelations).some(v => v))
    .map(record => ({
      facility_id: record.samhsaSpecific.facilityId,
      facility_name: record.samhsaSpecific.facilityName,
      location: `${(record.location as any).city ?? 'Unknown'}, ${record.location.state ?? 'Unknown'}`,
      environmental_factors: record.samhsaSpecific.environmentalCorrelations,
      substance_categories: record.samhsaSpecific.substanceCategories,
      admission_count: record.samhsaSpecific.admissionCount,
      poverty_level: record.samhsaSpecific.geospatialFactors.povertyLevel,
    }))
    .slice(0, 15);
}

function buildAccessibilityGaps(records: SAMHSARecord[]): any[] {
  return records
    .filter(r => r.samhsaSpecific.geospatialFactors.accessibilityScore < 50)
    .map(record => ({
      facility_id: record.samhsaSpecific.facilityId,
      facility_name: record.samhsaSpecific.facilityName,
      location: `${(record.location as any).city ?? 'Unknown'}, ${record.location.state ?? 'Unknown'}`,
      accessibility_score: record.samhsaSpecific.geospatialFactors.accessibilityScore,
      rural_urban_code: record.samhsaSpecific.geospatialFactors.ruralUrbanCode,
      poverty_level: record.samhsaSpecific.geospatialFactors.povertyLevel,
      capacity: record.samhsaSpecific.facilityCapacity,
      accepts_medicaid: record.samhsaSpecific.acceptsMedicaid,
    }))
    .sort((a, b) => a.accessibility_score - b.accessibility_score)
    .slice(0, 12);
}

function buildDemographicDisparities(records: SAMHSARecord[]): any[] {
  // Analyze demographic disparities in treatment access and outcomes
  const disparityAnalysis: any[] = [];

  records.forEach(record => {
    const demographics = record.samhsaSpecific.demographics;
    const completionRate = record.samhsaSpecific.completionRate;

    if (completionRate && Object.keys(demographics.ethnicity).length > 0) {
      Object.entries(demographics.ethnicity).forEach(([ethnicity, count]) => {
        if (count > 10) { // Sufficient sample size
          disparityAnalysis.push({
            facility_id: record.samhsaSpecific.facilityId,
            facility_name: record.samhsaSpecific.facilityName,
            location: `${(record.location as any).city ?? 'Unknown'}, ${record.location.state ?? 'Unknown'}`,
            ethnicity,
            count,
            completion_rate: completionRate,
            treatment_type: record.samhsaSpecific.treatmentType,
            substance_categories: record.samhsaSpecific.substanceCategories,
          });
        }
      });
    }
  });

  return disparityAnalysis.slice(0, 20);
}

export function getMilitaryFriendlyFacilities(): SAMHSARecord[] {
  return samhsaCache?.records?.filter(r => r.samhsaSpecific.militaryFriendly) || [];
}

export function getVeteranSpecializedFacilities(): SAMHSARecord[] {
  return samhsaCache?.records?.filter(r => r.samhsaSpecific.veteranSpecialized) || [];
}

export function getOpioidTreatmentFacilities(): SAMHSARecord[] {
  return samhsaCache?.records?.filter(r =>
    r.samhsaSpecific.substanceCategories.includes('opioids') &&
    r.samhsaSpecific.treatmentType === 'medication_assisted'
  ) || [];
}