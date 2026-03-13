/**
 * Copernicus CDS Cache — Server-side state-keyed cache for Copernicus
 * Climate Data Store climate and hydrology reanalysis indicators.
 *
 * Populated by /api/cron/rebuild-copernicus-cds (daily at 5 AM UTC).
 * Source: https://cds.climate.copernicus.eu/ — ERA5 reanalysis products
 * covering precipitation anomalies, soil moisture, runoff, and temperature.
 *
 * State-keyed: Record<string, CdsClimateIndicator[]> with monthly time series
 * per US state. Links to water quality via drought/flood correlation,
 * runoff-driven contamination, and temperature impacts on dissolved oxygen.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CdsClimateIndicator {
  state: string;
  year: number;
  month: number;
  precipAnomaly: number | null;
  soilMoisture: number | null;
  runoffAnomaly: number | null;
  temperature2m: number | null;
  temperatureAnomaly: number | null;
  evaporation: number | null;
  trend12Month: 'wetter' | 'drier' | 'stable';
}

interface CopernicusCdsCacheMeta {
  built: string;
  recordCount: number;
  statesCovered: number;
  latestMonth: string;
}

interface CopernicusCdsCacheData {
  _meta: CopernicusCdsCacheMeta;
  byState: Record<string, CdsClimateIndicator[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: CopernicusCdsCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'copernicus-cds.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.byState) return false;
    _memCache = { _meta: data.meta, byState: data.byState };
    _cacheSource = 'disk';
    console.log(`[Copernicus CDS Cache] Loaded from disk (${data.meta.recordCount} records, built ${data.meta.built})`);
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
    const file = path.join(dir, 'copernicus-cds.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, byState: _memCache.byState });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[Copernicus CDS Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; byState: any }>('cache/copernicus-cds.json');
  if (data?.meta && data?.byState) {
    _memCache = { _meta: data.meta, byState: data.byState };
    _cacheSource = 'blob';
    console.warn(`[Copernicus CDS Cache] Loaded from blob (${data.meta.recordCount} records)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getCopernicusCds(state: string): CdsClimateIndicator[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.byState[state.toUpperCase()] || [];
}

export function getCopernicusCdsAll(): Record<string, CdsClimateIndicator[]> {
  ensureDiskLoaded();
  if (!_memCache) return {};
  return _memCache.byState;
}

export function getCdsLatestMonth(): string | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache._meta.latestMonth;
}

export async function setCopernicusCdsCache(data: CopernicusCdsCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { recordCount: _memCache._meta.recordCount, statesCovered: _memCache._meta.statesCovered }
    : null;
  const newCounts = { recordCount: data._meta.recordCount, statesCovered: data._meta.statesCovered };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[Copernicus CDS Cache] Updated: ${data._meta.recordCount} records, ` +
    `${data._meta.statesCovered} states, latest ${data._meta.latestMonth}`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/copernicus-cds.json', { meta: data._meta, byState: data.byState });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isCopernicusCdsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Copernicus CDS Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCopernicusCdsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCopernicusCdsCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    recordCount: _memCache._meta.recordCount,
    statesCovered: _memCache._meta.statesCovered,
    latestMonth: _memCache._meta.latestMonth,
    lastDelta: _lastDelta,
  };
}
