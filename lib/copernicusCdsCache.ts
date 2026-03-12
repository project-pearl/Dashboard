/**
 * Copernicus CDS Cache — ERA5 climate/hydrology reanalysis data.
 *
 * Populated by /api/cron/rebuild-copernicus-cds (weekly cron).
 * Uses Copernicus Climate Data Store API (requires CDS_API_KEY env var).
 * Falls back to sample data if API key not configured.
 * State-keyed with monthly indicators.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export type ClimateTrend = 'wetter' | 'drier' | 'stable';

export interface CdsClimateIndicator {
  state: string;
  year: number;
  month: number;
  precipAnomaly: number;
  soilMoisture: number;
  runoffAnomaly: number;
  temperature2m: number;
  temperatureAnomaly: number;
  evaporation: number;
  trend12Month: ClimateTrend;
}

export interface CdsCacheMeta {
  built: string;
  indicatorCount: number;
  stateCount: number;
  latestMonth: string;
  apiSource: 'copernicus' | 'sample';
}

interface CdsCacheData {
  _meta: CdsCacheMeta;
  states: Record<string, CdsClimateIndicator[]>;
}

export interface CdsLookupResult {
  indicators: CdsClimateIndicator[];
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: CdsCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;
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
    if (!data?.meta || !data?.states) return false;
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.log(`[Copernicus CDS Cache] Loaded from disk (${_memCache._meta.indicatorCount} indicators)`);
    return true;
  } catch { return false; }
}

function saveToDisk(): void {
  try {
    if (typeof process === 'undefined' || !_memCache) return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, states: _memCache.states });
    fs.writeFileSync(path.join(dir, 'copernicus-cds.json'), payload, 'utf-8');
    console.log(`[Copernicus CDS Cache] Saved to disk (${(Buffer.byteLength(payload) / 1024 / 1024).toFixed(1)}MB)`);
  } catch { /* optional */ }
}

let _diskLoaded = false;
function ensureDiskLoaded() { if (!_diskLoaded) { _diskLoaded = true; loadFromDisk(); } }

let _blobChecked = false;
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_memCache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<{ meta: any; states: any }>('cache/copernicus-cds.json');
  if (data?.meta && data?.states) {
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.warn(`[Copernicus CDS Cache] Loaded from blob (${data.meta.indicatorCount} indicators)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getCopernicusCds(state: string): CdsLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const indicators = _memCache.states[state.toUpperCase()];
  if (!indicators || indicators.length === 0) return null;
  return { indicators, cacheBuilt: _memCache._meta.built, fromCache: true };
}

export function getCopernicusCdsAll(): Record<string, CdsClimateIndicator[]> | null {
  ensureDiskLoaded();
  return _memCache?.states ?? null;
}

export function getCdsLatestMonth(): CdsClimateIndicator[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const result: CdsClimateIndicator[] = [];
  for (const indicators of Object.values(_memCache.states)) {
    if (indicators.length > 0) {
      const sorted = [...indicators].sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
      result.push(sorted[0]);
    }
  }
  return result;
}

export async function setCopernicusCdsCache(data: CdsCacheData): Promise<void> {
  const prev = _memCache ? { indicatorCount: _memCache._meta.indicatorCount, stateCount: _memCache._meta.stateCount } : null;
  const next = { indicatorCount: data._meta.indicatorCount, stateCount: data._meta.stateCount };
  _lastDelta = computeCacheDelta(prev, next, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[Copernicus CDS Cache] Updated: ${data._meta.indicatorCount} indicators (source: ${data._meta.apiSource})`);
  saveToDisk();
  await saveCacheToBlob('cache/copernicus-cds.json', { meta: data._meta, states: data.states });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isCopernicusCdsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Copernicus CDS Cache] Auto-clearing stale build lock');
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCopernicusCdsBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCopernicusCdsCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true, source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built, indicatorCount: _memCache._meta.indicatorCount,
    stateCount: _memCache._meta.stateCount, latestMonth: _memCache._meta.latestMonth,
    apiSource: _memCache._meta.apiSource, lastDelta: _lastDelta,
  };
}
