/**
 * Advocacy Cache — Server-side flat cache for congressional bills, hearings,
 * and regulatory comment periods relevant to water quality.
 *
 * Populated by /api/cron/rebuild-advocacy (daily cron).
 * No spatial grid — this is national-level data.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CachedBill {
  id: string;           // "hr-3891-119" (type-number-congress)
  bill: string;         // "H.R. 3891"
  title: string;
  chamber: string;      // "House" | "Senate"
  status: string;       // latestAction.text (truncated)
  statusDate: string;   // latestAction.actionDate
  relevance: 'high' | 'medium';
  url: string;          // congress.gov link
}

export interface CachedHearing {
  id: string;
  title: string;
  date: string;         // ISO date
  location: string;     // chamber + committee
  type: string;         // "Hearing" | "Markup" | "Meeting"
  committee: string;
  url: string;
}

export interface CachedCommentPeriod {
  id: string;           // Federal Register document number
  title: string;
  agency: string;
  daysRemaining: number; // computed from comments_close_on
  closeDate: string;     // ISO date
  type: string;          // "Rulemaking" | "Notice" | "Permit"
  docketId: string;
  url: string;
}

export interface AdvocacyCacheMeta {
  built: string;
  billCount: number;
  hearingCount: number;
  commentCount: number;
}

interface AdvocacyCacheData {
  bills: CachedBill[];
  hearings: CachedHearing[];
  commentPeriods: CachedCommentPeriod[];
  meta: AdvocacyCacheMeta;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: AdvocacyCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'advocacy.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta) return false;

    _memCache = {
      bills: data.bills || [],
      hearings: data.hearings || [],
      commentPeriods: data.commentPeriods || [],
      meta: {
        built: data.meta.built,
        billCount: data.meta.billCount || 0,
        hearingCount: data.meta.hearingCount || 0,
        commentCount: data.meta.commentCount || 0,
      },
    };
    _cacheSource = 'disk';
    console.log(
      `[Advocacy Cache] Loaded from disk (${_memCache.meta.billCount} bills, ` +
      `${_memCache.meta.hearingCount} hearings, ${_memCache.meta.commentCount} comments, ` +
      `built ${data.meta.built || 'unknown'})`
    );
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
    const file = path.join(dir, 'advocacy.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify(_memCache);
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[Advocacy Cache] Saved to disk (${sizeMB}MB)`);
  } catch {
    // Disk save is optional — fail silently
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
  const data = await loadCacheFromBlob<AdvocacyCacheData>('cache/advocacy.json');
  if (data?.meta) {
    _memCache = {
      bills: data.bills || [],
      hearings: data.hearings || [],
      commentPeriods: data.commentPeriods || [],
      meta: data.meta,
    };
    _cacheSource = 'disk';
    console.warn(
      `[Advocacy Cache] Loaded from blob (${data.meta.billCount} bills, ` +
      `${data.meta.hearingCount} hearings, ${data.meta.commentCount} comments)`
    );
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getAdvocacyCache(): AdvocacyCacheData | null {
  ensureDiskLoaded();
  return _memCache;
}

export async function setAdvocacyCache(data: AdvocacyCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { billCount: _memCache.meta.billCount, hearingCount: _memCache.meta.hearingCount, commentCount: _memCache.meta.commentCount }
    : null;
  const newCounts = { billCount: data.meta.billCount, hearingCount: data.meta.hearingCount, commentCount: data.meta.commentCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?.meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[Advocacy Cache] In-memory updated: ${data.meta.billCount} bills, ` +
    `${data.meta.hearingCount} hearings, ${data.meta.commentCount} comments`
  );
  saveToDisk();
  await saveCacheToBlob('cache/advocacy.json', data);
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isAdvocacyBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Advocacy Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setAdvocacyBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getAdvocacyCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache.meta.built,
    billCount: _memCache.meta.billCount,
    hearingCount: _memCache.meta.hearingCount,
    commentCount: _memCache.meta.commentCount,
    lastDelta: _lastDelta,
  };
}
