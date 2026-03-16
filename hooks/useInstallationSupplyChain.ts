/* ------------------------------------------------------------------ */
/*  useInstallationSupplyChain — On-demand fetch (no polling)           */
/* ------------------------------------------------------------------ */

'use client';

import { useState, useCallback, useMemo } from 'react';

export interface SupplyChainWaterSystem {
  pwsid: string;
  name: string;
  type: string;
  sourceWater: string;
  population: number;
  distanceKm: number;
  violationCount: number;
  healthBasedViolations: number;
  enforcementCount: number;
}

export interface SupplyChainThreat {
  type: 'npdes_discharger' | 'impaired_water';
  [key: string]: unknown;
}

export interface SupplyChainAnomaly {
  huc8: string;
  score: number;
  level: string;
  patterns: string[];
  eventCount: number;
}

export interface SupplyChainData {
  installation: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    state: string;
    branch: string;
    region: string;
  };
  waterSystems: SupplyChainWaterSystem[];
  upstreamNavigation: any;
  upstreamThreats: SupplyChainThreat[];
  sentinelAnomalies: SupplyChainAnomaly[];
  unavailable?: boolean;
  reason?: string;
}

export interface SupplyChainResult {
  data: SupplyChainData | null;
  isLoading: boolean;
  error: string | null;
  fetch: (installationId: string) => void;
}

export function useInstallationSupplyChain(): SupplyChainResult {
  const [data, setData] = useState<SupplyChainData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (installationId: string) => {
    if (!installationId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/installation-supply-chain?id=${encodeURIComponent(installationId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch supply chain data');
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
