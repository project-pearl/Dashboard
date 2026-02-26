/**
 * CO-OPS Cache — Server-side spatial cache for NOAA Center for Operational
 * Oceanographic Products and Services tidal/coastal station data.
 *
 * Populated by /api/cron/rebuild-coops (every 6 hours).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CoopsStation {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  waterLevel: number | null;
  waterLevelTime: string | null;
  airTemp: number | null;
  waterTemp: number | null;
  windSpeed: number | null;
  windDir: string | null;
}

interface GridCell {
  stations: CoopsStation[];
}

interface CoopsCacheData {
  _meta: { built: string; stationCount: number; gridCells: number };
  grid: Record<string, GridCell>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: CoopsCacheData | null = null;
let _cacheSource: string | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'coops.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[CO-OPS Cache] Loaded from disk (${data.meta.stationCount} stations, built ${data.meta.built})`);
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
    const file = path.join(dir, 'coops.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[CO-OPS Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/coops.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[CO-OPS Cache] Loaded from blob (${data.meta.stationCount} stations)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getCoopsCache(lat: number, lng: number): CoopsStation[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const stations: CoopsStation[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) stations.push(...cell.stations);
  }
  return stations.length > 0 ? stations : null;
}

export function getCoopsAllStations(): CoopsStation[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: CoopsStation[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.stations);
  }
  return all;
}

export async function setCoopsCache(data: CoopsCacheData): Promise<void> {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[CO-OPS Cache] Updated: ${data._meta.stationCount} stations, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/coops.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isCoopsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[CO-OPS Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCoopsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCoopsCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    stationCount: _memCache._meta.stationCount,
    gridCells: _memCache._meta.gridCells,
  };
}

export { gridKey };
