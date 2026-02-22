'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  NwisGwSite, NwisGwLevel, NwisGwTrend,
} from '@/lib/nwisGwCache';

// ── Types ───────────────────────────────────────────────────────────────────

export interface NwisGwDataInput {
  state?: string;
  lat?: number;
  lng?: number;
  siteNumber?: string;
  enabled?: boolean;
}

export interface NwisGwSummary {
  totalSites: number;
  sitesWithRealtimeData: number;
  sitesRising: number;
  sitesFalling: number;
  sitesStable: number;
  avgDepthToWater: number | null;
  deepestLevel: number | null;
  shallowestLevel: number | null;
}

export interface UseNwisGwDataResult {
  sites: NwisGwSite[];
  levels: NwisGwLevel[];
  trends: NwisGwTrend[];
  summary: NwisGwSummary;
  isLoading: boolean;
  error: string | null;
  fromCache: boolean;
}

const EMPTY_SUMMARY: NwisGwSummary = {
  totalSites: 0,
  sitesWithRealtimeData: 0,
  sitesRising: 0,
  sitesFalling: 0,
  sitesStable: 0,
  avgDepthToWater: null,
  deepestLevel: null,
  shallowestLevel: null,
};

// ── Hook ────────────────────────────────────────────────────────────────────

export function useNwisGwData(input: NwisGwDataInput): UseNwisGwDataResult {
  const { state, lat, lng, siteNumber, enabled = true } = input;

  const [sites, setSites] = useState<NwisGwSite[]>([]);
  const [levels, setLevels] = useState<NwisGwLevel[]>([]);
  const [trends, setTrends] = useState<NwisGwTrend[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);

    try {
      // Strategy 1: Spatial cache lookup
      if (lat !== undefined && lng !== undefined) {
        const res = await fetch(`/api/water-data?action=nwis-gw-cached&lat=${lat}&lng=${lng}`);
        if (res.ok) {
          const data = await res.json();
          if (data.sites || data.levels || data.trends) {
            setSites(data.sites || []);
            setLevels(data.levels || []);
            setTrends(data.trends || []);
            setFromCache(true);
            setIsLoading(false);
            return;
          }
        }
      }

      // Strategy 2: Site-specific live query
      if (siteNumber) {
        const base = `/api/water-data`;
        const [levRes, rtRes] = await Promise.allSettled([
          fetch(`${base}?action=nwis-gw-levels&siteNumber=${encodeURIComponent(siteNumber)}`),
          fetch(`${base}?action=nwis-gw-realtime&siteNumber=${encodeURIComponent(siteNumber)}`),
        ]);

        const allLevels: NwisGwLevel[] = [];
        if (levRes.status === 'fulfilled' && levRes.value.ok) {
          const d = await levRes.value.json();
          allLevels.push(...(d.data || []).map((l: any) => ({
            ...l,
            isRealtime: false,
            lat: 0,
            lng: 0,
          })));
        }
        if (rtRes.status === 'fulfilled' && rtRes.value.ok) {
          const d = await rtRes.value.json();
          allLevels.push(...(d.data || []).map((l: any) => ({
            ...l,
            isRealtime: true,
            lat: 0,
            lng: 0,
          })));
        }
        setLevels(allLevels);
        setFromCache(false);
        setIsLoading(false);
        return;
      }

      // Strategy 3: State-level live query
      if (state) {
        const res = await fetch(`/api/water-data?action=nwis-gw-sites&state=${state}`);
        if (res.ok) {
          const data = await res.json();
          setSites((data.data || []).map((s: any) => ({
            siteNumber: s.siteNumber || '',
            siteName: s.siteName || '',
            aquiferCode: '',
            wellDepth: null,
            state,
            county: '',
            huc: '',
            lat: s.lat || 0,
            lng: s.lng || 0,
          })));
        }
        setFromCache(false);
        setIsLoading(false);
        return;
      }

      // No valid input
      setIsLoading(false);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch NWIS groundwater data');
      setIsLoading(false);
    }
  }, [state, lat, lng, siteNumber, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summary = useMemo((): NwisGwSummary => {
    if (sites.length === 0 && levels.length === 0 && trends.length === 0) return EMPTY_SUMMARY;

    const totalSites = sites.length;
    const sitesWithRealtimeData = new Set(
      levels.filter(l => l.isRealtime).map(l => l.siteNumber)
    ).size;

    const sitesRising = trends.filter(t => t.trend === 'rising').length;
    const sitesFalling = trends.filter(t => t.trend === 'falling').length;
    const sitesStable = trends.filter(t => t.trend === 'stable').length;

    // Compute avg/min/max from latest level per site (prefer depth-to-water param 72019)
    const latestBySite = new Map<string, number>();
    const sorted = [...levels].sort((a, b) => (b.dateTime || '').localeCompare(a.dateTime || ''));
    for (const l of sorted) {
      if (!latestBySite.has(l.siteNumber)) {
        latestBySite.set(l.siteNumber, l.value);
      }
    }

    const allValues = Array.from(latestBySite.values());
    const avgDepthToWater = allValues.length > 0
      ? Math.round((allValues.reduce((a, b) => a + b, 0) / allValues.length) * 100) / 100
      : null;
    const deepestLevel = allValues.length > 0 ? Math.max(...allValues) : null;
    const shallowestLevel = allValues.length > 0 ? Math.min(...allValues) : null;

    return {
      totalSites,
      sitesWithRealtimeData,
      sitesRising,
      sitesFalling,
      sitesStable,
      avgDepthToWater,
      deepestLevel,
      shallowestLevel,
    };
  }, [sites, levels, trends]);

  return {
    sites,
    levels,
    trends,
    summary,
    isLoading,
    error,
    fromCache,
  };
}
