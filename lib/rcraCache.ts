/**
 * RCRA Hazardous Waste Cache — state-keyed cache for EPA ECHO RCRA facility data.
 *
 * Populated by /api/cron/rebuild-rcra (weekly, Sunday 11:00 PM UTC).
 * Source: https://echodata.epa.gov/echo/rcra_rest_services
 * Persisted to disk + Vercel Blob for cold-start survival.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RcraFacility {
  registryId: string;
  facilityName: string;
  state: string;
  county: string;
  lat: number | null;
  lng: number | null;
  facilityTypeCode: string;   // TSD, LQG, SQG, VSQG
  sncFlag: boolean;           // Significant Non-Compliance
  lastInspectionDate: string | null;
  violationCount: number;
  penaltyAmount: number;
}

interface RcraCacheData {
  built: string;
  facilities: Record<string, { facilities: RcraFacility[]; fetched: string }>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _cache: RcraCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'rcra-facilities.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.built || !data?.facilities) return false;
    _cache = data;
    _cacheSource = 'disk';
    console.log(`[RCRA Cache] Loaded from disk (built ${data.built})`);
    return true;
  } catch {
    return false;
  }
}

function saveToDisk(): void {
  try {
    if (typeof process === 'undefined' || !_cache) return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    const file = path.join(dir, 'rcra-facilities.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(_cache), 'utf-8');
    console.log(`[RCRA Cache] Saved to disk`);
  } catch {
    // Disk save is optional
  }
}

let _diskLoaded = false;
function ensureDiskLoaded() {
  if (!_diskLoaded) {
    _diskLoaded = true;
    loadFromDisk();
  }
}

let _blobChecked = false;
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_cache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<RcraCacheData>('cache/rcra-facilities.json');
  if (data?.built && data?.facilities) {
    _cache = data;
    _cacheSource = 'blob';
    console.warn(`[RCRA Cache] Loaded from blob`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get RCRA facilities for a specific state. */
export function getRcraFacilities(state: string): RcraFacility[] | null {
  ensureDiskLoaded();
  if (!_cache) return null;
  const entry = _cache.facilities[state.toUpperCase()];
  return entry?.facilities ?? null;
}

/** Get all RCRA facilities across all states. */
export function getRcraFacilitiesAll(): RcraFacility[] {
  ensureDiskLoaded();
  if (!_cache) return [];
  const all: RcraFacility[] = [];
  for (const entry of Object.values(_cache.facilities)) {
    all.push(...entry.facilities);
  }
  return all;
}

/** Bulk-set RCRA facilities for all states. */
export async function setRcraCache(
  facilitiesByState: Record<string, { facilities: RcraFacility[]; fetched: string }>
): Promise<void> {
  const prevCounts = _cache ? {
    facilityCount: Object.values(_cache.facilities).reduce((s, e) => s + e.facilities.length, 0),
    statesWithFacilities: Object.keys(_cache.facilities).filter(k => _cache!.facilities[k].facilities.length > 0).length,
  } : null;
  const newFacilityCount = Object.values(facilitiesByState).reduce((s, e) => s + e.facilities.length, 0);
  const newStatesCount = Object.keys(facilitiesByState).filter(k => facilitiesByState[k].facilities.length > 0).length;
  const newCounts = { facilityCount: newFacilityCount, statesWithFacilities: newStatesCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _cache?.built ?? null);
  _cache = {
    built: new Date().toISOString(),
    facilities: facilitiesByState,
  };
  _cacheSource = 'memory (cron)';
  saveToDisk();
  await saveCacheToBlob('cache/rcra-facilities.json', _cache);
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isRcraBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[RCRA Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setRcraBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getRcraCacheStatus() {
  ensureDiskLoaded();
  if (!_cache) return { loaded: false, source: null as string | null };
  const all = getRcraFacilitiesAll();
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _cache.built,
    facilityCount: all.length,
    statesWithFacilities: Object.keys(_cache.facilities).filter(k => _cache!.facilities[k].facilities.length > 0).length,
    lastDelta: _lastDelta,
  };
}
