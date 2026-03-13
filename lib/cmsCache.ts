/**
 * CMS (Centers for Medicare & Medicaid Services) Cache
 * Healthcare utilization, quality metrics, and beneficiary data
 * Part of Tier 2 HHS integration - critical for healthcare access and quality correlations
 */

import { HHSAPIClient, type HHSHealthRecord, addMilitaryProximity, correlateWithWaterViolations } from './hhsDataUtils';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta, gridKey } from './cacheUtils';

export type CMSDataType = 'provider_data' | 'quality_measures' | 'utilization_data' | 'payment_data' | 'beneficiary_data' | 'facility_ratings';
export type ProviderType = 'hospital' | 'nursing_home' | 'home_health' | 'dialysis' | 'physician' | 'medicare_advantage' | 'prescription_drug';
export type QualityRating = 1 | 2 | 3 | 4 | 5;

export interface CMSRecord extends HHSHealthRecord {
  cmsSpecific: {
    providerId: string;
    providerName: string;
    dataType: CMSDataType;
    providerType: ProviderType;
    certificationNumber?: string;
    ownership: 'for_profit' | 'non_profit' | 'government' | 'unknown';
    bedCount?: number;
    staffingData: {
      totalStaffHours?: number;
      rn_hours_per_day?: number;
      lpn_hours_per_day?: number;
      cna_hours_per_day?: number;
      staffingRating?: QualityRating;
    };
    qualityMetrics: {
      overallRating?: QualityRating;
      healthInspectionRating?: QualityRating;
      qualityMeasureRating?: QualityRating;
      staffingRating?: QualityRating;
      firesafetyRating?: QualityRating;
    };
    utilizationMetrics: {
      totalDischarges?: number;
      readmissionRate?: number;
      averageLengthOfStay?: number;
      emergencyDepartmentVisits?: number;
      outpatientVisits?: number;
      medicareUtilization?: number;
      medicaidUtilization?: number;
    };
    paymentMetrics: {
      averageMedicarePayment?: number;
      averageTotalPayments?: number;
      averageCoveredCharges?: number;
      paymentPerBeneficiary?: number;
    };
    beneficiaryData: {
      totalBeneficiaries?: number;
      averageAge?: number;
      femalePercentage?: number;
      dualEligiblePercentage?: number;
      disabilityPercentage?: number;
    };
    specialPrograms: {
      veteranServices: boolean;
      militaryFriendly: boolean;
      traumaCenter: boolean;
      emergencyServices: boolean;
      specialNeeds: string[];
    };
    accessibilityFactors: {
      ruralDesignation?: 'urban' | 'rural' | 'frontier';
      transportationAccess: 'excellent' | 'good' | 'fair' | 'poor';
      healthcareProfessionalShortageArea: boolean;
      medicallyUnderservedArea: boolean;
    };
    complianceData: {
      deficiencies?: number;
      complaints?: number;
      enforcementActions?: number;
      civilMoneyPenalties?: number;
      lastInspectionDate?: string;
    };
    reportingPeriod: string;
    lastUpdated: string;
  };
}

interface CMSCacheData {
  records: CMSRecord[];
  spatialIndex: Record<string, CMSRecord[]>;
  summary: {
    totalProviders: number;
    dataTypeDistribution: Record<CMSDataType, number>;
    providerTypeDistribution: Record<ProviderType, number>;
    ownershipDistribution: Record<string, number>;
    qualityRatingDistribution: Record<number, number>;
    averageQualityRating: number;
    totalBeneficiaries: number;
    totalBeds: number;
    veteranServiceProviders: number;
    militaryFriendlyProviders: number;
    traumaCenters: number;
    ruralProviders: number;
    hpsaProviders: number;
    stateDistribution: Record<string, number>;
    complianceIssues: {
      providersWithDeficiencies: number;
      providersWithComplaints: number;
      providersWithEnforcement: number;
      totalCivilMoneyPenalties: number;
    };
  };
  correlations: {
    militaryInstallationProximity: any[];
    accessibilityGaps: any[];
    qualityDisparities: any[];
    utilizationPatterns: any[];
  };
  metadata: { lastUpdated: string; dataVersion: string; };
}

let cmsCache: CMSCacheData | null = null;
let lastFetched: string | null = null;
let _buildInProgress = false;
let _buildStartedAt: string | null = null;
let _cmsCacheLoaded = false;
let _lastDelta: CacheDelta | null = null;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
const CACHE_FILE = 'cms.json';

export function getCMSCacheStatus() {
  return {
    loaded: _cmsCacheLoaded && cmsCache !== null,
    built: lastFetched,
    recordCount: cmsCache?.records?.length || 0,
    militaryFriendlyProviders: cmsCache?.summary?.militaryFriendlyProviders || 0,
    buildInProgress: isBuildInProgress(),
    lastDelta: _lastDelta,
  };
}

export function getCMSCache(): CMSRecord[] { return cmsCache?.records || []; }

export async function setCMSCache(data: CMSCacheData): Promise<void> {
  if (!data.records?.length) { console.warn('No CMS data to cache'); return; }
  const prevCounts = cmsCache ? { recordCount: cmsCache.summary.totalProviders } : null;
  _lastDelta = computeCacheDelta(prevCounts, { recordCount: data.summary.totalProviders }, lastFetched);
  cmsCache = data; lastFetched = new Date().toISOString(); _cmsCacheLoaded = true;
  await saveToDisk(data); await saveCacheToBlob(CACHE_FILE, data);
}

export function setBuildInProgress(inProgress: boolean): void { _buildInProgress = inProgress; _buildStartedAt = inProgress ? new Date().toISOString() : null; }
export function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;
  if (_buildStartedAt && Date.now() - new Date(_buildStartedAt).getTime() > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('CMS build lock expired'); _buildInProgress = false; _buildStartedAt = null; return false;
  }
  return _buildInProgress;
}

export async function ensureWarmed(): Promise<void> {
  if (_cmsCacheLoaded) return;
  try {
    const diskData = await loadFromDisk();
    if (diskData?.records?.length) { cmsCache = diskData; _cmsCacheLoaded = true; return; }
  } catch (e) { console.warn('CMS disk load failed:', e); }
  try {
    const blobData = await loadCacheFromBlob<CMSCacheData>(CACHE_FILE);
    if (blobData?.records?.length) { cmsCache = blobData; _cmsCacheLoaded = true; await saveToDisk(blobData); }
  } catch (e) { console.warn('CMS blob load failed:', e); }
}

async function loadFromDisk(): Promise<CMSCacheData | null> {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs'); const path = require('path');
    const file = path.join(process.cwd(), '.cache', CACHE_FILE);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!data?.records) return null;
    console.log(`[CMS Cache] Loaded from disk (${data.records.length} records)`);
    return data;
  } catch (e) { return null; }
}

async function saveToDisk(data: CMSCacheData): Promise<void> {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs'); const path = require('path');
    const cacheDir = path.join(process.cwd(), '.cache'); const file = path.join(cacheDir, CACHE_FILE);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
    console.log(`[CMS Cache] Saved to disk (${data.records.length} records)`);
  } catch (e) { console.warn('CMS disk save failed:', e); }
}

export function processCMSData(rawRecords: any[]): CMSRecord[] {
  return rawRecords.map(raw => ({
    id: `cms_${raw.provider_id || raw.ccn || raw.id || Date.now()}`,
    source: 'cms',
    location: {
      lat: parseFloat(raw.latitude || raw.lat || 0),
      lng: parseFloat(raw.longitude || raw.lng || 0),
      state: raw.state || raw.provider_state || 'Unknown',
      county: raw.county || raw.provider_county,
      city: raw.city || raw.provider_city,
      address: raw.address || raw.provider_address,
      zipCode: raw.zip_code || raw.provider_zip_code,
    },
    temporal: {
      reportDate: raw.reporting_period || raw.last_updated || new Date().toISOString(),
      year: parseInt(raw.year || new Date().getFullYear().toString()),
    },
    healthMetrics: [{
      category: 'healthcare_quality',
      measure: raw.primary_measure || 'overall_rating',
      value: parseFloat(raw.overall_rating || raw.quality_rating || raw.value || 0),
      unit: raw.unit || 'rating',
    }],
    cmsSpecific: {
      providerId: raw.provider_id || raw.ccn || raw.id || 'unknown',
      providerName: raw.provider_name || raw.facility_name || 'Unknown Provider',
      dataType: determineCMSDataType(raw.data_type, raw.category),
      providerType: determineProviderType(raw.provider_type, raw.facility_type),
      certificationNumber: raw.ccn || raw.certification_number,
      ownership: normalizeOwnership(raw.ownership || raw.ownership_type),
      bedCount: parseInt(raw.bed_count || raw.number_of_beds) || undefined,
      staffingData: {
        totalStaffHours: parseFloat(raw.total_staff_hours) || undefined,
        rn_hours_per_day: parseFloat(raw.rn_hours_per_day) || undefined,
        lpn_hours_per_day: parseFloat(raw.lpn_hours_per_day) || undefined,
        cna_hours_per_day: parseFloat(raw.cna_hours_per_day) || undefined,
        staffingRating: normalizeRating(raw.staffing_rating),
      },
      qualityMetrics: {
        overallRating: normalizeRating(raw.overall_rating),
        healthInspectionRating: normalizeRating(raw.health_inspection_rating),
        qualityMeasureRating: normalizeRating(raw.quality_measure_rating),
        staffingRating: normalizeRating(raw.staffing_rating),
        firesafetyRating: normalizeRating(raw.fire_safety_rating),
      },
      utilizationMetrics: {
        totalDischarges: parseInt(raw.total_discharges) || undefined,
        readmissionRate: parseFloat(raw.readmission_rate) || undefined,
        averageLengthOfStay: parseFloat(raw.average_length_of_stay) || undefined,
        emergencyDepartmentVisits: parseInt(raw.ed_visits) || undefined,
        outpatientVisits: parseInt(raw.outpatient_visits) || undefined,
        medicareUtilization: parseInt(raw.medicare_utilization) || undefined,
        medicaidUtilization: parseInt(raw.medicaid_utilization) || undefined,
      },
      paymentMetrics: {
        averageMedicarePayment: parseFloat(raw.average_medicare_payment) || undefined,
        averageTotalPayments: parseFloat(raw.average_total_payments) || undefined,
        averageCoveredCharges: parseFloat(raw.average_covered_charges) || undefined,
        paymentPerBeneficiary: parseFloat(raw.payment_per_beneficiary) || undefined,
      },
      beneficiaryData: {
        totalBeneficiaries: parseInt(raw.total_beneficiaries) || undefined,
        averageAge: parseFloat(raw.average_age) || undefined,
        femalePercentage: parseFloat(raw.female_percentage) || undefined,
        dualEligiblePercentage: parseFloat(raw.dual_eligible_percentage) || undefined,
        disabilityPercentage: parseFloat(raw.disability_percentage) || undefined,
      },
      specialPrograms: {
        veteranServices: parseBoolean(raw.veteran_services || raw.va_contract),
        militaryFriendly: isMilitaryFriendly(raw.military_friendly, raw.services, raw.special_programs),
        traumaCenter: parseBoolean(raw.trauma_center || raw.trauma_level),
        emergencyServices: parseBoolean(raw.emergency_services || raw.emergency_department),
        specialNeeds: parseSpecialNeeds(raw.special_needs || raw.special_programs),
      },
      accessibilityFactors: {
        ruralDesignation: normalizeRuralDesignation(raw.rural_urban || raw.location_type),
        transportationAccess: assessTransportationAccess(raw.transportation || raw.accessibility),
        healthcareProfessionalShortageArea: parseBoolean(raw.hpsa || raw.shortage_area),
        medicallyUnderservedArea: parseBoolean(raw.mua || raw.underserved_area),
      },
      complianceData: {
        deficiencies: parseInt(raw.deficiencies || raw.deficiency_count) || undefined,
        complaints: parseInt(raw.complaints || raw.complaint_count) || undefined,
        enforcementActions: parseInt(raw.enforcement_actions) || undefined,
        civilMoneyPenalties: parseFloat(raw.civil_money_penalties) || undefined,
        lastInspectionDate: raw.last_inspection_date,
      },
      reportingPeriod: raw.reporting_period || raw.year || 'unknown',
      lastUpdated: raw.last_updated || new Date().toISOString(),
    }
  }));
}

function determineCMSDataType(dataType: string, category: string): CMSDataType {
  const type = (dataType || category || '').toLowerCase();

  if (type.includes('provider') || type.includes('facility')) return 'provider_data';
  if (type.includes('quality') || type.includes('rating')) return 'quality_measures';
  if (type.includes('utilization') || type.includes('discharge')) return 'utilization_data';
  if (type.includes('payment') || type.includes('cost')) return 'payment_data';
  if (type.includes('beneficiary') || type.includes('patient')) return 'beneficiary_data';
  if (type.includes('rating') || type.includes('score')) return 'facility_ratings';

  return 'provider_data';
}

function determineProviderType(providerType: string, facilityType: string): ProviderType {
  const type = (providerType || facilityType || '').toLowerCase();

  if (type.includes('hospital')) return 'hospital';
  if (type.includes('nursing') || type.includes('skilled')) return 'nursing_home';
  if (type.includes('home health')) return 'home_health';
  if (type.includes('dialysis') || type.includes('kidney')) return 'dialysis';
  if (type.includes('physician') || type.includes('doctor')) return 'physician';
  if (type.includes('medicare advantage') || type.includes('ma plan')) return 'medicare_advantage';
  if (type.includes('prescription') || type.includes('drug')) return 'prescription_drug';

  return 'hospital';
}

function normalizeOwnership(ownership: string): 'for_profit' | 'non_profit' | 'government' | 'unknown' {
  const own = (ownership || '').toLowerCase();

  if (own.includes('for profit') || own.includes('proprietary')) return 'for_profit';
  if (own.includes('non profit') || own.includes('nonprofit') || own.includes('voluntary')) return 'non_profit';
  if (own.includes('government') || own.includes('public') || own.includes('federal') || own.includes('state')) return 'government';

  return 'unknown';
}

function normalizeRating(rating: any): QualityRating | undefined {
  const r = parseInt(rating);
  if (r >= 1 && r <= 5) return r as QualityRating;
  return undefined;
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', 'yes', '1', 'y'].includes(value.toLowerCase());
  return false;
}

function isMilitaryFriendly(militaryFriendly: any, services: any, specialPrograms: any): boolean {
  if (parseBoolean(militaryFriendly)) return true;
  const combined = `${services || ''} ${specialPrograms || ''}`.toLowerCase();
  return combined.includes('military') || combined.includes('veteran') || combined.includes('tricare');
}

function parseSpecialNeeds(specialNeeds: any): string[] {
  if (Array.isArray(specialNeeds)) return specialNeeds.map(s => String(s));
  if (typeof specialNeeds === 'string') {
    return specialNeeds.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }
  return [];
}

function normalizeRuralDesignation(ruralUrban: string): 'urban' | 'rural' | 'frontier' | undefined {
  const ru = (ruralUrban || '').toLowerCase();

  if (ru.includes('urban') || ru.includes('metropolitan')) return 'urban';
  if (ru.includes('rural')) return 'rural';
  if (ru.includes('frontier')) return 'frontier';

  return undefined;
}

function assessTransportationAccess(transportation: string): 'excellent' | 'good' | 'fair' | 'poor' {
  const trans = (transportation || '').toLowerCase();

  if (trans.includes('excellent') || trans.includes('high access')) return 'excellent';
  if (trans.includes('good') || trans.includes('adequate')) return 'good';
  if (trans.includes('fair') || trans.includes('limited')) return 'fair';

  return 'poor';
}

export async function fetchCMSData(): Promise<any[]> {
  // Mock CMS data - in practice would fetch from CMS APIs (Provider of Services, Nursing Home Compare, etc.)
  const mockProviders = [
    { provider_id: 'CMS_001', provider_name: 'Metro General Hospital', latitude: 38.9072, longitude: -77.0369, state: 'DC', city: 'Washington', provider_type: 'hospital', bed_count: 450, overall_rating: 4, veteran_services: true, trauma_center: true, emergency_services: true, rural_urban: 'urban', hpsa: false },
    { provider_id: 'CMS_002', provider_name: 'Veteran Affairs Medical Center', latitude: 36.8485, longitude: -75.9780, state: 'VA', city: 'Norfolk', provider_type: 'hospital', bed_count: 280, overall_rating: 5, veteran_services: true, military_friendly: true, trauma_center: true, rural_urban: 'urban', hpsa: true },
    { provider_id: 'CMS_003', provider_name: 'Rural Health Clinic', latitude: 39.2904, longitude: -76.6122, state: 'MD', city: 'Baltimore', provider_type: 'nursing_home', bed_count: 120, overall_rating: 3, veteran_services: false, rural_urban: 'rural', hpsa: true, mua: true },
  ];
  return mockProviders;
}

export async function buildCMSCacheData(records: CMSRecord[]): Promise<CMSCacheData> {
  // Build spatial index
  const spatialIndex: Record<string, CMSRecord[]> = {};

  const dataTypeDistribution: Record<CMSDataType, number> = { provider_data: 0, quality_measures: 0, utilization_data: 0, payment_data: 0, beneficiary_data: 0, facility_ratings: 0 };
  const providerTypeDistribution: Record<ProviderType, number> = { hospital: 0, nursing_home: 0, home_health: 0, dialysis: 0, physician: 0, medicare_advantage: 0, prescription_drug: 0 };
  const ownershipDistribution: Record<string, number> = {};
  const qualityRatingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const stateDistribution: Record<string, number> = {};

  let totalQualityRatings = 0; let qualityRatingsCount = 0; let totalBeneficiaries = 0; let totalBeds = 0;
  let veteranServiceProviders = 0; let militaryFriendlyProviders = 0; let traumaCenters = 0; let ruralProviders = 0; let hpsaProviders = 0;
  let providersWithDeficiencies = 0; let providersWithComplaints = 0; let providersWithEnforcement = 0; let totalCivilMoneyPenalties = 0;

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
    dataTypeDistribution[record.cmsSpecific.dataType]++;
    providerTypeDistribution[record.cmsSpecific.providerType]++;
    ownershipDistribution[record.cmsSpecific.ownership] = (ownershipDistribution[record.cmsSpecific.ownership] || 0) + 1;
    const cmsState = record.location.state ?? 'Unknown';
    stateDistribution[cmsState] = (stateDistribution[cmsState] || 0) + 1;

    if (record.cmsSpecific.qualityMetrics.overallRating) {
      qualityRatingDistribution[record.cmsSpecific.qualityMetrics.overallRating]++;
      totalQualityRatings += record.cmsSpecific.qualityMetrics.overallRating;
      qualityRatingsCount++;
    }

    if (record.cmsSpecific.beneficiaryData.totalBeneficiaries) totalBeneficiaries += record.cmsSpecific.beneficiaryData.totalBeneficiaries;
    if (record.cmsSpecific.bedCount) totalBeds += record.cmsSpecific.bedCount;

    if (record.cmsSpecific.specialPrograms.veteranServices) veteranServiceProviders++;
    if (record.cmsSpecific.specialPrograms.militaryFriendly) militaryFriendlyProviders++;
    if (record.cmsSpecific.specialPrograms.traumaCenter) traumaCenters++;
    if (record.cmsSpecific.accessibilityFactors.ruralDesignation === 'rural') ruralProviders++;
    if (record.cmsSpecific.accessibilityFactors.healthcareProfessionalShortageArea) hpsaProviders++;

    // Compliance data
    if (record.cmsSpecific.complianceData.deficiencies && record.cmsSpecific.complianceData.deficiencies > 0) providersWithDeficiencies++;
    if (record.cmsSpecific.complianceData.complaints && record.cmsSpecific.complianceData.complaints > 0) providersWithComplaints++;
    if (record.cmsSpecific.complianceData.enforcementActions && record.cmsSpecific.complianceData.enforcementActions > 0) providersWithEnforcement++;
    if (record.cmsSpecific.complianceData.civilMoneyPenalties) totalCivilMoneyPenalties += record.cmsSpecific.complianceData.civilMoneyPenalties;
  });

  const averageQualityRating = qualityRatingsCount > 0 ? totalQualityRatings / qualityRatingsCount : 0;

  // Build correlations
  const militaryInstallationProximity = buildMilitaryInstallationProximity(enrichedRecords);
  const accessibilityGaps = buildAccessibilityGaps(enrichedRecords);
  const qualityDisparities = buildQualityDisparities(enrichedRecords);
  const utilizationPatterns = buildUtilizationPatterns(enrichedRecords);

  return {
    records: enrichedRecords,
    spatialIndex,
    summary: {
      totalProviders: enrichedRecords.length,
      dataTypeDistribution,
      providerTypeDistribution,
      ownershipDistribution,
      qualityRatingDistribution,
      averageQualityRating: Math.round(averageQualityRating * 10) / 10,
      totalBeneficiaries,
      totalBeds,
      veteranServiceProviders,
      militaryFriendlyProviders,
      traumaCenters,
      ruralProviders,
      hpsaProviders,
      stateDistribution,
      complianceIssues: {
        providersWithDeficiencies,
        providersWithComplaints,
        providersWithEnforcement,
        totalCivilMoneyPenalties: Math.round(totalCivilMoneyPenalties),
      },
    },
    correlations: { militaryInstallationProximity, accessibilityGaps, qualityDisparities, utilizationPatterns },
    metadata: { lastUpdated: new Date().toISOString(), dataVersion: '2.0' }
  };
}

function buildMilitaryInstallationProximity(records: CMSRecord[]): any[] {
  return records
    .filter(r => r.proximityToMilitary?.isNearBase)
    .map(record => ({
      provider_id: record.cmsSpecific.providerId,
      provider_name: record.cmsSpecific.providerName,
      provider_type: record.cmsSpecific.providerType,
      military_installation: record.proximityToMilitary?.nearestInstallation,
      distance_km: record.proximityToMilitary?.distanceKm,
      overall_rating: record.cmsSpecific.qualityMetrics.overallRating,
      veteran_services: record.cmsSpecific.specialPrograms.veteranServices,
      military_friendly: record.cmsSpecific.specialPrograms.militaryFriendly,
      trauma_center: record.cmsSpecific.specialPrograms.traumaCenter,
      bed_count: record.cmsSpecific.bedCount,
      emergency_services: record.cmsSpecific.specialPrograms.emergencyServices,
    }))
    .sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999))
    .slice(0, 25);
}

function buildAccessibilityGaps(records: CMSRecord[]): any[] {
  return records
    .filter(r =>
      r.cmsSpecific.accessibilityFactors.healthcareProfessionalShortageArea ||
      r.cmsSpecific.accessibilityFactors.medicallyUnderservedArea ||
      r.cmsSpecific.accessibilityFactors.ruralDesignation === 'rural'
    )
    .map(record => ({
      provider_id: record.cmsSpecific.providerId,
      provider_name: record.cmsSpecific.providerName,
      provider_type: record.cmsSpecific.providerType,
      location: `${(record.location as any).city ?? 'Unknown'}, ${record.location.state ?? 'Unknown'}`,
      rural_designation: record.cmsSpecific.accessibilityFactors.ruralDesignation,
      transportation_access: record.cmsSpecific.accessibilityFactors.transportationAccess,
      hpsa: record.cmsSpecific.accessibilityFactors.healthcareProfessionalShortageArea,
      mua: record.cmsSpecific.accessibilityFactors.medicallyUnderservedArea,
      overall_rating: record.cmsSpecific.qualityMetrics.overallRating,
      bed_count: record.cmsSpecific.bedCount,
      total_beneficiaries: record.cmsSpecific.beneficiaryData.totalBeneficiaries,
    }))
    .sort((a, b) => {
      // Prioritize by access barriers
      let aScore = 0, bScore = 0;
      if (a.hpsa) aScore += 2;
      if (a.mua) aScore += 2;
      if (a.rural_designation === 'rural') aScore += 1;
      if (b.hpsa) bScore += 2;
      if (b.mua) bScore += 2;
      if (b.rural_designation === 'rural') bScore += 1;
      return bScore - aScore;
    })
    .slice(0, 20);
}

function buildQualityDisparities(records: CMSRecord[]): any[] {
  // Analyze quality rating disparities by ownership, location, etc.
  const disparityAnalysis: any[] = [];

  const ownershipGroups = new Map<string, CMSRecord[]>();
  const ruralUrbanGroups = new Map<string, CMSRecord[]>();

  records.forEach(record => {
    // Group by ownership
    if (!ownershipGroups.has(record.cmsSpecific.ownership)) {
      ownershipGroups.set(record.cmsSpecific.ownership, []);
    }
    ownershipGroups.get(record.cmsSpecific.ownership)!.push(record);

    // Group by rural/urban
    const ruralUrban = record.cmsSpecific.accessibilityFactors.ruralDesignation || 'unknown';
    if (!ruralUrbanGroups.has(ruralUrban)) {
      ruralUrbanGroups.set(ruralUrban, []);
    }
    ruralUrbanGroups.get(ruralUrban)!.push(record);
  });

  // Analyze ownership disparities
  ownershipGroups.forEach((groupRecords, ownership) => {
    if (groupRecords.length >= 5) { // Sufficient sample size
      const ratingsWithQuality = groupRecords.filter(r => r.cmsSpecific.qualityMetrics.overallRating);
      if (ratingsWithQuality.length >= 3) {
        const avgRating = ratingsWithQuality.reduce((sum, r) => sum + r.cmsSpecific.qualityMetrics.overallRating!, 0) / ratingsWithQuality.length;

        disparityAnalysis.push({
          disparity_type: 'ownership',
          category: ownership,
          provider_count: groupRecords.length,
          average_rating: Math.round(avgRating * 10) / 10,
          low_quality_count: ratingsWithQuality.filter(r => r.cmsSpecific.qualityMetrics.overallRating! <= 2).length,
          high_quality_count: ratingsWithQuality.filter(r => r.cmsSpecific.qualityMetrics.overallRating! >= 4).length,
        });
      }
    }
  });

  // Analyze rural/urban disparities
  ruralUrbanGroups.forEach((groupRecords, ruralUrban) => {
    if (groupRecords.length >= 5) {
      const ratingsWithQuality = groupRecords.filter(r => r.cmsSpecific.qualityMetrics.overallRating);
      if (ratingsWithQuality.length >= 3) {
        const avgRating = ratingsWithQuality.reduce((sum, r) => sum + r.cmsSpecific.qualityMetrics.overallRating!, 0) / ratingsWithQuality.length;

        disparityAnalysis.push({
          disparity_type: 'rural_urban',
          category: ruralUrban,
          provider_count: groupRecords.length,
          average_rating: Math.round(avgRating * 10) / 10,
          low_quality_count: ratingsWithQuality.filter(r => r.cmsSpecific.qualityMetrics.overallRating! <= 2).length,
          high_quality_count: ratingsWithQuality.filter(r => r.cmsSpecific.qualityMetrics.overallRating! >= 4).length,
        });
      }
    }
  });

  return disparityAnalysis
    .sort((a, b) => a.average_rating - b.average_rating)
    .slice(0, 15);
}

function buildUtilizationPatterns(records: CMSRecord[]): any[] {
  return records
    .filter(r => r.cmsSpecific.utilizationMetrics.totalDischarges || r.cmsSpecific.utilizationMetrics.readmissionRate)
    .map(record => ({
      provider_id: record.cmsSpecific.providerId,
      provider_name: record.cmsSpecific.providerName,
      provider_type: record.cmsSpecific.providerType,
      location: `${(record.location as any).city ?? 'Unknown'}, ${record.location.state ?? 'Unknown'}`,
      total_discharges: record.cmsSpecific.utilizationMetrics.totalDischarges,
      readmission_rate: record.cmsSpecific.utilizationMetrics.readmissionRate,
      average_length_of_stay: record.cmsSpecific.utilizationMetrics.averageLengthOfStay,
      emergency_visits: record.cmsSpecific.utilizationMetrics.emergencyDepartmentVisits,
      overall_rating: record.cmsSpecific.qualityMetrics.overallRating,
      ownership: record.cmsSpecific.ownership,
      rural_designation: record.cmsSpecific.accessibilityFactors.ruralDesignation,
    }))
    .sort((a, b) => (b.total_discharges || 0) - (a.total_discharges || 0))
    .slice(0, 30);
}

export function getVeteranServiceProviders(): CMSRecord[] {
  return cmsCache?.records?.filter(r => r.cmsSpecific.specialPrograms.veteranServices) || [];
}

export function getMilitaryFriendlyProviders(): CMSRecord[] {
  return cmsCache?.records?.filter(r => r.cmsSpecific.specialPrograms.militaryFriendly) || [];
}

export function getHighQualityProviders(): CMSRecord[] {
  return cmsCache?.records?.filter(r =>
    r.cmsSpecific.qualityMetrics.overallRating &&
    r.cmsSpecific.qualityMetrics.overallRating >= 4
  ) || [];
}