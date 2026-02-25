'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Droplets, Target, TrendingDown, MapPin, Award, BarChart3 } from 'lucide-react';

// -- Props -------------------------------------------------------------------

interface WaterStewardshipPanelProps {
  stateAbbr: string;
}

// -- Mock stewardship data by state ------------------------------------------

const STEWARDSHIP_DATA: Record<string, {
  useIntensity: number;
  useIntensityUnit: string;
  useIntensityTrend: number;
  cdpScore: string;
  cdpYear: number;
  reductionTarget: number;
  reductionActual: number;
  targetYear: number;
  facilities: Array<{
    name: string;
    region: string;
    stressLevel: 'Extremely High' | 'High' | 'Medium-High' | 'Low-Medium' | 'Low';
    sharedBasin: boolean;
    withdrawalMGD: number;
  }>;
  watershedContext: {
    basinName: string;
    stressIndex: number;
    sharedUsers: number;
    depletionRate: number;
  };
}> = {
  MD: {
    useIntensity: 3.2, useIntensityUnit: 'gal/unit', useIntensityTrend: -8.4,
    cdpScore: 'A-', cdpYear: 2025,
    reductionTarget: 20, reductionActual: 14.3, targetYear: 2030,
    facilities: [
      { name: 'Baltimore Manufacturing', region: 'Chesapeake Bay', stressLevel: 'Medium-High', sharedBasin: true, withdrawalMGD: 1.8 },
      { name: 'Annapolis Processing', region: 'Severn River', stressLevel: 'High', sharedBasin: true, withdrawalMGD: 0.9 },
      { name: 'Frederick Distribution', region: 'Monocacy River', stressLevel: 'Low-Medium', sharedBasin: false, withdrawalMGD: 0.3 },
    ],
    watershedContext: { basinName: 'Chesapeake Bay Watershed', stressIndex: 62, sharedUsers: 18_200_000, depletionRate: 1.4 },
  },
};

const DEFAULT_DATA = {
  useIntensity: 4.1, useIntensityUnit: 'gal/unit', useIntensityTrend: -5.2,
  cdpScore: 'B', cdpYear: 2025,
  reductionTarget: 15, reductionActual: 9.8, targetYear: 2030,
  facilities: [
    { name: 'Primary Manufacturing', region: 'Regional Basin', stressLevel: 'Medium-High' as const, sharedBasin: true, withdrawalMGD: 2.1 },
    { name: 'Secondary Processing', region: 'Local Watershed', stressLevel: 'Low-Medium' as const, sharedBasin: false, withdrawalMGD: 0.7 },
  ],
  watershedContext: { basinName: 'Regional Watershed', stressIndex: 48, sharedUsers: 5_400_000, depletionRate: 0.8 },
};

// -- Helpers -----------------------------------------------------------------

function stressColor(level: string): string {
  switch (level) {
    case 'Extremely High': return 'bg-red-100 text-red-800 border-red-200';
    case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Medium-High': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Low-Medium': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-green-100 text-green-800 border-green-200';
  }
}

function cdpScoreColor(score: string): string {
  if (score.startsWith('A')) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  if (score.startsWith('B')) return 'bg-blue-100 text-blue-800 border-blue-300';
  if (score.startsWith('C')) return 'bg-amber-100 text-amber-800 border-amber-300';
  return 'bg-red-100 text-red-800 border-red-300';
}

// -- Component ---------------------------------------------------------------

export function WaterStewardshipPanel({ stateAbbr }: WaterStewardshipPanelProps) {
  const data = useMemo(() => STEWARDSHIP_DATA[stateAbbr?.toUpperCase()] ?? DEFAULT_DATA, [stateAbbr]);

  const targetProgress = useMemo(() => {
    if (data.reductionTarget === 0) return 0;
    return Math.min(100, (data.reductionActual / data.reductionTarget) * 100);
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Droplets className="w-3.5 h-3.5" />
        <span>Corporate Water Stewardship — CDP Water Security + Internal Metrics ({stateAbbr || 'National'})</span>
      </div>

      {/* Section 1: Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: 'Water Use Intensity', value: `${data.useIntensity} ${data.useIntensityUnit}`, iconBg: 'bg-cyan-50 border-cyan-200', iconColor: 'text-cyan-600', Icon: Droplets },
          { label: 'YoY Intensity Change', value: `${data.useIntensityTrend}%`, iconBg: 'bg-emerald-50 border-emerald-200', iconColor: 'text-emerald-600', Icon: TrendingDown },
          { label: 'CDP Water Score', value: data.cdpScore, iconBg: 'bg-indigo-50 border-indigo-200', iconColor: 'text-indigo-600', Icon: Award },
          { label: 'Reduction Progress', value: `${data.reductionActual}% of ${data.reductionTarget}%`, iconBg: 'bg-amber-50 border-amber-200', iconColor: 'text-amber-600', Icon: Target },
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

      {/* Section 2: Water Reduction Target vs Actuals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target size={16} className="text-emerald-600" />
            Reduction Target vs Actuals
            <Badge variant="secondary" className="ml-1 text-[10px]">FY {data.targetYear} Goal</Badge>
          </CardTitle>
          <CardDescription>
            Corporate water withdrawal reduction target progress toward {data.targetYear} commitment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Target: {data.reductionTarget}% reduction from baseline</span>
              <span className="font-semibold text-slate-800">{data.reductionActual}% achieved</span>
            </div>
            <div className="h-6 bg-slate-100 rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
                style={{ width: `${targetProgress}%` }}
              />
              <span className="absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-700">
                {targetProgress.toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Baseline (2020)</span>
              <span>{data.reductionActual}% current</span>
              <span>{data.reductionTarget}% target ({data.targetYear})</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Facility Water Risk Exposure */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin size={16} className="text-red-600" />
            Facility Water Risk Exposure
            <Badge variant="secondary" className="ml-1 text-[10px]">{data.facilities.length} facilities</Badge>
          </CardTitle>
          <CardDescription>
            Facility-level water stress ratings based on WRI Aqueduct basin analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">Facility</th>
                  <th className="pb-2 font-semibold">Watershed Region</th>
                  <th className="pb-2 font-semibold text-center">Stress Level</th>
                  <th className="pb-2 font-semibold text-center">Shared Basin</th>
                  <th className="pb-2 font-semibold text-right">Withdrawal (MGD)</th>
                </tr>
              </thead>
              <tbody>
                {data.facilities.map((f) => (
                  <tr key={f.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 font-medium text-slate-700">{f.name}</td>
                    <td className="py-2 text-slate-600">{f.region}</td>
                    <td className="py-2 text-center">
                      <Badge className={`text-[9px] ${stressColor(f.stressLevel)}`}>{f.stressLevel}</Badge>
                    </td>
                    <td className="py-2 text-center">
                      {f.sharedBasin
                        ? <Badge className="text-[9px] bg-amber-100 text-amber-700">Yes</Badge>
                        : <span className="text-slate-400">No</span>}
                    </td>
                    <td className="py-2 text-right font-semibold text-slate-800 tabular-nums">{f.withdrawalMGD.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Watershed Context */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 size={16} className="text-blue-600" />
            Watershed Context
          </CardTitle>
          <CardDescription>
            Shared resource dynamics and basin-level water stress indicators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              { label: 'Basin', value: data.watershedContext.basinName, sub: '' },
              { label: 'Stress Index', value: `${data.watershedContext.stressIndex}/100`, sub: data.watershedContext.stressIndex >= 60 ? 'Elevated' : 'Moderate' },
              { label: 'Shared Basin Users', value: data.watershedContext.sharedUsers.toLocaleString(), sub: 'Estimated population' },
              { label: 'Depletion Rate', value: `${data.watershedContext.depletionRate}%/yr`, sub: 'Annual withdrawal trend' },
            ] as const).map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{item.label}</p>
                <p className="text-sm font-bold text-slate-800">{item.value}</p>
                {item.sub && <p className="text-[10px] text-slate-400 mt-0.5">{item.sub}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 5: CDP Water Security Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award size={16} className="text-indigo-600" />
            CDP Water Security Disclosure
            <Badge className={`ml-1 text-[10px] ${cdpScoreColor(data.cdpScore)}`}>{data.cdpScore}</Badge>
          </CardTitle>
          <CardDescription>
            Latest CDP Water Security questionnaire performance ({data.cdpYear})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { category: 'Water Accounting', status: 'Complete', score: 'A-' },
              { category: 'Risk Assessment', status: 'Complete', score: 'B' },
              { category: 'Targets & Goals', status: 'In Progress', score: 'B+' },
            ] as const).map((item) => (
              <div key={item.category} className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-indigo-900">{item.category}</span>
                  <Badge className={`text-[9px] ${cdpScoreColor(item.score)}`}>{item.score}</Badge>
                </div>
                <p className="text-[10px] text-indigo-600">{item.status}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-3">
            CDP scores range A to D-. An A-list score demonstrates leadership-level transparency in water stewardship disclosure.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
