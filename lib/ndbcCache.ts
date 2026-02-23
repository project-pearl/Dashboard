/**
 * NDBC Cache — Server-side spatial cache for NOAA National Data Buoy Center data.
 *
 * Populated by /api/cron/rebuild-ndbc (daily cron).
 * Fetches active station list + latest observations from NDBC text endpoints.
 * Stations with water quality data get additional ocean params (DO, pH, salinity).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NdbcObservation {
  windDir: number | null;     // degrees true
  windSpeed: number | null;   // m/s
  gust: number | null;        // m/s
  waveHeight: number | null;  // m
  wavePeriod: number | null;  // sec
  pressure: number | null;    // hPa
  airTemp: number | null;     // °C
  waterTemp: number | null;   // °C
  dewPoint: number | null;    // °C
  tide: number | null;        // ft
}

export interface NdbcOceanParams {
  depth: number | null;       // m
  oceanTemp: number | null;   // °C
  salinity: number | null;    // PSU
  dissolvedO2Pct: number | null;  // %
  dissolvedO2Ppm: number | null;  // ppm
  chlorophyll: number | null;     // µg/L
  turbidity: number | null;       // FTU
  ph: number | null;
}

export interface NdbcStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;             // buoy, fixed, dart, etc.
  owner: string;
  hasMeteo: boolean;
  hasWQ: boolean;
  observation: NdbcObservation | null;
  ocean: NdbcOceanParams | null;
  observedAt: string | null;  // ISO timestamp of last observation
}

interface GridCell {
  stations: NdbcStation[];
}

export interface NdbcCacheMeta {
  built: string;
  stationCount: number;
  wqStationCount: number;
  gridCells: number;
}

interface NdbcCacheData {
  _meta: NdbcCacheMeta;
  grid: Record<string, GridCell>;
}

export interface NdbcLookupResult {
  stations: NdbcStation[];
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const GRID_RES = 0.1;

let _memCache: NdbcCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'ndbc-buoys.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;

    _memCache = {
      _meta: {
        built: data.meta.built,
        stationCount: data.meta.stationCount || 0,
        wqStationCount: data.meta.wqStationCount || 0,
        gridCells: data.meta.gridCells || Object.keys(data.grid).length,
      },
      grid: data.grid,
    };
    _cacheSource = 'disk';
    console.log(
      `[NDBC Cache] Loaded from disk (${_memCache._meta.stationCount} stations, ` +
      `${_memCache._meta.wqStationCount} WQ, built ${data.meta.built || 'unknown'})`
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
    const file = path.join(dir, 'ndbc-buoys.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[NDBC Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.stationCount} stations)`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/ndbc.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.warn(`[NDBC Cache] Loaded from blob (${data.meta.stationCount} stations)`);
  }
}

// ── Grid Key ─────────────────────────────────────────────────────────────────

export function gridKey(lat: number, lng: number): string {
  const glat = (Math.floor(lat / GRID_RES) * GRID_RES).toFixed(2);
  const glng = (Math.floor(lng / GRID_RES) * GRID_RES).toFixed(2);
  return `${parseFloat(glat)}_${parseFloat(glng)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getNdbcCache(lat: number, lng: number): NdbcLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;

  const stations: NdbcStation[] = [];
  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = _memCache.grid[key];
      if (cell) stations.push(...cell.stations);
    }
  }
  if (stations.length === 0) return null;

  return { stations, cacheBuilt: _memCache._meta.built, fromCache: true };
}

export function setNdbcCache(data: NdbcCacheData): void {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[NDBC Cache] In-memory updated: ${data._meta.stationCount} stations, ` +
    `${data._meta.wqStationCount} WQ, ${data._meta.gridCells} cells`
  );
  saveToDisk();
  saveCacheToBlob('cache/ndbc.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNdbcBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NDBC Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setNdbcBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getNdbcCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    stationCount: _memCache._meta.stationCount,
    wqStationCount: _memCache._meta.wqStationCount,
    gridCells: _memCache._meta.gridCells,
  };
}
