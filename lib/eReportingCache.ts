/**
 * EPA e-DMR Electronic Reporting Cache — Server-side state-keyed cache for
 * EPA Electronic Discharge Monitoring Report (e-DMR) filing compliance data.
 *
 * Populated by /api/cron/rebuild-e-reporting.
 * Source: EPA ECHO e-DMR electronic reporting system — tracks NPDES permit
 * holders' discharge monitoring report submission status and compliance.
 *
 * State-keyed: Record<string, EReportingFiling[]> keyed by 2-letter
 * state abbreviation (e.g. "PA", "CA", "TX").
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EReportingFiling {
  permitId: string;
  facilityName: string;
  state: string;
  filingStatus: 'submitted' | 'late' | 'overdue' | 'pending';
  reportingPeriod: string;
  dueDate: string;
  submittedDate: string | null;
  lateSubmission: boolean;
  daysLate: number | null;
  parameterCount: number;
  violationCount: number;
  lat: number;
  lng: number;
}

interface EReportingCacheMeta {
  built: string;
  filingCount: number;
  facilityCount: number;
  stateCount: number;
  lateCount: number;
}

interface EReportingCacheData {
  _meta: EReportingCacheMeta;
  byState: Record<string, EReportingFiling[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: EReportingCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'e-reporting.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.byState) return false;
    _memCache = { _meta: data.meta, byState: data.byState };
    _cacheSource = 'disk';
    console.log(`[eReporting Cache] Loaded from disk (${data.meta.filingCount} filings, built ${data.meta.built})`);
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
    const file = path.join(dir, 'e-reporting.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, byState: _memCache.byState });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[eReporting Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; byState: any }>('cache/e-reporting.json');
  if (data?.meta && data?.byState) {
    _memCache = { _meta: data.meta, byState: data.byState };
    _cacheSource = 'blob';
    console.warn(`[eReporting Cache] Loaded from blob (${data.meta.filingCount} filings)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getEReportingByState(state: string): EReportingFiling[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.byState[state.toUpperCase()] || [];
}

export function getEReportingNearby(lat: number, lng: number): EReportingFiling[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const keys = neighborKeys(lat, lng);
  const results: EReportingFiling[] = [];
  for (const entries of Object.values(_memCache.byState)) {
    for (const filing of entries) {
      const fk = gridKey(filing.lat, filing.lng);
      if (keys.includes(fk)) {
        results.push(filing);
      }
    }
  }
  return results;
}

export function getEReportingAll(): Record<string, EReportingFiling[]> {
  ensureDiskLoaded();
  if (!_memCache) return {};
  return _memCache.byState;
}

// ── Setter ───────────────────────────────────────────────────────────────────

export async function setEReportingCache(data: EReportingCacheData): Promise<void> {
  const prevCounts = _memCache
    ? {
        filingCount: _memCache._meta.filingCount,
        facilityCount: _memCache._meta.facilityCount,
        stateCount: _memCache._meta.stateCount,
        lateCount: _memCache._meta.lateCount,
      }
    : null;
  const newCounts = {
    filingCount: data._meta.filingCount,
    facilityCount: data._meta.facilityCount,
    stateCount: data._meta.stateCount,
    lateCount: data._meta.lateCount,
  };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[eReporting Cache] Updated: ${data._meta.filingCount} filings, ` +
    `${data._meta.facilityCount} facilities, ${data._meta.stateCount} states, ` +
    `${data._meta.lateCount} late`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/e-reporting.json', { meta: data._meta, byState: data.byState });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isEReportingBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[eReporting Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setEReportingBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getEReportingCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    filingCount: _memCache._meta.filingCount,
    facilityCount: _memCache._meta.facilityCount,
    stateCount: _memCache._meta.stateCount,
    lateCount: _memCache._meta.lateCount,
    lastDelta: _lastDelta,
  };
}
