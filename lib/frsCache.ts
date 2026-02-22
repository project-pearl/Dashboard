/**
 * FRS Cache — Server-side spatial cache for EPA Facility Registry Service data.
 *
 * Populated by /api/cron/rebuild-frs (daily cron for 19 priority states).
 * Uses FRS_FACILITY_SITE table for coordinates (LATITUDE83/LONGITUDE83).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface FrsFacility {
  registryId: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  pgmSysId: string;
  postalCode: string;
  county: string;
}

interface GridCell {
  facilities: FrsFacility[];
}

export interface FrsCacheMeta {
  built: string;
  facilityCount: number;
  statesProcessed: string[];
  gridCells: number;
}

interface FrsCacheData {
  _meta: FrsCacheMeta;
  grid: Record<string, GridCell>;
}

export interface FrsLookupResult {
  facilities: FrsFacility[];
  cacheBuilt: string;
  statesProcessed: string[];
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const GRID_RES = 0.1;

let _memCache: FrsCacheData | null = null;

// ── Grid Key ─────────────────────────────────────────────────────────────────

export function gridKey(lat: number, lng: number): string {
  const glat = (Math.floor(lat / GRID_RES) * GRID_RES).toFixed(2);
  const glng = (Math.floor(lng / GRID_RES) * GRID_RES).toFixed(2);
  return `${parseFloat(glat)}_${parseFloat(glng)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up cached FRS data near a lat/lng. Checks target cell + 8 neighbors.
 */
export function getFrsCache(lat: number, lng: number): FrsLookupResult | null {
  if (!_memCache) return null;

  const facilities: FrsFacility[] = [];

  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = _memCache.grid[key];
      if (cell) {
        facilities.push(...cell.facilities);
      }
    }
  }

  if (facilities.length === 0) return null;

  return {
    facilities,
    cacheBuilt: _memCache._meta.built,
    statesProcessed: _memCache._meta.statesProcessed,
    fromCache: true,
  };
}

/**
 * Replace the in-memory cache (called by cron route after fetching fresh data).
 */
export function setFrsCache(data: FrsCacheData): void {
  _memCache = data;
  const m = data._meta;
  console.log(
    `[FRS Cache] In-memory updated: ${m.facilityCount} facilities, ` +
    `${m.gridCells} cells, ${m.statesProcessed.length} states`
  );
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
export function isFrsBuildInProgress(): boolean { return _buildInProgress; }
export function setFrsBuildInProgress(v: boolean): void { _buildInProgress = v; }

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getFrsCacheStatus() {
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: 'memory (cron)',
    built: _memCache._meta.built,
    gridCells: _memCache._meta.gridCells,
    facilityCount: _memCache._meta.facilityCount,
    statesProcessed: _memCache._meta.statesProcessed,
  };
}
