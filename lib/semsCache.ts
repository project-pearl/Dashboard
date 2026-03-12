/**
 * SEMS Superfund Cache — state-keyed cache for full EPA Superfund inventory (beyond NPL).
 *
 * Populated by /api/cron/rebuild-sems (weekly, Sunday 11:30 PM UTC).
 * Source: https://echodata.epa.gov/echo/cwa_rest_services (with p_prgm=SF filter)
 * Persisted to disk + Vercel Blob for cold-start survival.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SemsSite {
  siteId: string;
  siteName: string;
  state: string;
  county: string;
  lat: number | null;
  lng: number | null;
  nplStatus: string;           // 'Currently on the Final NPL' | 'Deleted' | 'Not on NPL' | etc
  siteType: string;            // Federal facility, non-federal, etc
  removalAction: boolean;
  remedialAction: boolean;
  constructionComplete: boolean;
  fiveYearReview: boolean;
}

interface SemsCacheData {
  built: string;
  sites: Record<string, { sites: SemsSite[]; fetched: string }>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _cache: SemsCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'sems-sites.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.built || !data?.sites) return false;
    _cache = data;
    _cacheSource = 'disk';
    console.log(`[SEMS Cache] Loaded from disk (built ${data.built})`);
    return true;
  } catch {
    return false;
  }
}

function saveToDisk(): void {
  try {
    if (typeof process === 'undefined' || !_cache) return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    const file = path.join(dir, 'sems-sites.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(_cache), 'utf-8');
    console.log(`[SEMS Cache] Saved to disk`);
  } catch {
    // Disk save is optional
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
  if (_cache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<SemsCacheData>('cache/sems-sites.json');
  if (data?.built && data?.sites) {
    _cache = data;
    _cacheSource = 'blob';
    console.warn(`[SEMS Cache] Loaded from blob`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get SEMS sites for a specific state. */
export function getSemsSites(state: string): SemsSite[] | null {
  ensureDiskLoaded();
  if (!_cache) return null;
  const entry = _cache.sites[state.toUpperCase()];
  return entry?.sites ?? null;
}

/** Get all SEMS sites across all states. */
export function getSemsSitesAll(): SemsSite[] {
  ensureDiskLoaded();
  if (!_cache) return [];
  const all: SemsSite[] = [];
  for (const entry of Object.values(_cache.sites)) {
    all.push(...entry.sites);
  }
  return all;
}

/** Bulk-set SEMS sites for all states. */
export async function setSemsCache(
  sitesByState: Record<string, { sites: SemsSite[]; fetched: string }>
): Promise<void> {
  const prevCounts = _cache ? {
    siteCount: Object.values(_cache.sites).reduce((s, e) => s + e.sites.length, 0),
    statesWithSites: Object.keys(_cache.sites).filter(k => _cache!.sites[k].sites.length > 0).length,
  } : null;
  const newSiteCount = Object.values(sitesByState).reduce((s, e) => s + e.sites.length, 0);
  const newStatesCount = Object.keys(sitesByState).filter(k => sitesByState[k].sites.length > 0).length;
  const newCounts = { siteCount: newSiteCount, statesWithSites: newStatesCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _cache?.built ?? null);
  _cache = {
    built: new Date().toISOString(),
    sites: sitesByState,
  };
  _cacheSource = 'memory (cron)';
  saveToDisk();
  await saveCacheToBlob('cache/sems-sites.json', _cache);
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isSemsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[SEMS Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setSemsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getSemsCacheStatus() {
  ensureDiskLoaded();
  if (!_cache) return { loaded: false, source: null as string | null };
  const all = getSemsSitesAll();
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _cache.built,
    siteCount: all.length,
    statesWithSites: Object.keys(_cache.sites).filter(k => _cache!.sites[k].sites.length > 0).length,
    lastDelta: _lastDelta,
  };
}
