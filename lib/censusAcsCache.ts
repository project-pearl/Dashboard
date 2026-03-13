/**
 * Census ACS Cache — Server-side spatial cache for American Community Survey
 * 5-Year Estimates at the census tract level.
 *
 * Populated by /api/cron/rebuild-census-acs (weekly, Sunday 8:30 PM UTC).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 *
 * Uses the Census Bureau API (free, API key required: PIN_CENSUS_KEY).
 * Latest release: 2020-2024 ACS 5-Year (released January 29, 2026).
 *
 * Source: https://api.census.gov/data/2024/acs/acs5
 *
 * This replaces the hardcoded state-level demographics in ejVulnerability.ts
 * with tract-level granularity for EJ scoring.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CensusAcsRecord {
  tractFips: string;          // Census tract FIPS (11-digit: state+county+tract)
  state: string;              // 2-letter state abbreviation
  county: string;             // County FIPS code

  // Population
  totalPopulation: number;

  // Income & Poverty
  medianHouseholdIncome: number | null;
  povertyPct: number | null;           // B17001: % below poverty line
  povertyUnder18Pct: number | null;    // Child poverty rate

  // Race & Ethnicity
  whitePct: number | null;
  blackPct: number | null;
  hispanicPct: number | null;
  asianPct: number | null;
  aianPct: number | null;              // American Indian / Alaska Native
  nhpiPct: number | null;              // Native Hawaiian / Pacific Islander
  multiRacePct: number | null;
  minorityPct: number | null;          // Non-white Hispanic + all non-white

  // Education
  noHsDiplomaPct: number | null;       // Age 25+ without HS diploma
  bachelorsPlusPct: number | null;     // Age 25+ with bachelor's or higher

  // Insurance & Health Access
  noHealthInsPct: number | null;       // Uninsured %

  // Language
  lingIsolationPct: number | null;     // Limited English proficiency households

  // Age
  age65PlusPct: number | null;
  ageUnder5Pct: number | null;

  // Disability
  disabilityPct: number | null;

  // Housing
  medianHomeValue: number | null;
  renterOccupiedPct: number | null;
  housingCostBurdenPct: number | null; // Rent/mortgage >30% of income
  vacancyPct: number | null;

  lat: number;
  lng: number;
}

interface GridCell {
  records: CensusAcsRecord[];
}

interface CensusAcsCacheMeta {
  built: string;
  recordCount: number;
  gridCells: number;
  dataSource: string;
  statesIncluded: number;
  acsYear: string;
}

interface CensusAcsCacheData {
  _meta: CensusAcsCacheMeta;
  grid: Record<string, GridCell>;
}

// ── FIPS → State Abbreviation ────────────────────────────────────────────────

export const FIPS_TO_STATE: Record<string, string> = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE',
  '11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA',
  '20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN',
  '28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM',
  '36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI',
  '45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA',
  '54':'WV','55':'WI','56':'WY','72':'PR','78':'VI',
};

export const STATE_TO_FIPS: Record<string, string> = Object.fromEntries(
  Object.entries(FIPS_TO_STATE).map(([k, v]) => [v, k])
);

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: CensusAcsCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'census-acs.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[Census ACS Cache] Loaded from disk (${data.meta.recordCount} records, built ${data.meta.built})`);
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
    const file = path.join(dir, 'census-acs.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[Census ACS Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/census-acs.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[Census ACS Cache] Loaded from blob (${data.meta.recordCount} records)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Look up Census ACS records near a lat/lng using 3x3 grid neighbor search. */
export function getCensusAcsCache(lat: number, lng: number): CensusAcsRecord[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const records: CensusAcsRecord[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) records.push(...cell.records);
  }
  return records.length > 0 ? records : null;
}

/** Get the nearest Census ACS record to a point. */
export function getCensusAcsNearest(lat: number, lng: number): CensusAcsRecord | null {
  const records = getCensusAcsCache(lat, lng);
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

/** Bulk setter — called by rebuild-census-acs cron. */
export async function setCensusAcsCache(data: CensusAcsCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { recordCount: _memCache._meta.recordCount, gridCells: _memCache._meta.gridCells }
    : null;
  const newCounts = { recordCount: data._meta.recordCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[Census ACS Cache] Updated: ${data._meta.recordCount} records, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/census-acs.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 15 * 60 * 1000; // 15 min — Census API can be slow

export function isCensusAcsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Census ACS Cache] Auto-clearing stale build lock (>15 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCensusAcsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCensusAcsCacheStatus() {
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
    acsYear: _memCache._meta.acsYear,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
