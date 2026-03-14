/**
 * WQX Modern Cache — Server-side state-keyed cache for EPA Water Quality
 * Exchange (WQX) 3.0 monitoring results.
 *
 * Populated by /api/cron/rebuild-wqx-modern.
 * Source: https://www.epa.gov/waterdata/water-quality-data-wqx
 *
 * State-keyed: Record<string, WqxResult[]> with grid index for spatial
 * lookups. Links to water quality via standardised analytical results
 * from WQX 3.0 API including characteristicName, resultValue, and method.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WqxResult {
  organizationId: string;
  organizationName: string;
  activityId: string;
  characteristicName: string;
  resultValue: number | null;
  resultUnit: string;
  resultAnalyticalMethod: string;
  monitoringLocationId: string;
  monitoringLocationType: string;
  lat: number;
  lng: number;
  activityStartDate: string;
  state: string;
}

interface WqxModernCacheMeta {
  built: string;
  recordCount: number;
  stateCount: number;
}

interface WqxModernCacheData {
  _meta: WqxModernCacheMeta;
  byState: Record<string, WqxResult[]>;
  grid: Record<string, WqxResult[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: WqxModernCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'wqx-modern.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.byState) return false;
    _memCache = { _meta: data.meta, byState: data.byState, grid: data.grid || {} };
    _cacheSource = 'disk';
    console.log(`[WQX Modern Cache] Loaded from disk (${data.meta.recordCount} records, built ${data.meta.built})`);
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
    const file = path.join(dir, 'wqx-modern.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: _memCache._meta,
      byState: _memCache.byState,
      grid: _memCache.grid,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[WQX Modern Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; byState: any; grid: any }>('cache/wqx-modern.json');
  if (data?.meta && data?.byState) {
    _memCache = { _meta: data.meta, byState: data.byState, grid: data.grid || {} };
    _cacheSource = 'blob';
    console.warn(`[WQX Modern Cache] Loaded from blob (${data.meta.recordCount} records)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getWqxModernByState(state: string): WqxResult[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.byState[state.toUpperCase()] || [];
}

export function getWqxModernNearby(lat: number, lng: number): WqxResult[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: WqxResult[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) results.push(...cell);
  }
  return results;
}

export async function setWqxModernCache(data: WqxModernCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { recordCount: _memCache._meta.recordCount, stateCount: _memCache._meta.stateCount }
    : null;
  const newCounts = { recordCount: data._meta.recordCount, stateCount: data._meta.stateCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[WQX Modern Cache] Updated: ${data._meta.recordCount} records, ` +
    `${data._meta.stateCount} states`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/wqx-modern.json', {
    meta: data._meta,
    byState: data.byState,
    grid: data.grid,
  });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isWqxModernBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[WQX Modern Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setWqxModernBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getWqxModernCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    recordCount: _memCache._meta.recordCount,
    stateCount: _memCache._meta.stateCount,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
