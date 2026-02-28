/**
 * SDWIS Cache — Server-side spatial cache for EPA Safe Drinking Water
 * Information System data.
 *
 * Populated by /api/cron/rebuild-sdwis (daily cron for 19 priority states).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SdwisSystem {
  pwsid: string;          // Public Water System ID
  name: string;           // System name
  type: string;           // CWS, TNCWS, NTNCWS
  population: number;     // Population served
  sourceWater: string;    // GW (groundwater), SW (surface water), GU/SWP
  state: string;
  lat: number;
  lng: number;
}

export interface SdwisViolation {
  pwsid: string;
  code: string;           // Violation code
  contaminant: string;    // Contaminant name
  rule: string;           // Rule name (LCR, TCR, SWTR, etc.)
  isMajor: boolean;
  isHealthBased: boolean;
  compliancePeriod: string;
  lat: number;
  lng: number;
}

export interface SdwisEnforcement {
  pwsid: string;
  actionType: string;
  date: string;
  lat: number;
  lng: number;
}

interface GridCell {
  systems: SdwisSystem[];
  violations: SdwisViolation[];
  enforcement: SdwisEnforcement[];
}

export interface SdwisCacheMeta {
  built: string;
  systemCount: number;
  violationCount: number;
  enforcementCount: number;
  statesProcessed: string[];
  gridCells: number;
}

interface SdwisCacheData {
  _meta: SdwisCacheMeta;
  grid: Record<string, GridCell>;
}

export interface SdwisLookupResult {
  systems: SdwisSystem[];
  violations: SdwisViolation[];
  enforcement: SdwisEnforcement[];
  cacheBuilt: string;
  statesProcessed: string[];
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const GRID_RES = 0.1;
const CACHE_TTL_MS = 48 * 60 * 60 * 1000;

let _memCache: SdwisCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'sdwis-priority-states.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;

    _memCache = {
      _meta: {
        built: data.meta.built,
        systemCount: data.meta.systemCount || 0,
        violationCount: data.meta.violationCount || 0,
        enforcementCount: data.meta.enforcementCount || 0,
        statesProcessed: data.meta.statesProcessed || [],
        gridCells: data.meta.gridCells || Object.keys(data.grid).length,
      },
      grid: data.grid,
    };
    _cacheSource = 'disk';

    console.log(
      `[SDWIS Cache] Loaded from disk (${_memCache._meta.systemCount} systems, ` +
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
    const file = path.join(dir, 'sdwis-priority-states.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: {
        built: _memCache._meta.built,
        systemCount: _memCache._meta.systemCount,
        violationCount: _memCache._meta.violationCount,
        enforcementCount: _memCache._meta.enforcementCount,
        statesProcessed: _memCache._meta.statesProcessed,
        gridCells: Object.keys(_memCache.grid).length,
      },
      grid: _memCache.grid,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[SDWIS Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.statesProcessed.length} states)`);
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
  const data = await loadCacheFromBlob<{meta: any; grid: any}>('cache/sdwis.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.warn(`[SDWIS Cache] Loaded from blob (${data.meta.systemCount} systems)`);
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
 * Look up cached SDWIS data near a lat/lng. Checks target cell + 8 neighbors.
 */
export function getSdwisCache(lat: number, lng: number): SdwisLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;

  const systems: SdwisSystem[] = [];
  const violations: SdwisViolation[] = [];
  const enforcement: SdwisEnforcement[] = [];

  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = _memCache.grid[key];
      if (cell) {
        systems.push(...cell.systems);
        violations.push(...cell.violations);
        enforcement.push(...cell.enforcement);
      }
    }
  }

  if (systems.length === 0 && violations.length === 0 && enforcement.length === 0) {
    return null;
  }

  return {
    systems,
    violations,
    enforcement,
    cacheBuilt: _memCache._meta.built,
    statesProcessed: _memCache._meta.statesProcessed,
    fromCache: true,
  };
}

/**
 * Replace the in-memory cache (called by cron route after fetching fresh data).
 */
export async function setSdwisCache(data: SdwisCacheData): Promise<void> {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  const m = data._meta;
  console.log(
    `[SDWIS Cache] In-memory updated: ${m.systemCount} systems, ${m.violationCount} violations, ` +
    `${m.enforcementCount} enforcement, ${m.gridCells} cells, ${m.statesProcessed.length} states`
  );
  saveToDisk();
  await saveCacheToBlob('cache/sdwis.json', { meta: data._meta, grid: data.grid });
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
export function isSdwisBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[SDWIS Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}
export function setSdwisBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

/**
 * Get all SDWIS data across all grid cells (flat arrays).
 * Used by stateAssessmentBuilder for state-level aggregation.
 */
export function getSdwisAllData(): { systems: SdwisSystem[]; violations: SdwisViolation[]; enforcement: SdwisEnforcement[] } {
  ensureDiskLoaded();
  if (!_memCache) return { systems: [], violations: [], enforcement: [] };
  const systems: SdwisSystem[] = [];
  const violations: SdwisViolation[] = [];
  const enforcement: SdwisEnforcement[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    systems.push(...cell.systems);
    violations.push(...cell.violations);
    enforcement.push(...cell.enforcement);
  }
  return { systems, violations, enforcement };
}

/**
 * Get SDWIS data filtered by state abbreviation (from cache).
 * Returns null if cache is empty or no data for that state.
 */
export function getSdwisForState(stateAbbr: string): { systems: SdwisSystem[]; violations: SdwisViolation[]; enforcement: SdwisEnforcement[]; cacheBuilt: string; fromCache: true } | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const upper = stateAbbr.toUpperCase();
  const all = getSdwisAllData();
  const systems = all.systems.filter(s => s.state === upper);
  // Match violations/enforcement to systems in this state via PWSID prefix
  const statePwsids = new Set(systems.map(s => s.pwsid));
  const violations = all.violations.filter(v => statePwsids.has(v.pwsid));
  const enforcement = all.enforcement.filter(e => statePwsids.has(e.pwsid));
  if (systems.length === 0 && violations.length === 0) return null;
  return { systems, violations, enforcement, cacheBuilt: _memCache._meta.built, fromCache: true };
}

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getSdwisCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    gridCells: _memCache._meta.gridCells,
    systemCount: _memCache._meta.systemCount,
    violationCount: _memCache._meta.violationCount,
    enforcementCount: _memCache._meta.enforcementCount,
    statesProcessed: _memCache._meta.statesProcessed,
  };
}
