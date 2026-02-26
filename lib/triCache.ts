/**
 * TRI Cache — Server-side spatial cache for EPA Toxics Release Inventory data.
 *
 * Populated by /api/cron/rebuild-tri (daily at 6 PM UTC).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TriFacility {
  triId: string;
  facilityName: string;
  state: string;
  city: string;
  county: string;
  lat: number;
  lng: number;
  totalReleases: number;
  carcinogenReleases: number;
  topChemicals: string[];
  industryCode: string;
  year: number;
}

interface GridCell {
  facilities: TriFacility[];
}

interface TriCacheData {
  _meta: { built: string; facilityCount: number; gridCells: number; year: number };
  grid: Record<string, GridCell>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: TriCacheData | null = null;
let _cacheSource: string | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'tri.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[TRI Cache] Loaded from disk (${data.meta.facilityCount} facilities, built ${data.meta.built})`);
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
    const file = path.join(dir, 'tri.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[TRI Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/tri.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[TRI Cache] Loaded from blob (${data.meta.facilityCount} facilities)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getTriCache(lat: number, lng: number): TriFacility[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const facilities: TriFacility[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) facilities.push(...cell.facilities);
  }
  return facilities.length > 0 ? facilities : null;
}

export function getTriAllFacilities(): TriFacility[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: TriFacility[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.facilities);
  }
  return all;
}

export async function setTriCache(data: TriCacheData): Promise<void> {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[TRI Cache] Updated: ${data._meta.facilityCount} facilities, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/tri.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isTriBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[TRI Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setTriBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getTriCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    facilityCount: _memCache._meta.facilityCount,
    gridCells: _memCache._meta.gridCells,
    year: _memCache._meta.year,
  };
}

export { gridKey };
