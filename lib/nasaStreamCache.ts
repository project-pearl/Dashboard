/**
 * NASA Stream Cache — Server-side spatial cache for NASA satellite water
 * quality data via PFEG CoastWatch ERDDAP (MODIS Aqua chlorophyll-a and SST).
 *
 * Populated by /api/cron/rebuild-nasa-stream (weekly Sunday).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NasaSatObs {
  lat: number;
  lng: number;
  modisChlorA: number | null;   // µg/L (monthly composite)
  modisSst: number | null;       // °C (8-day composite)
  time: string;
}

interface GridCell {
  observations: NasaSatObs[];
}

interface NasaStreamCacheData {
  _meta: { built: string; obsCount: number; gridCells: number };
  grid: Record<string, GridCell>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: NasaStreamCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'nasa-stream.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[NASA-Stream Cache] Loaded from disk (${data.meta.obsCount} obs, built ${data.meta.built})`);
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
    const file = path.join(dir, 'nasa-stream.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[NASA-Stream Cache] Saved to disk`);
  } catch {
    // fail silently
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/nasa-stream.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[NASA-Stream Cache] Loaded from blob (${data.meta.obsCount} obs)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getNasaStreamCache(lat: number, lng: number): NasaSatObs[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const observations: NasaSatObs[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) observations.push(...cell.observations);
  }
  return observations.length > 0 ? observations : null;
}

export function getNasaStreamAllObs(): NasaSatObs[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: NasaSatObs[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.observations);
  }
  return all;
}

export async function setNasaStreamCache(data: NasaStreamCacheData): Promise<void> {
  const prevCounts = _memCache ? { obsCount: _memCache._meta.obsCount, gridCells: _memCache._meta.gridCells } : null;
  const newCounts = { obsCount: data._meta.obsCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[NASA-Stream Cache] Updated: ${data._meta.obsCount} obs, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/nasa-stream.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNasaStreamBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NASA-Stream Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setNasaStreamBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getNasaStreamCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    obsCount: _memCache._meta.obsCount,
    gridCells: _memCache._meta.gridCells,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
