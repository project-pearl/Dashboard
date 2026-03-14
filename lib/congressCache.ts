/**
 * Congress Cache — Server-side flat cache for Congress.gov water-related
 * legislation tracking.
 *
 * Populated by /api/cron/rebuild-congress (weekly).
 * Source: Congress.gov API — bills related to water quality, infrastructure,
 * and environmental protection.
 *
 * Flat cache: { _meta, bills: CongressBill[] }
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CongressBill {
  billNumber: string;
  billType: string;
  congress: number;
  title: string;
  shortTitle: string | null;
  sponsor: string;
  sponsorParty: string;
  sponsorState: string;
  introducedDate: string;
  latestAction: string;
  latestActionDate: string;
  status: 'introduced' | 'committee' | 'passed_house' | 'passed_senate' | 'enacted' | 'vetoed';
  subjects: string[];
  waterRelated: boolean;
  url: string;
}

interface CongressCacheMeta {
  built: string;
  billCount: number;
  activeCount: number;
  enactedCount: number;
}

interface CongressCacheData {
  _meta: CongressCacheMeta;
  bills: CongressBill[];
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: CongressCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'congress.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.bills) return false;
    _memCache = { _meta: data.meta, bills: data.bills };
    _cacheSource = 'disk';
    console.log(`[Congress Cache] Loaded from disk (${data.meta.billCount} bills, built ${data.meta.built})`);
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
    const file = path.join(dir, 'congress.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, bills: _memCache.bills });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[Congress Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; bills: any }>('cache/congress.json');
  if (data?.meta && data?.bills) {
    _memCache = { _meta: data.meta, bills: data.bills };
    _cacheSource = 'blob';
    console.warn(`[Congress Cache] Loaded from blob (${data.meta.billCount} bills)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getAllCongressBills(): CongressBill[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.bills;
}

export function getCongressBillsByStatus(status: CongressBill['status']): CongressBill[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.bills.filter(b => b.status === status);
}

export async function setCongressCache(data: CongressCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { billCount: _memCache._meta.billCount, activeCount: _memCache._meta.activeCount, enactedCount: _memCache._meta.enactedCount }
    : null;
  const newCounts = { billCount: data._meta.billCount, activeCount: data._meta.activeCount, enactedCount: data._meta.enactedCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[Congress Cache] Updated: ${data._meta.billCount} bills, ` +
    `${data._meta.activeCount} active, ${data._meta.enactedCount} enacted`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/congress.json', { meta: data._meta, bills: data.bills });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isCongressBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Congress Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCongressBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCongressCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    billCount: _memCache._meta.billCount,
    activeCount: _memCache._meta.activeCount,
    enactedCount: _memCache._meta.enactedCount,
    lastDelta: _lastDelta,
  };
}
