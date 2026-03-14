/**
 * ECHO DMR Violations Cache — Server-side state-keyed cache for EPA ECHO
 * Discharge Monitoring Report violations including permit exceedances,
 * effluent limit breaches, and non-compliance categorisation.
 *
 * Populated by /api/cron/rebuild-echo-dmr-violations.
 * Source: https://echo.epa.gov/ — EPA Enforcement and Compliance History Online.
 *
 * State-keyed: Record<string, DmrViolation[]> with grid index for spatial
 * lookups. Links to water quality via NPDES permit violations, effluent
 * limit exceedances, and discharge monitoring report analysis.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DmrViolation {
  permitId: string;
  facilityName: string;
  facilityLat: number;
  facilityLng: number;
  state: string;
  parameter: string;
  limitValue: number | null;
  dmrValue: number | null;
  exceedancePct: number | null;
  violationCategory: string;
  reportingPeriod: string;
  reportDate: string;
  sourceId: string;
}

interface EchoDmrViolationsCacheMeta {
  built: string;
  violationCount: number;
  facilityCount: number;
  stateCount: number;
}

interface EchoDmrViolationsCacheData {
  _meta: EchoDmrViolationsCacheMeta;
  byState: Record<string, DmrViolation[]>;
  grid: Record<string, DmrViolation[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: EchoDmrViolationsCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'echo-dmr-violations.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.byState) return false;
    _memCache = { _meta: data.meta, byState: data.byState, grid: data.grid || {} };
    _cacheSource = 'disk';
    console.log(`[ECHO DMR Violations Cache] Loaded from disk (${data.meta.violationCount} violations, built ${data.meta.built})`);
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
    const file = path.join(dir, 'echo-dmr-violations.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: _memCache._meta,
      byState: _memCache.byState,
      grid: _memCache.grid,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[ECHO DMR Violations Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; byState: any; grid: any }>('cache/echo-dmr-violations.json');
  if (data?.meta && data?.byState) {
    _memCache = { _meta: data.meta, byState: data.byState, grid: data.grid || {} };
    _cacheSource = 'blob';
    console.warn(`[ECHO DMR Violations Cache] Loaded from blob (${data.meta.violationCount} violations)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getDmrViolationsByState(state: string): DmrViolation[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.byState[state.toUpperCase()] || [];
}

export function getDmrViolationsNearby(lat: number, lng: number): DmrViolation[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: DmrViolation[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) results.push(...cell);
  }
  return results;
}

export async function setDmrViolationsCache(data: EchoDmrViolationsCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { violationCount: _memCache._meta.violationCount, facilityCount: _memCache._meta.facilityCount, stateCount: _memCache._meta.stateCount }
    : null;
  const newCounts = { violationCount: data._meta.violationCount, facilityCount: data._meta.facilityCount, stateCount: data._meta.stateCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[ECHO DMR Violations Cache] Updated: ${data._meta.violationCount} violations, ` +
    `${data._meta.facilityCount} facilities, ${data._meta.stateCount} states`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/echo-dmr-violations.json', {
    meta: data._meta,
    byState: data.byState,
    grid: data.grid,
  });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isDmrViolationsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[ECHO DMR Violations Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setDmrViolationsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getDmrViolationsCacheStatus() {
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
