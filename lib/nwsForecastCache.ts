/**
 * NWS Forecast Cache — NWS 7-day weather forecasts.
 *
 * Populated by /api/cron/rebuild-nws-forecast (every 6h cron).
 * Pulls forecasts from NWS API for military installations + key monitoring stations.
 * State-keyed for state-level lookups.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ForecastPeriod {
  number: number;
  name: string;
  temperature: number;
  windSpeed: string;
  shortForecast: string;
  detailedForecast: string;
  precipProbability: number | null;
  precipAmount: number | null;
}

export interface NwsForecast {
  locationId: string;
  locationName: string;
  lat: number;
  lng: number;
  state: string;
  gridId: string;
  gridX: number;
  gridY: number;
  periods: ForecastPeriod[];
  precipTotal7d: number;
  maxTemp7d: number;
  minTemp7d: number;
  violationRiskScore: number;
}

export interface NwsForecastCacheMeta {
  built: string;
  locationCount: number;
  stateCount: number;
  highRiskCount: number;
}

interface NwsForecastCacheData {
  _meta: NwsForecastCacheMeta;
  states: Record<string, NwsForecast[]>;
}

export interface NwsForecastLookupResult {
  forecasts: NwsForecast[];
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: NwsForecastCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'nws-forecast.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.states) return false;
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.log(`[NWS Forecast Cache] Loaded from disk (${_memCache._meta.locationCount} locations)`);
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
    fs.writeFileSync(path.join(dir, 'nws-forecast.json'), payload, 'utf-8');
    console.log(`[NWS Forecast Cache] Saved to disk (${(Buffer.byteLength(payload) / 1024 / 1024).toFixed(1)}MB)`);
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
  const data = await loadCacheFromBlob<{ meta: any; states: any }>('cache/nws-forecast.json');
  if (data?.meta && data?.states) {
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.warn(`[NWS Forecast Cache] Loaded from blob (${data.meta.locationCount} locations)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getNwsForecast(state: string): NwsForecastLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const forecasts = _memCache.states[state.toUpperCase()];
  if (!forecasts || forecasts.length === 0) return null;
  return { forecasts, cacheBuilt: _memCache._meta.built, fromCache: true };
}

export function getNwsForecastAll(): Record<string, NwsForecast[]> | null {
  ensureDiskLoaded();
  return _memCache?.states ?? null;
}

export function getHighRiskForecasts(): NwsForecast[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const result: NwsForecast[] = [];
  for (const forecasts of Object.values(_memCache.states)) {
    for (const f of forecasts) {
      if (f.violationRiskScore >= 50) result.push(f);
    }
  }
  return result;
}

export async function setNwsForecastCache(data: NwsForecastCacheData): Promise<void> {
  const prev = _memCache ? { locationCount: _memCache._meta.locationCount, stateCount: _memCache._meta.stateCount, highRiskCount: _memCache._meta.highRiskCount } : null;
  const next = { locationCount: data._meta.locationCount, stateCount: data._meta.stateCount, highRiskCount: data._meta.highRiskCount };
  _lastDelta = computeCacheDelta(prev, next, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[NWS Forecast Cache] Updated: ${data._meta.locationCount} locations, ${data._meta.highRiskCount} high-risk`);
  saveToDisk();
  await saveCacheToBlob('cache/nws-forecast.json', { meta: data._meta, states: data.states });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNwsForecastBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NWS Forecast Cache] Auto-clearing stale build lock');
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setNwsForecastBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getNwsForecastCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true, source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built, locationCount: _memCache._meta.locationCount,
    stateCount: _memCache._meta.stateCount, highRiskCount: _memCache._meta.highRiskCount,
    lastDelta: _lastDelta,
  };
}
