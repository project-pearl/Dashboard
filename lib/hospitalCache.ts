// lib/hospitalCache.ts
// Hospital facility data cache with military installation proximity
// Provides medical facility locations and capacity for force protection and emergency response

import { loadCacheFromDisk, saveCacheToDisk } from './cacheUtils';
import { loadCacheFromBlob, saveCacheToBlob } from './blobPersistence';
import { HospitalFacility, findNearestInstallation, MilitaryInstallationRef, validateHospitalFacility } from './healthDataUtils';
const militaryInstallations: any[] = require('../data/military-installations').militaryInstallations ?? require('../data/military-installations').default ?? require('../data/military-installations');

// ─── Cache State ─────────────────────────────────────────────────────────────

let hospitalCache: HospitalFacility[] = [];
let _hospitalCacheLoaded = false;
let _buildInProgress = false;
let _buildStartedAt: number | null = null;
let lastFetched: string | null = null;

const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes
const CACHE_FILE = 'hospitals-national';

// ─── Cache Management ────────────────────────────────────────────────────────

export function getHospitalCache(): HospitalFacility[] {
  return hospitalCache;
}

export async function setHospitalCache(hospitals: HospitalFacility[]): Promise<void> {
  if (hospitals.length === 0) {
    console.warn('No hospital data to cache, preserving existing blob');
    return;
  }

  hospitalCache = hospitals;
  lastFetched = new Date().toISOString();
  _hospitalCacheLoaded = true;

  saveCacheToDisk(CACHE_FILE, hospitals);
  await saveCacheToBlob(CACHE_FILE, hospitals);
}

export function isHospitalCacheLoaded(): boolean {
  return _hospitalCacheLoaded;
}

export function getHospitalCacheStatus() {
  return {
    loaded: _hospitalCacheLoaded,
    count: hospitalCache.length,
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
    console.warn('Hospital cache build lock expired, clearing');
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

export async function ensureHospitalCacheWarmed(): Promise<void> {
  if (_hospitalCacheLoaded && hospitalCache.length > 0) return;

  try {
    // Try loading from disk first
    const diskData = await loadCacheFromDisk<HospitalFacility[]>(CACHE_FILE);
    if (diskData && diskData.length > 0) {
      hospitalCache = diskData;
      _hospitalCacheLoaded = true;
      console.log(`Hospital cache warmed from disk: ${diskData.length} facilities`);
      return;
    }

    // Fallback to blob storage
    const blobData = await loadCacheFromBlob<HospitalFacility[]>(CACHE_FILE);
    if (blobData && blobData.length > 0) {
      hospitalCache = blobData;
      _hospitalCacheLoaded = true;
      console.log(`Hospital cache warmed from blob: ${blobData.length} facilities`);

      // Save to disk for faster future access
      saveCacheToDisk(CACHE_FILE, blobData);
      return;
    }

    console.warn('No hospital cache data available in disk or blob storage');
  } catch (error) {
    console.error('Failed to warm hospital cache:', error);
  }
}

// ─── Data Processing ─────────────────────────────────────────────────────────

/**
 * Process raw hospital data and calculate military proximity
 */
export function processHospitalData(rawHospitals: any[]): HospitalFacility[] {
  const processedHospitals: HospitalFacility[] = [];
  const installations: MilitaryInstallationRef[] = militaryInstallations.map((inst: any) => ({
    id: inst.id,
    name: inst.name,
    lat: inst.lat,
    lng: inst.lng,
    branch: inst.branch,
    country: inst.country,
  }));

  rawHospitals.forEach(raw => {
    try {
      const hospital: Partial<HospitalFacility> = {
        facilityId: raw.facility_id || raw.provider_id || raw.id,
        name: raw.facility_name || raw.hospital_name || raw.provider_name,
        lat: parseFloat(raw.latitude || raw.lat),
        lng: parseFloat(raw.longitude || raw.lng || raw.lon),
        address: raw.address || raw.street_address,
        city: raw.city,
        state: raw.state,
        zipCode: raw.zip_code || raw.zip,
        phone: raw.phone_number || raw.phone,
        facilityType: mapFacilityType(raw.hospital_type || raw.facility_type || raw.provider_type),
        ownership: mapOwnershipType(raw.hospital_ownership || raw.ownership),
        emergencyServices: mapBooleanField(raw.emergency_services || raw.has_emergency_dept),
        services: parseServices(raw.services || raw.hospital_services),
        certifications: parseCertifications(raw.certifications || raw.accreditation),
        qualityRating: parseFloat(raw.hospital_overall_rating || raw.quality_rating) || undefined,
        lastUpdated: new Date().toISOString(),
      };

      // Add capacity if available
      if (raw.total_beds || raw.icu_beds || raw.operating_rooms) {
        hospital.capacity = {
          totalBeds: parseInt(raw.total_beds) || undefined,
          icuBeds: parseInt(raw.icu_beds) || undefined,
          operatingRooms: parseInt(raw.operating_rooms) || undefined,
        };
      }

      // Validate the hospital data
      if (!validateHospitalFacility(hospital)) {
        console.warn('Invalid hospital data:', hospital.name || hospital.facilityId);
        return;
      }

      // Calculate proximity to military installations
      const proximity = findNearestInstallation(hospital, installations);
      if (proximity) {
        hospital.proximityToMilitary = proximity;
      }

      processedHospitals.push(hospital);
    } catch (error) {
      console.error('Error processing hospital:', error);
    }
  });

  return processedHospitals;
}

// ─── Data Mapping Utilities ──────────────────────────────────────────────────

function mapFacilityType(type: string): HospitalFacility['facilityType'] {
  if (!type) return 'acute_care';

  const lowerType = type.toLowerCase();
  if (lowerType.includes('critical access')) return 'critical_access';
  if (lowerType.includes('specialty')) return 'specialty';
  if (lowerType.includes('psychiatric') || lowerType.includes('mental')) return 'psychiatric';
  if (lowerType.includes('rehabilitation') || lowerType.includes('rehab')) return 'rehabilitation';
  return 'acute_care';
}

function mapOwnershipType(ownership: string): HospitalFacility['ownership'] {
  if (!ownership) return 'nonprofit';

  const lowerOwnership = ownership.toLowerCase();
  if (lowerOwnership.includes('government') || lowerOwnership.includes('public')) return 'government';
  if (lowerOwnership.includes('profit') && !lowerOwnership.includes('non')) return 'for_profit';
  if (lowerOwnership.includes('tribal')) return 'tribal';
  return 'nonprofit';
}

function mapBooleanField(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower === 'yes' || lower === 'true' || lower === 'y' || lower === '1';
  }
  return false;
}

function parseServices(services: any): string[] {
  if (!services) return [];
  if (Array.isArray(services)) return services;
  if (typeof services === 'string') {
    return services.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }
  return [];
}

function parseCertifications(certs: any): string[] {
  if (!certs) return [];
  if (Array.isArray(certs)) return certs;
  if (typeof certs === 'string') {
    return certs.split(',').map(c => c.trim()).filter(c => c.length > 0);
  }
  return [];
}

// ─── Query Functions ─────────────────────────────────────────────────────────

/**
 * Get hospitals within specified radius of military installations
 */
export function getHospitalsNearMilitary(maxDistanceKm: number = 80): HospitalFacility[] {
  return hospitalCache.filter(hospital =>
    hospital.proximityToMilitary &&
    hospital.proximityToMilitary.distanceKm <= maxDistanceKm
  );
}

/**
 * Get hospitals by state
 */
export function getHospitalsByState(stateCode: string): HospitalFacility[] {
  return hospitalCache.filter(hospital =>
    hospital.state.toUpperCase() === stateCode.toUpperCase()
  );
}

/**
 * Get hospitals with emergency services
 */
export function getEmergencyHospitals(): HospitalFacility[] {
  return hospitalCache.filter(hospital => hospital.emergencyServices);
}

/**
 * Get hospitals by facility type
 */
export function getHospitalsByType(type: HospitalFacility['facilityType']): HospitalFacility[] {
  return hospitalCache.filter(hospital => hospital.facilityType === type);
}

/**
 * Get high-capacity hospitals (>200 beds)
 */
export function getHighCapacityHospitals(): HospitalFacility[] {
  return hospitalCache.filter(hospital =>
    hospital.capacity?.totalBeds && hospital.capacity.totalBeds >= 200
  );
}

/**
 * Get hospitals near a specific location
 */
export function getHospitalsNearLocation(
  lat: number,
  lng: number,
  radiusKm: number = 50
): HospitalFacility[] {
  const { haversineDistance } = require('./geoUtils');

  return hospitalCache.filter(hospital => {
    const distance = haversineDistance(lat, lng, hospital.lat, hospital.lng);
    return distance <= radiusKm;
  });
}

/**
 * Get hospital statistics summary
 */
export function getHospitalStatistics() {
  const stats = {
    total: hospitalCache.length,
    byType: {} as Record<string, number>,
    byOwnership: {} as Record<string, number>,
    byState: {} as Record<string, number>,
    withEmergencyServices: 0,
    nearMilitary: 0,
    withCapacityData: 0,
    averageCapacity: 0,
  };

  let totalBeds = 0;
  let hospitalsWithBeds = 0;

  hospitalCache.forEach(hospital => {
    // Count by type
    stats.byType[hospital.facilityType] = (stats.byType[hospital.facilityType] || 0) + 1;

    // Count by ownership
    stats.byOwnership[hospital.ownership] = (stats.byOwnership[hospital.ownership] || 0) + 1;

    // Count by state
    stats.byState[hospital.state] = (stats.byState[hospital.state] || 0) + 1;

    // Count emergency services
    if (hospital.emergencyServices) {
      stats.withEmergencyServices++;
    }

    // Count near military
    if (hospital.proximityToMilitary) {
      stats.nearMilitary++;
    }

    // Count capacity data
    if (hospital.capacity?.totalBeds) {
      stats.withCapacityData++;
      totalBeds += hospital.capacity.totalBeds;
      hospitalsWithBeds++;
    }
  });

  stats.averageCapacity = hospitalsWithBeds > 0 ? Math.round(totalBeds / hospitalsWithBeds) : 0;

  return stats;
}

// ─── Export Functions ────────────────────────────────────────────────────────

export {
  ensureHospitalCacheWarmed as ensureWarmed,
  getHospitalCache as getCache,
  setHospitalCache as setCache,
  isHospitalCacheLoaded as isCacheLoaded,
  getHospitalCacheStatus as getCacheStatus,
};