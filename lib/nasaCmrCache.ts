/**
 * NASA CMR Cache — Server-side cache for NASA Earthdata Common Metadata Repository.
 *
 * Populated by /api/cron/rebuild-nasa-cmr (daily cron).
 * Indexes water quality-relevant satellite dataset collections with granule counts
 * and temporal coverage. Does NOT download actual data products (that requires auth).
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NasaCmrCollection {
  conceptId: string;
  shortName: string;
  title: string;
  platform: string;
  instrument: string;
  processingLevel: string;
  category: string;          // chlorophyll, sst, precipitation, surface-water, ocean-color
  timeStart: string | null;
  timeEnd: string | null;    // null = ongoing
  granuleCount: number;
  cloudHosted: boolean;
  spatialExtent: string;     // bounding box string
  updatedAt: string;
}

export interface NasaCmrCacheMeta {
  built: string;
  collectionCount: number;
  totalGranules: number;
  categories: Record<string, number>;
}

interface NasaCmrCacheData {
  _meta: NasaCmrCacheMeta;
  collections: NasaCmrCollection[];
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: NasaCmrCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'nasa-cmr.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.collections) return false;
    _memCache = { _meta: data.meta, collections: data.collections };
    _cacheSource = 'disk';
    console.log(`[NASA CMR Cache] Loaded from disk (${data.meta.collectionCount} collections)`);
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
    const file = path.join(dir, 'nasa-cmr.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, collections: _memCache.collections });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[NASA CMR Cache] Saved to disk (${_memCache._meta.collectionCount} collections)`);
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
  const data = await loadCacheFromBlob<{ meta: any; collections: any }>('cache/nasa-cmr.json');
  if (data?.meta && data?.collections) {
    _memCache = { _meta: data.meta, collections: data.collections };
    _cacheSource = 'disk';
    console.warn(`[NASA CMR Cache] Loaded from blob (${data.meta.collectionCount} collections)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getNasaCmrCollections(): NasaCmrCollection[] | null {
  ensureDiskLoaded();
  return _memCache?.collections || null;
}

export function getNasaCmrByCategory(category: string): NasaCmrCollection[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.collections.filter(c => c.category === category);
}

export function setNasaCmrCache(data: NasaCmrCacheData): void {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[NASA CMR Cache] Updated: ${data._meta.collectionCount} collections, ${data._meta.totalGranules} granules`);
  saveToDisk();
  saveCacheToBlob('cache/nasa-cmr.json', { meta: data._meta, collections: data.collections });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNasaCmrBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}
export function setNasaCmrBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getNasaCmrCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    collectionCount: _memCache._meta.collectionCount,
    totalGranules: _memCache._meta.totalGranules,
    categories: _memCache._meta.categories,
  };
}
