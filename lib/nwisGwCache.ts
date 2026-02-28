/**
 * NWIS Groundwater Cache — Server-side spatial cache for USGS groundwater
 * level data (gwlevels, IV-GW, DV-GW).
 *
 * Populated by /api/cron/rebuild-nwis-gw (daily cron for 19 priority states).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NwisGwSite {
  siteNumber: string;       // USGS site ID (e.g. "392105077123401")
  siteName: string;         // Human-readable name
  aquiferCode: string;      // National aquifer code if available
  wellDepth: number | null; // Depth in feet
  state: string;            // State abbreviation
  county: string;           // County name or FIPS
  huc: string;              // HUC-8 watershed code
  lat: number;
  lng: number;
}

export interface NwisGwLevel {
  siteNumber: string;
  dateTime: string;         // ISO measurement timestamp
  value: number;            // Level measurement
  unit: string;             // "ft" typically
  parameterCd: string;      // 72019, 62610, or 62611
  parameterName: string;    // Human-readable
  qualifier: string;        // A=approved, P=provisional, e=estimated
  isRealtime: boolean;      // true if from IV, false if gwlevels/DV
  lat: number;
  lng: number;
}

export interface NwisGwTrend {
  siteNumber: string;
  siteName: string;
  latestLevel: number;
  latestDate: string;
  avgLevel30d: number | null;
  avgLevel90d: number | null;
  trend: 'rising' | 'falling' | 'stable' | 'unknown';
  trendMagnitude: number;   // ft/month rate of change
  lat: number;
  lng: number;
}

interface GridCell {
  sites: NwisGwSite[];
  levels: NwisGwLevel[];
  trends: NwisGwTrend[];
}

export interface NwisGwCacheMeta {
  built: string;
  siteCount: number;
  levelCount: number;
  trendCount: number;
  statesProcessed: string[];
  gridCells: number;
}

interface NwisGwCacheData {
  _meta: NwisGwCacheMeta;
  grid: Record<string, GridCell>;
}

export interface NwisGwLookupResult {
  sites: NwisGwSite[];
  levels: NwisGwLevel[];
  trends: NwisGwTrend[];
  cacheBuilt: string;
  statesProcessed: string[];
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const GRID_RES = 0.1;
const CACHE_TTL_MS = 48 * 60 * 60 * 1000;

let _memCache: NwisGwCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'nwis-gw-priority-states.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;

    _memCache = {
      _meta: {
        built: data.meta.built,
        siteCount: data.meta.siteCount || 0,
        levelCount: data.meta.levelCount || 0,
        trendCount: data.meta.trendCount || 0,
        statesProcessed: data.meta.statesProcessed || [],
        gridCells: data.meta.gridCells || Object.keys(data.grid).length,
      },
      grid: data.grid,
    };
    _cacheSource = 'disk';

    console.log(
      `[NWIS-GW Cache] Loaded from disk (${_memCache._meta.siteCount} sites, ` +
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
    const file = path.join(dir, 'nwis-gw-priority-states.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: {
        built: _memCache._meta.built,
        siteCount: _memCache._meta.siteCount,
        levelCount: _memCache._meta.levelCount,
        trendCount: _memCache._meta.trendCount,
        statesProcessed: _memCache._meta.statesProcessed,
        gridCells: Object.keys(_memCache.grid).length,
      },
      grid: _memCache.grid,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[NWIS-GW Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.statesProcessed.length} states)`);
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
  const data = await loadCacheFromBlob<{meta: any; grid: any}>('cache/nwis-gw.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.warn(`[NWIS-GW Cache] Loaded from blob`);
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
 * Look up cached NWIS groundwater data near a lat/lng. Checks target cell + 8 neighbors.
 */
export function getNwisGwCache(lat: number, lng: number): NwisGwLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;

  const sites: NwisGwSite[] = [];
  const levels: NwisGwLevel[] = [];
  const trends: NwisGwTrend[] = [];

  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = _memCache.grid[key];
      if (cell) {
        sites.push(...cell.sites);
        levels.push(...cell.levels);
        trends.push(...cell.trends);
      }
    }
  }

  if (sites.length === 0 && levels.length === 0 && trends.length === 0) {
    return null;
  }

  return {
    sites,
    levels,
    trends,
    cacheBuilt: _memCache._meta.built,
    statesProcessed: _memCache._meta.statesProcessed,
    fromCache: true,
  };
}

/**
 * Replace the in-memory cache (called by cron route after fetching fresh data).
 */
export async function setNwisGwCache(data: NwisGwCacheData): Promise<void> {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  const m = data._meta;
  console.log(
    `[NWIS-GW Cache] In-memory updated: ${m.siteCount} sites, ${m.levelCount} levels, ` +
    `${m.trendCount} trends, ${m.gridCells} cells, ${m.statesProcessed.length} states`
  );
  saveToDisk();
  await saveCacheToBlob('cache/nwis-gw.json', { meta: data._meta, grid: data.grid });
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
export function isNwisGwBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NWIS-GW Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}
export function setNwisGwBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

/**
 * Get all NWIS-GW sites across all grid cells (flat array).
 * Used by stateAssessmentBuilder for state-level aggregation.
 */
export function getNwisGwAllSites(): NwisGwSite[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: NwisGwSite[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.sites);
  }
  return all;
}

/**
 * Get all NWIS-GW trends across all grid cells (flat array).
 * Used by /api/nwis-gw/national-summary for the Groundwater Monitoring Status table.
 */
export function getNwisGwAllTrends(): NwisGwTrend[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: NwisGwTrend[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.trends);
  }
  return all;
}

/**
 * Get the existing grid (for cron route to merge new state data into).
 */
export function getExistingGrid(): Record<string, GridCell> | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.grid;
}

/**
 * Get list of states already in the cache.
 */
export function getExistingStatesProcessed(): string[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache._meta.statesProcessed || [];
}

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getNwisGwCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    gridCells: _memCache._meta.gridCells,
    siteCount: _memCache._meta.siteCount,
    levelCount: _memCache._meta.levelCount,
    trendCount: _memCache._meta.trendCount,
    statesProcessed: _memCache._meta.statesProcessed,
  };
}
