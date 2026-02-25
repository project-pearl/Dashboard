/**
 * NWIS Instantaneous Values (IV) Cache — Server-side spatial cache for
 * USGS real-time surface water quality data (DO, pH, temperature,
 * conductivity, turbidity, discharge, gage height).
 *
 * Populated by /api/cron/rebuild-nwis-iv (every 30 min for 19 priority states).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UsgsIvSite {
  siteNumber: string;          // "01646500"
  siteName: string;            // "Potomac River near Wash, DC"
  siteType: string;            // "ST" (stream), "LK" (lake), "ES" (estuary)
  state: string;               // "MD"
  huc: string;                 // HUC-8
  lat: number;
  lng: number;
  parameterCodes: string[];    // ["00300","00010","00400"] — what this site measures
}

export interface UsgsIvReading {
  siteNumber: string;
  dateTime: string;            // ISO timestamp (most recent reading)
  parameterCd: string;         // "00300"
  parameterName: string;       // "DO" (our mapped key)
  value: number;
  unit: string;                // "mg/l", "deg C", etc.
  qualifier: string;           // "P"=provisional, "A"=approved
  lat: number;
  lng: number;
}

interface GridCell {
  sites: UsgsIvSite[];
  readings: UsgsIvReading[];
}

export interface NwisIvCacheMeta {
  built: string;
  siteCount: number;
  readingCount: number;
  statesProcessed: string[];
  gridCells: number;
}

interface NwisIvCacheData {
  _meta: NwisIvCacheMeta;
  grid: Record<string, GridCell>;
}

export interface NwisIvLookupResult {
  sites: UsgsIvSite[];
  readings: UsgsIvReading[];
  cacheBuilt: string;
  statesProcessed: string[];
  fromCache: true;
}

// ── Parameter Mapping ────────────────────────────────────────────────────────

export const USGS_PARAM_MAP: Record<string, string> = {
  '00300': 'DO',           // Dissolved oxygen mg/L
  '00010': 'temperature',  // Water temperature °C
  '00400': 'pH',           // pH
  '00095': 'conductivity', // Specific conductance µS/cm
  '63680': 'turbidity',    // Turbidity NTU
  '00060': 'discharge',    // Streamflow cfs
  '00065': 'gage_height',  // Gage height ft
};

export const IV_PARAMETER_CODES = Object.keys(USGS_PARAM_MAP).join(',');

// ── Cache Singleton ──────────────────────────────────────────────────────────

const GRID_RES = 0.1;

let _memCache: NwisIvCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'nwis-iv-priority-states.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;

    _memCache = {
      _meta: {
        built: data.meta.built,
        siteCount: data.meta.siteCount || 0,
        readingCount: data.meta.readingCount || 0,
        statesProcessed: data.meta.statesProcessed || [],
        gridCells: data.meta.gridCells || Object.keys(data.grid).length,
      },
      grid: data.grid,
    };
    _cacheSource = 'disk';

    console.log(
      `[NWIS-IV Cache] Loaded from disk (${_memCache._meta.siteCount} sites, ` +
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
    const file = path.join(dir, 'nwis-iv-priority-states.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: {
        built: _memCache._meta.built,
        siteCount: _memCache._meta.siteCount,
        readingCount: _memCache._meta.readingCount,
        statesProcessed: _memCache._meta.statesProcessed,
        gridCells: Object.keys(_memCache.grid).length,
      },
      grid: _memCache.grid,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[NWIS-IV Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.statesProcessed.length} states)`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/nwis-iv.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.warn(`[NWIS-IV Cache] Loaded from blob`);
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
 * Look up cached USGS IV data near a lat/lng. Checks target cell + 8 neighbors.
 */
export function getUsgsIvCache(lat: number, lng: number): NwisIvLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;

  const sites: UsgsIvSite[] = [];
  const readings: UsgsIvReading[] = [];

  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = _memCache.grid[key];
      if (cell) {
        sites.push(...cell.sites);
        readings.push(...cell.readings);
      }
    }
  }

  if (sites.length === 0 && readings.length === 0) return null;

  return {
    sites,
    readings,
    cacheBuilt: _memCache._meta.built,
    statesProcessed: _memCache._meta.statesProcessed,
    fromCache: true,
  };
}

/**
 * Get all USGS IV readings for a state (flat array, for alert evaluation).
 */
export function getUsgsIvByState(abbr: string): UsgsIvReading[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const upper = abbr.toUpperCase();
  const readings: UsgsIvReading[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    for (const r of cell.readings) {
      // Readings don't carry state directly — match via site
      readings.push(r);
    }
  }
  // Filter by matching sites in that state
  const stateSiteNums = new Set<string>();
  for (const cell of Object.values(_memCache.grid)) {
    for (const s of cell.sites) {
      if (s.state === upper) stateSiteNums.add(s.siteNumber);
    }
  }
  return readings.filter(r => stateSiteNums.has(r.siteNumber));
}

/**
 * Get the raw grid for merging (used by cron to merge new data).
 */
export function getExistingGrid(): Record<string, GridCell> | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.grid;
}

/**
 * Replace the in-memory cache (called by cron route after fetching fresh data).
 */
export async function setUsgsIvCache(data: NwisIvCacheData): Promise<void> {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  const m = data._meta;
  console.log(
    `[NWIS-IV Cache] In-memory updated: ${m.siteCount} sites, ${m.readingCount} readings, ` +
    `${m.gridCells} cells, ${m.statesProcessed.length} states`
  );
  saveToDisk();
  await saveCacheToBlob('cache/nwis-iv.json', { meta: data._meta, grid: data.grid });
}

/**
 * Build lock with 12-min auto-clear.
 */
let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNwisIvBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NWIS-IV Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setNwisIvBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getUsgsIvCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    gridCells: _memCache._meta.gridCells,
    siteCount: _memCache._meta.siteCount,
    readingCount: _memCache._meta.readingCount,
    statesProcessed: _memCache._meta.statesProcessed,
  };
}
