/**
 * NEXRAD QPE Cache — Server-side spatial cache for IEM NEXRAD radar
 * Quantitative Precipitation Estimates.
 *
 * Populated by /api/cron/rebuild-nexrad-qpe (periodic).
 * Source: Iowa Environmental Mesonet — NEXRAD radar-derived precipitation
 * accumulations with flash flood risk classification.
 *
 * Grid-based cache: Record<string, NexradQpeCell[]> at 0.1° resolution.
 * Lookup checks target cell + 8 neighbors (3x3 grid).
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NexradQpeCell {
  lat: number;
  lng: number;
  precipMm1h: number;
  precipMm3h: number;
  precipMm24h: number;
  radarSite: string;
  validTime: string;
  flashFloodRisk: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
}

interface NexradQpeCacheMeta {
  built: string;
  cellCount: number;
  maxPrecipMm: number;
  flashFloodHighCount: number;
}

interface NexradQpeCacheData {
  _meta: NexradQpeCacheMeta;
  grid: Record<string, NexradQpeCell[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: NexradQpeCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'nexrad-qpe.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[NEXRAD QPE Cache] Loaded from disk (${data.meta.cellCount} cells, built ${data.meta.built})`);
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
    const file = path.join(dir, 'nexrad-qpe.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[NEXRAD QPE Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/nexrad-qpe.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[NEXRAD QPE Cache] Loaded from blob (${data.meta.cellCount} cells)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getNexradQpeNearby(lat: number, lng: number): NexradQpeCell[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const cells: NexradQpeCell[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) cells.push(...cell);
  }
  return cells;
}

export function getNexradQpeAll(): Record<string, NexradQpeCell[]> {
  ensureDiskLoaded();
  if (!_memCache) return {};
  return _memCache.grid;
}

export async function setNexradQpeCache(data: NexradQpeCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { cellCount: _memCache._meta.cellCount, maxPrecipMm: _memCache._meta.maxPrecipMm, flashFloodHighCount: _memCache._meta.flashFloodHighCount }
    : null;
  const newCounts = { cellCount: data._meta.cellCount, maxPrecipMm: data._meta.maxPrecipMm, flashFloodHighCount: data._meta.flashFloodHighCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[NEXRAD QPE Cache] Updated: ${data._meta.cellCount} cells, ` +
    `max ${data._meta.maxPrecipMm}mm, ${data._meta.flashFloodHighCount} high flood risk`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/nexrad-qpe.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNexradQpeBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NEXRAD QPE Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setNexradQpeBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getNexradQpeCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    cellCount: _memCache._meta.cellCount,
    maxPrecipMm: _memCache._meta.maxPrecipMm,
    flashFloodHighCount: _memCache._meta.flashFloodHighCount,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
