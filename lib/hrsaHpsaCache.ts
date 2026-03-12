/**
 * HRSA HPSA Cache — Health Professional Shortage Area designations.
 *
 * Populated by /api/cron/rebuild-hrsa-hpsa (daily cron).
 * Pulls from HRSA Socrata endpoint (data.hrsa.gov).
 * Indexed by state abbreviation.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export type HpsaTypeCode = 'PC' | 'DH' | 'MH'; // Primary Care, Dental Health, Mental Health

export interface HpsaDesignation {
  hpsaId: string;
  hpsaName: string;
  hpsaTypeCode: HpsaTypeCode;
  state: string;
  countyFips: string;
  countyName: string;
  lat: number | null;
  lng: number | null;
  hpsaScore: number;           // 0-26 severity score
  designationDate: string;
  statusCode: string;
  populationServed: number;
  providerRatio: number | null; // population-to-provider ratio
  percentBelowPoverty: number | null;
  ruralStatus: boolean;
}

export interface HpsaStateData {
  designations: HpsaDesignation[];
  totalPopulationServed: number;
  highSeverityCount: number;    // hpsaScore >= 18
}

export interface HpsaCacheMeta {
  built: string;
  totalDesignations: number;
  stateCount: number;
  highSeverityTotal: number;
  ruralCount: number;
  byType: Record<HpsaTypeCode, number>;
}

interface HpsaCacheData {
  _meta: HpsaCacheMeta;
  states: Record<string, HpsaStateData>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: HpsaCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'hrsa-hpsa.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?._meta || !data?.states) return false;

    _memCache = data;
    _cacheSource = 'disk';
    console.log(
      `[HRSA HPSA Cache] Loaded from disk (${data._meta.totalDesignations} designations, ` +
      `${data._meta.stateCount} states, built ${data._meta.built || 'unknown'})`
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
    const file = path.join(dir, 'hrsa-hpsa.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify(_memCache);
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[HRSA HPSA Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.totalDesignations} designations)`);
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
  const data = await loadCacheFromBlob<HpsaCacheData>('cache/hrsa-hpsa.json');
  if (data?._meta && data?.states) {
    _memCache = data;
    _cacheSource = 'disk';
    console.warn(`[HRSA HPSA Cache] Loaded from blob (${data._meta.totalDesignations} designations)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get HPSA designations for a given state.
 */
export function getHpsaByState(state: string): HpsaDesignation[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.states[state.toUpperCase()]?.designations ?? [];
}

/**
 * Get HPSA designations for a given county FIPS code.
 */
export function getHpsaByCounty(countyFips: string): HpsaDesignation[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  for (const sd of Object.values(_memCache.states)) {
    const matches = sd.designations.filter(d => d.countyFips === countyFips);
    if (matches.length > 0) return matches;
  }
  return [];
}

/**
 * Get high-severity HPSAs (score >= threshold) across all states or for a specific state.
 */
export function getHighSeverityHpsas(threshold = 18, state?: string): HpsaDesignation[] {
  ensureDiskLoaded();
  if (!_memCache) return [];

  const sources = state
    ? [_memCache.states[state.toUpperCase()]].filter(Boolean)
    : Object.values(_memCache.states);

  return sources
    .flatMap(s => s.designations)
    .filter(d => d.hpsaScore >= threshold)
    .sort((a, b) => b.hpsaScore - a.hpsaScore);
}

/**
 * Get summary statistics for HPSAs, optionally filtered by state.
 */
export function getHpsaStatistics(state?: string): {
  totalDesignations: number;
  primaryCare: number;
  dentalHealth: number;
  mentalHealth: number;
  highSeverity: number;
  ruralCount: number;
  totalPopulationServed: number;
  avgScore: number;
} {
  ensureDiskLoaded();
  if (!_memCache) return {
    totalDesignations: 0, primaryCare: 0, dentalHealth: 0, mentalHealth: 0,
    highSeverity: 0, ruralCount: 0, totalPopulationServed: 0, avgScore: 0,
  };

  const sources = state
    ? [_memCache.states[state.toUpperCase()]].filter(Boolean)
    : Object.values(_memCache.states);

  const all = sources.flatMap(s => s.designations);
  const totalScore = all.reduce((s, d) => s + d.hpsaScore, 0);

  return {
    totalDesignations: all.length,
    primaryCare: all.filter(d => d.hpsaTypeCode === 'PC').length,
    dentalHealth: all.filter(d => d.hpsaTypeCode === 'DH').length,
    mentalHealth: all.filter(d => d.hpsaTypeCode === 'MH').length,
    highSeverity: all.filter(d => d.hpsaScore >= 18).length,
    ruralCount: all.filter(d => d.ruralStatus).length,
    totalPopulationServed: all.reduce((s, d) => s + d.populationServed, 0),
    avgScore: all.length > 0 ? Math.round((totalScore / all.length) * 10) / 10 : 0,
  };
}

/**
 * Get all states data (for national overview).
 */
export function getHpsaAllStates(): Record<string, HpsaStateData> | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.states;
}

/**
 * Get county FIPS codes with HPSAs, for cross-referencing with SDWIS violations.
 */
export function getHpsaCountyFips(state?: string): Set<string> {
  ensureDiskLoaded();
  if (!_memCache) return new Set();

  const sources = state
    ? [_memCache.states[state.toUpperCase()]].filter(Boolean)
    : Object.values(_memCache.states);

  const fips = new Set<string>();
  for (const s of sources) {
    for (const d of s.designations) {
      if (d.countyFips) fips.add(d.countyFips);
    }
  }
  return fips;
}

/**
 * Replace the in-memory cache (called by cron route).
 */
export async function setHpsaCache(data: HpsaCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { totalDesignations: _memCache._meta.totalDesignations, stateCount: _memCache._meta.stateCount }
    : null;
  const newCounts = { totalDesignations: data._meta.totalDesignations, stateCount: data._meta.stateCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[HRSA HPSA Cache] In-memory updated: ${data._meta.totalDesignations} designations, ` +
    `${data._meta.stateCount} states`
  );
  saveToDisk();
  await saveCacheToBlob('cache/hrsa-hpsa.json', data);
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isHpsaBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[HRSA HPSA Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setHpsaBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getHpsaCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    totalDesignations: _memCache._meta.totalDesignations,
    stateCount: _memCache._meta.stateCount,
    highSeverityTotal: _memCache._meta.highSeverityTotal,
    ruralCount: _memCache._meta.ruralCount,
    byType: _memCache._meta.byType,
    lastDelta: _lastDelta,
  };
}
