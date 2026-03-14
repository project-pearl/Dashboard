/**
 * DOL OSHA Water/Wastewater Safety Cache — Server-side state-keyed cache for
 * OSHA inspection and violation data at water/wastewater treatment facilities.
 *
 * Populated by /api/cron/rebuild-osha-water.
 * Source: https://enforcedata.dol.gov/
 *
 * State-keyed cache: Record<string, OshaInspection[]> keyed by two-letter
 * state abbreviation. Nearby lookup uses grid neighbor search.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OshaInspection {
  activityNr: string;
  establishmentName: string;
  state: string;
  sic: string;
  naicsCode: string;
  inspectionType: string;
  openDate: string;
  closeDate: string | null;
  violationCount: number;
  seriousCount: number;
  willfulCount: number;
  penaltyTotal: number;
  lat: number;
  lng: number;
}

interface OshaWaterCacheMeta {
  built: string;
  inspectionCount: number;
  stateCount: number;
  totalPenalties: number;
}

interface OshaWaterCacheData {
  _meta: OshaWaterCacheMeta;
  states: Record<string, OshaInspection[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: OshaWaterCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'osha-water.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.states) return false;
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.log(`[OSHA Water Cache] Loaded from disk (${data.meta.inspectionCount} inspections, built ${data.meta.built})`);
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
    const file = path.join(dir, 'osha-water.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, states: _memCache.states });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[OSHA Water Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; states: any }>('cache/osha-water.json');
  if (data?.meta && data?.states) {
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'blob';
    console.warn(`[OSHA Water Cache] Loaded from blob (${data.meta.inspectionCount} inspections)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getOshaWaterByState(state: string): OshaInspection[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.states[state.toUpperCase()] || [];
}

export function getOshaWaterNearby(lat: number, lng: number): OshaInspection[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const keys = neighborKeys(lat, lng);
  const keySet = new Set(keys);
  const results: OshaInspection[] = [];
  for (const inspections of Object.values(_memCache.states)) {
    for (const insp of inspections) {
      if (keySet.has(gridKey(insp.lat, insp.lng))) {
        results.push(insp);
      }
    }
  }
  return results;
}

export async function setOshaWaterCache(data: OshaWaterCacheData): Promise<void> {
  const prevCounts = _memCache
    ? {
        inspectionCount: _memCache._meta.inspectionCount,
        stateCount: _memCache._meta.stateCount,
        totalPenalties: _memCache._meta.totalPenalties,
      }
    : null;
  const newCounts = {
    inspectionCount: data._meta.inspectionCount,
    stateCount: data._meta.stateCount,
    totalPenalties: data._meta.totalPenalties,
  };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[OSHA Water Cache] Updated: ${data._meta.inspectionCount} inspections, ` +
    `${data._meta.stateCount} states, $${data._meta.totalPenalties.toLocaleString()} penalties`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/osha-water.json', { meta: data._meta, states: data.states });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isOshaWaterBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[OSHA Water Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setOshaWaterBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getOshaWaterCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    inspectionCount: _memCache._meta.inspectionCount,
    stateCount: _memCache._meta.stateCount,
    totalPenalties: _memCache._meta.totalPenalties,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
