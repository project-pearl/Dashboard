/**
 * NWIS Groundwater Cache — Server-side spatial cache for USGS groundwater
 * level data (gwlevels, IV-GW, DV-GW).
 *
 * Populated by /api/cron/rebuild-nwis-gw (daily cron for 19 priority states).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface NwisGwSite {
  siteNumber: string;       // USGS site ID (e.g. "392105077123401")
  siteName: string;         // Human-readable name
  aquiferCode: string;      // National aquifer code if available
  wellDepth: number | null; // Depth in feet
  state: string;            // State abbreviation
  county: string;           // County name or FIPS
  huc: string;              // HUC-8 watershed code
  lat: number;
  lng: number;
}

export interface NwisGwLevel {
  siteNumber: string;
  dateTime: string;         // ISO measurement timestamp
  value: number;            // Level measurement
  unit: string;             // "ft" typically
  parameterCd: string;      // 72019, 62610, or 62611
  parameterName: string;    // Human-readable
  qualifier: string;        // A=approved, P=provisional, e=estimated
  isRealtime: boolean;      // true if from IV, false if gwlevels/DV
  lat: number;
  lng: number;
}

export interface NwisGwTrend {
  siteNumber: string;
  siteName: string;
  latestLevel: number;
  latestDate: string;
  avgLevel30d: number | null;
  avgLevel90d: number | null;
  trend: 'rising' | 'falling' | 'stable' | 'unknown';
  trendMagnitude: number;   // ft/month rate of change
  lat: number;
  lng: number;
}

interface GridCell {
  sites: NwisGwSite[];
  levels: NwisGwLevel[];
  trends: NwisGwTrend[];
}

export interface NwisGwCacheMeta {
  built: string;
  siteCount: number;
  levelCount: number;
  trendCount: number;
  statesProcessed: string[];
  gridCells: number;
}

interface NwisGwCacheData {
  _meta: NwisGwCacheMeta;
  grid: Record<string, GridCell>;
}

export interface NwisGwLookupResult {
  sites: NwisGwSite[];
  levels: NwisGwLevel[];
  trends: NwisGwTrend[];
  cacheBuilt: string;
  statesProcessed: string[];
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const GRID_RES = 0.1;

let _memCache: NwisGwCacheData | null = null;

// ── Grid Key ─────────────────────────────────────────────────────────────────

export function gridKey(lat: number, lng: number): string {
  const glat = (Math.floor(lat / GRID_RES) * GRID_RES).toFixed(2);
  const glng = (Math.floor(lng / GRID_RES) * GRID_RES).toFixed(2);
  return `${parseFloat(glat)}_${parseFloat(glng)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up cached NWIS groundwater data near a lat/lng. Checks target cell + 8 neighbors.
 */
export function getNwisGwCache(lat: number, lng: number): NwisGwLookupResult | null {
  if (!_memCache) return null;

  const sites: NwisGwSite[] = [];
  const levels: NwisGwLevel[] = [];
  const trends: NwisGwTrend[] = [];

  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = _memCache.grid[key];
      if (cell) {
        sites.push(...cell.sites);
        levels.push(...cell.levels);
        trends.push(...cell.trends);
      }
    }
  }

  if (sites.length === 0 && levels.length === 0 && trends.length === 0) {
    return null;
  }

  return {
    sites,
    levels,
    trends,
    cacheBuilt: _memCache._meta.built,
    statesProcessed: _memCache._meta.statesProcessed,
    fromCache: true,
  };
}

/**
 * Replace the in-memory cache (called by cron route after fetching fresh data).
 */
export function setNwisGwCache(data: NwisGwCacheData): void {
  _memCache = data;
  const m = data._meta;
  console.log(
    `[NWIS-GW Cache] In-memory updated: ${m.siteCount} sites, ${m.levelCount} levels, ` +
    `${m.trendCount} trends, ${m.gridCells} cells, ${m.statesProcessed.length} states`
  );
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
export function isNwisGwBuildInProgress(): boolean { return _buildInProgress; }
export function setNwisGwBuildInProgress(v: boolean): void { _buildInProgress = v; }

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getNwisGwCacheStatus() {
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: 'memory (cron)',
    built: _memCache._meta.built,
    gridCells: _memCache._meta.gridCells,
    siteCount: _memCache._meta.siteCount,
    levelCount: _memCache._meta.levelCount,
    trendCount: _memCache._meta.trendCount,
    statesProcessed: _memCache._meta.statesProcessed,
  };
}
