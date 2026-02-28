/* ------------------------------------------------------------------ */
/*  useSentinelHealth — Source health monitoring hook                   */
/*  Tracks per-source status, uptime, queue depth, and health trends. */
/*  Designed for admin panels, ops monitoring, and system dashboards.  */
/* ------------------------------------------------------------------ */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  ChangeSource,
  SourceStatus,
  SentinelSourceState,
  QueueStats,
} from '@/lib/sentinel/types';
import { POLL_INTERVALS } from '@/lib/sentinel/config';

const POLL_INTERVAL = 60_000; // 60s

/* ------------------------------------------------------------------ */
/*  Public Types                                                       */
/* ------------------------------------------------------------------ */

export type HealthTrend = 'improving' | 'stable' | 'degrading';
export type OverallHealth = 'healthy' | 'degraded' | 'critical' | 'offline';

export interface SourceHealthDetail {
  source: ChangeSource;
  status: SourceStatus;
  lastPollAt: string | null;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  /** Polling interval in minutes (derived from config) */
  pollIntervalMin: number;
  /** Time since last success in minutes (null if never polled) */
  minutesSinceSuccess: number | null;
  /** Whether this source is overdue for a successful poll */
  overdue: boolean;
}

export interface SentinelHealthResult {
  /** Per-source health details */
  sources: SourceHealthDetail[];
  /** Overall system health assessment */
  overallHealth: OverallHealth;
  /** Health trend based on recent polls */
  trend: HealthTrend;
  /** Source counts by status */
  healthyCt: number;
  degradedCt: number;
  offlineCt: number;
  /** System uptime percentage (healthy / total sources) */
  uptimePct: number;
  /** Event queue statistics */
  queue: QueueStats | null;
  /** Sources that are currently overdue */
  overdueSources: ChangeSource[];
  /** Whether sentinel is enabled */
  enabled: boolean;
  /** Loading / error state */
  isLoading: boolean;
  error: string | null;
  lastFetched: string | null;
  /** Force a re-fetch */
  refetch: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getMinutesSinceSuccess(s: SentinelSourceState): number | null {
  if (!s.lastSuccessAt) return null;
  return (Date.now() - new Date(s.lastSuccessAt).getTime()) / 60_000;
}

function isOverdue(s: SentinelSourceState): boolean {
  const mins = getMinutesSinceSuccess(s);
  if (mins === null) return true; // never succeeded → overdue
  const expectedInterval = (POLL_INTERVALS[s.source] ?? 6) * 5; // convert cycles to minutes
  return mins > expectedInterval * 3; // overdue if > 3× expected interval
}

function toSourceDetail(s: SentinelSourceState): SourceHealthDetail {
  return {
    source: s.source,
    status: s.status,
    lastPollAt: s.lastPollAt,
    lastSuccessAt: s.lastSuccessAt,
    consecutiveFailures: s.consecutiveFailures,
    pollIntervalMin: (POLL_INTERVALS[s.source] ?? 6) * 5,
    minutesSinceSuccess: getMinutesSinceSuccess(s),
    overdue: isOverdue(s),
  };
}

function deriveOverallHealth(
  healthyCt: number,
  degradedCt: number,
  offlineCt: number,
  total: number,
): OverallHealth {
  if (total === 0) return 'offline';
  if (offlineCt >= Math.ceil(total / 2)) return 'offline';
  if (offlineCt >= 3 || degradedCt + offlineCt >= Math.ceil(total / 2)) return 'critical';
  if (degradedCt > 0 || offlineCt > 0) return 'degraded';
  return 'healthy';
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useSentinelHealth(): SentinelHealthResult {
  const [rawSources, setRawSources] = useState<SentinelSourceState[]>([]);
  const [queue, setQueue] = useState<QueueStats | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  // Track health history for trend detection (last 5 polls)
  const healthHistoryRef = useRef<number[]>([]);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/sentinel-status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.enabled === false) {
        setEnabled(false);
        setIsLoading(false);
        return;
      }

      setEnabled(true);
      setRawSources(json.sources ?? []);
      setQueue(json.queue ?? null);
      setLastFetched(new Date().toISOString());
      setError(null);

      // Track healthy count for trend
      const healthy = (json.sources ?? []).filter(
        (s: SentinelSourceState) => s.status === 'HEALTHY',
      ).length;
      const hist = healthHistoryRef.current;
      hist.push(healthy);
      if (hist.length > 5) hist.shift();
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch sentinel health');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchHealth]);

  return useMemo(() => {
    const sources = rawSources.map(toSourceDetail);
    const total = sources.length;
    const healthyCt = sources.filter(s => s.status === 'HEALTHY').length;
    const degradedCt = sources.filter(s => s.status === 'DEGRADED').length;
    const offlineCt = sources.filter(s => s.status === 'OFFLINE').length;
    const uptimePct = total > 0 ? (healthyCt / total) * 100 : 0;

    const overdueSources = sources
      .filter(s => s.overdue)
      .map(s => s.source);

    const overallHealth = deriveOverallHealth(healthyCt, degradedCt, offlineCt, total);

    // Compute trend from health history
    const hist = healthHistoryRef.current;
    let trend: HealthTrend = 'stable';
    if (hist.length >= 3) {
      const recent = hist.slice(-3);
      const first = recent[0];
      const last = recent[recent.length - 1];
      if (last > first) trend = 'improving';
      else if (last < first) trend = 'degrading';
    }

    return {
      sources,
      overallHealth,
      trend,
      healthyCt,
      degradedCt,
      offlineCt,
      uptimePct,
      queue,
      overdueSources,
      enabled,
      isLoading,
      error,
      lastFetched,
      refetch: fetchHealth,
    };
  }, [rawSources, queue, enabled, isLoading, error, lastFetched, fetchHealth]);
}
