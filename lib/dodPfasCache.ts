/**
 * DoD PFAS Installation Assessment Cache — Server-side spatial cache for
 * Department of Defense PFAS contamination assessment data.
 *
 * Data source: Curated static JSON (data/dod-pfas-assessments.json) from
 * DoD progress reports, cross-referenced with military-installations.json
 * for coordinates and enriched with EPA ECHO compliance data.
 *
 * Populated by /api/cron/rebuild-dod-pfas (weekly, Sunday 10 PM UTC).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DoDPFASAssessment {
  installationName: string;
  state: string | null;
  branch: 'Army' | 'Navy' | 'Air Force' | 'Marines' | 'National Guard' | 'DLA' | 'Other';
  siteType: 'active' | 'brac' | 'fuds' | 'guard';
  phase: 'pa-si' | 'ri' | 'interim-action' | 'remediation' | 'no-further-action';
  pfasDetected: boolean;
  drinkingWaterExceedance: boolean;
  interimActionCount: number;
  lastUpdated: string;
  lat: number;
  lng: number;
  matchedInstallationId?: string;
  echoFacilityId?: string;
  echoViolationCount?: number;
}

export interface DoDPFASStateSummary {
  state: string;
  totalAssessments: number;
  pfasDetectedCount: number;
  drinkingWaterExceedanceCount: number;
  interimActionTotal: number;
  phaseBreakdown: Record<string, number>;
}

interface GridCell {
  assessments: DoDPFASAssessment[];
}

interface DoDPFASCacheMeta {
  built: string;
  assessmentCount: number;
  statesWithData: number;
  gridCells: number;
  pfasDetectedCount: number;
  drinkingWaterExceedanceCount: number;
}

interface DoDPFASCacheData {
  _meta: DoDPFASCacheMeta;
  grid: Record<string, GridCell>;
  stateSummaries: Record<string, DoDPFASStateSummary>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: DoDPFASCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'dod-pfas.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid, stateSummaries: data.stateSummaries || {} };
    _cacheSource = 'disk';
    console.log(`[DoD PFAS Cache] Loaded from disk (${data.meta.assessmentCount} assessments, built ${data.meta.built})`);
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
    const file = path.join(dir, 'dod-pfas.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: _memCache._meta,
      grid: _memCache.grid,
      stateSummaries: _memCache.stateSummaries,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[DoD PFAS Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any; stateSummaries: any }>('cache/dod-pfas.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid, stateSummaries: data.stateSummaries || {} };
    _cacheSource = 'blob';
    console.warn(`[DoD PFAS Cache] Loaded from blob (${data.meta.assessmentCount} assessments)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getDoDPFASCache(lat: number, lng: number): DoDPFASAssessment[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const assessments: DoDPFASAssessment[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) assessments.push(...cell.assessments);
  }
  return assessments.length > 0 ? assessments : null;
}

export function getDoDPFASForState(state: string): DoDPFASAssessment[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const upper = state.toUpperCase();
  const all: DoDPFASAssessment[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    for (const a of cell.assessments) {
      if (a.state === upper) all.push(a);
    }
  }
  return all;
}

export function getDoDPFASStateSummary(state: string): DoDPFASStateSummary | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.stateSummaries[state.toUpperCase()] || null;
}

export function getDoDPFASAllSummaries(): Record<string, DoDPFASStateSummary> {
  ensureDiskLoaded();
  if (!_memCache) return {};
  return _memCache.stateSummaries;
}

export async function setDoDPFASCache(data: DoDPFASCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { assessmentCount: _memCache._meta.assessmentCount, gridCells: _memCache._meta.gridCells }
    : null;
  const newCounts = { assessmentCount: data._meta.assessmentCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[DoD PFAS Cache] Updated: ${data._meta.assessmentCount} assessments, ` +
    `${data._meta.gridCells} cells, ${data._meta.statesWithData} states`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/dod-pfas.json', {
    meta: data._meta,
    grid: data.grid,
    stateSummaries: data.stateSummaries,
  });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isDoDPFASBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[DoD PFAS Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setDoDPFASBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getDoDPFASCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    assessmentCount: _memCache._meta.assessmentCount,
    statesWithData: _memCache._meta.statesWithData,
    gridCells: _memCache._meta.gridCells,
    pfasDetectedCount: _memCache._meta.pfasDetectedCount,
    drinkingWaterExceedanceCount: _memCache._meta.drinkingWaterExceedanceCount,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
