/**
 * HABSOS Cache — Server-side spatial cache for Harmful Algal Bloom observations.
 *
 * Populated by /api/cron/rebuild-habsos (daily).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 * Source: HABSOS ArcGIS REST service (last 30 days of HAB cell counts).
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HabObservation {
  lat: number;
  lng: number;
  state: string;
  genus: string;
  cellCount: number;
  sampleDate: string;
  description: string;
}

interface GridCell {
  observations: HabObservation[];
}

interface HabsosCacheData {
  _meta: { built: string; observationCount: number; gridCells: number };
  grid: Record<string, GridCell>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: HabsosCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'habsos.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[HABSOS Cache] Loaded from disk (${data.meta.observationCount} observations, built ${data.meta.built})`);
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
    const file = path.join(dir, 'habsos.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[HABSOS Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/habsos.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[HABSOS Cache] Loaded from blob (${data.meta.observationCount} observations)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getHabsosCache(lat: number, lng: number): HabObservation[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const observations: HabObservation[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) observations.push(...cell.observations);
  }
  return observations.length > 0 ? observations : null;
}

export function getHabsosAll(): HabObservation[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: HabObservation[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.observations);
  }
  return all;
}

export async function setHabsosCache(data: HabsosCacheData): Promise<void> {
  const prevCounts = _memCache ? { observationCount: _memCache._meta.observationCount, gridCells: _memCache._meta.gridCells } : null;
  const newCounts = { observationCount: data._meta.observationCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[HABSOS Cache] Updated: ${data._meta.observationCount} observations, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/habsos.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isHabsosBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[HABSOS Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setHabsosBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getHabsosCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    observationCount: _memCache._meta.observationCount,
    gridCells: _memCache._meta.gridCells,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
