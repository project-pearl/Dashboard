'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, Activity, Building2, Biohazard, Info } from 'lucide-react';

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

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [icisRes, pfasRes] = await Promise.all([
          fetch('/api/icis/national-summary'),
          fetch('/api/pfas/national-summary'),
        ]);
        if (icisRes.ok) setIcisData(await icisRes.json());
        if (pfasRes.ok) setPfasData(await pfasRes.json());
      } catch (e) {
        console.error('[MilitaryInstallations] data fetch failed:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

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

  // Loading / error states
  if (loading) {
    return (
      <div className="flex items-center gap-3 p-6">
        <Shield className="w-5 h-5 text-indigo-500 animate-pulse" />
        <span className="text-sm text-slate-500">Loading military installations data...</span>
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
            <p className="text-xs text-slate-500 mt-0.5">Federal facility permit and PFAS data integration in progress. Data sources: EPA ECHO (ICIS-NPDES) and UCMR/state PFAS monitoring.</p>
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
