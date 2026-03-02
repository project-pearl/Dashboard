'use client';

import React, { useState, useMemo, type CSSProperties } from 'react';
import { Shield, AlertTriangle, FileCheck, Gavel, Activity, ClipboardCheck, Clock, ChevronUp, ChevronDown, Filter, Search } from 'lucide-react';
import { KPIStrip, type KPICard } from '@/components/KPIStrip';
import { DashboardSection } from '@/components/DashboardSection';
import { useICISData } from '@/lib/useICISData';
import { CacheAgeBadge } from '@/components/CacheAgeBadge';

// ── Props ───────────────────────────────────────────────────────────────────

interface ICISCompliancePanelProps {
  state?: string;
  lat?: number;
  lng?: number;
  permitNumber?: string;
  compactMode?: boolean;
  className?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
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

export function ICISCompliancePanel({
  state,
  lat,
  lng,
  permitNumber,
  compactMode = false,
  className = '',
}: ICISCompliancePanelProps) {
  const { permits, violations, dmr, enforcement, summary, isLoading, error, fromCache, meta, refreshInProgress, refresh } = useICISData({
    state,
    lat,
    lng,
    permitNumber,
    enabled: !!(state || (lat && lng) || permitNumber),
  });

  // ── Filter state ──────────────────────────────────────────────────────
  const [violSeverity, setViolSeverity] = useState<'all' | 'snc' | 'moderate'>('all');
  const [violSearch, setViolSearch] = useState('');
  const [violSortCol, setViolSortCol] = useState<'permit' | 'desc' | 'date' | 'severity'>('date');
  const [violSortDir, setViolSortDir] = useState<'asc' | 'desc'>('desc');

  const [enfType, setEnfType] = useState('all');
  const [enfSearch, setEnfSearch] = useState('');

  const [dmrParam, setDmrParam] = useState('all');
  const [dmrSearch, setDmrSearch] = useState('');
  const TABLE_MAX_HEIGHT = 'max-h-[240px]';
  const TWO_LINE_CLAMP: CSSProperties = {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
  };

  // ── Derived filter options ────────────────────────────────────────────
  const enforcementTypes = useMemo(() => {
    const types = new Set<string>();
    for (const e of enforcement) if (e.actionType) types.add(e.actionType);
    return Array.from(types).sort();
  }, [enforcement]);

  const dmrParams = useMemo(() => {
    const params = new Set<string>();
    for (const d of dmr) if (d.exceedance && d.paramDesc) params.add(d.paramDesc);
    return Array.from(params).sort();
  }, [dmr]);

  // ── Filtered + sorted violations ──────────────────────────────────────
  const filteredViolations = useMemo(() => {
    let list = [...violations];
    if (violSeverity === 'snc') list = list.filter(v => v.rnc || v.severity === 'S');
    else if (violSeverity === 'moderate') list = list.filter(v => v.severity === 'M');
    if (violSearch) {
      const q = violSearch.toLowerCase();
      list = list.filter(v =>
        (v.permit || '').toLowerCase().includes(q) ||
        (v.desc || v.code || '').toLowerCase().includes(q)
      );
    }
    const dir = violSortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (violSortCol) {
        case 'permit': return dir * (a.permit || '').localeCompare(b.permit || '');
        case 'desc': return dir * (a.desc || a.code || '').localeCompare(b.desc || b.code || '');
        case 'date': return dir * (a.date || '').localeCompare(b.date || '');
        case 'severity': {
          const sA = a.rnc || a.severity === 'S' ? 2 : a.severity === 'M' ? 1 : 0;
          const sB = b.rnc || b.severity === 'S' ? 2 : b.severity === 'M' ? 1 : 0;
          return dir * (sA - sB);
        }
        default: return 0;
      }
    });
    return list;
  }, [violations, violSeverity, violSearch, violSortCol, violSortDir]);

  // ── Filtered + sorted enforcement ─────────────────────────────────────
  const filteredEnforcement = useMemo(() => {
    let list = [...enforcement];
    if (enfType !== 'all') list = list.filter(e => e.actionType === enfType);
    if (enfSearch) {
      const q = enfSearch.toLowerCase();
      list = list.filter(e =>
        (e.permit || '').toLowerCase().includes(q) ||
        (e.caseNumber || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => (b.settlementDate || '').localeCompare(a.settlementDate || ''));
    return list;
  }, [enforcement, enfType, enfSearch]);

  // ── Filtered DMR exceedances ──────────────────────────────────────────
  const filteredDmr = useMemo(() => {
    let list = dmr.filter(d => d.exceedance);
    if (dmrParam !== 'all') list = list.filter(d => d.paramDesc === dmrParam);
    if (dmrSearch) {
      const q = dmrSearch.toLowerCase();
      list = list.filter(d =>
        (d.permit || '').toLowerCase().includes(q) ||
        (d.paramDesc || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => (b.period || '').localeCompare(a.period || ''));
    return list;
  }, [dmr, dmrParam, dmrSearch]);

  if (isLoading) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-indigo-500 animate-pulse" />
          <span className="text-sm text-slate-500">Loading NPDES compliance data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-slate-400" />
          <span className="text-sm text-slate-400">NPDES data unavailable: {error}</span>
        </div>
      </div>
    );
  }

  if (permits.length === 0 && violations.length === 0 && enforcement.length === 0) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-slate-400" />
          <span className="text-sm text-slate-400">No NPDES compliance data found for this area</span>
        </div>
      </div>
    );
  }

  // ── KPI Cards ──────────────────────────────────────────────────────────
  const kpiCards: KPICard[] = [
    {
      label: 'Total Permits',
      value: permits.length,
      icon: FileCheck,
      status: permits.length > 0 ? 'good' : 'warning',
    },
    {
      label: 'In Compliance',
      value: summary.activePermits,
      icon: Shield,
      status: summary.activePermits > 0 ? 'good' : 'warning',
    },
    {
      label: 'SNC Facilities',
      value: summary.significantViolations,
      icon: AlertTriangle,
      status: summary.significantViolations === 0 ? 'good' : 'critical',
    },
    {
      label: 'Enforcement Actions',
      value: summary.enforcementTotal,
      icon: Gavel,
      status: summary.enforcementTotal === 0 ? 'good' : 'warning',
    },
    {
      label: 'Total Penalties',
      value: formatCurrency(summary.totalPenalties),
      icon: Activity,
      status: summary.totalPenalties === 0 ? 'good' : summary.totalPenalties > 100000 ? 'critical' : 'warning',
    },
    {
      label: 'DMR Exceedance',
      value: `${summary.dmrExceedanceRate}%`,
      icon: ClipboardCheck,
      status: summary.dmrExceedanceRate <= 5 ? 'good' : summary.dmrExceedanceRate <= 15 ? 'warning' : 'critical',
    },
    {
      label: 'Expiring (90d)',
      value: summary.expiringPermits,
      icon: Clock,
      status: summary.expiringPermits === 0 ? 'good' : 'warning',
    },
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Shield className="w-3.5 h-3.5" />
        <span>EPA ICIS / NPDES Compliance</span>
        <CacheAgeBadge
          fetchedAt={meta?.fetchedAt}
          ageLabel={meta?.ageLabel}
          isStale={meta?.isStale}
          refreshInProgress={refreshInProgress}
          onRefresh={fromCache ? refresh : undefined}
        />
      </div>

      {/* KPI Strip */}
      <KPIStrip cards={kpiCards} />

      {/* Recent Violations */}
      {violations.length > 0 && (
        <DashboardSection
          title="Violations"
          subtitle={`${filteredViolations.length}${filteredViolations.length !== violations.length ? ' filtered' : ''} of ${violations.length} violations`}
          accent="red"
          icon={<AlertTriangle className="w-4 h-4" />}
          defaultExpanded={!compactMode}
        >
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 mt-2 mb-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <select
              value={violSeverity}
              onChange={e => { setViolSeverity(e.target.value as 'all' | 'snc' | 'moderate'); }}
              className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300"
            >
              <option value="all">All Severities</option>
              <option value="snc">SNC Only</option>
              <option value="moderate">Moderate Only</option>
            </select>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search permit or violation..."
                value={violSearch}
                onChange={e => { setViolSearch(e.target.value); }}
                className="text-xs border border-slate-200 rounded-md pl-7 pr-2 py-1.5 w-48 bg-white text-slate-700 placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300"
              />
            </div>
          </div>

          {/* Sortable table */}
          <div className={`overflow-auto rounded-lg border border-slate-200 ${TABLE_MAX_HEIGHT}`}>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {([
                    ['permit', 'Permit'],
                    ['desc', 'Violation'],
                    ['date', 'Date'],
                    ['severity', 'Severity'],
                  ] as const).map(([col, label]) => (
                    <th
                      key={col}
                      className="px-2.5 py-2 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                      onClick={() => {
                        if (violSortCol === col) setViolSortDir(d => d === 'asc' ? 'desc' : 'asc');
                        else { setViolSortCol(col); setViolSortDir('desc'); }
                      }}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        {label}
                        {violSortCol === col && (violSortDir === 'asc'
                          ? <ChevronUp className="w-3 h-3" />
                          : <ChevronDown className="w-3 h-3" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredViolations.map((v, i) => (
                  <tr key={`${v.permit}-${v.code}-${v.date}-${i}`} className="hover:bg-slate-50">
                    <td className="px-2.5 py-2 font-mono text-slate-700">{v.permit || '—'}</td>
                    <td className="px-2.5 py-2 text-slate-700 max-w-[26rem]">
                      <span style={TWO_LINE_CLAMP} title={v.desc || v.code || '—'}>
                        {v.desc || v.code || '—'}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-slate-600 whitespace-nowrap">{v.date ? formatDate(v.date) : '—'}</td>
                    <td className="px-2.5 py-2">
                      {v.rnc || v.severity === 'S' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">SNC</span>
                      ) : v.severity === 'M' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">Moderate</span>
                      ) : v.severity ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">{v.severity}</span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </DashboardSection>
      )}

      {/* Enforcement Actions */}
      {enforcement.length > 0 && (
        <DashboardSection
          title="Enforcement Actions"
          subtitle={`${filteredEnforcement.length}${filteredEnforcement.length !== enforcement.length ? ' filtered' : ''} of ${enforcement.length} actions, ${formatCurrency(summary.totalPenalties)} in penalties`}
          accent="amber"
          icon={<Gavel className="w-4 h-4" />}
          defaultExpanded={!compactMode}
        >
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 mt-2 mb-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
            </div>
            {enforcementTypes.length > 1 && (
              <select
                value={enfType}
                onChange={e => { setEnfType(e.target.value); }}
                className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-amber-300 focus:border-amber-300"
              >
                <option value="all">All Action Types</option>
                {enforcementTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search permit or case..."
                value={enfSearch}
                onChange={e => { setEnfSearch(e.target.value); }}
                className="text-xs border border-slate-200 rounded-md pl-7 pr-2 py-1.5 w-44 bg-white text-slate-700 placeholder:text-slate-400 focus:ring-1 focus:ring-amber-300 focus:border-amber-300"
              />
            </div>
          </div>

          <div className={`overflow-auto rounded-lg border border-slate-200 ${TABLE_MAX_HEIGHT}`}>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-2.5 py-2">Facility / Permit</th>
                  <th className="px-2.5 py-2">Case ID</th>
                  <th className="px-2.5 py-2">Type</th>
                  <th className="px-2.5 py-2">Date</th>
                  <th className="px-2.5 py-2 text-right">Penalty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEnforcement.map((e, i) => (
                  <tr key={`${e.caseNumber}-${e.permit}-${i}`} className="hover:bg-slate-50">
                    <td className="px-2.5 py-2 font-mono text-slate-700">{e.permit || '—'}</td>
                    <td className="px-2.5 py-2 text-slate-700">{e.caseNumber || '—'}</td>
                    <td className="px-2.5 py-2 text-slate-600 max-w-[18rem]">
                      <span style={TWO_LINE_CLAMP} title={e.actionType || '—'}>
                        {e.actionType || '—'}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-slate-600 whitespace-nowrap">{e.settlementDate ? formatDate(e.settlementDate) : '—'}</td>
                    <td className="px-2.5 py-2 text-right font-semibold text-red-700">
                      {e.penaltyAssessed > 0 ? formatCurrency(e.penaltyAssessed) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </DashboardSection>
      )}

      {/* DMR Exceedances */}
      {dmr.filter(d => d.exceedance).length > 0 && (
        <DashboardSection
          title="DMR Exceedances"
          subtitle={`${filteredDmr.length}${filteredDmr.length !== dmr.filter(d => d.exceedance).length ? ' filtered' : ''} exceedances — ${summary.dmrExceedanceRate}% rate`}
          accent="blue"
          icon={<ClipboardCheck className="w-4 h-4" />}
          defaultExpanded={!compactMode}
        >
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 mt-2 mb-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
            </div>
            {dmrParams.length > 1 && (
              <select
                value={dmrParam}
                onChange={e => { setDmrParam(e.target.value); }}
                className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-blue-300 focus:border-blue-300 max-w-[200px] truncate"
              >
                <option value="all">All Parameters</option>
                {dmrParams.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search permit..."
                value={dmrSearch}
                onChange={e => { setDmrSearch(e.target.value); }}
                className="text-xs border border-slate-200 rounded-md pl-7 pr-2 py-1.5 w-36 bg-white text-slate-700 placeholder:text-slate-400 focus:ring-1 focus:ring-blue-300 focus:border-blue-300"
              />
            </div>
          </div>

          <div className={`overflow-auto rounded-lg border border-slate-200 ${TABLE_MAX_HEIGHT}`}>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-2.5 py-2">Permit</th>
                  <th className="px-2.5 py-2">Parameter</th>
                  <th className="px-2.5 py-2 text-right">Actual</th>
                  <th className="px-2.5 py-2 text-right">Limit</th>
                  <th className="px-2.5 py-2">Unit</th>
                  <th className="px-2.5 py-2">Period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDmr.map((d, i) => (
                  <tr key={`${d.permit}-${d.paramDesc}-${d.period}-${i}`} className="hover:bg-slate-50">
                    <td className="px-2.5 py-2 font-mono text-slate-700">{d.permit || '—'}</td>
                    <td className="px-2.5 py-2 text-slate-700 max-w-[18rem]">
                      <span style={TWO_LINE_CLAMP} title={d.paramDesc || '—'}>
                        {d.paramDesc || '—'}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-right font-semibold text-red-700">
                      {d.dmrValue !== null ? d.dmrValue.toFixed(2) : '—'}
                    </td>
                    <td className="px-2.5 py-2 text-right text-slate-500">
                      {d.limitValue !== null ? d.limitValue.toFixed(2) : '—'}
                    </td>
                    <td className="px-2.5 py-2 text-slate-500">{d.unit || '—'}</td>
                    <td className="px-2.5 py-2 text-slate-500 whitespace-nowrap">{formatDate(d.period)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </DashboardSection>
      )}
    </div>
  );
}


