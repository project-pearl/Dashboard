/**
 * HUC-14 Premium Tier Cache System
 *
 * Manages caching for PIN Precision+ sub-subwatershed analysis.
 * Extends the standard HUC-12 cache with premium tier data.
 */

import { saveCacheToDisk, loadCacheFromDisk } from '../cacheUtils';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';
import type { Huc14Indices } from './huc14Indices';
import type { Huc14Data } from './huc14DataCollector';
import { getHuc14Coverage, isHuc14Eligible } from './huc14Regions';

const DISK_PATH = '.cache/huc14-indices.json';
const DISK_PATH_DATA = '.cache/huc14-data.json';
const DISK_PATH_HISTORY = '.cache/huc14-history.json';
const BLOB_KEY = 'huc14-indices';
const BLOB_KEY_DATA = 'huc14-data';
const BLOB_KEY_HISTORY = 'huc14-history';

const BUILD_LOCK_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes for HUC-14 processing
const MAX_HISTORY_ENTRIES = 100; // More history for premium tier

export interface Huc14Cache {
  indices: Record<string, Huc14Indices>; // Keyed by HUC-14 code
  rawData: Record<string, Huc14Data>; // Raw data cache
  built: boolean;
  source: 'disk' | 'blob' | 'computed';
  lastBuild: string;
  coverage: {
    totalHuc14s: number;
    processedHuc14s: number;
    coveragePercent: number;
    avgPremiumScore: number;
    avgConfidence: number;
  };
}

export interface Huc14HistoryEntry {
  date: string;
  premiumScore: number;
  confidence: number;
  dataQuality: number;
  facilityCount: number;
  contaminantSources: number;
}

// In-memory cache
let _cache: Huc14Cache | null = null;
let _buildInProgress = false;
let _buildStartedAt = 0;
let _diskLoaded = false;
let _history: Record<string, Huc14HistoryEntry[]> = {}; // Keyed by HUC-14

/**
 * Build lock management with auto-clearing
 */
function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;

  // Auto-clear stale locks
  if (Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[HUC-14 Cache] Build lock timeout - clearing stale lock');
    _buildInProgress = false;
    _buildStartedAt = 0;
    return false;
  }

  return true;
}

function setBuildInProgress(inProgress: boolean): void {
  _buildInProgress = inProgress;
  _buildStartedAt = inProgress ? Date.now() : 0;
}

/**
 * Ensure disk cache is loaded once
 */
function ensureDiskLoaded(): void {
  if (_diskLoaded) return;
  _diskLoaded = true;

  // Load indices cache from disk
  const diskCache = loadCacheFromDisk<Huc14Cache>(DISK_PATH);
  if (diskCache && diskCache.indices && Object.keys(diskCache.indices).length > 0) {
    _cache = diskCache;
    console.log(`[HUC-14 Cache] Loaded ${Object.keys(diskCache.indices).length} HUC-14 indices from disk`);
  }

  // Load history from disk
  const historyData = loadCacheFromDisk<Record<string, Huc14HistoryEntry[]>>(DISK_PATH_HISTORY);
  if (historyData && Object.keys(historyData).length > 0) {
    _history = historyData;
    console.log(`[HUC-14 Cache] Loaded history for ${Object.keys(historyData).length} HUC-14s from disk`);
  }
}

/**
 * Ensure HUC-14 cache is loaded and available
 */
export async function ensureWarmed(): Promise<void> {
  if (_cache) return;

  // Try disk first
  ensureDiskLoaded();
  const diskCache = loadCacheFromDisk(DISK_PATH);
  const diskHistory = loadCacheFromDisk(DISK_PATH_HISTORY) || {};

  if (diskCache?.built) {
    _cache = diskCache;
    _history = diskHistory;
    console.log(`[HUC-14 Cache] Loaded from disk: ${Object.keys(_cache.indices).length} HUC-14s`);
    return;
  }

  // Fallback to blob
  try {
    const blobCache = await loadCacheFromBlob(BLOB_KEY);
    const blobHistory = await loadCacheFromBlob(BLOB_KEY_HISTORY) || {};

    if (blobCache?.built) {
      _cache = blobCache;
      _history = blobHistory;

      // Save to disk for next time
      saveCacheToDisk(DISK_PATH, _cache);
      saveCacheToDisk(DISK_PATH_HISTORY, _history);

      console.log(`[HUC-14 Cache] Loaded from blob: ${Object.keys(_cache.indices).length} HUC-14s`);
      return;
    }
  } catch (error) {
    console.warn('[HUC-14 Cache] Failed to load from blob:', error);
  }

  // Initialize empty cache
  _cache = {
    indices: {},
    rawData: {},
    built: false,
    source: 'computed',
    lastBuild: new Date().toISOString(),
    coverage: {
      totalHuc14s: 0,
      processedHuc14s: 0,
      coveragePercent: 0,
      avgPremiumScore: 0,
      avgConfidence: 0
    }
  };

  console.log('[HUC-14 Cache] Initialized empty cache');
}

/**
 * Get indices for specific HUC-14
 */
export function getIndicesForHuc14(huc14: string): Huc14Indices | null {
  ensureDiskLoaded();
  return _cache?.indices[huc14] ?? null;
}

/**
 * Get all HUC-14 indices for a parent HUC-12
 */
export function getHuc14sForHuc12(huc12: string): Huc14Indices[] {
  ensureDiskLoaded();
  if (!_cache) return [];

  return Object.values(_cache.indices).filter(h => h.huc12 === huc12);
}

/**
 * Get raw data for specific HUC-14
 */
export function getRawDataForHuc14(huc14: string): Huc14Data | null {
  ensureDiskLoaded();
  return _cache?.rawData[huc14] ?? null;
}

/**
 * Get all HUC-14 indices
 */
export function getAllHuc14Indices(): Huc14Indices[] {
  ensureDiskLoaded();
  return _cache ? Object.values(_cache.indices) : [];
}

/**
 * Get HUC-14 score history
 */
export function getHuc14History(huc14: string): Huc14HistoryEntry[] {
  ensureDiskLoaded();
  return _history[huc14] ?? [];
}

/**
 * Get cache status
 */
export function getHuc14CacheStatus() {
  ensureDiskLoaded();
  return {
    loaded: !!_cache,
    built: _cache?.built ?? false,
    building: isBuildInProgress(),
    source: _cache?.source ?? 'none',
    lastBuild: _cache?.lastBuild ?? null,
    coverage: _cache?.coverage ?? null,
    huc14Count: _cache ? Object.keys(_cache.indices).length : 0
  };
}

/**
 * Get premium tier statistics
 */
export function getPremiumTierStats() {
  ensureDiskLoaded();
  if (!_cache) return null;

  const indices = Object.values(_cache.indices);

  const byType = {
    metropolitan: indices.filter(idx => idx.regionType === 'metropolitan').length,
    infrastructure: indices.filter(idx => idx.regionType === 'infrastructure').length,
    superfund: indices.filter(idx => idx.regionType === 'superfund').length,
    military: indices.filter(idx => idx.regionType === 'military').length
  };

  const byPriority = {
    critical: indices.filter(idx => idx.priority === 'critical').length,
    high: indices.filter(idx => idx.priority === 'high').length,
    medium: indices.filter(idx => idx.priority === 'medium').length
  };

  const avgPremiumScore = indices.length > 0
    ? indices.reduce((sum, idx) => sum + idx.premiumScore, 0) / indices.length
    : 0;

  const avgConfidence = indices.length > 0
    ? indices.reduce((sum, idx) => sum + idx.premiumConfidence, 0) / indices.length
    : 0;

  return {
    totalHuc14s: indices.length,
    avgPremiumScore: Math.round(avgPremiumScore),
    avgConfidence: Math.round(avgConfidence),
    byType,
    byPriority,
    dataQuality: {
      avgSpatialResolution: indices.length > 0
        ? indices.reduce((sum, idx) => sum + idx.spatialResolution, 0) / indices.length
        : 0,
      avgTemporalResolution: indices.length > 0
        ? indices.reduce((sum, idx) => sum + idx.temporalResolution, 0) / indices.length
        : 0
    }
  };
}

/**
 * Set HUC-14 cache data
 */
export async function setHuc14Cache(
  indices: Record<string, Huc14Indices>,
  rawData: Record<string, Huc14Data>
): Promise<void> {
  if (Object.keys(indices).length === 0) {
    console.log('[HUC-14 Cache] Skipping cache update - no indices provided');
    return;
  }

  const indexArray = Object.values(indices);
  const coverage = calculateCoverage(indexArray);

  _cache = {
    indices,
    rawData,
    built: true,
    source: 'computed',
    lastBuild: new Date().toISOString(),
    coverage
  };

  // Save to disk immediately
  saveCacheToDisk(DISK_PATH, _cache);
  saveCacheToDisk(DISK_PATH_DATA, rawData);

  // Save to blob asynchronously
  try {
    await saveCacheToBlob(BLOB_KEY, _cache);
    await saveCacheToBlob(BLOB_KEY_DATA, rawData);
    console.log(`[HUC-14 Cache] Saved ${Object.keys(indices).length} HUC-14 indices to blob`);
  } catch (error) {
    console.error('[HUC-14 Cache] Failed to save to blob:', error);
  }
}

/**
 * Append score history entries
 */
export async function appendHuc14History(
  entries: Record<string, Huc14HistoryEntry>
): Promise<void> {
  for (const [huc14, entry] of Object.entries(entries)) {
    if (!_history[huc14]) _history[huc14] = [];
    _history[huc14].push(entry);

    // Cap at MAX_HISTORY_ENTRIES
    if (_history[huc14].length > MAX_HISTORY_ENTRIES) {
      _history[huc14] = _history[huc14].slice(-MAX_HISTORY_ENTRIES);
    }
  }

  // Save history
  saveCacheToDisk(DISK_PATH_HISTORY, _history);

  try {
    await saveCacheToBlob(BLOB_KEY_HISTORY, _history);
  } catch (error) {
    console.warn('[HUC-14 Cache] Failed to save history to blob:', error);
  }
}

/**
 * Calculate coverage statistics
 */
function calculateCoverage(indices: Huc14Indices[]) {
  const expectedHuc14s = getHuc14Coverage(); // Get all HUC-12s that should have HUC-14 analysis
  const estimatedTotalHuc14s = expectedHuc14s.length * 8; // ~8 HUC-14s per HUC-12

  const processedHuc14s = indices.length;
  const coveragePercent = estimatedTotalHuc14s > 0
    ? Math.round((processedHuc14s / estimatedTotalHuc14s) * 100)
    : 0;

  const avgPremiumScore = indices.length > 0
    ? indices.reduce((sum, idx) => sum + idx.premiumScore, 0) / indices.length
    : 0;

  const avgConfidence = indices.length > 0
    ? indices.reduce((sum, idx) => sum + idx.premiumConfidence, 0) / indices.length
    : 0;

  return {
    totalHuc14s: estimatedTotalHuc14s,
    processedHuc14s,
    coveragePercent,
    avgPremiumScore: Math.round(avgPremiumScore),
    avgConfidence: Math.round(avgConfidence)
  };
}

/**
 * Build progress tracking
 */
export function getBuildProgress() {
  const expectedCoverage = getHuc14Coverage();
  const currentCount = _cache ? Object.keys(_cache.indices).length : 0;
  const estimatedTotal = expectedCoverage.length * 8; // ~8 HUC-14s per HUC-12

  return {
    building: isBuildInProgress(),
    progress: estimatedTotal > 0 ? Math.round((currentCount / estimatedTotal) * 100) : 0,
    processed: currentCount,
    estimated: estimatedTotal,
    timeRemaining: isBuildInProgress() ? BUILD_LOCK_TIMEOUT_MS - (Date.now() - _buildStartedAt) : 0
  };
}

/**
 * Clear cache (for development/testing)
 */
export function clearHuc14Cache(): void {
  _cache = null;
  _history = {};
  console.log('[HUC-14 Cache] Cache cleared');
}

/**
 * Get HUC-14s that need processing
 */
export function getHuc14sToProcess(): string[] {
  const expectedHuc12s = getHuc14Coverage();
  const processedHuc14s = _cache ? Object.keys(_cache.indices) : [];
  const processedHuc12s = new Set(processedHuc14s.map(h => h.substring(0, 12)));

  // Return HUC-12s that need HUC-14 processing
  return expectedHuc12s.filter(huc12 => !processedHuc12s.has(huc12));
}

/**
 * Export for build progress API
 */
export const buildLockManager = {
  isBuildInProgress,
  setBuildInProgress,
  getBuildStartTime: () => _buildStartedAt,
  getBuildTimeout: () => BUILD_LOCK_TIMEOUT_MS
};

/**
 * Mixed HUC-12/HUC-14 query support
 */
export function getIndicesForLocation(huc12: string): {
  huc12Data: any | null; // From standard indicesCache
  huc14Data: Huc14Indices[] | null; // From premium cache
  hasPremiumCoverage: boolean;
} {
  const hasPremiumCoverage = isHuc14Eligible(huc12);
  const huc14Data = hasPremiumCoverage ? getHuc14sForHuc12(huc12) : null;

  return {
    huc12Data: null, // Would integrate with existing indicesCache
    huc14Data,
    hasPremiumCoverage
  };
}