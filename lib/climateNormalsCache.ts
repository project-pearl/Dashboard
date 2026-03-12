/**
 * Climate Normals Cache — State-keyed cache for NOAA CDO county-level
 * temperature and precipitation normals, drought indices, and extreme event counts.
 *
 * Populated by /api/cron/rebuild-climate-normals (weekly, Sunday 11:30 PM UTC).
 * Source: https://www.ncei.noaa.gov/cdo-web/api/v2/ (NCDC token via api.data.gov)
 *
 * Extends the existing state-level nceiCache with county-level granularity.
 * Critical for correlating climate patterns with water quality violations.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CountyClimateNormals {
  countyFips: string;
  countyName: string;
  state: string;
  avgTempF: number | null;        // Annual average temperature (°F)
  avgMaxTempF: number | null;     // Annual average daily max temp
  avgMinTempF: number | null;     // Annual average daily min temp
  avgPrecipIn: number | null;     // Annual average precipitation (inches)
  heatingDegreeDays: number | null;
  coolingDegreeDays: number | null;
  extremeHeatDays: number;        // Days ≥ 100°F in recent year
  extremeColdDays: number;        // Days ≤ 0°F in recent year
  heavyPrecipDays: number;        // Days ≥ 2" precipitation in recent year
  droughtTendency: 'wet' | 'normal' | 'dry' | 'drought' | null;
  stationCount: number;           // Number of GHCND stations contributing
}

interface ClimateNormalsCacheMeta {
  built: string;
  countyCount: number;
  statesIncluded: number;
}

interface ClimateNormalsCacheData {
  built: string;
  counties: Record<string, { normals: CountyClimateNormals[]; fetched: string }>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _cache: ClimateNormalsCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'climate-normals.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.built || !data?.counties) return false;
    _cache = data;
    _cacheSource = 'disk';
    console.log(`[Climate Normals Cache] Loaded from disk (built ${data.built})`);
    return true;
  } catch {
    return false;
  }
}

function saveToDisk(): void {
  try {
    if (typeof process === 'undefined' || !_cache) return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    const file = path.join(dir, 'climate-normals.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(_cache), 'utf-8');
    console.log(`[Climate Normals Cache] Saved to disk`);
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
  if (_cache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<ClimateNormalsCacheData>('cache/climate-normals.json');
  if (data?.built && data?.counties) {
    _cache = data;
    _cacheSource = 'blob';
    console.warn(`[Climate Normals Cache] Loaded from blob`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get climate normals for a specific state's counties. */
export function getClimateNormals(state: string): CountyClimateNormals[] | null {
  ensureDiskLoaded();
  if (!_cache) return null;
  const entry = _cache.counties[state.toUpperCase()];
  return entry?.normals ?? null;
}

/** Get climate normals for a specific county by FIPS code. */
export function getCountyClimate(countyFips: string): CountyClimateNormals | null {
  ensureDiskLoaded();
  if (!_cache) return null;
  const stateFips = countyFips.substring(0, 2);
  // Find the state abbreviation from FIPS
  for (const [stateAbbr, entry] of Object.entries(_cache.counties)) {
    const match = entry.normals.find(c => c.countyFips === countyFips);
    if (match) return match;
  }
  return null;
}

/** Get all counties across all states. */
export function getAllClimateNormals(): CountyClimateNormals[] {
  ensureDiskLoaded();
  if (!_cache) return [];
  const all: CountyClimateNormals[] = [];
  for (const entry of Object.values(_cache.counties)) {
    all.push(...entry.normals);
  }
  return all;
}

/** Bulk-set climate normals for all states. */
export async function setClimateNormalsCache(
  countiesByState: Record<string, { normals: CountyClimateNormals[]; fetched: string }>
): Promise<void> {
  const prevCounts = _cache ? {
    countyCount: Object.values(_cache.counties).reduce((s, e) => s + e.normals.length, 0),
    statesWithData: Object.keys(_cache.counties).filter(k => _cache!.counties[k].normals.length > 0).length,
  } : null;
  const newCountyCount = Object.values(countiesByState).reduce((s, e) => s + e.normals.length, 0);
  const newStatesCount = Object.keys(countiesByState).filter(k => countiesByState[k].normals.length > 0).length;
  const newCounts = { countyCount: newCountyCount, statesWithData: newStatesCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _cache?.built ?? null);
  _cache = {
    built: new Date().toISOString(),
    counties: countiesByState,
  };
  _cacheSource = 'memory (cron)';
  saveToDisk();
  await saveCacheToBlob('cache/climate-normals.json', _cache);
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isClimateNormalsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Climate Normals Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setClimateNormalsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getClimateNormalsCacheStatus() {
  ensureDiskLoaded();
  if (!_cache) return { loaded: false, source: null as string | null };
  const totalCounties = Object.values(_cache.counties).reduce((s, e) => s + e.normals.length, 0);
  const statesWithData = Object.keys(_cache.counties).filter(k => _cache!.counties[k].normals.length > 0).length;
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _cache.built,
    countyCount: totalCounties,
    statesWithData,
    lastDelta: _lastDelta,
  };
}
