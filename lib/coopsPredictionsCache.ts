/**
 * NOAA CO-OPS Tidal Predictions Cache — Server-side grid-indexed cache for
 * NOAA Center for Operational Oceanographic Products and Services tidal
 * prediction data.
 *
 * Populated by /api/cron/rebuild-coops-predictions.
 * Source: https://api.tidesandcurrents.noaa.gov/
 *
 * Grid-based cache: Record<string, CoopsPrediction[]> using 0.1° resolution.
 * Lookup checks target cell + 8 neighbors for nearby results.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CoopsPrediction {
  stationId: string;
  stationName: string;
  lat: number;
  lng: number;
  state: string;
  predictionType: 'tide' | 'current';
  highTideTime: string | null;
  highTideFt: number | null;
  lowTideTime: string | null;
  lowTideFt: number | null;
  tidalRange: number | null;
  floodRisk: 'none' | 'low' | 'moderate' | 'high';
  predictionDate: string;
}

interface CoopsPredictionsCacheMeta {
  built: string;
  predictionCount: number;
  stationCount: number;
}

interface CoopsPredictionsCacheData {
  _meta: CoopsPredictionsCacheMeta;
  grid: Record<string, CoopsPrediction[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: CoopsPredictionsCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'coops-predictions.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[CO-OPS Predictions Cache] Loaded from disk (${data.meta.predictionCount} predictions, built ${data.meta.built})`);
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
    const file = path.join(dir, 'coops-predictions.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[CO-OPS Predictions Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/coops-predictions.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[CO-OPS Predictions Cache] Loaded from blob (${data.meta.predictionCount} predictions)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getCoopsPredictionsNearby(lat: number, lng: number): CoopsPrediction[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: CoopsPrediction[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) results.push(...cell);
  }
  return results;
}

export function getCoopsPredictionsByState(state: string): CoopsPrediction[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const upper = state.toUpperCase();
  const results: CoopsPrediction[] = [];
  for (const preds of Object.values(_memCache.grid)) {
    for (const p of preds) {
      if (p.state === upper) results.push(p);
    }
  }
  return results;
}

export async function setCoopsPredictionsCache(data: CoopsPredictionsCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { predictionCount: _memCache._meta.predictionCount, stationCount: _memCache._meta.stationCount }
    : null;
  const newCounts = { predictionCount: data._meta.predictionCount, stationCount: data._meta.stationCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[CO-OPS Predictions Cache] Updated: ${data._meta.predictionCount} predictions, ` +
    `${data._meta.stationCount} stations`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/coops-predictions.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isCoopsPredictionsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[CO-OPS Predictions Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCoopsPredictionsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCoopsPredictionsCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    predictionCount: _memCache._meta.predictionCount,
    stationCount: _memCache._meta.stationCount,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
