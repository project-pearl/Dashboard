/**
 * WQP Cache — Server-side spatial cache for national WQP water quality data.
 *
 * Populated by /api/cron/rebuild-wqp (daily cron for 19 priority states).
 * Non-priority states fall through to live WQP API calls.
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 * Persists to disk so cache survives Vercel cold starts.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface WqpRecord {
  stn: string;       // MonitoringLocationIdentifier
  name: string;      // MonitoringLocationName
  date: string;      // ActivityStartDate
  key: string;       // PEARL key (DO, pH, temperature, etc.)
  char: string;      // Original CharacteristicName
  val: number;
  unit: string;
  org: string;       // OrganizationFormalName
  lat: number;
  lng: number;
  state?: string;    // 2-char state abbreviation (set by cron)
}

interface GridCell {
  records: WqpRecord[];
}

export interface WqpCacheMeta {
  built: string;
  totalRecords: number;
  statesProcessed: string[];
  gridCells: number;
}

interface WqpCacheData {
  _meta: WqpCacheMeta;
  grid: Record<string, GridCell>;
}

export interface WqpLookupResult {
  data: WqpRecord[];
  cacheBuilt: string;
  statesProcessed: string[];
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const GRID_RES = 0.1;
const CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours — buffer past daily cron

let _memCache: WqpCacheData | null = null;
let buildStatus: 'cold' | 'building' | 'ready' | 'stale' = 'cold';
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

// ── Disk Persistence (follows ATTAINS pattern from lib/attainsCache.ts) ─────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'wqp-priority-states.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;

    _memCache = {
      _meta: {
        built: data.meta.built,
        totalRecords: data.meta.totalRecords || 0,
        statesProcessed: data.meta.statesProcessed || [],
        gridCells: data.meta.gridCells || Object.keys(data.grid).length,
      },
      grid: data.grid,
    };
    _cacheSource = 'disk';

    const builtTime = data.meta.built ? new Date(data.meta.built).getTime() : 0;
    buildStatus = (builtTime && (Date.now() - builtTime < CACHE_TTL_MS)) ? 'ready' : 'stale';

    console.log(
      `[WQP Cache] Loaded from disk (${_memCache._meta.totalRecords} records, ` +
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
    const file = path.join(dir, 'wqp-priority-states.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: {
        built: _memCache._meta.built,
        totalRecords: _memCache._meta.totalRecords,
        statesProcessed: _memCache._meta.statesProcessed,
        gridCells: Object.keys(_memCache.grid).length,
      },
      grid: _memCache.grid,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[WQP Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.statesProcessed.length} states)`);
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

// ── Grid Key ─────────────────────────────────────────────────────────────────

export function gridKey(lat: number, lng: number): string {
  const glat = (Math.floor(lat / GRID_RES) * GRID_RES).toFixed(2);
  const glng = (Math.floor(lng / GRID_RES) * GRID_RES).toFixed(2);
  return `${parseFloat(glat)}_${parseFloat(glng)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up cached WQP data near a lat/lng. Checks target cell + 8 neighbors.
 * Loads from disk on first access if no in-memory cache exists.
 */
export function getWqpCache(lat: number, lng: number): WqpLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;

  const records: WqpRecord[] = [];

  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = _memCache.grid[key];
      if (cell) {
        records.push(...cell.records);
      }
    }
  }

  if (records.length === 0) return null;

  return {
    data: records,
    cacheBuilt: _memCache._meta.built,
    statesProcessed: _memCache._meta.statesProcessed,
    fromCache: true,
  };
}

/**
 * Replace the in-memory cache (called by cron route after fetching fresh data).
 * Also persists to disk for cold-start recovery.
 */
export function setWqpCache(data: WqpCacheData): void {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  buildStatus = 'ready';
  console.log(
    `[WQP Cache] In-memory updated: ${data._meta.totalRecords} records, ` +
    `${Object.keys(data.grid).length} cells, ${data._meta.statesProcessed.length} states`
  );
  saveToDisk();
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 min — auto-clear stale locks
export function isWqpBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[WQP Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}
export function setWqpBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
  if (v) buildStatus = 'building';
}

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getWqpCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return {
    loaded: false,
    source: null as string | null,
    buildStatus,
  };
  return {
    loaded: true,
    source: _cacheSource,
    buildStatus,
    built: _memCache._meta.built,
    gridCells: Object.keys(_memCache.grid).length,
    totalRecords: _memCache._meta.totalRecords,
    statesProcessed: _memCache._meta.statesProcessed,
  };
}

/**
 * Get all WQP records across all grid cells (flat array).
 * Used by stateReportCache for aggregation.
 */
export function getWqpAllRecords(): WqpRecord[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: WqpRecord[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.records);
  }
  return all;
}
