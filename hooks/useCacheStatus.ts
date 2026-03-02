'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { CacheDelta } from '@/lib/cacheUtils';
import { CACHE_META } from '@/lib/cacheDeltaDescriber';

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ── Module-level singleton state ──────────────────────────────────────────

let _data: CacheStatusResponse | null = null;
let _error: string | null = null;
let _loading = false;
let _fetchPromise: Promise<void> | null = null;
let _listeners: Set<() => void> = new Set();

interface CacheStatusResponse {
  timestamp: string;
  summary: {
    total: number;
    loaded: number;
    stale: number;
    deltaSummary: {
      cachesWithDeltas: number;
      cachesDataChanged: number;
      cachesUnchanged: number;
      cachesNoDelta: number;
    };
  };
  caches: Record<string, {
    loaded?: boolean;
    status?: string;
    stale: boolean;
    ageHours: number | null;
    lastDelta?: CacheDelta | null;
    [key: string]: unknown;
  }>;
}

export interface ChangelogEntry {
  cacheName: string;
  friendlyName: string;
  delta: CacheDelta;
  recordedAt: string;
}

export interface PipelineHealth {
  fresh: string[];
  stale: string[];
  pending: string[];
  freshPct: number;
  stalePct: number;
}

function notify() {
  _listeners.forEach(fn => fn());
}

async function doFetch() {
  if (_fetchPromise) return _fetchPromise;
  _loading = true;
  notify();

  _fetchPromise = fetch('/api/cache-status')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((json: CacheStatusResponse) => {
      _data = json;
      _error = null;
    })
    .catch((err: Error) => {
      _error = err.message ?? 'Failed to fetch cache status';
    })
    .finally(() => {
      _loading = false;
      _fetchPromise = null;
      notify();
    });

  return _fetchPromise;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useCacheStatus() {
  const [, forceUpdate] = useState(0);
  const changelogRef = useRef<ChangelogEntry[]>([]);
  const prevDeltasRef = useRef<Record<string, string>>({});

  // Subscribe to module-level state changes
  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1);
    _listeners.add(listener);

    // Fetch on first subscriber
    if (!_data && !_loading) doFetch();

    const id = setInterval(doFetch, POLL_INTERVAL);
    return () => {
      _listeners.delete(listener);
      clearInterval(id);
    };
  }, []);

  // Accumulate changelog entries when deltas change
  useEffect(() => {
    if (!_data?.caches) return;

    for (const [name, cache] of Object.entries(_data.caches)) {
      const delta = cache.lastDelta;
      if (!delta || !delta.dataChanged) continue;

      const key = `${name}:${delta.computedAt}`;
      if (prevDeltasRef.current[name] === key) continue;
      prevDeltasRef.current[name] = key;

      const meta = CACHE_META[name];
      changelogRef.current.unshift({
        cacheName: name,
        friendlyName: meta?.friendlyName ?? name,
        delta,
        recordedAt: new Date().toISOString(),
      });

      // Cap at 200 entries
      if (changelogRef.current.length > 200) {
        changelogRef.current = changelogRef.current.slice(0, 200);
      }
    }
  }, [_data]);

  const pipelineHealth = useMemo((): PipelineHealth => {
    if (!_data?.caches) return { fresh: [], stale: [], pending: [], freshPct: 0, stalePct: 0 };

    const fresh: string[] = [];
    const stale: string[] = [];
    const pending: string[] = [];

    for (const [name, cache] of Object.entries(_data.caches)) {
      if (cache.ageHours === null) {
        pending.push(name);
      } else if (cache.ageHours <= 24) {
        fresh.push(name);
      } else if (cache.ageHours > 48) {
        stale.push(name);
      } else {
        fresh.push(name); // 24-48h = still "fresh" tier
      }
    }

    const total = fresh.length + stale.length + pending.length;
    return {
      fresh,
      stale,
      pending,
      freshPct: total > 0 ? Math.round((fresh.length / total) * 100) : 0,
      stalePct: total > 0 ? Math.round((stale.length / total) * 100) : 0,
    };
  }, [_data]);

  const getDeltaForCache = useCallback((cacheName: string): CacheDelta | null => {
    return _data?.caches?.[cacheName]?.lastDelta ?? null;
  }, [_data]);

  return {
    data: _data,
    isLoading: _loading && !_data,
    error: _error,
    refetch: doFetch,
    pipelineHealth,
    changelog: changelogRef.current,
    getDeltaForCache,
  };
}
