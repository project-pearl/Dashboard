'use client';

import React, { useState } from 'react';
import { Droplets, AlertTriangle, Users, Gavel, Shield, Beaker } from 'lucide-react';
import { KPIStrip, type KPICard } from '@/components/KPIStrip';
import { DashboardSection } from '@/components/DashboardSection';
import { StatusCard } from '@/components/StatusCard';
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

  // ── Filtered & sorted violations ───────────────────────────────────────
  let filteredViolations = [...violations];
  if (filterMajor) filteredViolations = filteredViolations.filter(v => v.isMajor);
  if (filterHealthBased) filteredViolations = filteredViolations.filter(v => v.isHealthBased);
  const sortedViolations = filteredViolations
    .sort((a, b) => (b.compliancePeriod || '').localeCompare(a.compliancePeriod || ''))
    .slice(0, compactMode ? 5 : 15);

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
          subtitle={`${violations.length} total violations found`}
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
                onChange={e => setFilterMajor(e.target.checked)}
                className="rounded border-slate-300"
              />
              Major only
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={filterHealthBased}
                onChange={e => setFilterHealthBased(e.target.checked)}
                className="rounded border-slate-300"
              />
              Health-based only
            </label>
          </div>

          <div className="space-y-2">
            {sortedViolations.map((v, i) => (
              <StatusCard
                key={`${v.pwsid}-${v.code}-${v.compliancePeriod}-${i}`}
                title={`${v.pwsid} — ${v.contaminant || v.code}`}
                description={`${v.rule || 'Violation recorded'}${v.compliancePeriod ? ` (${formatDate(v.compliancePeriod)})` : ''}${v.isMajor ? ' — Major' : ''}${v.isHealthBased ? ' — Health-Based' : ''}`}
                status={v.isMajor || v.isHealthBased ? 'critical' : 'warning'}
              />
            ))}
          </div>
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
