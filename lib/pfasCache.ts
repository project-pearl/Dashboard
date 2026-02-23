/**
 * PFAS Cache — Server-side spatial cache for EPA UCMR PFAS screening data.
 *
 * Populated by /api/cron/rebuild-pfas (daily cron).
 * Probes multiple UCMR table names at build time; returns empty cache if
 * none are available (UCMR4_ALL returned 404 as of 2025).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

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
const CACHE_TTL_MS = 48 * 60 * 60 * 1000;

let _memCache: PfasCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'pfas-data.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;

    _memCache = {
      _meta: {
        built: data.meta.built,
        resultCount: data.meta.resultCount || 0,
        tableName: data.meta.tableName || null,
        gridCells: data.meta.gridCells || Object.keys(data.grid).length,
      },
      grid: data.grid,
    };
    _cacheSource = 'disk';

    console.log(
      `[PFAS Cache] Loaded from disk (${_memCache._meta.resultCount} results, ` +
      `table=${_memCache._meta.tableName || 'none'}, built ${data.meta.built || 'unknown'})`
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
    const file = path.join(dir, 'pfas-data.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: {
        built: _memCache._meta.built,
        resultCount: _memCache._meta.resultCount,
        tableName: _memCache._meta.tableName,
        gridCells: Object.keys(_memCache.grid).length,
      },
      grid: _memCache.grid,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[PFAS Cache] Saved to disk (${sizeMB}MB)`);
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
  const data = await loadCacheFromBlob<{meta: any; grid: any}>('cache/pfas.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.warn(`[PFAS Cache] Loaded from blob (${data.meta.resultCount} results)`);
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
 * Look up cached PFAS data near a lat/lng. Checks target cell + 8 neighbors.
 */
export function getPfasCache(lat: number, lng: number): PfasLookupResult | null {
  ensureDiskLoaded();
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
export async function setPfasCache(data: PfasCacheData): Promise<void> {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  const m = data._meta;
  console.log(
    `[PFAS Cache] In-memory updated: ${m.resultCount} results, ` +
    `${m.gridCells} cells, table=${m.tableName || 'none'}`
  );
  saveToDisk();
  await saveCacheToBlob('cache/pfas.json', { meta: data._meta, grid: data.grid });
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
export function isPfasBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[PFAS Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}
export function setPfasBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getPfasCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    gridCells: _memCache._meta.gridCells,
    resultCount: _memCache._meta.resultCount,
    tableName: _memCache._meta.tableName,
  };
}
