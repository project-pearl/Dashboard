'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CloudRain,
  Droplets,
  Building2,
  Leaf,
  Shield,
  BarChart3,
} from 'lucide-react';

// ── Props ───────────────────────────────────────────────────────────────────

interface CampusStormwaterPanelProps {
  stateAbbr: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

interface PermitInfo {
  permitId: string;
  type: string;
  status: 'Active' | 'Pending Renewal' | 'Expired';
  issued: string;
  expires: string;
}

interface GreenInfraItem {
  name: string;
  type: string;
  areaSqFt: number;
  installedYear: number;
  condition: 'Good' | 'Fair' | 'Needs Maintenance';
}

interface MonitoringResult {
  parameter: string;
  value: number;
  unit: string;
  limit: number;
  status: 'In Compliance' | 'Approaching Limit' | 'Exceedance';
}

interface BmpRecord {
  name: string;
  type: string;
  reductionPct: number;
  lastInspection: string;
  status: 'Effective' | 'Moderate' | 'Under Review';
}

function getPermitData(stateAbbr: string): PermitInfo[] {
  return [
    { permitId: `${stateAbbr}S000421`, type: 'MS4 Phase II', status: 'Active', issued: '2023-03-15', expires: '2028-03-14' },
    { permitId: `${stateAbbr}R10C024`, type: 'Construction General', status: 'Active', issued: '2024-01-10', expires: '2029-01-09' },
    { permitId: `${stateAbbr}G620018`, type: 'Industrial Stormwater', status: 'Pending Renewal', issued: '2019-06-01', expires: '2024-05-31' },
  ];
}

function getGreenInfrastructure(): GreenInfraItem[] {
  return [
    { name: 'Science Quad Rain Garden', type: 'Rain Garden', areaSqFt: 3200, installedYear: 2021, condition: 'Good' },
    { name: 'Engineering Bldg Green Roof', type: 'Green Roof', areaSqFt: 8500, installedYear: 2020, condition: 'Good' },
    { name: 'West Campus Bioswale', type: 'Bioswale', areaSqFt: 1800, installedYear: 2019, condition: 'Fair' },
    { name: 'Library Permeable Pavement', type: 'Permeable Pavement', areaSqFt: 12000, installedYear: 2022, condition: 'Good' },
    { name: 'Athletic Fields Bioretention', type: 'Bioretention Cell', areaSqFt: 4600, installedYear: 2018, condition: 'Needs Maintenance' },
    { name: 'Student Union Cistern', type: 'Rainwater Harvesting', areaSqFt: 600, installedYear: 2023, condition: 'Good' },
  ];
}

function getMonitoringResults(): MonitoringResult[] {
  return [
    { parameter: 'Total Suspended Solids', value: 42, unit: 'mg/L', limit: 100, status: 'In Compliance' },
    { parameter: 'Total Phosphorus', value: 0.18, unit: 'mg/L', limit: 0.20, status: 'Approaching Limit' },
    { parameter: 'Total Nitrogen', value: 1.8, unit: 'mg/L', limit: 5.0, status: 'In Compliance' },
    { parameter: 'Oil & Grease', value: 8.2, unit: 'mg/L', limit: 15.0, status: 'In Compliance' },
    { parameter: 'pH', value: 7.6, unit: 'SU', limit: 9.0, status: 'In Compliance' },
    { parameter: 'E. coli', value: 285, unit: 'MPN/100mL', limit: 235, status: 'Exceedance' },
  ];
}

function getBmpData(): BmpRecord[] {
  return [
    { name: 'Sediment Basin — Lot C', type: 'Sediment Control', reductionPct: 78, lastInspection: '2025-11-15', status: 'Effective' },
    { name: 'Oil/Water Separator — Maintenance Yard', type: 'Treatment', reductionPct: 92, lastInspection: '2025-12-01', status: 'Effective' },
    { name: 'Vegetated Filter Strip — North Field', type: 'Filtration', reductionPct: 64, lastInspection: '2025-10-20', status: 'Moderate' },
    { name: 'Inlet Protection — Construction Zone 3', type: 'Erosion Control', reductionPct: 55, lastInspection: '2025-09-08', status: 'Under Review' },
  ];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function permitStatusColor(status: PermitInfo['status']): string {
  if (status === 'Active') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Pending Renewal') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function conditionColor(condition: GreenInfraItem['condition']): string {
  if (condition === 'Good') return 'bg-emerald-100 text-emerald-700';
  if (condition === 'Fair') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function monitoringStatusColor(status: MonitoringResult['status']): string {
  if (status === 'In Compliance') return 'text-emerald-700';
  if (status === 'Approaching Limit') return 'text-amber-700';
  return 'text-red-700';
}

function bmpStatusColor(status: BmpRecord['status']): string {
  if (status === 'Effective') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Moderate') return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

// ── Component ───────────────────────────────────────────────────────────────

export function CampusStormwaterPanel({ stateAbbr }: CampusStormwaterPanelProps) {
  const permits = useMemo(() => getPermitData(stateAbbr), [stateAbbr]);
  const greenInfra = useMemo(() => getGreenInfrastructure(), []);
  const monitoring = useMemo(() => getMonitoringResults(), []);
  const bmps = useMemo(() => getBmpData(), []);

  const totalGreenArea = useMemo(
    () => greenInfra.reduce((sum, g) => sum + g.areaSqFt, 0),
    [greenInfra]
  );
  const complianceRate = useMemo(
    () => ((monitoring.filter((m) => m.status === 'In Compliance').length / monitoring.length) * 100).toFixed(0),
    [monitoring]
  );

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <CloudRain className="w-3.5 h-3.5" />
        <span>Campus Stormwater Management — {stateAbbr}</span>
      </div>

      {/* ── Section 1: Hero Stats ──────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                <CloudRain size={28} className="text-blue-600" />
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-emerald-700">{complianceRate}%</span>
                  <span className="text-sm text-slate-500">parameter compliance</span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">
                  {monitoring.filter((m) => m.status === 'In Compliance').length} of {monitoring.length} monitored parameters within limits
                </p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-lg font-bold text-slate-800">{permits.length}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Active Permits</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-slate-800">{greenInfra.length}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">GI Features</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-blue-700">{totalGreenArea.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Sq Ft GI</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Permit Status ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield size={16} className="text-blue-600" />
            Stormwater Permit Status
          </CardTitle>
          <CardDescription>University stormwater discharge permits and renewal tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {permits.map((p) => (
              <div key={p.permitId} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{p.permitId}</p>
                  <p className="text-xs text-slate-500">{p.type} — Issued {p.issued}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">Exp: {p.expires}</span>
                  <Badge className={`text-[10px] ${permitStatusColor(p.status)}`}>{p.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Green Infrastructure Inventory ──────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Leaf size={16} className="text-emerald-600" />
            Green Infrastructure Inventory
            <Badge variant="secondary" className="ml-1 text-[10px]">{greenInfra.length} features</Badge>
          </CardTitle>
          <CardDescription>Rain gardens, bioswales, green roofs, and other campus GI assets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">Feature</th>
                  <th className="pb-2 font-semibold">Type</th>
                  <th className="pb-2 font-semibold text-right">Area (sq ft)</th>
                  <th className="pb-2 font-semibold text-right">Installed</th>
                  <th className="pb-2 font-semibold text-right">Condition</th>
                </tr>
              </thead>
              <tbody>
                {greenInfra.map((gi) => (
                  <tr key={gi.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 font-semibold text-slate-700">{gi.name}</td>
                    <td className="py-2 text-slate-600">{gi.type}</td>
                    <td className="py-2 text-right text-slate-600">{gi.areaSqFt.toLocaleString()}</td>
                    <td className="py-2 text-right text-slate-600">{gi.installedYear}</td>
                    <td className="py-2 text-right">
                      <Badge className={`text-[10px] ${conditionColor(gi.condition)}`}>{gi.condition}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Stormwater Monitoring Results ───────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Droplets size={16} className="text-cyan-600" />
            Stormwater Monitoring Results
          </CardTitle>
          <CardDescription>Latest outfall sampling results against permit limits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {monitoring.map((m) => {
              const pct = Math.min((m.value / m.limit) * 100, 100);
              const barColor =
                m.status === 'In Compliance' ? 'bg-emerald-500' :
                m.status === 'Approaching Limit' ? 'bg-amber-500' : 'bg-red-500';
              return (
                <div key={m.parameter}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700">{m.parameter}</span>
                    <span className={`text-xs font-semibold ${monitoringStatusColor(m.status)}`}>
                      {m.value} / {m.limit} {m.unit}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 5: BMP Effectiveness Tracking ──────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 size={16} className="text-violet-600" />
            BMP Effectiveness Tracking
          </CardTitle>
          <CardDescription>Best management practice performance and inspection status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {bmps.map((bmp) => (
              <div key={bmp.name} className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{bmp.name}</p>
                    <p className="text-xs text-slate-500">{bmp.type} — Last inspected {bmp.lastInspection}</p>
                  </div>
                  <Badge className={`text-[10px] ${bmpStatusColor(bmp.status)}`}>{bmp.status}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-20">Reduction</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all duration-500"
                      style={{ width: `${bmp.reductionPct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-violet-700 w-10 text-right">{bmp.reductionPct}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 6: TMDL Compliance ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 size={16} className="text-orange-600" />
            TMDL Compliance — Campus Runoff
          </CardTitle>
          <CardDescription>Total Maximum Daily Load allocations affecting campus discharge points</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">2</p>
              <p className="text-xs text-emerald-600 mt-1">TMDLs — In Compliance</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">1</p>
              <p className="text-xs text-amber-600 mt-1">TMDLs — Action Needed</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-2xl font-bold text-slate-700">1</p>
              <p className="text-xs text-slate-500 mt-1">TMDLs — Under Development</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-3">
            Campus outfalls drain to Mill Creek (sediment TMDL), Cedar River (phosphorus TMDL), and unnamed tributary (bacteria TMDL pending).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
