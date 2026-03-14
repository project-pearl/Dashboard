/**
 * CoastWatch Cache — Server-side grid-based spatial cache for NOAA
 * CoastWatch satellite ocean and coastal observations including
 * chlorophyll-a, sea surface temperature, turbidity, and algal bloom
 * risk assessments.
 *
 * Populated by /api/cron/rebuild-coastwatch.
 * Source: https://coastwatch.noaa.gov/ — NOAA CoastWatch/OceanWatch
 * satellite ocean color, SST, and water quality products.
 *
 * Grid-based: Record<string, CoastwatchObs[]> using gridKey at 0.1°
 * resolution (~11km). Nearby lookups check target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CoastwatchObs {
  lat: number;
  lng: number;
  chlorophyllA: number | null;
  sst: number | null;
  turbidity: number | null;
  date: string;
  sensor: string;
  region: string;
  bloomRisk: 'none' | 'low' | 'moderate' | 'high';
}

interface CoastwatchCacheMeta {
  built: string;
  observationCount: number;
  regionCount: number;
  highBloomRiskCount: number;
}

interface CoastwatchCacheData {
  _meta: CoastwatchCacheMeta;
  grid: Record<string, CoastwatchObs[]>;
  regionIndex: Record<string, CoastwatchObs[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: CoastwatchCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'coastwatch.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid, regionIndex: data.regionIndex || {} };
    _cacheSource = 'disk';
    console.log(`[CoastWatch Cache] Loaded from disk (${data.meta.observationCount} observations, built ${data.meta.built})`);
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
    const file = path.join(dir, 'coastwatch.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: _memCache._meta,
      grid: _memCache.grid,
      regionIndex: _memCache.regionIndex,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[CoastWatch Cache] Saved to disk (${(Buffer.byteLength(payload) / 1024).toFixed(1)} KB)`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any; regionIndex: any }>('cache/coastwatch.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid, regionIndex: data.regionIndex || {} };
    _cacheSource = 'blob';
    console.warn(`[CoastWatch Cache] Loaded from blob (${data.meta.observationCount} observations)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getCoastwatchNearby(lat: number, lng: number): CoastwatchObs[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: CoastwatchObs[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) results.push(...cell);
  }
  return results;
}

export function getCoastwatchByRegion(region: string): CoastwatchObs[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.regionIndex[region] || [];
}

export function getCoastwatchAll(): Record<string, CoastwatchObs[]> {
  ensureDiskLoaded();
  if (!_memCache) return {};
  return _memCache.grid;
}

// ── Setter ───────────────────────────────────────────────────────────────────

export async function setCoastwatchCache(data: CoastwatchCacheData): Promise<void> {
  const prevCounts = _memCache
    ? {
        observationCount: _memCache._meta.observationCount,
        regionCount: _memCache._meta.regionCount,
        highBloomRiskCount: _memCache._meta.highBloomRiskCount,
      }
    : null;
  const newCounts = {
    observationCount: data._meta.observationCount,
    regionCount: data._meta.regionCount,
    highBloomRiskCount: data._meta.highBloomRiskCount,
  };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[CoastWatch Cache] Updated: ${data._meta.observationCount} observations, ` +
    `${data._meta.regionCount} regions, ${data._meta.highBloomRiskCount} high bloom risk`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/coastwatch.json', {
    meta: data._meta,
    grid: data.grid,
    regionIndex: data.regionIndex,
  });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isCoastwatchBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[CoastWatch Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCoastwatchBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCoastwatchCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    observationCount: _memCache._meta.observationCount,
    regionCount: _memCache._meta.regionCount,
    highBloomRiskCount: _memCache._meta.highBloomRiskCount,
    lastDelta: _lastDelta,
  };
}
