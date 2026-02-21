'use client';

import React, { useState } from 'react';
import HeroBanner from '@/components/HeroBanner';
import { KPIStrip, KPICard } from '@/components/KPIStrip';
import { DashboardSection } from '@/components/DashboardSection';
import { StatusCard } from '@/components/StatusCard';
import {
  FlaskConical,
  Clock,
  Award,
  Timer,
  AlertTriangle,
  Users,
  CheckCircle,
  XCircle,
  ArrowRight,
  FileText,
  Beaker,
  Package,
  ClipboardList,
  Calendar,
  Thermometer,
} from 'lucide-react';

const MOCK_SAMPLES = [
  { id: 'SC-2025-0847', matrix: 'Surface Water', collected: '2025-02-20', analyst: 'J. Chen', status: 'In Progress', method: 'EPA 524.2', holdTime: '14 days' },
  { id: 'SC-2025-0846', matrix: 'Groundwater', collected: '2025-02-19', analyst: 'M. Rivera', status: 'QA Review', method: 'EPA 200.8', holdTime: '180 days' },
  { id: 'SC-2025-0845', matrix: 'Effluent', collected: '2025-02-19', analyst: 'K. Patel', status: 'Complete', method: 'EPA 608.3', holdTime: '7 days' },
  { id: 'SC-2025-0844', matrix: 'Drinking Water', collected: '2025-02-18', analyst: 'J. Chen', status: 'Flagged', method: 'EPA 533', holdTime: '14 days' },
  { id: 'SC-2025-0843', matrix: 'Surface Water', collected: '2025-02-18', analyst: 'T. Washington', status: 'Complete', method: 'SM 9223B', holdTime: '8 hours' },
  { id: 'SC-2025-0842', matrix: 'Soil', collected: '2025-02-17', analyst: 'M. Rivera', status: 'In Progress', method: 'EPA 8270E', holdTime: '14 days' },
  { id: 'SC-2025-0841', matrix: 'Stormwater', collected: '2025-02-17', analyst: 'K. Patel', status: 'Received', method: 'EPA 160.2', holdTime: '7 days' },
];

const QA_QC_METRICS = [
  { method: 'EPA 200.8 (Metals)', blanks: 'Pass', duplicates: '98.2% RPD', spikes: '94.5% Recovery', status: 'good' as const },
  { method: 'EPA 524.2 (VOCs)', blanks: 'Pass', duplicates: '96.8% RPD', spikes: '101.2% Recovery', status: 'good' as const },
  { method: 'EPA 533 (PFAS)', blanks: 'Flag', duplicates: '91.4% RPD', spikes: '88.7% Recovery', status: 'warning' as const },
  { method: 'SM 9223B (Coliform)', blanks: 'Pass', duplicates: '100% Agreement', spikes: 'N/A', status: 'good' as const },
  { method: 'EPA 608.3 (Pesticides)', blanks: 'Pass', duplicates: '95.1% RPD', spikes: '97.3% Recovery', status: 'good' as const },
];

const METHOD_REGISTRY = [
  { method: 'EPA 200.8', analytes: 'Metals (23)', matrix: 'All Waters', mdl: '0.5-5 µg/L', holdTime: '180 days', preservation: 'HNO₃ pH<2' },
  { method: 'EPA 524.2', analytes: 'VOCs (84)', matrix: 'Drinking Water', mdl: '0.1-0.5 µg/L', holdTime: '14 days', preservation: 'HCl, 4°C' },
  { method: 'EPA 533', analytes: 'PFAS (25)', matrix: 'Drinking Water', mdl: '1.0-5.0 ng/L', holdTime: '14 days', preservation: 'Trizma, 4°C' },
  { method: 'SM 9223B', analytes: 'E. coli, Total Coliform', matrix: 'All Waters', mdl: '1 MPN/100mL', holdTime: '8 hours', preservation: 'Na₂S₂O₃, 4°C' },
  { method: 'EPA 608.3', analytes: 'Pesticides (47)', matrix: 'All Waters', mdl: '0.01-0.1 µg/L', holdTime: '7 days', preservation: '4°C' },
];

const COC_TIMELINE = [
  { event: 'Collected', time: '2025-02-20 08:15', by: 'Field Team A', temp: '4.2°C', notes: 'GPS: 38.9807° N, 76.4908° W' },
  { event: 'Transported', time: '2025-02-20 10:30', by: 'PEARL Courier', temp: '4.5°C', notes: 'Cooler ID: C-0142' },
  { event: 'Received', time: '2025-02-20 11:45', by: 'Lab Intake (K. Patel)', temp: '4.1°C', notes: 'Condition: Intact, Preserved' },
  { event: 'Logged', time: '2025-02-20 12:00', by: 'LIMS Auto', temp: '—', notes: 'ID: SC-2025-0847 assigned' },
  { event: 'Analysis Started', time: '2025-02-20 14:30', by: 'J. Chen', temp: '—', notes: 'EPA 524.2 (VOCs)' },
];

const INVENTORY_ALERTS = [
  { item: 'PFAS Solid Phase Extraction Cartridges', qty: 12, reorder: 50, status: 'critical' as const },
  { item: 'ICP-MS Tune Solution', qty: 45, reorder: 20, status: 'good' as const },
  { item: 'Colilert Reagent Packs', qty: 8, reorder: 25, status: 'critical' as const },
  { item: 'VOC Sample Vials (40mL)', qty: 250, reorder: 100, status: 'good' as const },
];

export default function SampleChainPage() {
  const kpiCards: KPICard[] = [
    { label: 'Active Samples', value: '47', icon: FlaskConical, delta: 12, status: 'good' },
    { label: 'Pending QA/QC', value: '8', icon: ClipboardList, delta: -20, status: 'good' },
    { label: 'Methods Certified', value: '23', icon: Award, status: 'good' },
    { label: 'Turnaround', value: '3.2', unit: 'days', icon: Timer, delta: -8, status: 'good' },
    { label: 'Hold Violations', value: '1', icon: AlertTriangle, status: 'warning' },
    { label: 'Analyst Count', value: '6', icon: Users, status: 'good' },
  ];

  const statusColor = (status: string) => {
    switch (status) {
      case 'Complete': return 'bg-green-500/10 text-green-400';
      case 'In Progress': return 'bg-sky-500/10 text-sky-400';
      case 'QA Review': return 'bg-violet-500/10 text-violet-400';
      case 'Received': return 'bg-white/5 text-white/40';
      case 'Flagged': return 'bg-red-500/10 text-red-400';
      default: return 'bg-white/5 text-white/40';
    }
  };

  return (
    <div className="min-h-full">
      <HeroBanner role="samplechain" />

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
        <KPIStrip cards={kpiCards} />

        {/* Sample Intake Queue */}
        <DashboardSection title="Sample Intake Queue" subtitle="Incoming and active sample tracking">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Sample ID</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Matrix</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Collected</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Method</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Analyst</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Hold Time</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_SAMPLES.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 text-teal-400 font-mono text-xs">{s.id}</td>
                    <td className="py-2.5 px-3 text-white/70">{s.matrix}</td>
                    <td className="py-2.5 px-3 text-white/50 text-xs">{s.collected}</td>
                    <td className="py-2.5 px-3 text-white/70 font-mono text-xs">{s.method}</td>
                    <td className="py-2.5 px-3 text-white/70">{s.analyst}</td>
                    <td className="py-2.5 px-3 text-white/50 text-xs">{s.holdTime}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(s.status)}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>

        {/* QA/QC Dashboard */}
        <DashboardSection title="QA/QC Dashboard" subtitle="Method quality control metrics">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Method</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Blanks</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Duplicates</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Spikes</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {QA_QC_METRICS.map((q) => (
                  <tr key={q.method} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 text-white font-medium">{q.method}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs ${q.blanks === 'Pass' ? 'text-green-400' : 'text-amber-400'}`}>{q.blanks}</span>
                    </td>
                    <td className="py-2.5 px-3 text-white/70">{q.duplicates}</td>
                    <td className="py-2.5 px-3 text-white/70">{q.spikes}</td>
                    <td className="py-2.5 px-3">
                      {q.status === 'good'
                        ? <CheckCircle className="w-4 h-4 text-green-400" />
                        : <AlertTriangle className="w-4 h-4 text-amber-400" />
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>

        {/* Method Registry */}
        <DashboardSection title="Method Registry" subtitle="Certified analytical methods and parameters">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Method</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Analytes</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Matrix</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">MDL Range</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Hold Time</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Preservation</th>
                </tr>
              </thead>
              <tbody>
                {METHOD_REGISTRY.map((m) => (
                  <tr key={m.method} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 text-teal-400 font-mono text-xs">{m.method}</td>
                    <td className="py-2.5 px-3 text-white">{m.analytes}</td>
                    <td className="py-2.5 px-3 text-white/70">{m.matrix}</td>
                    <td className="py-2.5 px-3 text-white/50 font-mono text-xs">{m.mdl}</td>
                    <td className="py-2.5 px-3 text-white/50">{m.holdTime}</td>
                    <td className="py-2.5 px-3 text-white/50 text-xs">{m.preservation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>

        {/* Chain of Custody */}
        <DashboardSection title="Chain of Custody" subtitle="Sample SC-2025-0847 custody timeline">
          <div className="relative pl-6">
            {COC_TIMELINE.map((step, i) => (
              <div key={i} className="relative pb-6 last:pb-0">
                {/* Vertical line */}
                {i < COC_TIMELINE.length - 1 && (
                  <div className="absolute left-[-17px] top-6 bottom-0 w-px bg-teal-500/30" />
                )}
                {/* Dot */}
                <div className="absolute left-[-21px] top-1 w-2 h-2 rounded-full bg-teal-400 ring-2 ring-teal-400/20" />
                <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-white">{step.event}</span>
                    <span className="text-[10px] text-white/30 font-mono">{step.time}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/50">
                    <span>{step.by}</span>
                    {step.temp !== '—' && (
                      <span className="flex items-center gap-1">
                        <Thermometer className="w-3 h-3" /> {step.temp}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-white/30 mt-1">{step.notes}</div>
                </div>
              </div>
            ))}
          </div>
        </DashboardSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inventory Management */}
          <DashboardSection title="Inventory Management" subtitle="Reagent and supply tracking">
            <div className="space-y-2">
              {INVENTORY_ALERTS.map((item) => (
                <div key={item.item} className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                  item.status === 'critical' ? 'bg-red-500/5 border border-red-500/20' : 'bg-white/5 border border-white/10'
                }`}>
                  <div>
                    <div className="text-sm text-white">{item.item}</div>
                    <div className="text-[10px] text-white/30">Reorder at: {item.reorder}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${item.qty < item.reorder ? 'text-red-400' : 'text-white'}`}>
                      {item.qty}
                    </div>
                    <div className="text-[10px] text-white/30">in stock</div>
                  </div>
                </div>
              ))}
            </div>
          </DashboardSection>

          {/* Reporting Engine */}
          <DashboardSection title="Reporting Engine" subtitle="Generate lab reports and export data">
            <div className="space-y-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
                <FileText className="w-8 h-8 text-teal-400 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-white mb-1">Lab Report Generator</h4>
                <p className="text-xs text-white/50 mb-4 max-w-sm mx-auto">
                  Generate branded lab reports per sample or batch with QA/QC data, chain of custody, and certifications.
                </p>
                <div className="flex justify-center gap-3">
                  <button className="px-4 py-2 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30 text-sm font-medium hover:bg-teal-500/30 transition-colors">
                    Single Sample
                  </button>
                  <button className="px-4 py-2 rounded-lg bg-white/5 text-white/60 border border-white/10 text-sm font-medium hover:bg-white/10 transition-colors">
                    Batch Report
                  </button>
                </div>
              </div>
            </div>
          </DashboardSection>
        </div>
      </div>
    </div>
  );
}
