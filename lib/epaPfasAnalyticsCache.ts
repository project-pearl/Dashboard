/**
 * EPA PFAS Analytics Cache — Server-side state-keyed cache for EPA PFAS
 * contamination analytics including facility-level analyte concentrations,
 * advisory exceedances, and military proximity correlations.
 *
 * Data source: EPA PFAS Analytic Tools / ECHO compliance data enriched
 * with DoD installation proximity analysis.
 *
 * Populated by /api/cron/rebuild-epa-pfas-analytics.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EpaPfasAnalyte {
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
  pfasAnalytes: EpaPfasAnalyte[];
  nearMilitary: boolean;
  militaryDistanceMi: number | null;
}

export interface EpaPfasStateData {
  facilities: EpaPfasFacility[];
  sampleCount: number;
  exceedanceCount: number;
  avgConcentration: number;
  maxConcentration: number;
}

interface EpaPfasAnalyticsMeta {
  built: string;
  facilityCount: number;
  statesCovered: number;
  totalExceedances: number;
}

interface EpaPfasAnalyticsCacheData {
  _meta: EpaPfasAnalyticsMeta;
  states: Record<string, EpaPfasStateData>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: EpaPfasAnalyticsCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ─────────────────────────────────────────────────────────

const DISK_FILE = 'epa-pfas-analytics.json';
const BLOB_KEY = 'cache/epa-pfas-analytics.json';

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
    console.log(`[EPA PFAS Analytics Cache] Loaded from disk (${data.meta.facilityCount} facilities, built ${data.meta.built})`);
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
    console.log(`[EPA PFAS Analytics Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: EpaPfasAnalyticsMeta; states: Record<string, EpaPfasStateData> }>(BLOB_KEY);
  if (data?.meta && data?.states) {
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'blob';
    console.warn(`[EPA PFAS Analytics Cache] Loaded from blob (${data.meta.facilityCount} facilities)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getEpaPfasAnalytics(state: string): EpaPfasStateData | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.states[state.toUpperCase()] || null;
}

export function getEpaPfasAllStates(): Record<string, EpaPfasStateData> {
  ensureDiskLoaded();
  if (!_memCache) return {};
  return _memCache.states;
}

export function getEpaPfasExceedances(): EpaPfasFacility[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const result: EpaPfasFacility[] = [];
  for (const stateData of Object.values(_memCache.states)) {
    for (const fac of stateData.facilities) {
      if (fac.pfasAnalytes.some(a => a.exceedsAdvisory)) {
        result.push(fac);
      }
    }
  }
  return result;
}

// ── Setter ───────────────────────────────────────────────────────────────────

export async function setEpaPfasAnalyticsCache(data: EpaPfasAnalyticsCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { facilityCount: _memCache._meta.facilityCount, statesCovered: _memCache._meta.statesCovered }
    : null;
  const newCounts = { facilityCount: data._meta.facilityCount, statesCovered: data._meta.statesCovered };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[EPA PFAS Analytics Cache] Updated: ${data._meta.facilityCount} facilities, ` +
    `${data._meta.statesCovered} states, ${data._meta.totalExceedances} exceedances`,
  );
  saveToDisk();
  await saveCacheToBlob(BLOB_KEY, { meta: data._meta, states: data.states });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isEpaPfasAnalyticsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[EPA PFAS Analytics Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setEpaPfasAnalyticsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getEpaPfasAnalyticsCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    facilityCount: _memCache._meta.facilityCount,
    statesCovered: _memCache._meta.statesCovered,
    totalExceedances: _memCache._meta.totalExceedances,
    lastDelta: _lastDelta,
  };
}
