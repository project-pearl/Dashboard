/**
 * FDA MAUDE (Medical Device Reports) Cache
 * Medical device adverse events, malfunctions, and safety surveillance
 * Part of Tier 2 HHS integration - critical for device safety and healthcare correlations
 */

import { HHSAPIClient, type HHSHealthRecord, addMilitaryProximity, correlateWithWaterViolations } from './hhsDataUtils';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta, gridKey } from './cacheUtils';

export type MAUDEReportType = 'malfunction' | 'injury' | 'death' | 'other';
export type DeviceClass = 'class_i' | 'class_ii' | 'class_iii' | 'unclassified';
export type ReportSource = 'manufacturer' | 'user_facility' | 'distributor' | 'consumer' | 'other';
export type DeviceCategory = 'cardiovascular' | 'orthopedic' | 'neurological' | 'radiology' | 'surgical' | 'anesthesiology' | 'general_hospital' | 'other';

export interface FDAMAUDERecord extends HHSHealthRecord {
  fdaMaudeSpecific: {
    mdrReportKey: string;
    eventKey?: string;
    reportNumber?: string;
    reportType: MAUDEReportType;
    reportSource: ReportSource;
    reportDate: string;
    eventDate?: string;
    deviceInformation: {
      brandName?: string;
      genericName?: string;
      manufacturerName?: string;
      deviceClass: DeviceClass;
      productCode?: string;
      deviceCategory: DeviceCategory;
      modelNumber?: string;
      serialNumber?: string;
      lotNumber?: string;
      deviceOperator?: 'physician' | 'nurse' | 'patient' | 'technician' | 'other' | 'unknown';
      singleUse: boolean;
      implanted: boolean;
    };
    adverseEventDescription: {
      eventDescription?: string;
      patientProblem?: string;
      deviceProblem?: string;
      patientSequence?: string;
      deviceSequence?: string;
      remedialAction?: string;
    };
    patientInformation?: {
      age?: number;
      gender?: 'male' | 'female' | 'unknown';
      weight?: number;
      patientOutcome?: 'death' | 'life_threatening' | 'hospitalization' | 'disability' | 'other' | 'unknown';
      treatmentRequired?: boolean;
    };
    facilityInformation?: {
      facilityName?: string;
      facilityType?: 'hospital' | 'clinic' | 'home' | 'ambulatory' | 'nursing_home' | 'other';
      reporterOccupation?: string;
      initialReporter?: string;
    };
    regulatoryInformation: {
      preMarketApprovalNumber?: string;
      clearanceNumber?: string;
      exemptionNumber?: string;
      deviceRecalled: boolean;
      recallNumber?: string;
      feiNumber?: string;
    };
    militaryRelevance: {
      militaryHospitalReported: boolean;
      veteranAffairsReported: boolean;
      defenseContractorDevice: boolean;
      militaryUseDevice: boolean;
      battlefieldMedicine: boolean;
    };
    environmentalFactors: {
      waterExposureRelated: boolean;
      temperatureExposureRelated: boolean;
      chemicalExposureRelated: boolean;
      radiationExposureRelated: boolean;
      environmentalContamination: boolean;
    };
    reportingCompliance: {
      timelinessScore: number; // 1-100 score based on reporting timeframe
      reportQuality: 'poor' | 'fair' | 'good' | 'excellent';
      followUpRequired: boolean;
      manufacturerResponse?: string;
    };
    reportingPeriod: string;
    lastUpdated: string;
  };
}

interface FDAMAUDECacheData {
  records: FDAMAUDERecord[];
  spatialIndex: Record<string, FDAMAUDERecord[]>;
  summary: {
    totalReports: number;
    reportTypeDistribution: Record<MAUDEReportType, number>;
    deviceClassDistribution: Record<DeviceClass, number>;
    deviceCategoryDistribution: Record<DeviceCategory, number>;
    reportSourceDistribution: Record<ReportSource, number>;
    totalDeaths: number;
    totalInjuries: number;
    totalMalfunctions: number;
    recalledDevices: number;
    militaryRelatedReports: number;
    environmentallyRelatedReports: number;
    highRiskDevices: number;
    implantedDeviceEvents: number;
    stateDistribution: Record<string, number>;
    topManufacturers: { manufacturer: string; reportCount: number; }[];
    topDeviceProblems: { problem: string; count: number; }[];
  };
  correlations: {
    militaryFacilityReports: any[];
    environmentalExposureCorrelations: any[];
    deviceSafetyTrends: any[];
    manufacturerPerformanceAnalysis: any[];
  };
  metadata: { lastUpdated: string; dataVersion: string; };
}

let fdaMaudeCache: FDAMAUDECacheData | null = null;
let lastFetched: string | null = null;
let _buildInProgress = false;
let _buildStartedAt: string | null = null;
let _fdaMaudeCacheLoaded = false;
let _lastDelta: CacheDelta | null = null;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
const CACHE_FILE = 'fda-maude.json';

export function getFDAMAUDECacheStatus() {
  return {
    loaded: _fdaMaudeCacheLoaded && fdaMaudeCache !== null,
    built: lastFetched,
    recordCount: fdaMaudeCache?.records?.length || 0,
    militaryRelatedReports: fdaMaudeCache?.summary?.militaryRelatedReports || 0,
    buildInProgress: isBuildInProgress(),
    lastDelta: _lastDelta,
  };
}

export function getFDAMAUDECache(): FDAMAUDERecord[] { return fdaMaudeCache?.records || []; }

export async function setFDAMAUDECache(data: FDAMAUDECacheData): Promise<void> {
  if (!data.records?.length) { console.warn('No FDA MAUDE data to cache'); return; }
  const prevCounts = fdaMaudeCache ? { recordCount: fdaMaudeCache.summary.totalReports } : null;
  _lastDelta = computeCacheDelta(prevCounts, { recordCount: data.summary.totalReports }, lastFetched);
  fdaMaudeCache = data; lastFetched = new Date().toISOString(); _fdaMaudeCacheLoaded = true;
  await saveToDisk(data); await saveCacheToBlob(CACHE_FILE, data);
}

export function setBuildInProgress(inProgress: boolean): void { _buildInProgress = inProgress; _buildStartedAt = inProgress ? new Date().toISOString() : null; }
export function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;
  if (_buildStartedAt && Date.now() - new Date(_buildStartedAt).getTime() > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('FDA MAUDE build lock expired'); _buildInProgress = false; _buildStartedAt = null; return false;
  }
  return _buildInProgress;
}

export async function ensureWarmed(): Promise<void> {
  if (_fdaMaudeCacheLoaded) return;
  try {
    const diskData = await loadFromDisk();
    if (diskData?.records?.length) { fdaMaudeCache = diskData; _fdaMaudeCacheLoaded = true; return; }
  } catch (e) { console.warn('FDA MAUDE disk load failed:', e); }
  try {
    const blobData = await loadCacheFromBlob<FDAMAUDECacheData>(CACHE_FILE);
    if (blobData?.records?.length) { fdaMaudeCache = blobData; _fdaMaudeCacheLoaded = true; await saveToDisk(blobData); }
  } catch (e) { console.warn('FDA MAUDE blob load failed:', e); }
}

async function loadFromDisk(): Promise<FDAMAUDECacheData | null> {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs'); const path = require('path');
    const file = path.join(process.cwd(), '.cache', CACHE_FILE);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!data?.records) return null;
    console.log(`[FDA MAUDE Cache] Loaded from disk (${data.records.length} records)`);
    return data;
  } catch (e) { return null; }
}

async function saveToDisk(data: FDAMAUDECacheData): Promise<void> {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs'); const path = require('path');
    const cacheDir = path.join(process.cwd(), '.cache'); const file = path.join(cacheDir, CACHE_FILE);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
    console.log(`[FDA MAUDE Cache] Saved to disk (${data.records.length} records)`);
  } catch (e) { console.warn('FDA MAUDE disk save failed:', e); }
}

export function processFDAMAUDEData(rawRecords: any[]): FDAMAUDERecord[] {
  return rawRecords.map(raw => ({
    id: `fda_maude_${raw.mdr_report_key || raw.event_key || raw.id || Date.now()}`,
    source: 'fda_maude',
    location: extractLocationFromReport(raw),
    temporal: {
      reportDate: raw.report_date || raw.date_received || new Date().toISOString(),
      year: extractYearFromDate(raw.report_date || raw.date_received || raw.event_date),
    },
    healthMetrics: [{
      category: 'device_safety',
      measure: 'adverse_event_severity',
      value: calculateSeverityScore(raw.report_type, raw.patient_outcome),
      unit: 'severity_score',
    }],
    fdaMaudeSpecific: {
      mdrReportKey: raw.mdr_report_key || raw.report_key || 'unknown',
      eventKey: raw.event_key,
      reportNumber: raw.report_number,
      reportType: normalizeReportType(raw.report_type || raw.event_type),
      reportSource: normalizeReportSource(raw.report_source || raw.reporter_type),
      reportDate: raw.report_date || raw.date_received || new Date().toISOString(),
      eventDate: raw.event_date || raw.date_of_event,
      deviceInformation: {
        brandName: raw.brand_name || raw.device_brand_name,
        genericName: raw.generic_name || raw.device_generic_name,
        manufacturerName: raw.manufacturer_name || raw.manufacturer,
        deviceClass: normalizeDeviceClass(raw.device_class || raw.regulation_number),
        productCode: raw.product_code,
        deviceCategory: categorizeDevice(raw.generic_name, raw.product_code, raw.device_class),
        modelNumber: raw.model_number,
        serialNumber: raw.serial_number,
        lotNumber: raw.lot_number || raw.catalog_number,
        deviceOperator: normalizeDeviceOperator(raw.device_operator),
        singleUse: parseBoolean(raw.single_use_flag),
        implanted: parseBoolean(raw.implant_flag),
      },
      adverseEventDescription: {
        eventDescription: raw.event_description || raw.foi_text,
        patientProblem: raw.patient_problem_code || raw.patient_problem,
        deviceProblem: raw.device_problem_code || raw.device_problem,
        patientSequence: raw.patient_sequence_number,
        deviceSequence: raw.device_sequence_number,
        remedialAction: raw.remedial_action || raw.corrective_action,
      },
      patientInformation: raw.patient_age || raw.patient_sex || raw.patient_outcome ? {
        age: parseFloat(raw.patient_age) || undefined,
        gender: normalizeGender(raw.patient_sex),
        weight: parseFloat(raw.patient_weight) || undefined,
        patientOutcome: normalizePatientOutcome(raw.patient_outcome),
        treatmentRequired: parseBoolean(raw.treatment_required),
      } : undefined,
      facilityInformation: raw.facility_name || raw.reporter_occupation ? {
        facilityName: raw.facility_name || raw.facility,
        facilityType: normalizeFacilityType(raw.facility_type),
        reporterOccupation: raw.reporter_occupation,
        initialReporter: raw.initial_reporter,
      } : undefined,
      regulatoryInformation: {
        preMarketApprovalNumber: raw.pma_number,
        clearanceNumber: raw.clearance_510k_number,
        exemptionNumber: raw.exemption_number,
        deviceRecalled: parseBoolean(raw.device_recalled),
        recallNumber: raw.recall_number,
        feiNumber: raw.fei_number,
      },
      militaryRelevance: {
        militaryHospitalReported: isMilitaryHospital(raw.facility_name, raw.facility_type),
        veteranAffairsReported: isVeteranAffairsReported(raw.facility_name, raw.facility_type),
        defenseContractorDevice: isDefenseContractorDevice(raw.manufacturer_name),
        militaryUseDevice: isMilitaryUseDevice(raw.generic_name, raw.brand_name),
        battlefieldMedicine: isBattlefieldMedicine(raw.generic_name, raw.event_description),
      },
      environmentalFactors: {
        waterExposureRelated: isWaterExposureRelated(raw.event_description, raw.device_problem),
        temperatureExposureRelated: isTemperatureExposureRelated(raw.event_description, raw.device_problem),
        chemicalExposureRelated: isChemicalExposureRelated(raw.event_description, raw.device_problem),
        radiationExposureRelated: isRadiationExposureRelated(raw.event_description, raw.device_problem),
        environmentalContamination: isEnvironmentalContamination(raw.event_description, raw.device_problem),
      },
      reportingCompliance: {
        timelinessScore: calculateTimelinessScore(raw.event_date, raw.report_date),
        reportQuality: assessReportQuality(raw),
        followUpRequired: parseBoolean(raw.follow_up_required),
        manufacturerResponse: raw.manufacturer_response,
      },
      reportingPeriod: extractReportingPeriod(raw.report_date, raw.event_date),
      lastUpdated: raw.last_updated || new Date().toISOString(),
    }
  }));
}

function extractLocationFromReport(raw: any): any {
  return {
    state: raw.facility_state || raw.state || raw.distributor_state || 'Unknown',
    city: raw.facility_city || raw.city || raw.distributor_city,
    zipCode: raw.facility_zip || raw.zip_code || raw.distributor_zip,
  };
}

function extractYearFromDate(dateString: string): number {
  if (!dateString) return new Date().getFullYear();
  try {
    return new Date(dateString).getFullYear();
  } catch {
    return new Date().getFullYear();
  }
}

function calculateSeverityScore(reportType: string, patientOutcome: string): number {
  let score = 0;

  // Base score from report type
  const typeScores: Record<string, number> = { death: 100, injury: 75, malfunction: 25, other: 10 };
  score += typeScores[normalizeReportType(reportType)] || 10;

  // Additional score from patient outcome
  const outcomeScores: Record<string, number> = { death: 50, life_threatening: 40, hospitalization: 30, disability: 20, other: 10 };
  score += outcomeScores[normalizePatientOutcome(patientOutcome)] || 0;

  return Math.min(score, 100);
}

function normalizeReportType(reportType: string): MAUDEReportType {
  const type = (reportType || '').toLowerCase();

  if (type.includes('death') || type.includes('fatal')) return 'death';
  if (type.includes('injury') || type.includes('harm')) return 'injury';
  if (type.includes('malfunction') || type.includes('failure')) return 'malfunction';

  return 'other';
}

function normalizeReportSource(reportSource: string): ReportSource {
  const source = (reportSource || '').toLowerCase();

  if (source.includes('manufacturer')) return 'manufacturer';
  if (source.includes('user facility') || source.includes('facility')) return 'user_facility';
  if (source.includes('distributor')) return 'distributor';
  if (source.includes('consumer') || source.includes('patient')) return 'consumer';

  return 'other';
}

function normalizeDeviceClass(deviceClass: string): DeviceClass {
  const dClass = (deviceClass || '').toLowerCase();

  if (dClass.includes('class i') || dClass.includes('class 1')) return 'class_i';
  if (dClass.includes('class ii') || dClass.includes('class 2')) return 'class_ii';
  if (dClass.includes('class iii') || dClass.includes('class 3')) return 'class_iii';

  return 'unclassified';
}

function categorizeDevice(genericName: string, productCode: string, deviceClass: string): DeviceCategory {
  const combined = `${genericName || ''} ${productCode || ''} ${deviceClass || ''}`.toLowerCase();

  if (combined.includes('cardio') || combined.includes('heart') || combined.includes('pacemaker') || combined.includes('defibrillator')) return 'cardiovascular';
  if (combined.includes('orthopedic') || combined.includes('bone') || combined.includes('joint') || combined.includes('implant')) return 'orthopedic';
  if (combined.includes('neuro') || combined.includes('brain') || combined.includes('spinal') || combined.includes('neural')) return 'neurological';
  if (combined.includes('radio') || combined.includes('imaging') || combined.includes('x-ray') || combined.includes('mri')) return 'radiology';
  if (combined.includes('surgical') || combined.includes('surgery') || combined.includes('operative')) return 'surgical';
  if (combined.includes('anesthes') || combined.includes('sedation') || combined.includes('ventilat')) return 'anesthesiology';
  if (combined.includes('hospital') || combined.includes('general') || combined.includes('ward')) return 'general_hospital';

  return 'other';
}

function normalizeDeviceOperator(deviceOperator: string): 'physician' | 'nurse' | 'patient' | 'technician' | 'other' | 'unknown' {
  const operator = (deviceOperator || '').toLowerCase();

  if (operator.includes('physician') || operator.includes('doctor') || operator.includes('md')) return 'physician';
  if (operator.includes('nurse') || operator.includes('rn')) return 'nurse';
  if (operator.includes('patient') || operator.includes('self')) return 'patient';
  if (operator.includes('technician') || operator.includes('tech')) return 'technician';
  if (operator.includes('unknown') || operator.includes('not')) return 'unknown';

  return 'other';
}

function normalizeGender(gender: string): 'male' | 'female' | 'unknown' {
  const g = (gender || '').toLowerCase();

  if (g.includes('male') && !g.includes('female')) return 'male';
  if (g.includes('female')) return 'female';

  return 'unknown';
}

function normalizePatientOutcome(patientOutcome: string): 'death' | 'life_threatening' | 'hospitalization' | 'disability' | 'other' | 'unknown' {
  const outcome = (patientOutcome || '').toLowerCase();

  if (outcome.includes('death') || outcome.includes('fatal')) return 'death';
  if (outcome.includes('life threatening') || outcome.includes('critical')) return 'life_threatening';
  if (outcome.includes('hospital') || outcome.includes('admission')) return 'hospitalization';
  if (outcome.includes('disability') || outcome.includes('permanent')) return 'disability';
  if (outcome.includes('unknown') || outcome.includes('not')) return 'unknown';

  return 'other';
}

function normalizeFacilityType(facilityType: string): 'hospital' | 'clinic' | 'home' | 'ambulatory' | 'nursing_home' | 'other' {
  const type = (facilityType || '').toLowerCase();

  if (type.includes('hospital')) return 'hospital';
  if (type.includes('clinic')) return 'clinic';
  if (type.includes('home') && !type.includes('nursing')) return 'home';
  if (type.includes('ambulatory') || type.includes('outpatient')) return 'ambulatory';
  if (type.includes('nursing home') || type.includes('long-term')) return 'nursing_home';

  return 'other';
}

function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', 'yes', '1', 'y'].includes(value.toLowerCase());
  return false;
}

function isMilitaryHospital(facilityName: string, facilityType: string): boolean {
  const combined = `${facilityName || ''} ${facilityType || ''}`.toLowerCase();
  return ['military', 'army', 'navy', 'air force', 'walter reed', 'landstuhl', 'dod'].some(keyword => combined.includes(keyword));
}

function isVeteranAffairsReported(facilityName: string, facilityType: string): boolean {
  const combined = `${facilityName || ''} ${facilityType || ''}`.toLowerCase();
  return ['veterans affairs', 'va hospital', 'va medical', 'veterans administration'].some(keyword => combined.includes(keyword));
}

function isDefenseContractorDevice(manufacturerName: string): boolean {
  const manufacturer = (manufacturerName || '').toLowerCase();
  const defenseContractors = ['general electric', 'philips', 'siemens', 'medtronic', 'boston scientific', 'abbott', 'ge healthcare'];
  return defenseContractors.some(contractor => manufacturer.includes(contractor));
}

function isMilitaryUseDevice(genericName: string, brandName: string): boolean {
  const combined = `${genericName || ''} ${brandName || ''}`.toLowerCase();
  return ['military', 'tactical', 'battlefield', 'combat', 'portable', 'field'].some(keyword => combined.includes(keyword));
}

function isBattlefieldMedicine(genericName: string, eventDescription: string): boolean {
  const combined = `${genericName || ''} ${eventDescription || ''}`.toLowerCase();
  return ['battlefield', 'combat', 'trauma', 'emergency', 'field medicine', 'tactical'].some(keyword => combined.includes(keyword));
}

function isWaterExposureRelated(eventDescription: string, deviceProblem: string): boolean {
  const combined = `${eventDescription || ''} ${deviceProblem || ''}`.toLowerCase();
  return ['water', 'moisture', 'humidity', 'liquid', 'fluid', 'wet'].some(keyword => combined.includes(keyword));
}

function isTemperatureExposureRelated(eventDescription: string, deviceProblem: string): boolean {
  const combined = `${eventDescription || ''} ${deviceProblem || ''}`.toLowerCase();
  return ['temperature', 'heat', 'cold', 'thermal', 'overheating', 'freezing'].some(keyword => combined.includes(keyword));
}

function isChemicalExposureRelated(eventDescription: string, deviceProblem: string): boolean {
  const combined = `${eventDescription || ''} ${deviceProblem || ''}`.toLowerCase();
  return ['chemical', 'corrosion', 'contamination', 'cleaning', 'disinfection', 'sterilization'].some(keyword => combined.includes(keyword));
}

function isRadiationExposureRelated(eventDescription: string, deviceProblem: string): boolean {
  const combined = `${eventDescription || ''} ${deviceProblem || ''}`.toLowerCase();
  return ['radiation', 'radioactive', 'x-ray', 'imaging', 'nuclear', 'electromagnetic'].some(keyword => combined.includes(keyword));
}

function isEnvironmentalContamination(eventDescription: string, deviceProblem: string): boolean {
  const combined = `${eventDescription || ''} ${deviceProblem || ''}`.toLowerCase();
  return ['environmental', 'contamination', 'pollution', 'exposure', 'ambient', 'external'].some(keyword => combined.includes(keyword));
}

function calculateTimelinessScore(eventDate: string, reportDate: string): number {
  if (!eventDate || !reportDate) return 50; // Default score for missing data

  try {
    const eventTime = new Date(eventDate).getTime();
    const reportTime = new Date(reportDate).getTime();
    const daysDifference = (reportTime - eventTime) / (1000 * 60 * 60 * 24);

    // FDA expects reports within 30 days for deaths, 24 hours for serious injuries
    if (daysDifference <= 1) return 100;
    if (daysDifference <= 7) return 90;
    if (daysDifference <= 30) return 70;
    if (daysDifference <= 90) return 50;
    return 25;
  } catch {
    return 50;
  }
}

function assessReportQuality(raw: any): 'poor' | 'fair' | 'good' | 'excellent' {
  let score = 0;

  if (raw.event_description && raw.event_description.length > 100) score += 25;
  if (raw.patient_age || raw.patient_sex) score += 15;
  if (raw.device_problem_code || raw.device_problem) score += 20;
  if (raw.manufacturer_name) score += 10;
  if (raw.model_number || raw.serial_number) score += 15;
  if (raw.remedial_action || raw.corrective_action) score += 15;

  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

function extractReportingPeriod(reportDate: string, eventDate: string): string {
  const date = reportDate || eventDate;
  if (!date) return 'unknown';

  try {
    return new Date(date).getFullYear().toString();
  } catch {
    return 'unknown';
  }
}

export async function fetchFDAMAUDEData(): Promise<any[]> {
  // Mock FDA MAUDE data - in practice would fetch from FDA OpenFDA API
  const mockReports = [
    { mdr_report_key: 'MAUDE123456', report_type: 'Death', report_source: 'User Facility', facility_name: 'Walter Reed National Military Medical Center', facility_state: 'MD', manufacturer_name: 'Medtronic Inc', generic_name: 'Cardiac Pacemaker', device_class: 'Class III', patient_age: '67', patient_sex: 'Male', patient_outcome: 'Death', event_description: 'Device malfunction leading to arrhythmia and cardiac arrest', report_date: '2024-02-15', event_date: '2024-02-10' },
    { mdr_report_key: 'MAUDE789012', report_type: 'Injury', report_source: 'Manufacturer', facility_name: 'Veterans Affairs Medical Center', facility_state: 'TX', manufacturer_name: 'Boston Scientific', generic_name: 'Surgical Robot System', device_class: 'Class II', patient_age: '45', patient_sex: 'Female', patient_outcome: 'Hospitalization', event_description: 'Robot arm malfunction during surgery causing tissue damage from water contamination in electronics', report_date: '2024-03-01', event_date: '2024-02-28' },
    { mdr_report_key: 'MAUDE345678', report_type: 'Malfunction', report_source: 'Consumer', facility_type: 'Home', manufacturer_name: 'Philips Healthcare', generic_name: 'Ventilator', device_class: 'Class II', event_description: 'Device stopped functioning due to extreme temperature exposure during transport', report_date: '2024-01-20', event_date: '2024-01-18' },
  ];
  return mockReports;
}

export async function buildFDAMAUDECacheData(records: FDAMAUDERecord[]): Promise<FDAMAUDECacheData> {
  // Build spatial index
  const spatialIndex: Record<string, FDAMAUDERecord[]> = {};

  const reportTypeDistribution: Record<MAUDEReportType, number> = { malfunction: 0, injury: 0, death: 0, other: 0 };
  const deviceClassDistribution: Record<DeviceClass, number> = { class_i: 0, class_ii: 0, class_iii: 0, unclassified: 0 };
  const deviceCategoryDistribution: Record<DeviceCategory, number> = { cardiovascular: 0, orthopedic: 0, neurological: 0, radiology: 0, surgical: 0, anesthesiology: 0, general_hospital: 0, other: 0 };
  const reportSourceDistribution: Record<ReportSource, number> = { manufacturer: 0, user_facility: 0, distributor: 0, consumer: 0, other: 0 };
  const stateDistribution: Record<string, number> = {};

  let totalDeaths = 0; let totalInjuries = 0; let totalMalfunctions = 0; let recalledDevices = 0;
  let militaryRelatedReports = 0; let environmentallyRelatedReports = 0; let highRiskDevices = 0; let implantedDeviceEvents = 0;

  const manufacturerCounts = new Map<string, number>();
  const deviceProblemCounts = new Map<string, number>();

  records.forEach(record => {
    // Spatial indexing by state
    if (record.location.state && record.location.state !== 'Unknown') {
      const stateKey = `state_${record.location.state}`;
      if (!spatialIndex[stateKey]) spatialIndex[stateKey] = [];
      spatialIndex[stateKey].push(record);
    }

    // Summary calculations
    reportTypeDistribution[record.fdaMaudeSpecific.reportType]++;
    deviceClassDistribution[record.fdaMaudeSpecific.deviceInformation.deviceClass]++;
    deviceCategoryDistribution[record.fdaMaudeSpecific.deviceInformation.deviceCategory]++;
    reportSourceDistribution[record.fdaMaudeSpecific.reportSource]++;
    stateDistribution[record.location.state || 'Unknown'] = (stateDistribution[record.location.state || 'Unknown'] || 0) + 1;

    // Count by report type
    if (record.fdaMaudeSpecific.reportType === 'death') totalDeaths++;
    if (record.fdaMaudeSpecific.reportType === 'injury') totalInjuries++;
    if (record.fdaMaudeSpecific.reportType === 'malfunction') totalMalfunctions++;

    if (record.fdaMaudeSpecific.regulatoryInformation.deviceRecalled) recalledDevices++;
    if (Object.values(record.fdaMaudeSpecific.militaryRelevance).some(v => v)) militaryRelatedReports++;
    if (Object.values(record.fdaMaudeSpecific.environmentalFactors).some(v => v)) environmentallyRelatedReports++;
    if (['class_ii', 'class_iii'].includes(record.fdaMaudeSpecific.deviceInformation.deviceClass)) highRiskDevices++;
    if (record.fdaMaudeSpecific.deviceInformation.implanted) implantedDeviceEvents++;

    // Count manufacturers and device problems
    if (record.fdaMaudeSpecific.deviceInformation.manufacturerName) {
      const manufacturer = record.fdaMaudeSpecific.deviceInformation.manufacturerName;
      manufacturerCounts.set(manufacturer, (manufacturerCounts.get(manufacturer) || 0) + 1);
    }

    if (record.fdaMaudeSpecific.adverseEventDescription.deviceProblem) {
      const problem = record.fdaMaudeSpecific.adverseEventDescription.deviceProblem;
      deviceProblemCounts.set(problem, (deviceProblemCounts.get(problem) || 0) + 1);
    }
  });

  // Top manufacturers and device problems
  const topManufacturers = Array.from(manufacturerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([manufacturer, reportCount]) => ({ manufacturer, reportCount }));

  const topDeviceProblems = Array.from(deviceProblemCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([problem, count]) => ({ problem, count }));

  // Build correlations
  const militaryFacilityReports = buildMilitaryFacilityReports(records);
  const environmentalExposureCorrelations = buildEnvironmentalExposureCorrelations(records);
  const deviceSafetyTrends = buildDeviceSafetyTrends(records);
  const manufacturerPerformanceAnalysis = buildManufacturerPerformanceAnalysis(records);

  return {
    records,
    spatialIndex,
    summary: {
      totalReports: records.length,
      reportTypeDistribution,
      deviceClassDistribution,
      deviceCategoryDistribution,
      reportSourceDistribution,
      totalDeaths,
      totalInjuries,
      totalMalfunctions,
      recalledDevices,
      militaryRelatedReports,
      environmentallyRelatedReports,
      highRiskDevices,
      implantedDeviceEvents,
      stateDistribution,
      topManufacturers,
      topDeviceProblems,
    },
    correlations: { militaryFacilityReports, environmentalExposureCorrelations, deviceSafetyTrends, manufacturerPerformanceAnalysis },
    metadata: { lastUpdated: new Date().toISOString(), dataVersion: '2.0' }
  };
}

function buildMilitaryFacilityReports(records: FDAMAUDERecord[]): any[] {
  return records
    .filter(r => Object.values(r.fdaMaudeSpecific.militaryRelevance).some(v => v))
    .map(record => ({
      mdr_report_key: record.fdaMaudeSpecific.mdrReportKey,
      report_type: record.fdaMaudeSpecific.reportType,
      device_name: record.fdaMaudeSpecific.deviceInformation.genericName,
      manufacturer: record.fdaMaudeSpecific.deviceInformation.manufacturerName,
      device_class: record.fdaMaudeSpecific.deviceInformation.deviceClass,
      facility_name: record.fdaMaudeSpecific.facilityInformation?.facilityName,
      military_hospital: record.fdaMaudeSpecific.militaryRelevance.militaryHospitalReported,
      va_reported: record.fdaMaudeSpecific.militaryRelevance.veteranAffairsReported,
      defense_contractor_device: record.fdaMaudeSpecific.militaryRelevance.defenseContractorDevice,
      patient_outcome: record.fdaMaudeSpecific.patientInformation?.patientOutcome,
      event_description: record.fdaMaudeSpecific.adverseEventDescription.eventDescription?.substring(0, 200),
      report_date: record.fdaMaudeSpecific.reportDate,
    }))
    .sort((a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime())
    .slice(0, 20);
}

function buildEnvironmentalExposureCorrelations(records: FDAMAUDERecord[]): any[] {
  return records
    .filter(r => Object.values(r.fdaMaudeSpecific.environmentalFactors).some(v => v))
    .map(record => ({
      mdr_report_key: record.fdaMaudeSpecific.mdrReportKey,
      device_name: record.fdaMaudeSpecific.deviceInformation.genericName,
      manufacturer: record.fdaMaudeSpecific.deviceInformation.manufacturerName,
      environmental_factors: Object.entries(record.fdaMaudeSpecific.environmentalFactors)
        .filter(([, value]) => value)
        .map(([key]) => key),
      report_type: record.fdaMaudeSpecific.reportType,
      device_problem: record.fdaMaudeSpecific.adverseEventDescription.deviceProblem,
      facility_type: record.fdaMaudeSpecific.facilityInformation?.facilityType,
      location: `${record.location.county || 'Unknown'}, ${record.location.state}`,
    }))
    .slice(0, 15);
}

function buildDeviceSafetyTrends(records: FDAMAUDERecord[]): any[] {
  // Group by device category and analyze trends
  const categoryGroups = new Map<DeviceCategory, FDAMAUDERecord[]>();

  records.forEach(record => {
    const category = record.fdaMaudeSpecific.deviceInformation.deviceCategory;
    if (!categoryGroups.has(category)) {
      categoryGroups.set(category, []);
    }
    categoryGroups.get(category)!.push(record);
  });

  const trends: any[] = [];

  categoryGroups.forEach((groupRecords, category) => {
    if (groupRecords.length >= 5) { // Sufficient sample size
      const totalReports = groupRecords.length;
      const deaths = groupRecords.filter(r => r.fdaMaudeSpecific.reportType === 'death').length;
      const injuries = groupRecords.filter(r => r.fdaMaudeSpecific.reportType === 'injury').length;
      const recalls = groupRecords.filter(r => r.fdaMaudeSpecific.regulatoryInformation.deviceRecalled).length;
      const environmentalIssues = groupRecords.filter(r => Object.values(r.fdaMaudeSpecific.environmentalFactors).some(v => v)).length;

      trends.push({
        device_category: category,
        total_reports: totalReports,
        death_reports: deaths,
        injury_reports: injuries,
        recall_count: recalls,
        environmental_issues: environmentalIssues,
        death_rate: Math.round((deaths / totalReports) * 100 * 10) / 10,
        injury_rate: Math.round((injuries / totalReports) * 100 * 10) / 10,
        recall_rate: Math.round((recalls / totalReports) * 100 * 10) / 10,
      });
    }
  });

  return trends
    .sort((a, b) => b.death_rate - a.death_rate)
    .slice(0, 8);
}

function buildManufacturerPerformanceAnalysis(records: FDAMAUDERecord[]): any[] {
  // Group by manufacturer and analyze performance
  const manufacturerGroups = new Map<string, FDAMAUDERecord[]>();

  records.forEach(record => {
    const manufacturer = record.fdaMaudeSpecific.deviceInformation.manufacturerName || 'Unknown';
    if (!manufacturerGroups.has(manufacturer)) {
      manufacturerGroups.set(manufacturer, []);
    }
    manufacturerGroups.get(manufacturer)!.push(record);
  });

  const performance: any[] = [];

  manufacturerGroups.forEach((groupRecords, manufacturer) => {
    if (groupRecords.length >= 3 && manufacturer !== 'Unknown') { // Sufficient sample size
      const totalReports = groupRecords.length;
      const deaths = groupRecords.filter(r => r.fdaMaudeSpecific.reportType === 'death').length;
      const injuries = groupRecords.filter(r => r.fdaMaudeSpecific.reportType === 'injury').length;
      const recalls = groupRecords.filter(r => r.fdaMaudeSpecific.regulatoryInformation.deviceRecalled).length;
      const goodQualityReports = groupRecords.filter(r => ['good', 'excellent'].includes(r.fdaMaudeSpecific.reportingCompliance.reportQuality)).length;
      const avgTimelinessScore = groupRecords.reduce((sum, r) => sum + r.fdaMaudeSpecific.reportingCompliance.timelinessScore, 0) / totalReports;

      performance.push({
        manufacturer,
        total_reports: totalReports,
        death_reports: deaths,
        injury_reports: injuries,
        recall_count: recalls,
        good_quality_reports: goodQualityReports,
        avg_timeliness_score: Math.round(avgTimelinessScore),
        safety_score: calculateManufacturerSafetyScore(totalReports, deaths, injuries, recalls),
      });
    }
  });

  return performance
    .sort((a, b) => a.safety_score - b.safety_score) // Lower score = better safety
    .slice(0, 15);
}

function calculateManufacturerSafetyScore(totalReports: number, deaths: number, injuries: number, recalls: number): number {
  // Higher score = more safety concerns
  let score = 0;

  score += (deaths / totalReports) * 100 * 3; // Weight deaths heavily
  score += (injuries / totalReports) * 100 * 2; // Weight injuries moderately
  score += (recalls / totalReports) * 100; // Weight recalls normally

  return Math.round(score * 10) / 10;
}

export function getMilitaryRelatedReports(): FDAMAUDERecord[] {
  return fdaMaudeCache?.records?.filter(r => Object.values(r.fdaMaudeSpecific.militaryRelevance).some(v => v)) || [];
}

export function getEnvironmentallyRelatedReports(): FDAMAUDERecord[] {
  return fdaMaudeCache?.records?.filter(r => Object.values(r.fdaMaudeSpecific.environmentalFactors).some(v => v)) || [];
}

export function getHighSeverityReports(): FDAMAUDERecord[] {
  return fdaMaudeCache?.records?.filter(r =>
    r.fdaMaudeSpecific.reportType === 'death' ||
    (r.fdaMaudeSpecific.reportType === 'injury' && r.fdaMaudeSpecific.patientInformation?.patientOutcome === 'life_threatening')
  ) || [];
}