'use client';

import { useState, useEffect, useCallback } from 'react';
import type { USAsStateData } from '@/lib/usaSpendingCache';

export interface UseUSASpendingDataResult {
  data: USAsStateData | null;
  isLoading: boolean;
  error: string | null;
  fromCache: boolean;
}

export function useUSASpendingData(stateAbbr?: string): UseUSASpendingDataResult {
  const [data, setData] = useState<USAsStateData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const fetchData = useCallback(async () => {
    if (!stateAbbr) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/water-data?action=usaspending-cached&state=${encodeURIComponent(stateAbbr)}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }
      if (json.data) {
        setData(json.data);
        setFromCache(true);
      } else {
        setData(null);
        setFromCache(false);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch USAspending data');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [stateAbbr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, fromCache };
}
