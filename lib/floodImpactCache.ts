/**
 * Flood Infrastructure Vulnerability Cache — Server-side spatial cache for
 * flood impact zones combining NWS flood gauges, NWM streamflow forecasts,
 * and nearby infrastructure risk assessments.
 *
 * Data source: NWS AHPS flood gauges, NWM streamflow, infrastructure databases.
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FloodImpactZone {
  gridKey: string;
  lat: number;
  lng: number;
  state: string;
  floodStatus: 'none' | 'minor' | 'moderate' | 'major';
  gaugesAtRisk: {
    lid: string;
    name: string;
    status: string;
    stage: number;
  }[];
  nwmStreamflow: {
    reachId: string;
    flow: number;
    floodThreshold: number;
  }[];
  nearbyInfrastructure: {
    type: string;
    name: string;
    distanceMi: number;
    riskLevel: string;
  }[];
  compositeRisk: number;
  populationExposed: number;
}

interface GridCell {
  zone: FloodImpactZone;
}

interface FloodImpactCacheMeta {
  built: string;
  zoneCount: number;
  highRiskCount: number;
  gridCells: number;
}

interface FloodImpactCacheData {
  _meta: FloodImpactCacheMeta;
  grid: Record<string, GridCell>;
  stateIndex: Record<string, FloodImpactZone[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: FloodImpactCacheData | null = null;
let _cacheSource: string | null = null;
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
    _memCache = { _meta: data.meta, grid: data.grid, stateIndex: data.stateIndex || {} };
    _cacheSource = 'disk';
    console.log(`[Flood Impact Cache] Loaded from disk (${data.meta.zoneCount} zones, built ${data.meta.built})`);
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
    const file = path.join(dir, 'flood-impact.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: _memCache._meta,
      grid: _memCache.grid,
      stateIndex: _memCache.stateIndex,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[Flood Impact Cache] Saved to disk (${(Buffer.byteLength(payload) / 1024).toFixed(1)} KB)`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any; stateIndex: any }>('cache/flood-impact.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid, stateIndex: data.stateIndex || {} };
    _cacheSource = 'blob';
    console.warn(`[Flood Impact Cache] Loaded from blob (${data.meta.zoneCount} zones)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getFloodImpactCache(lat: number, lng: number): FloodImpactZone[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const zones: FloodImpactZone[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) zones.push(cell.zone);
  }
  return zones.length > 0 ? zones : null;
}

export function getFloodImpactByState(state: string): FloodImpactZone[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const upper = state.toUpperCase();
  return _memCache.stateIndex[upper] || [];
}

export function getHighRiskZones(): FloodImpactZone[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const highRisk: FloodImpactZone[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    if (cell.zone.floodStatus === 'major' || cell.zone.compositeRisk >= 0.7) {
      highRisk.push(cell.zone);
    }
  }
  return highRisk;
}

// ── Setter ───────────────────────────────────────────────────────────────────

export async function setFloodImpactCache(data: FloodImpactCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { zoneCount: _memCache._meta.zoneCount, highRiskCount: _memCache._meta.highRiskCount }
    : null;
  const newCounts = { zoneCount: data._meta.zoneCount, highRiskCount: data._meta.highRiskCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[Flood Impact Cache] Updated: ${data._meta.zoneCount} zones, ` +
    `${data._meta.highRiskCount} high-risk, ${data._meta.gridCells} cells`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/flood-impact.json', {
    meta: data._meta,
    grid: data.grid,
    stateIndex: data.stateIndex,
  });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isFloodImpactBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Flood Impact Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setFloodImpactBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getFloodImpactCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    zoneCount: _memCache._meta.zoneCount,
    highRiskCount: _memCache._meta.highRiskCount,
    gridCells: _memCache._meta.gridCells,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
