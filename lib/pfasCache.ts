/**
 * PFAS Cache — Server-side spatial cache for EPA UCMR PFAS screening data.
 *
 * Populated by /api/cron/rebuild-pfas (daily cron).
 * Probes multiple UCMR table names at build time; returns empty cache if
 * none are available (UCMR4_ALL returned 404 as of 2025).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface PfasResult {
  facilityName: string;
  state: string;
  contaminant: string;
  resultValue: number | null;
  detected: boolean;
  sampleDate: string;
  lat: number;
  lng: number;
}

interface GridCell {
  results: PfasResult[];
}

export interface PfasCacheMeta {
  built: string;
  resultCount: number;
  tableName: string | null;  // which UCMR table was found, or null if none
  gridCells: number;
}

interface PfasCacheData {
  _meta: PfasCacheMeta;
  grid: Record<string, GridCell>;
}

export interface PfasLookupResult {
  results: PfasResult[];
  cacheBuilt: string;
  tableName: string | null;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const GRID_RES = 0.1;

let _memCache: PfasCacheData | null = null;

// ── Grid Key ─────────────────────────────────────────────────────────────────

export function gridKey(lat: number, lng: number): string {
  const glat = (Math.floor(lat / GRID_RES) * GRID_RES).toFixed(2);
  const glng = (Math.floor(lng / GRID_RES) * GRID_RES).toFixed(2);
  return `${parseFloat(glat)}_${parseFloat(glng)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up cached PFAS data near a lat/lng. Checks target cell + 8 neighbors.
 */
export function getPfasCache(lat: number, lng: number): PfasLookupResult | null {
  if (!_memCache) return null;

  const results: PfasResult[] = [];

  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = _memCache.grid[key];
      if (cell) {
        results.push(...cell.results);
      }
    }
  }

  if (results.length === 0) return null;

  return {
    results,
    cacheBuilt: _memCache._meta.built,
    tableName: _memCache._meta.tableName,
    fromCache: true,
  };
}

/**
 * Replace the in-memory cache (called by cron route after fetching fresh data).
 */
export function setPfasCache(data: PfasCacheData): void {
  _memCache = data;
  const m = data._meta;
  console.log(
    `[PFAS Cache] In-memory updated: ${m.resultCount} results, ` +
    `${m.gridCells} cells, table=${m.tableName || 'none'}`
  );
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
export function isPfasBuildInProgress(): boolean { return _buildInProgress; }
export function setPfasBuildInProgress(v: boolean): void { _buildInProgress = v; }

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getPfasCacheStatus() {
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: 'memory (cron)',
    built: _memCache._meta.built,
    gridCells: _memCache._meta.gridCells,
    resultCount: _memCache._meta.resultCount,
    tableName: _memCache._meta.tableName,
  };
}
