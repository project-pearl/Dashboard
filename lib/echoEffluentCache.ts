/**
 * ECHO Effluent/DMR Cache — state-keyed cache for EPA ECHO effluent discharge data.
 *
 * Populated by /api/cron/rebuild-echo-effluent (daily at 10:30 PM UTC).
 * Source: https://echodata.epa.gov/echo/eff_rest_services.get_effluent_chart
 * Persisted to disk + Vercel Blob for cold-start survival.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EffluentRecord {
  facilityId: string;         // NPDES permit ID
  facilityName: string;
  state: string;
  lat: number | null;
  lng: number | null;
  parameterCode: string;      // e.g. "00310" (BOD), "00530" (TSS)
  parameterDesc: string;
  limitValue: number | null;
  limitUnit: string | null;
  actualValue: number | null;
  exceedance: boolean;
  monitoringPeriodEnd: string;
}

interface EchoEffluentCacheData {
  built: string;
  effluent: Record<string, { records: EffluentRecord[]; fetched: string }>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _cache: EchoEffluentCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'echo-effluent.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.built || !data?.effluent) return false;
    _cache = data;
    _cacheSource = 'disk';
    console.log(`[ECHO Effluent Cache] Loaded from disk (built ${data.built})`);
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
    const file = path.join(dir, 'echo-effluent.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(_cache), 'utf-8');
    console.log(`[ECHO Effluent Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<EchoEffluentCacheData>('cache/echo-effluent.json');
  if (data?.built && data?.effluent) {
    _cache = data;
    _cacheSource = 'blob';
    console.warn(`[ECHO Effluent Cache] Loaded from blob`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get effluent records for a specific state. */
export function getEchoEffluent(state: string): EffluentRecord[] | null {
  ensureDiskLoaded();
  if (!_cache) return null;
  const entry = _cache.effluent[state.toUpperCase()];
  return entry?.records ?? null;
}

/** Get all effluent records across all states. */
export function getEchoEffluentAll(): EffluentRecord[] {
  ensureDiskLoaded();
  if (!_cache) return [];
  const all: EffluentRecord[] = [];
  for (const entry of Object.values(_cache.effluent)) {
    all.push(...entry.records);
  }
  return all;
}

/** Bulk-set effluent records for all states. */
export async function setEchoEffluentCache(
  effluentByState: Record<string, { records: EffluentRecord[]; fetched: string }>
): Promise<void> {
  const prevCounts = _cache ? {
    recordCount: Object.values(_cache.effluent).reduce((s, e) => s + e.records.length, 0),
    statesWithRecords: Object.keys(_cache.effluent).filter(k => _cache!.effluent[k].records.length > 0).length,
  } : null;
  const newRecordCount = Object.values(effluentByState).reduce((s, e) => s + e.records.length, 0);
  const newStatesCount = Object.keys(effluentByState).filter(k => effluentByState[k].records.length > 0).length;
  const newCounts = { recordCount: newRecordCount, statesWithRecords: newStatesCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _cache?.built ?? null);
  _cache = {
    built: new Date().toISOString(),
    effluent: effluentByState,
  };
  _cacheSource = 'memory (cron)';
  saveToDisk();
  await saveCacheToBlob('cache/echo-effluent.json', _cache);
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isEchoEffluentBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[ECHO Effluent Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setEchoEffluentBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getEchoEffluentCacheStatus() {
  ensureDiskLoaded();
  if (!_cache) return { loaded: false, source: null as string | null };
  const all = getEchoEffluentAll();
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _cache.built,
    recordCount: all.length,
    statesWithRecords: Object.keys(_cache.effluent).filter(k => _cache!.effluent[k].records.length > 0).length,
    lastDelta: _lastDelta,
  };
}
