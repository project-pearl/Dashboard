/**
 * CEDEN Cache — Server-side spatial cache for California water quality data.
 *
 * Populated by /api/cron/rebuild-ceden route.
 * Persists to disk so cache survives Vercel cold starts.
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChemRecord {
  stn: string;
  name: string;
  date: string | null;
  key: string;       // PEARL key (DO, pH, temperature, bacteria, etc.)
  analyte: string;   // Original CEDEN analyte name
  val: number | null;
  unit: string;
  lat: number;
  lng: number;
  agency: string;
}

export interface ToxRecord {
  stn: string;
  name: string;
  date: string | null;
  organism: string;
  analyte: string;
  val: number | null;
  mean: number | null;
  unit: string;
  sig: string;       // SigEffectCode
  lat: number;
  lng: number;
}

interface GridCell {
  chemistry: ChemRecord[];
  toxicity: ToxRecord[];
}

export interface CedenCacheMeta {
  built: string;
  chemistry_records: number;
  toxicity_records: number;
  grid_resolution: number;
  chemistry_stations: number;
  toxicity_stations: number;
}

interface CedenCacheData {
  _meta: CedenCacheMeta;
  grid: Record<string, GridCell>;
}

export interface CedenLookupResult {
  chemistry: ChemRecord[];
  toxicity: ToxRecord[];
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const GRID_RES = 0.1;
const CACHE_TTL_MS = 48 * 60 * 60 * 1000;

let _memCache: CedenCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'ceden-data.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;

    _memCache = {
      _meta: {
        built: data.meta.built,
        chemistry_records: data.meta.chemistry_records || 0,
        toxicity_records: data.meta.toxicity_records || 0,
        grid_resolution: data.meta.grid_resolution || GRID_RES,
        chemistry_stations: data.meta.chemistry_stations || 0,
        toxicity_stations: data.meta.toxicity_stations || 0,
      },
      grid: data.grid,
    };
    _cacheSource = 'disk';

    console.log(
      `[CEDEN Cache] Loaded from disk (${_memCache._meta.chemistry_records} chem + ` +
      `${_memCache._meta.toxicity_records} tox, ${Object.keys(_memCache.grid).length} cells, ` +
      `built ${data.meta.built || 'unknown'})`
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
    const file = path.join(dir, 'ceden-data.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: {
        built: _memCache._meta.built,
        chemistry_records: _memCache._meta.chemistry_records,
        toxicity_records: _memCache._meta.toxicity_records,
        grid_resolution: _memCache._meta.grid_resolution,
        chemistry_stations: _memCache._meta.chemistry_stations,
        toxicity_stations: _memCache._meta.toxicity_stations,
      },
      grid: _memCache.grid,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[CEDEN Cache] Saved to disk (${sizeMB}MB)`);
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

// ── Grid Key ─────────────────────────────────────────────────────────────────

export function gridKey(lat: number, lng: number): string {
  const glat = (Math.floor(lat / GRID_RES) * GRID_RES).toFixed(2);
  const glng = (Math.floor(lng / GRID_RES) * GRID_RES).toFixed(2);
  return `${parseFloat(glat)}_${parseFloat(glng)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up cached CEDEN data near a lat/lng. Checks target cell + 8 neighbors.
 */
export function getCedenCache(lat: number, lng: number): CedenLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;

  const chemistry: ChemRecord[] = [];
  const toxicity: ToxRecord[] = [];

  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = _memCache.grid[key];
      if (cell) {
        chemistry.push(...cell.chemistry);
        toxicity.push(...cell.toxicity);
      }
    }
  }

  if (chemistry.length === 0 && toxicity.length === 0) return null;

  return { chemistry, toxicity, cacheBuilt: _memCache._meta.built, fromCache: true };
}

/**
 * Replace the in-memory cache (called by cron route after fetching fresh data).
 */
export function setCedenCache(data: CedenCacheData): void {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[CEDEN Cache] In-memory updated: ${data._meta.chemistry_records} chem + ${data._meta.toxicity_records} tox, ` +
    `${Object.keys(data.grid).length} cells`
  );
  saveToDisk();
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
export function isCedenBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[CEDEN Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}
export function setCedenBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getCedenCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    gridCells: Object.keys(_memCache.grid).length,
    chemistryRecords: _memCache._meta.chemistry_records,
    toxicityRecords: _memCache._meta.toxicity_records,
    chemistryStations: _memCache._meta.chemistry_stations,
    toxicityStations: _memCache._meta.toxicity_stations,
  };
}
