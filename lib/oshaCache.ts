/**
 * OSHA (Occupational Safety and Health Administration) Cache
 * Workplace safety incidents, inspections, violations, and occupational health data
 * Part of Tier 2 HHS integration - critical for military and industrial safety correlations
 */

import { HHSAPIClient, type HHSHealthRecord, addMilitaryProximity, correlateWithWaterViolations } from './hhsDataUtils';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta, gridKey } from './cacheUtils';

export type OSHADataType = 'inspection' | 'violation' | 'accident' | 'fatality' | 'complaint' | 'establishment_search';
export type InspectionType = 'programmed' | 'complaint' | 'referral' | 'accident' | 'follow_up' | 'monitoring' | 'variance';
export type ViolationType = 'serious' | 'willful' | 'repeat' | 'other_than_serious' | 'de_minimis';
export type IndustryCategory = 'construction' | 'manufacturing' | 'healthcare' | 'retail' | 'transportation' | 'utilities' | 'government' | 'services';

export interface OSHARecord extends HHSHealthRecord {
  oshaSpecific: {
    activityNr?: string;
    inspectionId?: string;
    establishmentName: string;
    dataType: OSHADataType;
    inspectionType?: InspectionType;
    inspectionScope?: 'complete' | 'partial';
    inspectionDate?: string;
    inspectionClosedDate?: string;
    violations: {
      total: number;
      serious: number;
      willful: number;
      repeat: number;
      otherThanSerious: number;
      deMinimis: number;
    };
    penalties: {
      total: number;
      current: number;
      initial: number;
      contested: boolean;
    };
    industryCode?: string;
    industryDescription?: string;
    industryCategory: IndustryCategory;
    naicsCode?: string;
    sicCode?: string;
    employeeCount?: number;
    unionStatus: boolean;
    accidentData?: {
      fatalities: number;
      hospitalizations: number;
      amputations: number;
      lossOfEye: number;
      eventDescription?: string;
      eventDate?: string;
      bodyPart?: string;
      injurySource?: string;
    };
    hazardExposure: {
      chemical: boolean;
      biological: boolean;
      physical: boolean;
      ergonomic: boolean;
      psychosocial: boolean;
      environmental: boolean;
    };
    environmentalCorrelations: {
      nearWaterSources: boolean;
      nearSuperfundSites: boolean;
      airQualityIssues: boolean;
      hazardousWasteHandling: boolean;
      chemicalStorageFacility: boolean;
    };
    militaryRelevance: {
      isDefenseContractor: boolean;
      isFederalFacility: boolean;
      nearMilitaryInstallation: boolean;
      handlesMilitaryContracts: boolean;
      securityClearanceRequired: boolean;
    };
    complianceHistory: {
      priorInspections?: number;
      priorViolations?: number;
      priorPenalties?: number;
      complianceAssistance?: boolean;
      voluntaryProtectionProgram?: boolean;
    };
    reportingPeriod: string;
    lastUpdated: string;
  };
}

interface OSHACacheData {
  records: OSHARecord[];
  spatialIndex: Record<string, OSHARecord[]>;
  summary: {
    totalRecords: number;
    totalEstablishments: number;
    dataTypeDistribution: Record<OSHADataType, number>;
    inspectionTypeDistribution: Record<InspectionType, number>;
    violationTypeDistribution: Record<ViolationType, number>;
    industryDistribution: Record<IndustryCategory, number>;
    totalViolations: number;
    totalPenalties: number;
    totalFatalities: number;
    totalInjuries: number;
    defenseContractors: number;
    federalFacilities: number;
    nearMilitaryInstallations: number;
    environmentallyRelatedIncidents: number;
    stateDistribution: Record<string, number>;
    yearRange: { earliest: number; latest: number; };
  };
  correlations: {
    militaryInstallationProximity: any[];
    environmentalHazardCorrelations: any[];
    industryRiskPatterns: any[];
    complianceEffectiveness: any[];
  };
  metadata: { lastUpdated: string; dataVersion: string; };
}

let oshaCache: OSHACacheData | null = null;
let lastFetched: string | null = null;
let _buildInProgress = false;
let _buildStartedAt: string | null = null;
let _oshaCacheLoaded = false;
let _lastDelta: CacheDelta | null = null;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
const CACHE_FILE = 'osha.json';

export function getOSHACacheStatus() {
  return {
    loaded: _oshaCacheLoaded && oshaCache !== null,
    built: lastFetched,
    recordCount: oshaCache?.records?.length || 0,
    defenseContractors: oshaCache?.summary?.defenseContractors || 0,
    buildInProgress: isBuildInProgress(),
    lastDelta: _lastDelta,
  };
}

export function getOSHACache(): OSHARecord[] { return oshaCache?.records || []; }

export async function setOSHACache(data: OSHACacheData): Promise<void> {
  if (!data.records?.length) { console.warn('No OSHA data to cache'); return; }
  const prevCounts = oshaCache ? { recordCount: oshaCache.summary.totalRecords } : null;
  _lastDelta = computeCacheDelta(prevCounts, { recordCount: data.summary.totalRecords }, lastFetched);
  oshaCache = data; lastFetched = new Date().toISOString(); _oshaCacheLoaded = true;
  await saveToDisk(data); await saveCacheToBlob(CACHE_FILE, data);
}

export function setBuildInProgress(inProgress: boolean): void { _buildInProgress = inProgress; _buildStartedAt = inProgress ? new Date().toISOString() : null; }
export function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;
  if (_buildStartedAt && Date.now() - new Date(_buildStartedAt).getTime() > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('OSHA build lock expired'); _buildInProgress = false; _buildStartedAt = null; return false;
  }
  return _buildInProgress;
}

export async function ensureWarmed(): Promise<void> {
  if (_oshaCacheLoaded) return;
  try {
    const diskData = await loadFromDisk();
    if (diskData?.records?.length) { oshaCache = diskData; _oshaCacheLoaded = true; return; }
  } catch (e) { console.warn('OSHA disk load failed:', e); }
  try {
    const blobData = await loadCacheFromBlob<OSHACacheData>(CACHE_FILE);
    if (blobData?.records?.length) { oshaCache = blobData; _oshaCacheLoaded = true; await saveToDisk(blobData); }
  } catch (e) { console.warn('OSHA blob load failed:', e); }
}

async function loadFromDisk(): Promise<OSHACacheData | null> {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs'); const path = require('path');
    const file = path.join(process.cwd(), '.cache', CACHE_FILE);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!data?.records) return null;
    console.log(`[OSHA Cache] Loaded from disk (${data.records.length} records)`);
    return data;
  } catch (e) { return null; }
}

async function saveToDisk(data: OSHACacheData): Promise<void> {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs'); const path = require('path');
    const cacheDir = path.join(process.cwd(), '.cache'); const file = path.join(cacheDir, CACHE_FILE);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
    console.log(`[OSHA Cache] Saved to disk (${data.records.length} records)`);
  } catch (e) { console.warn('OSHA disk save failed:', e); }
}

export function processOSHAData(rawRecords: any[]): OSHARecord[] {
  return rawRecords.map(raw => ({
    id: `osha_${raw.activity_nr || raw.inspection_id || raw.id || Date.now()}`,
    source: 'osha',
    location: {
      lat: parseFloat(raw.latitude || raw.lat || 0),
      lng: parseFloat(raw.longitude || raw.lng || 0),
      state: raw.state || raw.site_state || 'Unknown',
      county: raw.county || raw.site_county,
      city: raw.city || raw.site_city,
      address: raw.address || raw.site_address,
      zipCode: raw.zip_code || raw.site_zip,
    },
    temporal: {
      reportDate: raw.inspection_date || raw.event_date || raw.open_date || new Date().toISOString(),
      year: parseInt(raw.year || raw.fy || new Date(raw.inspection_date || new Date()).getFullYear().toString()),
    },
    healthMetrics: [{
      category: 'occupational_safety',
      measure: raw.primary_measure || 'total_violations',
      value: parseInt(raw.total_violations || raw.nr_violations || raw.value || 0),
      unit: raw.unit || 'count',
    }],
    oshaSpecific: {
      activityNr: raw.activity_nr || raw.activity_number,
      inspectionId: raw.inspection_nr || raw.inspection_id,
      establishmentName: raw.estab_name || raw.establishment_name || 'Unknown Establishment',
      dataType: determineOSHADataType(raw.data_type, raw.inspection_type, raw.nr_violations),
      inspectionType: normalizeInspectionType(raw.inspection_type),
      inspectionScope: normalizeInspectionScope(raw.inspection_scope),
      inspectionDate: raw.inspection_date || raw.open_date,
      inspectionClosedDate: raw.close_date || raw.close_conf_date,
      violations: {
        total: parseInt(raw.nr_violations || raw.total_violations || 0),
        serious: parseInt(raw.nr_serious || raw.serious_violations || 0),
        willful: parseInt(raw.nr_willful || raw.willful_violations || 0),
        repeat: parseInt(raw.nr_repeat || raw.repeat_violations || 0),
        otherThanSerious: parseInt(raw.nr_other || raw.other_violations || 0),
        deMinimis: parseInt(raw.nr_deminimis || raw.deminimis_violations || 0),
      },
      penalties: {
        total: parseFloat(raw.total_penalties || raw.penalty_total || 0),
        current: parseFloat(raw.current_penalty || raw.penalty_current || 0),
        initial: parseFloat(raw.initial_penalty || raw.penalty_initial || 0),
        contested: parseBoolean(raw.penalty_contested || raw.contested),
      },
      industryCode: raw.primary_sic || raw.sic_code,
      industryDescription: raw.sic_description || raw.industry_description,
      industryCategory: categorizeIndustry(raw.sic_description, raw.industry_description, raw.primary_sic),
      naicsCode: raw.naics_code,
      sicCode: raw.primary_sic || raw.sic_code,
      employeeCount: parseInt(raw.nr_employees || raw.employee_count) || undefined,
      unionStatus: parseBoolean(raw.union_status || raw.union),
      accidentData: raw.fatalities || raw.hospitalizations ? {
        fatalities: parseInt(raw.fatalities || 0),
        hospitalizations: parseInt(raw.hospitalizations || 0),
        amputations: parseInt(raw.amputations || 0),
        lossOfEye: parseInt(raw.loss_of_eye || 0),
        eventDescription: raw.event_description || raw.accident_description,
        eventDate: raw.event_date || raw.accident_date,
        bodyPart: raw.part_of_body || raw.body_part,
        injurySource: raw.source_of_injury || raw.injury_source,
      } : undefined,
      hazardExposure: {
        chemical: isChemicalHazard(raw.violation_items, raw.standards_violated),
        biological: isBiologicalHazard(raw.violation_items, raw.standards_violated),
        physical: isPhysicalHazard(raw.violation_items, raw.standards_violated),
        ergonomic: isErgonomicHazard(raw.violation_items, raw.standards_violated),
        psychosocial: isPsychosocialHazard(raw.violation_items, raw.standards_violated),
        environmental: isEnvironmentalHazard(raw.violation_items, raw.standards_violated),
      },
      environmentalCorrelations: {
        nearWaterSources: false, // Will be populated during correlation
        nearSuperfundSites: false,
        airQualityIssues: false,
        hazardousWasteHandling: isHazardousWasteOperation(raw.sic_description, raw.violation_items),
        chemicalStorageFacility: isChemicalStorageFacility(raw.sic_description, raw.violation_items),
      },
      militaryRelevance: {
        isDefenseContractor: isDefenseContractor(raw.estab_name, raw.industry_description),
        isFederalFacility: isFederalFacility(raw.estab_name, raw.ownership_type),
        nearMilitaryInstallation: false, // Will be populated during proximity analysis
        handlesMilitaryContracts: handlesMilitaryContracts(raw.estab_name, raw.industry_description),
        securityClearanceRequired: requiresSecurityClearance(raw.industry_description, raw.estab_name),
      },
      complianceHistory: {
        priorInspections: parseInt(raw.prior_inspections) || undefined,
        priorViolations: parseInt(raw.prior_violations) || undefined,
        priorPenalties: parseFloat(raw.prior_penalties) || undefined,
        complianceAssistance: parseBoolean(raw.compliance_assistance),
        voluntaryProtectionProgram: parseBoolean(raw.vpp || raw.voluntary_protection),
      },
      reportingPeriod: raw.fy || raw.year || 'unknown',
      lastUpdated: raw.last_updated || new Date().toISOString(),
    }
  }));
}

function determineOSHADataType(dataType: string, inspectionType: string, violationsCount: any): OSHADataType {
  if (dataType) {
    const type = dataType.toLowerCase();
    if (type.includes('inspection')) return 'inspection';
    if (type.includes('violation')) return 'violation';
    if (type.includes('accident')) return 'accident';
    if (type.includes('fatality')) return 'fatality';
    if (type.includes('complaint')) return 'complaint';
  }

  if (inspectionType) {
    const type = inspectionType.toLowerCase();
    if (type.includes('accident') || type.includes('fatality')) return 'accident';
    if (type.includes('complaint')) return 'complaint';
  }

  const violations = parseInt(violationsCount || 0);
  return violations > 0 ? 'violation' : 'inspection';
}

function normalizeInspectionType(inspectionType: string): InspectionType | undefined {
  const type = (inspectionType || '').toLowerCase();

  if (type.includes('programmed') || type.includes('planned')) return 'programmed';
  if (type.includes('complaint')) return 'complaint';
  if (type.includes('referral')) return 'referral';
  if (type.includes('accident') || type.includes('fatality')) return 'accident';
  if (type.includes('follow') || type.includes('followup')) return 'follow_up';
  if (type.includes('monitoring')) return 'monitoring';
  if (type.includes('variance')) return 'variance';

  return undefined;
}

function normalizeInspectionScope(inspectionScope: string): 'complete' | 'partial' | undefined {
  const scope = (inspectionScope || '').toLowerCase();

  if (scope.includes('complete') || scope.includes('comprehensive')) return 'complete';
  if (scope.includes('partial') || scope.includes('limited')) return 'partial';

  return undefined;
}

function categorizeIndustry(sicDescription: string, industryDescription: string, sicCode: string): IndustryCategory {
  const combined = `${sicDescription || ''} ${industryDescription || ''}`.toLowerCase();
  const sic = sicCode || '';

  if (combined.includes('construction') || sic.startsWith('15') || sic.startsWith('16') || sic.startsWith('17')) return 'construction';
  if (combined.includes('manufacturing') || (sic >= '20' && sic <= '39')) return 'manufacturing';
  if (combined.includes('hospital') || combined.includes('healthcare') || combined.includes('medical') || sic.startsWith('80')) return 'healthcare';
  if (combined.includes('retail') || combined.includes('store') || (sic >= '52' && sic <= '59')) return 'retail';
  if (combined.includes('transportation') || combined.includes('trucking') || combined.includes('shipping') || (sic >= '40' && sic <= '49')) return 'transportation';
  if (combined.includes('utility') || combined.includes('electric') || combined.includes('gas') || combined.includes('water') || sic.startsWith('49')) return 'utilities';
  if (combined.includes('government') || combined.includes('federal') || combined.includes('state') || combined.includes('public')) return 'government';

  return 'services';
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', 'yes', '1', 'y'].includes(value.toLowerCase());
  return false;
}

function isChemicalHazard(violationItems: string, standards: string): boolean {
  const combined = `${violationItems || ''} ${standards || ''}`.toLowerCase();
  return ['chemical', 'toxic', 'hazmat', 'exposure', 'respiratory', '1910.1000'].some(keyword => combined.includes(keyword));
}

function isBiologicalHazard(violationItems: string, standards: string): boolean {
  const combined = `${violationItems || ''} ${standards || ''}`.toLowerCase();
  return ['biological', 'bloodborne', 'infectious', 'pathogen', '1910.1030'].some(keyword => combined.includes(keyword));
}

function isPhysicalHazard(violationItems: string, standards: string): boolean {
  const combined = `${violationItems || ''} ${standards || ''}`.toLowerCase();
  return ['noise', 'machinery', 'electrical', 'fall', 'crushing', 'lockout'].some(keyword => combined.includes(keyword));
}

function isErgonomicHazard(violationItems: string, standards: string): boolean {
  const combined = `${violationItems || ''} ${standards || ''}`.toLowerCase();
  return ['ergonomic', 'repetitive', 'lifting', 'posture', 'musculoskeletal'].some(keyword => combined.includes(keyword));
}

function isPsychosocialHazard(violationItems: string, standards: string): boolean {
  const combined = `${violationItems || ''} ${standards || ''}`.toLowerCase();
  return ['violence', 'stress', 'workplace harassment', 'psychological'].some(keyword => combined.includes(keyword));
}

function isEnvironmentalHazard(violationItems: string, standards: string): boolean {
  const combined = `${violationItems || ''} ${standards || ''}`.toLowerCase();
  return ['environmental', 'air quality', 'water contamination', 'hazardous waste'].some(keyword => combined.includes(keyword));
}

function isDefenseContractor(establishmentName: string, industryDescription: string): boolean {
  const combined = `${establishmentName || ''} ${industryDescription || ''}`.toLowerCase();
  const defenseKeywords = ['defense', 'military', 'aerospace', 'lockheed', 'boeing', 'raytheon', 'general dynamics', 'northrop'];
  return defenseKeywords.some(keyword => combined.includes(keyword));
}

function isFederalFacility(establishmentName: string, ownershipType: string): boolean {
  const combined = `${establishmentName || ''} ${ownershipType || ''}`.toLowerCase();
  return ['federal', 'government', 'dod', 'department of defense', 'army', 'navy', 'air force'].some(keyword => combined.includes(keyword));
}

function handlesMilitaryContracts(establishmentName: string, industryDescription: string): boolean {
  const combined = `${establishmentName || ''} ${industryDescription || ''}`.toLowerCase();
  return ['contractor', 'contract', 'subcontractor', 'supplier', 'vendor'].some(keyword => combined.includes(keyword)) &&
         ['defense', 'military', 'government'].some(keyword => combined.includes(keyword));
}

function requiresSecurityClearance(industryDescription: string, establishmentName: string): boolean {
  const combined = `${industryDescription || ''} ${establishmentName || ''}`.toLowerCase();
  return ['classified', 'secret', 'top secret', 'security clearance', 'classified facility'].some(keyword => combined.includes(keyword));
}

function isHazardousWasteOperation(sicDescription: string, violationItems: string): boolean {
  const combined = `${sicDescription || ''} ${violationItems || ''}`.toLowerCase();
  return ['hazardous waste', 'toxic waste', 'chemical disposal', 'waste management', '1910.120'].some(keyword => combined.includes(keyword));
}

function isChemicalStorageFacility(sicDescription: string, violationItems: string): boolean {
  const combined = `${sicDescription || ''} ${violationItems || ''}`.toLowerCase();
  return ['chemical storage', 'chemical warehouse', 'process safety', 'psr', '1910.119'].some(keyword => combined.includes(keyword));
}

export async function fetchOSHAData(): Promise<any[]> {
  // Mock OSHA data - in practice would fetch from OSHA Enforcement Data API
  const mockInspections = [
    { activity_nr: '1234567890', estab_name: 'Aerospace Manufacturing Inc', latitude: 38.9047, longitude: -77.0164, state: 'DC', city: 'Washington', inspection_date: '2024-01-15', inspection_type: 'programmed', nr_violations: 3, nr_serious: 2, total_penalties: 25000, primary_sic: '3721', sic_description: 'Aircraft Manufacturing', nr_employees: 450, industry_description: 'Defense contractor specializing in military aircraft components' },
    { activity_nr: '0987654321', estab_name: 'Chemical Processing Facility', latitude: 39.2904, longitude: -76.6122, state: 'MD', city: 'Baltimore', inspection_date: '2024-02-20', inspection_type: 'complaint', nr_violations: 5, nr_serious: 4, nr_willful: 1, total_penalties: 85000, primary_sic: '2869', sic_description: 'Industrial Organic Chemicals', nr_employees: 180, fatalities: 0, hospitalizations: 2 },
    { activity_nr: '1122334455', estab_name: 'Construction Contractors LLC', latitude: 36.8485, longitude: -75.9780, state: 'VA', city: 'Norfolk', inspection_date: '2024-03-10', inspection_type: 'accident', nr_violations: 7, nr_serious: 5, nr_repeat: 2, total_penalties: 120000, primary_sic: '1542', sic_description: 'General Contractors-Nonresidential Buildings', nr_employees: 75, fatalities: 1, hospitalizations: 1 },
  ];
  return mockInspections;
}

export async function buildOSHACacheData(records: OSHARecord[]): Promise<OSHACacheData> {
  // Build spatial index
  const spatialIndex: Record<string, OSHARecord[]> = {};

  const dataTypeDistribution: Record<OSHADataType, number> = { inspection: 0, violation: 0, accident: 0, fatality: 0, complaint: 0, establishment_search: 0 };
  const inspectionTypeDistribution: Record<InspectionType, number> = { programmed: 0, complaint: 0, referral: 0, accident: 0, follow_up: 0, monitoring: 0, variance: 0 };
  const violationTypeDistribution: Record<ViolationType, number> = { serious: 0, willful: 0, repeat: 0, other_than_serious: 0, de_minimis: 0 };
  const industryDistribution: Record<IndustryCategory, number> = { construction: 0, manufacturing: 0, healthcare: 0, retail: 0, transportation: 0, utilities: 0, government: 0, services: 0 };
  const stateDistribution: Record<string, number> = {};

  let totalViolations = 0; let totalPenalties = 0; let totalFatalities = 0; let totalInjuries = 0;
  let defenseContractors = 0; let federalFacilities = 0; let nearMilitaryInstallations = 0; let environmentallyRelatedIncidents = 0;
  let earliestYear = new Date().getFullYear(); let latestYear = 1900;

  // Add military proximity analysis
  const enrichedRecords = await Promise.all(records.map(async record => {
    if (record.location.lat && record.location.lng) {
      const enriched = await addMilitaryProximity(record);
      if (enriched.proximityToMilitary?.isNearBase) {
        enriched.oshaSpecific.militaryRelevance.nearMilitaryInstallation = true;
      }
      return enriched;
    }
    return record;
  }));

  enrichedRecords.forEach(record => {
    // Spatial indexing
    const grid = gridKey(record.location.lat, record.location.lng);
    if (!spatialIndex[grid]) spatialIndex[grid] = [];
    spatialIndex[grid].push(record);

    // Summary calculations
    dataTypeDistribution[record.oshaSpecific.dataType]++;
    if (record.oshaSpecific.inspectionType) inspectionTypeDistribution[record.oshaSpecific.inspectionType]++;
    industryDistribution[record.oshaSpecific.industryCategory]++;
    stateDistribution[record.location.state] = (stateDistribution[record.location.state] || 0) + 1;

    // Violation type distributions
    violationTypeDistribution.serious += record.oshaSpecific.violations.serious;
    violationTypeDistribution.willful += record.oshaSpecific.violations.willful;
    violationTypeDistribution.repeat += record.oshaSpecific.violations.repeat;
    violationTypeDistribution.other_than_serious += record.oshaSpecific.violations.otherThanSerious;
    violationTypeDistribution.de_minimis += record.oshaSpecific.violations.deMinimis;

    totalViolations += record.oshaSpecific.violations.total;
    totalPenalties += record.oshaSpecific.penalties.total;

    if (record.oshaSpecific.accidentData) {
      totalFatalities += record.oshaSpecific.accidentData.fatalities;
      totalInjuries += record.oshaSpecific.accidentData.hospitalizations + record.oshaSpecific.accidentData.amputations + record.oshaSpecific.accidentData.lossOfEye;
    }

    if (record.oshaSpecific.militaryRelevance.isDefenseContractor) defenseContractors++;
    if (record.oshaSpecific.militaryRelevance.isFederalFacility) federalFacilities++;
    if (record.oshaSpecific.militaryRelevance.nearMilitaryInstallation) nearMilitaryInstallations++;
    if (Object.values(record.oshaSpecific.environmentalCorrelations).some(v => v)) environmentallyRelatedIncidents++;

    if (record.temporal.year < earliestYear) earliestYear = record.temporal.year;
    if (record.temporal.year > latestYear) latestYear = record.temporal.year;
  });

  const uniqueEstablishments = new Set(enrichedRecords.map(r => r.oshaSpecific.establishmentName)).size;

  // Build correlations
  const militaryInstallationProximity = buildMilitaryInstallationProximity(enrichedRecords);
  const environmentalHazardCorrelations = buildEnvironmentalHazardCorrelations(enrichedRecords);
  const industryRiskPatterns = buildIndustryRiskPatterns(enrichedRecords);
  const complianceEffectiveness = buildComplianceEffectiveness(enrichedRecords);

  return {
    records: enrichedRecords,
    spatialIndex,
    summary: {
      totalRecords: enrichedRecords.length,
      totalEstablishments: uniqueEstablishments,
      dataTypeDistribution,
      inspectionTypeDistribution,
      violationTypeDistribution,
      industryDistribution,
      totalViolations,
      totalPenalties: Math.round(totalPenalties),
      totalFatalities,
      totalInjuries,
      defenseContractors,
      federalFacilities,
      nearMilitaryInstallations,
      environmentallyRelatedIncidents,
      stateDistribution,
      yearRange: { earliest: earliestYear, latest: latestYear },
    },
    correlations: { militaryInstallationProximity, environmentalHazardCorrelations, industryRiskPatterns, complianceEffectiveness },
    metadata: { lastUpdated: new Date().toISOString(), dataVersion: '2.0' }
  };
}

function buildMilitaryInstallationProximity(records: OSHARecord[]): any[] {
  return records
    .filter(r => r.proximityToMilitary?.isNearBase)
    .map(record => ({
      activity_nr: record.oshaSpecific.activityNr,
      establishment_name: record.oshaSpecific.establishmentName,
      military_installation: record.proximityToMilitary?.nearestInstallation,
      distance_km: record.proximityToMilitary?.distanceKm,
      industry_category: record.oshaSpecific.industryCategory,
      total_violations: record.oshaSpecific.violations.total,
      total_penalties: record.oshaSpecific.penalties.total,
      is_defense_contractor: record.oshaSpecific.militaryRelevance.isDefenseContractor,
      is_federal_facility: record.oshaSpecific.militaryRelevance.isFederalFacility,
      serious_violations: record.oshaSpecific.violations.serious,
      fatalities: record.oshaSpecific.accidentData?.fatalities || 0,
      inspection_date: record.oshaSpecific.inspectionDate,
    }))
    .sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999))
    .slice(0, 25);
}

function buildEnvironmentalHazardCorrelations(records: OSHARecord[]): any[] {
  return records
    .filter(r => Object.values(r.oshaSpecific.hazardExposure).some(v => v) || Object.values(r.oshaSpecific.environmentalCorrelations).some(v => v))
    .map(record => ({
      activity_nr: record.oshaSpecific.activityNr,
      establishment_name: record.oshaSpecific.establishmentName,
      location: `${record.location.city}, ${record.location.state}`,
      industry_category: record.oshaSpecific.industryCategory,
      hazard_exposures: Object.entries(record.oshaSpecific.hazardExposure)
        .filter(([, value]) => value)
        .map(([key]) => key),
      environmental_correlations: Object.entries(record.oshaSpecific.environmentalCorrelations)
        .filter(([, value]) => value)
        .map(([key]) => key),
      total_violations: record.oshaSpecific.violations.total,
      serious_violations: record.oshaSpecific.violations.serious,
      total_penalties: record.oshaSpecific.penalties.total,
      employee_count: record.oshaSpecific.employeeCount,
    }))
    .sort((a, b) => b.total_penalties - a.total_penalties)
    .slice(0, 20);
}

function buildIndustryRiskPatterns(records: OSHARecord[]): any[] {
  // Analyze risk patterns by industry category
  const industryGroups = new Map<IndustryCategory, OSHARecord[]>();

  records.forEach(record => {
    if (!industryGroups.has(record.oshaSpecific.industryCategory)) {
      industryGroups.set(record.oshaSpecific.industryCategory, []);
    }
    industryGroups.get(record.oshaSpecific.industryCategory)!.push(record);
  });

  const riskPatterns: any[] = [];

  industryGroups.forEach((groupRecords, industry) => {
    if (groupRecords.length >= 3) { // Sufficient sample size
      const totalViolations = groupRecords.reduce((sum, r) => sum + r.oshaSpecific.violations.total, 0);
      const totalPenalties = groupRecords.reduce((sum, r) => sum + r.oshaSpecific.penalties.total, 0);
      const totalFatalities = groupRecords.reduce((sum, r) => sum + (r.oshaSpecific.accidentData?.fatalities || 0), 0);
      const avgViolationsPerEstablishment = totalViolations / groupRecords.length;
      const avgPenaltiesPerEstablishment = totalPenalties / groupRecords.length;

      riskPatterns.push({
        industry_category: industry,
        establishment_count: groupRecords.length,
        total_violations: totalViolations,
        total_penalties: Math.round(totalPenalties),
        total_fatalities: totalFatalities,
        avg_violations_per_establishment: Math.round(avgViolationsPerEstablishment * 10) / 10,
        avg_penalties_per_establishment: Math.round(avgPenaltiesPerEstablishment),
        defense_contractors: groupRecords.filter(r => r.oshaSpecific.militaryRelevance.isDefenseContractor).length,
        near_military: groupRecords.filter(r => r.oshaSpecific.militaryRelevance.nearMilitaryInstallation).length,
      });
    }
  });

  return riskPatterns
    .sort((a, b) => b.avg_penalties_per_establishment - a.avg_penalties_per_establishment)
    .slice(0, 8);
}

function buildComplianceEffectiveness(records: OSHARecord[]): any[] {
  return records
    .filter(r => r.oshaSpecific.complianceHistory.priorInspections || r.oshaSpecific.complianceHistory.voluntaryProtectionProgram)
    .map(record => ({
      activity_nr: record.oshaSpecific.activityNr,
      establishment_name: record.oshaSpecific.establishmentName,
      industry_category: record.oshaSpecific.industryCategory,
      prior_inspections: record.oshaSpecific.complianceHistory.priorInspections,
      prior_violations: record.oshaSpecific.complianceHistory.priorViolations,
      current_violations: record.oshaSpecific.violations.total,
      voluntary_protection_program: record.oshaSpecific.complianceHistory.voluntaryProtectionProgram,
      compliance_assistance: record.oshaSpecific.complianceHistory.complianceAssistance,
      total_penalties: record.oshaSpecific.penalties.total,
      improvement_trend: calculateComplianceImprovement(record.oshaSpecific.complianceHistory, record.oshaSpecific.violations),
    }))
    .sort((a, b) => a.improvement_trend - b.improvement_trend) // Best improvement first
    .slice(0, 15);
}

function calculateComplianceImprovement(complianceHistory: any, currentViolations: any): number {
  const priorViolations = complianceHistory.priorViolations || 0;
  const currentTotal = currentViolations.total || 0;

  if (priorViolations === 0) return 0; // No comparison possible

  return ((priorViolations - currentTotal) / priorViolations) * 100; // Percentage improvement
}

export function getDefenseContractors(): OSHARecord[] {
  return oshaCache?.records?.filter(r => r.oshaSpecific.militaryRelevance.isDefenseContractor) || [];
}

export function getFederalFacilities(): OSHARecord[] {
  return oshaCache?.records?.filter(r => r.oshaSpecific.militaryRelevance.isFederalFacility) || [];
}

export function getHighRiskEstablishments(): OSHARecord[] {
  return oshaCache?.records?.filter(r =>
    r.oshaSpecific.violations.total >= 5 ||
    r.oshaSpecific.penalties.total >= 50000 ||
    (r.oshaSpecific.accidentData && r.oshaSpecific.accidentData.fatalities > 0)
  ) || [];
}