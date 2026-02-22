'use client';

import React from 'react';
import HeroBanner from '@/components/HeroBanner';
import { KPIStrip, KPICard } from '@/components/KPIStrip';
import { DashboardSection } from '@/components/DashboardSection';
import { StatusCard } from '@/components/StatusCard';
import {
  Building2,
  DollarSign,
  TreePine,
  Droplets,
  Wrench,
  Calendar,
  ArrowRight,
  TrendingUp,
  BarChart3,
  MapPin,
  Clock,
} from 'lucide-react';

const MOCK_PROJECTS = [
  { name: 'Riverwalk Bioretention Basin', type: 'Green Infrastructure', status: 'Active', budget: '$1.2M', progress: 78, completion: '2025-Q3' },
  { name: 'Downtown Permeable Pavement', type: 'Green Infrastructure', status: 'Active', budget: '$890K', progress: 45, completion: '2025-Q4' },
  { name: 'Westside Storm Sewer Rehab', type: 'Gray Infrastructure', status: 'Active', budget: '$4.5M', progress: 92, completion: '2025-Q2' },
  { name: 'Green Roof — City Hall', type: 'Green Infrastructure', status: 'Planning', budget: '$320K', progress: 10, completion: '2026-Q1' },
  { name: 'Outfall 12A Rehabilitation', type: 'Gray Infrastructure', status: 'Active', budget: '$2.1M', progress: 60, completion: '2025-Q4' },
  { name: 'Lakeside Rain Garden Network', type: 'Green Infrastructure', status: 'Complete', budget: '$450K', progress: 100, completion: '2024-Q4' },
];

const CAPACITY_DATA = [
  { storm: '2-Year', capacity: 92, color: 'bg-green-500' },
  { storm: '10-Year', capacity: 74, color: 'bg-amber-500' },
  { storm: '25-Year', capacity: 58, color: 'bg-orange-500' },
  { storm: '100-Year', capacity: 41, color: 'bg-red-500' },
];

const FUNDING_SOURCES = [
  { source: 'EPA Clean Water SRF', amount: '$3.2M', type: 'Federal' },
  { source: 'State Stormwater Fund', amount: '$1.8M', type: 'State' },
  { source: 'Local Capital Budget', amount: '$5.5M', type: 'Local' },
  { source: 'FEMA BRIC Grant', amount: '$2.1M', type: 'Federal' },
  { source: 'Green Bond Issuance', amount: '$4.0M', type: 'Local' },
];

const ASSET_AGES = [
  { range: '0-10 years', count: 145, pct: 22 },
  { range: '10-25 years', count: 280, pct: 43 },
  { range: '25-50 years', count: 165, pct: 25 },
  { range: '50+ years', count: 62, pct: 10 },
];

export default function InfrastructurePage() {
  const kpiCards: KPICard[] = [
    { label: 'Active Projects', value: '14', icon: Building2, delta: 3, status: 'good' },
    { label: 'Total Funding', value: '$16.6M', icon: DollarSign, delta: 22, status: 'good' },
    { label: 'Green Acres', value: '42', icon: TreePine, delta: 15, status: 'good' },
    { label: 'Impervious Cover', value: '38', unit: '%', icon: Droplets, delta: -2, status: 'warning' },
    { label: 'BMP Count', value: '287', icon: Wrench, delta: 8, status: 'good' },
    { label: 'Avg Asset Age', value: '22', unit: 'yrs', icon: Calendar, status: 'warning' },
  ];

  return (
    <div className="min-h-full">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <HeroBanner role="infrastructure" />
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
        <KPIStrip cards={kpiCards} />

        {/* Capital Project Tracker */}
        <DashboardSection title="Capital Project Tracker" subtitle="Active and planned infrastructure projects">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Project</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Type</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Budget</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Progress</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Target</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_PROJECTS.map((p) => (
                  <tr key={p.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 text-white font-medium">{p.name}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        p.type === 'Green Infrastructure' ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'
                      }`}>
                        {p.type === 'Green Infrastructure' ? 'Green' : 'Gray'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-white/70">{p.budget}</td>
                    <td className="py-2.5 px-3 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              p.progress === 100 ? 'bg-green-500' : p.progress > 70 ? 'bg-sky-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-white/50 w-8">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-white/50 text-xs">{p.completion}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        p.status === 'Complete' ? 'bg-green-500/10 text-green-400' :
                        p.status === 'Active' ? 'bg-sky-500/10 text-sky-400' :
                        'bg-white/5 text-white/40'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Capacity Analysis */}
          <DashboardSection title="Stormwater Capacity Analysis" subtitle="System capacity by design storm event">
            <div className="space-y-3">
              {CAPACITY_DATA.map((d) => (
                <div key={d.storm} className="flex items-center gap-4">
                  <span className="text-xs text-white/60 w-20">{d.storm}</span>
                  <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden relative">
                    <div
                      className={`h-full ${d.color} rounded-lg transition-all flex items-center justify-end pr-2`}
                      style={{ width: `${d.capacity}%` }}
                    >
                      <span className="text-[10px] font-bold text-white">{d.capacity}%</span>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-white/30 mt-2">
                Capacity percentage = design capacity vs. actual runoff volume for each storm recurrence interval.
              </p>
            </div>
          </DashboardSection>

          {/* Funding Pipeline */}
          <DashboardSection title="Funding Pipeline" subtitle="Federal, state, and local funding sources">
            <div className="space-y-2">
              {FUNDING_SOURCES.map((f) => (
                <div key={f.source} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${
                      f.type === 'Federal' ? 'bg-blue-400' : f.type === 'State' ? 'bg-cyan-400' : 'bg-emerald-400'
                    }`} />
                    <div>
                      <div className="text-sm text-white">{f.source}</div>
                      <div className="text-[10px] text-white/30">{f.type}</div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-white">{f.amount}</span>
                </div>
              ))}
            </div>
          </DashboardSection>
        </div>

        {/* Asset Lifecycle */}
        <DashboardSection title="Asset Lifecycle" subtitle="Infrastructure age distribution and replacement scheduling">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ASSET_AGES.map((a) => (
              <div key={a.range} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">{a.count}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">{a.range}</div>
                <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-400 rounded-full" style={{ width: `${a.pct}%` }} />
                </div>
                <div className="text-[10px] text-white/30 mt-1">{a.pct}% of total</div>
              </div>
            ))}
          </div>
        </DashboardSection>

        {/* Green Infrastructure Map Placeholder */}
        <DashboardSection title="Green Infrastructure Map" subtitle="Rain gardens, bioswales, permeable pavement, and green roofs">
          <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
            <MapPin className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-white mb-1">Interactive Map</h4>
            <p className="text-xs text-white/50 max-w-md mx-auto">
              Leaflet map with filterable layers for green infrastructure assets. Connect to BMP inventory data.
            </p>
          </div>
        </DashboardSection>
      </div>
    </div>
  );
}
