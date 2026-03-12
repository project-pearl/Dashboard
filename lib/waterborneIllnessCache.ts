// lib/waterborneIllnessCache.ts
// CDC waterborne illness outbreak surveillance data cache
// Correlates outbreaks with water quality violations for direct health-water quality evidence

import { loadCacheFromDisk, saveCacheToDisk, loadCacheFromBlob, saveCacheToBlob } from './cacheUtils';
import {
  WaterborneOutbreak,
  findNearestInstallation,
  MilitaryInstallationRef,
  validateWaterborneOutbreak,
  correlateOutbreakWithViolations,
} from './healthDataUtils';
import { militaryInstallations } from '../data/military-installations';

// ─── Cache State ─────────────────────────────────────────────────────────────

let outbreakCache: WaterborneOutbreak[] = [];
let _outbreakCacheLoaded = false;
let _buildInProgress = false;
let _buildStartedAt: number | null = null;
let lastFetched: string | null = null;

const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes
const CACHE_FILE = 'waterborne-outbreaks-national';

// ─── Cache Management ────────────────────────────────────────────────────────

export function getWaterborneOutbreakCache(): WaterborneOutbreak[] {
  return outbreakCache;
}

export async function setWaterborneOutbreakCache(outbreaks: WaterborneOutbreak[]): Promise<void> {
  if (outbreaks.length === 0) {
    console.warn('No outbreak data to cache, preserving existing blob');
    return;
  }

  outbreakCache = outbreaks;
  lastFetched = new Date().toISOString();
  _outbreakCacheLoaded = true;

  await saveCacheToDisk(outbreaks, CACHE_FILE);
  await saveCacheToBlob(outbreaks, CACHE_FILE);
}

export function isWaterborneOutbreakCacheLoaded(): boolean {
  return _outbreakCacheLoaded;
}

export function getWaterborneOutbreakCacheStatus() {
  return {
    loaded: _outbreakCacheLoaded,
    count: outbreakCache.length,
    lastFetched,
    buildInProgress: isBuildInProgress(),
    buildStartedAt: _buildStartedAt,
  };
}

// ─── Build Lock Management ───────────────────────────────────────────────────

export function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;

  // Auto-clear expired locks
  if (_buildStartedAt && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('Outbreak cache build lock expired, clearing');
    _buildInProgress = false;
    _buildStartedAt = null;
    return false;
  }

  return true;
}

export function setBuildInProgress(inProgress: boolean): void {
  _buildInProgress = inProgress;
  _buildStartedAt = inProgress ? Date.now() : null;
}

// ─── Cache Warming ───────────────────────────────────────────────────────────

export async function ensureWaterborneOutbreakCacheWarmed(): Promise<void> {
  if (_outbreakCacheLoaded && outbreakCache.length > 0) return;

  try {
    // Try loading from disk first
    const diskData = await loadCacheFromDisk<WaterborneOutbreak[]>(CACHE_FILE);
    if (diskData && diskData.length > 0) {
      outbreakCache = diskData;
      _outbreakCacheLoaded = true;
      console.log(`Outbreak cache warmed from disk: ${diskData.length} outbreaks`);
      return;
    }

    // Fallback to blob storage
    const blobData = await loadCacheFromBlob<WaterborneOutbreak[]>(CACHE_FILE);
    if (blobData && blobData.length > 0) {
      outbreakCache = blobData;
      _outbreakCacheLoaded = true;
      console.log(`Outbreak cache warmed from blob: ${blobData.length} outbreaks`);

      // Save to disk for faster future access
      await saveCacheToDisk(blobData, CACHE_FILE);
      return;
    }

    console.warn('No outbreak cache data available in disk or blob storage');
  } catch (error) {
    console.error('Failed to warm outbreak cache:', error);
  }
}

// ─── Data Processing ─────────────────────────────────────────────────────────

/**
 * Process raw CDC outbreak data and calculate correlations
 */
export function processOutbreakData(
  rawOutbreaks: any[],
  waterViolations: Array<{ id: string; lat?: number; lng?: number; violationDate: string; systemId: string }> = []
): WaterborneOutbreak[] {
  const processedOutbreaks: WaterborneOutbreak[] = [];
  const installations: MilitaryInstallationRef[] = militaryInstallations.map(inst => ({
    id: inst.id,
    name: inst.name,
    lat: inst.lat,
    lng: inst.lng,
    branch: inst.branch,
    country: inst.country,
  }));

  rawOutbreaks.forEach(raw => {
    try {
      const outbreak: Partial<WaterborneOutbreak> = {
        outbreakId: raw.outbreak_id || raw.id || generateOutbreakId(raw),
        reportId: raw.report_id || raw.cdc_report_id || raw.outbreak_id,
        state: raw.state || raw.state_abbr,
        county: raw.county,
        city: raw.city || raw.municipality,
        lat: parseFloat(raw.latitude || raw.lat),
        lng: parseFloat(raw.longitude || raw.lng || raw.lon),
        reportDate: formatDate(raw.report_date || raw.date_reported),
        onsetDate: formatDate(raw.onset_date || raw.illness_onset_date),
        illnessType: mapIllnessType(raw.illness_type || raw.etiology || raw.pathogen),
        caseCount: parseInt(raw.case_count || raw.ill_count || raw.cases) || 1,
        hospitalizations: parseInt(raw.hospitalizations || raw.hosp_count) || undefined,
        deaths: parseInt(raw.deaths || raw.death_count) || undefined,
        suspectedSource: mapWaterSource(raw.water_source || raw.suspected_source || raw.source),
        waterSystemId: raw.water_system_id || raw.pwsid || undefined,
        facilityType: mapFacilityType(raw.facility_type || raw.setting),
        investigationStatus: mapInvestigationStatus(raw.investigation_status || raw.status),
        contaminant: raw.contaminant || raw.suspected_contaminant || undefined,
        sourceConfirmed: mapBooleanField(raw.source_confirmed || raw.confirmed_source),
        lastUpdated: new Date().toISOString(),
      };

      // Validate the outbreak data
      if (!validateWaterborneOutbreak(outbreak)) {
        console.warn('Invalid outbreak data:', outbreak.outbreakId);
        return;
      }

      // Calculate proximity to military installations
      const proximity = findNearestInstallation(outbreak, installations);
      if (proximity) {
        outbreak.proximityToMilitary = proximity;
      }

      // Correlate with water violations if available
      if (waterViolations.length > 0) {
        const correlations = correlateOutbreakWithViolations(outbreak, waterViolations);
        if (correlations.length > 0) {
          outbreak.correlatedViolations = correlations;
        }
      }

      processedOutbreaks.push(outbreak);
    } catch (error) {
      console.error('Error processing outbreak:', error);
    }
  });

  return processedOutbreaks;
}

// ─── Data Mapping Utilities ──────────────────────────────────────────────────

function generateOutbreakId(raw: any): string {
  const state = raw.state || 'XX';
  const county = raw.county || 'Unknown';
  const date = raw.report_date || new Date().toISOString().split('T')[0];
  const hash = Math.random().toString(36).substring(2, 8);
  return `${state}-${county.replace(/\s+/g, '')}-${date}-${hash}`.toUpperCase();
}

function formatDate(dateString: any): string {
  if (!dateString) return new Date().toISOString().split('T')[0];

  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function mapIllnessType(type: string): WaterborneOutbreak['illnessType'] {
  if (!type) return 'gastroenteritis';

  const lowerType = type.toLowerCase();
  if (lowerType.includes('legionella') || lowerType.includes('legionnaire')) return 'legionella';
  if (lowerType.includes('hepatitis') && lowerType.includes('a')) return 'hepatitis_a';
  if (lowerType.includes('cryptosporidium') || lowerType.includes('crypto')) return 'cryptosporidium';
  if (lowerType.includes('giardia')) return 'giardia';
  if (lowerType.includes('shigella')) return 'shigella';
  if (lowerType.includes('gastroenteritis') || lowerType.includes('gastro')) return 'gastroenteritis';
  return 'other';
}

function mapWaterSource(source: string): WaterborneOutbreak['suspectedSource'] {
  if (!source) return 'unknown';

  const lowerSource = source.toLowerCase();
  if (lowerSource.includes('drinking') || lowerSource.includes('tap') || lowerSource.includes('potable')) {
    return 'drinking_water';
  }
  if (lowerSource.includes('recreational') || lowerSource.includes('pool') || lowerSource.includes('spa')) {
    return 'recreational_water';
  }
  if (lowerSource.includes('well') || lowerSource.includes('private')) {
    return 'well_water';
  }
  return 'unknown';
}

function mapFacilityType(facility: string): WaterborneOutbreak['facilityType'] | undefined {
  if (!facility) return undefined;

  const lowerFacility = facility.toLowerCase();
  if (lowerFacility.includes('hotel') || lowerFacility.includes('motel')) return 'hotel';
  if (lowerFacility.includes('restaurant') || lowerFacility.includes('food')) return 'restaurant';
  if (lowerFacility.includes('school') || lowerFacility.includes('college')) return 'school';
  if (lowerFacility.includes('nursing') || lowerFacility.includes('care facility')) return 'nursing_home';
  if (lowerFacility.includes('recreational') || lowerFacility.includes('park')) return 'recreational';
  if (lowerFacility.includes('residential') || lowerFacility.includes('home')) return 'residential';
  return 'other';
}

function mapInvestigationStatus(status: string): WaterborneOutbreak['investigationStatus'] {
  if (!status) return 'reported';

  const lowerStatus = status.toLowerCase();
  if (lowerStatus.includes('confirmed')) return 'confirmed';
  if (lowerStatus.includes('investigation') || lowerStatus.includes('investigating')) return 'investigation';
  if (lowerStatus.includes('ruled out') || lowerStatus.includes('ruled_out')) return 'ruled_out';
  if (lowerStatus.includes('resolved') || lowerStatus.includes('closed')) return 'resolved';
  return 'reported';
}

function mapBooleanField(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower === 'yes' || lower === 'true' || lower === 'y' || lower === '1' || lower === 'confirmed';
  }
  return false;
}

// ─── Query Functions ─────────────────────────────────────────────────────────

/**
 * Get recent outbreaks (within specified days)
 */
export function getRecentOutbreaks(daysBack: number = 365): WaterborneOutbreak[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  return outbreakCache.filter(outbreak => {
    const reportDate = new Date(outbreak.reportDate);
    return reportDate >= cutoffDate;
  });
}

/**
 * Get outbreaks by state
 */
export function getOutbreaksByState(stateCode: string): WaterborneOutbreak[] {
  return outbreakCache.filter(outbreak =>
    outbreak.state.toUpperCase() === stateCode.toUpperCase()
  );
}

/**
 * Get outbreaks near military installations
 */
export function getOutbreaksNearMilitary(maxDistanceKm: number = 80): WaterborneOutbreak[] {
  return outbreakCache.filter(outbreak =>
    outbreak.proximityToMilitary &&
    outbreak.proximityToMilitary.distanceKm <= maxDistanceKm
  );
}

/**
 * Get outbreaks by illness type
 */
export function getOutbreaksByIllnessType(illnessType: WaterborneOutbreak['illnessType']): WaterborneOutbreak[] {
  return outbreakCache.filter(outbreak => outbreak.illnessType === illnessType);
}

/**
 * Get outbreaks by water source
 */
export function getOutbreaksByWaterSource(source: WaterborneOutbreak['suspectedSource']): WaterborneOutbreak[] {
  return outbreakCache.filter(outbreak => outbreak.suspectedSource === source);
}

/**
 * Get outbreaks with correlated water violations
 */
export function getOutbreaksWithViolations(): WaterborneOutbreak[] {
  return outbreakCache.filter(outbreak =>
    outbreak.correlatedViolations && outbreak.correlatedViolations.length > 0
  );
}

/**
 * Get high-impact outbreaks (>20 cases or hospitalizations)
 */
export function getHighImpactOutbreaks(): WaterborneOutbreak[] {
  return outbreakCache.filter(outbreak =>
    outbreak.caseCount >= 20 || (outbreak.hospitalizations && outbreak.hospitalizations > 0)
  );
}

/**
 * Get outbreaks near a specific location
 */
export function getOutbreaksNearLocation(
  lat: number,
  lng: number,
  radiusKm: number = 100
): WaterborneOutbreak[] {
  const { haversineDistance } = require('./geoUtils');

  return outbreakCache.filter(outbreak => {
    const distance = haversineDistance(lat, lng, outbreak.lat, outbreak.lng);
    return distance <= radiusKm;
  });
}

/**
 * Get outbreak trend analysis
 */
export function getOutbreakTrends(monthsBack: number = 24) {
  const trends = {
    totalOutbreaks: outbreakCache.length,
    monthlyTrends: {} as Record<string, number>,
    illnessTypeTrends: {} as Record<string, number>,
    waterSourceTrends: {} as Record<string, number>,
    stateTrends: {} as Record<string, number>,
    averageCases: 0,
    totalCases: 0,
    totalHospitalizations: 0,
    totalDeaths: 0,
    correlatedWithViolations: 0,
  };

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);

  let totalCases = 0;
  let outbreaksInPeriod = 0;

  outbreakCache.forEach(outbreak => {
    const reportDate = new Date(outbreak.reportDate);

    // Count totals
    trends.totalCases += outbreak.caseCount;
    totalCases += outbreak.caseCount;

    if (outbreak.hospitalizations) {
      trends.totalHospitalizations += outbreak.hospitalizations;
    }

    if (outbreak.deaths) {
      trends.totalDeaths += outbreak.deaths;
    }

    if (outbreak.correlatedViolations && outbreak.correlatedViolations.length > 0) {
      trends.correlatedWithViolations++;
    }

    // Only process trends for recent outbreaks
    if (reportDate >= cutoffDate) {
      outbreaksInPeriod++;

      // Monthly trends
      const monthKey = reportDate.toISOString().substring(0, 7); // YYYY-MM
      trends.monthlyTrends[monthKey] = (trends.monthlyTrends[monthKey] || 0) + 1;

      // Illness type trends
      trends.illnessTypeTrends[outbreak.illnessType] =
        (trends.illnessTypeTrends[outbreak.illnessType] || 0) + 1;

      // Water source trends
      trends.waterSourceTrends[outbreak.suspectedSource] =
        (trends.waterSourceTrends[outbreak.suspectedSource] || 0) + 1;

      // State trends
      trends.stateTrends[outbreak.state] =
        (trends.stateTrends[outbreak.state] || 0) + 1;
    }
  });

  trends.averageCases = outbreakCache.length > 0 ? Math.round(totalCases / outbreakCache.length) : 0;

  return trends;
}

/**
 * Get outbreak statistics summary
 */
export function getOutbreakStatistics() {
  const stats = {
    total: outbreakCache.length,
    byIllnessType: {} as Record<string, number>,
    byWaterSource: {} as Record<string, number>,
    byState: {} as Record<string, number>,
    byInvestigationStatus: {} as Record<string, number>,
    nearMilitary: 0,
    withViolationCorrelations: 0,
    averageCases: 0,
    totalCases: 0,
    totalHospitalizations: 0,
    totalDeaths: 0,
    recentOutbreaks: 0, // last 30 days
  };

  let totalCases = 0;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  outbreakCache.forEach(outbreak => {
    // Count by illness type
    stats.byIllnessType[outbreak.illnessType] = (stats.byIllnessType[outbreak.illnessType] || 0) + 1;

    // Count by water source
    stats.byWaterSource[outbreak.suspectedSource] = (stats.byWaterSource[outbreak.suspectedSource] || 0) + 1;

    // Count by state
    stats.byState[outbreak.state] = (stats.byState[outbreak.state] || 0) + 1;

    // Count by investigation status
    stats.byInvestigationStatus[outbreak.investigationStatus] =
      (stats.byInvestigationStatus[outbreak.investigationStatus] || 0) + 1;

    // Count near military
    if (outbreak.proximityToMilitary) {
      stats.nearMilitary++;
    }

    // Count with violation correlations
    if (outbreak.correlatedViolations && outbreak.correlatedViolations.length > 0) {
      stats.withViolationCorrelations++;
    }

    // Count totals
    totalCases += outbreak.caseCount;
    stats.totalCases += outbreak.caseCount;

    if (outbreak.hospitalizations) {
      stats.totalHospitalizations += outbreak.hospitalizations;
    }

    if (outbreak.deaths) {
      stats.totalDeaths += outbreak.deaths;
    }

    // Count recent outbreaks
    const reportDate = new Date(outbreak.reportDate);
    if (reportDate >= thirtyDaysAgo) {
      stats.recentOutbreaks++;
    }
  });

  stats.averageCases = outbreakCache.length > 0 ? Math.round(totalCases / outbreakCache.length) : 0;

  return stats;
}

// ─── Export Functions ────────────────────────────────────────────────────────

export {
  ensureWaterborneOutbreakCacheWarmed as ensureWarmed,
  getWaterborneOutbreakCache as getCache,
  setWaterborneOutbreakCache as setCache,
  isWaterborneOutbreakCacheLoaded as isCacheLoaded,
  getWaterborneOutbreakCacheStatus as getCacheStatus,
};