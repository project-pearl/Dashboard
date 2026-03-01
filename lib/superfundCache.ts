/**
 * Superfund NPL Sites Cache — state-keyed cache for EPA Superfund National Priorities List sites.
 *
 * Populated by /api/cron/rebuild-superfund (daily at 3:15 AM UTC).
 * Persisted to disk + Vercel Blob for cold-start survival.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SuperfundSite {
  siteEpaId: string;
  siteName: string;
  stateAbbr: string;
  city: string;
  county: string;
  status: string;
  siteScore: number | null;
  lat: number;
  lng: number;
  listingDate: string | null;
}

interface SuperfundCacheData {
  built: string;
  sites: Record<string, { sites: SuperfundSite[]; fetched: string }>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _cache: SuperfundCacheData | null = null;
let _cacheSource: string | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'superfund-sites.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.built || !data?.sites) return false;
    _cache = data;
    _cacheSource = 'disk';
    console.log(`[Superfund Cache] Loaded from disk (built ${data.built})`);
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
    const file = path.join(dir, 'superfund-sites.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify(_cache);
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[Superfund Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<SuperfundCacheData>('cache/superfund-sites.json');
  if (data?.built && data?.sites) {
    _cache = data;
    _cacheSource = 'blob';
    console.warn(`[Superfund Cache] Loaded from blob`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get Superfund sites for a specific state. */
export function getSuperfundSites(state: string): SuperfundSite[] | null {
  ensureDiskLoaded();
  if (!_cache) return null;
  const entry = _cache.sites[state.toUpperCase()];
  return entry?.sites ?? null;
}

/** Get all Superfund sites across all states. */
export function getSuperfundSitesAll(): SuperfundSite[] {
  ensureDiskLoaded();
  if (!_cache) return [];
  const all: SuperfundSite[] = [];
  for (const entry of Object.values(_cache.sites)) {
    all.push(...entry.sites);
  }
  return all;
}

/** Bulk-set sites for all states (single blob write). */
export async function setSuperfundCache(
  sitesByState: Record<string, { sites: SuperfundSite[]; fetched: string }>
): Promise<void> {
  _cache = {
    built: new Date().toISOString(),
    sites: sitesByState,
  };
  _cacheSource = 'memory (cron)';
  saveToDisk();
  await saveCacheToBlob('cache/superfund-sites.json', _cache);
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isSuperfundBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Superfund Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setSuperfundBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getSuperfundCacheStatus() {
  ensureDiskLoaded();
  if (!_cache) return { loaded: false, source: null as string | null };
  const all = getSuperfundSitesAll();
  const statesWithSites = Object.entries(_cache.sites)
    .filter(([, entry]) => entry.sites.length > 0)
    .map(([state]) => state);
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _cache.built,
    siteCount: all.length,
    statesWithSites: statesWithSites.length,
  };
}
