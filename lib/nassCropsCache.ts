/**
 * USDA NASS Crop Acreage Cache — Server-side state-keyed cache for
 * USDA National Agricultural Statistics Service crop planting,
 * harvest, yield, and irrigation data.
 *
 * Populated by /api/cron/rebuild-nass-crops.
 * Source: https://quickstats.nass.usda.gov/api
 *
 * State-keyed cache: Record<string, NassCropRecord[]> keyed by
 * two-letter state abbreviation. Nearby lookup uses grid neighbor search.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NassCropRecord {
  state: string;
  county: string;
  commodity: string;
  acresPlanted: number | null;
  acresHarvested: number | null;
  yieldPerAcre: number | null;
  irrigatedPct: number | null;
  year: number;
  lat: number;
  lng: number;
}

interface NassCropsCacheMeta {
  built: string;
  recordCount: number;
  stateCount: number;
  totalAcres: number;
}

interface NassCropsCacheData {
  _meta: NassCropsCacheMeta;
  states: Record<string, NassCropRecord[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: NassCropsCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'nass-crops.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.states) return false;
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.log(`[NASS Crops Cache] Loaded from disk (${data.meta.recordCount} records, built ${data.meta.built})`);
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
    const file = path.join(dir, 'nass-crops.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, states: _memCache.states });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[NASS Crops Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; states: any }>('cache/nass-crops.json');
  if (data?.meta && data?.states) {
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'blob';
    console.warn(`[NASS Crops Cache] Loaded from blob (${data.meta.recordCount} records)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getNassCropsByState(state: string): NassCropRecord[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.states[state.toUpperCase()] || [];
}

export function getNassCropsNearby(lat: number, lng: number): NassCropRecord[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const keys = neighborKeys(lat, lng);
  const keySet = new Set(keys);
  const results: NassCropRecord[] = [];
  for (const records of Object.values(_memCache.states)) {
    for (const rec of records) {
      if (keySet.has(gridKey(rec.lat, rec.lng))) {
        results.push(rec);
      }
    }
  }
  return results;
}

export async function setNassCropsCache(data: NassCropsCacheData): Promise<void> {
  const prevCounts = _memCache
    ? {
        recordCount: _memCache._meta.recordCount,
        stateCount: _memCache._meta.stateCount,
        totalAcres: _memCache._meta.totalAcres,
      }
    : null;
  const newCounts = {
    recordCount: data._meta.recordCount,
    stateCount: data._meta.stateCount,
    totalAcres: data._meta.totalAcres,
  };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[NASS Crops Cache] Updated: ${data._meta.recordCount} records, ` +
    `${data._meta.stateCount} states, ${data._meta.totalAcres.toLocaleString()} total acres`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/nass-crops.json', { meta: data._meta, states: data.states });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNassCropsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NASS Crops Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setNassCropsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getNassCropsCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    recordCount: _memCache._meta.recordCount,
    stateCount: _memCache._meta.stateCount,
    totalAcres: _memCache._meta.totalAcres,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
