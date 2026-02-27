/* ------------------------------------------------------------------ */
/*  useSentinelAlerts — Client polling hook for Sentinel status        */
/*  Follows useSourceHealth.ts pattern: useState + setInterval polling */
/* ------------------------------------------------------------------ */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  ScoredHuc,
  SentinelSourceState,
  ResolvedHuc,
  ScoreLevel,
  ScoredHucClient,
} from '@/lib/sentinel/types';

const POLL_INTERVAL = 60_000; // 60 seconds

export type SystemStatus = 'active' | 'degraded' | 'offline';

export interface SentinelAlertsResult {
  criticalHucs: ScoredHucClient[];
  watchHucs: ScoredHucClient[];
  advisoryHucs: ScoredHucClient[];
  recentResolutions: ResolvedHuc[];
  sources: SentinelSourceState[];
  systemStatus: SystemStatus;
  lastFetched: string | null;
  isLoading: boolean;
  error: string | null;
  newCriticalHucs: string[];
  refetch: () => void;
}

function toClient(h: ScoredHuc): ScoredHucClient {
  return {
    huc8: h.huc8,
    stateAbbr: h.stateAbbr,
    score: h.score,
    level: h.level,
    eventCount: h.events?.length ?? 0,
    patternNames: h.activePatterns?.map(p => p.patternId) ?? [],
    lastScored: h.lastScored,
  };
}

function deriveSystemStatus(
  healthy: number,
  degraded: number,
  offline: number
): SystemStatus {
  if (offline >= 3) return 'offline';
  if (degraded > 0 || offline > 0) return 'degraded';
  return 'active';
}

export function useSentinelAlerts(): SentinelAlertsResult {
  const [criticalHucs, setCriticalHucs] = useState<ScoredHucClient[]>([]);
  const [watchHucs, setWatchHucs] = useState<ScoredHucClient[]>([]);
  const [advisoryHucs, setAdvisoryHucs] = useState<ScoredHucClient[]>([]);
  const [recentResolutions, setRecentResolutions] = useState<ResolvedHuc[]>([]);
  const [sources, setSources] = useState<SentinelSourceState[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>('active');
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCriticalHucs, setNewCriticalHucs] = useState<string[]>([]);

  // Track previously-seen CRITICAL HUC codes across polls
  const prevCriticalRef = useRef<Set<string>>(new Set());

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sentinel-status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.enabled === false) {
        // Sentinel disabled — show as offline but no error
        setSystemStatus('offline');
        setIsLoading(false);
        return;
      }

      const active: ScoredHuc[] = data.activeHucs ?? [];
      const critical = active.filter(h => h.level === 'CRITICAL').map(toClient);
      const watch = active.filter(h => h.level === 'WATCH').map(toClient);
      const advisory = active.filter(h => h.level === 'ADVISORY').map(toClient);

      setCriticalHucs(critical);
      setWatchHucs(watch);
      setAdvisoryHucs(advisory);
      setRecentResolutions(data.recentResolutions ?? []);
      setSources(data.sources ?? []);
      setLastFetched(new Date().toISOString());
      setError(null);

      // Derive system status
      const summary = data.summary ?? {};
      setSystemStatus(
        deriveSystemStatus(
          summary.healthySources ?? 0,
          summary.degradedSources ?? 0,
          summary.offlineSources ?? 0
        )
      );

      // Detect new CRITICAL HUCs
      const currentCriticalIds = new Set(critical.map(h => h.huc8));
      const newIds: string[] = [];
      for (const id of currentCriticalIds) {
        if (!prevCriticalRef.current.has(id)) {
          newIds.push(id);
        }
      }
      prevCriticalRef.current = currentCriticalIds;
      setNewCriticalHucs(newIds);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch sentinel status');
      // Keep previous data on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchStatus]);

  return useMemo(
    () => ({
      criticalHucs,
      watchHucs,
      advisoryHucs,
      recentResolutions,
      sources,
      systemStatus,
      lastFetched,
      isLoading,
      error,
      newCriticalHucs,
      refetch: fetchStatus,
    }),
    [
      criticalHucs,
      watchHucs,
      advisoryHucs,
      recentResolutions,
      sources,
      systemStatus,
      lastFetched,
      isLoading,
      error,
      newCriticalHucs,
      fetchStatus,
    ]
  );
}
