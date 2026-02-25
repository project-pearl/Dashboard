'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TreePine, Hammer, Clock, DollarSign, Target, CheckCircle } from 'lucide-react';

// ── Props ───────────────────────────────────────────────────────────────────

interface RestorationProjectsPanelProps {
  stateAbbr: string;
}

// ── Types ───────────────────────────────────────────────────────────────────

type ProjectStatus = 'planning' | 'in-progress' | 'monitoring' | 'completed';

interface Project {
  id: string;
  name: string;
  state: string;
  status: ProjectStatus;
  budgetK: number;
  spentK: number;
  startDate: string;
  endDate: string;
  acresRestored: number;
  streamMiles: number;
  attainsCategory: '4a' | '4b' | '5' | 'N/A';
  lead: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const PROJECTS: Project[] = [
  { id: 'R-001', name: 'Chesapeake Bay Riparian Buffer', state: 'MD', status: 'in-progress', budgetK: 450, spentK: 287, startDate: '2024-03-15', endDate: '2026-09-30', acresRestored: 120, streamMiles: 8.4, attainsCategory: '4a', lead: 'Chesapeake Bay Foundation' },
  { id: 'R-002', name: 'Cuyahoga River Wetland Restoration', state: 'OH', status: 'in-progress', budgetK: 320, spentK: 198, startDate: '2024-06-01', endDate: '2026-12-15', acresRestored: 85, streamMiles: 3.2, attainsCategory: '4b', lead: 'Western Reserve Land Conservancy' },
  { id: 'R-003', name: 'Lake Erie Nutrient Reduction', state: 'OH', status: 'planning', budgetK: 680, spentK: 42, startDate: '2025-04-01', endDate: '2028-03-31', acresRestored: 0, streamMiles: 0, attainsCategory: '5', lead: 'Alliance for the Great Lakes' },
  { id: 'R-004', name: 'Anacostia Stormwater Retrofit', state: 'DC', status: 'completed', budgetK: 275, spentK: 268, startDate: '2022-09-01', endDate: '2025-01-31', acresRestored: 45, streamMiles: 2.1, attainsCategory: '4a', lead: 'Anacostia Watershed Society' },
  { id: 'R-005', name: 'Puget Sound Shellfish Recovery', state: 'WA', status: 'monitoring', budgetK: 520, spentK: 489, startDate: '2023-01-15', endDate: '2026-06-30', acresRestored: 210, streamMiles: 12.6, attainsCategory: '4b', lead: 'Puget Soundkeeper Alliance' },
  { id: 'R-006', name: 'Mississippi Delta Sediment Mgmt', state: 'LA', status: 'in-progress', budgetK: 890, spentK: 412, startDate: '2024-01-10', endDate: '2027-12-31', acresRestored: 340, streamMiles: 5.8, attainsCategory: '5', lead: 'Coalition to Restore Coastal Louisiana' },
  { id: 'R-007', name: 'Everglades Flow Restoration', state: 'FL', status: 'planning', budgetK: 1200, spentK: 85, startDate: '2025-07-01', endDate: '2029-06-30', acresRestored: 0, streamMiles: 0, attainsCategory: '5', lead: 'Everglades Foundation' },
  { id: 'R-008', name: 'Russian River Fish Passage', state: 'CA', status: 'monitoring', budgetK: 380, spentK: 362, startDate: '2023-04-01', endDate: '2026-03-31', acresRestored: 55, streamMiles: 18.3, attainsCategory: '4a', lead: 'Sonoma Water' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ProjectStatus, { label: string; badge: string; dot: string }> = {
  planning:      { label: 'Planning',    badge: 'bg-slate-100 text-slate-700',   dot: 'bg-slate-400' },
  'in-progress': { label: 'In Progress', badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  monitoring:    { label: 'Monitoring',  badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  completed:     { label: 'Completed',   badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
};

function fmtCurrency(k: number): string {
  if (k >= 1000) return `$${(k / 1000).toFixed(1)}M`;
  return `$${k}K`;
}

function fmtDate(d: string): string {
  if (!d) return 'N/A';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export function RestorationProjectsPanel({ stateAbbr }: RestorationProjectsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');

  const filteredProjects = useMemo(() => {
    let list = PROJECTS;
    if (stateAbbr) {
      list = list.filter((p) => p.state.toUpperCase() === stateAbbr.toUpperCase());
      if (list.length === 0) list = PROJECTS;
    }
    if (statusFilter !== 'all') {
      list = list.filter((p) => p.status === statusFilter);
    }
    return list;
  }, [stateAbbr, statusFilter]);

  const summary = useMemo(() => {
    const totalBudget = PROJECTS.reduce((s, p) => s + p.budgetK, 0);
    const totalSpent = PROJECTS.reduce((s, p) => s + p.spentK, 0);
    const totalAcres = PROJECTS.reduce((s, p) => s + p.acresRestored, 0);
    const totalMiles = PROJECTS.reduce((s, p) => s + p.streamMiles, 0);
    const byStatus = {
      planning: PROJECTS.filter((p) => p.status === 'planning').length,
      'in-progress': PROJECTS.filter((p) => p.status === 'in-progress').length,
      monitoring: PROJECTS.filter((p) => p.status === 'monitoring').length,
      completed: PROJECTS.filter((p) => p.status === 'completed').length,
    };
    return { totalBudget, totalSpent, totalAcres, totalMiles, byStatus, total: PROJECTS.length };
  }, []);

  const attainsCounts = useMemo(() => {
    const counts = { '4a': 0, '4b': 0, '5': 0, 'N/A': 0 };
    for (const p of PROJECTS) counts[p.attainsCategory]++;
    return counts;
  }, []);

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <TreePine className="w-3.5 h-3.5" />
        <span>
          Restoration Project Tracker — Active Projects
          {stateAbbr ? ` (${stateAbbr})` : ' (All States)'}
        </span>
      </div>

      {/* ── Section 1: Hero Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: 'Active Projects', value: summary.total, Icon: TreePine, iconBg: 'bg-green-50 border-green-200', iconColor: 'text-green-600', valueColor: 'text-slate-800' },
          { label: 'Total Budget', value: fmtCurrency(summary.totalBudget), Icon: DollarSign, iconBg: 'bg-blue-50 border-blue-200', iconColor: 'text-blue-600', valueColor: 'text-blue-700' },
          { label: 'Acres Restored', value: summary.totalAcres.toLocaleString(), Icon: Target, iconBg: 'bg-emerald-50 border-emerald-200', iconColor: 'text-emerald-600', valueColor: 'text-emerald-700' },
          { label: 'Stream Miles', value: summary.totalMiles.toFixed(1), Icon: Hammer, iconBg: 'bg-amber-50 border-amber-200', iconColor: 'text-amber-600', valueColor: 'text-amber-700' },
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

      {/* ── Section 2: Status Pipeline ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock size={16} className="text-blue-600" />
            Project Pipeline
          </CardTitle>
          <CardDescription>
            Click a status to filter the project list below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {(Object.keys(STATUS_CONFIG) as ProjectStatus[]).map((status) => {
              const cfg = STATUS_CONFIG[status];
              const count = summary.byStatus[status];
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(isActive ? 'all' : status)}
                  className={`rounded-lg border p-3 text-center transition-all ${
                    isActive ? 'ring-2 ring-blue-400 border-blue-300' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${cfg.dot}`} />
                  <p className="text-xl font-bold text-slate-800">{count}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{cfg.label}</p>
                </button>
              );
            })}
          </div>
          {/* ATTAINS category summary */}
          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">ATTAINS Categories:</span>
            <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">4a: {attainsCounts['4a']}</Badge>
            <Badge className="bg-blue-100 text-blue-700 text-[10px]">4b: {attainsCounts['4b']}</Badge>
            <Badge className="bg-red-100 text-red-700 text-[10px]">5: {attainsCounts['5']}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Project Cards ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Hammer size={16} className="text-slate-600" />
            Project Details
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {filteredProjects.length} shown
            </Badge>
          </CardTitle>
          <CardDescription>
            {statusFilter !== 'all'
              ? `Showing ${STATUS_CONFIG[statusFilter].label.toLowerCase()} projects`
              : 'All active restoration projects'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredProjects.map((p) => {
              const cfg = STATUS_CONFIG[p.status];
              const spentPct = p.budgetK > 0 ? (p.spentK / p.budgetK) * 100 : 0;
              return (
                <div
                  key={p.id}
                  className="rounded-lg border border-slate-200 p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-slate-400">{p.id}</span>
                      <span className="text-sm font-semibold text-slate-800 truncate">{p.name}</span>
                    </div>
                    <Badge className={`text-[10px] ${cfg.badge}`}>{cfg.label}</Badge>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500 mb-3">
                    <span className="font-medium text-slate-600">{p.state}</span>
                    <span>{p.lead}</span>
                    <span>{fmtDate(p.startDate)} - {fmtDate(p.endDate)}</span>
                    <Badge variant="secondary" className="text-[9px]">Cat {p.attainsCategory}</Badge>
                  </div>

                  {/* Budget progress bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-slate-500">Budget: {fmtCurrency(p.budgetK)}</span>
                      <span className="font-semibold text-slate-700">{fmtCurrency(p.spentK)} spent ({spentPct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${spentPct > 90 ? 'bg-red-500' : spentPct > 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(100, spentPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Outcomes */}
                  <div className="flex items-center gap-4 text-[10px]">
                    {p.acresRestored > 0 && (
                      <span className="flex items-center gap-1 text-emerald-700">
                        <CheckCircle size={10} />
                        {p.acresRestored} acres restored
                      </span>
                    )}
                    {p.streamMiles > 0 && (
                      <span className="flex items-center gap-1 text-blue-700">
                        <Target size={10} />
                        {p.streamMiles} stream-miles
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
