/* ------------------------------------------------------------------ */
/*  useThreatFusion — On-demand fetch for threat fusion data            */
/* ------------------------------------------------------------------ */

'use client';

import { useState, useCallback, useMemo } from 'react';
import type { ThreatFusionResponse } from '@/lib/threatFusion';

export interface ThreatFusionResult {
  data: ThreatFusionResponse | null;
  isLoading: boolean;
  error: string | null;
  fetch: (installationId: string) => void;
}

export function useThreatFusion(): ThreatFusionResult {
  const [data, setData] = useState<ThreatFusionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (installationId: string) => {
    if (!installationId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/installation-threat-fusion?installationId=${encodeURIComponent(installationId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch threat fusion data');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return useMemo(
    () => ({ data, isLoading, error, fetch: fetchData }),
    [data, isLoading, error, fetchData],
  );
}
