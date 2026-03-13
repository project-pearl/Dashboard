/**
 * CDC/ATSDR Social Vulnerability Index (SVI) Cache — Server-side spatial cache
 * for SVI 2022 tract-level social vulnerability data.
 *
 * Populated by /api/cron/rebuild-cdc-svi (weekly, Sunday 9:30 PM UTC).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 *
 * SVI was briefly removed in early 2025 but restored by court order.
 * Source: CDC/ATSDR SVI 2022 (based on 2018-2022 ACS data)
 *   https://www.atsdr.cdc.gov/place-health/php/svi/svi-data-documentation-download.html
 *
 * Four themes:
 *   Theme 1: Socioeconomic Status
 *   Theme 2: Household Characteristics & Disability
 *   Theme 3: Racial & Ethnic Minority Status
 *   Theme 4: Housing Type & Transportation
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CdcSviRecord {
  tractFips: string;          // Census tract FIPS (11-digit)
  state: string;              // 2-letter state abbreviation
  county: string;             // County name

  // Overall SVI (0-1 percentile, higher = more vulnerable)
  sviOverall: number;

  // Theme ranks (0-1 percentile)
  theme1Socioeconomic: number;    // Poverty, unemployment, housing cost burden, no health insurance, no HS diploma
  theme2HouseholdDisability: number; // Aged 65+, aged 17-, disability, single-parent, English proficiency
  theme3MinorityStatus: number;   // Racial/ethnic minority status
  theme4HousingTransport: number; // Multi-unit, mobile homes, crowding, no vehicle, group quarters

  // Key underlying variables
  povertyPct: number | null;       // E_POV150 — below 150% poverty
  unemploymentPct: number | null;  // E_UNEMP
  housingCostBurdenPct: number | null; // E_HBURD — housing cost >30% income
  noHealthInsPct: number | null;   // E_UNINSUR
  noHsDiplomaPct: number | null;   // E_NOHSDP — age 25+ without HS diploma
  age65PlusPct: number | null;     // E_AGE65
  age17MinusPct: number | null;    // E_AGE17
  disabilityPct: number | null;    // E_DISABL
  singleParentPct: number | null;  // E_SNGPNT
  lingIsolationPct: number | null; // E_LIMENG — limited English
  minorityPct: number | null;      // E_MINRTY
  multiUnitPct: number | null;     // E_MUNIT
  mobileHomePct: number | null;    // E_MOBILE
  crowdingPct: number | null;      // E_CROWD
  noVehiclePct: number | null;     // E_NOVEH
  groupQuartersPct: number | null; // E_GROUPQ

  totalPopulation: number | null;

  lat: number;
  lng: number;
}

interface GridCell {
  records: CdcSviRecord[];
}

interface CdcSviCacheMeta {
  built: string;
  recordCount: number;
  gridCells: number;
  dataSource: string;
  statesIncluded: number;
  sviYear: string;
}

interface CdcSviCacheData {
  _meta: CdcSviCacheMeta;
  grid: Record<string, GridCell>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: CdcSviCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'cdc-svi.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[CDC SVI Cache] Loaded from disk (${data.meta.recordCount} records, built ${data.meta.built})`);
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
    const file = path.join(dir, 'cdc-svi.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[CDC SVI Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/cdc-svi.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[CDC SVI Cache] Loaded from blob (${data.meta.recordCount} records)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Look up CDC SVI records near a lat/lng using 3x3 grid neighbor search. */
export function getCdcSviCache(lat: number, lng: number): CdcSviRecord[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const records: CdcSviRecord[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) records.push(...cell.records);
  }
  return records.length > 0 ? records : null;
}

/** Get the nearest CDC SVI record to a point. */
export function getCdcSviNearest(lat: number, lng: number): CdcSviRecord | null {
  const records = getCdcSviCache(lat, lng);
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

/** Bulk setter — called by rebuild-cdc-svi cron. */
export async function setCdcSviCache(data: CdcSviCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { recordCount: _memCache._meta.recordCount, gridCells: _memCache._meta.gridCells }
    : null;
  const newCounts = { recordCount: data._meta.recordCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[CDC SVI Cache] Updated: ${data._meta.recordCount} records, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/cdc-svi.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isCdcSviBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[CDC SVI Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCdcSviBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCdcSviCacheStatus() {
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
    sviYear: _memCache._meta.sviYear,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
