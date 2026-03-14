/**
 * NOAA SWDI Severe Weather Data Inventory Cache — Server-side grid-indexed
 * cache for NOAA severe weather event data.
 *
 * Populated by /api/cron/rebuild-swdi.
 * Source: https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ncdc:C00773
 *
 * Grid-based cache: Record<string, SwdiEvent[]> using 0.1° resolution.
 * Lookup checks target cell + 8 neighbors for nearby results.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SwdiEvent {
  eventId: string;
  eventType: 'hail' | 'tornado' | 'wind' | 'flood' | 'thunderstorm';
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  lat: number;
  lng: number;
  state: string;
  county: string;
  eventDate: string;
  magnitude: number | null;
  magnitudeUnit: string | null;
  source: string;
}

interface SwdiCacheMeta {
  built: string;
  eventCount: number;
  stateCount: number;
  severeCount: number;
}

interface SwdiCacheData {
  _meta: SwdiCacheMeta;
  grid: Record<string, SwdiEvent[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: SwdiCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'swdi.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[SWDI Cache] Loaded from disk (${data.meta.eventCount} events, built ${data.meta.built})`);
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
    const file = path.join(dir, 'swdi.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[SWDI Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/swdi.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[SWDI Cache] Loaded from blob (${data.meta.eventCount} events)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getSwdiNearby(lat: number, lng: number): SwdiEvent[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: SwdiEvent[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) results.push(...cell);
  }
  return results;
}

export function getSwdiByState(state: string): SwdiEvent[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const upper = state.toUpperCase();
  const results: SwdiEvent[] = [];
  for (const events of Object.values(_memCache.grid)) {
    for (const evt of events) {
      if (evt.state === upper) results.push(evt);
    }
  }
  return results;
}

export async function setSwdiCache(data: SwdiCacheData): Promise<void> {
  const prevCounts = _memCache
    ? {
        eventCount: _memCache._meta.eventCount,
        stateCount: _memCache._meta.stateCount,
        severeCount: _memCache._meta.severeCount,
      }
    : null;
  const newCounts = {
    eventCount: data._meta.eventCount,
    stateCount: data._meta.stateCount,
    severeCount: data._meta.severeCount,
  };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[SWDI Cache] Updated: ${data._meta.eventCount} events, ` +
    `${data._meta.stateCount} states, ${data._meta.severeCount} severe`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/swdi.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isSwdiBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[SWDI Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setSwdiBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getSwdiCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    eventCount: _memCache._meta.eventCount,
    stateCount: _memCache._meta.stateCount,
    severeCount: _memCache._meta.severeCount,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
