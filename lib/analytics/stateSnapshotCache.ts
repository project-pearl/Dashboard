/**
 * State Snapshot Cache — daily metric accumulator for trend analysis.
 *
 * Stores up to 365 daily DailyStateSnapshot per state.
 * Follows the standard cache pattern: in-memory singleton + disk + Vercel Blob.
 *
 * Populated by the build-assessments cron which compiles each state's
 * current metrics from existing warmed caches (no new API calls).
 */

import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';
import { loadCacheFromDisk, saveCacheToDisk } from '../cacheUtils';
import type { DailyStateSnapshot } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_DAYS = 365;
const BLOB_PATH = 'cache/state-snapshots.json';
const DISK_FILE = 'state-snapshots.json';

// ── Cache Singleton ──────────────────────────────────────────────────────────

interface SnapshotCacheData {
  _meta: {
    built: string;
    stateCount: number;
    totalSnapshots: number;
  };
  snapshots: Record<string, DailyStateSnapshot[]>;
}

let _cache: SnapshotCacheData | null = null;
let _diskLoaded = false;
let _blobChecked = false;

// ── Disk Persistence ─────────────────────────────────────────────────────────

function ensureDiskLoaded(): void {
  if (_diskLoaded) return;
  _diskLoaded = true;
  const data = loadCacheFromDisk<SnapshotCacheData>(DISK_FILE);
  if (data?._meta?.built && data?.snapshots) {
    _cache = data;
    console.log(`[Snapshot Cache] Loaded from disk (${data._meta.stateCount} states, ${data._meta.totalSnapshots} snapshots)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Warm the cache: disk first, then blob if empty.
 */
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_cache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;

  const data = await loadCacheFromBlob<SnapshotCacheData>(BLOB_PATH);
  if (data?._meta?.built && data?.snapshots) {
    _cache = data;
    console.warn(`[Snapshot Cache] Loaded from blob (${data._meta.stateCount} states, ${data._meta.totalSnapshots} snapshots)`);
  }
}

/**
 * Get snapshots for a state. Optionally limit to last N days.
 */
export function getSnapshots(state: string, days?: number): DailyStateSnapshot[] {
  ensureDiskLoaded();
  if (!_cache?.snapshots) return [];
  const all = _cache.snapshots[state] ?? [];
  if (!days) return all;
  return all.slice(-days);
}

/**
 * Get all snapshots keyed by state (used by the orchestrator).
 */
export function getAllSnapshots(): Record<string, DailyStateSnapshot[]> {
  ensureDiskLoaded();
  return _cache?.snapshots ?? {};
}

/**
 * Append a snapshot for a state. Trims to MAX_DAYS rolling window.
 * Deduplicates by date (last-write-wins).
 */
export function appendSnapshot(state: string, snapshot: DailyStateSnapshot): void {
  ensureDiskLoaded();
  if (!_cache) {
    _cache = {
      _meta: { built: new Date().toISOString(), stateCount: 0, totalSnapshots: 0 },
      snapshots: {},
    };
  }

  const existing = _cache.snapshots[state] ?? [];

  // Deduplicate: remove existing entry for this date
  const filtered = existing.filter(s => s.date !== snapshot.date);
  filtered.push(snapshot);

  // Sort by date ascending, trim to rolling window
  filtered.sort((a, b) => a.date.localeCompare(b.date));
  if (filtered.length > MAX_DAYS) {
    filtered.splice(0, filtered.length - MAX_DAYS);
  }

  _cache.snapshots[state] = filtered;

  // Update meta
  let totalSnapshots = 0;
  for (const snaps of Object.values(_cache.snapshots)) {
    totalSnapshots += snaps.length;
  }
  _cache._meta = {
    built: new Date().toISOString(),
    stateCount: Object.keys(_cache.snapshots).length,
    totalSnapshots,
  };
}

/**
 * Persist the cache to disk + blob. Call after all appendSnapshot() calls.
 */
export async function saveSnapshotCache(): Promise<void> {
  if (!_cache) return;

  saveCacheToDisk(DISK_FILE, _cache);
  await saveCacheToBlob(BLOB_PATH, _cache);
  console.log(`[Snapshot Cache] Saved (${_cache._meta.stateCount} states, ${_cache._meta.totalSnapshots} snapshots)`);
}

/**
 * Cache status for the unified status endpoint.
 */
export function getSnapshotCacheStatus() {
  ensureDiskLoaded();
  if (!_cache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: 'memory',
    built: _cache._meta.built,
    stateCount: _cache._meta.stateCount,
    totalSnapshots: _cache._meta.totalSnapshots,
  };
}
