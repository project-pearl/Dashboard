/**
 * ERDDAP Satellite Cache — Server-side spatial cache for CoastWatch ERDDAP
 * satellite-derived water quality data (chlorophyll-a and SST).
 *
 * Populated by /api/cron/rebuild-erddap-sat (daily).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SatellitePixel {
  lat: number;
  lng: number;
  chlorA: number | null;      // µg/L
  sst: number | null;         // °C
  time: string;               // ISO timestamp
}

interface GridCell {
  pixels: SatellitePixel[];
}

interface ErddapSatCacheData {
  _meta: { built: string; pixelCount: number; gridCells: number };
  grid: Record<string, GridCell>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: ErddapSatCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'erddap-sat.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[ERDDAP-Sat Cache] Loaded from disk (${data.meta.pixelCount} pixels, built ${data.meta.built})`);
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
    const file = path.join(dir, 'erddap-sat.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[ERDDAP-Sat Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/erddap-sat.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[ERDDAP-Sat Cache] Loaded from blob (${data.meta.pixelCount} pixels)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getErddapSatCache(lat: number, lng: number): SatellitePixel[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const pixels: SatellitePixel[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) pixels.push(...cell.pixels);
  }
  return pixels.length > 0 ? pixels : null;
}

export function getErddapSatAllPixels(): SatellitePixel[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: SatellitePixel[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.pixels);
  }
  return all;
}

export async function setErddapSatCache(data: ErddapSatCacheData): Promise<void> {
  const prevCounts = _memCache ? { pixelCount: _memCache._meta.pixelCount, gridCells: _memCache._meta.gridCells } : null;
  const newCounts = { pixelCount: data._meta.pixelCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[ERDDAP-Sat Cache] Updated: ${data._meta.pixelCount} pixels, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/erddap-sat.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isErddapSatBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[ERDDAP-Sat Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setErddapSatBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getErddapSatCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    pixelCount: _memCache._meta.pixelCount,
    gridCells: _memCache._meta.gridCells,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
