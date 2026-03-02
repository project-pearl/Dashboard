/**
 * CO-OPS Derived Products Cache — Server-side spatial cache for NOAA CO-OPS
 * derived products: sea level trends, high tide flooding, and SLR projections.
 *
 * Populated by /api/cron/rebuild-coops-derived (weekly, Sunday).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CoopsDerivedStation {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  seaLevelTrend: number | null;       // mm/year
  seaLevelTrendCI: number | null;     // confidence interval
  htfAnnualDays: number | null;       // high tide flood days last year
  htfAnnualYear: number | null;
  slrProjection2050: number | null;   // meters, intermediate scenario
}

interface GridCell {
  stations: CoopsDerivedStation[];
}

interface CoopsDerivedCacheData {
  _meta: { built: string; stationCount: number; gridCells: number };
  grid: Record<string, GridCell>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: CoopsDerivedCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'coops-derived.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[CO-OPS Derived Cache] Loaded from disk (${data.meta.stationCount} stations, built ${data.meta.built})`);
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
    const file = path.join(dir, 'coops-derived.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[CO-OPS Derived Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/coops-derived.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[CO-OPS Derived Cache] Loaded from blob (${data.meta.stationCount} stations)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getCoopsDerivedCache(lat: number, lng: number): CoopsDerivedStation[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const stations: CoopsDerivedStation[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) stations.push(...cell.stations);
  }
  return stations.length > 0 ? stations : null;
}

export function getCoopsDerivedAll(): CoopsDerivedStation[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: CoopsDerivedStation[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.stations);
  }
  return all;
}

export async function setCoopsDerivedCache(data: CoopsDerivedCacheData): Promise<void> {
  const prevCounts = _memCache ? { stationCount: _memCache._meta.stationCount, gridCells: _memCache._meta.gridCells } : null;
  const newCounts = { stationCount: data._meta.stationCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[CO-OPS Derived Cache] Updated: ${data._meta.stationCount} stations, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/coops-derived.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isCoopsDerivedBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[CO-OPS Derived Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCoopsDerivedBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCoopsDerivedCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    stationCount: _memCache._meta.stationCount,
    gridCells: _memCache._meta.gridCells,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
