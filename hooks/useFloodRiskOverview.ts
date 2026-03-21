'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { BasinRisk } from '@/app/api/flood-risk-overview/route';

const POLL_INTERVAL = 120_000; // 2 minutes

export interface FloodRiskOverviewResult {
  basins: BasinRisk[];
  national: {
    totalBasins: number;
    totalGauges: number;
    criticalBasins: number;
    highBasins: number;
    elevatedBasins: number;
    totalMajor: number;
    totalModerate: number;
    totalMinor: number;
    totalFlooding: number;
    maxRiskScore: number;
  };
  updatedAt: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DEFAULT_NATIONAL = {
  totalBasins: 0, totalGauges: 0, criticalBasins: 0, highBasins: 0,
  elevatedBasins: 0, totalMajor: 0, totalModerate: 0, totalMinor: 0,
  totalFlooding: 0, maxRiskScore: 0,
};

export function useFloodRiskOverview(stateAbbr?: string): FloodRiskOverviewResult {
  const [basins, setBasins] = useState<BasinRisk[]>([]);
  const [national, setNational] = useState(DEFAULT_NATIONAL);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const url = stateAbbr ? `/api/flood-risk-overview?state=${stateAbbr}` : '/api/flood-risk-overview';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBasins(data.basins);
      setNational(data.national);
      setUpdatedAt(data.updatedAt);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [stateAbbr]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  return useMemo(() => ({
    basins, national, updatedAt, isLoading, error, refetch: fetchData,
  }), [basins, national, updatedAt, isLoading, error, fetchData]);
}
