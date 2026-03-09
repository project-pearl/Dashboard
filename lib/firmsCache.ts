/**
 * FIRMS Cache — NASA FIRMS satellite fire detection data by military command region.
 *
 * Populated by /api/cron/rebuild-firms.
 * Source: NASA FIRMS VIIRS NOAA-20 NRT (requires FIRMS_MAP_KEY).
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FirmsDetection {
  lat: number;
  lng: number;
  brightness: number;
  acq_date: string;
  acq_time: string;
  confidence: 'nominal' | 'high';
  frp: number;           // Fire Radiative Power (MW)
  daynight: 'D' | 'N';
  region: string;
  nearestInstallation: string | null;
  distanceToInstallationMi: number | null;
}

export interface FirmsRegionSummary {
  region: string;
  label: string;
  bbox: [number, number, number, number]; // W, S, E, N
  detectionCount: number;
  highConfidenceCount: number;
  maxFrp: number;
  detections: FirmsDetection[];
}

export interface FirmsCacheData {
  _meta: {
    built: string;
    regionCount: number;
    totalDetections: number;
  };
  regions: Record<string, FirmsRegionSummary>;
}

/* ------------------------------------------------------------------ */
/*  Region Constants                                                   */
/* ------------------------------------------------------------------ */

export const FIRMS_REGIONS: Array<{ id: string; label: string; bbox: [number, number, number, number] }> = [
  { id: 'middle-east', label: 'CENTCOM', bbox: [40, 25, 60, 40] },
  { id: 'conus', label: 'Continental US', bbox: [-125, 24, -66, 50] },
  { id: 'indo-pacific', label: 'INDOPACOM', bbox: [95, -10, 155, 45] },
  { id: 'europe', label: 'EUCOM', bbox: [-10, 35, 45, 72] },
  { id: 'africa', label: 'AFRICOM', bbox: [-20, -35, 55, 37] },
];

/* ------------------------------------------------------------------ */
/*  In-Memory Cache State                                              */
/* ------------------------------------------------------------------ */

let _memCache: FirmsCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;
let _diskLoaded = false;
let _blobChecked = false;
let _buildInProgress = false;
let _buildStartedAt = 0;

const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
const BLOB_KEY = 'cache/firms.json';

/* ------------------------------------------------------------------ */
/*  Disk Persistence                                                   */
/* ------------------------------------------------------------------ */

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'firms.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.regions) return false;
    _memCache = { _meta: data.meta, regions: data.regions };
    _cacheSource = 'disk';
    return true;
  } catch {
    return false;
  }
}

function saveToDisk(): void {
  try {
    if (typeof process === 'undefined' || !_memCache) return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    const file = path.join(dir, 'firms.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, regions: _memCache.regions });
    fs.writeFileSync(file, payload, 'utf-8');
  } catch {
    // non-fatal
  }
}

function ensureDiskLoaded() {
  if (_diskLoaded) return;
  _diskLoaded = true;
  loadFromDisk();
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_memCache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<{ meta: any; regions: any }>(BLOB_KEY);
  if (data?.meta && data?.regions) {
    _memCache = { _meta: data.meta, regions: data.regions };
    _cacheSource = 'blob';
  }
}

export function getFirmsAllRegions(): FirmsRegionSummary[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return Object.values(_memCache.regions);
}

export function getFirmsForRegion(regionId: string): FirmsRegionSummary | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.regions[regionId] ?? null;
}

export function getFirmsNearPoint(lat: number, lng: number, radiusMi: number): FirmsDetection[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: FirmsDetection[] = [];
  for (const region of Object.values(_memCache.regions)) {
    for (const det of region.detections) {
      const dist = haversineMi(lat, lng, det.lat, det.lng);
      if (dist <= radiusMi) results.push(det);
    }
  }
  return results;
}

export async function setFirmsCache(data: FirmsCacheData): Promise<void> {
  const prevCounts = _memCache ? { totalDetections: _memCache._meta.totalDetections } : null;
  const newCounts = { totalDetections: data._meta.totalDetections };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  saveToDisk();
  await saveCacheToBlob(BLOB_KEY, { meta: data._meta, regions: data.regions });
}

export function isFirmsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setFirmsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

export function getFirmsCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    regionCount: _memCache._meta.regionCount,
    totalDetections: _memCache._meta.totalDetections,
    lastDelta: _lastDelta,
  };
}

/* ------------------------------------------------------------------ */
/*  Haversine (used by getFirmsNearPoint)                              */
/* ------------------------------------------------------------------ */

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
