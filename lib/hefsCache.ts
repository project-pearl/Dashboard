/**
 * HEFS Cache — Server-side spatial cache for Hydrologic Ensemble Forecast Service data.
 *
 * Populated by /api/cron/rebuild-hefs (every 6 hours).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 * Source: NOAA Water API HEFS ensembles for flooding gauges (from NWPS cache).
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HefsEnsemble {
  lid: string;
  name: string;
  lat: number;
  lng: number;
  state: string;
  quantiles: {
    q10: number | null;
    q25: number | null;
    q50: number | null;
    q75: number | null;
    q90: number | null;
  } | null;
  validTime: string;
  members: number;     // count of ensemble members
}

interface GridCell {
  ensembles: HefsEnsemble[];
}

interface HefsCacheData {
  _meta: { built: string; ensembleCount: number; gridCells: number };
  grid: Record<string, GridCell>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: HefsCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'hefs.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[HEFS Cache] Loaded from disk (${data.meta.ensembleCount} ensembles, built ${data.meta.built})`);
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
    const file = path.join(dir, 'hefs.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[HEFS Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/hefs.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[HEFS Cache] Loaded from blob (${data.meta.ensembleCount} ensembles)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getHefsCache(lat: number, lng: number): HefsEnsemble[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const ensembles: HefsEnsemble[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) ensembles.push(...cell.ensembles);
  }
  return ensembles.length > 0 ? ensembles : null;
}

export function getHefsAll(): HefsEnsemble[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: HefsEnsemble[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.ensembles);
  }
  return all;
}

export async function setHefsCache(data: HefsCacheData): Promise<void> {
  const prevCounts = _memCache ? { ensembleCount: _memCache._meta.ensembleCount, gridCells: _memCache._meta.gridCells } : null;
  const newCounts = { ensembleCount: data._meta.ensembleCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[HEFS Cache] Updated: ${data._meta.ensembleCount} ensembles, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/hefs.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isHefsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[HEFS Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setHefsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getHefsCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    ensembleCount: _memCache._meta.ensembleCount,
    gridCells: _memCache._meta.gridCells,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
