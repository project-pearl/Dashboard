/**
 * STN Flood Cache — Server-side grid-indexed cache for USGS Short-Term
 * Network (STN) flood event data including high-water marks, peak stages,
 * and sensor deployments.
 *
 * Populated by /api/cron/rebuild-stn-flood.
 * Source: https://stn.wim.usgs.gov/ — USGS STN Flood Event Data API.
 *
 * Grid-based: Record<string, StnFloodEvent[]> at 0.1deg resolution with
 * state index for filtered lookups. Links to water quality via flood-driven
 * contamination transport and infrastructure damage assessment.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StnFloodEvent {
  eventId: number;
  eventName: string;
  state: string;
  county: string;
  sensorType: string;
  siteNo: string;
  peakStage: number | null;
  peakDate: string | null;
  hwmElevation: number | null;
  lat: number;
  lng: number;
  eventStatus: string;
  eventStartDate: string;
  eventEndDate: string | null;
}

interface StnFloodCacheMeta {
  built: string;
  eventCount: number;
  stateCount: number;
}

interface StnFloodCacheData {
  _meta: StnFloodCacheMeta;
  grid: Record<string, StnFloodEvent[]>;
  stateIndex: Record<string, StnFloodEvent[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: StnFloodCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'stn-flood.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid, stateIndex: data.stateIndex || {} };
    _cacheSource = 'disk';
    console.log(`[STN Flood Cache] Loaded from disk (${data.meta.eventCount} events, built ${data.meta.built})`);
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
    const file = path.join(dir, 'stn-flood.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: _memCache._meta,
      grid: _memCache.grid,
      stateIndex: _memCache.stateIndex,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[STN Flood Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any; stateIndex: any }>('cache/stn-flood.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid, stateIndex: data.stateIndex || {} };
    _cacheSource = 'blob';
    console.warn(`[STN Flood Cache] Loaded from blob (${data.meta.eventCount} events)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getStnFloodNearby(lat: number, lng: number): StnFloodEvent[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: StnFloodEvent[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) results.push(...cell);
  }
  return results;
}

export function getStnFloodByState(state: string): StnFloodEvent[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.stateIndex[state.toUpperCase()] || [];
}

export async function setStnFloodCache(data: StnFloodCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { eventCount: _memCache._meta.eventCount, stateCount: _memCache._meta.stateCount }
    : null;
  const newCounts = { eventCount: data._meta.eventCount, stateCount: data._meta.stateCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[STN Flood Cache] Updated: ${data._meta.eventCount} events, ` +
    `${data._meta.stateCount} states`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/stn-flood.json', {
    meta: data._meta,
    grid: data.grid,
    stateIndex: data.stateIndex,
  });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isStnFloodBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[STN Flood Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setStnFloodBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getStnFloodCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    eventCount: _memCache._meta.eventCount,
    stateCount: _memCache._meta.stateCount,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
