/**
 * NWS 7-Day Forecast Cache — Server-side state-keyed cache for National
 * Weather Service forecast data including precipitation totals, temperature
 * extremes, and water-quality violation risk scoring.
 *
 * Data source: NWS Weather Forecast API (api.weather.gov) with grid-based
 * forecast retrieval and precipitation/temperature aggregation.
 *
 * Populated by /api/cron/rebuild-nws-forecast.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NwsForecastPeriod {
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
  periods: NwsForecastPeriod[];
  precipTotal7d: number;
  maxTemp7d: number;
  minTemp7d: number;
  violationRiskScore: number;
}

interface NwsForecastMeta {
  built: string;
  locationCount: number;
  statesCovered: number;
  highRiskCount: number;
}

interface NwsForecastCacheData {
  _meta: NwsForecastMeta;
  states: Record<string, NwsForecast[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: NwsForecastCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ─────────────────────────────────────────────────────────

const DISK_FILE = 'nws-forecast.json';
const BLOB_KEY = 'cache/nws-forecast.json';

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', DISK_FILE);
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.states) return false;
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.log(`[NWS Forecast Cache] Loaded from disk (${data.meta.locationCount} locations, built ${data.meta.built})`);
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
    const file = path.join(dir, DISK_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, states: _memCache.states });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[NWS Forecast Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: NwsForecastMeta; states: Record<string, NwsForecast[]> }>(BLOB_KEY);
  if (data?.meta && data?.states) {
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'blob';
    console.warn(`[NWS Forecast Cache] Loaded from blob (${data.meta.locationCount} locations)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getNwsForecast(state: string): NwsForecast[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.states[state.toUpperCase()] || [];
}

export function getNwsForecastAll(): Record<string, NwsForecast[]> {
  ensureDiskLoaded();
  if (!_memCache) return {};
  return _memCache.states;
}

export function getHighRiskForecasts(): NwsForecast[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const result: NwsForecast[] = [];
  for (const forecasts of Object.values(_memCache.states)) {
    for (const fc of forecasts) {
      if (fc.violationRiskScore >= 0.7) {
        result.push(fc);
      }
    }
  }
  return result;
}

// ── Setter ───────────────────────────────────────────────────────────────────

export async function setNwsForecastCache(data: NwsForecastCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { locationCount: _memCache._meta.locationCount, statesCovered: _memCache._meta.statesCovered }
    : null;
  const newCounts = { locationCount: data._meta.locationCount, statesCovered: data._meta.statesCovered };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[NWS Forecast Cache] Updated: ${data._meta.locationCount} locations, ` +
    `${data._meta.statesCovered} states, ${data._meta.highRiskCount} high-risk`,
  );
  saveToDisk();
  await saveCacheToBlob(BLOB_KEY, { meta: data._meta, states: data.states });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNwsForecastBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NWS Forecast Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setNwsForecastBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getNwsForecastCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    locationCount: _memCache._meta.locationCount,
    statesCovered: _memCache._meta.statesCovered,
    highRiskCount: _memCache._meta.highRiskCount,
    lastDelta: _lastDelta,
  };
}
