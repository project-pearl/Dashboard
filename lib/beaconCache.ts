/**
 * BEACON Cache — Server-side spatial cache for EPA beach advisory/notification data.
 *
 * Populated by /api/cron/rebuild-beacon (daily).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 * Source: EPA BEACON/WaterGEO notifications API (~4,000 beaches).
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BeachAdvisory {
  beachId: string;
  beachName: string;
  state: string;
  lat: number;
  lng: number;
  indicator: string;         // 'E. coli' | 'Enterococcus' | 'Fecal Coliform'
  value: number;             // CFU per 100mL
  advisoryStatus: string;    // 'open' | 'closed' | 'advisory'
  sampleDate: string;
  notificationDate: string;
}

interface GridCell {
  advisories: BeachAdvisory[];
}

interface BeaconCacheData {
  _meta: { built: string; advisoryCount: number; gridCells: number };
  grid: Record<string, GridCell>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: BeaconCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'beacon.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[BEACON Cache] Loaded from disk (${data.meta.advisoryCount} advisories, built ${data.meta.built})`);
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
    const file = path.join(dir, 'beacon.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[BEACON Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/beacon.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[BEACON Cache] Loaded from blob (${data.meta.advisoryCount} advisories)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getBeaconCache(lat: number, lng: number): BeachAdvisory[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const advisories: BeachAdvisory[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) advisories.push(...cell.advisories);
  }
  return advisories.length > 0 ? advisories : null;
}

export function getBeaconAll(): BeachAdvisory[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: BeachAdvisory[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.advisories);
  }
  return all;
}

export function getBeaconByState(state: string): BeachAdvisory[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: BeachAdvisory[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    for (const a of cell.advisories) {
      if (a.state === state) results.push(a);
    }
  }
  return results;
}

export async function setBeaconCache(data: BeaconCacheData): Promise<void> {
  const prevCounts = _memCache ? { advisoryCount: _memCache._meta.advisoryCount, gridCells: _memCache._meta.gridCells } : null;
  const newCounts = { advisoryCount: data._meta.advisoryCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[BEACON Cache] Updated: ${data._meta.advisoryCount} advisories, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/beacon.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isBeaconBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[BEACON Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setBeaconBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getBeaconCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    advisoryCount: _memCache._meta.advisoryCount,
    gridCells: _memCache._meta.gridCells,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
