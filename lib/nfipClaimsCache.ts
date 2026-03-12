/**
 * NFIP Claims Cache — state-keyed cache for FEMA National Flood Insurance Program claims.
 *
 * Populated by /api/cron/rebuild-nfip-claims (daily at 10:00 PM UTC).
 * Source: https://www.fema.gov/api/open/v2/FimaNfipClaims
 * Persisted to disk + Vercel Blob for cold-start survival.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NfipClaim {
  state: string;
  countyCode: string;
  yearOfLoss: number;
  amountPaidOnBuildingClaim: number;
  amountPaidOnContentsClaim: number;
  floodZone: string;
  waterDepth: number | null;
  lat: number | null;
  lng: number | null;
  asOfDate: string;
}

interface NfipClaimsCacheData {
  built: string;
  claims: Record<string, { claims: NfipClaim[]; fetched: string }>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _cache: NfipClaimsCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'nfip-claims.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.built || !data?.claims) return false;
    _cache = data;
    _cacheSource = 'disk';
    console.log(`[NFIP Claims Cache] Loaded from disk (built ${data.built})`);
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
    const file = path.join(dir, 'nfip-claims.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(_cache), 'utf-8');
    console.log(`[NFIP Claims Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<NfipClaimsCacheData>('cache/nfip-claims.json');
  if (data?.built && data?.claims) {
    _cache = data;
    _cacheSource = 'blob';
    console.warn(`[NFIP Claims Cache] Loaded from blob`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get NFIP claims for a specific state. */
export function getNfipClaims(state: string): NfipClaim[] | null {
  ensureDiskLoaded();
  if (!_cache) return null;
  const entry = _cache.claims[state.toUpperCase()];
  return entry?.claims ?? null;
}

/** Get all NFIP claims across all states. */
export function getNfipClaimsAll(): NfipClaim[] {
  ensureDiskLoaded();
  if (!_cache) return [];
  const all: NfipClaim[] = [];
  for (const entry of Object.values(_cache.claims)) {
    all.push(...entry.claims);
  }
  return all;
}

/** Bulk-set NFIP claims for all states. */
export async function setNfipClaimsCache(
  claimsByState: Record<string, { claims: NfipClaim[]; fetched: string }>
): Promise<void> {
  const prevCounts = _cache ? {
    claimCount: Object.values(_cache.claims).reduce((s, e) => s + e.claims.length, 0),
    statesWithClaims: Object.keys(_cache.claims).filter(k => _cache!.claims[k].claims.length > 0).length,
  } : null;
  const newClaimCount = Object.values(claimsByState).reduce((s, e) => s + e.claims.length, 0);
  const newStatesCount = Object.keys(claimsByState).filter(k => claimsByState[k].claims.length > 0).length;
  const newCounts = { claimCount: newClaimCount, statesWithClaims: newStatesCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _cache?.built ?? null);
  _cache = {
    built: new Date().toISOString(),
    claims: claimsByState,
  };
  _cacheSource = 'memory (cron)';
  saveToDisk();
  await saveCacheToBlob('cache/nfip-claims.json', _cache);
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNfipClaimsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NFIP Claims Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setNfipClaimsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getNfipClaimsCacheStatus() {
  ensureDiskLoaded();
  if (!_cache) return { loaded: false, source: null as string | null };
  const all = getNfipClaimsAll();
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _cache.built,
    claimCount: all.length,
    statesWithClaims: Object.keys(_cache.claims).filter(k => _cache!.claims[k].claims.length > 0).length,
    lastDelta: _lastDelta,
  };
}
