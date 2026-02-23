/**
 * ICIS Cache — Server-side spatial cache for EPA ICIS compliance data.
 *
 * Populated by /api/cron/rebuild-icis (daily cron for 19 priority states).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface IcisPermit {
  permit: string;          // NPDES permit number
  facility: string;        // Facility name
  state: string;           // State abbreviation
  status: string;          // Permit status (e.g. Effective, Expired)
  type: string;            // Permit type (e.g. Individual, General)
  expiration: string;      // Expiration date
  flow: number | null;     // Design flow (MGD)
  lat: number;
  lng: number;
}

export interface IcisViolation {
  permit: string;
  code: string;            // Violation code
  desc: string;            // Violation description
  date: string;            // Violation date
  rnc: boolean;            // Reportable Noncompliance flag
  severity: string;        // Severity level
  lat: number;
  lng: number;
}

export interface IcisDmr {
  permit: string;
  paramDesc: string;       // Parameter description
  pearlKey: string;        // Mapped PEARL key
  dmrValue: number | null; // Actual DMR measurement
  limitValue: number | null; // Permit limit
  unit: string;
  exceedance: boolean;     // Whether DMR exceeds limit
  period: string;          // Monitoring period end date
  lat: number;
  lng: number;
}

export interface IcisEnforcement {
  permit: string;
  caseNumber: string;
  actionType: string;
  penaltyAssessed: number;
  penaltyCollected: number;
  settlementDate: string;
  lat: number;
  lng: number;
}

export interface IcisInspection {
  permit: string;
  type: string;
  date: string;
  complianceStatus: string;
  leadAgency: string;
  lat: number;
  lng: number;
}

interface GridCell {
  permits: IcisPermit[];
  violations: IcisViolation[];
  dmr: IcisDmr[];
  enforcement: IcisEnforcement[];
  inspections: IcisInspection[];
}

export interface IcisCacheMeta {
  built: string;
  permitCount: number;
  violationCount: number;
  dmrCount: number;
  enforcementCount: number;
  inspectionCount: number;
  statesProcessed: string[];
  gridCells: number;
}

interface IcisCacheData {
  _meta: IcisCacheMeta;
  grid: Record<string, GridCell>;
}

export interface IcisLookupResult {
  permits: IcisPermit[];
  violations: IcisViolation[];
  dmr: IcisDmr[];
  enforcement: IcisEnforcement[];
  inspections: IcisInspection[];
  cacheBuilt: string;
  statesProcessed: string[];
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const GRID_RES = 0.1;
const CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours — buffer past daily cron

let _memCache: IcisCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'icis-priority-states.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;

    _memCache = {
      _meta: {
        built: data.meta.built,
        permitCount: data.meta.permitCount || 0,
        violationCount: data.meta.violationCount || 0,
        dmrCount: data.meta.dmrCount || 0,
        enforcementCount: data.meta.enforcementCount || 0,
        inspectionCount: data.meta.inspectionCount || 0,
        statesProcessed: data.meta.statesProcessed || [],
        gridCells: data.meta.gridCells || Object.keys(data.grid).length,
      },
      grid: data.grid,
    };
    _cacheSource = 'disk';

    console.log(
      `[ICIS Cache] Loaded from disk (${_memCache._meta.permitCount} permits, ` +
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
    const file = path.join(dir, 'icis-priority-states.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: {
        built: _memCache._meta.built,
        permitCount: _memCache._meta.permitCount,
        violationCount: _memCache._meta.violationCount,
        dmrCount: _memCache._meta.dmrCount,
        enforcementCount: _memCache._meta.enforcementCount,
        inspectionCount: _memCache._meta.inspectionCount,
        statesProcessed: _memCache._meta.statesProcessed,
        gridCells: Object.keys(_memCache.grid).length,
      },
      grid: _memCache.grid,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[ICIS Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.statesProcessed.length} states)`);
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
  const data = await loadCacheFromBlob<{meta: any; grid: any}>('cache/icis.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.warn(`[ICIS Cache] Loaded from blob (${data.meta.permitCount} permits)`);
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
 * Look up cached ICIS data near a lat/lng. Checks target cell + 8 neighbors.
 */
export function getIcisCache(lat: number, lng: number): IcisLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;

  const permits: IcisPermit[] = [];
  const violations: IcisViolation[] = [];
  const dmr: IcisDmr[] = [];
  const enforcement: IcisEnforcement[] = [];
  const inspections: IcisInspection[] = [];

  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = _memCache.grid[key];
      if (cell) {
        permits.push(...cell.permits);
        violations.push(...cell.violations);
        dmr.push(...cell.dmr);
        enforcement.push(...cell.enforcement);
        inspections.push(...cell.inspections);
      }
    }
  }

  if (permits.length === 0 && violations.length === 0 && dmr.length === 0 &&
      enforcement.length === 0 && inspections.length === 0) {
    return null;
  }

  return {
    permits,
    violations,
    dmr,
    enforcement,
    inspections,
    cacheBuilt: _memCache._meta.built,
    statesProcessed: _memCache._meta.statesProcessed,
    fromCache: true,
  };
}

/**
 * Replace the in-memory cache (called by cron route after fetching fresh data).
 */
export async function setIcisCache(data: IcisCacheData): Promise<void> {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  const m = data._meta;
  console.log(
    `[ICIS Cache] In-memory updated: ${m.permitCount} permits, ${m.violationCount} violations, ` +
    `${m.dmrCount} DMR, ${m.enforcementCount} enforcement, ${m.inspectionCount} inspections, ` +
    `${m.gridCells} cells, ${m.statesProcessed.length} states`
  );
  saveToDisk();
  await saveCacheToBlob('cache/icis.json', { meta: data._meta, grid: data.grid });
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 min — auto-clear stale locks
export function isIcisBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[ICIS Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}
export function setIcisBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getIcisCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    gridCells: _memCache._meta.gridCells,
    permitCount: _memCache._meta.permitCount,
    violationCount: _memCache._meta.violationCount,
    dmrCount: _memCache._meta.dmrCount,
    enforcementCount: _memCache._meta.enforcementCount,
    inspectionCount: _memCache._meta.inspectionCount,
    statesProcessed: _memCache._meta.statesProcessed,
  };
}
