'use client';

import React from 'react';
import { Shield, AlertTriangle, FileCheck, Gavel, Activity, ClipboardCheck, Clock } from 'lucide-react';
import { KPIStrip, type KPICard } from '@/components/KPIStrip';
import { DashboardSection } from '@/components/DashboardSection';
import { useICISData } from '@/lib/useICISData';

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
  const { permits, violations, dmr, enforcement, summary, isLoading, error, fromCache } = useICISData({
    state,
    lat,
    lng,
    permitNumber,
    enabled: !!(state || (lat && lng) || permitNumber),
  });

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

  // ── Sorted lists ────────────────────────────────────────────────────────
  const recentViolations = [...violations]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, compactMode ? 5 : 15);

  const recentEnforcement = [...enforcement]
    .sort((a, b) => (b.settlementDate || '').localeCompare(a.settlementDate || ''))
    .slice(0, compactMode ? 10 : 25);

  const dmrExceedances = dmr
    .filter(d => d.exceedance)
    .sort((a, b) => (b.period || '').localeCompare(a.period || ''))
    .slice(0, compactMode ? 5 : 15);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Shield className="w-3.5 h-3.5" />
        <span>EPA ICIS / NPDES Compliance{fromCache ? ' (cached)' : ''}</span>
      </div>

      {/* KPI Strip */}
      <KPIStrip cards={kpiCards} />

      {/* Recent Violations */}
      {recentViolations.length > 0 && (
        <DashboardSection
          title="Recent Violations"
          subtitle={`${violations.length} total violations found`}
          accent="red"
          icon={<AlertTriangle className="w-4 h-4" />}
          defaultExpanded={!compactMode}
        >
          <div className="overflow-x-auto mt-3 rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-2.5 py-2">Permit</th>
                  <th className="px-2.5 py-2">Violation</th>
                  <th className="px-2.5 py-2">Date</th>
                  <th className="px-2.5 py-2">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentViolations.map((v, i) => (
                  <tr key={`${v.permit}-${v.code}-${v.date}-${i}`} className="hover:bg-slate-50">
                    <td className="px-2.5 py-2 font-mono text-slate-700">{v.permit || '—'}</td>
                    <td className="px-2.5 py-2 text-slate-700">{v.desc || v.code || '—'}</td>
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

      {/* Enforcement Actions — TABLE format */}
      {recentEnforcement.length > 0 && (
        <DashboardSection
          title="Enforcement Actions"
          subtitle={`${enforcement.length} actions, ${formatCurrency(summary.totalPenalties)} in penalties`}
          accent="amber"
          icon={<Gavel className="w-4 h-4" />}
          defaultExpanded={!compactMode}
        >
          <div className="overflow-x-auto mt-3 rounded-lg border border-slate-200">
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
                {recentEnforcement.map((e, i) => (
                  <tr key={`${e.caseNumber}-${e.permit}-${i}`} className="hover:bg-slate-50">
                    <td className="px-2.5 py-2 font-mono text-slate-700">{e.permit || '—'}</td>
                    <td className="px-2.5 py-2 text-slate-700">{e.caseNumber || '—'}</td>
                    <td className="px-2.5 py-2 text-slate-600">{e.actionType || '—'}</td>
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
      {dmrExceedances.length > 0 && (
        <DashboardSection
          title="DMR Exceedances"
          subtitle={`${summary.dmrExceedanceRate}% exceedance rate`}
          accent="blue"
          icon={<ClipboardCheck className="w-4 h-4" />}
          defaultExpanded={!compactMode}
        >
          <div className="overflow-x-auto mt-3 rounded-lg border border-slate-200">
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
                {dmrExceedances.map((d, i) => (
                  <tr key={`${d.permit}-${d.paramDesc}-${d.period}-${i}`} className="hover:bg-slate-50">
                    <td className="px-2.5 py-2 font-mono text-slate-700">{d.permit || '—'}</td>
                    <td className="px-2.5 py-2 text-slate-700">{d.paramDesc || '—'}</td>
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
