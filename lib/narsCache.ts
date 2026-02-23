/**
 * NARS Cache — Server-side spatial cache for EPA National Aquatic Resource Surveys.
 *
 * Populated by /api/cron/rebuild-nars (weekly cron — data updates infrequently).
 * Downloads CSV files from EPA for NLA (lakes), NRSA (rivers/streams), NWCA (wetlands),
 * NCCA (coastal). Sites have lat/lon for grid-based spatial indexing.
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NarsSite {
  siteId: string;
  uniqueId: string;
  name: string;
  survey: 'NLA' | 'NRSA' | 'NWCA' | 'NCCA';
  surveyYear: string;
  lat: number;
  lng: number;
  state: string;
  county: string;
  ecoregion: string;
  huc8: string;
  visitDate: string;
  // Key water quality indicators (from water chemistry join)
  chla: number | null;        // Chlorophyll-a (µg/L)
  ph: number | null;
  turbidity: number | null;   // NTU
  dissolvedO2: number | null; // mg/L
  conductivity: number | null; // µS/cm
  nitrogen: number | null;     // mg/L (total N)
  phosphorus: number | null;   // mg/L (total P)
}

interface GridCell {
  sites: NarsSite[];
}

export interface NarsCacheMeta {
  built: string;
  siteCount: number;
  surveys: Record<string, number>;
  statesWithData: number;
  gridCells: number;
}

interface NarsCacheData {
  _meta: NarsCacheMeta;
  grid: Record<string, GridCell>;
}

export interface NarsLookupResult {
  sites: NarsSite[];
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const GRID_RES = 0.1;

let _memCache: NarsCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'nars-surveys.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[NARS Cache] Loaded from disk (${data.meta.siteCount} sites)`);
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
    const file = path.join(dir, 'nars-surveys.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[NARS Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.siteCount} sites)`);
  } catch {}
}

let _diskLoaded = false;
function ensureDiskLoaded() {
  if (!_diskLoaded) { _diskLoaded = true; loadFromDisk(); }
}

let _blobChecked = false;
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_memCache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/nars.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.warn(`[NARS Cache] Loaded from blob (${data.meta.siteCount} sites)`);
  }
}

// ── Grid Key ─────────────────────────────────────────────────────────────────

export function gridKey(lat: number, lng: number): string {
  const glat = (Math.floor(lat / GRID_RES) * GRID_RES).toFixed(2);
  const glng = (Math.floor(lng / GRID_RES) * GRID_RES).toFixed(2);
  return `${parseFloat(glat)}_${parseFloat(glng)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getNarsCache(lat: number, lng: number): NarsLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;

  const sites: NarsSite[] = [];
  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      const key = gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES);
      const cell = _memCache.grid[key];
      if (cell) sites.push(...cell.sites);
    }
  }
  if (sites.length === 0) return null;
  return { sites, cacheBuilt: _memCache._meta.built, fromCache: true };
}

export async function setNarsCache(data: NarsCacheData): Promise<void> {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[NARS Cache] Updated: ${data._meta.siteCount} sites, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/nars.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNarsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}
export function setNarsBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getNarsCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    siteCount: _memCache._meta.siteCount,
    surveys: _memCache._meta.surveys,
    statesWithData: _memCache._meta.statesWithData,
    gridCells: _memCache._meta.gridCells,
  };
}
