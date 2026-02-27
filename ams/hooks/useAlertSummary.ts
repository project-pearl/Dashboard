/* ------------------------------------------------------------------ */
/*  useAlertSummary — Bridges /api/sentinel-status → AMS AlertSummary  */
/*  Polls the real Sentinel API and transforms into AMS types.         */
/* ------------------------------------------------------------------ */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  AlertSummary,
  WatershedScore,
  ScoredSignal,
  AlertLevel,
  CompoundMatch,
  PinRole,
  DataSource,
  ChangeType,
  SignalType,
} from '../types/sentinel';
import { getAlertLevel } from '../types/scoring-config';
import hucNamesData from '@/data/huc8-names.json';

const hucNames = hucNamesData as Record<string, string>;

/* ------------------------------------------------------------------ */
/*  Source name mapping (backend ChangeSource → AMS DataSource)        */
/* ------------------------------------------------------------------ */

const SOURCE_MAP: Record<string, string> = {
  NWS_ALERTS: 'NWS_ALERTS',
  NWPS_FLOOD: 'NWS_ALERTS',
  USGS_IV: 'USGS_NWIS',
  SSO_CSO: 'STATE_SSO_CSO',
  NPDES_DMR: 'NPDES_DMR',
  QPE_RAINFALL: 'NWS_QPE_RAINFALL',
  ATTAINS: 'ATTAINS',
  STATE_DISCHARGE: 'STATE_DISCHARGE',
  FEMA_DISASTER: 'FEMA_DISASTER',
  ECHO_ENFORCEMENT: 'EPA_ECHO',
};

/** Map backend ScoreLevel to AMS AlertLevel */
function toAlertLevel(level: string): AlertLevel {
  switch (level) {
    case 'CRITICAL': return 'ALERT';
    case 'WATCH':    return 'WATCH';
    case 'ADVISORY': return 'ADVISORY';
    default:         return 'NORMAL';
  }
}

/** Map backend severity to AMS severity */
function toAmsSeverity(sev: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (sev === 'MODERATE') return 'MEDIUM';
  if (sev === 'LOW' || sev === 'HIGH' || sev === 'CRITICAL') return sev as any;
  return 'LOW';
}

/** Derive a SignalType from the backend event source + changeType */
function deriveSignalType(source: string, changeType: string, severity: string): string {
  if (source === 'NWS_ALERTS' || source === 'NWPS_FLOOD') {
    return severity === 'CRITICAL' || severity === 'HIGH'
      ? 'NWS_FLOOD_WARNING'
      : 'NWS_FLOOD_WATCH';
  }
  if (source === 'SSO_CSO') return 'SSO_CSO_EVENT';
  if (source === 'NPDES_DMR') return 'NPDES_EXCEEDANCE';
  if (source === 'USGS_IV') {
    return changeType === 'THRESHOLD_CROSSED' ? 'USGS_FLOOD_STAGE' : 'USGS_ACTION_STAGE';
  }
  if (source === 'QPE_RAINFALL') return 'RAINFALL_THRESHOLD';
  if (source === 'FEMA_DISASTER') return 'FEMA_DECLARATION';
  if (source === 'ATTAINS') return 'ATTAINS_CHANGE';
  if (source === 'ECHO_ENFORCEMENT') return 'ECHO_ENFORCEMENT';
  return 'ATTAINS_CHANGE';
}

/** Map backend compound pattern IDs to AMS CompoundPattern names */
function toAmsPattern(patternId: string): string {
  const map: Record<string, string> = {
    'potomac-crisis': 'POTOMAC_PATTERN',
    'infrastructure-stress': 'INFRASTRUCTURE_STRESS',
    'spreading-contamination': 'SPREADING_CONTAMINATION',
    'regulatory-escalation': 'REGULATORY_ESCALATION',
  };
  return map[patternId] ?? patternId.toUpperCase().replace(/-/g, '_');
}

const PATTERN_LABELS: Record<string, string> = {
  POTOMAC_PATTERN: 'Sewage + Weather + Downstream Impact',
  INFRASTRUCTURE_STRESS: 'Infrastructure Under Stress',
  SPREADING_CONTAMINATION: 'Spreading Contamination',
  REGULATORY_ESCALATION: 'Regulatory Escalation',
};

/* ------------------------------------------------------------------ */
/*  Transform backend ScoredHuc → AMS WatershedScore                  */
/* ------------------------------------------------------------------ */

function transformHuc(huc: any): WatershedScore {
  const events: any[] = huc.events ?? [];
  const patterns: any[] = huc.activePatterns ?? [];

  // Build ScoredSignals from event refs (limited data from API)
  const signals: ScoredSignal[] = events.map((ev: any) => {
    const source = (SOURCE_MAP[ev.source] ?? ev.source) as DataSource;
    const signalType = deriveSignalType(ev.source, 'NEW_RECORD', 'HIGH') as SignalType;
    const severityHint = toAmsSeverity(ev.source === 'SSO_CSO' ? 'CRITICAL' : 'HIGH');
    const baseScore = ev.baseScore ?? 0;
    const decayedScore = ev.decayedScore ?? baseScore;

    return {
      changeEvent: {
        eventId: ev.eventId ?? `evt-${huc.huc8}-${ev.source}`,
        source,
        detectedAt: huc.lastScored,
        sourceTimestamp: huc.lastScored,
        changeType: 'NEW_RECORD' as ChangeType,
        geography: {
          huc8: huc.huc8,
          watershedName: hucNames[huc.huc8] ?? huc.huc8,
          stateFips: huc.stateAbbr,
        },
        severityHint,
        payload: {},
        metadata: {
          pollCycleId: '',
          detectionMethod: 'NEW_ID' as const,
          responseTimeMs: 0,
          httpStatus: 200,
        },
      },
      signalType,
      baseScore,
      freshnessMultiplier: baseScore > 0 ? decayedScore / baseScore : 1.0,
      effectiveScore: decayedScore,
    } satisfies ScoredSignal;
  });

  // Build compound matches
  const compoundMatches: CompoundMatch[] = patterns.map((p: any) => ({
    pattern: toAmsPattern(p.patternId) as any,
    label: PATTERN_LABELS[toAmsPattern(p.patternId)] ?? p.patternId,
    matchedSignals: signals.filter(s =>
      (p.matchedEventIds ?? []).includes(s.changeEvent.eventId),
    ),
    multiplier: p.multiplier ?? 1,
    compoundScore: huc.score,
  }));

  return {
    huc8: huc.huc8,
    watershedName: hucNames[huc.huc8] ?? huc.huc8,
    compositeScore: Math.round(huc.score),
    alertLevel: toAlertLevel(huc.level),
    signals,
    compoundMatches,
    firstSignalAt: huc.lastScored,
    lastSignalAt: huc.lastScored,
    signalCount: events.length || (huc.eventCount ?? 0),
    affectedEntities: {
      shellfishBeds: [],
      recreationalWaters: [],
      drinkingWaterIntakes: [],
      npdesPermits: [],
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useAlertSummary(
  _role?: PinRole,
  pollIntervalMs = 30_000,
): AlertSummary | null {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/sentinel-status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.enabled === false) {
        setData(null);
        return;
      }
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, pollIntervalMs);
    return () => clearInterval(id);
  }, [fetchAlerts, pollIntervalMs]);

  return useMemo(() => {
    if (!data) return null;

    const activeHucs: any[] = data.activeHucs ?? [];
    const events: WatershedScore[] = activeHucs.map(transformHuc);

    const byLevel: Record<AlertLevel, number> = {
      ALERT: 0,
      ADVISORY: 0,
      WATCH: 0,
      NORMAL: 0,
    };
    for (const e of events) {
      byLevel[e.alertLevel]++;
    }

    const sorted = [...events].sort((a, b) => b.compositeScore - a.compositeScore);

    return {
      total: events.length,
      byLevel,
      highestScoringEvent: sorted[0] ?? null,
      recentEvents: sorted,
    };
  }, [data]);
}
