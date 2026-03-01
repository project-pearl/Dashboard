'use client';

/**
 * useCachedData — Generic React hook wrapping any data source with
 * age/refresh awareness via the Supabase shared cache.
 */

import { useState, useCallback } from 'react';
import type { SnapshotMeta } from './supabaseCache';

export interface CachedDataMeta extends SnapshotMeta {
  refreshInProgress: boolean;
}

export interface UseCachedDataResult<T> {
  data: T | null;
  meta: CachedDataMeta | null;
  refresh: () => Promise<void>;
}

const DEFAULT_META: CachedDataMeta = {
  fetchedAt: '',
  ageLabel: '',
  isStale: false,
  recordCount: 0,
  refreshInProgress: false,
};

/**
 * Hook that enriches data responses with _meta (age, staleness) and
 * provides a refresh() function that hits /api/cache-refresh.
 */
export function useCachedData<T>(source: string, scopeKey: string): {
  meta: CachedDataMeta | null;
  refreshInProgress: boolean;
  refresh: () => Promise<void>;
  updateMeta: (m: SnapshotMeta | undefined) => void;
} {
  const [meta, setMeta] = useState<CachedDataMeta | null>(null);
  const [refreshInProgress, setRefreshInProgress] = useState(false);

  const updateMeta = useCallback((m: SnapshotMeta | undefined) => {
    if (!m) return;
    setMeta({ ...m, refreshInProgress: false });
  }, []);

  const refresh = useCallback(async () => {
    if (!source || !scopeKey) return;
    setRefreshInProgress(true);
    if (meta) setMeta({ ...meta, refreshInProgress: true });

    try {
      const res = await fetch('/api/cache-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, scopeKey }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.meta) {
          setMeta({ ...json.meta, refreshInProgress: false });
        }
      }
    } catch {
      // Silently fail — data still available from last snapshot
    } finally {
      setRefreshInProgress(false);
      if (meta) setMeta(prev => prev ? { ...prev, refreshInProgress: false } : null);
    }
  }, [source, scopeKey, meta]);

  return { meta, refreshInProgress, refresh, updateMeta };
}
