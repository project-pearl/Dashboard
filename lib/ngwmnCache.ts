/**
 * NGWMN Cache — National Ground Water Monitoring Network.
 *
 * Populated by /api/cron/rebuild-ngwmn (daily cron).
 * Pulls groundwater monitoring data from CIDA USGS NGWMN REST API.
 * Grid-indexed (0.1°) for spatial lookups.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, gridKey, neighborKeys, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NgwmnWaterLevel {
  date: string;
  value: number;
  unit: string;
}

export interface NgwmnWaterQuality {
  parameter: string;
  value: number;
  unit: string;
  date: string;
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

export interface NgwmnCacheMeta {
  built: string;
  siteCount: number;
  stateCount: number;
  providerCount: number;
  qualityResultCount: number;
}

interface NgwmnCacheData {
  _meta: NgwmnCacheMeta;
  grid: Record<string, NgwmnSite[]>;
  byState: Record<string, NgwmnSite[]>;
}

export interface NgwmnLookupResult {
  sites: NgwmnSite[];
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: NgwmnCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;
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
    _memCache = { _meta: data.meta, grid: data.grid, byState: data.byState || {} };
    _cacheSource = 'disk';
    console.log(`[NGWMN Cache] Loaded from disk (${_memCache._meta.siteCount} sites, ${_memCache._meta.stateCount} states)`);
    return true;
  } catch { return false; }
}

function saveToDisk(): void {
  try {
    if (typeof process === 'undefined' || !_memCache) return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid, byState: _memCache.byState });
    fs.writeFileSync(path.join(dir, 'ngwmn.json'), payload, 'utf-8');
    console.log(`[NGWMN Cache] Saved to disk (${(Buffer.byteLength(payload) / 1024 / 1024).toFixed(1)}MB)`);
  } catch { /* optional */ }
}

let _diskLoaded = false;
function ensureDiskLoaded() { if (!_diskLoaded) { _diskLoaded = true; loadFromDisk(); } }

let _blobChecked = false;
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_memCache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<{ meta: any; grid: any; byState: any }>('cache/ngwmn.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid, byState: data.byState || {} };
    _cacheSource = 'disk';
    console.warn(`[NGWMN Cache] Loaded from blob (${data.meta.siteCount} sites)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getNgwmnCache(lat: number, lng: number): NgwmnLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const keys = neighborKeys(lat, lng);
  const sites: NgwmnSite[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    for (const s of _memCache.grid[k] || []) {
      if (!seen.has(s.id)) { seen.add(s.id); sites.push(s); }
    }
  }
  if (sites.length === 0) return null;
  return { sites, cacheBuilt: _memCache._meta.built, fromCache: true };
}

export function getNgwmnAllSites(): Record<string, NgwmnSite[]> | null {
  ensureDiskLoaded();
  return _memCache?.byState ?? null;
}

export function getNgwmnByState(state: string): NgwmnSite[] | null {
  ensureDiskLoaded();
  return _memCache?.byState[state.toUpperCase()] ?? null;
}

export async function setNgwmnCache(data: NgwmnCacheData): Promise<void> {
  const prev = _memCache ? { siteCount: _memCache._meta.siteCount, stateCount: _memCache._meta.stateCount } : null;
  const next = { siteCount: data._meta.siteCount, stateCount: data._meta.stateCount };
  _lastDelta = computeCacheDelta(prev, next, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[NGWMN Cache] Updated: ${data._meta.siteCount} sites, ${data._meta.stateCount} states`);
  saveToDisk();
  await saveCacheToBlob('cache/ngwmn.json', { meta: data._meta, grid: data.grid, byState: data.byState });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNgwmnBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NGWMN Cache] Auto-clearing stale build lock');
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setNgwmnBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getNgwmnCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true, source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built, siteCount: _memCache._meta.siteCount,
    stateCount: _memCache._meta.stateCount, providerCount: _memCache._meta.providerCount,
    qualityResultCount: _memCache._meta.qualityResultCount, lastDelta: _lastDelta,
  };
}
