/**
 * USGS Volcano Observatory Cache — Server-side flat cache for USGS Volcano
 * Hazards Program alert data.
 *
 * Populated by /api/cron/rebuild-volcano.
 * Source: https://volcanoes.usgs.gov/vhp/
 *
 * Flat cache: small dataset stored as a simple array of alerts.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface VolcanoAlert {
  volcanoId: string;
  volcanoName: string;
  state: string;
  alertLevel: 'normal' | 'advisory' | 'watch' | 'warning';
  colorCode: 'green' | 'yellow' | 'orange' | 'red';
  lat: number;
  lng: number;
  elevation: number;
  volcanoType: string;
  lastEruption: string | null;
  observatoryName: string;
  updateTime: string;
}

interface VolcanoCacheMeta {
  built: string;
  alertCount: number;
  elevatedCount: number;
}

interface VolcanoCacheData {
  _meta: VolcanoCacheMeta;
  alerts: VolcanoAlert[];
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: VolcanoCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'volcano.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.alerts) return false;
    _memCache = { _meta: data.meta, alerts: data.alerts };
    _cacheSource = 'disk';
    console.log(`[Volcano Cache] Loaded from disk (${data.meta.alertCount} alerts, built ${data.meta.built})`);
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
    const file = path.join(dir, 'volcano.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, alerts: _memCache.alerts });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[Volcano Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; alerts: any }>('cache/volcano.json');
  if (data?.meta && data?.alerts) {
    _memCache = { _meta: data.meta, alerts: data.alerts };
    _cacheSource = 'blob';
    console.warn(`[Volcano Cache] Loaded from blob (${data.meta.alertCount} alerts)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getAllVolcanoAlerts(): VolcanoAlert[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.alerts;
}

export function getVolcanoAlertsByState(state: string): VolcanoAlert[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const upper = state.toUpperCase();
  return _memCache.alerts.filter(a => a.state === upper);
}

export async function setVolcanoCache(data: VolcanoCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { alertCount: _memCache._meta.alertCount, elevatedCount: _memCache._meta.elevatedCount }
    : null;
  const newCounts = { alertCount: data._meta.alertCount, elevatedCount: data._meta.elevatedCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[Volcano Cache] Updated: ${data._meta.alertCount} alerts, ` +
    `${data._meta.elevatedCount} elevated`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/volcano.json', { meta: data._meta, alerts: data.alerts });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isVolcanoBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Volcano Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setVolcanoBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getVolcanoCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    alertCount: _memCache._meta.alertCount,
    elevatedCount: _memCache._meta.elevatedCount,
    lastDelta: _lastDelta,
  };
}
