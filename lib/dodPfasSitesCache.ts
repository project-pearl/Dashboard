/**
 * DoD PFAS Investigation Sites Cache — Server-side state-keyed cache for
 * Department of Defense PFAS contamination investigation sites including
 * installation-level investigation status, contaminant types, and affected media.
 *
 * Data source: DoD PFAS Task Force progress reports and installation
 * assessment data cross-referenced with EPA regional records.
 *
 * Populated by /api/cron/rebuild-dod-pfas-sites.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DodPfasSite {
  installationName: string;
  branch: string;
  state: string;
  city: string;
  lat: number;
  lng: number;
  investigationStatus: 'assessed' | 'under_investigation' | 'remediation' | 'complete';
  pfasDetected: boolean;
  maxConcentrationPpt: number | null;
  contaminantTypes: string[];
  affectedMedia: string[];
  lastUpdated: string;
}

interface DodPfasSitesMeta {
  built: string;
  siteCount: number;
  statesCovered: number;
  activeInvestigations: number;
}

interface DodPfasSitesCacheData {
  _meta: DodPfasSitesMeta;
  states: Record<string, DodPfasSite[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: DodPfasSitesCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ─────────────────────────────────────────────────────────

const DISK_FILE = 'dod-pfas-sites.json';
const BLOB_KEY = 'cache/dod-pfas-sites.json';

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', DISK_FILE);
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.states) return false;
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.log(`[DoD PFAS Sites Cache] Loaded from disk (${data.meta.siteCount} sites, built ${data.meta.built})`);
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
    const file = path.join(dir, DISK_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, states: _memCache.states });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[DoD PFAS Sites Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: DodPfasSitesMeta; states: Record<string, DodPfasSite[]> }>(BLOB_KEY);
  if (data?.meta && data?.states) {
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'blob';
    console.warn(`[DoD PFAS Sites Cache] Loaded from blob (${data.meta.siteCount} sites)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getDodPfasSites(state: string): DodPfasSite[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.states[state.toUpperCase()] || [];
}

export function getDodPfasAllSites(): Record<string, DodPfasSite[]> {
  ensureDiskLoaded();
  if (!_memCache) return {};
  return _memCache.states;
}

export function getActivePfasInvestigations(): DodPfasSite[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const result: DodPfasSite[] = [];
  for (const sites of Object.values(_memCache.states)) {
    for (const site of sites) {
      if (site.investigationStatus === 'under_investigation' || site.investigationStatus === 'remediation') {
        result.push(site);
      }
    }
  }
  return result;
}

// ── Setter ───────────────────────────────────────────────────────────────────

export async function setDodPfasSitesCache(data: DodPfasSitesCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { siteCount: _memCache._meta.siteCount, statesCovered: _memCache._meta.statesCovered }
    : null;
  const newCounts = { siteCount: data._meta.siteCount, statesCovered: data._meta.statesCovered };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[DoD PFAS Sites Cache] Updated: ${data._meta.siteCount} sites, ` +
    `${data._meta.statesCovered} states, ${data._meta.activeInvestigations} active investigations`,
  );
  saveToDisk();
  await saveCacheToBlob(BLOB_KEY, { meta: data._meta, states: data.states });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isDodPfasSitesBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[DoD PFAS Sites Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setDodPfasSitesBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getDodPfasSitesCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    siteCount: _memCache._meta.siteCount,
    statesCovered: _memCache._meta.statesCovered,
    activeInvestigations: _memCache._meta.activeInvestigations,
    lastDelta: _lastDelta,
  };
}
