/**
 * National Ground Water Monitoring Network (NGWMN) Cache — Server-side
 * spatial cache for groundwater monitoring sites, water levels, and quality.
 *
 * Data source: NGWMN web services (provider-batched fetching).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NgwmnWaterLevel {
  date: string;
  value: number;
  unit: string;
}

export interface NgwmnWaterQuality {
  date: string;
  parameter: string;
  value: number;
  unit: string;
}

export interface NgwmnSite {
  id: string;
  agencyCd: string;
  siteNo: string;
  siteName: string;
  state: string;
  county: string;
  aquiferName: string;
  wellDepth: number | null;
  lat: number;
  lng: number;
  waterLevels: NgwmnWaterLevel[];
  waterQuality: NgwmnWaterQuality[];
}

interface GridCell {
  sites: NgwmnSite[];
}

interface NgwmnCacheMeta {
  built: string;
  siteCount: number;
  providerCount: number;
  gridCells: number;
}

interface NgwmnCacheData {
  _meta: NgwmnCacheMeta;
  grid: Record<string, GridCell>;
  stateIndex: Record<string, NgwmnSite[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: NgwmnCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'ngwmn.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid, stateIndex: data.stateIndex || {} };
    _cacheSource = 'disk';
    console.log(`[NGWMN Cache] Loaded from disk (${data.meta.siteCount} sites, built ${data.meta.built})`);
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
    const file = path.join(dir, 'ngwmn.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: _memCache._meta,
      grid: _memCache.grid,
      stateIndex: _memCache.stateIndex,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[NGWMN Cache] Saved to disk (${(Buffer.byteLength(payload) / 1024).toFixed(1)} KB)`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any; stateIndex: any }>('cache/ngwmn.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid, stateIndex: data.stateIndex || {} };
    _cacheSource = 'blob';
    console.warn(`[NGWMN Cache] Loaded from blob (${data.meta.siteCount} sites)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getNgwmnCache(lat: number, lng: number): NgwmnSite[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const sites: NgwmnSite[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) sites.push(...cell.sites);
  }
  return sites.length > 0 ? sites : null;
}

export function getNgwmnAllSites(): NgwmnSite[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: NgwmnSite[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.sites);
  }
  return all;
}

export function getNgwmnByState(state: string): NgwmnSite[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const upper = state.toUpperCase();
  return _memCache.stateIndex[upper] || [];
}

// ── Setter ───────────────────────────────────────────────────────────────────

export async function setNgwmnCache(data: NgwmnCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { siteCount: _memCache._meta.siteCount, gridCells: _memCache._meta.gridCells }
    : null;
  const newCounts = { siteCount: data._meta.siteCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[NGWMN Cache] Updated: ${data._meta.siteCount} sites, ` +
    `${data._meta.gridCells} cells, ${data._meta.providerCount} providers`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/ngwmn.json', {
    meta: data._meta,
    grid: data.grid,
    stateIndex: data.stateIndex,
  });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNgwmnBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NGWMN Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setNgwmnBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getNgwmnCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    siteCount: _memCache._meta.siteCount,
    providerCount: _memCache._meta.providerCount,
    gridCells: _memCache._meta.gridCells,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
