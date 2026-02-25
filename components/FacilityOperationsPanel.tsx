'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Factory, Droplets, FileCheck, TrendingUp, Recycle, BarChart3 } from 'lucide-react';

// -- Props -------------------------------------------------------------------

interface FacilityOperationsPanelProps {
  stateAbbr: string;
}

// -- Mock facility operations data -------------------------------------------

interface FacilityBalance {
  name: string;
  intakeMGD: number;
  processMGD: number;
  dischargeMGD: number;
  recycledMGD: number;
  recyclingRate: number;
  permitStatus: 'Compliant' | 'Minor Non-Compliance' | 'Significant Non-Compliance';
  permitId: string;
}

interface DMREntry {
  permitId: string;
  period: string;
  status: 'Submitted' | 'Pending' | 'Overdue';
  dueDate: string;
  submittedDate: string | null;
}

interface EffluentTrend {
  parameter: string;
  unit: string;
  limit: number;
  values: Array<{ month: string; value: number }>;
}

const FACILITY_DATA: Record<string, {
  facilities: FacilityBalance[];
  dmrTimeline: DMREntry[];
  effluentTrends: EffluentTrend[];
}> = {
  MD: {
    facilities: [
      { name: 'Baltimore Manufacturing', intakeMGD: 1.80, processMGD: 1.40, dischargeMGD: 0.95, recycledMGD: 0.45, recyclingRate: 32.1, permitStatus: 'Compliant', permitId: 'MD0012345' },
      { name: 'Annapolis Processing', intakeMGD: 0.90, processMGD: 0.72, dischargeMGD: 0.50, recycledMGD: 0.22, recyclingRate: 30.6, permitStatus: 'Minor Non-Compliance', permitId: 'MD0067890' },
      { name: 'Frederick Distribution', intakeMGD: 0.30, processMGD: 0.18, dischargeMGD: 0.15, recycledMGD: 0.03, recyclingRate: 16.7, permitStatus: 'Compliant', permitId: 'MD0024680' },
    ],
    dmrTimeline: [
      { permitId: 'MD0012345', period: 'Jan 2026', status: 'Submitted', dueDate: '2026-02-28', submittedDate: '2026-02-14' },
      { permitId: 'MD0012345', period: 'Feb 2026', status: 'Pending', dueDate: '2026-03-28', submittedDate: null },
      { permitId: 'MD0067890', period: 'Jan 2026', status: 'Submitted', dueDate: '2026-02-28', submittedDate: '2026-02-26' },
      { permitId: 'MD0067890', period: 'Feb 2026', status: 'Overdue', dueDate: '2026-03-28', submittedDate: null },
      { permitId: 'MD0024680', period: 'Jan 2026', status: 'Submitted', dueDate: '2026-02-28', submittedDate: '2026-02-10' },
    ],
    effluentTrends: [
      { parameter: 'BOD5', unit: 'mg/L', limit: 30, values: [{ month: 'Sep', value: 18 }, { month: 'Oct', value: 21 }, { month: 'Nov', value: 19 }, { month: 'Dec', value: 22 }, { month: 'Jan', value: 24 }, { month: 'Feb', value: 20 }] },
      { parameter: 'TSS', unit: 'mg/L', limit: 30, values: [{ month: 'Sep', value: 14 }, { month: 'Oct', value: 16 }, { month: 'Nov', value: 12 }, { month: 'Dec', value: 18 }, { month: 'Jan', value: 15 }, { month: 'Feb', value: 13 }] },
      { parameter: 'Total Nitrogen', unit: 'mg/L', limit: 8, values: [{ month: 'Sep', value: 5.2 }, { month: 'Oct', value: 5.8 }, { month: 'Nov', value: 6.1 }, { month: 'Dec', value: 5.5 }, { month: 'Jan', value: 6.4 }, { month: 'Feb', value: 5.9 }] },
    ],
  },
};

const DEFAULT_DATA = {
  facilities: [
    { name: 'Primary Facility', intakeMGD: 2.50, processMGD: 1.90, dischargeMGD: 1.30, recycledMGD: 0.60, recyclingRate: 31.6, permitStatus: 'Compliant' as const, permitId: 'XX0011111' },
    { name: 'Secondary Facility', intakeMGD: 0.80, processMGD: 0.55, dischargeMGD: 0.40, recycledMGD: 0.15, recyclingRate: 27.3, permitStatus: 'Compliant' as const, permitId: 'XX0022222' },
  ],
  dmrTimeline: [
    { permitId: 'XX0011111', period: 'Jan 2026', status: 'Submitted' as const, dueDate: '2026-02-28', submittedDate: '2026-02-18' },
    { permitId: 'XX0011111', period: 'Feb 2026', status: 'Pending' as const, dueDate: '2026-03-28', submittedDate: null },
  ],
  effluentTrends: [
    { parameter: 'BOD5', unit: 'mg/L', limit: 30, values: [{ month: 'Oct', value: 19 }, { month: 'Nov', value: 21 }, { month: 'Dec', value: 18 }, { month: 'Jan', value: 23 }, { month: 'Feb', value: 20 }] },
    { parameter: 'TSS', unit: 'mg/L', limit: 30, values: [{ month: 'Oct', value: 15 }, { month: 'Nov', value: 13 }, { month: 'Dec', value: 17 }, { month: 'Jan', value: 14 }, { month: 'Feb', value: 12 }] },
  ],
};

// -- Helpers -----------------------------------------------------------------

function permitBadgeClass(status: string): string {
  if (status === 'Compliant') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'Minor Non-Compliance') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

function dmrStatusBadge(status: string): string {
  if (status === 'Submitted') return 'bg-green-100 text-green-700';
  if (status === 'Pending') return 'bg-blue-100 text-blue-700';
  return 'bg-red-100 text-red-700';
}

// -- Component ---------------------------------------------------------------

export function FacilityOperationsPanel({ stateAbbr }: FacilityOperationsPanelProps) {
  const data = useMemo(() => FACILITY_DATA[stateAbbr?.toUpperCase()] ?? DEFAULT_DATA, [stateAbbr]);

  const totalIntake = useMemo(() => data.facilities.reduce((sum, f) => sum + f.intakeMGD, 0), [data]);
  const totalRecycled = useMemo(() => data.facilities.reduce((sum, f) => sum + f.recycledMGD, 0), [data]);
  const avgRecyclingRate = useMemo(() => {
    if (data.facilities.length === 0) return 0;
    return data.facilities.reduce((sum, f) => sum + f.recyclingRate, 0) / data.facilities.length;
  }, [data]);
  const compliantCount = useMemo(() => data.facilities.filter((f) => f.permitStatus === 'Compliant').length, [data]);

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Factory className="w-3.5 h-3.5" />
        <span>Facility Water Operations — NPDES/DMR Data + Internal Monitoring ({stateAbbr || 'National'})</span>
      </div>

      {/* Section 1: Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: 'Total Intake', value: `${totalIntake.toFixed(1)} MGD`, iconBg: 'bg-cyan-50 border-cyan-200', iconColor: 'text-cyan-600', Icon: Droplets },
          { label: 'Total Recycled', value: `${totalRecycled.toFixed(2)} MGD`, iconBg: 'bg-emerald-50 border-emerald-200', iconColor: 'text-emerald-600', Icon: Recycle },
          { label: 'Avg Recycling Rate', value: `${avgRecyclingRate.toFixed(1)}%`, iconBg: 'bg-blue-50 border-blue-200', iconColor: 'text-blue-600', Icon: BarChart3 },
          { label: 'Permit Compliance', value: `${compliantCount}/${data.facilities.length}`, iconBg: 'bg-green-50 border-green-200', iconColor: 'text-green-600', Icon: FileCheck },
        ] as const).map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${stat.iconBg}`}>
                  <stat.Icon size={20} className={stat.iconColor} />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Section 2: Facility Water Balance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Factory size={16} className="text-slate-600" />
            Facility Water Balance
            <Badge variant="secondary" className="ml-1 text-[10px]">{data.facilities.length} facilities</Badge>
          </CardTitle>
          <CardDescription>
            Water intake, process use, discharge, and recycling volumes per facility (million gallons/day)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">Facility</th>
                  <th className="pb-2 font-semibold text-right">Intake</th>
                  <th className="pb-2 font-semibold text-right">Process</th>
                  <th className="pb-2 font-semibold text-right">Discharge</th>
                  <th className="pb-2 font-semibold text-right">Recycled</th>
                  <th className="pb-2 font-semibold text-center">Recycling %</th>
                  <th className="pb-2 font-semibold text-center">Permit Status</th>
                </tr>
              </thead>
              <tbody>
                {data.facilities.map((f) => (
                  <tr key={f.permitId} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 font-medium text-slate-700">{f.name}</td>
                    <td className="py-2 text-right tabular-nums text-slate-600">{f.intakeMGD.toFixed(2)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-600">{f.processMGD.toFixed(2)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-600">{f.dischargeMGD.toFixed(2)}</td>
                    <td className="py-2 text-right tabular-nums text-emerald-700 font-semibold">{f.recycledMGD.toFixed(2)}</td>
                    <td className="py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, f.recyclingRate)}%` }} />
                        </div>
                        <span className="font-semibold text-slate-700 tabular-nums">{f.recyclingRate.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="py-2 text-center">
                      <Badge className={`text-[9px] ${permitBadgeClass(f.permitStatus)}`}>{f.permitStatus}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: DMR Submission Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck size={16} className="text-blue-600" />
            DMR Submission Timeline
            {data.dmrTimeline.filter((d) => d.status === 'Overdue').length > 0 && (
              <Badge className="ml-1 text-[10px] bg-red-100 text-red-700">
                {data.dmrTimeline.filter((d) => d.status === 'Overdue').length} overdue
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Discharge Monitoring Report submission status and deadlines by permit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">Permit ID</th>
                  <th className="pb-2 font-semibold">Reporting Period</th>
                  <th className="pb-2 font-semibold text-center">Status</th>
                  <th className="pb-2 font-semibold">Due Date</th>
                  <th className="pb-2 font-semibold">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {data.dmrTimeline.map((d, idx) => (
                  <tr key={`${d.permitId}-${idx}`} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 font-mono text-slate-600">{d.permitId}</td>
                    <td className="py-2 text-slate-700">{d.period}</td>
                    <td className="py-2 text-center">
                      <Badge className={`text-[9px] ${dmrStatusBadge(d.status)}`}>{d.status}</Badge>
                    </td>
                    <td className="py-2 text-slate-600">{d.dueDate}</td>
                    <td className="py-2 text-slate-600">{d.submittedDate ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Effluent Quality Trending */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp size={16} className="text-purple-600" />
            Effluent Quality Trending
          </CardTitle>
          <CardDescription>
            Key discharge parameter concentrations over the last 6 months relative to permit limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.effluentTrends.map((trend) => {
              const maxVal = Math.max(trend.limit, ...trend.values.map((v) => v.value));
              const latest = trend.values[trend.values.length - 1];
              const pctOfLimit = latest ? ((latest.value / trend.limit) * 100).toFixed(0) : '0';
              return (
                <div key={trend.parameter} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">{trend.parameter}</span>
                      <span className="text-[10px] text-slate-400">({trend.unit})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Limit: {trend.limit}</span>
                      <Badge className={`text-[9px] ${
                        Number(pctOfLimit) >= 90 ? 'bg-red-100 text-red-700' :
                        Number(pctOfLimit) >= 75 ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {pctOfLimit}% of limit
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-end gap-1 h-12">
                    {trend.values.map((v) => {
                      const heightPct = (v.value / maxVal) * 100;
                      const limitPct = (trend.limit / maxVal) * 100;
                      return (
                        <div key={v.month} className="flex-1 flex flex-col items-center gap-0.5">
                          <div className="w-full relative" style={{ height: '40px' }}>
                            <div
                              className={`absolute bottom-0 w-full rounded-t ${
                                v.value >= trend.limit ? 'bg-red-400' :
                                v.value >= trend.limit * 0.9 ? 'bg-amber-400' :
                                'bg-blue-400'
                              }`}
                              style={{ height: `${heightPct}%` }}
                            />
                            <div
                              className="absolute w-full border-t-2 border-dashed border-red-300"
                              style={{ bottom: `${limitPct}%` }}
                            />
                          </div>
                          <span className="text-[8px] text-slate-400">{v.month}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-slate-400 mt-2">
              Dashed red line indicates permit limit. Bars exceeding 90% of limit are flagged for attention.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
