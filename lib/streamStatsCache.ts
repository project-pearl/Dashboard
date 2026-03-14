/**
 * StreamStats Cache — Server-side state-keyed cache for USGS StreamStats
 * basin characteristics including drainage area, flow statistics, and
 * land cover attributes for monitored stream stations.
 *
 * Populated by /api/cron/rebuild-stream-stats.
 * Source: https://streamstats.usgs.gov/ — USGS StreamStats basin
 * delineation and flow statistics API.
 *
 * State-keyed: Record<string, StreamStatsBasin[]> keyed by 2-letter
 * state abbreviation (e.g. "PA", "CA", "TX").
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StreamStatsBasin {
  stationId: string;
  stationName: string;
  state: string;
  lat: number;
  lng: number;
  drainageAreaSqMi: number | null;
  meanAnnualFlowCfs: number | null;
  peakFlowQ100: number | null;
  peakFlowQ500: number | null;
  basinSlope: number | null;
  basinElevationFt: number | null;
  precipInchesAnnual: number | null;
  impervPct: number | null;
  forestPct: number | null;
  huc8: string;
}

interface StreamStatsCacheMeta {
  built: string;
  basinCount: number;
  stateCount: number;
}

interface StreamStatsCacheData {
  _meta: StreamStatsCacheMeta;
  byState: Record<string, StreamStatsBasin[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: StreamStatsCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'stream-stats.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.byState) return false;
    _memCache = { _meta: data.meta, byState: data.byState };
    _cacheSource = 'disk';
    console.log(`[StreamStats Cache] Loaded from disk (${data.meta.basinCount} basins, built ${data.meta.built})`);
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
    const file = path.join(dir, 'stream-stats.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, byState: _memCache.byState });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[StreamStats Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; byState: any }>('cache/stream-stats.json');
  if (data?.meta && data?.byState) {
    _memCache = { _meta: data.meta, byState: data.byState };
    _cacheSource = 'blob';
    console.warn(`[StreamStats Cache] Loaded from blob (${data.meta.basinCount} basins)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getStreamStatsByState(state: string): StreamStatsBasin[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.byState[state.toUpperCase()] || [];
}

export function getStreamStatsNearby(lat: number, lng: number): StreamStatsBasin[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const keys = neighborKeys(lat, lng);
  const results: StreamStatsBasin[] = [];
  for (const entries of Object.values(_memCache.byState)) {
    for (const basin of entries) {
      const bk = gridKey(basin.lat, basin.lng);
      if (keys.includes(bk)) {
        results.push(basin);
      }
    }
  }
  return results;
}

export function getStreamStatsAll(): Record<string, StreamStatsBasin[]> {
  ensureDiskLoaded();
  if (!_memCache) return {};
  return _memCache.byState;
}

// ── Setter ───────────────────────────────────────────────────────────────────

export async function setStreamStatsCache(data: StreamStatsCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { basinCount: _memCache._meta.basinCount, stateCount: _memCache._meta.stateCount }
    : null;
  const newCounts = { basinCount: data._meta.basinCount, stateCount: data._meta.stateCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[StreamStats Cache] Updated: ${data._meta.basinCount} basins, ` +
    `${data._meta.stateCount} states`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/stream-stats.json', { meta: data._meta, byState: data.byState });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isStreamStatsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[StreamStats Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setStreamStatsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getStreamStatsCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    basinCount: _memCache._meta.basinCount,
    stateCount: _memCache._meta.stateCount,
    lastDelta: _lastDelta,
  };
}
