'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import HeroBanner from '@/components/HeroBanner';
import { KPIStrip, KPICard } from '@/components/KPIStrip';
import { DashboardSection } from '@/components/DashboardSection';
import { StatusCard } from '@/components/StatusCard';
import {
  Droplets,
  Shield,
  AlertTriangle,
  Users,
  Gauge,
  FlaskConical,
  Activity,
  FileText,
  Wrench,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
  Beaker,
} from 'lucide-react';

// ─── Mock data (replace with real API calls) ─────────────────────────────
const MOCK_SYSTEM = {
  name: 'Central Water Treatment Facility',
  pwsId: 'MD0300010',
  population: 156420,
  source: 'Surface Water',
  treatmentCapacity: 42.5,
};

const MOCK_CONTAMINANTS = [
  { name: 'Lead', value: 3.2, unit: 'ppb', mcl: 15, status: 'good' as const },
  { name: 'Copper', value: 0.82, unit: 'ppm', mcl: 1.3, status: 'good' as const },
  { name: 'PFOA', value: 2.8, unit: 'ppt', mcl: 4.0, status: 'warning' as const },
  { name: 'PFOS', value: 3.1, unit: 'ppt', mcl: 4.0, status: 'warning' as const },
  { name: 'THMs', value: 62, unit: 'ppb', mcl: 80, status: 'warning' as const },
  { name: 'HAA5', value: 41, unit: 'ppb', mcl: 60, status: 'good' as const },
  { name: 'Chlorine Residual', value: 1.8, unit: 'mg/L', mcl: 4.0, status: 'good' as const },
  { name: 'Turbidity', value: 0.12, unit: 'NTU', mcl: 1.0, status: 'good' as const },
];

const MOCK_VIOLATIONS = [
  { id: 'V-2025-001', type: 'MCL', contaminant: 'Total Coliform', date: '2025-08-15', status: 'Resolved', severity: 'Minor' },
  { id: 'V-2025-002', type: 'Monitoring', contaminant: 'Lead & Copper', date: '2025-06-22', status: 'Open', severity: 'Significant' },
  { id: 'V-2024-008', type: 'Treatment', contaminant: 'Turbidity', date: '2024-12-01', status: 'Resolved', severity: 'Minor' },
  { id: 'V-2024-005', type: 'MCL', contaminant: 'HAA5', date: '2024-09-10', status: 'Resolved', severity: 'Minor' },
];

const TREATMENT_STAGES = [
  { name: 'Intake', efficiency: 0, icon: Droplets },
  { name: 'Coagulation', efficiency: 65, icon: FlaskConical },
  { name: 'Sedimentation', efficiency: 82, icon: Activity },
  { name: 'Filtration', efficiency: 95, icon: Gauge },
  { name: 'Disinfection', efficiency: 99.7, icon: Shield },
  { name: 'Distribution', efficiency: 99.5, icon: Wrench },
];

const CAPITAL_PROJECTS = [
  { name: 'PFAS Treatment System', budget: '$12.4M', progress: 35, timeline: '2025-2027', status: 'In Progress' },
  { name: 'Lead Service Line Replacement', budget: '$8.7M', progress: 62, timeline: '2024-2026', status: 'In Progress' },
  { name: 'Backup Generator Installation', budget: '$2.1M', progress: 90, timeline: '2024-2025', status: 'Near Complete' },
  { name: 'SCADA System Upgrade', budget: '$3.5M', progress: 15, timeline: '2025-2028', status: 'Planning' },
];

export default function UtilityPage() {
  const params = useParams();
  const systemId = params.systemId as string;

  const kpiCards: KPICard[] = [
    { label: 'Compliance Rate', value: '94.2', unit: '%', icon: Shield, delta: 1.3, status: 'good' },
    { label: 'Lead (90th %ile)', value: '3.2', unit: 'ppb', icon: Droplets, delta: -8.5, status: 'good' },
    { label: 'PFAS Total', value: '5.9', unit: 'ppt', icon: FlaskConical, delta: 12, status: 'warning' },
    { label: 'Treatment Capacity', value: '42.5', unit: 'MGD', icon: Gauge, status: 'good' },
    { label: 'Violations YTD', value: '2', icon: AlertTriangle, delta: -50, status: 'warning' },
    { label: 'Population Served', value: '156K', icon: Users, status: 'good' },
  ];

  return (
    <div className="min-h-full">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <HeroBanner role="utility" />
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
        {/* System Identity */}
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-white">{MOCK_SYSTEM.name}</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
            PWS: {MOCK_SYSTEM.pwsId}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/10">
            {MOCK_SYSTEM.source}
          </span>
        </div>

        {/* KPI Strip */}
        <KPIStrip cards={kpiCards} />

        {/* Compliance Overview */}
        <DashboardSection title="Compliance Overview" subtitle="SDWA and CWA compliance status">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatusCard title="SDWA Compliance" description="Safe Drinking Water Act — all MCLs within limits except monitoring violation" status="warning" />
            <StatusCard title="Lead & Copper Rule" description="90th percentile below action level. 62% of lead service lines replaced." status="good" />
            <StatusCard title="Disinfection Byproducts" description="THMs at 77.5% of MCL, trending upward. HAA5 within limits." status="warning" />
            <StatusCard title="Source Water Protection" description="Source water assessment current. No new contamination threats identified." status="good" />
          </div>
        </DashboardSection>

        {/* Contaminant Tracker */}
        <DashboardSection title="Contaminant Tracker" subtitle="Live readings across regulated parameters">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MOCK_CONTAMINANTS.map((c) => (
              <div key={c.name} className={`rounded-xl border p-4 ${
                c.status === 'good' ? 'bg-green-500/5 border-green-500/20' :
                c.status === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
                'bg-red-500/5 border-red-500/20'
              }`}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1">{c.name}</div>
                <div className="text-xl font-bold text-white">
                  {c.value} <span className="text-xs font-normal text-white/40">{c.unit}</span>
                </div>
                <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      c.status === 'good' ? 'bg-green-500' : c.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min((c.value / c.mcl) * 100, 100)}%` }}
                  />
                </div>
                <div className="text-[10px] text-white/30 mt-1">MCL: {c.mcl} {c.unit}</div>
              </div>
            ))}
          </div>
        </DashboardSection>

        {/* Treatment Process Monitor */}
        <DashboardSection title="Treatment Process Monitor" subtitle="Stage-by-stage removal efficiency">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {TREATMENT_STAGES.map((stage, i) => {
              const Icon = stage.icon;
              return (
                <React.Fragment key={stage.name}>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center min-w-[120px]">
                    <Icon className="w-6 h-6 text-sky-400 mx-auto mb-2" />
                    <div className="text-xs font-semibold text-white mb-1">{stage.name}</div>
                    {stage.efficiency > 0 && (
                      <>
                        <div className="text-lg font-bold text-white">{stage.efficiency}%</div>
                        <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-sky-500 rounded-full" style={{ width: `${stage.efficiency}%` }} />
                        </div>
                      </>
                    )}
                    {stage.efficiency === 0 && <div className="text-sm text-white/40">Source</div>}
                  </div>
                  {i < TREATMENT_STAGES.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-white/20 flex-shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </DashboardSection>

        {/* SDWA Violations */}
        <DashboardSection title="SDWA Violations" subtitle="Recent and historical violation records">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Violation ID</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Type</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Contaminant</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Date</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Severity</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_VIOLATIONS.map((v) => (
                  <tr key={v.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2 px-3 text-white/70 font-mono text-xs">{v.id}</td>
                    <td className="py-2 px-3 text-white/70">{v.type}</td>
                    <td className="py-2 px-3 text-white">{v.contaminant}</td>
                    <td className="py-2 px-3 text-white/50">{v.date}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        v.severity === 'Minor' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {v.severity}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`flex items-center gap-1 text-xs ${
                        v.status === 'Resolved' ? 'text-green-400' : 'text-amber-400'
                      }`}>
                        {v.status === 'Resolved' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>

        {/* Capital Planning */}
        <DashboardSection title="Capital Planning" subtitle="Infrastructure investment and renewal projects">
          <div className="space-y-3">
            {CAPITAL_PROJECTS.map((p) => (
              <div key={p.name} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{p.name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-white/40">{p.budget}</span>
                      <span className="text-xs text-white/30">{p.timeline}</span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.status === 'Near Complete' ? 'bg-green-500/10 text-green-400' :
                    p.status === 'In Progress' ? 'bg-sky-500/10 text-sky-400' :
                    'bg-white/5 text-white/40'
                  }`}>
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full transition-all"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-white/60 w-10 text-right">{p.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </DashboardSection>

        {/* Consumer Confidence Report */}
        <DashboardSection title="Consumer Confidence Report" subtitle="Annual water quality report data summary">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <FileText className="w-10 h-10 text-sky-400 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-white mb-1">2025 CCR Report</h4>
            <p className="text-xs text-white/50 mb-4 max-w-md mx-auto">
              Generate a Consumer Confidence Report with all regulated contaminant data, source water assessment, and compliance history.
            </p>
            <button className="px-4 py-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 text-sm font-medium hover:bg-sky-500/30 transition-colors">
              Generate CCR Report
            </button>
          </div>
        </DashboardSection>
      </div>
    </div>
  );
}
