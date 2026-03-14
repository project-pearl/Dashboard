/**
 * MS4 Permit Cache — Server-side state-keyed cache for EPA ECHO Municipal
 * Separate Storm Sewer System (MS4) permit data including Phase I/II
 * permits, compliance status, and BMP tracking.
 *
 * Populated by /api/cron/rebuild-ms4-permits.
 * Source: https://echo.epa.gov/ — EPA ECHO CWA permit system.
 *
 * State-keyed: Record<string, Ms4Permit[]> with grid index for spatial
 * lookups. Links to water quality via stormwater runoff management,
 * impervious surface coverage, and BMP implementation.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Ms4Permit {
  permitId: string;
  permittee: string;
  state: string;
  permitType: 'Phase I' | 'Phase II' | 'General';
  effectiveDate: string;
  expirationDate: string;
  complianceStatus: string;
  populationServed: number | null;
  areaSqMi: number | null;
  lat: number;
  lng: number;
  bmps: string[];
}

interface Ms4PermitCacheMeta {
  built: string;
  permitCount: number;
  stateCount: number;
  expiredCount: number;
}

interface Ms4PermitCacheData {
  _meta: Ms4PermitCacheMeta;
  byState: Record<string, Ms4Permit[]>;
  grid: Record<string, Ms4Permit[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: Ms4PermitCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'ms4-permits.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.byState) return false;
    _memCache = { _meta: data.meta, byState: data.byState, grid: data.grid || {} };
    _cacheSource = 'disk';
    console.log(`[MS4 Permit Cache] Loaded from disk (${data.meta.permitCount} permits, built ${data.meta.built})`);
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
    const file = path.join(dir, 'ms4-permits.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, byState: _memCache.byState, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[MS4 Permit Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; byState: any; grid: any }>('cache/ms4-permits.json');
  if (data?.meta && data?.byState) {
    _memCache = { _meta: data.meta, byState: data.byState, grid: data.grid || {} };
    _cacheSource = 'blob';
    console.warn(`[MS4 Permit Cache] Loaded from blob (${data.meta.permitCount} permits)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getMs4PermitsByState(state: string): Ms4Permit[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.byState[state.toUpperCase()] || [];
}

export function getMs4PermitsNearby(lat: number, lng: number): Ms4Permit[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: Ms4Permit[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) results.push(...cell);
  }
  return results;
}

export async function setMs4PermitCache(data: Ms4PermitCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { permitCount: _memCache._meta.permitCount, stateCount: _memCache._meta.stateCount, expiredCount: _memCache._meta.expiredCount }
    : null;
  const newCounts = { permitCount: data._meta.permitCount, stateCount: data._meta.stateCount, expiredCount: data._meta.expiredCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[MS4 Permit Cache] Updated: ${data._meta.permitCount} permits, ` +
    `${data._meta.stateCount} states, ${data._meta.expiredCount} expired`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/ms4-permits.json', { meta: data._meta, byState: data.byState, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isMs4PermitBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[MS4 Permit Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setMs4PermitBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getMs4PermitCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    permitCount: _memCache._meta.permitCount,
    stateCount: _memCache._meta.stateCount,
    expiredCount: _memCache._meta.expiredCount,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
