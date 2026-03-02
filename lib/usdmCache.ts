/**
 * USDM Cache — Server-side cache for US Drought Monitor state-level statistics.
 *
 * Populated by /api/cron/rebuild-usdm (daily).
 * State-level cache (not spatial grid) — keyed by state abbreviation.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DroughtState {
  state: string;
  fips: string;
  date: string;
  none: number;    // % area with no drought
  d0: number;      // % abnormally dry
  d1: number;      // % moderate drought
  d2: number;      // % severe drought
  d3: number;      // % extreme drought
  d4: number;      // % exceptional drought
}

interface UsdmCacheData {
  _meta: { built: string; stateCount: number };
  states: Record<string, DroughtState>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: UsdmCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'usdm.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.states) return false;
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.log(`[USDM Cache] Loaded from disk (${data.meta.stateCount} states, built ${data.meta.built})`);
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
    const file = path.join(dir, 'usdm.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, states: _memCache.states });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[USDM Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; states: any }>('cache/usdm.json');
  if (data?.meta && data?.states) {
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'blob';
    console.warn(`[USDM Cache] Loaded from blob (${data.meta.stateCount} states)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getUsdmByState(stateCode: string): DroughtState | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.states[stateCode.toUpperCase()] ?? null;
}

export function getUsdmAll(): Record<string, DroughtState> {
  ensureDiskLoaded();
  if (!_memCache) return {};
  return _memCache.states;
}

export async function setUsdmCache(data: UsdmCacheData): Promise<void> {
  const prevCounts = _memCache ? { stateCount: _memCache._meta.stateCount } : null;
  const newCounts = { stateCount: data._meta.stateCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[USDM Cache] Updated: ${data._meta.stateCount} states`);
  saveToDisk();
  await saveCacheToBlob('cache/usdm.json', { meta: data._meta, states: data.states });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isUsdmBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[USDM Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setUsdmBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getUsdmCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    stateCount: _memCache._meta.stateCount,
    lastDelta: _lastDelta,
  };
}
