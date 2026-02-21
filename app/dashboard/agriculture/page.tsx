'use client';

import React from 'react';
import HeroBanner from '@/components/HeroBanner';
import { KPIStrip, KPICard } from '@/components/KPIStrip';
import { DashboardSection } from '@/components/DashboardSection';
import { StatusCard } from '@/components/StatusCard';
import {
  Sprout,
  Droplets,
  CloudRain,
  Coins,
  Leaf,
  BarChart3,
  TrendingDown,
  Gauge,
  TreePine,
  ArrowRightLeft,
  Sun,
  Thermometer,
} from 'lucide-react';

const NUTRIENT_DATA = [
  { nutrient: 'Total Nitrogen', load: 12450, unit: 'lbs/yr', tmdl: 18000, pct: 69, trend: -5.2 },
  { nutrient: 'Total Phosphorus', load: 2380, unit: 'lbs/yr', tmdl: 3500, pct: 68, trend: -3.1 },
  { nutrient: 'Sediment (TSS)', load: 48200, unit: 'lbs/yr', tmdl: 75000, pct: 64, trend: -8.4 },
];

const BMP_INVENTORY = [
  { practice: 'Cover Crops', acres: 2400, effectiveness: 45, status: 'Active', credits: 12.5 },
  { practice: 'Riparian Buffers', acres: 180, effectiveness: 72, status: 'Active', credits: 8.2 },
  { practice: 'No-Till Farming', acres: 3100, effectiveness: 38, status: 'Active', credits: 15.8 },
  { practice: 'Grassed Waterways', acres: 95, effectiveness: 55, status: 'Active', credits: 4.1 },
  { practice: 'Nutrient Management Plan', acres: 5200, effectiveness: 30, status: 'Active', credits: 22.0 },
  { practice: 'Constructed Wetlands', acres: 45, effectiveness: 85, status: 'Planning', credits: 0 },
];

const CREDIT_TRADES = [
  { type: 'Nitrogen', credits: 5.2, price: '$8.50/lb', buyer: 'MD Bay Restoration Fund', date: '2025-01' },
  { type: 'Phosphorus', credits: 2.1, price: '$24.00/lb', buyer: 'Anne Arundel County MS4', date: '2025-02' },
  { type: 'Sediment', credits: 8.5, price: '$0.12/lb', buyer: 'SHA Mitigation Program', date: '2024-12' },
];

const SOIL_HEALTH = [
  { metric: 'Organic Matter', value: '3.8%', status: 'good' as const, target: '>4.0%' },
  { metric: 'pH', value: '6.4', status: 'good' as const, target: '6.0-7.0' },
  { metric: 'Soil Compaction', value: 'Low', status: 'good' as const, target: 'Low' },
  { metric: 'Erosion Risk', value: 'Moderate', status: 'warning' as const, target: 'Low' },
  { metric: 'Water Infiltration', value: '1.2 in/hr', status: 'warning' as const, target: '>1.5 in/hr' },
  { metric: 'Earthworm Count', value: '12/ft³', status: 'good' as const, target: '>10/ft³' },
];

export default function AgriculturePage() {
  const kpiCards: KPICard[] = [
    { label: 'Nutrient Load', value: '12.4K', unit: 'lbs/yr', icon: Sprout, delta: -5.2, status: 'good' },
    { label: 'Irrigation Eff.', value: '82', unit: '%', icon: Droplets, delta: 4, status: 'good' },
    { label: 'Runoff Volume', value: '1.8', unit: 'MGD', icon: CloudRain, delta: -12, status: 'good' },
    { label: 'Credit Balance', value: '62.6', unit: 'credits', icon: Coins, delta: 18, status: 'good' },
    { label: 'BMP Coverage', value: '78', unit: '%', icon: Leaf, delta: 6, status: 'good' },
    { label: 'Soil Health', value: '7.2', unit: '/10', icon: TreePine, delta: 3, status: 'good' },
  ];

  return (
    <div className="min-h-full">
      <HeroBanner role="agriculture" />

      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
        <KPIStrip cards={kpiCards} />

        {/* Nutrient Management */}
        <DashboardSection title="Nutrient Management" subtitle="Loading vs. TMDL allocation targets">
          <div className="space-y-4">
            {NUTRIENT_DATA.map((n) => (
              <div key={n.nutrient} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-white">{n.nutrient}</h4>
                  <span className={`flex items-center gap-1 text-xs ${n.trend < 0 ? 'text-green-400' : 'text-red-400'}`}>
                    <TrendingDown className="w-3 h-3" />
                    {Math.abs(n.trend)}% YoY
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-white/40 mb-1">
                      <span>{n.load.toLocaleString()} {n.unit}</span>
                      <span>TMDL: {n.tmdl.toLocaleString()}</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${n.pct > 85 ? 'bg-red-500' : n.pct > 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${n.pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-lg font-bold text-white w-14 text-right">{n.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </DashboardSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Irrigation Efficiency */}
          <DashboardSection title="Irrigation Efficiency" subtitle="Water usage and conservation metrics">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <Droplets className="w-6 h-6 text-sky-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">82%</div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Application Eff.</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <Gauge className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">1.8</div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Acre-Ft / Acre</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <Sun className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">3.2</div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">ET Rate (mm/day)</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <Thermometer className="w-6 h-6 text-red-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">0.42</div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Soil Moisture</div>
              </div>
            </div>
          </DashboardSection>

          {/* Credit Trading */}
          <DashboardSection title="Nutrient Credit Trading" subtitle="Recent transactions and marketplace activity">
            <div className="space-y-2">
              {CREDIT_TRADES.map((t, i) => (
                <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ArrowRightLeft className="w-4 h-4 text-lime-400" />
                    <div>
                      <div className="text-sm text-white">{t.type} — {t.credits} credits</div>
                      <div className="text-[10px] text-white/30">{t.buyer}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-lime-400">{t.price}</div>
                    <div className="text-[10px] text-white/30">{t.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </DashboardSection>
        </div>

        {/* BMP Inventory */}
        <DashboardSection title="BMP Inventory" subtitle="Conservation practices with effectiveness metrics">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Practice</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Acres</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Effectiveness</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Credits</th>
                  <th className="text-left py-2 px-3 text-white/40 font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {BMP_INVENTORY.map((b) => (
                  <tr key={b.practice} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-2.5 px-3 text-white font-medium">{b.practice}</td>
                    <td className="py-2.5 px-3 text-white/70">{b.acres.toLocaleString()}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${
                            b.effectiveness > 60 ? 'bg-green-500' : b.effectiveness > 40 ? 'bg-amber-500' : 'bg-white/30'
                          }`} style={{ width: `${b.effectiveness}%` }} />
                        </div>
                        <span className="text-xs text-white/50">{b.effectiveness}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-lime-400 font-medium">{b.credits > 0 ? b.credits : '—'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        b.status === 'Active' ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/40'
                      }`}>{b.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>

        {/* Soil & Water Conservation */}
        <DashboardSection title="Soil & Water Conservation" subtitle="Regional soil health and erosion metrics">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {SOIL_HEALTH.map((s) => (
              <div key={s.metric} className={`rounded-xl border p-4 text-center ${
                s.status === 'good' ? 'bg-green-500/5 border-green-500/20' : 'bg-amber-500/5 border-amber-500/20'
              }`}>
                <div className="text-lg font-bold text-white">{s.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">{s.metric}</div>
                <div className="text-[10px] text-white/25 mt-1">Target: {s.target}</div>
              </div>
            ))}
          </div>
        </DashboardSection>

        {/* Runoff Modeling */}
        <DashboardSection title="Runoff Modeling" subtitle="Storm event impact on agricultural runoff">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <CloudRain className="w-10 h-10 text-lime-400 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-white mb-1">Storm Impact Simulator</h4>
            <p className="text-xs text-white/50 max-w-md mx-auto">
              Model agricultural runoff for 2-yr, 10-yr, and 100-yr storm events. Connect to PEARL storm detection engine.
            </p>
          </div>
        </DashboardSection>
      </div>
    </div>
  );
}
