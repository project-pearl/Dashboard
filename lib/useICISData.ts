'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  IcisPermit, IcisViolation, IcisDmr,
  IcisEnforcement, IcisInspection,
} from '@/lib/icisCache';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ICISDataInput {
  state?: string;
  lat?: number;
  lng?: number;
  permitNumber?: string;
  enabled?: boolean;
}

export interface ICISSummary {
  activePermits: number;
  expiredPermits: number;
  totalViolations: number;
  significantViolations: number;
  enforcementTotal: number;
  totalPenalties: number;
  dmrExceedanceRate: number;
  recentInspections: number;
}

export interface UseICISDataResult {
  permits: IcisPermit[];
  violations: IcisViolation[];
  dmr: IcisDmr[];
  enforcement: IcisEnforcement[];
  inspections: IcisInspection[];
  summary: ICISSummary;
  isLoading: boolean;
  error: string | null;
  fromCache: boolean;
}

const EMPTY_SUMMARY: ICISSummary = {
  activePermits: 0,
  expiredPermits: 0,
  totalViolations: 0,
  significantViolations: 0,
  enforcementTotal: 0,
  totalPenalties: 0,
  dmrExceedanceRate: 0,
  recentInspections: 0,
};

// ── Hook ────────────────────────────────────────────────────────────────────

export function useICISData(input: ICISDataInput): UseICISDataResult {
  const { state, lat, lng, permitNumber, enabled = true } = input;

  const [permits, setPermits] = useState<IcisPermit[]>([]);
  const [violations, setViolations] = useState<IcisViolation[]>([]);
  const [dmr, setDmr] = useState<IcisDmr[]>([]);
  const [enforcement, setEnforcement] = useState<IcisEnforcement[]>([]);
  const [inspections, setInspections] = useState<IcisInspection[]>([]);
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
        const res = await fetch(`/api/water-data?action=icis-cached&lat=${lat}&lng=${lng}`);
        if (res.ok) {
          const data = await res.json();
          if (data.permits || data.violations) {
            setPermits(data.permits || []);
            setViolations(data.violations || []);
            setDmr(data.dmr || []);
            setEnforcement(data.enforcement || []);
            setInspections(data.inspections || []);
            setFromCache(true);
            setIsLoading(false);
            return;
          }
        }
      }

      // Strategy 2: Permit-scoped live query
      if (permitNumber) {
        const base = `/api/water-data`;
        const [pRes, vRes, dRes] = await Promise.allSettled([
          fetch(`${base}?action=icis-permits&permit=${encodeURIComponent(permitNumber)}`),
          fetch(`${base}?action=icis-violations&permit=${encodeURIComponent(permitNumber)}`),
          fetch(`${base}?action=icis-dmr&permit=${encodeURIComponent(permitNumber)}`),
        ]);

        if (pRes.status === 'fulfilled' && pRes.value.ok) {
          const d = await pRes.value.json();
          setPermits(d.data || []);
        }
        if (vRes.status === 'fulfilled' && vRes.value.ok) {
          const d = await vRes.value.json();
          setViolations(d.data || []);
        }
        if (dRes.status === 'fulfilled' && dRes.value.ok) {
          const d = await dRes.value.json();
          setDmr(d.data || []);
        }
        setFromCache(false);
        setIsLoading(false);
        return;
      }

      // Strategy 3: State-level live query
      if (state) {
        const base = `/api/water-data`;
        const [pRes, vRes, dRes, eRes] = await Promise.allSettled([
          fetch(`${base}?action=icis-permits&state=${state}`),
          fetch(`${base}?action=icis-violations&state=${state}`),
          fetch(`${base}?action=icis-dmr&state=${state}`),
          fetch(`${base}?action=icis-enforcement&state=${state}`),
        ]);

        if (pRes.status === 'fulfilled' && pRes.value.ok) {
          const d = await pRes.value.json();
          setPermits(d.data || []);
        }
        if (vRes.status === 'fulfilled' && vRes.value.ok) {
          const d = await vRes.value.json();
          setViolations(d.data || []);
        }
        if (dRes.status === 'fulfilled' && dRes.value.ok) {
          const d = await dRes.value.json();
          setDmr(d.data || []);
        }
        if (eRes.status === 'fulfilled' && eRes.value.ok) {
          const d = await eRes.value.json();
          setEnforcement(d.data || []);
        }
        setFromCache(false);
        setIsLoading(false);
        return;
      }

      // No valid input
      setIsLoading(false);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch ICIS data');
      setIsLoading(false);
    }
  }, [state, lat, lng, permitNumber, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summary = useMemo((): ICISSummary => {
    if (permits.length === 0 && violations.length === 0) return EMPTY_SUMMARY;

    const activePermits = permits.filter(p =>
      p.status?.toLowerCase().includes('effective') || p.status?.toLowerCase().includes('active')
    ).length;

    const expiredPermits = permits.filter(p =>
      p.status?.toLowerCase().includes('expired') || p.status?.toLowerCase().includes('terminated')
    ).length;

    const totalViolations = violations.length;
    const significantViolations = violations.filter(v => v.rnc || v.severity === 'S').length;

    const enforcementTotal = enforcement.length;
    const totalPenalties = enforcement.reduce((sum, e) => sum + (e.penaltyAssessed || 0), 0);

    const dmrWithValues = dmr.filter(d => d.dmrValue !== null);
    const dmrExceedances = dmrWithValues.filter(d => d.exceedance);
    const dmrExceedanceRate = dmrWithValues.length > 0
      ? Math.round((dmrExceedances.length / dmrWithValues.length) * 100)
      : 0;

    // Count inspections in last 12 months
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const recentInspections = inspections.filter(i => {
      if (!i.date) return false;
      return new Date(i.date) >= oneYearAgo;
    }).length;

    return {
      activePermits,
      expiredPermits,
      totalViolations,
      significantViolations,
      enforcementTotal,
      totalPenalties,
      dmrExceedanceRate,
      recentInspections,
    };
  }, [permits, violations, dmr, enforcement, inspections]);

  return {
    permits,
    violations,
    dmr,
    enforcement,
    inspections,
    summary,
    isLoading,
    error,
    fromCache,
  };
}
