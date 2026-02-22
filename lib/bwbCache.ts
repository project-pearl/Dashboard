/**
 * BWB Cache — Server-side spatial cache for Blue Water Baltimore / Water Reporter data.
 *
 * Populated by /api/cron/rebuild-bwb (daily cron).
 * Pulls stations + latest parameter readings from api.waterreporter.org and
 * stores in a spatial grid so the dashboard has data even when the API is down.
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface BwbParameter {
  name: string;
  normalizedName: string;
  unit: string;
  latestValue: number | null;
  latestDate: string | null;
}

export interface BwbStation {
  stationId: number;
  datasetId: number;
  name: string;
  lat: number;
  lng: number;
  isActive: boolean;
  lastSampled: string;
  parameters: BwbParameter[];
}

interface GridCell {
  stations: BwbStation[];
}

export interface BwbCacheMeta {
  built: string;
  stationCount: number;
  parameterReadings: number;
  datasetsScanned: number;
  gridCells: number;
}

interface BwbCacheData {
  _meta: BwbCacheMeta;
  grid: Record<string, GridCell>;
}

export interface BwbLookupResult {
  stations: BwbStation[];
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const GRID_RES = 0.1;

let _memCache: BwbCacheData | null = null;

// ── Grid Key ─────────────────────────────────────────────────────────────────

export function gridKey(lat: number, lng: number): string {
  const glat = (Math.floor(lat / GRID_RES) * GRID_RES).toFixed(2);
  const glng = (Math.floor(lng / GRID_RES) * GRID_RES).toFixed(2);
  return `${parseFloat(glat)}_${parseFloat(glng)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up cached BWB data near a lat/lng. Checks target cell + 8 neighbors.
 */
export function getBwbCache(lat: number, lng: number): BwbLookupResult | null {
  if (!_memCache) return null;

  const stations: BwbStation[] = [];

  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = _memCache.grid[key];
      if (cell) {
        stations.push(...cell.stations);
      }
    }
  }

  if (stations.length === 0) return null;

  return {
    stations,
    cacheBuilt: _memCache._meta.built,
    fromCache: true,
  };
}

/**
 * Replace the in-memory cache (called by cron route after fetching fresh data).
 */
export function setBwbCache(data: BwbCacheData): void {
  _memCache = data;
  const m = data._meta;
  console.log(
    `[BWB Cache] In-memory updated: ${m.stationCount} stations, ${m.parameterReadings} readings, ` +
    `${m.datasetsScanned} datasets, ${m.gridCells} cells`
  );
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
export function isBwbBuildInProgress(): boolean { return _buildInProgress; }
export function setBwbBuildInProgress(v: boolean): void { _buildInProgress = v; }

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getBwbCacheStatus() {
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: 'memory (cron)',
    built: _memCache._meta.built,
    gridCells: _memCache._meta.gridCells,
    stationCount: _memCache._meta.stationCount,
    parameterReadings: _memCache._meta.parameterReadings,
    datasetsScanned: _memCache._meta.datasetsScanned,
  };
}
