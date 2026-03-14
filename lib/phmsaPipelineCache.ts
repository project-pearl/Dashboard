/**
 * PHMSA Pipeline Cache — Server-side spatial cache for DOT Pipeline and
 * Hazardous Materials Safety Administration pipeline incident data.
 *
 * Populated by /api/cron/rebuild-phmsa (weekly).
 * Source: DOT PHMSA — pipeline incident reports with spill volumes,
 * water contamination flags, and geolocation.
 *
 * Grid-based cache: Record<string, PhmsaIncident[]> at 0.1° resolution.
 * Lookup checks target cell + 8 neighbors (3x3 grid).
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PhmsaIncident {
  reportId: string;
  operatorName: string;
  state: string;
  county: string;
  commodity: string;
  incidentDate: string;
  causeCategory: string;
  spillBarrels: number | null;
  spillGallons: number | null;
  waterContamination: boolean;
  fatalities: number;
  injuries: number;
  propertyCost: number;
  lat: number;
  lng: number;
}

interface PhmsaPipelineCacheMeta {
  built: string;
  incidentCount: number;
  stateCount: number;
  waterContaminationCount: number;
}

interface PhmsaPipelineCacheData {
  _meta: PhmsaPipelineCacheMeta;
  grid: Record<string, PhmsaIncident[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: PhmsaPipelineCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'phmsa-pipeline.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[PHMSA Pipeline Cache] Loaded from disk (${data.meta.incidentCount} incidents, built ${data.meta.built})`);
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
    const file = path.join(dir, 'phmsa-pipeline.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[PHMSA Pipeline Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/phmsa-pipeline.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[PHMSA Pipeline Cache] Loaded from blob (${data.meta.incidentCount} incidents)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getPhmsaNearby(lat: number, lng: number): PhmsaIncident[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const incidents: PhmsaIncident[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) incidents.push(...cell);
  }
  return incidents;
}

export function getPhmsaByState(state: string): PhmsaIncident[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const upper = state.toUpperCase();
  const all: PhmsaIncident[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    for (const inc of cell) {
      if (inc.state === upper) all.push(inc);
    }
  }
  return all;
}

export async function setPhmsaPipelineCache(data: PhmsaPipelineCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { incidentCount: _memCache._meta.incidentCount, stateCount: _memCache._meta.stateCount, waterContaminationCount: _memCache._meta.waterContaminationCount }
    : null;
  const newCounts = { incidentCount: data._meta.incidentCount, stateCount: data._meta.stateCount, waterContaminationCount: data._meta.waterContaminationCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[PHMSA Pipeline Cache] Updated: ${data._meta.incidentCount} incidents, ` +
    `${data._meta.stateCount} states, ${data._meta.waterContaminationCount} water contamination`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/phmsa-pipeline.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isPhmsaBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[PHMSA Pipeline Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setPhmsaBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getPhmsaPipelineCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    incidentCount: _memCache._meta.incidentCount,
    stateCount: _memCache._meta.stateCount,
    waterContaminationCount: _memCache._meta.waterContaminationCount,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
