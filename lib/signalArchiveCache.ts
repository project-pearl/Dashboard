/**
 * Signal Archive Cache — accumulates signals from authoritative sources over time.
 *
 * Rolling 6-month window. Deduplicates by URL (or source|title for generic URLs).
 * Persisted to disk + Vercel Blob for cold-start survival.
 * Populated by the rebuild-nwis-iv cron every 30 minutes.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import type { Signal } from './signals';

// Re-export for consumers
export type { Signal } from './signals';

// ── Constants ────────────────────────────────────────────────────────────────

const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
const BLOB_PATH = 'cache/signal-archive.json';
const DISK_FILE = 'signal-archive.json';

// ── Cache Singleton ──────────────────────────────────────────────────────────

interface SignalArchiveData {
  built: string;
  signals: Signal[];
}

let _cache: SignalArchiveData | null = null;

// ── Dedup & Expiry ───────────────────────────────────────────────────────────

/** Stable dedup key: use URL unless it's a generic BEACON URL, then source|title prefix */
function dedupKey(s: Signal): string {
  if (s.source === 'beacon' && s.url.includes('epa.gov/beach-tech')) {
    return `${s.source}|${s.title.slice(0, 80)}`;
  }
  return s.url;
}

function deduplicateSignals(signals: Signal[]): Signal[] {
  const map = new Map<string, Signal>();
  for (const s of signals) {
    const key = dedupKey(s);
    const existing = map.get(key);
    // Last-write-wins on publishedAt (keep most recent)
    if (!existing || s.publishedAt > existing.publishedAt) {
      map.set(key, s);
    }
  }
  return Array.from(map.values());
}

function expireSignals(signals: Signal[]): Signal[] {
  const cutoff = new Date(Date.now() - SIX_MONTHS_MS).toISOString();
  return signals.filter(s => s.publishedAt >= cutoff);
}

// ── Disk Persistence ─────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', DISK_FILE);
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.built || !Array.isArray(data?.signals)) return false;
    _cache = data;
    console.log(`[Signal Archive] Loaded from disk (built ${data.built}, ${data.signals.length} signals)`);
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
    const file = path.join(dir, DISK_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(_cache), 'utf-8');
    console.log(`[Signal Archive] Saved to disk (${_cache.signals.length} signals)`);
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

// ── Blob Persistence ─────────────────────────────────────────────────────────

let _blobChecked = false;
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_cache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<SignalArchiveData>(BLOB_PATH);
  if (data?.built && Array.isArray(data?.signals)) {
    _cache = data;
    console.warn(`[Signal Archive] Loaded from blob (${data.signals.length} signals)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Merge fresh signals into the archive. Deduplicates and expires old entries.
 * Saves to disk + blob.
 */
export async function archiveSignals(fresh: Signal[]): Promise<void> {
  ensureDiskLoaded();
  if (!_cache) {
    _cache = { built: new Date().toISOString(), signals: [] };
  }

  const merged = deduplicateSignals([..._cache.signals, ...fresh]);
  const cleaned = expireSignals(merged);

  _cache = { built: new Date().toISOString(), signals: cleaned };

  saveToDisk();
  await saveCacheToBlob(BLOB_PATH, _cache);
  console.log(`[Signal Archive] Archived ${fresh.length} fresh → ${cleaned.length} total after dedup/expiry`);
}

/**
 * Get archived signals. Synchronous read from memory.
 * Filter by state, date range, category, pearlRelevant, and/or limit.
 */
export function getArchivedSignals(opts?: {
  state?: string;
  states?: string[];
  category?: Signal['category'] | Signal['category'][];
  pearlOnly?: boolean;
  since?: string;       // ISO date
  limit?: number;
}): Signal[] {
  ensureDiskLoaded();
  if (!_cache) return [];

  let signals = expireSignals(_cache.signals);

  if (opts?.state) {
    signals = signals.filter(s => s.state === opts.state);
  }
  if (opts?.states?.length) {
    const stateSet = new Set(opts.states);
    signals = signals.filter(s => s.state && stateSet.has(s.state));
  }
  if (opts?.category) {
    const cats = Array.isArray(opts.category) ? opts.category : [opts.category];
    const catSet = new Set(cats);
    signals = signals.filter(s => catSet.has(s.category));
  }
  if (opts?.pearlOnly) {
    signals = signals.filter(s => s.pearlRelevant);
  }
  if (opts?.since) {
    signals = signals.filter(s => s.publishedAt >= opts.since!);
  }

  // Sort by recency
  signals.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  if (opts?.limit) {
    signals = signals.slice(0, opts.limit);
  }

  return signals;
}

/**
 * Get cache metadata for status endpoint.
 */
export function getSignalArchiveStatus() {
  ensureDiskLoaded();
  if (!_cache) return { loaded: false, source: null as string | null };
  const signals = expireSignals(_cache.signals);
  const sources = new Set(signals.map(s => s.source));
  const states = new Set(signals.map(s => s.state).filter(Boolean));
  return {
    loaded: true,
    source: 'memory',
    built: _cache.built,
    signalCount: signals.length,
    sources: Array.from(sources),
    statesWithSignals: Array.from(states),
  };
}
