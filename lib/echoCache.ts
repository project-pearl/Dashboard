/**
 * ECHO Cache — Server-side spatial cache for EPA ECHO facility compliance data.
 *
 * Populated by /api/cron/rebuild-echo (daily cron for 19 priority states).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface EchoFacility {
  registryId: string;
  name: string;
  state: string;
  permitId: string;
  lat: number;
  lng: number;
  complianceStatus: string;
  qtrsInViolation: number;
}

export interface EchoViolation {
  registryId: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  violationType: string;
  pollutant: string;
  qtrsInNc: number;
}

interface GridCell {
  facilities: EchoFacility[];
  violations: EchoViolation[];
}

export interface EchoCacheMeta {
  built: string;
  facilityCount: number;
  violationCount: number;
  statesProcessed: string[];
  gridCells: number;
}

interface EchoCacheData {
  _meta: EchoCacheMeta;
  grid: Record<string, GridCell>;
}

export interface EchoLookupResult {
  facilities: EchoFacility[];
  violations: EchoViolation[];
  cacheBuilt: string;
  statesProcessed: string[];
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const GRID_RES = 0.1;
const CACHE_TTL_MS = 48 * 60 * 60 * 1000;

let _memCache: EchoCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'echo-priority-states.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;

    _memCache = {
      _meta: {
        built: data.meta.built,
        facilityCount: data.meta.facilityCount || 0,
        violationCount: data.meta.violationCount || 0,
        statesProcessed: data.meta.statesProcessed || [],
        gridCells: data.meta.gridCells || Object.keys(data.grid).length,
      },
      grid: data.grid,
    };
    _cacheSource = 'disk';

    console.log(
      `[ECHO Cache] Loaded from disk (${_memCache._meta.facilityCount} facilities, ` +
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
    const file = path.join(dir, 'echo-priority-states.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: {
        built: _memCache._meta.built,
        facilityCount: _memCache._meta.facilityCount,
        violationCount: _memCache._meta.violationCount,
        statesProcessed: _memCache._meta.statesProcessed,
        gridCells: Object.keys(_memCache.grid).length,
      },
      grid: _memCache.grid,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[ECHO Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.statesProcessed.length} states)`);
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
 * Look up cached ECHO data near a lat/lng. Checks target cell + 8 neighbors.
 */
export function getEchoCache(lat: number, lng: number): EchoLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;

  const facilities: EchoFacility[] = [];
  const violations: EchoViolation[] = [];

  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = _memCache.grid[key];
      if (cell) {
        facilities.push(...cell.facilities);
        violations.push(...cell.violations);
      }
    }
  }

  if (facilities.length === 0 && violations.length === 0) {
    return null;
  }

  return {
    facilities,
    violations,
    cacheBuilt: _memCache._meta.built,
    statesProcessed: _memCache._meta.statesProcessed,
    fromCache: true,
  };
}

/**
 * Replace the in-memory cache (called by cron route after fetching fresh data).
 */
export function setEchoCache(data: EchoCacheData): void {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  const m = data._meta;
  console.log(
    `[ECHO Cache] In-memory updated: ${m.facilityCount} facilities, ${m.violationCount} violations, ` +
    `${m.gridCells} cells, ${m.statesProcessed.length} states`
  );
  saveToDisk();
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
export function isEchoBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[ECHO Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}
export function setEchoBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getEchoCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    gridCells: _memCache._meta.gridCells,
    facilityCount: _memCache._meta.facilityCount,
    violationCount: _memCache._meta.violationCount,
    statesProcessed: _memCache._meta.statesProcessed,
  };
}
