/**
 * SAM.gov Cache — Server-side cache for registered water-infrastructure contractors.
 *
 * Populated by /api/cron/rebuild-sam (weekly cron).
 * Fetches active entities from SAM.gov Entity API filtered by water/environmental NAICS codes.
 * Per-state storage — Record<stateAbbr, SamEntity[]>.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SamEntity {
  ueiSAM: string;
  cageCode: string;
  legalBusinessName: string;
  dbaName: string;
  city: string;
  stateCode: string;
  zipCode: string;
  primaryNaics: string;
  naicsDescription: string;
  businessType: string;
  registrationStatus: string;
  registrationDate: string;
  expirationDate: string;
  entityUrl: string;
}

interface SamCacheData {
  _meta: {
    built: string;
    entityCount: number;
    statesLoaded: number;
    requestCount: number;
  };
  entities: Record<string, SamEntity[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

const DISK_FILE = 'sam-entities.json';
const BLOB_PATH = 'cache/sam-entities.json';

let _memCache: SamCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', DISK_FILE);
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?._meta || !data?.entities) return false;
    _memCache = data;
    _cacheSource = 'disk';
    console.log(`[SAM Cache] Loaded from disk (${data._meta.entityCount} entities)`);
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
    const payload = JSON.stringify(_memCache);
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[SAM Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.entityCount} entities)`);
  } catch {}
}

let _diskLoaded = false;
function ensureDiskLoaded() {
  if (!_diskLoaded) { _diskLoaded = true; loadFromDisk(); }
}

let _blobChecked = false;
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_memCache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<SamCacheData>(BLOB_PATH);
  if (data?._meta && data?.entities) {
    _memCache = data;
    _cacheSource = 'disk';
    console.warn(`[SAM Cache] Loaded from blob (${data._meta.entityCount} entities)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getSamEntities(stateAbbr: string): SamEntity[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.entities[stateAbbr] || [];
}

export function getSamAllEntities(): SamEntity[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: SamEntity[] = [];
  for (const entities of Object.values(_memCache.entities)) {
    all.push(...entities);
  }
  return all;
}

export async function setSamCache(
  entities: Record<string, SamEntity[]>,
  meta: SamCacheData['_meta'],
): Promise<void> {
  _memCache = { _meta: meta, entities };
  _cacheSource = 'memory (cron)';
  console.log(`[SAM Cache] Updated: ${meta.entityCount} entities across ${meta.statesLoaded} states`);
  saveToDisk();
  await saveCacheToBlob(BLOB_PATH, _memCache);
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isSamBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}
export function setSamBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getSamCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    entityCount: _memCache._meta.entityCount,
    statesLoaded: _memCache._meta.statesLoaded,
    requestCount: _memCache._meta.requestCount,
  };
}
