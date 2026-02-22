/**
 * SDWIS Cache — Server-side spatial cache for EPA Safe Drinking Water
 * Information System data.
 *
 * Populated by /api/cron/rebuild-sdwis (daily cron for 19 priority states).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

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

let _memCache: SdwisCacheData | null = null;

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
export function setSdwisCache(data: SdwisCacheData): void {
  _memCache = data;
  const m = data._meta;
  console.log(
    `[SDWIS Cache] In-memory updated: ${m.systemCount} systems, ${m.violationCount} violations, ` +
    `${m.enforcementCount} enforcement, ${m.gridCells} cells, ${m.statesProcessed.length} states`
  );
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
export function isSdwisBuildInProgress(): boolean { return _buildInProgress; }
export function setSdwisBuildInProgress(v: boolean): void { _buildInProgress = v; }

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getSdwisCacheStatus() {
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: 'memory (cron)',
    built: _memCache._meta.built,
    gridCells: _memCache._meta.gridCells,
    systemCount: _memCache._meta.systemCount,
    violationCount: _memCache._meta.violationCount,
    enforcementCount: _memCache._meta.enforcementCount,
    statesProcessed: _memCache._meta.statesProcessed,
  };
}
