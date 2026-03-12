/**
 * USBR Reservoir Cache — flat array cache for Bureau of Reclamation RISE reservoir levels.
 *
 * Populated by /api/cron/rebuild-usbr (every 6 hours at :15).
 * Source: https://data.usbr.gov/rise/api/
 * Persisted to disk + Vercel Blob for cold-start survival.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReservoirReading {
  locationId: number;
  locationName: string;
  lat: number;
  lng: number;
  state: string | null;
  storageAcreFt: number | null;
  capacityAcreFt: number | null;
  pctFull: number | null;
  elevationFt: number | null;
  inflowCfs: number | null;
  releaseCfs: number | null;
  timestamp: string;
}

interface UsbrCacheData {
  _meta: { built: string; reservoirCount: number };
  reservoirs: ReservoirReading[];
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: UsbrCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'usbr-reservoirs.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.reservoirs) return false;
    _memCache = { _meta: data.meta, reservoirs: data.reservoirs };
    _cacheSource = 'disk';
    console.log(`[USBR Cache] Loaded from disk (${data.meta.reservoirCount} reservoirs, built ${data.meta.built})`);
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
    const file = path.join(dir, 'usbr-reservoirs.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ meta: _memCache._meta, reservoirs: _memCache.reservoirs }), 'utf-8');
    console.log(`[USBR Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; reservoirs: any }>('cache/usbr-reservoirs.json');
  if (data?.meta && data?.reservoirs) {
    _memCache = { _meta: data.meta, reservoirs: data.reservoirs };
    _cacheSource = 'blob';
    console.warn(`[USBR Cache] Loaded from blob (${data.meta.reservoirCount} reservoirs)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get all reservoir readings. */
export function getUsbrAll(): ReservoirReading[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.reservoirs;
}

/** Set the full reservoir cache. */
export async function setUsbrCache(data: UsbrCacheData): Promise<void> {
  const prevCounts = _memCache ? { reservoirCount: _memCache._meta.reservoirCount } : null;
  const newCounts = { reservoirCount: data._meta.reservoirCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[USBR Cache] Updated: ${data._meta.reservoirCount} reservoirs`);
  saveToDisk();
  await saveCacheToBlob('cache/usbr-reservoirs.json', { meta: data._meta, reservoirs: data.reservoirs });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isUsbrBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[USBR Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setUsbrBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getUsbrCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    reservoirCount: _memCache._meta.reservoirCount,
    lastDelta: _lastDelta,
  };
}
