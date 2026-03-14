/**
 * SSURGO Cache — Server-side state-keyed cache for USDA SSURGO Soil Survey
 * data including drainage classification, hydrologic groups, and erosion
 * factors relevant to water quality impact assessment.
 *
 * Populated by /api/cron/rebuild-ssurgo.
 * Source: https://sdmdataaccess.nrcs.usda.gov/ — USDA NRCS Soil Data Access.
 *
 * State-keyed: Record<string, SsurgoSoilUnit[]> with grid index for spatial
 * lookups. Links to water quality via runoff potential, permeability, and
 * flood frequency classification.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SsurgoSoilUnit {
  mukey: string;
  muname: string;
  state: string;
  county: string;
  drainageClass: string;
  hydrologicGroup: string;
  kFactor: number | null;
  permeabilityInHr: number | null;
  awcInch: number | null;
  floodFrequency: string;
  lat: number;
  lng: number;
}

interface SsurgoCacheMeta {
  built: string;
  unitCount: number;
  stateCount: number;
}

interface SsurgoCacheData {
  _meta: SsurgoCacheMeta;
  byState: Record<string, SsurgoSoilUnit[]>;
  grid: Record<string, SsurgoSoilUnit[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: SsurgoCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'ssurgo.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.byState) return false;
    _memCache = { _meta: data.meta, byState: data.byState, grid: data.grid || {} };
    _cacheSource = 'disk';
    console.log(`[SSURGO Cache] Loaded from disk (${data.meta.unitCount} units, built ${data.meta.built})`);
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
    const file = path.join(dir, 'ssurgo.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, byState: _memCache.byState, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[SSURGO Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; byState: any; grid: any }>('cache/ssurgo.json');
  if (data?.meta && data?.byState) {
    _memCache = { _meta: data.meta, byState: data.byState, grid: data.grid || {} };
    _cacheSource = 'blob';
    console.warn(`[SSURGO Cache] Loaded from blob (${data.meta.unitCount} units)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getSsurgoByState(state: string): SsurgoSoilUnit[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.byState[state.toUpperCase()] || [];
}

export function getSsurgoNearby(lat: number, lng: number): SsurgoSoilUnit[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: SsurgoSoilUnit[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) results.push(...cell);
  }
  return results;
}

export async function setSsurgoCache(data: SsurgoCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { unitCount: _memCache._meta.unitCount, stateCount: _memCache._meta.stateCount }
    : null;
  const newCounts = { unitCount: data._meta.unitCount, stateCount: data._meta.stateCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[SSURGO Cache] Updated: ${data._meta.unitCount} units, ` +
    `${data._meta.stateCount} states`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/ssurgo.json', { meta: data._meta, byState: data.byState, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isSsurgoBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[SSURGO Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setSsurgoBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getSsurgoCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    unitCount: _memCache._meta.unitCount,
    stateCount: _memCache._meta.stateCount,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
