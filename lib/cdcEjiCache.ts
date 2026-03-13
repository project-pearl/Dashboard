/**
 * CDC Environmental Justice Index (EJI) Cache — Server-side spatial cache for
 * CDC/ATSDR EJI 2024 tract-level data combining environmental burden, social
 * vulnerability, health vulnerability, and the new Climate Burden Module.
 *
 * Populated by /api/cron/rebuild-cdc-eji (weekly, Sunday 10 PM UTC).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 *
 * Source: CDC/ATSDR EJI 2024 — census tract level
 *   https://eji.cdc.gov/eji_data_download.html
 *   Also archived: https://zenodo.org/records/14675861
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CdcEjiRecord {
  tractFips: string;          // Census tract FIPS (11-digit)
  state: string;              // 2-letter state abbreviation
  county: string;             // County name

  // Module ranks (0-1 percentile, higher = more burden)
  ejiRank: number;            // Overall EJI rank
  envBurdenRank: number;      // Environmental Burden Module rank
  socialVulnRank: number;     // Social Vulnerability Module rank
  healthVulnRank: number;     // Health Vulnerability Module rank
  climateBurdenRank: number;  // Climate Burden Module rank (new in 2024)

  // Key environmental indicators
  pm25: number | null;
  ozone: number | null;
  dieselPm: number | null;
  toxicReleases: number | null;
  superfundProx: number | null;
  waterDischarge: number | null;

  // Social vulnerability indicators (from SVI components)
  povertyPct: number | null;
  unemploymentPct: number | null;
  noHealthInsPct: number | null;
  noHsDiplomaPct: number | null;
  minorityPct: number | null;
  lingIsolationPct: number | null;
  disabilityPct: number | null;
  age65PlusPct: number | null;
  singleParentPct: number | null;

  // Health vulnerability indicators
  asthmaRate: number | null;
  cancerRate: number | null;
  heartDiseaseRate: number | null;
  diabetesRate: number | null;
  lowBirthWeightRate: number | null;
  lifeExpectancy: number | null;

  lat: number;
  lng: number;
}

interface GridCell {
  records: CdcEjiRecord[];
}

interface CdcEjiCacheMeta {
  built: string;
  recordCount: number;
  gridCells: number;
  dataSource: string;
  statesIncluded: number;
  version: string;
}

interface CdcEjiCacheData {
  _meta: CdcEjiCacheMeta;
  grid: Record<string, GridCell>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: CdcEjiCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'cdc-eji.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[CDC EJI Cache] Loaded from disk (${data.meta.recordCount} records, built ${data.meta.built})`);
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
    const file = path.join(dir, 'cdc-eji.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[CDC EJI Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/cdc-eji.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[CDC EJI Cache] Loaded from blob (${data.meta.recordCount} records)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Look up CDC EJI records near a lat/lng using 3x3 grid neighbor search. */
export function getCdcEjiCache(lat: number, lng: number): CdcEjiRecord[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const records: CdcEjiRecord[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) records.push(...cell.records);
  }
  return records.length > 0 ? records : null;
}

/** Get the nearest CDC EJI record to a point. */
export function getCdcEjiNearest(lat: number, lng: number): CdcEjiRecord | null {
  const records = getCdcEjiCache(lat, lng);
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

/** Bulk setter — called by rebuild-cdc-eji cron. */
export async function setCdcEjiCache(data: CdcEjiCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { recordCount: _memCache._meta.recordCount, gridCells: _memCache._meta.gridCells }
    : null;
  const newCounts = { recordCount: data._meta.recordCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[CDC EJI Cache] Updated: ${data._meta.recordCount} records, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/cdc-eji.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isCdcEjiBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[CDC EJI Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCdcEjiBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCdcEjiCacheStatus() {
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
    version: _memCache._meta.version,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
