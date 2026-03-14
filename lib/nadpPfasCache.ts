/**
 * NADP PFAS Cache — Server-side grid-based cache for NOAA/NADP atmospheric
 * PFAS deposition monitoring data from the National Atmospheric Deposition
 * Program precipitation chemistry network.
 *
 * Populated by /api/cron/rebuild-nadp-pfas.
 * Source: https://nadp.slh.wisc.edu/ — National Atmospheric Deposition Program.
 *
 * Grid-based: Record<string, NadpPfasSample[]> at 0.1deg resolution with
 * state index for aggregation. Tracks PFOS/PFOA concentrations in
 * precipitation and wet deposition rates.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NadpPfasSample {
  siteId: string;
  siteName: string;
  network: string;
  lat: number;
  lng: number;
  state: string;
  sampleDate: string;
  pfosConc: number | null;
  pfoaConc: number | null;
  totalPfasConc: number | null;
  precipMm: number | null;
  depositionUgM2: number | null;
}

interface NadpPfasCacheMeta {
  built: string;
  sampleCount: number;
  siteCount: number;
  stateCount: number;
}

interface NadpPfasCacheData {
  _meta: NadpPfasCacheMeta;
  grid: Record<string, NadpPfasSample[]>;
  byState: Record<string, NadpPfasSample[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: NadpPfasCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'nadp-pfas.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid, byState: data.byState || {} };
    _cacheSource = 'disk';
    console.log(`[NADP PFAS Cache] Loaded from disk (${data.meta.sampleCount} samples, built ${data.meta.built})`);
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
    const file = path.join(dir, 'nadp-pfas.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid, byState: _memCache.byState });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[NADP PFAS Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any; byState: any }>('cache/nadp-pfas.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid, byState: data.byState || {} };
    _cacheSource = 'blob';
    console.warn(`[NADP PFAS Cache] Loaded from blob (${data.meta.sampleCount} samples)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getNadpPfasNearby(lat: number, lng: number): NadpPfasSample[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: NadpPfasSample[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) results.push(...cell);
  }
  return results;
}

export function getNadpPfasByState(state: string): NadpPfasSample[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.byState[state.toUpperCase()] || [];
}

export async function setNadpPfasCache(data: NadpPfasCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { sampleCount: _memCache._meta.sampleCount, siteCount: _memCache._meta.siteCount, stateCount: _memCache._meta.stateCount }
    : null;
  const newCounts = { sampleCount: data._meta.sampleCount, siteCount: data._meta.siteCount, stateCount: data._meta.stateCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[NADP PFAS Cache] Updated: ${data._meta.sampleCount} samples, ` +
    `${data._meta.siteCount} sites, ${data._meta.stateCount} states`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/nadp-pfas.json', { meta: data._meta, grid: data.grid, byState: data.byState });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNadpPfasBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NADP PFAS Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setNadpPfasBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getNadpPfasCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    sampleCount: _memCache._meta.sampleCount,
    siteCount: _memCache._meta.siteCount,
    stateCount: _memCache._meta.stateCount,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
