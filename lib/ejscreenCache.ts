/**
 * EJScreen Cache — Server-side spatial cache for EPA EJScreen environmental
 * justice indices, sourced from the Harvard DataVerse preservation archive.
 *
 * Populated by /api/cron/rebuild-ejscreen (weekly, Sunday 11 PM UTC).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 *
 * Since EPA removed EJScreen from its website (Feb 2025), the full dataset
 * is preserved at Harvard DataVerse:
 *   https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/RLR5AX
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EJScreenRecord {
  blockGroupId: string;     // Census block group FIPS
  state: string;            // 2-letter state abbreviation
  ejIndex: number;          // Composite EJ index (0-100 percentile)
  lowIncomePct: number;     // Fraction 0-1
  minorityPct: number;      // Fraction 0-1
  lingIsolatedPct: number;  // Fraction 0-1
  lessThanHsPct: number;    // Fraction 0-1 (less than high school education)
  pm25: number | null;      // Particulate matter 2.5
  ozone: number | null;
  dieselPm: number | null;
  waterDischarge: number | null;  // Indicator for water pollutant discharge
  superfundProx: number | null;   // Proximity to Superfund sites
  rmpProx: number | null;         // Proximity to RMP facilities
  lat: number;
  lng: number;
}

interface GridCell {
  records: EJScreenRecord[];
}

interface EJScreenCacheMeta {
  built: string;
  recordCount: number;
  gridCells: number;
  dataSource: string;
  statesIncluded: number;
}

interface EJScreenCacheData {
  _meta: EJScreenCacheMeta;
  grid: Record<string, GridCell>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: EJScreenCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'ejscreen.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[EJScreen Cache] Loaded from disk (${data.meta.recordCount} records, built ${data.meta.built})`);
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
    const file = path.join(dir, 'ejscreen.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[EJScreen Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/ejscreen.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[EJScreen Cache] Loaded from blob (${data.meta.recordCount} records)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Look up EJScreen records near a lat/lng using 3×3 grid neighbor search. */
export function getEJScreenCache(lat: number, lng: number): EJScreenRecord[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const records: EJScreenRecord[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) records.push(...cell.records);
  }
  return records.length > 0 ? records : null;
}

/** Get the nearest EJScreen record to a point (for single-point lookups). */
export function getEJScreenNearest(lat: number, lng: number): EJScreenRecord | null {
  const records = getEJScreenCache(lat, lng);
  if (!records || records.length === 0) return null;

  let nearest = records[0];
  let minDist = (nearest.lat - lat) ** 2 + (nearest.lng - lng) ** 2;

  for (let i = 1; i < records.length; i++) {
    const d = (records[i].lat - lat) ** 2 + (records[i].lng - lng) ** 2;
    if (d < minDist) {
      minDist = d;
      nearest = records[i];
    }
  }
  return nearest;
}

/** Bulk setter — called by rebuild-ejscreen cron. */
export async function setEJScreenCache(data: EJScreenCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { recordCount: _memCache._meta.recordCount, gridCells: _memCache._meta.gridCells }
    : null;
  const newCounts = { recordCount: data._meta.recordCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[EJScreen Cache] Updated: ${data._meta.recordCount} records, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/ejscreen.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isEJScreenBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[EJScreen Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setEJScreenBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getEJScreenCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    recordCount: _memCache._meta.recordCount,
    gridCells: _memCache._meta.gridCells,
    statesIncluded: _memCache._meta.statesIncluded,
    dataSource: _memCache._meta.dataSource,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
