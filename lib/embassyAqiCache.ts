/**
 * Embassy AQI Cache — real-time air quality for military installations & embassies
 * via the WAQI/AQICN API (State Department StateAir network).
 *
 * Populated by /api/cron/rebuild-embassy-aqi (hourly).
 * Source: https://api.waqi.info
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface EmbassyAqiReading {
  facilityId: string;
  facilityName: string;
  lat: number;
  lng: number;
  region: string;
  type: 'installation' | 'embassy';
  // WAQI data
  aqi: number | null;
  dominantPol: string | null;
  pm25: number | null;
  pm10: number | null;
  o3: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  // Station metadata
  stationName: string | null;
  stationDistanceMi: number | null;
  // Time
  timestamp: string | null;
  fetchedAt: string;
  // 3-day forecast
  forecast: Array<{ day: string; pm25Avg: number | null; pm25Max: number | null; o3Avg: number | null }>;
}

export interface EmbassyAqiTrendSnapshot {
  timestamp: string;
  facilityCount: number;
  avgAqi: number | null;
  maxAqi: number | null;
  byFacility: Record<string, { aqi: number | null; dominantPol: string | null }>;
}

/* ------------------------------------------------------------------ */
/*  In-Memory Cache State                                              */
/* ------------------------------------------------------------------ */

let _memCache: Record<string, EmbassyAqiReading> | null = null;
let _cacheBuilt: string | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;
let _diskLoaded = false;
let _blobChecked = false;
let _buildInProgress = false;
let _buildStartedAt = 0;

const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
const BLOB_KEY = 'cache/embassy-aqi.json';
const TREND_BLOB_KEY = 'cache/embassy-aqi-trend.json';
const TREND_DISK_FILE = 'embassy-aqi-trend.json';
const TREND_RING_SIZE = 168; // 7 days at hourly intervals

/* ------------------------------------------------------------------ */
/*  Trend History State                                                */
/* ------------------------------------------------------------------ */

let _trendHistory: EmbassyAqiTrendSnapshot[] = [];
let _trendDiskLoaded = false;
let _trendBlobChecked = false;

/* ------------------------------------------------------------------ */
/*  Disk Persistence                                                   */
/* ------------------------------------------------------------------ */

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'embassy-aqi.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.built || !data?.readings) return false;
    _memCache = data.readings;
    _cacheBuilt = data.built;
    _cacheSource = 'disk';
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
    const file = path.join(dir, 'embassy-aqi.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ built: _cacheBuilt, readings: _memCache });
    fs.writeFileSync(file, payload, 'utf-8');
  } catch {
    // non-fatal
  }
}

function ensureDiskLoaded() {
  if (_diskLoaded) return;
  _diskLoaded = true;
  loadFromDisk();
}

/* ------------------------------------------------------------------ */
/*  Trend Disk Persistence                                             */
/* ------------------------------------------------------------------ */

function loadTrendFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', TREND_DISK_FILE);
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return false;
    _trendHistory = data;
    return true;
  } catch {
    return false;
  }
}

function saveTrendToDisk(): void {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    const file = path.join(dir, TREND_DISK_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(_trendHistory), 'utf-8');
  } catch {
    // non-fatal
  }
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_memCache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<{ built: string; readings: Record<string, EmbassyAqiReading> }>(BLOB_KEY);
  if (data?.built && data?.readings) {
    _memCache = data.readings;
    _cacheBuilt = data.built;
    _cacheSource = 'blob';
  }
}

export function getEmbassyAqiAll(): EmbassyAqiReading[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return Object.values(_memCache);
}

export function getEmbassyAqiForFacility(facilityId: string): EmbassyAqiReading | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache[facilityId] ?? null;
}

export function getEmbassyAqiByRegion(region: string): EmbassyAqiReading[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return Object.values(_memCache).filter(r => r.region === region);
}

export async function setEmbassyAqiCache(readings: Record<string, EmbassyAqiReading>, built: string): Promise<void> {
  const prevCount = _memCache ? Object.keys(_memCache).length : null;
  const newCount = Object.keys(readings).length;
  _lastDelta = computeCacheDelta(
    prevCount != null ? { facilityCount: prevCount } : null,
    { facilityCount: newCount },
    _cacheBuilt,
  );
  _memCache = readings;
  _cacheBuilt = built;
  _cacheSource = 'memory (cron)';
  saveToDisk();
  await saveCacheToBlob(BLOB_KEY, { built, readings });
}

export function isEmbassyAqiBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setEmbassyAqiBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

export function getEmbassyAqiCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  const readings = Object.values(_memCache);
  const withAqi = readings.filter(r => r.aqi != null).length;
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _cacheBuilt,
    facilityCount: readings.length,
    withAqi,
    lastDelta: _lastDelta,
  };
}

/* ------------------------------------------------------------------ */
/*  Trend History API                                                  */
/* ------------------------------------------------------------------ */

export async function ensureTrendWarmed(): Promise<void> {
  if (!_trendDiskLoaded) {
    _trendDiskLoaded = true;
    loadTrendFromDisk();
  }
  if (_trendHistory.length > 0) return;
  if (_trendBlobChecked) return;
  _trendBlobChecked = true;
  const data = await loadCacheFromBlob<EmbassyAqiTrendSnapshot[]>(TREND_BLOB_KEY);
  if (Array.isArray(data) && data.length > 0) {
    _trendHistory = data;
    saveTrendToDisk();
  }
}

export async function appendEmbassyAqiTrend(snapshot: EmbassyAqiTrendSnapshot): Promise<void> {
  _trendHistory.push(snapshot);
  if (_trendHistory.length > TREND_RING_SIZE) {
    _trendHistory.splice(0, _trendHistory.length - TREND_RING_SIZE);
  }
  saveTrendToDisk();
  await saveCacheToBlob(TREND_BLOB_KEY, _trendHistory);
}

export function getEmbassyAqiTrendHistory(): EmbassyAqiTrendSnapshot[] {
  if (!_trendDiskLoaded) {
    _trendDiskLoaded = true;
    loadTrendFromDisk();
  }
  return _trendHistory;
}
