'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle, AlertTriangle, Calendar, BarChart3, Award } from 'lucide-react';

// -- Props -------------------------------------------------------------------

interface ESGReportingPanelProps {
  stateAbbr: string;
}

// -- Framework readiness data ------------------------------------------------

interface FrameworkEntry {
  name: string;
  fullName: string;
  readinessPct: number;
  disclosuresTotal: number;
  disclosuresComplete: number;
  gaps: string[];
  deadline: string;
  status: 'On Track' | 'At Risk' | 'Behind' | 'Complete';
}

interface PeerBenchmark {
  metric: string;
  company: number;
  industryAvg: number;
  bestInClass: number;
  unit: string;
}

const REPORTING_DATA: Record<string, {
  frameworks: FrameworkEntry[];
  dataGaps: Array<{ area: string; severity: 'Critical' | 'High' | 'Medium' | 'Low'; description: string }>;
  peerBenchmarks: PeerBenchmark[];
  reportGeneration: Array<{ report: string; status: 'Published' | 'Draft' | 'In Progress' | 'Not Started'; lastUpdated: string }>;
}> = {
  MD: {
    frameworks: [
      { name: 'GRI', fullName: 'Global Reporting Initiative', readinessPct: 87, disclosuresTotal: 42, disclosuresComplete: 37, gaps: ['GRI 303-4 Water discharge quality', 'GRI 303-5 Water consumption breakdown'], deadline: '2026-06-30', status: 'On Track' },
      { name: 'SASB', fullName: 'Sustainability Accounting Standards Board', readinessPct: 72, disclosuresTotal: 18, disclosuresComplete: 13, gaps: ['Water withdrawal by source', 'Incidents of non-compliance', 'Water stress exposure'], deadline: '2026-03-31', status: 'At Risk' },
      { name: 'CDP', fullName: 'CDP Water Security Questionnaire', readinessPct: 91, disclosuresTotal: 35, disclosuresComplete: 32, gaps: ['Value chain water risk assessment'], deadline: '2026-07-31', status: 'On Track' },
      { name: 'TCFD', fullName: 'Task Force on Climate-Related Financial Disclosures', readinessPct: 65, disclosuresTotal: 11, disclosuresComplete: 7, gaps: ['Climate scenario analysis for water', 'Physical risk quantification', 'Transition risk metrics'], deadline: '2026-04-30', status: 'Behind' },
    ],
    dataGaps: [
      { area: 'Supply Chain Water Footprint', severity: 'Critical', description: 'Tier 2+ supplier water data unavailable for 68% of procurement spend' },
      { area: 'Scope 3 Water Accounting', severity: 'High', description: 'Indirect water use from raw materials not yet quantified' },
      { area: 'Biodiversity Impact Assessment', severity: 'Medium', description: 'Facility-level biodiversity screening incomplete for 3 sites' },
      { area: 'Community Engagement Metrics', severity: 'Low', description: 'Water-related stakeholder consultation records need centralization' },
    ],
    peerBenchmarks: [
      { metric: 'Water Intensity', company: 3.2, industryAvg: 4.8, bestInClass: 2.1, unit: 'gal/unit' },
      { metric: 'Recycling Rate', company: 31, industryAvg: 22, bestInClass: 55, unit: '%' },
      { metric: 'CDP Score', company: 85, industryAvg: 62, bestInClass: 95, unit: 'pts' },
      { metric: 'Disclosure Completeness', company: 79, industryAvg: 58, bestInClass: 96, unit: '%' },
    ],
    reportGeneration: [
      { report: 'Annual Sustainability Report', status: 'In Progress', lastUpdated: '2026-02-18' },
      { report: 'CDP Water Response', status: 'Draft', lastUpdated: '2026-02-10' },
      { report: 'GRI Content Index', status: 'In Progress', lastUpdated: '2026-02-22' },
      { report: 'TCFD Climate Report', status: 'Not Started', lastUpdated: '2025-12-15' },
      { report: 'Q4 2025 ESG Data Pack', status: 'Published', lastUpdated: '2026-01-31' },
    ],
  },
};

const DEFAULT_DATA = {
  frameworks: [
    { name: 'GRI', fullName: 'Global Reporting Initiative', readinessPct: 74, disclosuresTotal: 42, disclosuresComplete: 31, gaps: ['Water discharge quality data', 'Water consumption breakdown'], deadline: '2026-06-30', status: 'On Track' as const },
    { name: 'SASB', fullName: 'Sustainability Accounting Standards Board', readinessPct: 58, disclosuresTotal: 18, disclosuresComplete: 10, gaps: ['Water withdrawal by source', 'Compliance incidents'], deadline: '2026-03-31', status: 'At Risk' as const },
    { name: 'CDP', fullName: 'CDP Water Security Questionnaire', readinessPct: 80, disclosuresTotal: 35, disclosuresComplete: 28, gaps: ['Value chain water risk'], deadline: '2026-07-31', status: 'On Track' as const },
    { name: 'TCFD', fullName: 'Task Force on Climate-Related Financial Disclosures', readinessPct: 45, disclosuresTotal: 11, disclosuresComplete: 5, gaps: ['Scenario analysis', 'Physical risk quantification'], deadline: '2026-04-30', status: 'Behind' as const },
  ],
  dataGaps: [
    { area: 'Supply Chain Water Footprint', severity: 'Critical' as const, description: 'Supplier water data unavailable for majority of procurement spend' },
    { area: 'Scope 3 Water Accounting', severity: 'High' as const, description: 'Indirect water use not yet quantified' },
  ],
  peerBenchmarks: [
    { metric: 'Water Intensity', company: 4.1, industryAvg: 4.8, bestInClass: 2.1, unit: 'gal/unit' },
    { metric: 'Recycling Rate', company: 24, industryAvg: 22, bestInClass: 55, unit: '%' },
  ],
  reportGeneration: [
    { report: 'Annual Sustainability Report', status: 'In Progress' as const, lastUpdated: '2026-02-15' },
    { report: 'CDP Water Response', status: 'Not Started' as const, lastUpdated: '2025-11-30' },
  ],
};

// -- Helpers -----------------------------------------------------------------

function statusColor(status: string): string {
  switch (status) {
    case 'On Track': case 'Complete': return 'bg-green-100 text-green-800';
    case 'At Risk': return 'bg-amber-100 text-amber-800';
    case 'Behind': return 'bg-red-100 text-red-800';
    default: return 'bg-slate-100 text-slate-700';
  }
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'Critical': return 'bg-red-100 text-red-800 border-red-200';
    case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Medium': return 'bg-amber-100 text-amber-800 border-amber-200';
    default: return 'bg-blue-100 text-blue-800 border-blue-200';
  }
}

function reportStatusColor(status: string): string {
  switch (status) {
    case 'Published': return 'bg-green-100 text-green-700';
    case 'Draft': return 'bg-blue-100 text-blue-700';
    case 'In Progress': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function readinessBarColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

// -- Component ---------------------------------------------------------------

export function ESGReportingPanel({ stateAbbr }: ESGReportingPanelProps) {
  const data = useMemo(() => REPORTING_DATA[stateAbbr?.toUpperCase()] ?? DEFAULT_DATA, [stateAbbr]);

  const avgReadiness = useMemo(() => {
    if (data.frameworks.length === 0) return 0;
    return data.frameworks.reduce((sum, f) => sum + f.readinessPct, 0) / data.frameworks.length;
  }, [data]);

  const criticalGaps = useMemo(() => data.dataGaps.filter((g) => g.severity === 'Critical' || g.severity === 'High').length, [data]);

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <FileText className="w-3.5 h-3.5" />
        <span>ESG Reporting Readiness — GRI, SASB, CDP, TCFD Framework Compliance ({stateAbbr || 'National'})</span>
      </div>

      {/* Section 1: Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: 'Avg Framework Readiness', value: `${avgReadiness.toFixed(0)}%`, iconBg: 'bg-emerald-50 border-emerald-200', iconColor: 'text-emerald-600', Icon: BarChart3 },
          { label: 'Frameworks Tracked', value: `${data.frameworks.length}`, iconBg: 'bg-indigo-50 border-indigo-200', iconColor: 'text-indigo-600', Icon: FileText },
          { label: 'Critical/High Gaps', value: `${criticalGaps}`, iconBg: 'bg-red-50 border-red-200', iconColor: 'text-red-600', Icon: AlertTriangle },
          { label: 'Reports in Pipeline', value: `${data.reportGeneration.length}`, iconBg: 'bg-blue-50 border-blue-200', iconColor: 'text-blue-600', Icon: Calendar },
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

      {/* Section 2: Framework Coverage Matrix */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award size={16} className="text-indigo-600" />
            Framework Coverage Matrix
          </CardTitle>
          <CardDescription>
            Disclosure readiness across major ESG reporting frameworks with gap identification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.frameworks.map((fw) => (
              <div key={fw.name} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-bold text-slate-800">{fw.name}</span>
                    <span className="text-xs text-slate-400 ml-2">{fw.fullName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[9px] ${statusColor(fw.status)}`}>{fw.status}</Badge>
                    <span className="text-xs text-slate-500">Due: {fw.deadline}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full ${readinessBarColor(fw.readinessPct)} transition-all duration-500`}
                      style={{ width: `${fw.readinessPct}%` }}
                    />
                    {fw.readinessPct >= 20 && (
                      <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-bold text-white">
                        {fw.readinessPct}%
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-700 tabular-nums w-20 text-right">
                    {fw.disclosuresComplete}/{fw.disclosuresTotal}
                  </span>
                </div>
                {fw.gaps.length > 0 && (
                  <div className="mt-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide">Remaining Gaps:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {fw.gaps.map((gap) => (
                        <Badge key={gap} variant="outline" className="text-[9px] text-amber-700 border-amber-200 bg-amber-50">
                          {gap}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Data Gap Analysis */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle size={16} className="text-amber-600" />
            Data Gap Analysis
            {criticalGaps > 0 && (
              <Badge className="ml-1 text-[10px] bg-red-100 text-red-700">{criticalGaps} action items</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Material data gaps that may impact disclosure completeness or audit readiness
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.dataGaps.map((gap) => (
              <div key={gap.area} className={`rounded-lg border p-3 ${
                gap.severity === 'Critical' ? 'border-red-200 bg-red-50/50' :
                gap.severity === 'High' ? 'border-orange-200 bg-orange-50/50' :
                'border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-800">{gap.area}</span>
                  <Badge className={`text-[9px] ${severityColor(gap.severity)}`}>{gap.severity}</Badge>
                </div>
                <p className="text-[10px] text-slate-600">{gap.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Peer Benchmarking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 size={16} className="text-blue-600" />
            Industry Peer Benchmarking
          </CardTitle>
          <CardDescription>
            Company performance relative to industry average and best-in-class peers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">Metric</th>
                  <th className="pb-2 font-semibold text-right">Company</th>
                  <th className="pb-2 font-semibold text-right">Industry Avg</th>
                  <th className="pb-2 font-semibold text-right">Best in Class</th>
                  <th className="pb-2 font-semibold text-center">Position</th>
                </tr>
              </thead>
              <tbody>
                {data.peerBenchmarks.map((bm) => {
                  const aboveAvg = bm.metric === 'Water Intensity'
                    ? bm.company < bm.industryAvg
                    : bm.company > bm.industryAvg;
                  return (
                    <tr key={bm.metric} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-2 font-medium text-slate-700">{bm.metric}</td>
                      <td className="py-2 text-right font-semibold text-slate-800 tabular-nums">{bm.company} {bm.unit}</td>
                      <td className="py-2 text-right text-slate-500 tabular-nums">{bm.industryAvg} {bm.unit}</td>
                      <td className="py-2 text-right text-slate-500 tabular-nums">{bm.bestInClass} {bm.unit}</td>
                      <td className="py-2 text-center">
                        <Badge className={`text-[9px] ${aboveAvg ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {aboveAvg ? 'Above Avg' : 'Below Avg'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Report Generation Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle size={16} className="text-green-600" />
            Report Generation Status
          </CardTitle>
          <CardDescription>
            Active disclosure reports and their current production stage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.reportGeneration.map((r) => (
              <div key={r.report} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <span className="text-xs font-medium text-slate-700">{r.report}</span>
                  <p className="text-[10px] text-slate-400">Last updated: {r.lastUpdated}</p>
                </div>
                <Badge className={`text-[9px] ${reportStatusColor(r.status)}`}>{r.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
