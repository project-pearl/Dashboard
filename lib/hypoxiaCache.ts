/**
 * Hypoxia Cache — Server-side spatial cache for NOAA/Chesapeake Bay Program
 * dissolved oxygen and hypoxia monitoring data.
 *
 * Populated by /api/cron/rebuild-hypoxia (weekly).
 * Source: NOAA and Chesapeake Bay Program — dissolved oxygen monitoring,
 * hypoxic/dead zone delineation, and water quality sampling.
 *
 * Grid-based cache: Record<string, HypoxiaReading[]> at 0.1° resolution.
 * Lookup checks target cell + 8 neighbors (3x3 grid).
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HypoxiaReading {
  stationId: string;
  stationName: string;
  waterbody: string;
  lat: number;
  lng: number;
  state: string;
  dissolvedOxygen: number | null;
  salinity: number | null;
  temperature: number | null;
  depth: number | null;
  hypoxicZone: boolean;
  deadZoneAreaSqKm: number | null;
  sampleDate: string;
  source: string;
}

interface HypoxiaCacheMeta {
  built: string;
  readingCount: number;
  stationCount: number;
  hypoxicZoneCount: number;
}

interface HypoxiaCacheData {
  _meta: HypoxiaCacheMeta;
  grid: Record<string, HypoxiaReading[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: HypoxiaCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'hypoxia.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[Hypoxia Cache] Loaded from disk (${data.meta.readingCount} readings, built ${data.meta.built})`);
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
    const file = path.join(dir, 'hypoxia.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[Hypoxia Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/hypoxia.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[Hypoxia Cache] Loaded from blob (${data.meta.readingCount} readings)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getHypoxiaNearby(lat: number, lng: number): HypoxiaReading[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const readings: HypoxiaReading[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) readings.push(...cell);
  }
  return readings;
}

export function getHypoxiaByState(state: string): HypoxiaReading[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const upper = state.toUpperCase();
  const all: HypoxiaReading[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    for (const reading of cell) {
      if (reading.state === upper) all.push(reading);
    }
  }
  return all;
}

export async function setHypoxiaCache(data: HypoxiaCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { readingCount: _memCache._meta.readingCount, stationCount: _memCache._meta.stationCount, hypoxicZoneCount: _memCache._meta.hypoxicZoneCount }
    : null;
  const newCounts = { readingCount: data._meta.readingCount, stationCount: data._meta.stationCount, hypoxicZoneCount: data._meta.hypoxicZoneCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[Hypoxia Cache] Updated: ${data._meta.readingCount} readings, ` +
    `${data._meta.stationCount} stations, ${data._meta.hypoxicZoneCount} hypoxic zones`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/hypoxia.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isHypoxiaBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Hypoxia Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setHypoxiaBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getHypoxiaCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    readingCount: _memCache._meta.readingCount,
    stationCount: _memCache._meta.stationCount,
    hypoxicZoneCount: _memCache._meta.hypoxicZoneCount,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
