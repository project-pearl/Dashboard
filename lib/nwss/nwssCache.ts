/* ------------------------------------------------------------------ */
/*  CDC NWSS Pathogen Cache                                           */
/*                                                                    */
/*  Server-side cache for per-pathogen wastewater surveillance data.  */
/*  Stores normalized records, baselines, and detected anomalies.     */
/*                                                                    */
/*  Populated by /api/cron/nwss-poll (weekly Saturday + Wednesday).   */
/*  Follows the same disk + Vercel Blob pattern as all other caches.  */
/* ------------------------------------------------------------------ */

import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';
import { computeCacheDelta, type CacheDelta } from '../cacheUtils';
import type {
  NWSSCacheData, NWSSCacheMeta, NWSSRecord, NWSSSewershedBaseline,
  NWSSAnomaly, NWSSPollState, PathogenType, ALL_PATHOGENS,
} from './types';

const BLOB_PATH = 'cache/nwss-pathogen.json';
const DISK_FILE = 'nwss-pathogen.json';

/* ------------------------------------------------------------------ */
/*  Cache Singleton                                                   */
/* ------------------------------------------------------------------ */

let _memCache: NWSSCacheData | null = null;
let _cacheSource: 'disk' | 'blob' | 'memory (cron)' | null = null;
let _lastDelta: CacheDelta | null = null;

/* ------------------------------------------------------------------ */
/*  Disk Persistence                                                  */
/* ------------------------------------------------------------------ */

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', DISK_FILE);
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?._meta || !data?.records) return false;
    _memCache = data;
    _cacheSource = 'disk';
    console.log(
      `[NWSS Pathogen Cache] Loaded from disk (${data._meta.totalRecords} records, ` +
      `${data._meta.anomalyCount} anomalies, built ${data._meta.built || 'unknown'})`,
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
    const file = path.join(dir, DISK_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify(_memCache);
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[NWSS Pathogen Cache] Saved to disk (${sizeMB}MB)`);
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
  const data = await loadCacheFromBlob<NWSSCacheData>(BLOB_PATH);
  if (data?._meta && data?.records) {
    _memCache = data;
    _cacheSource = 'blob';
    console.warn(`[NWSS Pathogen Cache] Loaded from blob (${data._meta.totalRecords} records)`);
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

export function getNwssRecords(pathogen: PathogenType): NWSSRecord[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.records[pathogen] || [];
}

export function getNwssAllRecords(): Record<PathogenType, NWSSRecord[]> | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.records;
}

export function getNwssBaselines(): Record<string, NWSSSewershedBaseline> {
  ensureDiskLoaded();
  if (!_memCache) return {};
  return _memCache.baselines;
}

export function getNwssAnomalies(): NWSSAnomaly[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.anomalies;
}

export function getNwssPollState(): NWSSPollState | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.pollState;
}

/**
 * Replace the in-memory cache (called by cron route after fetching fresh data).
 */
export async function setNwssCache(data: NWSSCacheData): Promise<void> {
  const prevCounts = _memCache ? {
    totalRecords: _memCache._meta.totalRecords,
    anomalyCount: _memCache._meta.anomalyCount,
    sewershedCount: _memCache._meta.sewershedCount,
  } : null;
  const newCounts = {
    totalRecords: data._meta.totalRecords,
    anomalyCount: data._meta.anomalyCount,
    sewershedCount: data._meta.sewershedCount,
  };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);

  _memCache = data;
  _cacheSource = 'memory (cron)';
  const m = data._meta;
  console.log(
    `[NWSS Pathogen Cache] Updated: ${m.totalRecords} records, ` +
    `${m.sewershedCount} sewersheds, ${m.anomalyCount} anomalies`,
  );
  saveToDisk();
  await saveCacheToBlob(BLOB_PATH, data);
}

/* ------------------------------------------------------------------ */
/*  Build Lock                                                        */
/* ------------------------------------------------------------------ */

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNwssBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NWSS Pathogen Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setNwssBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

/* ------------------------------------------------------------------ */
/*  Status                                                            */
/* ------------------------------------------------------------------ */

export function getNwssCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    totalRecords: _memCache._meta.totalRecords,
    pathogenCounts: _memCache._meta.pathogenCounts,
    stateCount: _memCache._meta.stateCount,
    sewershedCount: _memCache._meta.sewershedCount,
    anomalyCount: _memCache._meta.anomalyCount,
    lastDelta: _lastDelta,
  };
}
