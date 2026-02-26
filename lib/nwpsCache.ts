/**
 * NWPS Cache — Server-side spatial cache for NOAA National Water Prediction Service flood gauges.
 *
 * Populated by /api/cron/rebuild-nwps (every 30 min).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NwpsGauge {
  lid: string;
  name: string;
  state: string;
  county: string;
  lat: number;
  lng: number;
  wfo: string;
  status: 'no_flooding' | 'minor' | 'moderate' | 'major' | 'not_defined';
  observed: { primary: number | null; unit: string; time: string } | null;
  forecast: { primary: number | null; unit: string; time: string } | null;
}

interface GridCell {
  gauges: NwpsGauge[];
}

interface NwpsCacheData {
  _meta: { built: string; gaugeCount: number; gridCells: number };
  grid: Record<string, GridCell>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: NwpsCacheData | null = null;
let _cacheSource: string | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'nwps.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[NWPS Cache] Loaded from disk (${data.meta.gaugeCount} gauges, built ${data.meta.built})`);
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
    const file = path.join(dir, 'nwps.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[NWPS Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/nwps.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[NWPS Cache] Loaded from blob (${data.meta.gaugeCount} gauges)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getNwpsCache(lat: number, lng: number): NwpsGauge[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const gauges: NwpsGauge[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) gauges.push(...cell.gauges);
  }
  return gauges.length > 0 ? gauges : null;
}

export function getNwpsAllGauges(): NwpsGauge[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: NwpsGauge[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.gauges);
  }
  return all;
}

export async function setNwpsCache(data: NwpsCacheData): Promise<void> {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[NWPS Cache] Updated: ${data._meta.gaugeCount} gauges, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/nwps.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNwpsBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NWPS Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setNwpsBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getNwpsCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    gaugeCount: _memCache._meta.gaugeCount,
    gridCells: _memCache._meta.gridCells,
  };
}

export { gridKey };
