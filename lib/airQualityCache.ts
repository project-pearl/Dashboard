/**
 * Air Quality Cache — state-level AQ context for Sentinel.
 *
 * Populated by /api/cron/rebuild-air-quality.
 * Source: Open-Meteo Air Quality API (no key required).
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

export interface AirQualityStateReading {
  state: string;
  lat: number;
  lng: number;
  timestamp: string | null;
  provider: 'airnow' | 'open-meteo';
  monitorCount: number;
  nearestMonitorDistanceMi: number | null;
  confidence: 'high' | 'medium' | 'low';
  impactedCounty: string | null;
  impactedCountyFips: string | null;
  impactedCounties: Array<{ name: string; fips: string | null }>;
  impactedZips: string[];
  impactedZipCount: number;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  ozone: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
}

export interface AqiTrendSnapshot {
  timestamp: string;
  stateReadings: Record<string, { usAqi: number | null; pm25: number | null; ozone: number | null }>;
}

interface AirQualityCacheData {
  _meta: {
    built: string;
    stateCount: number;
    provider: string;
  };
  states: Record<string, AirQualityStateReading>;
}

let _memCache: AirQualityCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;
let _diskLoaded = false;
let _blobChecked = false;
let _buildInProgress = false;
let _buildStartedAt = 0;

const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
const BLOB_KEY = 'cache/air-quality.json';
const AQ_TREND_BLOB_KEY = 'cache/aq-trend.json';
const AQ_TREND_DISK_FILE = 'aq-trend.json';
const AQ_TREND_RING_SIZE = 168; // 7 days at hourly cron

let _aqTrendHistory: AqiTrendSnapshot[] = [];
let _aqTrendDiskLoaded = false;
let _aqTrendBlobChecked = false;

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'air-quality.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.states) return false;
    _memCache = { _meta: data.meta, states: data.states };
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
    const file = path.join(dir, 'air-quality.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, states: _memCache.states });
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

export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_memCache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<{ meta: any; states: any }>(BLOB_KEY);
  if (data?.meta && data?.states) {
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'blob';
  }
}

export function getAirQualityAllStates(): AirQualityStateReading[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return Object.values(_memCache.states);
}

export function getAirQualityForState(stateAbbr: string): AirQualityStateReading | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.states[stateAbbr.toUpperCase()] ?? null;
}

export async function setAirQualityCache(data: AirQualityCacheData): Promise<void> {
  const prevCounts = _memCache ? { stateCount: _memCache._meta.stateCount } : null;
  const newCounts = { stateCount: data._meta.stateCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  saveToDisk();
  await saveCacheToBlob(BLOB_KEY, { meta: data._meta, states: data.states });
}

export function isAirQualityBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setAirQualityBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

export function getAirQualityCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    stateCount: _memCache._meta.stateCount,
    provider: _memCache._meta.provider,
    lastDelta: _lastDelta,
  };
}

/* ------------------------------------------------------------------ */
/*  AQI Trend History                                                  */
/* ------------------------------------------------------------------ */

function loadAqTrendFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', AQ_TREND_DISK_FILE);
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return false;
    _aqTrendHistory = data;
    return true;
  } catch {
    return false;
  }
}

function saveAqTrendToDisk(): void {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    const file = path.join(dir, AQ_TREND_DISK_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(_aqTrendHistory), 'utf-8');
  } catch {
    // non-fatal
  }
}

export async function ensureAqTrendWarmed(): Promise<void> {
  if (!_aqTrendDiskLoaded) {
    _aqTrendDiskLoaded = true;
    loadAqTrendFromDisk();
  }
  if (_aqTrendHistory.length > 0) return;
  if (_aqTrendBlobChecked) return;
  _aqTrendBlobChecked = true;
  const data = await loadCacheFromBlob<AqiTrendSnapshot[]>(AQ_TREND_BLOB_KEY);
  if (Array.isArray(data) && data.length > 0) {
    _aqTrendHistory = data;
    saveAqTrendToDisk();
  }
}

export async function appendAqiTrend(snapshot: AqiTrendSnapshot): Promise<void> {
  _aqTrendHistory.push(snapshot);
  if (_aqTrendHistory.length > AQ_TREND_RING_SIZE) {
    _aqTrendHistory.splice(0, _aqTrendHistory.length - AQ_TREND_RING_SIZE);
  }
  saveAqTrendToDisk();
  await saveCacheToBlob(AQ_TREND_BLOB_KEY, _aqTrendHistory);
}

export function getAqiTrendHistory(): AqiTrendSnapshot[] {
  if (!_aqTrendDiskLoaded) {
    _aqTrendDiskLoaded = true;
    loadAqTrendFromDisk();
  }
  return _aqTrendHistory;
}
