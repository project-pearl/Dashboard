/**
 * SSO/CSO Cache — Server-side spatial cache for sewer overflow events.
 *
 * Populated by /api/cron/rebuild-ssocso (daily).
 * Grid resolution: 0.1° (~11km). Lookup checks target cell + 8 neighbors.
 * Source: EPA ECHO CWA SSO REST API (last 30 days of overflow reports).
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { gridKey, neighborKeys, computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SsoEvent {
  npdesId: string;
  facilityName: string;
  state: string;
  lat: number;
  lng: number;
  eventType: 'SSO' | 'CSO';
  startDate: string;
  endDate: string | null;
  volume: number | null;       // gallons
  duration: number | null;     // hours
  receivingWater: string | null;
  cause: string | null;
}

interface GridCell {
  events: SsoEvent[];
}

interface SsoCsoCacheData {
  _meta: { built: string; eventCount: number; gridCells: number };
  grid: Record<string, GridCell>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: SsoCsoCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'ssocso.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.grid) return false;
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'disk';
    console.log(`[SSO/CSO Cache] Loaded from disk (${data.meta.eventCount} events, built ${data.meta.built})`);
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
    const file = path.join(dir, 'ssocso.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, grid: _memCache.grid });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[SSO/CSO Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; grid: any }>('cache/ssocso.json');
  if (data?.meta && data?.grid) {
    _memCache = { _meta: data.meta, grid: data.grid };
    _cacheSource = 'blob';
    console.warn(`[SSO/CSO Cache] Loaded from blob (${data.meta.eventCount} events)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getSsoCsoCache(lat: number, lng: number): SsoEvent[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const events: SsoEvent[] = [];
  for (const key of neighborKeys(lat, lng)) {
    const cell = _memCache.grid[key];
    if (cell) events.push(...cell.events);
  }
  return events.length > 0 ? events : null;
}

export function getSsoCsoAll(): SsoEvent[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const all: SsoEvent[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    all.push(...cell.events);
  }
  return all;
}

export function getSsoCsoByState(state: string): SsoEvent[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: SsoEvent[] = [];
  for (const cell of Object.values(_memCache.grid)) {
    for (const e of cell.events) {
      if (e.state === state) results.push(e);
    }
  }
  return results;
}

export async function setSsoCsoCache(data: SsoCsoCacheData): Promise<void> {
  const prevCounts = _memCache ? { eventCount: _memCache._meta.eventCount, gridCells: _memCache._meta.gridCells } : null;
  const newCounts = { eventCount: data._meta.eventCount, gridCells: data._meta.gridCells };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[SSO/CSO Cache] Updated: ${data._meta.eventCount} events, ${data._meta.gridCells} cells`);
  saveToDisk();
  await saveCacheToBlob('cache/ssocso.json', { meta: data._meta, grid: data.grid });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isSsoCsoBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[SSO/CSO Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setSsoCsoBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getSsoCsoCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    eventCount: _memCache._meta.eventCount,
    gridCells: _memCache._meta.gridCells,
    lastDelta: _lastDelta,
  };
}

export { gridKey };
