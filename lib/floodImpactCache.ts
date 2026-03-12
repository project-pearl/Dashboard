/**
 * Flood Impact Cache — Derived cache for flood infrastructure vulnerability.
 *
 * Populated by /api/cron/rebuild-flood-impact (daily cron).
 * Reads from existing NWPS, NWM, HEFS, FRS, and military-installations caches.
 * No external API calls — purely derived/composite.
 * Grid-indexed (0.1°) for spatial lookups.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, gridKey, neighborKeys, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NearbyInfrastructure {
  type: string;
  name: string;
  distanceMi: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface FloodImpactZone {
  gridKey: string;
  lat: number;
  lng: number;
  state: string;
  floodStatus: 'none' | 'minor' | 'moderate' | 'major';
  gaugesAtRisk: string[];
  nwmStreamflow: number[];
  nearbyInfrastructure: NearbyInfrastructure[];
  compositeRisk: number;
  populationExposed: number;
}

export interface FloodImpactCacheMeta {
  built: string;
  zoneCount: number;
  stateCount: number;
  highRiskCount: number;
  infrastructureAtRisk: number;
}

interface FloodImpactCacheData {
  _meta: FloodImpactCacheMeta;
  grid: Record<string, FloodImpactZone>;
  byState: Record<string, FloodImpactZone[]>;
}

export interface FloodImpactLookupResult {
  zones: FloodImpactZone[];
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: FloodImpactCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'flood-impact.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid, byState: data.byState || {} };
    _cacheSource = 'disk';
    console.log(`[Flood Impact Cache] Loaded from disk (${_memCache._meta.zoneCount} zones)`);
    return true;
  } catch { return false; }
}

function saveToDisk(): void {
  try {
    if (typeof process === 'undefined' || !_memCache) return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid, byState: _memCache.byState });
    fs.writeFileSync(path.join(dir, 'flood-impact.json'), payload, 'utf-8');
    console.log(`[Flood Impact Cache] Saved to disk (${(Buffer.byteLength(payload) / 1024 / 1024).toFixed(1)}MB)`);
  } catch { /* optional */ }
}

let _diskLoaded = false;
function ensureDiskLoaded() { if (!_diskLoaded) { _diskLoaded = true; loadFromDisk(); } }

let _blobChecked = false;
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_memCache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<{ meta: any; grid: any; byState: any }>('cache/flood-impact.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid, byState: data.byState || {} };
    _cacheSource = 'disk';
    console.warn(`[Flood Impact Cache] Loaded from blob (${data.meta.zoneCount} zones)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getFloodImpactCache(lat: number, lng: number): FloodImpactLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const keys = neighborKeys(lat, lng);
  const zones: FloodImpactZone[] = [];
  for (const k of keys) {
    const z = _memCache.grid[k];
    if (z) zones.push(z);
  }
  if (zones.length === 0) return null;
  return { zones, cacheBuilt: _memCache._meta.built, fromCache: true };
}

export function getFloodImpactByState(state: string): FloodImpactZone[] | null {
  ensureDiskLoaded();
  return _memCache?.byState[state.toUpperCase()] ?? null;
}

export function getHighRiskZones(): FloodImpactZone[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return Object.values(_memCache.grid).filter(z => z.compositeRisk >= 60);
}

export async function setFloodImpactCache(data: FloodImpactCacheData): Promise<void> {
  const prev = _memCache ? { zoneCount: _memCache._meta.zoneCount, stateCount: _memCache._meta.stateCount, highRiskCount: _memCache._meta.highRiskCount } : null;
  const next = { zoneCount: data._meta.zoneCount, stateCount: data._meta.stateCount, highRiskCount: data._meta.highRiskCount };
  _lastDelta = computeCacheDelta(prev, next, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[Flood Impact Cache] Updated: ${data._meta.zoneCount} zones, ${data._meta.highRiskCount} high-risk`);
  saveToDisk();
  await saveCacheToBlob('cache/flood-impact.json', { meta: data._meta, grid: data.grid, byState: data.byState });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isFloodImpactBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Flood Impact Cache] Auto-clearing stale build lock');
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setFloodImpactBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getFloodImpactCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true, source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built, zoneCount: _memCache._meta.zoneCount,
    stateCount: _memCache._meta.stateCount, highRiskCount: _memCache._meta.highRiskCount,
    infrastructureAtRisk: _memCache._meta.infrastructureAtRisk, lastDelta: _lastDelta,
  };
}
