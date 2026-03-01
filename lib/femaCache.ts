/**
 * FEMA Disaster Declarations Cache — state-keyed cache for recent FEMA declarations.
 *
 * Populated by /api/cron/rebuild-fema (daily at 3:00 AM UTC).
 * Persisted to disk + Vercel Blob for cold-start survival.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FemaDeclaration {
  disasterNumber: number;
  state: string;
  declarationDate: string;
  incidentType: string;
  declarationTitle: string;
  declarationType: string;
  designatedArea: string;
  fipsStateCode: string;
  fipsCountyCode: string;
}

interface FemaCacheData {
  built: string;
  declarations: Record<string, { declarations: FemaDeclaration[]; fetched: string }>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _cache: FemaCacheData | null = null;
let _cacheSource: string | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'fema-declarations.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.built || !data?.declarations) return false;
    _cache = data;
    _cacheSource = 'disk';
    console.log(`[FEMA Cache] Loaded from disk (built ${data.built})`);
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
    const file = path.join(dir, 'fema-declarations.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify(_cache);
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[FEMA Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<FemaCacheData>('cache/fema-declarations.json');
  if (data?.built && data?.declarations) {
    _cache = data;
    _cacheSource = 'blob';
    console.warn(`[FEMA Cache] Loaded from blob`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get declarations for a specific state. */
export function getFemaDeclarations(state: string): FemaDeclaration[] | null {
  ensureDiskLoaded();
  if (!_cache) return null;
  const entry = _cache.declarations[state.toUpperCase()];
  return entry?.declarations ?? null;
}

/** Get all declarations across all states. */
export function getFemaDeclarationsAll(): FemaDeclaration[] {
  ensureDiskLoaded();
  if (!_cache) return [];
  const all: FemaDeclaration[] = [];
  for (const entry of Object.values(_cache.declarations)) {
    all.push(...entry.declarations);
  }
  return all;
}

/** Bulk-set declarations for all states (single blob write). */
export async function setFemaCache(
  declsByState: Record<string, { declarations: FemaDeclaration[]; fetched: string }>
): Promise<void> {
  _cache = {
    built: new Date().toISOString(),
    declarations: declsByState,
  };
  _cacheSource = 'memory (cron)';
  saveToDisk();
  await saveCacheToBlob('cache/fema-declarations.json', _cache);
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isFemaBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[FEMA Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setFemaBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getFemaCacheStatus() {
  ensureDiskLoaded();
  if (!_cache) return { loaded: false, source: null as string | null };
  const all = getFemaDeclarationsAll();
  const statesWithDeclarations = Object.entries(_cache.declarations)
    .filter(([, entry]) => entry.declarations.length > 0)
    .map(([state]) => state);
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _cache.built,
    declarationCount: all.length,
    statesWithDeclarations: statesWithDeclarations.length,
  };
}
