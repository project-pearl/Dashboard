/**
 * Dam Cache — USACE National Inventory of Dams (NID) high-hazard dam data.
 *
 * Populated by /api/cron/rebuild-dams (daily).
 * Source: https://nid.sec.usace.army.mil/api/nation/dams
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DamRecord {
  id: string;
  name: string;
  lat: number;
  lng: number;
  state: string;
  hazard: string;
  height: number | null;        // feet
  storageAcreFt: number | null;
  damType: string | null;
  conditionAssessment: string | null;
}

interface DamCacheData {
  _meta: { built: string; damCount: number };
  dams: DamRecord[];
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: DamCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'dams.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.dams) return false;
    _memCache = { _meta: data.meta, dams: data.dams };
    _cacheSource = 'disk';
    console.log(`[Dam Cache] Loaded from disk (${data.meta.damCount} dams, built ${data.meta.built})`);
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
    const file = path.join(dir, 'dams.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, dams: _memCache.dams });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[Dam Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; dams: any }>('cache/dams.json');
  if (data?.meta && data?.dams) {
    _memCache = { _meta: data.meta, dams: data.dams };
    _cacheSource = 'blob';
    console.warn(`[Dam Cache] Loaded from blob (${data.meta.damCount} dams)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getDamAll(): DamRecord[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.dams;
}

export function getDamsByState(stateCode: string): DamRecord[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.dams.filter(d => d.state === stateCode.toUpperCase());
}

export async function setDamCache(data: DamCacheData): Promise<void> {
  const prevCounts = _memCache ? { damCount: _memCache._meta.damCount } : null;
  const newCounts = { damCount: data._meta.damCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[Dam Cache] Updated: ${data._meta.damCount} dams`);
  saveToDisk();
  await saveCacheToBlob('cache/dams.json', { meta: data._meta, dams: data.dams });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isDamBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Dam Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setDamBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getDamCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    damCount: _memCache._meta.damCount,
    lastDelta: _lastDelta,
  };
}
