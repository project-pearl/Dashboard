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
  expiringPermits: number;
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
  expiringPermits: 0,
};

// ── Envirofacts → typed mappers ─────────────────────────────────────────────

function mapPermits(rows: any[]): IcisPermit[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({
    permit: r.permit || r.NPDES_ID || r.EXTERNAL_PERMIT_NMBR || '',
    facility: r.facility || r.FACILITY_NAME || r.FACILITY_UIN || '',
    state: r.state || r.STATE_ABBR || '',
    status: r.status || r.PERMIT_STATUS_CODE || r.PERMIT_STATUS || '',
    type: r.type || r.PERMIT_TYPE_CODE || '',
    expiration: r.expiration || r.PERMIT_EXPIRATION_DATE || '',
    flow: r.flow ?? (r.DESIGN_FLOW_NMBR != null ? Number(r.DESIGN_FLOW_NMBR) : null),
    lat: r.lat || 0,
    lng: r.lng || 0,
  }));
}

function mapViolations(rows: any[]): IcisViolation[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({
    permit: r.permit || r.NPDES_ID || r.EXTERNAL_PERMIT_NMBR || '',
    code: r.code || r.VIOLATION_CODE || r.VIOLATION_TYPE_CODE || '',
    desc: r.desc || r.VIOLATION_DESC || r.VIOLATION_TYPE_DESC || '',
    date: r.date || r.VIOLATION_DETECT_DATE || r.SCHEDULE_DATE || '',
    rnc: r.rnc === true || r.RNC_DETECTION_CODE === 'Y' || (r.RNC_DETECTION_CODE || '').length > 0,
    severity: r.severity || r.SEVERITY_CODE || '',
    lat: r.lat || 0,
    lng: r.lng || 0,
  }));
}

function mapDmr(rows: any[]): IcisDmr[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => {
    const dmrVal = r.dmrValue ?? r.DMR_VALUE_NMBR ?? r.STATISTICAL_BASE_MONTHLY_AVG;
    const limitVal = r.limitValue ?? r.LIMIT_VALUE_NMBR ?? r.LIMIT_VALUE_STANDARD_NMBR;
    const dv = dmrVal != null ? Number(dmrVal) : null;
    const lv = limitVal != null ? Number(limitVal) : null;
    return {
      permit: r.permit || r.NPDES_ID || r.EXTERNAL_PERMIT_NMBR || '',
      paramDesc: r.paramDesc || r.PARAMETER_DESC || r.PARAMETER_CODE || '',
      pearlKey: r.pearlKey || '',
      dmrValue: dv,
      limitValue: lv,
      unit: r.unit || r.STATISTICAL_BASE_TYPE_CODE || '',
      exceedance: r.exceedance === true || (dv !== null && lv !== null && lv > 0 && dv > lv),
      period: r.period || r.MONITORING_PERIOD_END_DATE || '',
      lat: r.lat || 0,
      lng: r.lng || 0,
    };
  });
}

function mapEnforcement(rows: any[]): IcisEnforcement[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({
    permit: r.permit || r.NPDES_ID || r.EXTERNAL_PERMIT_NMBR || '',
    caseNumber: r.caseNumber || r.CASE_NUMBER || r.ENFORCEMENT_ID || '',
    actionType: r.actionType || r.ENF_TYPE_CODE || r.ENF_TYPE_DESC || r.ENFORCEMENT_ACTION_TYPE_CODE || '',
    penaltyAssessed: r.penaltyAssessed || Number(r.PENALTY_ASSESSED_AMT || r.FED_PENALTY_ASSESSED_AMT || 0),
    penaltyCollected: r.penaltyCollected || Number(r.PENALTY_COLLECTED_AMT || 0),
    settlementDate: r.settlementDate || r.SETTLEMENT_ENTERED_DATE || r.ACHIEVED_DATE || '',
    lat: r.lat || 0,
    lng: r.lng || 0,
  }));
}

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
      // Strategy 1: Spatial cache lookup (already normalized)
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

      // Strategy 2: Permit-scoped live query (Envirofacts → map fields)
      if (permitNumber) {
        const base = `/api/water-data`;
        const [pRes, vRes, dRes] = await Promise.allSettled([
          fetch(`${base}?action=icis-permits&permit=${encodeURIComponent(permitNumber)}`),
          fetch(`${base}?action=icis-violations&permit=${encodeURIComponent(permitNumber)}`),
          fetch(`${base}?action=icis-dmr&permit=${encodeURIComponent(permitNumber)}`),
        ]);

        if (pRes.status === 'fulfilled' && pRes.value.ok) {
          const d = await pRes.value.json();
          setPermits(mapPermits(d.data || []));
        }
        if (vRes.status === 'fulfilled' && vRes.value.ok) {
          const d = await vRes.value.json();
          setViolations(mapViolations(d.data || []));
        }
        if (dRes.status === 'fulfilled' && dRes.value.ok) {
          const d = await dRes.value.json();
          setDmr(mapDmr(d.data || []));
        }
        setFromCache(false);
        setIsLoading(false);
        return;
      }

      // Strategy 3: State-level live query (Envirofacts → map fields)
      if (state) {
        const base = `/api/water-data`;
        const [pRes, vRes, dRes, eRes] = await Promise.allSettled([
          fetch(`${base}?action=icis-permits&state=${state}&limit=500`),
          fetch(`${base}?action=icis-violations&state=${state}&limit=500`),
          fetch(`${base}?action=icis-dmr&state=${state}&limit=500`),
          fetch(`${base}?action=icis-enforcement&state=${state}&limit=500`),
        ]);

        if (pRes.status === 'fulfilled' && pRes.value.ok) {
          const d = await pRes.value.json();
          setPermits(mapPermits(d.data || []));
        }
        if (vRes.status === 'fulfilled' && vRes.value.ok) {
          const d = await vRes.value.json();
          setViolations(mapViolations(d.data || []));
        }
        if (dRes.status === 'fulfilled' && dRes.value.ok) {
          const d = await dRes.value.json();
          setDmr(mapDmr(d.data || []));
        }
        if (eRes.status === 'fulfilled' && eRes.value.ok) {
          const d = await eRes.value.json();
          setEnforcement(mapEnforcement(d.data || []));
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
    if (permits.length === 0 && violations.length === 0 && enforcement.length === 0) return EMPTY_SUMMARY;

    const activePermits = permits.filter(p =>
      p.status?.toLowerCase().includes('effective') || p.status?.toLowerCase().includes('active')
    ).length || permits.length; // fallback: count all if status codes don't match

    const expiredPermits = permits.filter(p =>
      p.status?.toLowerCase().includes('expired') || p.status?.toLowerCase().includes('terminated')
    ).length;

    // Expiring within 90 days
    const now = Date.now();
    const ninetyDaysMs = 90 * 86_400_000;
    const expiringPermits = permits.filter(p => {
      if (!p.expiration) return false;
      const exp = new Date(p.expiration).getTime();
      return !isNaN(exp) && exp > now && exp - now <= ninetyDaysMs;
    }).length;

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
      expiringPermits,
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
