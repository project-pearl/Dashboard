/**
 * Cron Health Tracking — in-memory ring buffer with disk + blob persistence.
 * Records cron run outcomes for the ops dashboard.
 */

import { loadCacheFromDisk, saveCacheToDisk } from './cacheUtils';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CronRunRecord {
  name: string;
  status: 'success' | 'error';
  durationMs: number;
  error?: string;
  timestamp: string;
}

export interface CronHealthSummary {
  lastRun: string | null;
  lastStatus: 'success' | 'error' | null;
  successRate24h: number;
  totalRuns24h: number;
  avgDurationMs: number;
}

// ── Storage ──────────────────────────────────────────────────────────────────

const RING_SIZE = 50;
const BLOB_KEY = 'cron-health.json';
const DISK_FILE = 'cron-health.json';

let _history: Map<string, CronRunRecord[]> = new Map();
let _diskLoaded = false;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

// ── Persistence ──────────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  const data = loadCacheFromDisk<Record<string, CronRunRecord[]>>(DISK_FILE);
  if (data && typeof data === 'object') {
    _history = new Map(Object.entries(data));
    return true;
  }
  return false;
}

function saveToDisk(): void {
  const obj: Record<string, CronRunRecord[]> = {};
  for (const [k, v] of _history) obj[k] = v;
  saveCacheToDisk(DISK_FILE, obj);
}

async function saveToBlob(): Promise<void> {
  const obj: Record<string, CronRunRecord[]> = {};
  for (const [k, v] of _history) obj[k] = v;
  await saveCacheToBlob(BLOB_KEY, obj);
}

function debouncedSave(): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    saveToDisk();
    await saveToBlob();
  }, 10_000);
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function ensureWarmed(): Promise<void> {
  if (_diskLoaded) return;
  _diskLoaded = true;
  if (loadFromDisk()) return;
  const data = await loadCacheFromBlob<Record<string, CronRunRecord[]>>(BLOB_KEY);
  if (data && typeof data === 'object') {
    _history = new Map(Object.entries(data));
    saveToDisk();
  }
}

export function recordCronRun(
  name: string,
  status: 'success' | 'error',
  durationMs: number,
  error?: string,
): void {
  const record: CronRunRecord = {
    name,
    status,
    durationMs,
    timestamp: new Date().toISOString(),
    ...(error ? { error: error.slice(0, 500) } : {}),
  };

  const runs = _history.get(name) || [];
  runs.push(record);
  // Ring buffer — keep last RING_SIZE entries
  if (runs.length > RING_SIZE) runs.splice(0, runs.length - RING_SIZE);
  _history.set(name, runs);

  debouncedSave();
}

export function getCronHealthSummary(): Record<string, CronHealthSummary> {
  const now = Date.now();
  const h24 = 24 * 60 * 60 * 1000;
  const result: Record<string, CronHealthSummary> = {};

  for (const [name, runs] of _history) {
    const recent = runs.filter(r => now - new Date(r.timestamp).getTime() < h24);
    const successes = recent.filter(r => r.status === 'success');
    const last = runs[runs.length - 1] || null;

    result[name] = {
      lastRun: last?.timestamp || null,
      lastStatus: last?.status || null,
      successRate24h: recent.length > 0 ? Math.round((successes.length / recent.length) * 100) : 100,
      totalRuns24h: recent.length,
      avgDurationMs: recent.length > 0
        ? Math.round(recent.reduce((sum, r) => sum + r.durationMs, 0) / recent.length)
        : 0,
    };
  }

  return result;
}

export function getCronHistory(): Record<string, CronRunRecord[]> {
  const obj: Record<string, CronRunRecord[]> = {};
  for (const [k, v] of _history) obj[k] = v;
  return obj;
}
