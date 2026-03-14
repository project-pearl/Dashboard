/**
 * CDC PLACES Health Data Cache — Server-side grid-based spatial cache for
 * CDC Population Level Analysis and Community Estimates (PLACES) census
 * tract-level health prevalence data.
 *
 * Populated by /api/cron/rebuild-cdc-places.
 * Source: https://www.cdc.gov/places/ — CDC PLACES local health data
 * providing model-based estimates for chronic disease prevalence at the
 * census tract level.
 *
 * Grid-based: Record<string, CdcPlacesData[]> using gridKey at 0.1°
 * resolution (~11km). Nearby lookups check target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CdcPlacesData {
  tractFips: string;
  state: string;
  county: string;
  totalPopulation: number;
  asthmaPrevalence: number | null;
  cancerPrevalence: number | null;
  ckdPrevalence: number | null;
  copdPrevalence: number | null;
  diabetesPrevalence: number | null;
  mentalHealthPrevalence: number | null;
  obesityPrevalence: number | null;
  smokingPrevalence: number | null;
  physicalInactivity: number | null;
  drinkingPrevalence: number | null;
  lat: number;
  lng: number;
}

interface CdcPlacesCacheMeta {
  built: string;
  tractCount: number;
  stateCount: number;
  gridCells: number;
}

interface CdcPlacesCacheData {
  _meta: CdcPlacesCacheMeta;
  grid: Record<string, CdcPlacesData[]>;
  stateIndex: Record<string, CdcPlacesData[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: CdcPlacesCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'cdc-places.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid, stateIndex: data.stateIndex || {} };
    _cacheSource = 'disk';
    console.log(`[CDC PLACES Cache] Loaded from disk (${data.meta.tractCount} tracts, built ${data.meta.built})`);
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
    const file = path.join(dir, 'cdc-places.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: _memCache._meta,
      grid: _memCache.grid,
      stateIndex: _memCache.stateIndex,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[CDC PLACES Cache] Saved to disk (${(Buffer.byteLength(payload) / 1024).toFixed(1)} KB)`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any; stateIndex: any }>('cache/cdc-places.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid, stateIndex: data.stateIndex || {} };
    _cacheSource = 'blob';
    console.warn(`[CDC PLACES Cache] Loaded from blob (${data.meta.tractCount} tracts)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getCdcPlacesNearby(lat: number, lng: number): CdcPlacesData[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: CdcPlacesData[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) results.push(...cell);
  }
  return results;
}

export function getCdcPlacesByState(state: string): CdcPlacesData[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.stateIndex[state.toUpperCase()] || [];
}

export function getCdcPlacesAll(): Record<string, CdcPlacesData[]> {
  ensureDiskLoaded();
  if (!_memCache) return {};
  return _memCache.grid;
}

// ── Setter ───────────────────────────────────────────────────────────────────

export async function setCdcPlacesCache(data: CdcPlacesCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { tractCount: _memCache._meta.tractCount, stateCount: _memCache._meta.stateCount, gridCells: _memCache._meta.gridCells }
    : null;
  const newCounts = { tractCount: data._meta.tractCount, stateCount: data._meta.stateCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[CDC PLACES Cache] Updated: ${data._meta.tractCount} tracts, ` +
    `${data._meta.stateCount} states, ${data._meta.gridCells} grid cells`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/cdc-places.json', {
    meta: data._meta,
    grid: data.grid,
    stateIndex: data.stateIndex,
  });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isCdcPlacesBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[CDC PLACES Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCdcPlacesBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCdcPlacesCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    tractCount: _memCache._meta.tractCount,
    stateCount: _memCache._meta.stateCount,
    gridCells: _memCache._meta.gridCells,
    lastDelta: _lastDelta,
  };
}
