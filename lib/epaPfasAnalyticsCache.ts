/**
 * EPA PFAS Analytics Cache — ECHO PFAS facility data beyond UCMR5.
 *
 * Populated by /api/cron/rebuild-epa-pfas-analytics (daily cron).
 * Pulls PFAS facility data from EPA ECHO REST API.
 * State-keyed for state-level lookups.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PfasAnalyte {
  name: string;
  concentrationPpt: number;
  detectionLimit: number;
  sampleDate: string;
  exceedsAdvisory: boolean;
}

export interface EpaPfasFacility {
  registryId: string;
  facilityName: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  pfasAnalytes: PfasAnalyte[];
  nearMilitary: boolean;
  militaryDistanceMi: number | null;
}

export interface EpaPfasStateData {
  facilities: EpaPfasFacility[];
  sampleCount: number;
  exceedanceCount: number;
  avgConcentration: number;
  maxConcentration: number;
  analytesBreakdown: Record<string, number>;
}

export interface EpaPfasCacheMeta {
  built: string;
  facilityCount: number;
  stateCount: number;
  totalExceedances: number;
  totalSamples: number;
}

interface EpaPfasCacheData {
  _meta: EpaPfasCacheMeta;
  states: Record<string, EpaPfasStateData>;
}

export interface EpaPfasLookupResult {
  facilities: EpaPfasFacility[];
  sampleCount: number;
  exceedanceCount: number;
  avgConcentration: number;
  maxConcentration: number;
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: EpaPfasCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'epa-pfas-analytics.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.states) return false;
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.log(`[EPA PFAS Cache] Loaded from disk (${_memCache._meta.facilityCount} facilities, ${_memCache._meta.stateCount} states)`);
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
    fs.writeFileSync(path.join(dir, 'epa-pfas-analytics.json'), payload, 'utf-8');
    console.log(`[EPA PFAS Cache] Saved to disk (${(Buffer.byteLength(payload) / 1024 / 1024).toFixed(1)}MB)`);
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
  const data = await loadCacheFromBlob<{ meta: any; states: any }>('cache/epa-pfas-analytics.json');
  if (data?.meta && data?.states) {
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.warn(`[EPA PFAS Cache] Loaded from blob (${data.meta.facilityCount} facilities)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getEpaPfasAnalytics(state: string): EpaPfasLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const sd = _memCache.states[state.toUpperCase()];
  if (!sd || sd.facilities.length === 0) return null;
  return {
    facilities: sd.facilities, sampleCount: sd.sampleCount,
    exceedanceCount: sd.exceedanceCount, avgConcentration: sd.avgConcentration,
    maxConcentration: sd.maxConcentration, cacheBuilt: _memCache._meta.built, fromCache: true,
  };
}

export function getEpaPfasAllStates(): Record<string, EpaPfasStateData> | null {
  ensureDiskLoaded();
  return _memCache?.states ?? null;
}

export function getEpaPfasExceedances(): EpaPfasFacility[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const result: EpaPfasFacility[] = [];
  for (const sd of Object.values(_memCache.states)) {
    for (const f of sd.facilities) {
      if (f.pfasAnalytes.some(a => a.exceedsAdvisory)) result.push(f);
    }
  }
  return result;
}

export async function setEpaPfasAnalyticsCache(data: EpaPfasCacheData): Promise<void> {
  const prev = _memCache ? { facilityCount: _memCache._meta.facilityCount, stateCount: _memCache._meta.stateCount, totalExceedances: _memCache._meta.totalExceedances } : null;
  const next = { facilityCount: data._meta.facilityCount, stateCount: data._meta.stateCount, totalExceedances: data._meta.totalExceedances };
  _lastDelta = computeCacheDelta(prev, next, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[EPA PFAS Cache] Updated: ${data._meta.facilityCount} facilities, ${data._meta.totalExceedances} exceedances`);
  saveToDisk();
  await saveCacheToBlob('cache/epa-pfas-analytics.json', { meta: data._meta, states: data.states });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isEpaPfasBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[EPA PFAS Cache] Auto-clearing stale build lock');
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setEpaPfasBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getEpaPfasCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true, source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built, facilityCount: _memCache._meta.facilityCount,
    stateCount: _memCache._meta.stateCount, totalExceedances: _memCache._meta.totalExceedances,
    totalSamples: _memCache._meta.totalSamples, lastDelta: _lastDelta,
  };
}
