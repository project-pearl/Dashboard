/* ------------------------------------------------------------------ */
/*  useSentinelHealth — Bridges /api/sentinel-status → AMS health     */
/*  Polls the real Sentinel API and transforms into AMS SentinelHealth */
/* ------------------------------------------------------------------ */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SentinelHealth, DataSource } from '../types/sentinel';

/* ------------------------------------------------------------------ */
/*  Source name mapping (backend ChangeSource → AMS DataSource)        */
/* ------------------------------------------------------------------ */

const SOURCE_MAP: Record<string, DataSource> = {
  NWS_ALERTS: 'NWS_ALERTS',
  NWPS_FLOOD: 'NWS_ALERTS',     // merged into NWS_ALERTS for AMS
  USGS_IV: 'USGS_NWIS',
  SSO_CSO: 'STATE_SSO_CSO',
  NPDES_DMR: 'NPDES_DMR',
  QPE_RAINFALL: 'NWS_QPE_RAINFALL',
  ATTAINS: 'ATTAINS',
  STATE_DISCHARGE: 'STATE_DISCHARGE',
  FEMA_DISASTER: 'FEMA_DISASTER',
  ECHO_ENFORCEMENT: 'EPA_ECHO',
};

/** Deduplicate merged sources (NWPS_FLOOD → NWS_ALERTS) — keep healthiest */
function deduplicateSources(sources: SentinelHealth[]): SentinelHealth[] {
  const map = new Map<string, SentinelHealth>();
  for (const s of sources) {
    const existing = map.get(s.source);
    if (!existing) {
      map.set(s.source, s);
    } else {
      // Keep the healthier one (HEALTHY > DEGRADED > OFFLINE)
      const rank = { HEALTHY: 0, DEGRADED: 1, OFFLINE: 2 } as const;
      if ((rank[s.status] ?? 2) < (rank[existing.status] ?? 2)) {
        map.set(s.source, s);
      }
    }
  }
  return Array.from(map.values());
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useSentinelHealth(pollIntervalMs = 60_000): SentinelHealth[] {
  const [rawSources, setRawSources] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/sentinel-status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.enabled === false) {
        setRawSources([]);
        return;
      }
      setRawSources(json.sources ?? []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, pollIntervalMs);
    return () => clearInterval(id);
  }, [fetchHealth, pollIntervalMs]);

  return useMemo(() => {
    const mapped: SentinelHealth[] = rawSources.map((s: any) => ({
      source: (SOURCE_MAP[s.source] ?? s.source) as DataSource,
      status: s.status as 'HEALTHY' | 'DEGRADED' | 'OFFLINE',
      lastPollAt: s.lastPollAt ?? s.lastSuccessAt ?? null,
      consecutiveFailures: s.consecutiveFailures ?? 0,
      avgResponseTimeMs: 0, // not available from sentinel-status API
    }));

    return deduplicateSources(mapped);
  }, [rawSources]);
}
