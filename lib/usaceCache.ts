/**
 * USACE Cache — Server-side spatial cache for US Army Corps of Engineers water data.
 *
 * Populated by /api/cron/rebuild-usace (daily cron).
 * Fetches reservoir/dam locations and water temperature timeseries from CWMS Data API.
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UsaceLocation {
  name: string;
  office: string;
  lat: number;
  lng: number;
  type: string;           // STREAM_LOCATION, PROJECT, etc.
  nearestCity: string;
  state: string;
  waterTemp: number | null;   // Latest water temp in °C
  waterTempTime: string | null;
  poolLevel: number | null;   // ft
  poolLevelTime: string | null;
}

interface GridCell {
  locations: UsaceLocation[];
}

export interface UsaceCacheMeta {
  built: string;
  locationCount: number;
  officesQueried: number;
  withWaterTemp: number;
  gridCells: number;
}

interface UsaceCacheData {
  _meta: UsaceCacheMeta;
  grid: Record<string, GridCell>;
}

export interface UsaceLookupResult {
  locations: UsaceLocation[];
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const GRID_RES = 0.1;

let _memCache: UsaceCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'usace-locations.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[USACE Cache] Loaded from disk (${data.meta.locationCount} locations)`);
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
    const file = path.join(dir, 'usace-locations.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[USACE Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.locationCount} locations)`);
  } catch {}
}

let _diskLoaded = false;
function ensureDiskLoaded() {
  if (!_diskLoaded) { _diskLoaded = true; loadFromDisk(); }
}

let _blobChecked = false;
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_memCache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/usace.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.warn(`[USACE Cache] Loaded from blob (${data.meta.locationCount} locations)`);
  }
}

// ── Grid Key ─────────────────────────────────────────────────────────────────

export function gridKey(lat: number, lng: number): string {
  const glat = (Math.floor(lat / GRID_RES) * GRID_RES).toFixed(2);
  const glng = (Math.floor(lng / GRID_RES) * GRID_RES).toFixed(2);
  return `${parseFloat(glat)}_${parseFloat(glng)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getUsaceCache(lat: number, lng: number): UsaceLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;

  const locations: UsaceLocation[] = [];
  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = _memCache.grid[key];
      if (cell) locations.push(...cell.locations);
    }
  }
  if (locations.length === 0) return null;
  return { locations, cacheBuilt: _memCache._meta.built, fromCache: true };
}

export async function setUsaceCache(data: UsaceCacheData): Promise<void> {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[USACE Cache] Updated: ${data._meta.locationCount} locations, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/usace.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isUsaceBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}
export function setUsaceBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getUsaceCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    locationCount: _memCache._meta.locationCount,
    officesQueried: _memCache._meta.officesQueried,
    withWaterTemp: _memCache._meta.withWaterTemp,
    gridCells: _memCache._meta.gridCells,
  };
}
