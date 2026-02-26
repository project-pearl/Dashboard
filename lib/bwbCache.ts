/**
 * BWB Cache — Server-side spatial cache for Blue Water Baltimore / Water Reporter data.
 *
 * Populated by /api/cron/rebuild-bwb (daily cron).
 * Pulls stations + latest parameter readings from api.waterreporter.org and
 * stores in a spatial grid so the dashboard has data even when the API is down.
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BwbParameter {
  name: string;
  normalizedName: string;
  unit: string;
  latestValue: number | null;
  latestDate: string | null;
}

export interface BwbStation {
  stationId: number;
  datasetId: number;
  name: string;
  lat: number;
  lng: number;
  isActive: boolean;
  lastSampled: string;
  parameters: BwbParameter[];
}

interface GridCell {
  stations: BwbStation[];
}

export interface BwbCacheMeta {
  built: string;
  stationCount: number;
  parameterReadings: number;
  datasetsScanned: number;
  gridCells: number;
}

interface BwbCacheData {
  _meta: BwbCacheMeta;
  grid: Record<string, GridCell>;
}

export interface BwbLookupResult {
  stations: BwbStation[];
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const GRID_RES = 0.1;
const CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours — buffer past daily cron

let _memCache: BwbCacheData | null = null;
let _cacheSource: 'disk' | 'blob' | 'memory (cron)' | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'bwb-stations.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;

    _memCache = {
      _meta: {
        built: data.meta.built,
        stationCount: data.meta.stationCount || 0,
        parameterReadings: data.meta.parameterReadings || 0,
        datasetsScanned: data.meta.datasetsScanned || 0,
        gridCells: data.meta.gridCells || Object.keys(data.grid).length,
      },
      grid: data.grid,
    };
    _cacheSource = 'disk';

    console.log(
      `[BWB Cache] Loaded from disk (${_memCache._meta.stationCount} stations, ` +
      `${Object.keys(_memCache.grid).length} cells, built ${data.meta.built || 'unknown'})`
    );
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
    const file = path.join(dir, 'bwb-stations.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: {
        built: _memCache._meta.built,
        stationCount: _memCache._meta.stationCount,
        parameterReadings: _memCache._meta.parameterReadings,
        datasetsScanned: _memCache._meta.datasetsScanned,
        gridCells: Object.keys(_memCache.grid).length,
      },
      grid: _memCache.grid,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[BWB Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.stationCount} stations)`);
  } catch {
    // Disk save is optional — fail silently
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
  const data = await loadCacheFromBlob<{meta: any; grid: any}>('cache/bwb.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[BWB Cache] Loaded from blob (${data.meta.stationCount} stations)`);
  }
}

// ── Grid Key ─────────────────────────────────────────────────────────────────

export function gridKey(lat: number, lng: number): string {
  const glat = (Math.floor(lat / GRID_RES) * GRID_RES).toFixed(2);
  const glng = (Math.floor(lng / GRID_RES) * GRID_RES).toFixed(2);
  return `${parseFloat(glat)}_${parseFloat(glng)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up cached BWB data near a lat/lng. Checks target cell + 8 neighbors.
 */
export function getBwbCache(lat: number, lng: number): BwbLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;

  const stations: BwbStation[] = [];

  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = _memCache.grid[key];
      if (cell) {
        stations.push(...cell.stations);
      }
    }
  }

  if (stations.length === 0) return null;

  return {
    stations,
    cacheBuilt: _memCache._meta.built,
    fromCache: true,
  };
}

export function getBwbAllStations(): BwbStation[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: BwbStation[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.stations);
  }
  return all;
}

/**
 * Replace the in-memory cache (called by cron route after fetching fresh data).
 */
export async function setBwbCache(data: BwbCacheData): Promise<void> {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  const m = data._meta;
  console.log(
    `[BWB Cache] In-memory updated: ${m.stationCount} stations, ${m.parameterReadings} readings, ` +
    `${m.datasetsScanned} datasets, ${m.gridCells} cells`
  );
  saveToDisk();
  await saveCacheToBlob('cache/bwb.json', { meta: data._meta, grid: data.grid });
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 min — auto-clear stale locks
export function isBwbBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[BWB Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}
export function setBwbBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getBwbCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    gridCells: _memCache._meta.gridCells,
    stationCount: _memCache._meta.stationCount,
    parameterReadings: _memCache._meta.parameterReadings,
    datasetsScanned: _memCache._meta.datasetsScanned,
  };
}
