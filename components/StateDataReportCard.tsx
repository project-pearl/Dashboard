'use client';

import React, { useState } from 'react';
import type { StateDataReport } from '@/lib/stateReportCache';
import { ChevronDown, Minus, Database, Activity, Cpu, BarChart3 } from 'lucide-react';

// ── Grade Colors ────────────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'B': return 'text-green-700 bg-green-50 border-green-200';
    case 'C': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    case 'D': return 'text-orange-700 bg-orange-50 border-orange-200';
    case 'F': return 'text-red-700 bg-red-50 border-red-200';
    default: return 'text-slate-600 bg-slate-50 border-slate-200';
  }
}

function gradeBg(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-emerald-600';
    case 'B': return 'bg-green-600';
    case 'C': return 'bg-yellow-500';
    case 'D': return 'bg-orange-500';
    case 'F': return 'bg-red-500';
    default: return 'bg-slate-400';
  }
}

// ── Freshness Tier Colors ───────────────────────────────────────────────────

const TIER_COLORS = [
  'bg-emerald-500',  // <24h
  'bg-green-500',    // <7d
  'bg-lime-500',     // <30d
  'bg-yellow-500',   // <90d
  'bg-orange-500',   // <1yr
  'bg-red-500',      // >1yr
];

const TIER_TEXT_COLORS = [
  'text-emerald-700',
  'text-green-700',
  'text-lime-700',
  'text-yellow-700',
  'text-orange-700',
  'text-red-700',
];

// ── Freshness Badge ─────────────────────────────────────────────────────────

function FreshnessBadge({ freshness }: { freshness: string }) {
  const cls: Record<string, string> = {
    live: 'bg-emerald-100 text-emerald-700',
    recent: 'bg-green-100 text-green-700',
    aging: 'bg-yellow-100 text-yellow-700',
    stale: 'bg-orange-100 text-orange-700',
    archival: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls[freshness] || cls.archival}`}>
      {freshness}
    </span>
  );
}

// ── Sub-section Toggle ──────────────────────────────────────────────────────

function SubSection({ title, icon, defaultOpen, children }: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold text-slate-700">{title}</span>
        </div>
        {open ? <Minus className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
      </button>
      {open && <div className="px-3 pb-3 pt-2">{children}</div>}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function StateDataReportCard({ report }: { report: StateDataReport }) {
  return (
    <div className="space-y-3">

      {/* ── A. Coverage KPIs ──────────────────────────────────────────── */}
      <SubSection title="Coverage" icon={<Database size={13} className="text-blue-600" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5 text-center">
            <div className="text-xl font-black text-blue-700">{report.totalWaterbodies.toLocaleString()}</div>
            <div className="text-[10px] text-blue-500 font-medium">Total Waterbodies</div>
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2.5 text-center">
            <div className="text-xl font-black text-emerald-700">{report.monitoredWaterbodies.toLocaleString()}</div>
            <div className="text-[10px] text-emerald-500 font-medium">Monitored</div>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-100 p-2.5 text-center">
            <div className="text-xl font-black text-red-700">{report.unmonitoredWaterbodies.toLocaleString()}</div>
            <div className="text-[10px] text-red-500 font-medium">Unmonitored (Blind Spots)</div>
          </div>
          <div className={`rounded-lg border p-2.5 text-center ${gradeColor(report.coverageGrade)}`}>
            <div className="text-2xl font-black">{report.coverageGrade}</div>
            <div className="text-[10px] font-medium">{report.monitoredPct}% Coverage</div>
          </div>
        </div>

        {/* ATTAINS summary row */}
        {(report.impairedCount > 0 || report.healthyCount > 0) && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded bg-red-50/70 border border-red-100 p-2 text-center">
              <div className="text-sm font-bold text-red-700">{report.impairedCount.toLocaleString()}</div>
              <div className="text-[10px] text-red-500">Impaired</div>
            </div>
            <div className="rounded bg-green-50/70 border border-green-100 p-2 text-center">
              <div className="text-sm font-bold text-green-700">{report.healthyCount.toLocaleString()}</div>
              <div className="text-[10px] text-green-500">Healthy</div>
            </div>
            <div className="rounded bg-amber-50/70 border border-amber-100 p-2 text-center">
              <div className="text-sm font-bold text-amber-700">{report.tmdlNeeded.toLocaleString()}</div>
              <div className="text-[10px] text-amber-500">TMDL Needed</div>
            </div>
          </div>
        )}

        {report.topCauses.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="text-[10px] text-slate-400 mr-1 self-center">Top causes:</span>
            {report.topCauses.map(c => (
              <span key={c} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">{c}</span>
            ))}
          </div>
        )}

        {/* Source breakdown */}
        {report.sourceBreakdown.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="text-[10px] text-slate-400 mr-1 self-center">{report.activeSourceCount} sources:</span>
            {report.sourceBreakdown.slice(0, 6).map(s => (
              <span key={s.source} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded text-[10px]">
                {s.source} ({s.waterbodyCount})
              </span>
            ))}
          </div>
        )}
      </SubSection>

      {/* ── B. Data Freshness ─────────────────────────────────────────── */}
      <SubSection title="Data Freshness" icon={<Activity size={13} className="text-green-600" />}>
        {report.wqpRecordCount === 0 ? (
          <div className="text-xs text-slate-400 text-center py-4">No WQP records cached for this state</div>
        ) : (
          <>
            {/* Stacked bar */}
            <div className="h-4 rounded-full overflow-hidden flex bg-slate-200">
              {report.freshnessTiers.map((tier, i) => (
                tier.pct > 0 && (
                  <div
                    key={tier.label}
                    className={`${TIER_COLORS[i]} transition-all`}
                    style={{ width: `${Math.max(tier.pct, 1)}%` }}
                    title={`${tier.label}: ${tier.count.toLocaleString()} (${tier.pct}%)`}
                  />
                )
              ))}
            </div>

            {/* Tier cards */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 mt-2">
              {report.freshnessTiers.map((tier, i) => (
                <div key={tier.label} className="rounded bg-white border border-slate-100 p-1.5 text-center">
                  <div className={`text-sm font-bold ${TIER_TEXT_COLORS[i]}`}>{tier.count.toLocaleString()}</div>
                  <div className="text-[9px] text-slate-400">{tier.label} ({tier.pct}%)</div>
                </div>
              ))}
            </div>

            {/* Summary row */}
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
              <span>{report.wqpRecordCount.toLocaleString()} records from {report.wqpStationCount.toLocaleString()} stations</span>
              <span>Median age: <strong className="text-slate-700">{report.medianAgeDays}d</strong></span>
              <span className={`px-1.5 py-0.5 rounded font-semibold border ${gradeColor(report.freshnessGrade)}`}>
                {report.freshnessGrade}
              </span>
            </div>
          </>
        )}
      </SubSection>

      {/* ── C. Parameter Coverage ──────────────────────────────────────── */}
      <SubSection title={`Parameter Coverage (${report.parameterCount})`} icon={<BarChart3 size={13} className="text-purple-600" />} defaultOpen={false}>
        {report.parameterCoverage.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-4">No parameter data available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] text-slate-400 uppercase">
                  <th className="py-1 pr-2">Parameter</th>
                  <th className="py-1 pr-2 text-right">Stations</th>
                  <th className="py-1 pr-2 text-right">Records</th>
                  <th className="py-1 pr-2">Latest</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.parameterCoverage.map(p => (
                  <tr key={p.key} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-1 pr-2 font-medium text-slate-700">{p.key}</td>
                    <td className="py-1 pr-2 text-right text-slate-500">{p.stationCount.toLocaleString()}</td>
                    <td className="py-1 pr-2 text-right text-slate-500">{p.recordCount.toLocaleString()}</td>
                    <td className="py-1 pr-2 text-slate-400">{p.latestDate || '—'}</td>
                    <td className="py-1"><FreshnessBadge freshness={p.freshness} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-1 text-right">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${gradeColor(report.parameterGrade)}`}>
                Parameter Grade: {report.parameterGrade}
              </span>
            </div>
          </div>
        )}
      </SubSection>

      {/* ── D. AI Readiness ────────────────────────────────────────────── */}
      <SubSection title="AI Readiness" icon={<Cpu size={13} className="text-cyan-600" />}>
        <div className="flex items-center gap-4">
          {/* Score circle */}
          <div className={`flex-shrink-0 w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center ${gradeColor(report.aiReadinessGrade)}`}>
            <div className="text-2xl font-black leading-none">{report.aiReadinessScore}</div>
            <div className="text-[10px] font-bold">{report.aiReadinessGrade}</div>
          </div>

          {/* Factor bars */}
          <div className="flex-1 space-y-2">
            {([
              { label: 'Freshness', value: report.aiReadinessFactors.freshness, max: 30 },
              { label: 'Coverage', value: report.aiReadinessFactors.coverage, max: 25 },
              { label: 'Parameters', value: report.aiReadinessFactors.parameterBreadth, max: 25 },
              { label: 'Redundancy', value: report.aiReadinessFactors.sourceRedundancy, max: 20 },
            ] as const).map(f => (
              <div key={f.label} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-20 text-right">{f.label}</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${gradeBg(letterGradeFromFactor(f.value, f.max))}`}
                    style={{ width: `${(f.value / f.max) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 w-8">{f.value}/{f.max}</span>
              </div>
            ))}
          </div>
        </div>
      </SubSection>
    </div>
  );
}

function letterGradeFromFactor(value: number, max: number): string {
  const pct = (value / max) * 100;
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}
