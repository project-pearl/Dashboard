/**
 * Supabase Shared Cache — Lazy-refresh orchestrator backed by Supabase.
 *
 * One row per source+state in `data_snapshots`. Concurrent-safe via
 * `data_refresh_locks` table (row-level PK insert = advisory lock).
 *
 * Key export: getOrRefresh<T>() — check snapshot, if stale call fetchFn,
 * save result, return. Any user's refresh benefits all subsequent readers.
 */

import { createClient } from '@supabase/supabase-js';

// ── Supabase admin client (service-role, bypasses RLS) ────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Staleness thresholds per source ──────────────────────────────────────

const STALENESS_MS: Record<string, number> = {
  icis:    24 * 60 * 60 * 1000,
  sdwis:   24 * 60 * 60 * 1000,
  echo:    24 * 60 * 60 * 1000,
  'nwis-gw': 12 * 60 * 60 * 1000,
  wqp:     24 * 60 * 60 * 1000,
  pfas:     7 * 24 * 60 * 60 * 1000,
  attains:  7 * 24 * 60 * 60 * 1000,
};

const DEFAULT_STALENESS_MS = 24 * 60 * 60 * 1000;
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 min lock expiry

// ── Types ────────────────────────────────────────────────────────────────

export interface SnapshotMeta {
  fetchedAt: string;
  ageLabel: string;
  isStale: boolean;
  recordCount: number;
  fetchDurationMs?: number;
  fetchedBy?: string;
}

export interface GetOrRefreshResult<T> {
  data: T;
  meta: SnapshotMeta;
}

interface GetOrRefreshOptions<T> {
  source: string;
  scopeKey: string;
  fetchFn: () => Promise<T>;
  forceRefresh?: boolean;
  fetchedBy?: string;
}

// ── Age formatting ───────────────────────────────────────────────────────

export function formatAge(ms: number): string {
  if (ms < 60_000) return 'just now';
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  const days = Math.floor(ms / 86_400_000);
  return `${days}d old`;
}

// ── Lock helpers ─────────────────────────────────────────────────────────

async function acquireLock(source: string, scopeKey: string, lockedBy: string): Promise<boolean> {
  // Clean expired locks first
  await supabaseAdmin
    .from('data_refresh_locks')
    .delete()
    .eq('source', source)
    .eq('scope_key', scopeKey)
    .lt('expires_at', new Date().toISOString());

  // Try to insert — PK conflict means lock held
  const { error } = await supabaseAdmin
    .from('data_refresh_locks')
    .insert({
      source,
      scope_key: scopeKey,
      locked_by: lockedBy,
      locked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + LOCK_TTL_MS).toISOString(),
    });

  return !error;
}

async function releaseLock(source: string, scopeKey: string): Promise<void> {
  await supabaseAdmin
    .from('data_refresh_locks')
    .delete()
    .eq('source', source)
    .eq('scope_key', scopeKey);
}

// ── Snapshot read/write ──────────────────────────────────────────────────

async function readSnapshot<T>(source: string, scopeKey: string): Promise<{
  data: T; meta: SnapshotMeta;
} | null> {
  const { data, error } = await supabaseAdmin
    .from('data_snapshots')
    .select('data_json, fetched_at, record_count, fetch_duration_ms, fetched_by')
    .eq('source', source)
    .eq('scope_key', scopeKey)
    .single();

  if (error || !data) return null;

  const fetchedAt = data.fetched_at as string;
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  const threshold = STALENESS_MS[source] ?? DEFAULT_STALENESS_MS;

  return {
    data: data.data_json as T,
    meta: {
      fetchedAt,
      ageLabel: formatAge(ageMs),
      isStale: ageMs > threshold,
      recordCount: data.record_count ?? 0,
      fetchDurationMs: data.fetch_duration_ms ?? undefined,
      fetchedBy: data.fetched_by ?? undefined,
    },
  };
}

async function writeSnapshot<T>(
  source: string,
  scopeKey: string,
  data: T,
  recordCount: number,
  fetchDurationMs: number,
  fetchedBy: string,
): Promise<void> {
  const jsonStr = JSON.stringify(data);
  const sizeBytes = Buffer.byteLength(jsonStr, 'utf-8');

  await supabaseAdmin
    .from('data_snapshots')
    .upsert({
      source,
      scope_key: scopeKey,
      data_json: data,
      record_count: recordCount,
      size_bytes: sizeBytes,
      fetched_at: new Date().toISOString(),
      fetched_by: fetchedBy,
      fetch_duration_ms: fetchDurationMs,
    }, { onConflict: 'source,scope_key' });
}

// ── Main orchestrator ────────────────────────────────────────────────────

/**
 * Get cached data for a source+scope. If stale (or force), re-fetch using
 * the provided fetchFn. Lock prevents thundering herd — second caller
 * waits and reads the snapshot the first caller wrote.
 */
export async function getOrRefresh<T>(opts: GetOrRefreshOptions<T>): Promise<GetOrRefreshResult<T>> {
  const { source, scopeKey, fetchFn, forceRefresh = false, fetchedBy = 'cron' } = opts;

  // 1. Check existing snapshot
  if (!forceRefresh) {
    const existing = await readSnapshot<T>(source, scopeKey);
    if (existing && !existing.meta.isStale) {
      return existing;
    }
  }

  // 2. Try to acquire lock
  const gotLock = await acquireLock(source, scopeKey, fetchedBy);

  if (!gotLock) {
    // Another process is refreshing — wait briefly, then return whatever is in the snapshot
    await new Promise(r => setTimeout(r, 2000));
    const snapshot = await readSnapshot<T>(source, scopeKey);
    if (snapshot) return snapshot;

    // No snapshot at all and locked — wait longer and retry once
    await new Promise(r => setTimeout(r, 5000));
    const retrySnapshot = await readSnapshot<T>(source, scopeKey);
    if (retrySnapshot) return retrySnapshot;

    // Fallback: fetch anyway (lock may have expired)
  }

  // 3. Fetch fresh data
  const start = Date.now();
  try {
    const data = await fetchFn();
    const durationMs = Date.now() - start;

    // Estimate record count from data shape
    const recordCount = Array.isArray(data)
      ? data.length
      : typeof data === 'object' && data !== null
        ? Object.values(data).reduce((sum, v) => sum + (Array.isArray(v) ? v.length : 0), 0)
        : 0;

    await writeSnapshot(source, scopeKey, data, recordCount as number, durationMs, fetchedBy);

    const meta: SnapshotMeta = {
      fetchedAt: new Date().toISOString(),
      ageLabel: 'just now',
      isStale: false,
      recordCount: recordCount as number,
      fetchDurationMs: durationMs,
      fetchedBy,
    };

    return { data, meta };
  } finally {
    if (gotLock) {
      await releaseLock(source, scopeKey);
    }
  }
}

/**
 * Check if a snapshot exists and return its metadata (without the data payload).
 * Useful for freshness checks without transferring large payloads.
 */
export async function getSnapshotMeta(source: string, scopeKey: string): Promise<SnapshotMeta | null> {
  const { data, error } = await supabaseAdmin
    .from('data_snapshots')
    .select('fetched_at, record_count, fetch_duration_ms, fetched_by')
    .eq('source', source)
    .eq('scope_key', scopeKey)
    .single();

  if (error || !data) return null;

  const fetchedAt = data.fetched_at as string;
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  const threshold = STALENESS_MS[source] ?? DEFAULT_STALENESS_MS;

  return {
    fetchedAt,
    ageLabel: formatAge(ageMs),
    isStale: ageMs > threshold,
    recordCount: data.record_count ?? 0,
    fetchDurationMs: data.fetch_duration_ms ?? undefined,
    fetchedBy: data.fetched_by ?? undefined,
  };
}
