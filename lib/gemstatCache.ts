/**
 * GEMStat Cache — Global freshwater quality data from GEMStat database.
 *
 * Populated by /api/cron/rebuild-gemstat (weekly cron).
 * Country-keyed flat cache (no grid indexing).
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GemStatIndicator {
  median: number | null;
  unit: string;
}

export interface GemStatCountry {
  countryCode: string;
  countryName: string;
  stationCount: number;
  latestYear: number;
  indicators: {
    dissolvedOxygen: GemStatIndicator;
    pH: GemStatIndicator;
    bod: GemStatIndicator;
    nitrate: GemStatIndicator;
    phosphorus: GemStatIndicator;
    turbidity: GemStatIndicator;
    fecalColiform: GemStatIndicator;
    conductivity: GemStatIndicator;
  };
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface GemStatCacheMeta {
  built: string;
  countryCount: number;
  totalStations: number;
  latestDataYear: number;
}

interface GemStatCacheData {
  _meta: GemStatCacheMeta;
  countries: Record<string, GemStatCountry>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: GemStatCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;
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
    console.log(`[GEMStat Cache] Loaded from disk (${_memCache._meta.countryCount} countries)`);
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
    const payload = JSON.stringify({ meta: _memCache._meta, countries: _memCache.countries });
    fs.writeFileSync(path.join(dir, 'gemstat.json'), payload, 'utf-8');
    console.log(`[GEMStat Cache] Saved to disk (${(Buffer.byteLength(payload) / 1024 / 1024).toFixed(1)}MB)`);
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
  const data = await loadCacheFromBlob<{ meta: any; countries: any }>('cache/gemstat.json');
  if (data?.meta && data?.countries) {
    _memCache = { _meta: data.meta, countries: data.countries };
    _cacheSource = 'disk';
    console.warn(`[GEMStat Cache] Loaded from blob (${data.meta.countryCount} countries)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getGemsStatAll(): Record<string, GemStatCountry> | null {
  ensureDiskLoaded();
  return _memCache?.countries ?? null;
}

export function getGemsStatCountry(code: string): GemStatCountry | null {
  ensureDiskLoaded();
  return _memCache?.countries[code.toUpperCase()] ?? null;
}

export async function setGemStatCache(data: GemStatCacheData): Promise<void> {
  const prev = _memCache ? { countryCount: _memCache._meta.countryCount, totalStations: _memCache._meta.totalStations } : null;
  const next = { countryCount: data._meta.countryCount, totalStations: data._meta.totalStations };
  _lastDelta = computeCacheDelta(prev, next, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[GEMStat Cache] Updated: ${data._meta.countryCount} countries, ${data._meta.totalStations} stations`);
  saveToDisk();
  await saveCacheToBlob('cache/gemstat.json', { meta: data._meta, countries: data.countries });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isGemStatBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[GEMStat Cache] Auto-clearing stale build lock');
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setGemStatBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getGemsStatCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true, source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built, countryCount: _memCache._meta.countryCount,
    totalStations: _memCache._meta.totalStations, latestDataYear: _memCache._meta.latestDataYear,
    lastDelta: _lastDelta,
  };
}
