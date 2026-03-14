/**
 * HAB Forecast Cache — Server-side grid-indexed cache for NOAA/NCCOS
 * Harmful Algal Bloom (HAB) forecasts including bloom severity,
 * cyanobacteria concentrations, and drinking water risk assessments.
 *
 * Populated by /api/cron/rebuild-hab-forecast.
 * Source: https://coastalscience.noaa.gov/research/habs/ — NOAA National
 * Centers for Coastal Ocean Science HAB Forecast System.
 *
 * Grid-based: Record<string, HabForecast[]> at 0.1deg resolution with
 * state index for filtered lookups. Links to water quality via bloom-driven
 * toxin contamination, drinking water advisories, and recreational closures.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HabForecast {
  waterbody: string;
  region: string;
  state: string;
  bloomSeverity: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
  cyanobacteriaConc: number | null;
  toxinType: string | null;
  forecastDate: string;
  validThrough: string;
  drinkingWaterRisk: 'none' | 'low' | 'moderate' | 'high';
  recreationalRisk: 'none' | 'low' | 'moderate' | 'high';
  lat: number;
  lng: number;
  source: string;
}

interface HabForecastCacheMeta {
  built: string;
  forecastCount: number;
  waterbodyCount: number;
  highRiskCount: number;
}

interface HabForecastCacheData {
  _meta: HabForecastCacheMeta;
  grid: Record<string, HabForecast[]>;
  stateIndex: Record<string, HabForecast[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: HabForecastCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'hab-forecast.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid, stateIndex: data.stateIndex || {} };
    _cacheSource = 'disk';
    console.log(`[HAB Forecast Cache] Loaded from disk (${data.meta.forecastCount} forecasts, built ${data.meta.built})`);
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
    const file = path.join(dir, 'hab-forecast.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: _memCache._meta,
      grid: _memCache.grid,
      stateIndex: _memCache.stateIndex,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[HAB Forecast Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any; stateIndex: any }>('cache/hab-forecast.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid, stateIndex: data.stateIndex || {} };
    _cacheSource = 'blob';
    console.warn(`[HAB Forecast Cache] Loaded from blob (${data.meta.forecastCount} forecasts)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getHabForecastNearby(lat: number, lng: number): HabForecast[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: HabForecast[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) results.push(...cell);
  }
  return results;
}

export function getHabForecastByState(state: string): HabForecast[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.stateIndex[state.toUpperCase()] || [];
}

export async function setHabForecastCache(data: HabForecastCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { forecastCount: _memCache._meta.forecastCount, waterbodyCount: _memCache._meta.waterbodyCount, highRiskCount: _memCache._meta.highRiskCount }
    : null;
  const newCounts = { forecastCount: data._meta.forecastCount, waterbodyCount: data._meta.waterbodyCount, highRiskCount: data._meta.highRiskCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[HAB Forecast Cache] Updated: ${data._meta.forecastCount} forecasts, ` +
    `${data._meta.waterbodyCount} waterbodies, ${data._meta.highRiskCount} high-risk`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/hab-forecast.json', {
    meta: data._meta,
    grid: data.grid,
    stateIndex: data.stateIndex,
  });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isHabForecastBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[HAB Forecast Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setHabForecastBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getHabForecastCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    forecastCount: _memCache._meta.forecastCount,
    waterbodyCount: _memCache._meta.waterbodyCount,
    highRiskCount: _memCache._meta.highRiskCount,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
