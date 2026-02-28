'use client';

import React, { useState, useMemo } from 'react';
import { Droplets, AlertTriangle, Users, Gavel, Shield, Beaker, ChevronUp, ChevronDown } from 'lucide-react';
import { KPIStrip, type KPICard } from '@/components/KPIStrip';
import { DashboardSection } from '@/components/DashboardSection';
import { useSDWISData } from '@/lib/useSDWISData';

// ── Props ───────────────────────────────────────────────────────────────────

interface SDWISCompliancePanelProps {
  state?: string;
  lat?: number;
  lng?: number;
  pwsid?: string;
  compactMode?: boolean;
  className?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatPopulation(pop: number): string {
  if (pop >= 1_000_000) return `${(pop / 1_000_000).toFixed(1)}M`;
  if (pop >= 1_000) return `${(pop / 1_000).toFixed(0)}K`;
  return pop.toLocaleString();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export function SDWISCompliancePanel({
  state,
  lat,
  lng,
  pwsid,
  compactMode = false,
  className = '',
}: SDWISCompliancePanelProps) {
  const { systems, violations, enforcement, summary, isLoading, error, fromCache } = useSDWISData({
    state,
    lat,
    lng,
    pwsid,
    enabled: !!(state || (lat && lng) || pwsid),
  });

  const [filterMajor, setFilterMajor] = useState(false);
  const [filterHealthBased, setFilterHealthBased] = useState(false);
  const [sortCol, setSortCol] = useState<'pwsid' | 'contaminant' | 'rule' | 'date' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [violPage, setViolPage] = useState(0);
  const VIOL_PAGE_SIZE = compactMode ? 10 : 25;

  if (isLoading) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <Droplets className="w-5 h-5 text-blue-500 animate-pulse" />
          <span className="text-sm text-slate-500">Loading SDWIS drinking water data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <Droplets className="w-5 h-5 text-slate-400" />
          <span className="text-sm text-slate-400">SDWIS data unavailable: {error}</span>
        </div>
      </div>
    );
  }

  if (systems.length === 0 && violations.length === 0 && enforcement.length === 0) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <Droplets className="w-5 h-5 text-slate-400" />
          <span className="text-sm text-slate-400">No SDWIS drinking water data found for this area</span>
        </div>
      </div>
    );
  }

  // ── KPI Cards ──────────────────────────────────────────────────────────
  const kpiCards: KPICard[] = [
    {
      label: 'Total Systems',
      value: summary.totalSystems,
      icon: Droplets,
      status: summary.totalSystems > 0 ? 'good' : 'warning',
    },
    {
      label: 'Population Served',
      value: formatPopulation(summary.populationServed),
      icon: Users,
      status: 'good',
    },
    {
      label: 'Violations',
      value: summary.totalViolations,
      icon: AlertTriangle,
      status: summary.totalViolations === 0 ? 'good' : summary.majorViolations > 0 ? 'critical' : 'warning',
    },
    {
      label: 'Health-Based',
      value: summary.healthBasedViolations,
      icon: Shield,
      status: summary.healthBasedViolations === 0 ? 'good' : 'critical',
    },
    {
      label: 'Major Violators',
      value: summary.majorViolations,
      icon: Beaker,
      status: summary.majorViolations === 0 ? 'good' : 'critical',
    },
    {
      label: 'Enforcement',
      value: summary.enforcementActions,
      icon: Gavel,
      status: summary.enforcementActions === 0 ? 'good' : 'warning',
    },
  ];

  // ── System name lookup ────────────────────────────────────────────────
  const sysNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of systems) if (s.pwsid && s.name) m.set(s.pwsid, s.name);
    return m;
  }, [systems]);

  const sysPopMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of systems) if (s.pwsid) m.set(s.pwsid, s.population || 0);
    return m;
  }, [systems]);

  // ── Filtered & sorted violations ───────────────────────────────────────
  const sortedViolations = useMemo(() => {
    let filtered = [...violations];
    if (filterMajor) filtered = filtered.filter(v => v.isMajor);
    if (filterHealthBased) filtered = filtered.filter(v => v.isHealthBased);

    const dir = sortDir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      switch (sortCol) {
        case 'pwsid': return dir * (a.pwsid || '').localeCompare(b.pwsid || '');
        case 'contaminant': return dir * (a.contaminant || a.code || '').localeCompare(b.contaminant || b.code || '');
        case 'rule': return dir * (a.rule || '').localeCompare(b.rule || '');
        case 'date': return dir * (a.compliancePeriod || '').localeCompare(b.compliancePeriod || '');
        case 'status': {
          const sA = a.isMajor ? 2 : a.isHealthBased ? 1 : 0;
          const sB = b.isMajor ? 2 : b.isHealthBased ? 1 : 0;
          return dir * (sA - sB);
        }
        default: return 0;
      }
    });
    return filtered;
  }, [violations, filterMajor, filterHealthBased, sortCol, sortDir]);

  const violPageCount = Math.max(1, Math.ceil(sortedViolations.length / VIOL_PAGE_SIZE));
  const pagedViolations = sortedViolations.slice(violPage * VIOL_PAGE_SIZE, (violPage + 1) * VIOL_PAGE_SIZE);

  // ── System type breakdown ──────────────────────────────────────────────
  const cwsCount = systems.filter(s => s.type === 'CWS').length;
  const tncwsCount = systems.filter(s => s.type === 'TNCWS').length;
  const ntncwsCount = systems.filter(s => s.type === 'NTNCWS').length;
  const totalSys = cwsCount + tncwsCount + ntncwsCount || 1;

  const sortedEnforcement = [...enforcement]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, compactMode ? 5 : 10);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Droplets className="w-3.5 h-3.5" />
        <span>EPA SDWIS — Safe Drinking Water{fromCache ? ' (cached)' : ' (live)'}</span>
      </div>

      {/* KPI Strip */}
      <KPIStrip cards={kpiCards} />

      {/* System Type Breakdown */}
      {systems.length > 0 && (
        <DashboardSection
          title="System Type Breakdown"
          subtitle={`${systems.length} public water systems`}
          accent="blue"
          icon={<Droplets className="w-4 h-4" />}
          defaultExpanded={!compactMode}
        >
          <div className="mt-3 space-y-2">
            {[
              { label: 'Community Water Systems (CWS)', count: cwsCount, color: 'bg-blue-500' },
              { label: 'Transient Non-Community (TNCWS)', count: tncwsCount, color: 'bg-cyan-500' },
              { label: 'Non-Transient Non-Community (NTNCWS)', count: ntncwsCount, color: 'bg-indigo-500' },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600">{t.label}</span>
                    <span className="font-semibold text-slate-700">{t.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${t.color}`}
                      style={{ width: `${(t.count / totalSys) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DashboardSection>
      )}

      {/* Violations Table */}
      {violations.length > 0 && (
        <DashboardSection
          title="Drinking Water Violations"
          subtitle={`${sortedViolations.length}${filterMajor || filterHealthBased ? ' filtered' : ''} of ${violations.length} violations`}
          accent="red"
          icon={<AlertTriangle className="w-4 h-4" />}
          defaultExpanded={!compactMode}
        >
          {/* Filters */}
          <div className="flex items-center gap-3 mt-2 mb-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={filterMajor}
                onChange={e => { setFilterMajor(e.target.checked); setViolPage(0); }}
                className="rounded border-slate-300"
              />
              Major only
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={filterHealthBased}
                onChange={e => { setFilterHealthBased(e.target.checked); setViolPage(0); }}
                className="rounded border-slate-300"
              />
              Health-based only
            </label>
          </div>

          {/* Sortable table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {([
                    ['pwsid', 'System'],
                    ['contaminant', 'Contaminant'],
                    ['rule', 'Type'],
                    ['date', 'Date'],
                    ['status', 'Severity'],
                  ] as const).map(([col, label]) => (
                    <th
                      key={col}
                      className="px-2.5 py-2 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                      onClick={() => {
                        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                        else { setSortCol(col); setSortDir('desc'); }
                        setViolPage(0);
                      }}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        {label}
                        {sortCol === col && (sortDir === 'asc'
                          ? <ChevronUp className="w-3 h-3" />
                          : <ChevronDown className="w-3 h-3" />
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="px-2.5 py-2 whitespace-nowrap">Pop. Served</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedViolations.map((v, i) => {
                  const sysName = sysNameMap.get(v.pwsid);
                  const pop = sysPopMap.get(v.pwsid);
                  return (
                    <tr key={`${v.pwsid}-${v.code}-${v.compliancePeriod}-${i}`} className="hover:bg-slate-50">
                      <td className="px-2.5 py-2">
                        <div className="font-medium text-slate-700">{sysName || v.pwsid}</div>
                        {sysName && <div className="text-[10px] text-slate-400">{v.pwsid}</div>}
                      </td>
                      <td className="px-2.5 py-2 text-slate-700">{v.contaminant || v.code || '—'}</td>
                      <td className="px-2.5 py-2 text-slate-600">{v.rule || '—'}</td>
                      <td className="px-2.5 py-2 text-slate-600 whitespace-nowrap">{v.compliancePeriod ? formatDate(v.compliancePeriod) : '—'}</td>
                      <td className="px-2.5 py-2">
                        {v.isMajor ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">Major</span>
                        ) : v.isHealthBased ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">Health-Based</span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">Monitoring</span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-slate-600 text-right tabular-nums">
                        {pop ? formatPopulation(pop) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {violPageCount > 1 && (
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span>Page {violPage + 1} of {violPageCount}</span>
              <div className="flex gap-1">
                <button
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  disabled={violPage === 0}
                  onClick={() => setViolPage(p => p - 1)}
                >Prev</button>
                <button
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  disabled={violPage >= violPageCount - 1}
                  onClick={() => setViolPage(p => p + 1)}
                >Next</button>
              </div>
            </div>
          )}
        </DashboardSection>
      )}

      {/* Enforcement Actions */}
      {sortedEnforcement.length > 0 && (
        <DashboardSection
          title="Enforcement Actions"
          subtitle={`${enforcement.length} actions`}
          accent="amber"
          icon={<Gavel className="w-4 h-4" />}
          defaultExpanded={!compactMode}
        >
          <div className="space-y-2 mt-3">
            {sortedEnforcement.map((e, i) => (
              <div
                key={`${e.pwsid}-${e.date}-${i}`}
                className="bg-amber-50 border border-amber-200 rounded-xl p-4"
              >
                <h4 className="text-sm font-semibold text-amber-800">{e.actionType || 'Enforcement Action'}</h4>
                <p className="text-xs text-slate-600 mt-1">
                  PWSID: {e.pwsid} | Date: {formatDate(e.date)}
                </p>
              </div>
            ))}
          </div>
        </DashboardSection>
      )}
    </div>
  );
}
