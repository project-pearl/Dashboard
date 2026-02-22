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

let _memCache: EchoCacheData | null = null;

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
  const m = data._meta;
  console.log(
    `[ECHO Cache] In-memory updated: ${m.facilityCount} facilities, ${m.violationCount} violations, ` +
    `${m.gridCells} cells, ${m.statesProcessed.length} states`
  );
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
export function isEchoBuildInProgress(): boolean { return _buildInProgress; }
export function setEchoBuildInProgress(v: boolean): void { _buildInProgress = v; }

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getEchoCacheStatus() {
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: 'memory (cron)',
    built: _memCache._meta.built,
    gridCells: _memCache._meta.gridCells,
    facilityCount: _memCache._meta.facilityCount,
    violationCount: _memCache._meta.violationCount,
    statesProcessed: _memCache._meta.statesProcessed,
  };
}
