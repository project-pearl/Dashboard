/**
 * DoD PFAS Sites Cache — DoD PFAS investigation sites.
 *
 * Populated by /api/cron/rebuild-dod-pfas (daily cron).
 * Uses curated dataset with sample data fallback.
 * State-keyed for state-level lookups.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export type DodBranch = 'Army' | 'Navy' | 'Air Force' | 'Marine Corps' | 'Other';
export type InvestigationStatus = 'assessed' | 'under_investigation' | 'remediation' | 'complete';

export interface DodPfasSite {
  installationName: string;
  branch: DodBranch;
  state: string;
  city: string;
  lat: number;
  lng: number;
  investigationStatus: InvestigationStatus;
  pfasDetected: boolean;
  maxConcentrationPpt: number;
  contaminantTypes: string[];
  affectedMedia: string[];
  lastUpdated: string;
}

export interface DodPfasCacheMeta {
  built: string;
  siteCount: number;
  stateCount: number;
  activeSites: number;
  detectionCount: number;
}

interface DodPfasCacheData {
  _meta: DodPfasCacheMeta;
  states: Record<string, DodPfasSite[]>;
}

export interface DodPfasLookupResult {
  sites: DodPfasSite[];
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: DodPfasCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'dod-pfas-sites.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.states) return false;
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.log(`[DoD PFAS Sites] Loaded from disk (${_memCache._meta.siteCount} sites)`);
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
    fs.writeFileSync(path.join(dir, 'dod-pfas-sites.json'), payload, 'utf-8');
    console.log(`[DoD PFAS Sites] Saved to disk (${(Buffer.byteLength(payload) / 1024 / 1024).toFixed(1)}MB)`);
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
  const data = await loadCacheFromBlob<{ meta: any; states: any }>('cache/dod-pfas-sites.json');
  if (data?.meta && data?.states) {
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.warn(`[DoD PFAS Sites] Loaded from blob (${data.meta.siteCount} sites)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getDodPfasSites(state: string): DodPfasLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const sites = _memCache.states[state.toUpperCase()];
  if (!sites || sites.length === 0) return null;
  return { sites, cacheBuilt: _memCache._meta.built, fromCache: true };
}

export function getDodPfasAllSites(): Record<string, DodPfasSite[]> | null {
  ensureDiskLoaded();
  return _memCache?.states ?? null;
}

export function getActivePfasInvestigations(): DodPfasSite[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const result: DodPfasSite[] = [];
  for (const sites of Object.values(_memCache.states)) {
    for (const s of sites) {
      if (s.investigationStatus === 'under_investigation' || s.investigationStatus === 'remediation') {
        result.push(s);
      }
    }
  }
  return result;
}

export async function setDodPfasSitesCache(data: DodPfasCacheData): Promise<void> {
  const prev = _memCache ? { siteCount: _memCache._meta.siteCount, stateCount: _memCache._meta.stateCount, activeSites: _memCache._meta.activeSites } : null;
  const next = { siteCount: data._meta.siteCount, stateCount: data._meta.stateCount, activeSites: data._meta.activeSites };
  _lastDelta = computeCacheDelta(prev, next, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[DoD PFAS Sites] Updated: ${data._meta.siteCount} sites, ${data._meta.activeSites} active`);
  saveToDisk();
  await saveCacheToBlob('cache/dod-pfas-sites.json', { meta: data._meta, states: data.states });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isDodPfasSitesBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[DoD PFAS Sites] Auto-clearing stale build lock');
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setDodPfasSitesBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getDodPfasSitesCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true, source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built, siteCount: _memCache._meta.siteCount,
    stateCount: _memCache._meta.stateCount, activeSites: _memCache._meta.activeSites,
    detectionCount: _memCache._meta.detectionCount, lastDelta: _lastDelta,
  };
}
