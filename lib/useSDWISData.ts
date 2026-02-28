'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  SdwisSystem, SdwisViolation, SdwisEnforcement,
} from '@/lib/sdwisCache';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SDWISDataInput {
  state?: string;
  lat?: number;
  lng?: number;
  pwsid?: string;
  enabled?: boolean;
}

export interface SDWISSummary {
  totalSystems: number;
  communityWaterSystems: number;
  populationServed: number;
  totalViolations: number;
  majorViolations: number;
  healthBasedViolations: number;
  enforcementActions: number;
}

export interface UseSDWISDataResult {
  systems: SdwisSystem[];
  violations: SdwisViolation[];
  enforcement: SdwisEnforcement[];
  summary: SDWISSummary;
  isLoading: boolean;
  error: string | null;
  fromCache: boolean;
}

const EMPTY_SUMMARY: SDWISSummary = {
  totalSystems: 0,
  communityWaterSystems: 0,
  populationServed: 0,
  totalViolations: 0,
  majorViolations: 0,
  healthBasedViolations: 0,
  enforcementActions: 0,
};

// ── Envirofacts → typed helpers ──────────────────────────────────────────────

function mapViolations(rows: any[], defaultPwsid?: string): SdwisViolation[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({
    pwsid: r.PWSID || r.PWS_ID || r.pwsid || defaultPwsid || '',
    code: r.VIOLATION_CODE || r.VIOLATION_TYPE_CODE || r.code || '',
    contaminant: r.CONTAMINANT_NAME || r.CONTAMINANT_CODE || r.contaminant || '',
    rule: r.RULE_NAME || r.RULE_CODE || r.rule || '',
    isMajor: r.IS_MAJOR_VIOL_IND === 'Y' || r.isMajor === true,
    isHealthBased: r.IS_HEALTH_BASED_IND === 'Y' || r.isHealthBased === true,
    compliancePeriod: r.COMPL_PER_BEGIN_DATE || r.compliancePeriod || '',
    lat: r.lat || 0,
    lng: r.lng || 0,
  }));
}

function mapSystems(rows: any[]): SdwisSystem[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({
    pwsid: r.PWSID || r.PWS_ID || r.pwsid || '',
    name: r.PWS_NAME || r.name || '',
    type: r.PWS_TYPE_CODE || r.type || 'CWS',
    population: Number(r.POPULATION_SERVED_COUNT || r.population || 0),
    sourceWater: r.PRIMARY_SOURCE_CODE || r.sourceWater || '',
    state: r.STATE_CODE || r.state || '',
    lat: r.lat || 0,
    lng: r.lng || 0,
  }));
}

function mapEnforcement(rows: any[]): SdwisEnforcement[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({
    pwsid: r.PWSID || r.PWS_ID || r.pwsid || '',
    actionType: r.ENFORCEMENT_ACTION_TYPE_CODE || r.actionType || '',
    date: r.ENFORCEMENT_DATE || r.date || '',
    lat: r.lat || 0,
    lng: r.lng || 0,
  }));
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useSDWISData(input: SDWISDataInput): UseSDWISDataResult {
  const { state, lat, lng, pwsid, enabled = true } = input;

  const [systems, setSystems] = useState<SdwisSystem[]>([]);
  const [violations, setViolations] = useState<SdwisViolation[]>([]);
  const [enforcement, setEnforcement] = useState<SdwisEnforcement[]>([]);
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
        const res = await fetch(`/api/water-data?action=sdwis-cached&lat=${lat}&lng=${lng}`);
        if (res.ok) {
          const data = await res.json();
          if (data.systems || data.violations) {
            setSystems(data.systems || []);
            setViolations(data.violations || []);
            setEnforcement(data.enforcement || []);
            setFromCache(true);
            setIsLoading(false);
            return;
          }
        }
      }

      // Strategy 2: PWSID-scoped live query (fetches violations + systems + enforcement)
      if (pwsid) {
        const res = await fetch(`/api/water-data?action=envirofacts-sdwis&pwsid=${encodeURIComponent(pwsid)}&limit=100`);
        if (res.ok) {
          const data = await res.json();
          const vArr = data.violations || data.data || [];
          const sArr = data.systems || [];
          const eArr = data.enforcement || [];
          setViolations(mapViolations(vArr, pwsid));
          setSystems(mapSystems(sArr));
          setEnforcement(mapEnforcement(eArr));
        }
        setFromCache(false);
        setIsLoading(false);
        return;
      }

      // Strategy 3: State-level live query (fetches violations + systems + enforcement)
      if (state) {
        const res = await fetch(`/api/water-data?action=envirofacts-sdwis&state=${state}&limit=1000`);
        if (res.ok) {
          const data = await res.json();
          const vArr = data.violations || data.data || [];
          const sArr = data.systems || [];
          const eArr = data.enforcement || [];
          setViolations(mapViolations(vArr));
          setSystems(mapSystems(sArr));
          setEnforcement(mapEnforcement(eArr));
        }
        setFromCache(false);
        setIsLoading(false);
        return;
      }

      // No valid input
      setIsLoading(false);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch SDWIS data');
      setIsLoading(false);
    }
  }, [state, lat, lng, pwsid, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summary = useMemo((): SDWISSummary => {
    if (systems.length === 0 && violations.length === 0) return EMPTY_SUMMARY;

    const totalSystems = systems.length;
    const communityWaterSystems = systems.filter(s => s.type === 'CWS').length;
    const populationServed = systems.reduce((sum, s) => sum + (s.population || 0), 0);
    const totalViolations = violations.length;
    const majorViolations = violations.filter(v => v.isMajor).length;
    const healthBasedViolations = violations.filter(v => v.isHealthBased).length;
    const enforcementActions = enforcement.length;

    return {
      totalSystems,
      communityWaterSystems,
      populationServed,
      totalViolations,
      majorViolations,
      healthBasedViolations,
      enforcementActions,
    };
  }, [systems, violations, enforcement]);

  return {
    systems,
    violations,
    enforcement,
    summary,
    isLoading,
    error,
    fromCache,
  };
}
