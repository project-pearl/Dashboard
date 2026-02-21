/**
 * CEDEN Cache — Server-side spatial cache for California water quality data.
 *
 * Two data paths:
 * 1. File-based: reads data/ceden-cache.json (built by scripts/ceden_cache.py)
 * 2. In-memory: populated by /api/cron/rebuild-ceden route (works on Vercel)
 *
 * In-memory cache takes priority when available. File cache is the fallback.
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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
const CACHE_PATH = join(process.cwd(), 'data', 'ceden-cache.json');

// In-memory cache (populated by cron route — takes priority)
let _memCache: CedenCacheData | null = null;

// File-based cache (fallback)
let _fileCache: CedenCacheData | null = null;
let _fileLoadAttempted = false;

function loadFileCache(): CedenCacheData | null {
  if (_fileCache) return _fileCache;
  if (_fileLoadAttempted) return null;
  _fileLoadAttempted = true;

  try {
    if (!existsSync(CACHE_PATH)) {
      console.warn(`[CEDEN Cache] File not found: ${CACHE_PATH}`);
      return null;
    }
    const raw = readFileSync(CACHE_PATH, 'utf-8');
    _fileCache = JSON.parse(raw) as CedenCacheData;
    const meta = _fileCache._meta;
    console.log(
      `[CEDEN Cache] File loaded: ${meta.chemistry_records} chem + ${meta.toxicity_records} tox, ` +
      `${Object.keys(_fileCache.grid).length} cells, built ${meta.built}`
    );
    return _fileCache;
  } catch (e) {
    console.warn(`[CEDEN Cache] File load failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

function getCache(): CedenCacheData | null {
  return _memCache || loadFileCache();
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
  const cache = getCache();
  if (!cache) return null;

  const chemistry: ChemRecord[] = [];
  const toxicity: ToxRecord[] = [];

  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = cache.grid[key];
      if (cell) {
        chemistry.push(...cell.chemistry);
        toxicity.push(...cell.toxicity);
      }
    }
  }

  if (chemistry.length === 0 && toxicity.length === 0) return null;

  return { chemistry, toxicity, cacheBuilt: cache._meta.built, fromCache: true };
}

/**
 * Replace the in-memory cache (called by cron route after fetching fresh data).
 */
export function setCedenCache(data: CedenCacheData): void {
  _memCache = data;
  console.log(
    `[CEDEN Cache] In-memory updated: ${data._meta.chemistry_records} chem + ${data._meta.toxicity_records} tox, ` +
    `${Object.keys(data.grid).length} cells`
  );
}

/**
 * Check if a build is in progress.
 */
let _buildInProgress = false;
export function isCedenBuildInProgress(): boolean { return _buildInProgress; }
export function setCedenBuildInProgress(v: boolean): void { _buildInProgress = v; }

/**
 * Get cache metadata (for status/debug endpoints).
 */
export function getCedenCacheStatus() {
  const cache = getCache();
  if (!cache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _memCache ? 'memory (cron)' : 'file (python)',
    built: cache._meta.built,
    gridCells: Object.keys(cache.grid).length,
    chemistryRecords: cache._meta.chemistry_records,
    toxicityRecords: cache._meta.toxicity_records,
    chemistryStations: cache._meta.chemistry_stations,
    toxicityStations: cache._meta.toxicity_stations,
  };
}
