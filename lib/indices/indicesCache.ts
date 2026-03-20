import type { HucIndices } from './types';
import type { ScoreHistoryEntry } from './projections';
import { loadCacheFromDisk, saveCacheToDisk } from '@/lib/cacheUtils';
import { saveCacheToBlob, loadCacheFromBlob } from '@/lib/blobPersistence';
import {
  BLOB_PATH_INDICES,
  BLOB_PATH_HISTORY,
  DISK_PATH_INDICES,
  DISK_PATH_HISTORY,
  BUILD_LOCK_TIMEOUT_MS,
  MAX_HISTORY_ENTRIES,
} from './config';

/* ── In-memory state ─────────────────────────────────────────── */

interface IndicesCacheData {
  _meta: { built: string; totalHucs: number; avgConfidence: number };
  indices: Record<string, HucIndices>;
}

let _cache: IndicesCacheData | null = null;
let _scoreHistory: Record<string, ScoreHistoryEntry[]> = {};
let _diskLoaded = false;

let _buildInProgress = false;
let _buildStartedAt = 0;

/* ── Build lock ──────────────────────────────────────────────── */

export function isBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Indices Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

/* ── Disk persistence ────────────────────────────────────────── */

function ensureDiskLoaded(): void {
  if (_diskLoaded) return;
  _diskLoaded = true;
  const diskData = loadCacheFromDisk<IndicesCacheData>(DISK_PATH_INDICES);
  if (diskData && diskData.indices && Object.keys(diskData.indices).length > 0) {
    _cache = diskData;
    console.log(`[Indices Cache] Loaded ${Object.keys(diskData.indices).length} HUCs from disk`);
  }
  const histData = loadCacheFromDisk<Record<string, ScoreHistoryEntry[]>>(DISK_PATH_HISTORY);
  if (histData && Object.keys(histData).length > 0) {
    _scoreHistory = histData;
    console.log(`[Indices Cache] Loaded score history for ${Object.keys(histData).length} HUCs from disk`);
  }
}

/* ── Blob warm ───────────────────────────────────────────────── */

export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_cache && Object.keys(_cache.indices).length > 0) return;

  const blobData = await loadCacheFromBlob<IndicesCacheData>(BLOB_PATH_INDICES);
  if (blobData && blobData.indices && Object.keys(blobData.indices).length > 0) {
    _cache = blobData;
    saveCacheToDisk(DISK_PATH_INDICES, blobData);
    console.log(`[Indices Cache] Warmed ${Object.keys(blobData.indices).length} HUCs from blob`);
  }

  if (Object.keys(_scoreHistory).length === 0) {
    const histBlob = await loadCacheFromBlob<Record<string, ScoreHistoryEntry[]>>(BLOB_PATH_HISTORY);
    if (histBlob && Object.keys(histBlob).length > 0) {
      _scoreHistory = histBlob;
      saveCacheToDisk(DISK_PATH_HISTORY, histBlob);
      console.log(`[Indices Cache] Warmed score history from blob`);
    }
  }
}

/* ── Read API ────────────────────────────────────────────────── */

export function getIndicesForHuc(huc12: string): HucIndices | null {
  ensureDiskLoaded();
  return _cache?.indices[huc12] ?? null;
}

// Backwards compatibility - look up by HUC-8 (returns all HUC-12s within that HUC-8)
export function getIndicesForHuc8(huc8: string): HucIndices[] {
  ensureDiskLoaded();
  if (!_cache) return [];
  return Object.values(_cache.indices).filter(h => h.huc8 === huc8);
}

export function getAllIndices(): HucIndices[] {
  ensureDiskLoaded();
  return _cache ? Object.values(_cache.indices) : [];
}

export function getScoreHistory(huc12: string): ScoreHistoryEntry[] {
  ensureDiskLoaded();
  return _scoreHistory[huc12] ?? [];
}

export function getCacheStatus() {
  ensureDiskLoaded();
  return {
    status: _cache ? 'ready' as const : 'cold' as const,
    totalHucs: _cache ? Object.keys(_cache.indices).length : 0,
    lastBuilt: _cache?._meta?.built ?? null,
    avgConfidence: _cache?._meta?.avgConfidence ?? 0,
    buildInProgress: isBuildInProgress(),
  };
}

/* ── State-level composite aggregation ───────────────────────── */

export function getStateCompositeScore(stateAbbr: string): { score: number; confidence: number; hucCount: number } | null {
  ensureDiskLoaded();
  if (!_cache) return null;
  const stateHucs = Object.values(_cache.indices).filter(h => h.stateAbbr === stateAbbr);
  if (stateHucs.length === 0) return null;
  const score = Math.round(stateHucs.reduce((s, h) => s + h.composite, 0) / stateHucs.length);
  const confidence = Math.round(stateHucs.reduce((s, h) => s + h.compositeConfidence, 0) / stateHucs.length);
  return { score, confidence, hucCount: stateHucs.length };
}

export function getAllStateCompositeScores(): Record<string, { score: number; confidence: number; hucCount: number }> {
  ensureDiskLoaded();
  if (!_cache) return {};
  const byState: Record<string, { sum: number; confSum: number; count: number }> = {};
  for (const h of Object.values(_cache.indices)) {
    if (!byState[h.stateAbbr]) byState[h.stateAbbr] = { sum: 0, confSum: 0, count: 0 };
    byState[h.stateAbbr].sum += h.composite;
    byState[h.stateAbbr].confSum += h.compositeConfidence;
    byState[h.stateAbbr].count++;
  }
  const result: Record<string, { score: number; confidence: number; hucCount: number }> = {};
  for (const [abbr, d] of Object.entries(byState)) {
    result[abbr] = {
      score: Math.round(d.sum / d.count),
      confidence: Math.round(d.confSum / d.count),
      hucCount: d.count,
    };
  }
  return result;
}

/* ── Write API ───────────────────────────────────────────────── */

export async function setIndicesCache(
  indices: Record<string, HucIndices>,
  meta: { built: string; totalHucs: number; avgConfidence: number },
): Promise<void> {
  const data: IndicesCacheData = { _meta: meta, indices };
  _cache = data;
  saveCacheToDisk(DISK_PATH_INDICES, data);
  await saveCacheToBlob(BLOB_PATH_INDICES, data);
}

export async function appendScoreHistory(
  entries: Record<string, ScoreHistoryEntry>,
): Promise<void> {
  for (const [huc12, entry] of Object.entries(entries)) {
    if (!_scoreHistory[huc12]) _scoreHistory[huc12] = [];
    _scoreHistory[huc12].push(entry);
    // Cap at MAX_HISTORY_ENTRIES
    if (_scoreHistory[huc12].length > MAX_HISTORY_ENTRIES) {
      _scoreHistory[huc12] = _scoreHistory[huc12].slice(-MAX_HISTORY_ENTRIES);
    }
  }
  saveCacheToDisk(DISK_PATH_HISTORY, _scoreHistory);
  await saveCacheToBlob(BLOB_PATH_HISTORY, _scoreHistory);
}
