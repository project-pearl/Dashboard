/**
 * USGS Water Availability Cache — HUC-8 level water availability assessments.
 *
 * Populated by /api/cron/rebuild-usgs-water-avail (weekly cron).
 * Derives from ScienceBase datasets + USDM drought overlay.
 * State-keyed with HUC-8 level indicators.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export type DroughtSeverity = 'None' | 'D0' | 'D1' | 'D2' | 'D3' | 'D4';
export type WaterTrend = 'improving' | 'declining' | 'stable';

export interface WaterAvailIndicator {
  state: string;
  huc8: string;
  huc8Name: string;
  baseflowIndex: number;
  soilMoisture: number;
  waterBudgetSurplus: number;
  waterBudgetDeficit: number;
  annualPrecip: number;
  annualRunoff: number;
  annualET: number;
  droughtSeverity: DroughtSeverity;
  trend: WaterTrend;
}

export interface WaterAvailCacheMeta {
  built: string;
  indicatorCount: number;
  stateCount: number;
  droughtHucCount: number;
  decliningCount: number;
}

interface WaterAvailCacheData {
  _meta: WaterAvailCacheMeta;
  states: Record<string, WaterAvailIndicator[]>;
}

export interface WaterAvailLookupResult {
  indicators: WaterAvailIndicator[];
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: WaterAvailCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'usgs-water-avail.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.states) return false;
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.log(`[Water Avail Cache] Loaded from disk (${_memCache._meta.indicatorCount} indicators)`);
    return true;
  } catch { return false; }
}

function saveToDisk(): void {
  try {
    if (typeof process === 'undefined' || !_memCache) return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, states: _memCache.states });
    fs.writeFileSync(path.join(dir, 'usgs-water-avail.json'), payload, 'utf-8');
    console.log(`[Water Avail Cache] Saved to disk (${(Buffer.byteLength(payload) / 1024 / 1024).toFixed(1)}MB)`);
  } catch { /* optional */ }
}

let _diskLoaded = false;
function ensureDiskLoaded() { if (!_diskLoaded) { _diskLoaded = true; loadFromDisk(); } }

let _blobChecked = false;
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_memCache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<{ meta: any; states: any }>('cache/usgs-water-avail.json');
  if (data?.meta && data?.states) {
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.warn(`[Water Avail Cache] Loaded from blob (${data.meta.indicatorCount} indicators)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getWaterAvail(state: string): WaterAvailLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const indicators = _memCache.states[state.toUpperCase()];
  if (!indicators || indicators.length === 0) return null;
  return { indicators, cacheBuilt: _memCache._meta.built, fromCache: true };
}

export function getWaterAvailAll(): Record<string, WaterAvailIndicator[]> | null {
  ensureDiskLoaded();
  return _memCache?.states ?? null;
}

export function getDroughtHucs(): WaterAvailIndicator[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const result: WaterAvailIndicator[] = [];
  for (const indicators of Object.values(_memCache.states)) {
    for (const ind of indicators) {
      if (ind.droughtSeverity !== 'None') result.push(ind);
    }
  }
  return result;
}

export async function setWaterAvailCache(data: WaterAvailCacheData): Promise<void> {
  const prev = _memCache ? { indicatorCount: _memCache._meta.indicatorCount, stateCount: _memCache._meta.stateCount, droughtHucCount: _memCache._meta.droughtHucCount } : null;
  const next = { indicatorCount: data._meta.indicatorCount, stateCount: data._meta.stateCount, droughtHucCount: data._meta.droughtHucCount };
  _lastDelta = computeCacheDelta(prev, next, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[Water Avail Cache] Updated: ${data._meta.indicatorCount} indicators, ${data._meta.droughtHucCount} drought HUCs`);
  saveToDisk();
  await saveCacheToBlob('cache/usgs-water-avail.json', { meta: data._meta, states: data.states });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isWaterAvailBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Water Avail Cache] Auto-clearing stale build lock');
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setWaterAvailBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getWaterAvailCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true, source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built, indicatorCount: _memCache._meta.indicatorCount,
    stateCount: _memCache._meta.stateCount, droughtHucCount: _memCache._meta.droughtHucCount,
    decliningCount: _memCache._meta.decliningCount, lastDelta: _lastDelta,
  };
}
