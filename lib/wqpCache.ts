/**
 * WQP Cache — Server-side spatial cache for national WQP water quality data.
 *
 * Populated by /api/cron/rebuild-wqp (daily cron for 19 priority states).
 * Non-priority states fall through to live WQP API calls.
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
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

let _memCache: WqpCacheData | null = null;

// ── Grid Key ─────────────────────────────────────────────────────────────────

export function gridKey(lat: number, lng: number): string {
  const glat = (Math.floor(lat / GRID_RES) * GRID_RES).toFixed(2);
  const glng = (Math.floor(lng / GRID_RES) * GRID_RES).toFixed(2);
  return `${parseFloat(glat)}_${parseFloat(glng)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up cached WQP data near a lat/lng. Checks target cell + 8 neighbors.
 */
export function getWqpCache(lat: number, lng: number): WqpLookupResult | null {
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
 */
export function setWqpCache(data: WqpCacheData): void {
  _memCache = data;
  console.log(
    `[WQP Cache] In-memory updated: ${data._meta.totalRecords} records, ` +
    `${Object.keys(data.grid).length} cells, ${data._meta.statesProcessed.length} states`
  );
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
export function isWqpBuildInProgress(): boolean { return _buildInProgress; }
export function setWqpBuildInProgress(v: boolean): void { _buildInProgress = v; }

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getWqpCacheStatus() {
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: 'memory (cron)',
    built: _memCache._meta.built,
    gridCells: Object.keys(_memCache.grid).length,
    totalRecords: _memCache._meta.totalRecords,
    statesProcessed: _memCache._meta.statesProcessed,
  };
}
