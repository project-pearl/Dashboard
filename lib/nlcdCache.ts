/**
 * NLCD Cache — Server-side state-keyed cache for USGS National Land Cover
 * Database county-level summaries including impervious surface, tree canopy,
 * and land use classification percentages.
 *
 * Populated by /api/cron/rebuild-nlcd.
 * Source: https://www.mrlc.gov/ — USGS Multi-Resolution Land Characteristics
 * Consortium (MRLC) NLCD products.
 *
 * State-keyed: Record<string, NlcdSummary[]> with grid index for spatial
 * lookups. Links to water quality via impervious surface runoff potential,
 * agricultural land use, and wetland coverage.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NlcdSummary {
  state: string;
  county: string;
  fips: string;
  developedPct: number;
  forestPct: number;
  croplandPct: number;
  wetlandPct: number;
  waterPct: number;
  barrenPct: number;
  grasslandPct: number;
  impervSurfacePct: number;
  treeCanopyPct: number;
  year: number;
  lat: number;
  lng: number;
}

interface NlcdCacheMeta {
  built: string;
  countyCount: number;
  stateCount: number;
  dataYear: number;
}

interface NlcdCacheData {
  _meta: NlcdCacheMeta;
  byState: Record<string, NlcdSummary[]>;
  grid: Record<string, NlcdSummary[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: NlcdCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'nlcd.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.byState) return false;
    _memCache = { _meta: data.meta, byState: data.byState, grid: data.grid || {} };
    _cacheSource = 'disk';
    console.log(`[NLCD Cache] Loaded from disk (${data.meta.countyCount} counties, built ${data.meta.built})`);
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
    const file = path.join(dir, 'nlcd.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, byState: _memCache.byState, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[NLCD Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; byState: any; grid: any }>('cache/nlcd.json');
  if (data?.meta && data?.byState) {
    _memCache = { _meta: data.meta, byState: data.byState, grid: data.grid || {} };
    _cacheSource = 'blob';
    console.warn(`[NLCD Cache] Loaded from blob (${data.meta.countyCount} counties)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getNlcdByState(state: string): NlcdSummary[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.byState[state.toUpperCase()] || [];
}

export function getNlcdNearby(lat: number, lng: number): NlcdSummary[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: NlcdSummary[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) results.push(...cell);
  }
  return results;
}

export async function setNlcdCache(data: NlcdCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { countyCount: _memCache._meta.countyCount, stateCount: _memCache._meta.stateCount }
    : null;
  const newCounts = { countyCount: data._meta.countyCount, stateCount: data._meta.stateCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[NLCD Cache] Updated: ${data._meta.countyCount} counties, ` +
    `${data._meta.stateCount} states, data year ${data._meta.dataYear}`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/nlcd.json', { meta: data._meta, byState: data.byState, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNlcdBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NLCD Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setNlcdBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getNlcdCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    countyCount: _memCache._meta.countyCount,
    stateCount: _memCache._meta.stateCount,
    dataYear: _memCache._meta.dataYear,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
