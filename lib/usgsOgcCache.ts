/**
 * USGS OGC Monitoring Locations Cache — Server-side spatial cache for
 * USGS monitoring stations discovered via the OGC SensorThings / WaterServices API.
 *
 * Data source: USGS OGC API (usgsOgcClient.ts) with state-batched fetching.
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UsgsOgcStation {
  id: string;
  name: string;
  state: string;
  county: string;
  huc8: string;
  siteType: string;
  lat: number;
  lng: number;
  agencyCode: string;
  parameters: string[];
  hasRealtimeData: boolean;
  latestObservation: string | null;
}

interface GridCell {
  stations: UsgsOgcStation[];
}

interface UsgsOgcCacheMeta {
  built: string;
  stationCount: number;
  statesCovered: number;
  gridCells: number;
}

interface UsgsOgcCacheData {
  _meta: UsgsOgcCacheMeta;
  grid: Record<string, GridCell>;
  stateIndex: Record<string, UsgsOgcStation[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: UsgsOgcCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'usgs-ogc.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid, stateIndex: data.stateIndex || {} };
    _cacheSource = 'disk';
    console.log(`[USGS OGC Cache] Loaded from disk (${data.meta.stationCount} stations, built ${data.meta.built})`);
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
    const file = path.join(dir, 'usgs-ogc.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: _memCache._meta,
      grid: _memCache.grid,
      stateIndex: _memCache.stateIndex,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[USGS OGC Cache] Saved to disk (${(Buffer.byteLength(payload) / 1024).toFixed(1)} KB)`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any; stateIndex: any }>('cache/usgs-ogc.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid, stateIndex: data.stateIndex || {} };
    _cacheSource = 'blob';
    console.warn(`[USGS OGC Cache] Loaded from blob (${data.meta.stationCount} stations)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getUsgsOgcCache(lat: number, lng: number): UsgsOgcStation[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const stations: UsgsOgcStation[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) stations.push(...cell.stations);
  }
  return stations.length > 0 ? stations : null;
}

export function getUsgsOgcAllStations(): UsgsOgcStation[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: UsgsOgcStation[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.stations);
  }
  return all;
}

export function getUsgsOgcByState(state: string): UsgsOgcStation[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const upper = state.toUpperCase();
  return _memCache.stateIndex[upper] || [];
}

// ── Setter ───────────────────────────────────────────────────────────────────

export async function setUsgsOgcCache(data: UsgsOgcCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { stationCount: _memCache._meta.stationCount, gridCells: _memCache._meta.gridCells }
    : null;
  const newCounts = { stationCount: data._meta.stationCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[USGS OGC Cache] Updated: ${data._meta.stationCount} stations, ` +
    `${data._meta.gridCells} cells, ${data._meta.statesCovered} states`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/usgs-ogc.json', {
    meta: data._meta,
    grid: data.grid,
    stateIndex: data.stateIndex,
  });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isUsgsOgcBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[USGS OGC Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setUsgsOgcBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getUsgsOgcCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    stationCount: _memCache._meta.stationCount,
    statesCovered: _memCache._meta.statesCovered,
    gridCells: _memCache._meta.gridCells,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
