'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type HealthStatus = 'online' | 'degraded' | 'offline' | 'unknown';

export interface SourceHealth {
  id: string;
  name: string;
  status: HealthStatus;
  responseTimeMs: number;
  httpStatus: number | null;
  error: string | null;
  checkedAt: string;
  offlineSince: string | null;
}

export interface DatapointSummary {
  attains: { states: number; waterbodies: number; assessments: number };
  wqp: { records: number; states: number };
  ceden: { chemistry: number; toxicity: number };
  icis: { permits: number; violations: number; dmr: number; enforcement: number };
  nwisGw: { sites: number; levels: number };
  total: number;
}

export interface UseSourceHealthResult {
  sources: SourceHealth[];
  isLoading: boolean;
  lastChecked: string | null;
  onlineCount: number;
  degradedCount: number;
  offlineCount: number;
  datapoints: DatapointSummary | null;
  refetch: () => void;
}

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSourceHealth(): UseSourceHealthResult {
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [datapoints, setDatapoints] = useState<DatapointSummary | null>(null);

  // Track when each source first went offline (persists across polls within session)
  const offlineTracker = useRef<Record<string, string>>({});

  const fetchHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/source-health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const now = new Date().toISOString();
      const enriched: SourceHealth[] = (data.sources || []).map(
        (s: { id: string; name: string; status: string; responseTimeMs: number; httpStatus: number | null; error: string | null; checkedAt: string }) => {
          // Track offline transitions
          if (s.status === 'offline') {
            if (!offlineTracker.current[s.id]) {
              offlineTracker.current[s.id] = now;
            }
          } else {
            delete offlineTracker.current[s.id];
          }

          return {
            ...s,
            status: s.status as HealthStatus,
            offlineSince: offlineTracker.current[s.id] || null,
          };
        },
      );

      setSources(enriched);
      setLastChecked(data.timestamp || now);
      if (data.datapoints) setDatapoints(data.datapoints);
    } catch {
      // Keep previous data on error — just stop loading
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchHealth]);

  const { onlineCount, degradedCount, offlineCount } = useMemo(() => {
    let online = 0, degraded = 0, offline = 0;
    for (const s of sources) {
      if (s.status === 'online') online++;
      else if (s.status === 'degraded') degraded++;
      else offline++;
    }
    return { onlineCount: online, degradedCount: degraded, offlineCount: offline };
  }, [sources]);

  return {
    sources,
    isLoading,
    lastChecked,
    onlineCount,
    degradedCount,
    offlineCount,
    datapoints,
    refetch: fetchHealth,
  };
}
