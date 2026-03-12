/**
 * Hazard Mitigation Cache — state-keyed cache for FEMA Hazard Mitigation Assistance Projects.
 *
 * Populated by /api/cron/rebuild-haz-mit (weekly, Sunday 10:00 PM UTC).
 * Source: https://www.fema.gov/api/open/v4/HazardMitigationAssistanceProjects
 * Persisted to disk + Vercel Blob for cold-start survival.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HazMitProject {
  state: string;
  county: string;
  projectType: string;
  status: string;
  projectAmount: number;
  benefitCostRatio: number | null;
  federalShareObligated: number;
  dateApproved: string | null;
  numberOfProperties: number | null;
  programArea: string;
  recipient: string;
  subrecipient: string;
}

interface HazMitCacheData {
  built: string;
  projects: Record<string, { projects: HazMitProject[]; fetched: string }>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _cache: HazMitCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'haz-mit.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.built || !data?.projects) return false;
    _cache = data;
    _cacheSource = 'disk';
    console.log(`[HazMit Cache] Loaded from disk (built ${data.built})`);
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
    const file = path.join(dir, 'haz-mit.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(_cache), 'utf-8');
    console.log(`[HazMit Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<HazMitCacheData>('cache/haz-mit.json');
  if (data?.built && data?.projects) {
    _cache = data;
    _cacheSource = 'blob';
    console.warn(`[HazMit Cache] Loaded from blob`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get hazard mitigation projects for a specific state. */
export function getHazMitProjects(state: string): HazMitProject[] | null {
  ensureDiskLoaded();
  if (!_cache) return null;
  const entry = _cache.projects[state.toUpperCase()];
  return entry?.projects ?? null;
}

/** Get all hazard mitigation projects across all states. */
export function getHazMitProjectsAll(): HazMitProject[] {
  ensureDiskLoaded();
  if (!_cache) return [];
  const all: HazMitProject[] = [];
  for (const entry of Object.values(_cache.projects)) {
    all.push(...entry.projects);
  }
  return all;
}

/** Bulk-set projects for all states. */
export async function setHazMitCache(
  projectsByState: Record<string, { projects: HazMitProject[]; fetched: string }>
): Promise<void> {
  const prevCounts = _cache ? {
    projectCount: Object.values(_cache.projects).reduce((s, e) => s + e.projects.length, 0),
    statesWithProjects: Object.keys(_cache.projects).filter(k => _cache!.projects[k].projects.length > 0).length,
  } : null;
  const newProjectCount = Object.values(projectsByState).reduce((s, e) => s + e.projects.length, 0);
  const newStatesCount = Object.keys(projectsByState).filter(k => projectsByState[k].projects.length > 0).length;
  const newCounts = { projectCount: newProjectCount, statesWithProjects: newStatesCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _cache?.built ?? null);
  _cache = {
    built: new Date().toISOString(),
    projects: projectsByState,
  };
  _cacheSource = 'memory (cron)';
  saveToDisk();
  await saveCacheToBlob('cache/haz-mit.json', _cache);
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isHazMitBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[HazMit Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setHazMitBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getHazMitCacheStatus() {
  ensureDiskLoaded();
  if (!_cache) return { loaded: false, source: null as string | null };
  const all = getHazMitProjectsAll();
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _cache.built,
    projectCount: all.length,
    statesWithProjects: Object.keys(_cache.projects).filter(k => _cache!.projects[k].projects.length > 0).length,
    lastDelta: _lastDelta,
  };
}
