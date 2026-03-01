/**
 * Shared Cache — Lazy-refresh orchestrator.
 *
 * Primary: Supabase `data_snapshots` table (cross-instance, queryable, lockable).
 * Fallback: Vercel Blob (proven, always works).
 *
 * Every Supabase call is wrapped in try/catch → blob fallback. If Supabase
 * is misconfigured, missing tables, RLS issues, etc., the system keeps working
 * via blob. Locks degrade to "no lock" (accept thundering herd) rather than fail.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Supabase admin client (lazy, service-role) ──────────────────────────────

let _supabaseAdmin: SupabaseClient | null = null;
let _supabaseAvailable: boolean | null = null; // null = untested

function getSupabase(): SupabaseClient | null {
  if (_supabaseAvailable === false) return null;
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      _supabaseAvailable = false;
      console.warn('[SharedCache] Supabase env vars missing — blob-only mode');
      return null;
    }
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}

/** Mark Supabase as unavailable after repeated failures */
let _supabaseFailures = 0;
function onSupabaseError(context: string, err: any) {
  _supabaseFailures++;
  console.warn(`[SharedCache] Supabase ${context} failed (${_supabaseFailures}x): ${err?.message || err}`);
  if (_supabaseFailures >= 3) {
    _supabaseAvailable = false;
    console.warn('[SharedCache] Supabase disabled after 3 failures — blob-only mode');
  }
}

// ── Staleness thresholds per source ──────────────────────────────────────────

const STALENESS_MS: Record<string, number> = {
  icis:      24 * 60 * 60 * 1000,
  sdwis:     24 * 60 * 60 * 1000,
  echo:      24 * 60 * 60 * 1000,
  'nwis-gw': 12 * 60 * 60 * 1000,
  wqp:       24 * 60 * 60 * 1000,
  pfas:       7 * 24 * 60 * 60 * 1000,
  attains:    7 * 24 * 60 * 60 * 1000,
};

const DEFAULT_STALENESS_MS = 24 * 60 * 60 * 1000;
const LOCK_TTL_MS = 5 * 60 * 1000;

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Blob path convention ─────────────────────────────────────────────────────

function blobPath(source: string, scopeKey: string): string {
  return `shared-cache/${source}/${scopeKey}.json`;
}

function blobMetaPath(source: string, scopeKey: string): string {
  return `shared-cache/${source}/${scopeKey}.meta.json`;
}

// ── Age formatting ───────────────────────────────────────────────────────────

export function formatAge(ms: number): string {
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  const days = Math.floor(ms / 86_400_000);
  return `${days}d old`;
}

function buildMeta(fetchedAt: string, source: string, recordCount: number, fetchDurationMs?: number, fetchedBy?: string): SnapshotMeta {
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  const threshold = STALENESS_MS[source] ?? DEFAULT_STALENESS_MS;
  return {
    fetchedAt,
    ageLabel: formatAge(ageMs),
    isStale: ageMs > threshold,
    recordCount,
    fetchDurationMs,
    fetchedBy,
  };
}

// ── Lock helpers (Supabase only — degrade to "no lock" on failure) ───────────

async function acquireLock(source: string, scopeKey: string, lockedBy: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return true; // No Supabase → skip locking, proceed with fetch

  try {
    // Clean expired locks first
    await sb.from('data_refresh_locks')
      .delete()
      .eq('source', source)
      .eq('scope_key', scopeKey)
      .lt('expires_at', new Date().toISOString());

    // Insert — PK conflict means lock held by another process
    const { error } = await sb.from('data_refresh_locks').insert({
      source,
      scope_key: scopeKey,
      locked_by: lockedBy,
      locked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + LOCK_TTL_MS).toISOString(),
    });

    return !error;
  } catch (err) {
    onSupabaseError('acquireLock', err);
    return true; // Degrade: proceed without lock
  }
}

async function releaseLock(source: string, scopeKey: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  try {
    await sb.from('data_refresh_locks')
      .delete()
      .eq('source', source)
      .eq('scope_key', scopeKey);
  } catch (err) {
    onSupabaseError('releaseLock', err);
  }
}

// ── Snapshot read: Supabase → blob fallback ──────────────────────────────────

async function readSnapshot<T>(source: string, scopeKey: string): Promise<{
  data: T; meta: SnapshotMeta;
} | null> {
  // Try Supabase first
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('data_snapshots')
        .select('data_json, fetched_at, record_count, fetch_duration_ms, fetched_by')
        .eq('source', source)
        .eq('scope_key', scopeKey)
        .single();

      if (!error && data) {
        return {
          data: data.data_json as T,
          meta: buildMeta(
            data.fetched_at,
            source,
            data.record_count ?? 0,
            data.fetch_duration_ms ?? undefined,
            data.fetched_by ?? undefined,
          ),
        };
      }
    } catch (err) {
      onSupabaseError('readSnapshot', err);
    }
  }

  // Fallback: blob
  try {
    const payload = await loadCacheFromBlob<{ data: T; meta: SnapshotMeta }>(blobPath(source, scopeKey));
    if (payload?.data && payload?.meta) {
      // Recalculate age/staleness (blob meta may be stale)
      return {
        data: payload.data,
        meta: buildMeta(
          payload.meta.fetchedAt,
          source,
          payload.meta.recordCount,
          payload.meta.fetchDurationMs,
          payload.meta.fetchedBy,
        ),
      };
    }
  } catch {
    // Both failed — return null
  }

  return null;
}

// ── Snapshot write: Supabase + blob (both, for redundancy) ───────────────────

async function writeSnapshot<T>(
  source: string,
  scopeKey: string,
  data: T,
  recordCount: number,
  fetchDurationMs: number,
  fetchedBy: string,
): Promise<void> {
  const fetchedAt = new Date().toISOString();
  const meta = buildMeta(fetchedAt, source, recordCount, fetchDurationMs, fetchedBy);

  // Write to Supabase (non-blocking failure)
  const sb = getSupabase();
  if (sb) {
    try {
      const jsonStr = JSON.stringify(data);
      const sizeBytes = Buffer.byteLength(jsonStr, 'utf-8');

      await sb.from('data_snapshots').upsert({
        source,
        scope_key: scopeKey,
        data_json: data,
        record_count: recordCount,
        size_bytes: sizeBytes,
        fetched_at: fetchedAt,
        fetched_by: fetchedBy,
        fetch_duration_ms: fetchDurationMs,
      }, { onConflict: 'source,scope_key' });
    } catch (err) {
      onSupabaseError('writeSnapshot', err);
    }
  }

  // Always write to blob as backup
  await saveCacheToBlob(blobPath(source, scopeKey), { data, meta });
}

// ── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Get cached data for a source+scope. If stale (or force), re-fetch using
 * the provided fetchFn. Lock prevents thundering herd when Supabase is
 * available; degrades to unlocked fetch via blob if not.
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

  // 2. Try to acquire lock (Supabase only — degrades to no-lock)
  const gotLock = await acquireLock(source, scopeKey, fetchedBy);

  if (!gotLock) {
    // Another process is refreshing — wait, then return whatever snapshot exists
    await new Promise(r => setTimeout(r, 2000));
    const snapshot = await readSnapshot<T>(source, scopeKey);
    if (snapshot) return snapshot;

    await new Promise(r => setTimeout(r, 5000));
    const retrySnapshot = await readSnapshot<T>(source, scopeKey);
    if (retrySnapshot) return retrySnapshot;

    // Lock may have expired — fall through to fetch
  }

  // 3. Fetch fresh data
  const start = Date.now();
  try {
    const data = await fetchFn();
    const durationMs = Date.now() - start;

    // Estimate record count
    const recordCount = Array.isArray(data)
      ? data.length
      : typeof data === 'object' && data !== null
        ? Object.values(data as Record<string, unknown>).reduce(
            (sum: number, v) => sum + (Array.isArray(v) ? v.length : 0), 0)
        : 0;

    await writeSnapshot(source, scopeKey, data, recordCount, durationMs, fetchedBy);

    return {
      data,
      meta: {
        fetchedAt: new Date().toISOString(),
        ageLabel: 'just now',
        isStale: false,
        recordCount,
        fetchDurationMs: durationMs,
        fetchedBy,
      },
    };
  } finally {
    if (gotLock) {
      await releaseLock(source, scopeKey);
    }
  }
}

/**
 * Check if a snapshot exists and return its metadata (without data payload).
 */
export async function getSnapshotMeta(source: string, scopeKey: string): Promise<SnapshotMeta | null> {
  // Try Supabase
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('data_snapshots')
        .select('fetched_at, record_count, fetch_duration_ms, fetched_by')
        .eq('source', source)
        .eq('scope_key', scopeKey)
        .single();

      if (!error && data) {
        return buildMeta(
          data.fetched_at,
          source,
          data.record_count ?? 0,
          data.fetch_duration_ms ?? undefined,
          data.fetched_by ?? undefined,
        );
      }
    } catch (err) {
      onSupabaseError('getSnapshotMeta', err);
    }
  }

  // Fallback: blob meta
  try {
    const payload = await loadCacheFromBlob<{ meta: SnapshotMeta }>(blobPath(source, scopeKey));
    if (payload?.meta) {
      return buildMeta(
        payload.meta.fetchedAt,
        source,
        payload.meta.recordCount,
        payload.meta.fetchDurationMs,
        payload.meta.fetchedBy,
      );
    }
  } catch {
    // both failed
  }

  return null;
}
