/**
 * Seismic Cache — USGS Earthquake Hazards Program data (M2.5+ past day).
 *
 * Populated by /api/cron/rebuild-seismic (every 30 minutes).
 * Source: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SeismicEvent {
  id: string;
  mag: number;
  lat: number;
  lng: number;
  place: string;
  time: number;       // epoch ms
  depth: number;      // km
  url: string;
}

interface SeismicCacheData {
  _meta: { built: string; eventCount: number };
  events: SeismicEvent[];
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: SeismicCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'seismic.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.events) return false;
    _memCache = { _meta: data.meta, events: data.events };
    _cacheSource = 'disk';
    console.log(`[Seismic Cache] Loaded from disk (${data.meta.eventCount} events, built ${data.meta.built})`);
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
    const file = path.join(dir, 'seismic.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, events: _memCache.events });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[Seismic Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; events: any }>('cache/seismic.json');
  if (data?.meta && data?.events) {
    _memCache = { _meta: data.meta, events: data.events };
    _cacheSource = 'blob';
    console.warn(`[Seismic Cache] Loaded from blob (${data.meta.eventCount} events)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getSeismicAll(): SeismicEvent[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.events;
}

export async function setSeismicCache(data: SeismicCacheData): Promise<void> {
  const prevCounts = _memCache ? { eventCount: _memCache._meta.eventCount } : null;
  const newCounts = { eventCount: data._meta.eventCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[Seismic Cache] Updated: ${data._meta.eventCount} events`);
  saveToDisk();
  await saveCacheToBlob('cache/seismic.json', { meta: data._meta, events: data.events });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isSeismicBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Seismic Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setSeismicBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getSeismicCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    eventCount: _memCache._meta.eventCount,
    lastDelta: _lastDelta,
  };
}
