/* ------------------------------------------------------------------ */
/*  useSentinelFeed — Client polling hook for Sentinel Intelligence Feed */
/* ------------------------------------------------------------------ */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SentinelFeedEntry, ScoreLevel, ChangeSource } from '@/lib/sentinel/types';

const POLL_INTERVAL = 60_000;

export interface SentinelFeedFilters {
  levels?: ScoreLevel[];
  sources?: ChangeSource[];
  hours?: number;
}

export interface SentinelFeedSummary {
  total: number;
  byLevel: Record<string, number>;
  bySource: Record<string, number>;
  coordinatedClusters: number;
  cbrnDetections: number;
}

export interface SentinelFeedResult {
  entries: SentinelFeedEntry[];
  summary: SentinelFeedSummary | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: string | null;
  refetch: () => void;
}

function buildQueryString(filters: SentinelFeedFilters): string {
  const params = new URLSearchParams();
  if (filters.levels?.length) params.set('level', filters.levels.join(','));
  if (filters.sources?.length) params.set('source', filters.sources.join(','));
  if (filters.hours) params.set('hours', String(filters.hours));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useSentinelFeed(filters: SentinelFeedFilters = {}): SentinelFeedResult {
  const [entries, setEntries] = useState<SentinelFeedEntry[]>([]);
  const [summary, setSummary] = useState<SentinelFeedSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const queryString = useMemo(() => buildQueryString(filters), [filters.levels?.join(','), filters.sources?.join(','), filters.hours]);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch(`/api/sentinel-feed${queryString}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.enabled === false) {
        setEntries([]);
        setSummary(null);
        setIsLoading(false);
        return;
      }

      setEntries(data.entries ?? []);
      setSummary(data.summary ?? null);
      setLastFetched(new Date().toISOString());
      setError(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch sentinel feed');
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    setIsLoading(true);
    fetchFeed();
    const id = setInterval(fetchFeed, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchFeed]);

  return useMemo(
    () => ({ entries, summary, isLoading, error, lastFetched, refetch: fetchFeed }),
    [entries, summary, isLoading, error, lastFetched, fetchFeed],
  );
}
