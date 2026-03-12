'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/** Shared singleton cache-status poller.
 *  All components that call useCacheStatus() share a single setInterval.
 *  The interval runs at the shortest requested period (minimum 30s). */

type Listener = (data: unknown) => void;

let _data: unknown = null;
let _listeners: Set<Listener> = new Set();
let _intervalId: ReturnType<typeof setInterval> | null = null;
let _intervalMs = 60_000;
let _fetching = false;

async function fetchCacheStatus() {
  if (_fetching) return;
  _fetching = true;
  try {
    const res = await fetch('/api/cache-status');
    if (res.ok) {
      _data = await res.json();
      _listeners.forEach((fn) => fn(_data));
    }
  } catch {
    // Network errors are silent — OfflineBanner handles connectivity
  } finally {
    _fetching = false;
  }
}

function ensurePolling(periodMs: number) {
  const newMs = Math.max(30_000, Math.min(periodMs, _intervalMs));
  if (_intervalId && newMs >= _intervalMs) return; // already polling at same or faster rate
  if (_intervalId) clearInterval(_intervalId);
  _intervalMs = newMs;
  fetchCacheStatus(); // immediate first fetch
  _intervalId = setInterval(fetchCacheStatus, _intervalMs);
}

function stopPollingIfEmpty() {
  if (_listeners.size === 0 && _intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
    _intervalMs = 60_000;
  }
}

/**
 * Hook: subscribes to the shared cache-status poller.
 * @param periodMs — desired polling interval (default 60s, minimum 30s)
 * @returns { data, refresh } — latest cache-status payload + manual refresh trigger
 */
export function useCacheStatus(periodMs = 60_000) {
  const [data, setData] = useState<unknown>(_data);
  const listenerRef = useRef<Listener>(null as unknown as Listener);

  useEffect(() => {
    const listener: Listener = (d) => setData(d);
    listenerRef.current = listener;
    _listeners.add(listener);
    ensurePolling(periodMs);

    // If we already have data, seed immediately
    if (_data) setData(_data);

    return () => {
      _listeners.delete(listener);
      stopPollingIfEmpty();
    };
  }, [periodMs]);

  const refresh = useCallback(() => { fetchCacheStatus(); }, []);

  return { data, refresh };
}
