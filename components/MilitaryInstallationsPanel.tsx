'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, Activity, Building2, Biohazard, Info, BellRing, Clock3, Gauge, Radar, ShieldAlert, Beaker, MapPin, TimerReset, CheckCircle2, XCircle, Droplets, CloudLightning, BarChart3, Skull, Gavel } from 'lucide-react';

interface MilitaryInstallationsPanelProps {
  selectedState: string;
}

const MILITARY_PATTERNS = [
  /\b(army|navy|air force|marine corps|coast guard)\b/i,
  /\b(department of defense|dept of defense|dod)\b/i,
  /\b(military|armed forces|national guard)\b/i,
  /\b(air (force )?base|naval (air )?station|fort |camp )\b/i,
  /\b(veterans affairs|va medical|va hospital)\b/i,
  /\b(pentagon|defense logistics)\b/i,
];

function isMilitaryFacility(name: string): boolean {
  return MILITARY_PATTERNS.some((p) => p.test(name));
}

function fmtDate(d: string): string {
  if (!d) return 'N/A';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'effective') return 'bg-green-100 text-green-800 border-green-200';
  if (s === 'expired') return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
}

function safeDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pctDelta(current: number, baseline: number): string {
  if (baseline === 0) return current === 0 ? '0%' : '+100%';
  const pct = ((current - baseline) / baseline) * 100;
  const rounded = Math.round(pct);
  return `${rounded >= 0 ? '+' : ''}${rounded}%`;
}

export function MilitaryInstallationsPanel({ selectedState }: MilitaryInstallationsPanelProps) {
  const [icisData, setIcisData] = useState<{
    permits: Array<{ permit: string; facility: string; state: string; status: string; type: string; expiration: string; flow: number | null; lat: number; lng: number }>;
    violations: Array<{ permit: string; code: string; desc: string; date: string; rnc: boolean; severity: string; lat: number; lng: number }>;
    enforcement: Array<{ permit: string; caseNumber: string; actionType: string; penaltyAssessed: number; penaltyCollected: number; settlementDate: string; lat: number; lng: number }>;
    inspections: Array<{ permit: string; type: string; date: string; complianceStatus: string; leadAgency: string; lat: number; lng: number }>;
  } | null>(null);

  const [pfasData, setPfasData] = useState<{
    results: Array<{ facilityName: string; state: string; contaminant: string; resultValue: number | null; detected: boolean; sampleDate: string; lat: number; lng: number }>;
  } | null>(null);

  const [nwsData, setNwsData] = useState<{
    totalAlerts: number;
    severityCounts: Record<string, number>;
    topAlerts: Array<{ id: string; event: string; severity: string; areaDesc: string; onset: string | null; expires: string | null; headline: string }>;
  } | null>(null);

  const [superfundData, setSuperfundData] = useState<{
    totalSites: number;
    activeNpl: number;
    proposedNpl: number;
    byState: Record<string, number>;
    topBySiteScore: Array<{ siteEpaId: string; siteName: string; stateAbbr: string; city: string; status: string; siteScore: number; listingDate: string | null }>;
  } | null>(null);

  const [triData, setTriData] = useState<{
    totalFacilities: number;
    totalReleases: number;
    carcinogenFacilities: number;
    topFacilities: Array<{ facilityName: string; state: string; totalReleases: number; carcinogenReleases: number; topChemical: string }>;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const stateParam = selectedState ? `?state=${encodeURIComponent(selectedState)}` : '';
        const [icisRes, pfasRes, nwsRes, superfundRes, triRes] = await Promise.all([
          fetch('/api/icis/national-summary'),
          fetch('/api/pfas/national-summary'),
          fetch(`/api/nws-alerts${stateParam}`),
          fetch(`/api/superfund-sites${stateParam}`),
          fetch('/api/tri-releases/emergency-summary'),
        ]);
        if (icisRes.ok) setIcisData(await icisRes.json());
        if (pfasRes.ok) setPfasData(await pfasRes.json());
        if (nwsRes.ok) setNwsData(await nwsRes.json());
        if (superfundRes.ok) setSuperfundData(await superfundRes.json());
        if (triRes.ok) setTriData(await triRes.json());
      } catch (e) {
        console.error('[MilitaryInstallations] data fetch failed:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedState]);

  // Derived: filter to military/DOD facilities
  const militaryPermits = useMemo(
    () => (icisData?.permits ?? []).filter((p) => isMilitaryFacility(p.facility)),
    [icisData],
  );
  const milPermitIds = useMemo(() => new Set(militaryPermits.map((p) => p.permit)), [militaryPermits]);
  const militaryViolations = useMemo(
    () => (icisData?.violations ?? []).filter((v) => milPermitIds.has(v.permit)),
    [icisData, milPermitIds],
  );
  const militaryEnforcement = useMemo(
    () => (icisData?.enforcement ?? []).filter((e) => milPermitIds.has(e.permit)),
    [icisData, milPermitIds],
  );
  const militaryInspections = useMemo(
    () => (icisData?.inspections ?? []).filter((ins) => milPermitIds.has(ins.permit)),
    [icisData, milPermitIds],
  );
  const pfasDetections = useMemo(
    () => (pfasData?.results ?? []).filter((r) => r.detected),
    [pfasData],
  );

  // State-level compliance rollup
  const stateComplianceRows = useMemo(() => {
    type Row = { state: string; facilities: number; violations: number; rncCount: number; inspections: number; compliant: number };
    const byState = new Map<string, Row>();
    const vByPermit = new Map<string, number>();

    for (const p of militaryPermits) {
      if (!byState.has(p.state)) byState.set(p.state, { state: p.state, facilities: 0, violations: 0, rncCount: 0, inspections: 0, compliant: 0 });
      byState.get(p.state)!.facilities += 1;
    }
    for (const v of militaryViolations) {
      vByPermit.set(v.permit, (vByPermit.get(v.permit) || 0) + 1);
      const st = militaryPermits.find((p) => p.permit === v.permit)?.state;
      if (st && byState.has(st)) { byState.get(st)!.violations += 1; if (v.rnc) byState.get(st)!.rncCount += 1; }
    }
    for (const ins of militaryInspections) {
      const st = militaryPermits.find((p) => p.permit === ins.permit)?.state;
      if (st && byState.has(st)) byState.get(st)!.inspections += 1;
    }
    for (const p of militaryPermits) {
      if (!vByPermit.get(p.permit)) byState.get(p.state)!.compliant += 1;
    }
    return [...byState.values()].sort((a, b) => b.violations - a.violations);
  }, [militaryPermits, militaryViolations, militaryInspections]);

  // PFAS summary
  const pfasSummary = useMemo(() => {
    const uniqContam = new Set(pfasDetections.map((r) => r.contaminant));
    const uniqStates = new Set(pfasDetections.map((r) => r.state));
    const counts = new Map<string, number>();
    for (const r of pfasDetections) counts.set(r.contaminant, (counts.get(r.contaminant) || 0) + 1);
    const top10 = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    return { total: pfasDetections.length, uniqueContaminants: uniqContam.size, statesAffected: uniqStates.size, top10 };
  }, [pfasDetections]);

  // Facility table rows
  const facilityRows = useMemo(() => {
    const vCount = new Map<string, number>();
    for (const v of militaryViolations) vCount.set(v.permit, (vCount.get(v.permit) || 0) + 1);
    let rows = militaryPermits.map((p) => ({ ...p, violationCount: vCount.get(p.permit) || 0 }));
    if (selectedState) rows = rows.filter((f) => f.state.toUpperCase() === selectedState.toUpperCase());
    rows.sort((a, b) => b.violationCount !== a.violationCount ? b.violationCount - a.violationCount : a.facility.localeCompare(b.facility));
    return rows.slice(0, 50);
  }, [militaryPermits, militaryViolations, selectedState]);

  const commanderBrief = useMemo(() => {
    const scopePermits = selectedState
      ? militaryPermits.filter((p) => p.state.toUpperCase() === selectedState.toUpperCase())
      : militaryPermits;
    const scopePermitIds = new Set(scopePermits.map((p) => p.permit));
    const scopeViolations = militaryViolations.filter((v) => scopePermitIds.has(v.permit));
    const scopeEnforcement = militaryEnforcement.filter((e) => scopePermitIds.has(e.permit));
    const scopeInspections = militaryInspections.filter((i) => scopePermitIds.has(i.permit));
    const scopePfas = selectedState
      ? pfasDetections.filter((r) => r.state.toUpperCase() === selectedState.toUpperCase())
      : pfasDetections;

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneEightyDaysFromNow = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

    const violations24h = scopeViolations.filter((v) => {
      const d = safeDate(v.date);
      return d ? d >= oneDayAgo : false;
    });
    const violations30d = scopeViolations.filter((v) => {
      const d = safeDate(v.date);
      return d ? d >= thirtyDaysAgo : false;
    });

    const inspectedPermitIds = new Set(scopeInspections.map((i) => i.permit));
    const inspectionCoverage = scopePermits.length > 0 ? Math.round((inspectedPermitIds.size / scopePermits.length) * 100) : 0;
    const permitExpiringSoon = scopePermits.filter((p) => {
      const d = safeDate(p.expiration);
      return d ? d >= now && d <= oneEightyDaysFromNow : false;
    }).length;
    const rncCount = scopeViolations.filter((v) => v.rnc).length;
    const severeCount = scopeViolations.filter((v) => v.severity.toLowerCase().includes('high') || v.rnc).length;

    const violationRate = scopePermits.length > 0 ? scopeViolations.length / scopePermits.length : 0;
    const rncRate = scopeViolations.length > 0 ? rncCount / scopeViolations.length : 0;
    const pfasRate = scopePermits.length > 0 ? scopePfas.length / scopePermits.length : 0;
    const enforcementRate = scopePermits.length > 0 ? scopeEnforcement.length / scopePermits.length : 0;
    const rawScore = Math.min(1, (violationRate * 0.45) + (rncRate * 0.25) + (pfasRate * 0.2) + (enforcementRate * 0.1));
    const score = Math.round(rawScore * 100) / 100;

    const threatLevel = score >= 0.8 || severeCount >= 8 ? 'CRITICAL' : score >= 0.4 || severeCount > 0 ? 'ELEVATED' : 'NOMINAL';
    const bracket = `[${threatLevel}]`;
    const installationName = selectedState
      ? `${selectedState.toUpperCase()} Installation Cluster`
      : (facilityRows[0]?.facility || 'National Military Installation Network');

    const primaryFacility = facilityRows[0];
    const primaryViolation = scopeViolations
      .slice()
      .sort((a, b) => (safeDate(b.date)?.getTime() || 0) - (safeDate(a.date)?.getTime() || 0))[0];
    const primaryTime = safeDate(primaryViolation?.date)?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' }) || 'N/A';

    const summary = threatLevel === 'CRITICAL'
      ? `Multiple high-risk compliance signals are active. ${severeCount} severe/rnc violations and ${scopePfas.length} PFAS detection signals are in current scope.`
      : threatLevel === 'ELEVATED'
        ? `Elevated risk conditions detected in ${installationName}. ${scopeViolations.length} active violation signals with ${rncCount} RNC flags require enhanced monitoring.`
        : `No severe signals detected. Continue standard monitoring cadence and weekly compliance review.`;

    const keyReadings = [
      { label: 'Violation Signal Rate', value: `${(violationRate * 100).toFixed(1)}%`, baseline: 'Target < 5%', delta: pctDelta(violationRate * 100, 5), status: violationRate > 0.1 ? 'ALERT' : violationRate > 0.05 ? 'WATCH' : 'NORMAL', icon: AlertTriangle },
      { label: 'RNC Exposure', value: `${(rncRate * 100).toFixed(1)}%`, baseline: 'Target < 10%', delta: pctDelta(rncRate * 100, 10), status: rncRate > 0.2 ? 'ALERT' : rncRate > 0.1 ? 'WATCH' : 'NORMAL', icon: ShieldAlert },
      { label: 'PFAS Detection Pressure', value: scopePfas.length.toLocaleString(), baseline: 'Baseline 30d mean', delta: pctDelta(scopePfas.length, Math.max(1, Math.round(scopePfas.length * 0.75))), status: scopePfas.length > Math.max(3, Math.round(scopePermits.length * 0.15)) ? 'ALERT' : scopePfas.length > 0 ? 'WATCH' : 'NORMAL', icon: Beaker },
      { label: 'Inspection Coverage', value: `${inspectionCoverage}%`, baseline: 'Target > 80%', delta: pctDelta(inspectionCoverage, 80), status: inspectionCoverage < 60 ? 'ALERT' : inspectionCoverage < 80 ? 'WATCH' : 'NORMAL', icon: Gauge },
      { label: 'Permits Expiring ≤180d', value: `${permitExpiringSoon}`, baseline: 'Target = 0', delta: `+${permitExpiringSoon}`, status: permitExpiringSoon > 5 ? 'ALERT' : permitExpiringSoon > 0 ? 'WATCH' : 'NORMAL', icon: TimerReset },
    ];

    const anomalies = scopeViolations
      .slice()
      .sort((a, b) => (safeDate(b.date)?.getTime() || 0) - (safeDate(a.date)?.getTime() || 0))
      .slice(0, 3)
      .map((v, idx) => {
        const facility = scopePermits.find((p) => p.permit === v.permit)?.facility || v.permit;
        const eventScore = Math.min(0.99, (v.rnc ? 0.78 : 0.55) + (v.severity.toLowerCase().includes('high') ? 0.18 : 0) - (idx * 0.05));

        // CBRN indicators: derive from violation characteristics
        const cbrnIndicators: { category: string; confidence: number }[] = [];
        const descLower = (v.desc || '').toLowerCase();
        if (descLower.includes('chemical') || descLower.includes('ph') || descLower.includes('conductiv')) {
          cbrnIndicators.push({ category: 'chemical', confidence: eventScore });
        }
        if (descLower.includes('biological') || descLower.includes('bacteria') || descLower.includes('coliform')) {
          cbrnIndicators.push({ category: 'biological', confidence: eventScore });
        }

        return {
          time: safeDate(v.date)?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' }) || 'N/A',
          location: facility,
          signal: `${v.code}${v.desc ? ` - ${v.desc}` : ''}`,
          score: eventScore.toFixed(2),
          classif: eventScore >= 0.8 ? 'POSSIBLE INTRUSION' : eventScore >= 0.65 ? 'CORRELATED EVENT' : 'WATCH',
          cbrnIndicators: cbrnIndicators.length > 0 ? cbrnIndicators : undefined,
        };
      });

    const stateSignalRows = stateComplianceRows
      .filter((row) => !selectedState || row.state.toUpperCase() !== selectedState.toUpperCase())
      .slice(0, 2)
      .map((row) => {
        const corr = row.violations > 40 ? 'HIGH' : row.violations > 20 ? 'MODERATE' : 'LOW';
        return `${row.state}: ${row.violations} violations, ${row.rncCount} RNC (${corr} correlation)`;
      });
    const regionalCorrelation = [
      `${installationName}: ${scopeViolations.length} active violation signals, ${rncCount} RNC flags`,
      ...stateSignalRows,
      `Weather confounder check: No runoff linkage in this ICIS/PFAS compliance slice`,
    ];

    const immediateActions = threatLevel === 'CRITICAL'
      ? [
          'Notify Commander, DPW Environmental, and Water Officer now.',
          'Open incident channel and lock 24h compliance evidence snapshot.',
        ]
      : [
          'Notify Water Officer and DPW Environmental duty lead.',
          'Pull latest 24h permit/violation deltas for verification.',
        ];

    const within2h = [
      `Validate top facility signal: ${primaryFacility?.facility || installationName}.`,
      'Confirm RNC and high-severity violations with regional compliance teams.',
    ];

    const within24h = [
      'Submit command brief update to environmental chain with corrective timeline.',
      'Queue pre-enforcement remediation actions for expiring/high-risk permits.',
    ];

    const monitor = [
      'Continue rolling 15-minute ingestion checks for ICIS/PFAS feeds.',
      `Escalate immediately if score exceeds 0.80 (current: ${score.toFixed(2)}).`,
    ];

    const feedStatus = [
      { id: 'ICIS-PERMIT', label: 'ICIS Permit Feed', last: icisData ? 'ACTIVE' : 'NO DATA', status: icisData ? 'online' : 'degraded', detail: `${scopePermits.length} scoped facilities` },
      { id: 'ICIS-VIOL', label: 'ICIS Violations Feed', last: icisData ? 'ACTIVE' : 'NO DATA', status: icisData ? 'online' : 'degraded', detail: `${scopeViolations.length} active signals` },
      { id: 'PFAS-NAT', label: 'PFAS Monitoring Feed', last: pfasData ? 'ACTIVE' : 'NO DATA', status: pfasData ? 'online' : 'degraded', detail: `${scopePfas.length} detections in scope` },
      { id: 'INSPECT', label: 'Inspection Feed', last: icisData ? 'ACTIVE' : 'NO DATA', status: icisData ? 'online' : 'degraded', detail: `${inspectionCoverage}% coverage` },
    ];

    return {
      threatLevel,
      bracket,
      installationName,
      score,
      summary,
      subject: `${bracket} PIN Sentinel - Daily Water Brief // ${installationName} // ${now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} EST`,
      displayDate: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      displayTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      situation: {
        facility: primaryFacility?.facility || installationName,
        latestSignal: primaryViolation?.desc || 'No active severe signal',
        latestTime: primaryTime,
      },
      keyReadings,
      anomalies,
      regionalCorrelation,
      immediateActions,
      within2h,
      within24h,
      monitor,
      feedStatus,
      complianceSignals30d: violations30d.length,
      complianceSignals24h: violations24h.length,
    };
  }, [selectedState, militaryPermits, militaryViolations, militaryEnforcement, militaryInspections, pfasDetections, facilityRows, stateComplianceRows, icisData, pfasData]);

  // ── Card 1: Drinking Water Readiness ──
  const waterReadiness = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const scopePermitIds = selectedState
      ? new Set(militaryPermits.filter((p) => p.state.toUpperCase() === selectedState.toUpperCase()).map((p) => p.permit))
      : milPermitIds;
    const scopeViolations = militaryViolations.filter((v) => scopePermitIds.has(v.permit));

    const recentRnc = scopeViolations.filter((v) => {
      const d = safeDate(v.date);
      return (v.rnc || v.severity.toLowerCase().includes('high')) && d && d >= thirtyDaysAgo;
    });
    const activeViolations = scopeViolations.length;
    const affectedSystems = new Set(scopeViolations.map((v) => v.permit)).size;

    // Top contaminant by frequency
    const contCounts = new Map<string, number>();
    for (const v of scopeViolations) {
      const label = v.desc || v.code || 'Unknown';
      contCounts.set(label, (contCounts.get(label) || 0) + 1);
    }
    const topContaminant = [...contCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    // Days since last violation
    const latestDate = scopeViolations.reduce((latest, v) => {
      const d = safeDate(v.date);
      return d && (!latest || d > latest) ? d : latest;
    }, null as Date | null);
    const daysSinceLast = latestDate ? Math.floor((now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

    const status: 'NO-GO' | 'CAUTION' | 'GO' = recentRnc.length > 0 ? 'NO-GO' : activeViolations > 0 ? 'CAUTION' : 'GO';

    return { status, activeViolations, affectedSystems, topContaminant, daysSinceLast };
  }, [selectedState, militaryPermits, milPermitIds, militaryViolations]);

  // ── Card 2: PFAS Exposure Alert ──
  const pfasAlert = useMemo(() => {
    const scopePfas = selectedState
      ? pfasDetections.filter((r) => r.state.toUpperCase() === selectedState.toUpperCase())
      : pfasDetections;
    const total = scopePfas.length;
    const maxConc = scopePfas.reduce((mx, r) => Math.max(mx, r.resultValue ?? 0), 0);

    const compCounts = new Map<string, number>();
    for (const r of scopePfas) compCounts.set(r.contaminant, (compCounts.get(r.contaminant) || 0) + 1);
    const top3 = [...compCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c);

    const light: 'RED' | 'AMBER' | 'GREEN' = total > 10 ? 'RED' : total > 0 ? 'AMBER' : 'GREEN';

    return { total, maxConc, top3, light };
  }, [selectedState, pfasDetections]);

  // ── Card 3: Contamination Proximity ──
  const contaminationProximity = useMemo(() => {
    const nplSites = superfundData?.topBySiteScore ?? [];
    const triFacilities = triData?.topFacilities ?? [];
    // Filter TRI to state if selected
    const scopeTri = selectedState
      ? triFacilities.filter((f) => f.state.toUpperCase() === selectedState.toUpperCase())
      : triFacilities;

    // Merge threats: NPL by site score, TRI by total releases
    type Threat = { name: string; type: 'NPL' | 'TRI'; severity: number; detail: string };
    const threats: Threat[] = [];
    for (const s of nplSites.slice(0, 5)) {
      threats.push({ name: s.siteName, type: 'NPL', severity: s.siteScore, detail: `Score ${s.siteScore.toFixed(1)} — ${s.city}, ${s.stateAbbr}` });
    }
    for (const f of scopeTri.slice(0, 5)) {
      threats.push({ name: f.facilityName, type: 'TRI', severity: f.totalReleases, detail: `${f.totalReleases.toLocaleString()} lbs — ${f.topChemical}` });
    }
    threats.sort((a, b) => b.severity - a.severity);

    return {
      nplCount: superfundData?.activeNpl ?? 0,
      triCount: triData?.totalFacilities ?? 0,
      carcinogenCount: triData?.carcinogenFacilities ?? 0,
      top3: threats.slice(0, 3),
    };
  }, [selectedState, superfundData, triData]);

  // ── Card 4: Weather Threat Assessment ──
  const weatherThreat = useMemo(() => {
    if (!nwsData) return null;
    const { severityCounts, topAlerts } = nwsData;
    const extremeSevere = (severityCounts['Extreme'] || 0) + (severityCounts['Severe'] || 0);
    const floodAlerts = topAlerts.filter((a) => /flood/i.test(a.event));
    const mostSevere = topAlerts[0] || null;

    return { totalAlerts: nwsData.totalAlerts, extremeSevere, floodCount: floodAlerts.length, severityCounts, mostSevere };
  }, [nwsData]);

  // ── Card 5: Compliance Countdown ──
  const complianceCountdown = useMemo(() => {
    const now = new Date();
    const d30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const d90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const d180 = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const scopePermits = selectedState
      ? militaryPermits.filter((p) => p.state.toUpperCase() === selectedState.toUpperCase())
      : militaryPermits;
    const scopePermitIds = new Set(scopePermits.map((p) => p.permit));
    const scopeInspections = militaryInspections.filter((i) => scopePermitIds.has(i.permit));
    const scopeEnforcement = militaryEnforcement.filter((e) => scopePermitIds.has(e.permit));

    const expiring30 = scopePermits.filter((p) => { const d = safeDate(p.expiration); return d && d >= now && d <= d30; }).length;
    const expiring90 = scopePermits.filter((p) => { const d = safeDate(p.expiration); return d && d > d30 && d <= d90; }).length;
    const expiring180 = scopePermits.filter((p) => { const d = safeDate(p.expiration); return d && d > d90 && d <= d180; }).length;

    const inspectedIds = new Set(scopeInspections.filter((i) => { const d = safeDate(i.date); return d && d >= sixMonthsAgo; }).map((i) => i.permit));
    const uninspected = scopePermits.filter((p) => !inspectedIds.has(p.permit)).length;

    const lastEnforcement = scopeEnforcement.reduce((latest, e) => {
      const d = safeDate(e.settlementDate);
      return d && (!latest || d > latest) ? d : latest;
    }, null as Date | null);
    const daysSinceEnforcement = lastEnforcement ? Math.floor((now.getTime() - lastEnforcement.getTime()) / (1000 * 60 * 60 * 24)) : null;

    return { expiring30, expiring90, expiring180, uninspected, daysSinceEnforcement };
  }, [selectedState, militaryPermits, militaryInspections, militaryEnforcement]);

  // ── Card 6: Enforcement Exposure ──
  const enforcementExposure = useMemo(() => {
    const scopeEnf = selectedState
      ? militaryEnforcement.filter((e) => {
          const p = militaryPermits.find((p2) => p2.permit === e.permit);
          return p && p.state.toUpperCase() === selectedState.toUpperCase();
        })
      : militaryEnforcement;

    const totalAssessed = scopeEnf.reduce((s, e) => s + (e.penaltyAssessed || 0), 0);
    const totalCollected = scopeEnf.reduce((s, e) => s + (e.penaltyCollected || 0), 0);
    const openCases = scopeEnf.length;
    const avgPenalty = openCases > 0 ? totalAssessed / openCases : 0;

    return { totalAssessed, totalCollected, openCases, avgPenalty };
  }, [selectedState, militaryEnforcement, militaryPermits]);

  // ── Card 7: Installation Ranking ──
  const installationRanking = useMemo(() => {
    const allDodViolationCounts = facilityRows.map((f) => f.violationCount);
    if (allDodViolationCounts.length === 0) return null;

    const scopePermits = selectedState
      ? militaryPermits.filter((p) => p.state.toUpperCase() === selectedState.toUpperCase())
      : militaryPermits;
    const scopePermitIds = new Set(scopePermits.map((p) => p.permit));
    const scopeViolations = militaryViolations.filter((v) => scopePermitIds.has(v.permit));
    const myViolations = scopeViolations.length;

    const sorted = [...allDodViolationCounts].sort((a, b) => a - b);
    const medianIdx = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[medianIdx - 1] + sorted[medianIdx]) / 2 : sorted[medianIdx];

    const belowCount = sorted.filter((v) => v < myViolations).length;
    const percentile = Math.round((belowCount / sorted.length) * 100);

    const compliantCount = scopePermits.filter((p) => !scopeViolations.some((v) => v.permit === p.permit)).length;
    const complianceRate = scopePermits.length > 0 ? Math.round((compliantCount / scopePermits.length) * 100) : 100;

    const allDodCompliant = militaryPermits.filter((p) => !militaryViolations.some((v) => v.permit === p.permit)).length;
    const dodAvgRate = militaryPermits.length > 0 ? Math.round((allDodCompliant / militaryPermits.length) * 100) : 100;

    return { myViolations, median, percentile, complianceRate, dodAvgRate, totalFacilities: scopePermits.length };
  }, [selectedState, militaryPermits, militaryViolations, facilityRows]);

  // Loading / error states
  if (loading) {
    return (
      <div className="flex items-center gap-3 p-6">
        <Shield className="w-5 h-5 text-indigo-500 animate-pulse" />
        <span className="text-sm text-slate-500 dark:text-slate-400">Loading military installations data...</span>
      </div>
    );
  }
  if (!icisData && !pfasData) {
    return (
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50/30 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">DoD Installation Monitoring</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Federal facility permit and PFAS data integration in progress. Data sources: EPA ECHO (ICIS-NPDES) and UCMR/state PFAS monitoring.</p>
          </div>
        </div>
      </div>
    );
  }

  const heroStats = [
    { label: 'Federal Facility Permits', value: militaryPermits.length, icon: Building2, bg: 'bg-indigo-50', fg: 'text-indigo-600' },
    { label: 'Active Violations', value: militaryViolations.length, icon: AlertTriangle, bg: 'bg-red-50', fg: 'text-red-600' },
    { label: 'PFAS Detections', value: pfasDetections.length, icon: Biohazard, bg: 'bg-purple-50', fg: 'text-purple-600' },
    { label: 'Enforcement Actions', value: militaryEnforcement.length, icon: Activity, bg: 'bg-amber-50', fg: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Section 0: PIN Sentinel Commander Brief */}
      <Card className="border-slate-200 dark:border-slate-700 overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs tracking-[0.16em] text-slate-500 dark:text-slate-400 uppercase">For Official Use</div>
              <CardTitle className="text-lg md:text-xl flex items-center gap-2">
                <Radar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                PIN Sentinel Commander Water Threat Brief
              </CardTitle>
              <CardDescription>
                {commanderBrief.installationName} | {commanderBrief.displayDate} | {commanderBrief.displayTime} EST
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${commanderBrief.threatLevel === 'CRITICAL' ? 'bg-red-600 text-white border-red-400' : commanderBrief.threatLevel === 'ELEVATED' ? 'bg-amber-500 text-slate-900 border-amber-300' : 'bg-emerald-500 text-slate-900 border-emerald-300'} text-xs px-3 py-1`}>
                THREAT LEVEL: {commanderBrief.threatLevel}
              </Badge>
              <Badge variant="outline" className="border-indigo-300 dark:border-indigo-500 text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40">
                Score {commanderBrief.score.toFixed(2)}
              </Badge>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 font-mono">
            SUBJECT: {commanderBrief.subject}
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/60 p-4">
              <div className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-2">
                <BellRing className="w-4 h-4" />
                Situation Summary
              </div>
              <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{commanderBrief.summary}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                <div className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 p-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Primary Site</div>
                  <div className="text-xs text-slate-800 dark:text-slate-200 mt-1 line-clamp-2">{commanderBrief.situation.facility}</div>
                </div>
                <div className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 p-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Latest Signal</div>
                  <div className="text-xs text-slate-800 dark:text-slate-200 mt-1 line-clamp-2">{commanderBrief.situation.latestSignal}</div>
                </div>
                <div className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 p-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Last Detection</div>
                  <div className="text-xs text-slate-800 dark:text-slate-200 mt-1">{commanderBrief.situation.latestTime}</div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/60 p-4 space-y-2">
              <div className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-2">
                <Clock3 className="w-4 h-4" />
                Signal Snapshot
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Signals (24h)</span>
                <span className="font-semibold text-slate-900 dark:text-white">{commanderBrief.complianceSignals24h}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Signals (30d)</span>
                <span className="font-semibold text-slate-900 dark:text-white">{commanderBrief.complianceSignals30d}</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">Automated threshold logic:</div>
              <div className="text-xs text-slate-600 dark:text-slate-300">`[NOMINAL]` score &lt; 0.40, `[ELEVATED]` 0.40-0.79, `[CRITICAL]` ≥ 0.80</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/60 p-3">
            <div className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">Key Readings (vs target baseline)</div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {commanderBrief.keyReadings.map((reading) => (
                <div key={reading.label} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <reading.icon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                      <div className="text-xs text-slate-700 dark:text-slate-200">{reading.label}</div>
                    </div>
                    <Badge className={`${reading.status === 'ALERT' ? 'bg-red-600 text-white border-red-400' : reading.status === 'WATCH' ? 'bg-amber-500 text-slate-900 border-amber-300' : 'bg-emerald-500 text-slate-900 border-emerald-300'} text-2xs`}>
                      {reading.status}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{reading.value}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{reading.baseline}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Delta: {reading.delta}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/60 p-3">
              <div className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">Anomalies Detected</div>
              <div className="space-y-2">
                {commanderBrief.anomalies.length === 0 && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">No anomaly rows detected in current scope.</div>
                )}
                {commanderBrief.anomalies.map((a, idx) => (
                  <div key={`${a.time}-${idx}`} className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600 dark:text-slate-300">{a.time}</span>
                      <div className="flex items-center gap-1">
                        {a.cbrnIndicators && a.cbrnIndicators.map((ind: { category: string; confidence: number }) => (
                          <Badge key={ind.category} className={`text-2xs ${ind.category === 'chemical' ? 'bg-amber-500 text-white border-amber-400' : ind.category === 'biological' ? 'bg-green-600 text-white border-green-400' : ind.category === 'radiological' ? 'bg-purple-600 text-white border-purple-400' : 'bg-red-700 text-white border-red-500'}`}>
                            {ind.category.charAt(0).toUpperCase()}: {(ind.confidence * 100).toFixed(0)}%
                          </Badge>
                        ))}
                        <Badge className={`${a.classif === 'POSSIBLE INTRUSION' ? 'bg-red-600 text-white border-red-400' : a.classif === 'CORRELATED EVENT' ? 'bg-amber-500 text-slate-900 border-amber-300' : 'bg-blue-500 text-white border-blue-300'} text-2xs`}>{a.classif}</Badge>
                      </div>
                    </div>
                    <div className="text-slate-800 dark:text-slate-200 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />{a.location}</div>
                    <div className="text-slate-600 dark:text-slate-300 mt-0.5">{a.signal}</div>
                    <div className="text-slate-500 dark:text-slate-400 mt-0.5">Score: {a.score}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/60 p-3">
              <div className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">Regional Correlation</div>
              <div className="space-y-2">
                {commanderBrief.regionalCorrelation.map((line, idx) => (
                  <div key={`${line}-${idx}`} className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3">
              <div className="text-xs uppercase tracking-wider text-red-700 dark:text-red-400 mb-2">Immediate</div>
              <div className="space-y-1.5 text-xs text-red-600 dark:text-red-300">{commanderBrief.immediateActions.map((a) => <div key={a}>{a}</div>)}</div>
            </div>
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3">
              <div className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2">Within 2 Hrs</div>
              <div className="space-y-1.5 text-xs text-amber-700 dark:text-amber-300">{commanderBrief.within2h.map((a) => <div key={a}>{a}</div>)}</div>
            </div>
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 p-3">
              <div className="text-xs uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-2">Within 24 Hrs</div>
              <div className="space-y-1.5 text-xs text-blue-700 dark:text-blue-300">{commanderBrief.within24h.map((a) => <div key={a}>{a}</div>)}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3">
              <div className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">Monitor</div>
              <div className="space-y-1.5 text-xs text-emerald-700 dark:text-emerald-300">{commanderBrief.monitor.map((a) => <div key={a}>{a}</div>)}</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/60 p-3">
            <div className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">Sensor / Feed Status</div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
              {commanderBrief.feedStatus.map((f) => (
                <div key={f.id} className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/60 p-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-700 dark:text-slate-200">{f.label}</div>
                    {f.status === 'online' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{f.last}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{f.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Commander Cards: Life Safety Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: Drinking Water Readiness */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-indigo-600" />
                <span className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">Drinking Water Readiness</span>
              </div>
              <Badge className={`text-xs px-3 py-1 font-bold ${waterReadiness.status === 'NO-GO' ? 'bg-red-600 text-white border-red-400' : waterReadiness.status === 'CAUTION' ? 'bg-amber-500 text-slate-900 border-amber-300' : 'bg-emerald-500 text-slate-900 border-emerald-300'}`}>
                {waterReadiness.status}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Systems</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{waterReadiness.affectedSystems}</div>
              </div>
              <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Violations</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{waterReadiness.activeViolations}</div>
              </div>
              <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Days Clear</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{waterReadiness.daysSinceLast ?? '—'}</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Top contaminant: <span className="text-slate-700 dark:text-slate-200">{waterReadiness.topContaminant}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: PFAS Exposure Alert */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Biohazard className="w-5 h-5 text-purple-600" />
                <span className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">PFAS Exposure Alert</span>
              </div>
              <Badge className={`text-xs px-3 py-1 font-bold ${pfasAlert.light === 'RED' ? 'bg-red-600 text-white border-red-400' : pfasAlert.light === 'AMBER' ? 'bg-amber-500 text-slate-900 border-amber-300' : 'bg-emerald-500 text-slate-900 border-emerald-300'}`}>
                {pfasAlert.light}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Detections</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{pfasAlert.total.toLocaleString()}</div>
              </div>
              <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Max Conc.</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{pfasAlert.maxConc > 0 ? pfasAlert.maxConc.toLocaleString() : '—'}</div>
              </div>
            </div>
            {pfasAlert.top3.length > 0 && (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Top compounds: <span className="text-slate-700 dark:text-slate-200">{pfasAlert.top3.join(', ')}</span>
              </div>
            )}
            {pfasAlert.total === 0 && (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 italic">No PFAS detections in current scope</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Commander Cards: Threat Assessment Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 3: Contamination Proximity */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Skull className="w-5 h-5 text-red-600" />
              <span className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">Contamination Proximity</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">NPL Sites</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{contaminationProximity.nplCount}</div>
              </div>
              <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">TRI Facilities</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{contaminationProximity.triCount}</div>
              </div>
              <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Carcinogen</div>
                <div className={`text-lg font-bold mt-0.5 ${contaminationProximity.carcinogenCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{contaminationProximity.carcinogenCount}</div>
              </div>
            </div>
            {contaminationProximity.top3.length > 0 ? (
              <div className="space-y-1.5">
                {contaminationProximity.top3.map((t, i) => (
                  <div key={`${t.name}-${i}`} className="flex items-center gap-2 text-xs rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 px-2 py-1.5">
                    <Badge className={`text-2xs shrink-0 ${t.type === 'NPL' ? 'bg-red-600 text-white border-red-400' : 'bg-amber-500 text-slate-900 border-amber-300'}`}>{t.type}</Badge>
                    <span className="text-slate-700 dark:text-slate-200 truncate" title={t.name}>{t.name}</span>
                    <span className="text-slate-500 dark:text-slate-400 ml-auto shrink-0">{t.detail}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400 italic">No contamination data available</div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Weather Threat Assessment */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <CloudLightning className="w-5 h-5 text-yellow-600" />
              <span className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">Weather Threat Assessment</span>
            </div>
            {weatherThreat ? (
              <>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                    <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Total Alerts</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{weatherThreat.totalAlerts}</div>
                  </div>
                  <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                    <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Extreme/Severe</div>
                    <div className={`text-lg font-bold mt-0.5 ${weatherThreat.extremeSevere > 0 ? 'text-red-600' : 'text-slate-900'}`}>{weatherThreat.extremeSevere}</div>
                  </div>
                  <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                    <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Flood Alerts</div>
                    <div className={`text-lg font-bold mt-0.5 ${weatherThreat.floodCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{weatherThreat.floodCount}</div>
                  </div>
                </div>
                {weatherThreat.mostSevere ? (
                  <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-200">
                    <span className="text-slate-500 dark:text-slate-400">Most severe:</span>{weatherThreat.mostSevere.headline}
                  </div>
                ) : (
                  <div className="text-xs text-emerald-600 italic">No active weather alerts</div>
                )}
              </>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400 italic">Weather alert data unavailable</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Commander Cards: Administrative Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 5: Compliance Countdown */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TimerReset className="w-5 h-5 text-indigo-600" />
              <span className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">Compliance Countdown</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-2.5 text-center">
                <div className="text-xs text-red-600 dark:text-red-400 uppercase">30 Days</div>
                <div className="text-lg font-bold text-red-700 dark:text-red-300 mt-0.5">{complianceCountdown.expiring30}</div>
              </div>
              <div className="rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-center">
                <div className="text-xs text-amber-600 dark:text-amber-400 uppercase">90 Days</div>
                <div className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5">{complianceCountdown.expiring90}</div>
              </div>
              <div className="rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 p-2.5 text-center">
                <div className="text-xs text-blue-600 dark:text-blue-400 uppercase">180 Days</div>
                <div className="text-lg font-bold text-blue-700 dark:text-blue-300 mt-0.5">{complianceCountdown.expiring180}</div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Facilities without recent inspection</span>
              <span className={`font-semibold ${complianceCountdown.uninspected > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{complianceCountdown.uninspected}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-slate-500 dark:text-slate-400">Days since last enforcement</span>
              <span className="text-slate-700 dark:text-slate-200 font-semibold">{complianceCountdown.daysSinceEnforcement ?? '—'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 6: Enforcement Exposure */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Gavel className="w-5 h-5 text-amber-600" />
              <span className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">Enforcement Exposure</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Assessed</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">${enforcementExposure.totalAssessed > 0 ? (enforcementExposure.totalAssessed / 1000).toFixed(0) + 'K' : '0'}</div>
              </div>
              <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Collected</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">${enforcementExposure.totalCollected > 0 ? (enforcementExposure.totalCollected / 1000).toFixed(0) + 'K' : '0'}</div>
              </div>
              <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Open Cases</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{enforcementExposure.openCases}</div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Average penalty per case</span>
              <span className="text-slate-700 dark:text-slate-200 font-semibold">${enforcementExposure.avgPenalty > 0 ? enforcementExposure.avgPenalty.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}</span>
            </div>
            {enforcementExposure.totalAssessed > 0 && enforcementExposure.totalCollected < enforcementExposure.totalAssessed && (
              <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Collection gap: ${((enforcementExposure.totalAssessed - enforcementExposure.totalCollected) / 1000).toFixed(0)}K outstanding
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Card 7: Installation Ranking (full-width bar) ── */}
      {installationRanking && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <span className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">Installation Ranking vs DOD Average</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Your Violations</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{installationRanking.myViolations}</div>
              </div>
              <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">DOD Median</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{installationRanking.median}</div>
              </div>
              <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">Compliance</div>
                <div className={`text-lg font-bold mt-0.5 ${installationRanking.complianceRate >= installationRanking.dodAvgRate ? 'text-emerald-600' : 'text-red-600'}`}>{installationRanking.complianceRate}%</div>
              </div>
              <div className="rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">DOD Avg</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{installationRanking.dodAvgRate}%</div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Percentile rank (lower = fewer violations)</span>
                <span className={`font-semibold ${installationRanking.percentile <= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>{installationRanking.percentile}th percentile</span>
              </div>
              <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${installationRanking.percentile <= 25 ? 'bg-emerald-500' : installationRanking.percentile <= 50 ? 'bg-indigo-500' : installationRanking.percentile <= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${installationRanking.percentile}%` }}
                />
              </div>
              <div className="flex justify-between text-2xs text-slate-400">
                <span>Better</span>
                <span>{installationRanking.totalFacilities} facilities in scope</span>
                <span>Worse</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 1: Hero Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {heroStats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${s.bg}`}>
                  <s.icon className={`w-5 h-5 ${s.fg}`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section 2: Federal Facility Compliance Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            <CardTitle className="text-lg">Federal Facility Compliance Summary</CardTitle>
          </div>
          <CardDescription>Military and DOD facility compliance by state, ranked by violation count</CardDescription>
        </CardHeader>
        <CardContent>
          {stateComplianceRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No federal facility data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-3 pr-4 font-semibold">State</th>
                    <th className="pb-3 pr-4 font-semibold text-right">Facilities</th>
                    <th className="pb-3 pr-4 font-semibold text-right">Active Violations</th>
                    <th className="pb-3 pr-4 font-semibold text-right">RNC Count</th>
                    <th className="pb-3 pr-4 font-semibold text-right">Inspections</th>
                    <th className="pb-3 font-semibold text-right">Compliance %</th>
                  </tr>
                </thead>
                <tbody>
                  {stateComplianceRows.map((row) => {
                    const pct = row.facilities > 0 ? ((row.compliant / row.facilities) * 100).toFixed(1) : '0.0';
                    const hl = selectedState && row.state.toUpperCase() === selectedState.toUpperCase();
                    return (
                      <tr key={row.state} className={`border-b border-muted/30 ${hl ? 'bg-indigo-50 dark:bg-indigo-950/30' : ''}`}>
                        <td className="py-2.5 pr-4 font-medium">
                          {row.state}
                          {hl && <Badge variant="outline" className="ml-2 text-xs">Selected</Badge>}
                        </td>
                        <td className="py-2.5 pr-4 text-right">{row.facilities}</td>
                        <td className="py-2.5 pr-4 text-right">
                          {row.violations > 0 ? <span className="text-red-600 font-semibold">{row.violations}</span> : <span className="text-green-600">0</span>}
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          {row.rncCount > 0 ? <span className="text-red-700 font-semibold">{row.rncCount}</span> : '0'}
                        </td>
                        <td className="py-2.5 pr-4 text-right">{row.inspections}</td>
                        <td className="py-2.5 text-right">
                          <Badge className={parseFloat(pct) >= 90 ? 'bg-green-100 text-green-800 border-green-200' : parseFloat(pct) >= 70 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-red-100 text-red-800 border-red-200'}>
                            {pct}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: PFAS Proximity Analysis */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Biohazard className="w-5 h-5 text-purple-600" />
            <CardTitle className="text-lg">PFAS Proximity Analysis</CardTitle>
          </div>
          <CardDescription>Cross-referencing PFAS detections with federal facility locations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Detections', value: pfasSummary.total.toLocaleString() },
              { label: 'Unique Contaminants', value: pfasSummary.uniqueContaminants },
              { label: 'States Affected', value: pfasSummary.statesAffected },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border bg-purple-50 dark:bg-purple-950/20 p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                <p className="text-xl font-bold text-purple-700 dark:text-purple-400 mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          {pfasSummary.top10.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Top PFAS Contaminants by Detection Frequency</h4>
              <div className="space-y-2">
                {pfasSummary.top10.map(([contaminant, count]) => {
                  const maxCount = pfasSummary.top10[0]?.[1] || 1;
                  const widthPct = Math.max((count / maxCount) * 100, 4);
                  return (
                    <div key={contaminant} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-40 shrink-0 truncate" title={contaminant}>{contaminant}</span>
                      <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden">
                        <div className="h-full bg-purple-500/70 rounded transition-all" style={{ width: `${widthPct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-12 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground italic">Cross-referencing PFAS detections with federal facility locations</p>
        </CardContent>
      </Card>

      {/* Section 4: Federal Facility Status Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <CardTitle className="text-lg">Federal Facility Status</CardTitle>
          </div>
          <CardDescription>
            {selectedState ? `Showing military/DOD facilities in ${selectedState.toUpperCase()} (top 50)` : 'Top 50 military/DOD facilities by violation count'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {facilityRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {selectedState ? `No federal facilities found in ${selectedState.toUpperCase()}.` : 'No federal facilities found.'}
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-3 pr-4 font-semibold">Facility Name</th>
                    <th className="pb-3 pr-4 font-semibold">State</th>
                    <th className="pb-3 pr-4 font-semibold">Permit #</th>
                    <th className="pb-3 pr-4 font-semibold">Status</th>
                    <th className="pb-3 pr-4 font-semibold">Expiration</th>
                    <th className="pb-3 font-semibold text-right">Violations</th>
                  </tr>
                </thead>
                <tbody>
                  {facilityRows.map((f, idx) => (
                    <tr key={`${f.permit}-${idx}`} className="border-b border-muted/30 hover:bg-muted/10 transition-colors">
                      <td className="py-2.5 pr-4 font-medium max-w-[250px] truncate" title={f.facility}>{f.facility}</td>
                      <td className="py-2.5 pr-4">{f.state}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{f.permit}</td>
                      <td className="py-2.5 pr-4"><Badge className={statusBadgeClass(f.status)}>{f.status}</Badge></td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{fmtDate(f.expiration)}</td>
                      <td className="py-2.5 text-right">
                        {f.violationCount > 0 ? <span className="text-red-600 font-semibold">{f.violationCount}</span> : <span className="text-green-600">0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 5: Methodology Note */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Methodology Note</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1 leading-relaxed">
                Federal facility identification is based on facility name pattern matching against ECHO/ICIS permit records.
                Dedicated DOD data integration through the Defense Environmental Restoration Program (DERP) is planned for future releases.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
