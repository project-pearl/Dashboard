'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Scale, AlertTriangle, FileText, Calendar, Megaphone, Shield } from 'lucide-react';

// ── Props ───────────────────────────────────────────────────────────────────

interface AdvocacyPanelProps {
  stateAbbr: string;
}

// ── Types ───────────────────────────────────────────────────────────────────

type ViolationPriority = 'critical' | 'high' | 'medium';

interface ViolationAlert {
  id: string;
  facility: string;
  state: string;
  violation: string;
  priority: ViolationPriority;
  daysSinceDetection: number;
  permit: string;
}

interface CommentPeriod {
  id: string;
  title: string;
  agency: string;
  daysRemaining: number;
  type: string;
}

interface BillTracker {
  id: string;
  bill: string;
  title: string;
  chamber: string;
  status: string;
  relevance: 'high' | 'medium' | 'low';
}

interface Hearing {
  id: string;
  title: string;
  date: string;
  location: string;
  type: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const VIOLATION_ALERTS: ViolationAlert[] = [
  { id: 'V-001', facility: 'Riverview Industrial WWTP', state: 'PA', violation: 'Effluent Limit Exceedance — Total Phosphorus', priority: 'critical', daysSinceDetection: 3, permit: 'PA0027511' },
  { id: 'V-002', facility: 'Clearwater Municipal STP', state: 'MD', violation: 'Reporting Violation — DMR Non-submission', priority: 'high', daysSinceDetection: 14, permit: 'MD0021601' },
  { id: 'V-003', facility: 'Valley Processing Plant', state: 'VA', violation: 'Unpermitted Discharge — Storm Event Bypass', priority: 'critical', daysSinceDetection: 7, permit: 'VA0089541' },
  { id: 'V-004', facility: 'Oakdale POTW', state: 'OH', violation: 'Effluent Limit — Fecal Coliform', priority: 'medium', daysSinceDetection: 21, permit: 'OH0034207' },
  { id: 'V-005', facility: 'Lakeside Chemical Corp', state: 'NY', violation: 'Pretreatment Violation — pH Exceedance', priority: 'high', daysSinceDetection: 10, permit: 'NY0108456' },
];

const COMMENT_PERIODS: CommentPeriod[] = [
  { id: 'CP-001', title: 'Revised Effluent Limitations for Nutrient Discharges', agency: 'EPA Region 3', daysRemaining: 12, type: 'Rulemaking' },
  { id: 'CP-002', title: 'Draft NPDES General Permit for Stormwater', agency: 'EPA HQ', daysRemaining: 28, type: 'Permit' },
  { id: 'CP-003', title: 'TMDL Revision — Chesapeake Bay Watershed', agency: 'EPA Region 3', daysRemaining: 5, type: 'TMDL' },
  { id: 'CP-004', title: 'PFAS Drinking Water Standards Update', agency: 'EPA OGWDW', daysRemaining: 45, type: 'Rulemaking' },
];

const BILLS: BillTracker[] = [
  { id: 'B-001', bill: 'S. 1247', title: 'Clean Water Infrastructure Act', chamber: 'Senate', status: 'Committee', relevance: 'high' },
  { id: 'B-002', bill: 'H.R. 3891', title: 'PFAS Accountability Act', chamber: 'House', status: 'Floor Vote', relevance: 'high' },
  { id: 'B-003', bill: 'S. 892', title: 'Watershed Restoration Funding Act', chamber: 'Senate', status: 'Introduced', relevance: 'medium' },
  { id: 'B-004', bill: 'H.R. 2104', title: 'Rural Water Quality Improvement Act', chamber: 'House', status: 'Committee', relevance: 'medium' },
];

const HEARINGS: Hearing[] = [
  { id: 'H-001', title: 'Public Hearing — Nutrient TMDL Implementation', date: '2026-03-12', location: 'Harrisburg, PA', type: 'TMDL' },
  { id: 'H-002', title: 'EPA Stakeholder Meeting — CWA §316(b)', date: '2026-03-18', location: 'Virtual', type: 'Rulemaking' },
  { id: 'H-003', title: 'State Water Board — NPDES Permit Renewal', date: '2026-04-02', location: 'Richmond, VA', type: 'Permit' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<ViolationPriority, { label: string; badge: string; border: string }> = {
  critical: { label: 'Critical', badge: 'bg-red-100 text-red-700', border: 'border-red-200 bg-red-50' },
  high:     { label: 'High',     badge: 'bg-orange-100 text-orange-700', border: 'border-orange-200 bg-orange-50' },
  medium:   { label: 'Medium',   badge: 'bg-amber-100 text-amber-700', border: 'border-amber-200 bg-amber-50' },
};

const RELEVANCE_BADGE: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

function fmtDate(d: string): string {
  if (!d) return 'N/A';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
}

function urgencyColor(days: number): string {
  if (days <= 7) return 'text-red-700 font-bold';
  if (days <= 14) return 'text-orange-700 font-semibold';
  return 'text-amber-700';
}

// ── Component ───────────────────────────────────────────────────────────────

export function AdvocacyPanel({ stateAbbr }: AdvocacyPanelProps) {
  const [showAllViolations, setShowAllViolations] = useState(false);

  const filteredViolations = useMemo(() => {
    let list = VIOLATION_ALERTS;
    if (stateAbbr) {
      const stateSpecific = list.filter((v) => v.state.toUpperCase() === stateAbbr.toUpperCase());
      if (stateSpecific.length > 0) list = stateSpecific;
    }
    return showAllViolations ? list : list.slice(0, 3);
  }, [stateAbbr, showAllViolations]);

  const interventionStats = useMemo(() => ({
    totalInterventions: 47,
    successfulOutcomes: 38,
    pendingActions: 9,
    successRate: 80.9,
  }), []);

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Scale className="w-3.5 h-3.5" />
        <span>
          Policy Advocacy Intelligence — Regulatory &amp; Legislative Tracker
          {stateAbbr ? ` (${stateAbbr})` : ' (National)'}
        </span>
      </div>

      {/* ── Section 1: Hero Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: 'Active Violations', value: VIOLATION_ALERTS.length, Icon: AlertTriangle, iconBg: 'bg-red-50 border-red-200', iconColor: 'text-red-600', valueColor: 'text-red-700' },
          { label: 'Comment Periods', value: COMMENT_PERIODS.length, Icon: FileText, iconBg: 'bg-blue-50 border-blue-200', iconColor: 'text-blue-600', valueColor: 'text-blue-700' },
          { label: 'Bills Tracked', value: BILLS.length, Icon: Scale, iconBg: 'bg-purple-50 border-purple-200', iconColor: 'text-purple-600', valueColor: 'text-purple-700' },
          { label: 'Success Rate', value: `${interventionStats.successRate}%`, Icon: Shield, iconBg: 'bg-emerald-50 border-emerald-200', iconColor: 'text-emerald-600', valueColor: 'text-emerald-700' },
        ] as const).map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${stat.iconBg}`}>
                  <stat.Icon size={20} className={stat.iconColor} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${stat.valueColor}`}>{stat.value}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Section 2: Violation Alerts ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle size={16} className="text-red-600" />
            Violation Alerts Requiring Advocacy
            <Badge className="ml-1 text-[10px] bg-red-100 text-red-700">
              {VIOLATION_ALERTS.filter((v) => v.priority === 'critical').length} critical
            </Badge>
          </CardTitle>
          <CardDescription>
            Active CWA/NPDES violations requiring NGO intervention or public comment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredViolations.map((v) => {
              const cfg = PRIORITY_CONFIG[v.priority];
              return (
                <div key={v.id} className={`rounded-lg border p-3 transition-colors ${cfg.border}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle size={14} className={v.priority === 'critical' ? 'text-red-600 shrink-0' : 'text-amber-600 shrink-0'} />
                      <span className="text-xs font-semibold text-slate-800 truncate">{v.facility}</span>
                      <Badge variant="secondary" className="text-[9px] shrink-0">{v.state}</Badge>
                    </div>
                    <Badge className={`text-[9px] ${cfg.badge}`}>{cfg.label}</Badge>
                  </div>
                  <p className="text-[11px] text-slate-600 ml-5 mb-1">{v.violation}</p>
                  <div className="flex items-center gap-4 text-[10px] text-slate-500 ml-5">
                    <span className="font-mono">{v.permit}</span>
                    <span className={urgencyColor(v.daysSinceDetection)}>
                      {v.daysSinceDetection}d since detection
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {VIOLATION_ALERTS.length > 3 && (
            <button
              onClick={() => setShowAllViolations((p) => !p)}
              className="mt-3 w-full text-center text-xs text-blue-600 hover:text-blue-800 font-medium py-1.5 rounded-md hover:bg-blue-50 transition-colors"
            >
              {showAllViolations ? 'Show fewer' : `Show all ${VIOLATION_ALERTS.length} violations`}
            </button>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Comment Period Tracker ────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText size={16} className="text-blue-600" />
            Regulatory Comment Periods
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {COMMENT_PERIODS.length} open
            </Badge>
          </CardTitle>
          <CardDescription>
            Active federal rulemaking and permit comment periods relevant to water quality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-semibold">Rulemaking / Permit</th>
                  <th className="pb-2 font-semibold">Agency</th>
                  <th className="pb-2 font-semibold">Type</th>
                  <th className="pb-2 font-semibold text-right">Days Left</th>
                </tr>
              </thead>
              <tbody>
                {COMMENT_PERIODS.map((cp) => (
                  <tr key={cp.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 font-medium text-slate-700 max-w-[280px] truncate" title={cp.title}>{cp.title}</td>
                    <td className="py-2 text-slate-600">{cp.agency}</td>
                    <td className="py-2"><Badge variant="secondary" className="text-[9px]">{cp.type}</Badge></td>
                    <td className="py-2 text-right">
                      <span className={urgencyColor(cp.daysRemaining)}>{cp.daysRemaining}d</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Legislative Bill Tracker ──────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone size={16} className="text-purple-600" />
            Legislative Bill Tracker
          </CardTitle>
          <CardDescription>
            Water-related legislation under consideration in Congress
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {BILLS.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <Scale size={14} className="text-purple-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{b.bill}</span>
                      <Badge variant="secondary" className="text-[9px]">{b.chamber}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate">{b.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-[10px] text-slate-500">{b.status}</span>
                  <Badge className={`text-[9px] ${RELEVANCE_BADGE[b.relevance]}`}>{b.relevance}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 5: Public Hearings Calendar ──────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar size={16} className="text-slate-600" />
            Upcoming Public Hearings
          </CardTitle>
          <CardDescription>
            Scheduled hearings and stakeholder meetings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {HEARINGS.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <Calendar size={14} className="text-slate-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{h.title}</p>
                    <p className="text-[10px] text-slate-500">{h.location}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-xs font-semibold text-slate-700">{fmtDate(h.date)}</span>
                  <Badge variant="secondary" className="text-[9px]">{h.type}</Badge>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
            <Shield size={10} />
            Successful interventions: {interventionStats.totalInterventions} total,{' '}
            {interventionStats.successfulOutcomes} favorable outcomes ({interventionStats.successRate}% success rate).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
