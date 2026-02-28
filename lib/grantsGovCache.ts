/**
 * Grants.gov Cache — Server-side cache for EPA/environmental grant opportunities.
 *
 * Populated by /api/cron/rebuild-grants-gov (daily cron).
 * Fetches posted + forecasted environmental grants from the Grants.gov API.
 * Flat storage (no grid) — grants are national, not geographic.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GrantsGovOpportunity {
  opportunityId: string;
  opportunityNumber: string;
  title: string;
  agency: string;
  agencyCode: string;
  fundingCategory: string;
  status: string;
  openDate: string;
  closeDate: string;
  awardFloor: number;
  awardCeiling: number;
  estimatedFunding: number;
  description: string;
  cfdaList: string[];
  eligibilities: string[];
  url: string;
}

interface GrantsGovCacheData {
  _meta: {
    built: string;
    opportunityCount: number;
    postedCount: number;
    forecastedCount: number;
  };
  opportunities: Record<string, GrantsGovOpportunity>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const DISK_FILE = 'grants-gov.json';
const BLOB_PATH = 'cache/grants-gov.json';

let _memCache: GrantsGovCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', DISK_FILE);
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?._meta || !data?.opportunities) return false;
    _memCache = data;
    _cacheSource = 'disk';
    console.log(`[GrantsGov Cache] Loaded from disk (${data._meta.opportunityCount} opportunities)`);
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
    const file = path.join(dir, DISK_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify(_memCache);
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[GrantsGov Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.opportunityCount} opps)`);
  } catch {}
}

let _diskLoaded = false;
function ensureDiskLoaded() {
  if (!_diskLoaded) { _diskLoaded = true; loadFromDisk(); }
}

let _blobChecked = false;
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_memCache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<GrantsGovCacheData>(BLOB_PATH);
  if (data?._meta && data?.opportunities) {
    _memCache = data;
    _cacheSource = 'disk';
    console.warn(`[GrantsGov Cache] Loaded from blob (${data._meta.opportunityCount} opportunities)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getGrantsGovAll(): GrantsGovOpportunity[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return Object.values(_memCache.opportunities);
}

export function getGrantsGovOpen(): GrantsGovOpportunity[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const now = new Date();
  return Object.values(_memCache.opportunities).filter(o => {
    if (o.status !== 'posted') return false;
    if (!o.closeDate) return true;
    // Parse MM/DD/YYYY close date
    const parts = o.closeDate.split('/');
    if (parts.length !== 3) return true;
    const close = new Date(+parts[2], +parts[0] - 1, +parts[1]);
    return close >= now;
  });
}

export async function setGrantsGovCache(
  opportunities: Record<string, GrantsGovOpportunity>,
  meta: GrantsGovCacheData['_meta'],
): Promise<void> {
  _memCache = { _meta: meta, opportunities };
  _cacheSource = 'memory (cron)';
  console.log(`[GrantsGov Cache] Updated: ${meta.opportunityCount} opportunities`);
  saveToDisk();
  await saveCacheToBlob(BLOB_PATH, _memCache);
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isGrantsGovBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}
export function setGrantsGovBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getGrantsGovCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    opportunityCount: _memCache._meta.opportunityCount,
    postedCount: _memCache._meta.postedCount,
    forecastedCount: _memCache._meta.forecastedCount,
  };
}
