/**
 * ICIS Cache — Server-side spatial cache for EPA ICIS compliance data.
 *
 * Populated by /api/cron/rebuild-icis (daily cron for 19 priority states).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

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

let _memCache: IcisCacheData | null = null;

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
export function setIcisCache(data: IcisCacheData): void {
  _memCache = data;
  const m = data._meta;
  console.log(
    `[ICIS Cache] In-memory updated: ${m.permitCount} permits, ${m.violationCount} violations, ` +
    `${m.dmrCount} DMR, ${m.enforcementCount} enforcement, ${m.inspectionCount} inspections, ` +
    `${m.gridCells} cells, ${m.statesProcessed.length} states`
  );
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
export function isIcisBuildInProgress(): boolean { return _buildInProgress; }
export function setIcisBuildInProgress(v: boolean): void { _buildInProgress = v; }

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getIcisCacheStatus() {
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: 'memory (cron)',
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
