'use client';

import { useState, useEffect } from 'react';
import type { StateDataReport } from '@/lib/stateReportCache';

export interface UseStateReportResult {
  report: StateDataReport | null;
  isLoading: boolean;
}

export function useStateReport(stateAbbr: string | undefined): UseStateReportResult {
  const [report, setReport] = useState<StateDataReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!stateAbbr) return;
    let cancelled = false;
    setIsLoading(true);

    fetch(`/api/water-data?action=state-data-report&state=${encodeURIComponent(stateAbbr)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled) {
          setReport(data as StateDataReport | null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReport(null);
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [stateAbbr]);

  return { report, isLoading };
}
