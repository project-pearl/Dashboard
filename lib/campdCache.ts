/**
 * CAMPD Cache — Server-side spatial cache for EPA Clean Air Markets Division
 * power sector emissions data (SO2, NOx, CO2) by facility.
 *
 * Populated by /api/cron/rebuild-campd (daily at 8 PM UTC).
 * Source: https://api.epa.gov/easey/ (requires api.data.gov key)
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 *
 * Links to water quality via acid rain deposition, coal ash pond contamination,
 * and thermal discharge from power plants.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CampdFacility {
  facilityId: string;
  facilityName: string;
  state: string;
  county: string;
  lat: number;
  lng: number;
  so2Tons: number;       // Annual SO2 emissions (tons)
  noxTons: number;       // Annual NOx emissions (tons)
  co2Tons: number;       // Annual CO2 emissions (tons)
  heatInput: number;     // Heat input (mmBtu)
  grossLoad: number;     // Gross load (MWh)
  operatingStatus: string;
  primaryFuelType: string;
  complianceStatus: string;  // 'In Compliance' | 'Excess Emissions' | etc.
  year: number;
}

interface GridCell {
  facilities: CampdFacility[];
}

interface CampdCacheMeta {
  built: string;
  facilityCount: number;
  gridCells: number;
  year: number;
  totalSo2Tons: number;
  totalNoxTons: number;
}

interface CampdCacheData {
  _meta: CampdCacheMeta;
  grid: Record<string, GridCell>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: CampdCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'campd.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[CAMPD Cache] Loaded from disk (${data.meta.facilityCount} facilities, built ${data.meta.built})`);
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
    const file = path.join(dir, 'campd.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[CAMPD Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/campd.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[CAMPD Cache] Loaded from blob (${data.meta.facilityCount} facilities)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getCampdCache(lat: number, lng: number): CampdFacility[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const facilities: CampdFacility[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) facilities.push(...cell.facilities);
  }
  return facilities.length > 0 ? facilities : null;
}

export function getCampdAllFacilities(): CampdFacility[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: CampdFacility[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.facilities);
  }
  return all;
}

export async function setCampdCache(data: CampdCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { facilityCount: _memCache._meta.facilityCount, gridCells: _memCache._meta.gridCells }
    : null;
  const newCounts = { facilityCount: data._meta.facilityCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[CAMPD Cache] Updated: ${data._meta.facilityCount} facilities, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/campd.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isCampdBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[CAMPD Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCampdBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCampdCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    facilityCount: _memCache._meta.facilityCount,
    gridCells: _memCache._meta.gridCells,
    year: _memCache._meta.year,
    totalSo2Tons: _memCache._meta.totalSo2Tons,
    totalNoxTons: _memCache._meta.totalNoxTons,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
