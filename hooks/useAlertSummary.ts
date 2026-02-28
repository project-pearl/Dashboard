/* ------------------------------------------------------------------ */
/*  useAlertSummary — Dashboard-level sentinel alert summary           */
/*  Provides aggregated counts, top alerts with HUC names,            */
/*  active compound patterns, and overall threat level.               */
/*  Designed for header badges, sidebar indicators, briefing cards.   */
/* ------------------------------------------------------------------ */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  ScoredHuc,
  ScoredHucClient,
  ResolvedHuc,
  ChangeSource,
  ScoreLevel,
} from '@/lib/sentinel/types';
import hucNamesData from '@/data/huc8-names.json';

const POLL_INTERVAL = 60_000; // 60s — matches useSentinelAlerts

const hucNames = hucNamesData as Record<string, string>;

/* ------------------------------------------------------------------ */
/*  Public Types                                                       */
/* ------------------------------------------------------------------ */

export type ThreatLevel = 'none' | 'low' | 'elevated' | 'high' | 'critical';

export interface AlertSummaryAlert {
  huc8: string;
  name: string;        // human-readable HUC name
  stateAbbr: string;
  score: number;
  level: ScoreLevel;
  eventCount: number;
  patternNames: string[];
  lastScored: string;
}

export interface AlertSummaryCounts {
  critical: number;
  watch: number;
  advisory: number;
  total: number;
}

export interface AlertSummaryResult {
  /** Overall threat assessment */
  threatLevel: ThreatLevel;
  /** Alert counts by level */
  counts: AlertSummaryCounts;
  /** Top alerts sorted by score descending (max 10) */
  topAlerts: AlertSummaryAlert[];
  /** Distinct active compound patterns across all HUCs */
  activePatterns: string[];
  /** Recent resolutions with HUC names */
  recentResolutions: (ResolvedHuc & { name: string })[];
  /** Highest single HUC score */
  peakScore: number;
  /** Headline: 1-line summary for banners */
  headline: string;
  /** HUC name lookup table for downstream use */
  hucNames: Record<string, string>;
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

function toSummaryAlert(h: ScoredHuc | ScoredHucClient): AlertSummaryAlert {
  const eventCount = 'events' in h ? (h as ScoredHuc).events?.length ?? 0 : (h as ScoredHucClient).eventCount;
  const patternNames = 'activePatterns' in h
    ? ((h as ScoredHuc).activePatterns?.map(p => p.patternId) ?? [])
    : (h as ScoredHucClient).patternNames;

  return {
    huc8: h.huc8,
    name: hucNames[h.huc8] ?? h.huc8,
    stateAbbr: h.stateAbbr,
    score: h.score,
    level: h.level,
    eventCount,
    patternNames,
    lastScored: h.lastScored,
  };
}

function deriveThreatLevel(counts: AlertSummaryCounts): ThreatLevel {
  if (counts.critical >= 3) return 'critical';
  if (counts.critical >= 1) return 'high';
  if (counts.watch >= 2) return 'elevated';
  if (counts.watch >= 1 || counts.advisory >= 3) return 'low';
  return 'none';
}

function buildHeadline(threatLevel: ThreatLevel, counts: AlertSummaryCounts, topAlerts: AlertSummaryAlert[]): string {
  if (threatLevel === 'none') return 'All monitored watersheds nominal';
  if (threatLevel === 'critical') {
    const names = topAlerts.filter(a => a.level === 'CRITICAL').slice(0, 2).map(a => a.name);
    return `Critical: ${names.join(', ')}${counts.critical > 2 ? ` +${counts.critical - 2} more` : ''}`;
  }
  if (threatLevel === 'high') {
    const top = topAlerts[0];
    return `Alert: ${top.name} at critical level (score ${Math.round(top.score)})`;
  }
  if (threatLevel === 'elevated') {
    return `${counts.watch} watershed${counts.watch > 1 ? 's' : ''} under watch`;
  }
  return `${counts.total} active advisory${counts.total > 1 ? ' alerts' : ''}`;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useAlertSummary(): AlertSummaryResult {
  const [data, setData] = useState<{
    activeHucs: ScoredHuc[];
    recentResolutions: ResolvedHuc[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sentinel-status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.enabled === false) {
        setData({ activeHucs: [], recentResolutions: [] });
        setIsLoading(false);
        return;
      }

      setData({
        activeHucs: json.activeHucs ?? [],
        recentResolutions: json.recentResolutions ?? [],
      });
      setLastFetched(new Date().toISOString());
      setError(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch sentinel status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchStatus]);

  return useMemo(() => {
    const hucs = data?.activeHucs ?? [];

    const counts: AlertSummaryCounts = {
      critical: hucs.filter(h => h.level === 'CRITICAL').length,
      watch: hucs.filter(h => h.level === 'WATCH').length,
      advisory: hucs.filter(h => h.level === 'ADVISORY').length,
      total: hucs.length,
    };

    const topAlerts = hucs
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(toSummaryAlert);

    const patternSet = new Set<string>();
    for (const h of hucs) {
      for (const p of h.activePatterns ?? []) {
        patternSet.add(p.patternId);
      }
    }

    const threatLevel = deriveThreatLevel(counts);
    const peakScore = topAlerts.length > 0 ? topAlerts[0].score : 0;

    const recentResolutions = (data?.recentResolutions ?? []).map(r => ({
      ...r,
      name: hucNames[r.huc8] ?? r.huc8,
    }));

    return {
      threatLevel,
      counts,
      topAlerts,
      activePatterns: Array.from(patternSet),
      recentResolutions,
      peakScore,
      headline: buildHeadline(threatLevel, counts, topAlerts),
      hucNames,
      isLoading,
      error,
      lastFetched,
      refetch: fetchStatus,
    };
  }, [data, isLoading, error, lastFetched, fetchStatus]);
}
