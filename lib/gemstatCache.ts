/**
 * GEMStat Cache — Server-side flat cache for UNEP GEMS/Water global
 * freshwater quality monitoring data aggregated by country.
 *
 * Populated by /api/cron/rebuild-gemstat (weekly, Monday 4 AM UTC).
 * Source: https://gemstat.org/ — UN Environment Programme Global
 * Environment Monitoring System for freshwater quality.
 *
 * Flat cache: Record<string, GemsStatCountry> keyed by ISO-3166 alpha-3
 * country code (e.g. "USA", "DEU", "BRA").
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GemsIndicator {
  median: number;
  unit: string;
}

export interface GemsStatCountry {
  countryCode: string;
  countryName: string;
  stationCount: number;
  latestYear: number;
  indicators: {
    dissolvedOxygen: GemsIndicator | null;
    pH: GemsIndicator | null;
    bod: GemsIndicator | null;
    nitrate: GemsIndicator | null;
    phosphorus: GemsIndicator | null;
    turbidity: GemsIndicator | null;
    fecalColiform: GemsIndicator | null;
    conductivity: GemsIndicator | null;
  };
  overallGrade: string;
}

interface GemsStatCacheMeta {
  built: string;
  countryCount: number;
  totalStations: number;
}

interface GemsStatCacheData {
  _meta: GemsStatCacheMeta;
  countries: Record<string, GemsStatCountry>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: GemsStatCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'gemstat.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.countries) return false;
    _memCache = { _meta: data.meta, countries: data.countries };
    _cacheSource = 'disk';
    console.log(`[GEMStat Cache] Loaded from disk (${data.meta.countryCount} countries, built ${data.meta.built})`);
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
    const file = path.join(dir, 'gemstat.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, countries: _memCache.countries });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[GEMStat Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; countries: any }>('cache/gemstat.json');
  if (data?.meta && data?.countries) {
    _memCache = { _meta: data.meta, countries: data.countries };
    _cacheSource = 'blob';
    console.warn(`[GEMStat Cache] Loaded from blob (${data.meta.countryCount} countries)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getGemsStatAll(): Record<string, GemsStatCountry> {
  ensureDiskLoaded();
  if (!_memCache) return {};
  return _memCache.countries;
}

export function getGemsStatCountry(code: string): GemsStatCountry | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.countries[code.toUpperCase()] || null;
}

export async function setGemsStatCache(data: GemsStatCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { countryCount: _memCache._meta.countryCount, totalStations: _memCache._meta.totalStations }
    : null;
  const newCounts = { countryCount: data._meta.countryCount, totalStations: data._meta.totalStations };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[GEMStat Cache] Updated: ${data._meta.countryCount} countries, ` +
    `${data._meta.totalStations} stations`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/gemstat.json', { meta: data._meta, countries: data.countries });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isGemsStatBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[GEMStat Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setGemsStatBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getGemsStatCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    countryCount: _memCache._meta.countryCount,
    totalStations: _memCache._meta.totalStations,
    lastDelta: _lastDelta,
  };
}
