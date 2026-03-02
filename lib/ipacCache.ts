/**
 * IPaC Cache — Server-side state-level cache for USFWS Endangered Species listings.
 *
 * Populated by /api/cron/rebuild-ipac (weekly Sunday).
 * State-level cache (not spatial grid) — keyed by state abbreviation.
 * Source: ECOS species-by-state listings.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface IpacStateData {
  state: string;
  totalListed: number;
  endangered: number;
  threatened: number;
  candidate: number;
  aquaticSpecies: string[];    // names of aquatic T&E species
}

interface IpacCacheData {
  _meta: { built: string; stateCount: number };
  states: Record<string, IpacStateData>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: IpacCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'ipac.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.states) return false;
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.log(`[IPaC Cache] Loaded from disk (${data.meta.stateCount} states, built ${data.meta.built})`);
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
    const file = path.join(dir, 'ipac.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, states: _memCache.states });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[IPaC Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; states: any }>('cache/ipac.json');
  if (data?.meta && data?.states) {
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'blob';
    console.warn(`[IPaC Cache] Loaded from blob (${data.meta.stateCount} states)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getIpacByState(stateCode: string): IpacStateData | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.states[stateCode.toUpperCase()] ?? null;
}

export function getIpacAll(): Record<string, IpacStateData> {
  ensureDiskLoaded();
  if (!_memCache) return {};
  return _memCache.states;
}

export async function setIpacCache(data: IpacCacheData): Promise<void> {
  const prevCounts = _memCache ? { stateCount: _memCache._meta.stateCount } : null;
  const newCounts = { stateCount: data._meta.stateCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[IPaC Cache] Updated: ${data._meta.stateCount} states`);
  saveToDisk();
  await saveCacheToBlob('cache/ipac.json', { meta: data._meta, states: data.states });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isIpacBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[IPaC Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setIpacBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getIpacCacheStatus() {
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
