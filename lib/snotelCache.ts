/**
 * SNOTEL Cache — Server-side spatial cache for NRCS SNOTEL snowpack monitoring stations.
 *
 * Populated by /api/cron/rebuild-snotel (daily at 12 PM UTC).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 * SNOTEL stations are concentrated in western mountain states (~900 stations).
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SnotelStation {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  elevation: number;
  snowWaterEquiv: number | null;
  snowDepth: number | null;
  precip: number | null;
  avgTemp: number | null;
  observedDate: string | null;
}

interface GridCell {
  stations: SnotelStation[];
}

interface SnotelCacheData {
  _meta: { built: string; stationCount: number; gridCells: number };
  grid: Record<string, GridCell>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: SnotelCacheData | null = null;
let _cacheSource: string | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'snotel.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[SNOTEL Cache] Loaded from disk (${data.meta.stationCount} stations, built ${data.meta.built})`);
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
    const file = path.join(dir, 'snotel.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[SNOTEL Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/snotel.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[SNOTEL Cache] Loaded from blob (${data.meta.stationCount} stations)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getSnotelCache(lat: number, lng: number): SnotelStation[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const stations: SnotelStation[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) stations.push(...cell.stations);
  }
  return stations.length > 0 ? stations : null;
}

export function getSnotelAllStations(): SnotelStation[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: SnotelStation[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.stations);
  }
  return all;
}

export async function setSnotelCache(data: SnotelCacheData): Promise<void> {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[SNOTEL Cache] Updated: ${data._meta.stationCount} stations, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/snotel.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isSnotelBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[SNOTEL Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setSnotelBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getSnotelCacheStatus() {
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
