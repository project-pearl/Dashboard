/**
 * CDC NWSS Cache — Server-side cache for CDC National Wastewater Surveillance System data.
 *
 * Populated by /api/cron/rebuild-cdc-nwss (daily cron).
 * Pulls wastewater pathogen surveillance data from data.cdc.gov Socrata endpoint.
 * Indexed by state (no lat/lon — data is county FIPS-based).
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CdcNwssRecord {
  wwtpId: string;
  wwtpJurisdiction: string;
  countyFips: string;
  countyNames: string;
  populationServed: number;
  dateStart: string;
  dateEnd: string;
  ptc15d: number | null;
  detectProp15d: number | null;
  percentile: number | null;
}

export interface CdcNwssStateData {
  records: CdcNwssRecord[];
  counties: number;
  totalPopulationServed: number;
}

export interface CdcNwssCacheMeta {
  built: string;
  recordCount: number;
  stateCount: number;
  countyCount: number;
  totalPopulationServed: number;
}

interface CdcNwssCacheData {
  _meta: CdcNwssCacheMeta;
  states: Record<string, CdcNwssStateData>;
}

export interface CdcNwssLookupResult {
  records: CdcNwssRecord[];
  counties: number;
  totalPopulationServed: number;
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = 48 * 60 * 60 * 1000;

let _memCache: CdcNwssCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'cdc-nwss.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.states) return false;

    _memCache = {
      _meta: {
        built: data.meta.built,
        recordCount: data.meta.recordCount || 0,
        stateCount: data.meta.stateCount || 0,
        countyCount: data.meta.countyCount || 0,
        totalPopulationServed: data.meta.totalPopulationServed || 0,
      },
      states: data.states,
    };
    _cacheSource = 'disk';

    console.log(
      `[CDC NWSS Cache] Loaded from disk (${_memCache._meta.recordCount} records, ` +
      `${_memCache._meta.stateCount} states, built ${data.meta.built || 'unknown'})`
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
    const file = path.join(dir, 'cdc-nwss.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: _memCache._meta,
      states: _memCache.states,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[CDC NWSS Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.recordCount} records)`);
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
  const data = await loadCacheFromBlob<{ meta: any; states: any }>('cache/cdc-nwss.json');
  if (data?.meta && data?.states) {
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.warn(`[CDC NWSS Cache] Loaded from blob (${data.meta.recordCount} records)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up cached CDC NWSS data for a state abbreviation.
 */
export function getCdcNwssCache(state: string): CdcNwssLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;

  const stateData = _memCache.states[state.toUpperCase()];
  if (!stateData || stateData.records.length === 0) return null;

  return {
    records: stateData.records,
    counties: stateData.counties,
    totalPopulationServed: stateData.totalPopulationServed,
    cacheBuilt: _memCache._meta.built,
    fromCache: true,
  };
}

/**
 * Get all cached states (for national overview).
 */
export function getCdcNwssAllStates(): Record<string, CdcNwssStateData> | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.states;
}

/**
 * Replace the in-memory cache (called by cron route after fetching fresh data).
 */
export function setCdcNwssCache(data: CdcNwssCacheData): void {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  const m = data._meta;
  console.log(
    `[CDC NWSS Cache] In-memory updated: ${m.recordCount} records, ` +
    `${m.stateCount} states, ${m.countyCount} counties`
  );
  saveToDisk();
  saveCacheToBlob('cache/cdc-nwss.json', { meta: data._meta, states: data.states });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isCdcNwssBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[CDC NWSS Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCdcNwssBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCdcNwssCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    recordCount: _memCache._meta.recordCount,
    stateCount: _memCache._meta.stateCount,
    countyCount: _memCache._meta.countyCount,
    totalPopulationServed: _memCache._meta.totalPopulationServed,
  };
}
