/**
 * USGS Water Quality Portal Cache
 * National water quality monitoring data from USGS, EPA, and state agencies
 * Part of Tier 1 HHS integration - critical for water quality surveillance intelligence
 */

import { HHSAPIClient, type HHSHealthRecord, addMilitaryProximity, correlateWithWaterViolations } from './hhsDataUtils';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta, gridKey } from './cacheUtils';
import { PRIORITY_STATES } from './constants';

export type WQPDataType = 'physical_chemical' | 'biological' | 'microbiological' | 'toxicological' | 'radiological';
export type WQPSampleMedia = 'Water' | 'Sediment' | 'Tissue' | 'Air' | 'Other';
export type WQPMonitoringType = 'routine' | 'compliance' | 'research' | 'emergency' | 'enforcement';

export interface USGSWQPRecord extends HHSHealthRecord {
  wqpSpecific: {
    siteId: string;
    siteName?: string;
    siteType: string;
    hucCode?: string;
    waterbodyName?: string;
    monitoringLocationId: string;
    organizationId: string;
    dataType: WQPDataType;
    characteristicName: string;
    resultValue?: number;
    resultUnit: string;
    detectionLimit?: number;
    exceedsStandard: boolean;
    sampleMedia: WQPSampleMedia;
    sampleDepth?: number;
    monitoringType: WQPMonitoringType;
    qualityAssurance: 'passed' | 'flagged' | 'rejected';
    sampleDateTime: string;
    analyticMethod?: string;
    laboratoryId?: string;
    projectId?: string;
    healthRisk: 'negligible' | 'low' | 'moderate' | 'high' | 'critical';
    complianceStatus: 'compliant' | 'violation' | 'not_regulated' | 'unknown';
  };
}

interface USGSWQPCacheData {
  records: USGSWQPRecord[];
  spatialIndex: Record<string, USGSWQPRecord[]>;
  summary: {
    totalSamples: number;
    uniqueSites: number;
    dataTypeDistribution: Record<WQPDataType, number>;
    mediaBreakdown: Record<WQPSampleMedia, number>;
    monitoringTypeDistribution: Record<WQPMonitoringType, number>;
    complianceViolations: number;
    exceedsStandardCount: number;
    highRiskResults: number;
    criticalRiskResults: number;
    stateDistribution: Record<string, number>;
    dateRange: { earliest: string; latest: string; };
  };
  correlations: {
    militaryProximityAlerts: any[];
    healthRiskCorrelations: any[];
    complianceViolationClusters: any[];
  };
  metadata: { lastUpdated: string; dataVersion: string; };
}

let usgsWqpCache: USGSWQPCacheData | null = null;
let lastFetched: string | null = null;
let _buildInProgress = false;
let _buildStartedAt: string | null = null;
let _usgsWqpCacheLoaded = false;
let _lastDelta: CacheDelta | null = null;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
const CACHE_FILE = 'usgs-wqp.json';

export function getUSGSWQPCacheStatus() {
  return {
    loaded: _usgsWqpCacheLoaded && usgsWqpCache !== null,
    built: lastFetched,
    recordCount: usgsWqpCache?.records?.length || 0,
    criticalAlerts: usgsWqpCache?.summary?.criticalRiskResults || 0,
    buildInProgress: isBuildInProgress(),
    lastDelta: _lastDelta,
  };
}

export function getUSGSWQPCache(): USGSWQPRecord[] { return usgsWqpCache?.records || []; }

export async function setUSGSWQPCache(data: USGSWQPCacheData): Promise<void> {
  if (!data.records?.length) { console.warn('No USGS WQP data to cache'); return; }
  const prevCounts = usgsWqpCache ? { recordCount: usgsWqpCache.summary.totalSamples } : null;
  _lastDelta = computeCacheDelta(prevCounts, { recordCount: data.summary.totalSamples }, lastFetched);
  usgsWqpCache = data; lastFetched = new Date().toISOString(); _usgsWqpCacheLoaded = true;
  await saveToDisk(data); await saveCacheToBlob(CACHE_FILE, data);
}

export function setBuildInProgress(inProgress: boolean): void { _buildInProgress = inProgress; _buildStartedAt = inProgress ? new Date().toISOString() : null; }
export function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;
  if (_buildStartedAt && Date.now() - new Date(_buildStartedAt).getTime() > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('USGS WQP build lock expired'); _buildInProgress = false; _buildStartedAt = null; return false;
  }
  return _buildInProgress;
}

export async function ensureWarmed(): Promise<void> {
  if (_usgsWqpCacheLoaded) return;
  try {
    const diskData = await loadFromDisk();
    if (diskData?.records?.length) { usgsWqpCache = diskData; _usgsWqpCacheLoaded = true; return; }
  } catch (e) { console.warn('USGS WQP disk load failed:', e); }
  try {
    const blobData = await loadCacheFromBlob<USGSWQPCacheData>(CACHE_FILE);
    if (blobData?.records?.length) { usgsWqpCache = blobData; _usgsWqpCacheLoaded = true; await saveToDisk(blobData); }
  } catch (e) { console.warn('USGS WQP blob load failed:', e); }
}

async function loadFromDisk(): Promise<USGSWQPCacheData | null> {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs'); const path = require('path');
    const file = path.join(process.cwd(), '.cache', CACHE_FILE);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!data?.records) return null;
    console.log(`[USGS WQP Cache] Loaded from disk (${data.records.length} records)`);
    return data;
  } catch (e) { return null; }
}

async function saveToDisk(data: USGSWQPCacheData): Promise<void> {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs'); const path = require('path');
    const cacheDir = path.join(process.cwd(), '.cache'); const file = path.join(cacheDir, CACHE_FILE);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
    console.log(`[USGS WQP Cache] Saved to disk (${data.records.length} records)`);
  } catch (e) { console.warn('USGS WQP disk save failed:', e); }
}

export function processUSGSWQPData(rawRecords: any[]): USGSWQPRecord[] {
  return rawRecords.map(raw => ({
    id: `usgs_wqp_${raw.ResultIdentifier || raw.ActivityIdentifier || Date.now()}`,
    source: 'usgs_wqp',
    location: {
      lat: parseFloat(raw.LatitudeMeasure || raw.latitude || 0),
      lng: parseFloat(raw.LongitudeMeasure || raw.longitude || 0),
      state: raw.StateCode || raw.state || 'Unknown',
      county: raw.CountyCode || raw.county,
      city: raw.MonitoringLocationName?.split(' ')[0] || raw.city,
    },
    temporal: {
      reportDate: raw.ActivityStartDate || raw.sample_date || new Date().toISOString(),
      year: new Date(raw.ActivityStartDate || new Date()).getFullYear(),
    },
    healthMetrics: [{
      category: 'water_quality',
      measure: raw.CharacteristicName || 'unknown_parameter',
      value: parseFloat(raw.ResultMeasureValue || raw.result_value || 0),
      unit: raw.ResultMeasure?.MeasureUnitCode || raw.result_unit || 'unknown',
    }],
    wqpSpecific: {
      siteId: raw.MonitoringLocationIdentifier || raw.site_id || 'unknown_site',
      siteName: raw.MonitoringLocationName || raw.site_name,
      siteType: raw.MonitoringLocationTypeName || raw.site_type || 'unknown',
      hucCode: raw.HydrologicUnit || raw.huc_code,
      waterbodyName: raw.MonitoringLocationName || raw.waterbody_name,
      monitoringLocationId: raw.MonitoringLocationIdentifier || raw.monitoring_location_id || 'unknown',
      organizationId: raw.OrganizationIdentifier || raw.organization_id || 'unknown',
      dataType: categorizeWQPDataType(raw.CharacteristicName, raw.ActivityTypeCode),
      characteristicName: raw.CharacteristicName || raw.characteristic_name || 'unknown_parameter',
      resultValue: parseFloat(raw.ResultMeasureValue || raw.result_value) || undefined,
      resultUnit: raw.ResultMeasure?.MeasureUnitCode || raw.result_unit || 'unknown',
      detectionLimit: parseFloat(raw.DetectionQuantitationLimitMeasure?.MeasureValue || raw.detection_limit) || undefined,
      exceedsStandard: checkExceedsStandard(raw.CharacteristicName, parseFloat(raw.ResultMeasureValue)),
      sampleMedia: normalizeSampleMedia(raw.ActivityMediaName || raw.sample_media),
      sampleDepth: parseFloat(raw.ActivityDepthHeightMeasure?.MeasureValue || raw.sample_depth) || undefined,
      monitoringType: determineMonitoringType(raw.ActivityTypeCode, raw.ProjectIdentifier),
      qualityAssurance: determineQAStatus(raw.ResultStatusIdentifier, raw.ResultValueTypeName),
      sampleDateTime: raw.ActivityStartDate || raw.sample_date || new Date().toISOString(),
      analyticMethod: raw.ResultAnalyticalMethod?.MethodIdentifier || raw.analytic_method,
      laboratoryId: raw.ResultLaboratoryName || raw.laboratory_id,
      projectId: raw.ProjectIdentifier || raw.project_id,
      healthRisk: assessHealthRisk(raw.CharacteristicName, parseFloat(raw.ResultMeasureValue)),
      complianceStatus: determineComplianceStatus(raw.CharacteristicName, parseFloat(raw.ResultMeasureValue)),
    }
  }));
}

function categorizeWQPDataType(characteristicName: string, activityType: string): WQPDataType {
  const char = (characteristicName || '').toLowerCase();
  const activity = (activityType || '').toLowerCase();

  if (char.includes('bacteria') || char.includes('coliform') || char.includes('e. coli')) return 'microbiological';
  if (char.includes('metal') || char.includes('pesticide') || char.includes('chemical')) return 'toxicological';
  if (char.includes('radioact') || char.includes('uranium') || char.includes('radon')) return 'radiological';
  if (char.includes('algae') || char.includes('chlorophyll') || activity.includes('biological')) return 'biological';
  return 'physical_chemical';
}

function normalizeSampleMedia(media: string): WQPSampleMedia {
  const m = (media || '').toLowerCase();
  if (m.includes('water')) return 'Water';
  if (m.includes('sediment')) return 'Sediment';
  if (m.includes('tissue')) return 'Tissue';
  if (m.includes('air')) return 'Air';
  return 'Other';
}

function determineMonitoringType(activityType: string, projectId: string): WQPMonitoringType {
  const activity = (activityType || '').toLowerCase();
  const project = (projectId || '').toLowerCase();

  if (activity.includes('emergency') || project.includes('emergency')) return 'emergency';
  if (activity.includes('enforcement') || project.includes('enforcement')) return 'enforcement';
  if (activity.includes('research') || project.includes('research')) return 'research';
  if (activity.includes('compliance') || project.includes('compliance')) return 'compliance';
  return 'routine';
}

function determineQAStatus(status: string, valueType: string): 'passed' | 'flagged' | 'rejected' {
  const s = (status || '').toLowerCase();
  const vt = (valueType || '').toLowerCase();

  if (s.includes('rejected') || s.includes('invalid') || vt.includes('rejected')) return 'rejected';
  if (s.includes('flag') || s.includes('questionable') || vt.includes('estimated')) return 'flagged';
  return 'passed';
}

function checkExceedsStandard(characteristic: string, value: number): boolean {
  if (!characteristic || isNaN(value)) return false;

  const char = characteristic.toLowerCase();
  const standards: Record<string, number> = {
    'lead': 0.015,
    'arsenic': 0.01,
    'mercury': 0.002,
    'nitrate': 10,
    'e. coli': 235,
    'fecal coliform': 400,
    'ph': 8.5, // Upper limit, check separately for lower
  };

  for (const [param, limit] of Object.entries(standards)) {
    if (char.includes(param)) {
      if (param === 'ph') return value < 6.5 || value > 8.5;
      return value > limit;
    }
  }

  return false;
}

function assessHealthRisk(characteristic: string, value: number): 'negligible' | 'low' | 'moderate' | 'high' | 'critical' {
  if (!characteristic || isNaN(value)) return 'negligible';

  const char = characteristic.toLowerCase();

  // High-risk contaminants
  if (char.includes('e. coli') && value > 1000) return 'critical';
  if (char.includes('lead') && value > 0.05) return 'critical';
  if (char.includes('arsenic') && value > 0.05) return 'high';
  if (char.includes('mercury') && value > 0.01) return 'high';
  if (char.includes('nitrate') && value > 20) return 'high';

  // Moderate risk levels
  if (checkExceedsStandard(characteristic, value)) return 'moderate';

  return value > 0 ? 'low' : 'negligible';
}

function determineComplianceStatus(characteristic: string, value: number): 'compliant' | 'violation' | 'not_regulated' | 'unknown' {
  if (!characteristic || isNaN(value)) return 'unknown';

  const exceeds = checkExceedsStandard(characteristic, value);
  if (exceeds) return 'violation';

  const char = characteristic.toLowerCase();
  const regulatedParams = ['lead', 'arsenic', 'mercury', 'nitrate', 'e. coli', 'fecal coliform', 'ph', 'chlorine'];
  const isRegulated = regulatedParams.some(param => char.includes(param));

  return isRegulated ? 'compliant' : 'not_regulated';
}

export async function fetchUSGSWQPData(): Promise<any[]> {
  // Mock USGS WQP data - in practice would fetch from Water Quality Portal API
  const currentDate = new Date();
  const mockSamples = [
    { ResultIdentifier: '1', MonitoringLocationIdentifier: 'USGS-01234567', MonitoringLocationName: 'Potomac River at Chain Bridge', LatitudeMeasure: 38.9296, LongitudeMeasure: -77.1143, StateCode: 'DC', ActivityStartDate: new Date(currentDate.getTime() - 86400000).toISOString(), CharacteristicName: 'Lead', ResultMeasureValue: '0.008', ResultMeasure: { MeasureUnitCode: 'mg/l' }, OrganizationIdentifier: 'USGS-MD', ActivityTypeCode: 'Sample-Routine', ActivityMediaName: 'Water' },
    { ResultIdentifier: '2', MonitoringLocationIdentifier: 'EPA-09876543', MonitoringLocationName: 'Chesapeake Bay Monitoring Station', LatitudeMeasure: 38.7851, LongitudeMeasure: -76.4721, StateCode: 'MD', ActivityStartDate: new Date(currentDate.getTime() - 172800000).toISOString(), CharacteristicName: 'E. coli', ResultMeasureValue: '180', ResultMeasure: { MeasureUnitCode: 'CFU/100ml' }, OrganizationIdentifier: 'EPA-R3', ActivityTypeCode: 'Sample-Compliance', ActivityMediaName: 'Water' },
    { ResultIdentifier: '3', MonitoringLocationIdentifier: 'USGS-11223344', MonitoringLocationName: 'Great Lakes Water Intake', LatitudeMeasure: 41.8781, LongitudeMeasure: -87.6298, StateCode: 'IL', ActivityStartDate: new Date(currentDate.getTime() - 259200000).toISOString(), CharacteristicName: 'PFOA', ResultMeasureValue: '0.000012', ResultMeasure: { MeasureUnitCode: 'mg/l' }, OrganizationIdentifier: 'USEPA', ActivityTypeCode: 'Sample-Research', ActivityMediaName: 'Water' },
  ];
  return mockSamples;
}

export async function buildUSGSWQPCacheData(records: USGSWQPRecord[], waterViolations: any[] = []): Promise<USGSWQPCacheData> {
  // Build spatial index
  const spatialIndex: Record<string, USGSWQPRecord[]> = {};

  const dataTypeDistribution: Record<WQPDataType, number> = { physical_chemical: 0, biological: 0, microbiological: 0, toxicological: 0, radiological: 0 };
  const mediaBreakdown: Record<WQPSampleMedia, number> = { Water: 0, Sediment: 0, Tissue: 0, Air: 0, Other: 0 };
  const monitoringTypeDistribution: Record<WQPMonitoringType, number> = { routine: 0, compliance: 0, research: 0, emergency: 0, enforcement: 0 };
  const stateDistribution: Record<string, number> = {};

  let complianceViolations = 0; let exceedsStandardCount = 0; let highRiskResults = 0; let criticalRiskResults = 0;
  let earliestDate = new Date().toISOString(); let latestDate = '1900-01-01T00:00:00.000Z';

  // Add military proximity analysis
  const enrichedRecords = await Promise.all(records.map(async record => {
    if (record.location.lat && record.location.lng) {
      return await addMilitaryProximity(record);
    }
    return record;
  }));

  enrichedRecords.forEach(record => {
    // Spatial indexing
    const grid = gridKey(record.location.lat, record.location.lng);
    if (!spatialIndex[grid]) spatialIndex[grid] = [];
    spatialIndex[grid].push(record);

    // Summary calculations
    dataTypeDistribution[record.wqpSpecific.dataType]++;
    mediaBreakdown[record.wqpSpecific.sampleMedia]++;
    monitoringTypeDistribution[record.wqpSpecific.monitoringType]++;
    stateDistribution[record.location.state] = (stateDistribution[record.location.state] || 0) + 1;

    if (record.wqpSpecific.complianceStatus === 'violation') complianceViolations++;
    if (record.wqpSpecific.exceedsStandard) exceedsStandardCount++;
    if (record.wqpSpecific.healthRisk === 'high') highRiskResults++;
    if (record.wqpSpecific.healthRisk === 'critical') criticalRiskResults++;

    // Date range tracking
    const sampleDate = record.wqpSpecific.sampleDateTime;
    if (sampleDate < earliestDate) earliestDate = sampleDate;
    if (sampleDate > latestDate) latestDate = sampleDate;
  });

  const uniqueSites = new Set(enrichedRecords.map(r => r.wqpSpecific.siteId)).size;

  // Build correlations
  const militaryProximityAlerts = buildMilitaryProximityAlerts(enrichedRecords);
  const healthRiskCorrelations = buildHealthRiskCorrelations(enrichedRecords);
  const complianceViolationClusters = buildComplianceViolationClusters(enrichedRecords);

  return {
    records: enrichedRecords,
    spatialIndex,
    summary: {
      totalSamples: enrichedRecords.length,
      uniqueSites,
      dataTypeDistribution,
      mediaBreakdown,
      monitoringTypeDistribution,
      complianceViolations,
      exceedsStandardCount,
      highRiskResults,
      criticalRiskResults,
      stateDistribution,
      dateRange: { earliest: earliestDate, latest: latestDate },
    },
    correlations: { militaryProximityAlerts, healthRiskCorrelations, complianceViolationClusters },
    metadata: { lastUpdated: new Date().toISOString(), dataVersion: '2.0' }
  };
}

function buildMilitaryProximityAlerts(records: USGSWQPRecord[]): any[] {
  return records
    .filter(r => r.proximityToMilitary?.isNearBase && ['high', 'critical'].includes(r.wqpSpecific.healthRisk))
    .map(record => ({
      site_id: record.wqpSpecific.siteId,
      site_name: record.wqpSpecific.siteName,
      characteristic: record.wqpSpecific.characteristicName,
      result_value: record.wqpSpecific.resultValue,
      health_risk: record.wqpSpecific.healthRisk,
      compliance_status: record.wqpSpecific.complianceStatus,
      military_installation: record.proximityToMilitary?.nearestInstallation,
      distance_km: record.proximityToMilitary?.distanceKm,
      sample_date: record.wqpSpecific.sampleDateTime,
      location: `${record.location.city || 'Unknown'}, ${record.location.state}`,
    }))
    .sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999))
    .slice(0, 20);
}

function buildHealthRiskCorrelations(records: USGSWQPRecord[]): any[] {
  return records
    .filter(r => ['high', 'critical'].includes(r.wqpSpecific.healthRisk))
    .map(record => ({
      characteristic: record.wqpSpecific.characteristicName,
      result_value: record.wqpSpecific.resultValue,
      result_unit: record.wqpSpecific.resultUnit,
      health_risk: record.wqpSpecific.healthRisk,
      exceeds_standard: record.wqpSpecific.exceedsStandard,
      site_type: record.wqpSpecific.siteType,
      waterbody: record.wqpSpecific.waterbodyName,
      state: record.location.state,
      sample_date: record.wqpSpecific.sampleDateTime,
    }))
    .sort((a, b) => {
      const riskOrder = { critical: 2, high: 1 };
      return (riskOrder[b.health_risk as keyof typeof riskOrder] || 0) - (riskOrder[a.health_risk as keyof typeof riskOrder] || 0);
    })
    .slice(0, 25);
}

function buildComplianceViolationClusters(records: USGSWQPRecord[]): any[] {
  const violations = records.filter(r => r.wqpSpecific.complianceStatus === 'violation');

  // Group violations by state and characteristic
  const violationGroups = new Map<string, any[]>();

  violations.forEach(record => {
    const key = `${record.location.state}_${record.wqpSpecific.characteristicName}`;
    if (!violationGroups.has(key)) {
      violationGroups.set(key, []);
    }
    violationGroups.get(key)!.push(record);
  });

  const clusters: any[] = [];
  violationGroups.forEach((groupViolations, key) => {
    if (groupViolations.length >= 2) { // Cluster threshold
      const [state, characteristic] = key.split('_');
      clusters.push({
        state,
        characteristic,
        violation_count: groupViolations.length,
        avg_value: groupViolations.reduce((sum, v) => sum + (v.wqpSpecific.resultValue || 0), 0) / groupViolations.length,
        unique_sites: new Set(groupViolations.map(v => v.wqpSpecific.siteId)).size,
        date_range: {
          earliest: Math.min(...groupViolations.map(v => new Date(v.wqpSpecific.sampleDateTime).getTime())),
          latest: Math.max(...groupViolations.map(v => new Date(v.wqpSpecific.sampleDateTime).getTime())),
        },
        military_proximity: groupViolations.some(v => v.proximityToMilitary?.isNearBase),
      });
    }
  });

  return clusters
    .sort((a, b) => b.violation_count - a.violation_count)
    .slice(0, 15);
}

export function getWaterQualityViolations(): USGSWQPRecord[] {
  return usgsWqpCache?.records?.filter(r => r.wqpSpecific.complianceStatus === 'violation') || [];
}

export function getCriticalWaterQualityAlerts(): USGSWQPRecord[] {
  return usgsWqpCache?.records?.filter(r => r.wqpSpecific.healthRisk === 'critical') || [];
}

export function getMilitaryProximityWaterIssues(): USGSWQPRecord[] {
  return usgsWqpCache?.records?.filter(r =>
    r.proximityToMilitary?.isNearBase &&
    ['high', 'critical'].includes(r.wqpSpecific.healthRisk)
  ) || [];
}