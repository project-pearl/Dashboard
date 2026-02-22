'use client';

import React from 'react';
import { Shield, AlertTriangle, FileCheck, Gavel, Activity, ClipboardCheck } from 'lucide-react';
import { KPIStrip, type KPICard } from '@/components/KPIStrip';
import { DashboardSection } from '@/components/DashboardSection';
import { StatusCard } from '@/components/StatusCard';
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

function violationSeverity(v: { rnc: boolean; severity: string }): 'critical' | 'warning' | 'good' {
  if (v.rnc || v.severity === 'S') return 'critical';
  if (v.severity === 'M' || v.severity === 'W') return 'warning';
  return 'good';
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
  const { permits, violations, dmr, enforcement, inspections, summary, isLoading, error, fromCache } = useICISData({
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
          <span className="text-sm text-slate-500">Loading ICIS compliance data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-slate-400" />
          <span className="text-sm text-slate-400">ICIS data unavailable: {error}</span>
        </div>
      </div>
    );
  }

  if (permits.length === 0 && violations.length === 0 && enforcement.length === 0) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-slate-400" />
          <span className="text-sm text-slate-400">No ICIS compliance data found for this area</span>
        </div>
      </div>
    );
  }

  // ── KPI Cards ──────────────────────────────────────────────────────────
  const kpiCards: KPICard[] = [
    {
      label: 'Active Permits',
      value: summary.activePermits,
      icon: FileCheck,
      status: summary.activePermits > 0 ? 'good' : 'warning',
    },
    {
      label: 'Violations',
      value: summary.totalViolations,
      icon: AlertTriangle,
      status: summary.totalViolations === 0 ? 'good' : summary.significantViolations > 0 ? 'critical' : 'warning',
    },
    {
      label: 'SNC Facilities',
      value: summary.significantViolations,
      icon: Shield,
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
      label: 'DMR Exceedance Rate',
      value: `${summary.dmrExceedanceRate}%`,
      icon: ClipboardCheck,
      status: summary.dmrExceedanceRate <= 5 ? 'good' : summary.dmrExceedanceRate <= 15 ? 'warning' : 'critical',
    },
  ];

  // ── Sorted lists ────────────────────────────────────────────────────────
  const recentViolations = [...violations]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, compactMode ? 5 : 10);

  const recentEnforcement = [...enforcement]
    .sort((a, b) => (b.settlementDate || '').localeCompare(a.settlementDate || ''))
    .slice(0, compactMode ? 5 : 10);

  const dmrExceedances = dmr
    .filter(d => d.exceedance)
    .sort((a, b) => (b.period || '').localeCompare(a.period || ''))
    .slice(0, compactMode ? 5 : 10);

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
          <div className="space-y-2 mt-3">
            {recentViolations.map((v, i) => (
              <StatusCard
                key={`${v.permit}-${v.code}-${v.date}-${i}`}
                title={`${v.permit} — ${v.code}`}
                description={`${v.desc || 'Violation recorded'}${v.date ? ` (${formatDate(v.date)})` : ''}${v.rnc ? ' — Significant Noncompliance' : ''}`}
                status={violationSeverity(v)}
              />
            ))}
          </div>
        </DashboardSection>
      )}

      {/* Enforcement Actions */}
      {recentEnforcement.length > 0 && (
        <DashboardSection
          title="Enforcement Actions"
          subtitle={`${enforcement.length} actions, ${formatCurrency(summary.totalPenalties)} in penalties`}
          accent="amber"
          icon={<Gavel className="w-4 h-4" />}
          defaultExpanded={!compactMode}
        >
          <div className="space-y-2 mt-3">
            {recentEnforcement.map((e, i) => (
              <div
                key={`${e.caseNumber}-${i}`}
                className="bg-amber-50 border border-amber-200 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-amber-800">{e.actionType || 'Enforcement Action'}</h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Case: {e.caseNumber} | Permit: {e.permit}
                    </p>
                    {e.settlementDate && (
                      <p className="text-xs text-slate-500 mt-0.5">Settlement: {formatDate(e.settlementDate)}</p>
                    )}
                  </div>
                  {e.penaltyAssessed > 0 && (
                    <span className="text-sm font-bold text-red-700 whitespace-nowrap">
                      {formatCurrency(e.penaltyAssessed)}
                    </span>
                  )}
                </div>
              </div>
            ))}
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
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">Permit</th>
                  <th className="pb-2 font-semibold">Parameter</th>
                  <th className="pb-2 font-semibold text-right">Actual</th>
                  <th className="pb-2 font-semibold text-right">Limit</th>
                  <th className="pb-2 font-semibold">Unit</th>
                  <th className="pb-2 font-semibold">Period</th>
                </tr>
              </thead>
              <tbody>
                {dmrExceedances.map((d, i) => (
                  <tr key={`${d.permit}-${d.paramDesc}-${d.period}-${i}`} className="border-b border-slate-50">
                    <td className="py-2 font-mono text-slate-700">{d.permit}</td>
                    <td className="py-2 text-slate-700">{d.paramDesc}</td>
                    <td className="py-2 text-right font-semibold text-red-700">
                      {d.dmrValue !== null ? d.dmrValue.toFixed(2) : '—'}
                    </td>
                    <td className="py-2 text-right text-slate-500">
                      {d.limitValue !== null ? d.limitValue.toFixed(2) : '—'}
                    </td>
                    <td className="py-2 text-slate-500">{d.unit}</td>
                    <td className="py-2 text-slate-500">{formatDate(d.period)}</td>
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
