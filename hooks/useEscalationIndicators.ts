/* ------------------------------------------------------------------ */
/*  useEscalationIndicators — Polls sentinel-status?escalation=true    */
/* ------------------------------------------------------------------ */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { EscalationIndicators } from '@/lib/sentinel/types';

const POLL_INTERVAL = 60_000;

export interface EscalationResult {
  indicators: EscalationIndicators[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useEscalationIndicators(): EscalationResult {
  const [indicators, setIndicators] = useState<EscalationIndicators[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/sentinel-status?escalation=true');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.enabled === false) {
        setIndicators([]);
        setIsLoading(false);
        return;
      }
      setIndicators(data.escalation ?? []);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch escalation indicators');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  return useMemo(
    () => ({ indicators, isLoading, error, refetch: fetchData }),
    [indicators, isLoading, error, fetchData],
  );
}
