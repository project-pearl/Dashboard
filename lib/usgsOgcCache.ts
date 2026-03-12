/**
 * USGS OGC Cache — Server-side cache for USGS OGC API monitoring locations.
 *
 * Populated by /api/cron/rebuild-usgs-ogc (daily cron).
 * Pulls monitoring location data from the USGS OGC API v0.
 * Grid-indexed (0.1°) for spatial lookups.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, gridKey, neighborKeys, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UsgsOgcStation {
  id: string;
  name: string;
  state: string;
  county: string;
  huc8: string;
  siteType: string;
  lat: number;
  lng: number;
  agencyCode: string;
  parameters: string[];
  hasRealtimeData: boolean;
  latestObservation: string | null;
}

export interface UsgsOgcCacheMeta {
  built: string;
  stationCount: number;
  stateCount: number;
  siteTypes: number;
  agencies: number;
}

interface UsgsOgcCacheData {
  _meta: UsgsOgcCacheMeta;
  grid: Record<string, UsgsOgcStation[]>;
  byState: Record<string, UsgsOgcStation[]>;
}

export interface UsgsOgcLookupResult {
  stations: UsgsOgcStation[];
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: UsgsOgcCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'usgs-ogc.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid, byState: data.byState || {} };
    _cacheSource = 'disk';
    console.log(`[USGS OGC Cache] Loaded from disk (${_memCache._meta.stationCount} stations, ${_memCache._meta.stateCount} states)`);
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
    fs.writeFileSync(path.join(dir, 'usgs-ogc.json'), payload, 'utf-8');
    console.log(`[USGS OGC Cache] Saved to disk (${(Buffer.byteLength(payload) / 1024 / 1024).toFixed(1)}MB)`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any; byState: any }>('cache/usgs-ogc.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid, byState: data.byState || {} };
    _cacheSource = 'disk';
    console.warn(`[USGS OGC Cache] Loaded from blob (${data.meta.stationCount} stations)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getUsgsOgcCache(lat: number, lng: number): UsgsOgcLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const keys = neighborKeys(lat, lng);
  const stations: UsgsOgcStation[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    for (const s of _memCache.grid[k] || []) {
      if (!seen.has(s.id)) { seen.add(s.id); stations.push(s); }
    }
  }
  if (stations.length === 0) return null;
  return { stations, cacheBuilt: _memCache._meta.built, fromCache: true };
}

export function getUsgsOgcAllStations(): Record<string, UsgsOgcStation[]> | null {
  ensureDiskLoaded();
  return _memCache?.byState ?? null;
}

export function getUsgsOgcByState(state: string): UsgsOgcStation[] | null {
  ensureDiskLoaded();
  return _memCache?.byState[state.toUpperCase()] ?? null;
}

export async function setUsgsOgcCache(data: UsgsOgcCacheData): Promise<void> {
  const prev = _memCache ? { stationCount: _memCache._meta.stationCount, stateCount: _memCache._meta.stateCount } : null;
  const next = { stationCount: data._meta.stationCount, stateCount: data._meta.stateCount };
  _lastDelta = computeCacheDelta(prev, next, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[USGS OGC Cache] Updated: ${data._meta.stationCount} stations, ${data._meta.stateCount} states`);
  saveToDisk();
  await saveCacheToBlob('cache/usgs-ogc.json', { meta: data._meta, grid: data.grid, byState: data.byState });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isUsgsOgcBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[USGS OGC Cache] Auto-clearing stale build lock');
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setUsgsOgcBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getUsgsOgcCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true, source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built, stationCount: _memCache._meta.stationCount,
    stateCount: _memCache._meta.stateCount, siteTypes: _memCache._meta.siteTypes,
    agencies: _memCache._meta.agencies, lastDelta: _lastDelta,
  };
}
