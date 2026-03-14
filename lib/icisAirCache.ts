/**
 * ICIS-Air Cache — Server-side state-keyed cache for EPA ECHO ICIS-Air
 * Clean Air Act compliance and violation data by facility.
 *
 * Populated by /api/cron/rebuild-icis-air.
 * Source: https://echo.epa.gov/ — EPA ICIS-Air compliance monitoring system.
 *
 * State-keyed: Record<string, IcisAirViolation[]> with grid index for spatial
 * lookups. Tracks CAA violations, inspections, and penalty assessments.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface IcisAirViolation {
  programId: string;
  facilityName: string;
  state: string;
  violationType: string;
  pollutant: string;
  complianceStatus: string;
  lastInspectionDate: string | null;
  penaltyAmount: number | null;
  lat: number;
  lng: number;
}

interface IcisAirCacheMeta {
  built: string;
  violationCount: number;
  facilityCount: number;
  stateCount: number;
}

interface IcisAirCacheData {
  _meta: IcisAirCacheMeta;
  byState: Record<string, IcisAirViolation[]>;
  grid: Record<string, IcisAirViolation[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: IcisAirCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'icis-air.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.byState) return false;
    _memCache = { _meta: data.meta, byState: data.byState, grid: data.grid || {} };
    _cacheSource = 'disk';
    console.log(`[ICIS-Air Cache] Loaded from disk (${data.meta.violationCount} violations, built ${data.meta.built})`);
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
    const file = path.join(dir, 'icis-air.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, byState: _memCache.byState, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[ICIS-Air Cache] Saved to disk`);
  } catch {
    // fail silently
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
  if (_memCache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<{ meta: any; byState: any; grid: any }>('cache/icis-air.json');
  if (data?.meta && data?.byState) {
    _memCache = { _meta: data.meta, byState: data.byState, grid: data.grid || {} };
    _cacheSource = 'blob';
    console.warn(`[ICIS-Air Cache] Loaded from blob (${data.meta.violationCount} violations)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getIcisAirByState(state: string): IcisAirViolation[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.byState[state.toUpperCase()] || [];
}

export function getIcisAirNearby(lat: number, lng: number): IcisAirViolation[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: IcisAirViolation[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) results.push(...cell);
  }
  return results;
}

export async function setIcisAirCache(data: IcisAirCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { violationCount: _memCache._meta.violationCount, facilityCount: _memCache._meta.facilityCount, stateCount: _memCache._meta.stateCount }
    : null;
  const newCounts = { violationCount: data._meta.violationCount, facilityCount: data._meta.facilityCount, stateCount: data._meta.stateCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[ICIS-Air Cache] Updated: ${data._meta.violationCount} violations, ` +
    `${data._meta.facilityCount} facilities, ${data._meta.stateCount} states`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/icis-air.json', { meta: data._meta, byState: data.byState, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isIcisAirBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[ICIS-Air Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setIcisAirBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getIcisAirCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    violationCount: _memCache._meta.violationCount,
    facilityCount: _memCache._meta.facilityCount,
    stateCount: _memCache._meta.stateCount,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
