/**
 * ECHO Biosolids Cache — Server-side state-keyed cache for EPA ECHO
 * biosolids management reporting data including generation volumes,
 * land application rates, and disposal methods.
 *
 * Populated by /api/cron/rebuild-echo-biosolids.
 * Source: https://echo.epa.gov/ — EPA ECHO CWA biosolids program.
 *
 * State-keyed: Record<string, BiosolidsReport[]> with grid index for spatial
 * lookups. Links to water quality via land-applied biosolids nutrient loading,
 * pollutant limits compliance, and disposal method tracking.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BiosolidsReport {
  permitId: string;
  facilityName: string;
  state: string;
  biosolidsGeneratedDryTons: number | null;
  landAppliedDryTons: number | null;
  disposalMethod: string;
  reportingYear: number;
  pollutantLimits: boolean;
  lat: number;
  lng: number;
}

interface EchoBiosolidsCacheMeta {
  built: string;
  reportCount: number;
  facilityCount: number;
  stateCount: number;
  totalDryTons: number;
}

interface EchoBiosolidsCacheData {
  _meta: EchoBiosolidsCacheMeta;
  byState: Record<string, BiosolidsReport[]>;
  grid: Record<string, BiosolidsReport[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: EchoBiosolidsCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'echo-biosolids.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.byState) return false;
    _memCache = { _meta: data.meta, byState: data.byState, grid: data.grid || {} };
    _cacheSource = 'disk';
    console.log(`[ECHO Biosolids Cache] Loaded from disk (${data.meta.reportCount} reports, built ${data.meta.built})`);
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
    const file = path.join(dir, 'echo-biosolids.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, byState: _memCache.byState, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[ECHO Biosolids Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; byState: any; grid: any }>('cache/echo-biosolids.json');
  if (data?.meta && data?.byState) {
    _memCache = { _meta: data.meta, byState: data.byState, grid: data.grid || {} };
    _cacheSource = 'blob';
    console.warn(`[ECHO Biosolids Cache] Loaded from blob (${data.meta.reportCount} reports)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getEchoBiosolidsByState(state: string): BiosolidsReport[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.byState[state.toUpperCase()] || [];
}

export function getEchoBiosolidsNearby(lat: number, lng: number): BiosolidsReport[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: BiosolidsReport[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) results.push(...cell);
  }
  return results;
}

export async function setEchoBiosolidsCache(data: EchoBiosolidsCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { reportCount: _memCache._meta.reportCount, facilityCount: _memCache._meta.facilityCount, stateCount: _memCache._meta.stateCount, totalDryTons: _memCache._meta.totalDryTons }
    : null;
  const newCounts = { reportCount: data._meta.reportCount, facilityCount: data._meta.facilityCount, stateCount: data._meta.stateCount, totalDryTons: data._meta.totalDryTons };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[ECHO Biosolids Cache] Updated: ${data._meta.reportCount} reports, ` +
    `${data._meta.facilityCount} facilities, ${data._meta.stateCount} states, ` +
    `${data._meta.totalDryTons} total dry tons`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/echo-biosolids.json', { meta: data._meta, byState: data.byState, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isEchoBiosolidsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[ECHO Biosolids Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setEchoBiosolidsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getEchoBiosolidsCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    reportCount: _memCache._meta.reportCount,
    facilityCount: _memCache._meta.facilityCount,
    stateCount: _memCache._meta.stateCount,
    totalDryTons: _memCache._meta.totalDryTons,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
