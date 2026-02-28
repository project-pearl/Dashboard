/**
 * USAspending Cache — Server-side state-keyed cache for federal water spending data.
 *
 * Populated by /api/cron/rebuild-usaspending (weekly Sunday cron).
 * No grid indexing — data is per-state from USAspending.gov CFDA-level aggregates.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface USAsProgramData {
  cfda: string;                // e.g. "66.458"
  programName: string;         // e.g. "CWSRF"
  totalObligated: number;      // 5-FY sum
  currentFyObligated: number;  // most recent completed FY
  awardCount: number;
  bilAmount: number;           // IIJA/BIL subset (def_codes Z/1)
  topRecipients: { name: string; amount: number }[];
  fyTrend: { fy: number; amount: number }[];  // FY21-FY25
}

export interface USAsStateData {
  stateAbbr: string;
  programs: USAsProgramData[];
  totalEpaWater: number;       // sum all CFDAs
  totalBil: number;            // sum BIL across programs
  currentFyTotal: number;
  awardCount: number;
  srfFederal: number;          // 66.458 + 66.468
  srfMatchRequired: number;    // srfFederal * 0.25 (20% statutory match)
  bilMatchRequired: number;    // bilAmount * 0.111 (10% match approx)
}

export interface USAsCacheData {
  _meta: {
    built: string;
    statesProcessed: string[];
    stateCount: number;
    fyRange: string;
  };
  byState: Record<string, USAsStateData>;
  nationalTrend: { fy: number; cwsrf: number; dwsrf: number; cwa319: number; cwa106: number; bil: number }[];
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: USAsCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'usaspending.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?._meta || !data?.byState) return false;

    _memCache = data;
    _cacheSource = 'disk';

    console.log(
      `[USAs Cache] Loaded from disk (${data._meta.stateCount} states, built ${data._meta.built || 'unknown'})`
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
    const file = path.join(dir, 'usaspending.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify(_memCache);
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[USAs Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.stateCount} states)`);
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
  const data = await loadCacheFromBlob<USAsCacheData>('cache/usaspending.json');
  if (data?._meta && data?.byState) {
    _memCache = data;
    _cacheSource = 'disk';
    console.warn(`[USAs Cache] Loaded from blob (${data._meta.stateCount} states)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getUSAsStateData(state: string): USAsStateData | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.byState[state.toUpperCase()] || null;
}

export function getUSAsNationalTrend(): USAsCacheData['nationalTrend'] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.nationalTrend;
}

export async function setUSAsCache(data: USAsCacheData): Promise<void> {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[USAs Cache] In-memory updated: ${data._meta.stateCount} states, ` +
    `FY range ${data._meta.fyRange}`
  );
  saveToDisk();
  await saveCacheToBlob('cache/usaspending.json', data);
}

export function getUSAsCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    stateCount: _memCache._meta.stateCount,
    statesProcessed: _memCache._meta.statesProcessed,
    fyRange: _memCache._meta.fyRange,
    nationalTrendYears: _memCache.nationalTrend?.length || 0,
  };
}

// ── Build Lock ──────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 min — auto-clear stale locks

export function isUSAsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[USAs Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setUSAsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}
