/**
 * Data.gov CKAN Cache — Server-side cache for US government open data catalog.
 *
 * Populated by /api/cron/rebuild-datagov (weekly cron).
 * Indexes water quality-related datasets from catalog.data.gov CKAN API.
 * This is a metadata catalog — it tells you where data lives, not the data itself.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DataGovDataset {
  id: string;
  title: string;
  organization: string;
  description: string;
  url: string;
  formats: string[];
  tags: string[];
  modified: string;
  spatial: string | null;     // GeoJSON bbox or null
}

export interface DataGovCacheMeta {
  built: string;
  datasetCount: number;
  organizations: Record<string, number>;
  topTags: Record<string, number>;
}

interface DataGovCacheData {
  _meta: DataGovCacheMeta;
  datasets: DataGovDataset[];
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: DataGovCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'datagov-catalog.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.datasets) return false;
    _memCache = { _meta: data.meta, datasets: data.datasets };
    _cacheSource = 'disk';
    console.log(`[Data.gov Cache] Loaded from disk (${data.meta.datasetCount} datasets)`);
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
    const file = path.join(dir, 'datagov-catalog.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, datasets: _memCache.datasets });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[Data.gov Cache] Saved to disk (${_memCache._meta.datasetCount} datasets)`);
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
  const data = await loadCacheFromBlob<{ meta: any; datasets: any }>('cache/datagov.json');
  if (data?.meta && data?.datasets) {
    _memCache = { _meta: data.meta, datasets: data.datasets };
    _cacheSource = 'disk';
    console.warn(`[Data.gov Cache] Loaded from blob (${data.meta.datasetCount} datasets)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getDataGovDatasets(): DataGovDataset[] | null {
  ensureDiskLoaded();
  return _memCache?.datasets || null;
}

export async function setDataGovCache(data: DataGovCacheData): Promise<void> {
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[Data.gov Cache] Updated: ${data._meta.datasetCount} datasets`);
  saveToDisk();
  await saveCacheToBlob('cache/datagov.json', { meta: data._meta, datasets: data.datasets });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isDataGovBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}
export function setDataGovBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getDataGovCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    datasetCount: _memCache._meta.datasetCount,
    organizations: _memCache._meta.organizations,
  };
}
