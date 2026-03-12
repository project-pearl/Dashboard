/**
 * CDC WONDER National Mortality Cache
 * National-level environmental cause-of-death data from CDC WONDER D76 database.
 * Populated by /api/cron/rebuild-cdc-wonder (daily cron).
 * Records are categorized by environmental/water-related causes.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export type MortalityCategory =
  | 'waterborne'
  | 'environmental_exposure'
  | 'heavy_metal'
  | 'pfas_related'
  | 'respiratory';

export interface CdcWonderMortalityRecord {
  causeCode: string;          // ICD-10 code or range (e.g. "A00-A09")
  causeLabel: string;         // Human-readable cause name
  category: MortalityCategory;
  year: number;
  deaths: number;
  population: number;
  crudeRate: number;          // per 100,000
  ageAdjustedRate: number | null;
  trend: 'rising' | 'stable' | 'declining' | null;
}

export interface CdcWonderCacheMeta {
  built: string;
  recordCount: number;
  categoryCounts: Record<string, number>;
  yearRange: [number, number] | null;
}

interface CdcWonderCacheData {
  _meta: CdcWonderCacheMeta;
  records: CdcWonderMortalityRecord[];
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: CdcWonderCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'cdc-wonder.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?._meta || !data?.records) return false;

    _memCache = data;
    _cacheSource = 'disk';
    console.log(
      `[CDC WONDER Cache] Loaded from disk (${data._meta.recordCount} records, built ${data._meta.built || 'unknown'})`
    );
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
    const file = path.join(dir, 'cdc-wonder.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify(_memCache);
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[CDC WONDER Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.recordCount} records)`);
  } catch {
    // Disk save is optional — fail silently
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
  const data = await loadCacheFromBlob<CdcWonderCacheData>('cache/cdc-wonder.json');
  if (data?._meta && data?.records?.length > 0) {
    _memCache = data;
    _cacheSource = 'disk';
    console.warn(`[CDC WONDER Cache] Loaded from blob (${data._meta.recordCount} records)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get all mortality records.
 */
export function getCdcWonderRecords(): CdcWonderMortalityRecord[] {
  ensureDiskLoaded();
  return _memCache?.records ?? [];
}

/**
 * Get mortality records filtered by category.
 */
export function getMortalityByCategory(category: MortalityCategory): CdcWonderMortalityRecord[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.records.filter(r => r.category === category);
}

/**
 * Get year-over-year trends for a given category (or all).
 */
export function getMortalityTrends(category?: MortalityCategory): Array<{
  year: number;
  deaths: number;
  crudeRate: number;
}> {
  ensureDiskLoaded();
  if (!_memCache) return [];

  const filtered = category
    ? _memCache.records.filter(r => r.category === category)
    : _memCache.records;

  const byYear = new Map<number, { deaths: number; totalRate: number; count: number }>();
  for (const r of filtered) {
    const entry = byYear.get(r.year) || { deaths: 0, totalRate: 0, count: 0 };
    entry.deaths += r.deaths;
    entry.totalRate += r.crudeRate;
    entry.count += 1;
    byYear.set(r.year, entry);
  }

  return Array.from(byYear.entries())
    .map(([year, { deaths, totalRate, count }]) => ({
      year,
      deaths,
      crudeRate: Math.round((totalRate / count) * 100) / 100,
    }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Get top N causes of death across all years, sorted by total deaths.
 */
export function getTopCauses(n = 5): Array<{
  causeCode: string;
  causeLabel: string;
  category: MortalityCategory;
  totalDeaths: number;
  avgRate: number;
  trend: 'rising' | 'stable' | 'declining' | null;
}> {
  ensureDiskLoaded();
  if (!_memCache) return [];

  const byCause = new Map<string, {
    causeCode: string;
    causeLabel: string;
    category: MortalityCategory;
    totalDeaths: number;
    totalRate: number;
    count: number;
    trend: 'rising' | 'stable' | 'declining' | null;
  }>();

  for (const r of _memCache.records) {
    const entry = byCause.get(r.causeCode) || {
      causeCode: r.causeCode,
      causeLabel: r.causeLabel,
      category: r.category,
      totalDeaths: 0,
      totalRate: 0,
      count: 0,
      trend: r.trend,
    };
    entry.totalDeaths += r.deaths;
    entry.totalRate += r.crudeRate;
    entry.count += 1;
    // Use most recent trend
    if (r.trend) entry.trend = r.trend;
    byCause.set(r.causeCode, entry);
  }

  return Array.from(byCause.values())
    .map(e => ({
      causeCode: e.causeCode,
      causeLabel: e.causeLabel,
      category: e.category,
      totalDeaths: e.totalDeaths,
      avgRate: Math.round((e.totalRate / e.count) * 100) / 100,
      trend: e.trend,
    }))
    .sort((a, b) => b.totalDeaths - a.totalDeaths)
    .slice(0, n);
}

/**
 * Replace the in-memory cache (called by cron route).
 */
export async function setCdcWonderCache(data: CdcWonderCacheData): Promise<void> {
  const prevCounts = _memCache ? { recordCount: _memCache._meta.recordCount } : null;
  const newCounts = { recordCount: data._meta.recordCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[CDC WONDER Cache] In-memory updated: ${data._meta.recordCount} records`);
  saveToDisk();
  await saveCacheToBlob('cache/cdc-wonder.json', data);
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isCdcWonderBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[CDC WONDER Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCdcWonderBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCDCWonderCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    recordCount: _memCache._meta.recordCount,
    categoryCounts: _memCache._meta.categoryCounts,
    yearRange: _memCache._meta.yearRange,
    lastDelta: _lastDelta,
  };
}
