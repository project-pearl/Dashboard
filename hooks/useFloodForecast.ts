'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { FloodForecastGauge } from '@/app/api/flood-forecast/route';

const POLL_INTERVAL = 120_000; // 2 minutes

export interface FloodForecastResult {
  forecasts: FloodForecastGauge[];
  summary: {
    total: number;
    major: number;
    moderate: number;
    minor: number;
    action: number;
    currentlyFlooding: number;
  };
  updatedAt: string | null;
  isLoading: boolean;
  error: string | null;
  newAlerts: string[]; // LIDs that are newly predicted to flood
  refetch: () => Promise<void>;
}

export function useFloodForecast(stateAbbr?: string): FloodForecastResult {
  const [forecasts, setForecasts] = useState<FloodForecastGauge[]>([]);
  const [summary, setSummary] = useState({ total: 0, major: 0, moderate: 0, minor: 0, action: 0, currentlyFlooding: 0 });
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newAlerts, setNewAlerts] = useState<string[]>([]);

  const prevFloodingRef = useRef<Set<string>>(new Set());

  const fetchForecasts = useCallback(async () => {
    try {
      const url = stateAbbr ? `/api/flood-forecast?state=${stateAbbr}` : '/api/flood-forecast';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const currentLids = new Set(
        (data.forecasts as FloodForecastGauge[])
          .filter((f: FloodForecastGauge) => f.predictedCategory !== 'none')
          .map((f: FloodForecastGauge) => f.lid),
      );

      // Track newly-predicted floods
      const newIds = [...currentLids].filter(id => !prevFloodingRef.current.has(id));
      setNewAlerts(newIds);
      prevFloodingRef.current = currentLids;

      setForecasts(data.forecasts);
      setSummary(data.summary);
      setUpdatedAt(data.updatedAt);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      // Keep previous data on error
    } finally {
      setIsLoading(false);
    }
  }, [stateAbbr]);

  useEffect(() => {
    fetchForecasts();
    const id = setInterval(fetchForecasts, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchForecasts]);

  return useMemo(() => ({
    forecasts,
    summary,
    updatedAt,
    isLoading,
    error,
    newAlerts,
    refetch: fetchForecasts,
  }), [forecasts, summary, updatedAt, isLoading, error, newAlerts, fetchForecasts]);
}
