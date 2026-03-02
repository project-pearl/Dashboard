/**
 * Shared cache utilities used across cache modules.
 */

// ── Delta Tracking ──────────────────────────────────────────────────────────

export interface CacheDelta {
  computedAt: string;
  previousBuild: string | null;
  dataChanged: boolean;
  counts: Record<string, { before: number; after: number; diff: number }>;
  states?: { added: string[]; removed: string[] };
  buildDurationSec?: number;
}

/**
 * Compare previous and new cache counts to produce a lightweight delta.
 * Each cache module calls this in its set*Cache() before overwriting _memCache.
 */
export function computeCacheDelta(
  prevCounts: Record<string, number> | null,
  newCounts: Record<string, number>,
  previousBuild: string | null,
  options?: {
    prevStates?: string[];
    newStates?: string[];
    buildStartTime?: number;
  },
): CacheDelta {
  const counts: CacheDelta['counts'] = {};
  let dataChanged = false;

  for (const key of Object.keys(newCounts)) {
    const before = prevCounts?.[key] ?? 0;
    const after = newCounts[key];
    const diff = after - before;
    counts[key] = { before, after, diff };
    if (diff !== 0) dataChanged = true;
  }

  const delta: CacheDelta = {
    computedAt: new Date().toISOString(),
    previousBuild: previousBuild,
    dataChanged,
    counts,
  };

  if (options?.prevStates || options?.newStates) {
    const prev = new Set(options.prevStates ?? []);
    const next = new Set(options.newStates ?? []);
    delta.states = {
      added: [...next].filter(s => !prev.has(s)),
      removed: [...prev].filter(s => !next.has(s)),
    };
    if (delta.states.added.length > 0 || delta.states.removed.length > 0) {
      dataChanged = true;
      delta.dataChanged = true;
    }
  }

  if (options?.buildStartTime) {
    delta.buildDurationSec = Math.round((Date.now() - options.buildStartTime) / 1000);
  }

  return delta;
}

const GRID_RES = 0.1;

/**
 * Compute a grid key from lat/lng at 0.1° resolution (~11km).
 */
export function gridKey(lat: number, lng: number): string {
  const glat = (Math.floor(lat / GRID_RES) * GRID_RES).toFixed(2);
  const glng = (Math.floor(lng / GRID_RES) * GRID_RES).toFixed(2);
  return `${parseFloat(glat)}_${parseFloat(glng)}`;
}

/**
 * Get all neighbor grid keys for a lat/lng (3x3 grid = 9 cells).
 */
export function neighborKeys(lat: number, lng: number): string[] {
  const keys: string[] = [];
  for (let dlat = -1; dlat <= 1; dlat++) {
    for (let dlng = -1; dlng <= 1; dlng++) {
      keys.push(gridKey(lat + dlat * GRID_RES, lng + dlng * GRID_RES));
    }
  }
  return keys;
}

/**
 * Load a JSON cache file from disk. Returns null if file doesn't exist or parse fails.
 */
export function loadCacheFromDisk<T>(filename: string): T | null {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', filename);
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save a JSON cache file to disk. Creates .cache/ directory if needed.
 * Returns file size in MB or null on failure.
 */
export function saveCacheToDisk(filename: string, data: unknown): number | null {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    const file = path.join(dir, filename);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify(data);
    fs.writeFileSync(file, payload, 'utf-8');
    return Buffer.byteLength(payload) / 1024 / 1024;
  } catch {
    return null;
  }
}

// ── Delta Export ──────────────────────────────────────────────────────────

/**
 * Serialize all non-null lastDelta objects from a cache-status response
 * into a downloadable snapshot. Pure function, no side effects.
 */
export function exportDeltaLog(
  caches: Record<string, { lastDelta?: CacheDelta | null }>
): { snapshotTimestamp: string; deltas: Array<{ cacheName: string } & CacheDelta> } {
  const deltas: Array<{ cacheName: string } & CacheDelta> = [];
  for (const [name, cache] of Object.entries(caches)) {
    if (cache.lastDelta) {
      deltas.push({ cacheName: name, ...cache.lastDelta });
    }
  }
  return { snapshotTimestamp: new Date().toISOString(), deltas };
}
