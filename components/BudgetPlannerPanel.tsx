'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Legend, Cell,
} from 'recharts';
import {
  Leaf, Users, Shield, Scale, Thermometer, ChevronDown, ChevronUp,
  DollarSign, ArrowUpRight, ArrowDownRight, Minus, Info,
} from 'lucide-react';
import { MockDataBadge } from './MockDataBadge';
import {
  allocateBudget,
  type PriorityAxis,
  type BudgetPlannerResult,
  type ScoredIntervention,
  type StreamPosition,
} from '@/lib/budgetPlannerEngine';

// ─── Constants ──────────────────────────────────────────────────────────────

const PRIORITY_AXES: { key: PriorityAxis; label: string; icon: typeof Leaf; color: string; trackColor: string }[] = [
  { key: 'ecological',           label: 'Ecological Impact',       icon: Leaf,        color: 'text-green-600',  trackColor: 'bg-green-500' },
  { key: 'economic',             label: 'Jobs / Economic',         icon: Users,       color: 'text-blue-600',   trackColor: 'bg-blue-500' },
  { key: 'environmentalJustice', label: 'Environmental Justice',   icon: Shield,      color: 'text-purple-600', trackColor: 'bg-purple-500' },
  { key: 'regulatoryCompliance', label: 'Regulatory Compliance',   icon: Scale,       color: 'text-red-600',    trackColor: 'bg-red-500' },
  { key: 'climateResilience',    label: 'Climate Resilience',      icon: Thermometer, color: 'text-amber-600',  trackColor: 'bg-amber-500' },
];

const QUICK_BUDGETS = [250_000, 500_000, 1_000_000, 2_500_000, 5_000_000];

const CATEGORY_COLORS: Record<string, string> = {
  'treatment':      '#3b82f6',
  'nature-based':   '#10b981',
  'infrastructure': '#8b5cf6',
  'market':         '#f59e0b',
  'management':     '#6366f1',
  'emerging':       '#ec4899',
};

const POSITION_CONFIG: Record<StreamPosition, { label: string; color: string; bg: string }> = {
  upstream:   { label: 'Upstream',   color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  downstream: { label: 'Downstream', color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  neutral:    { label: 'Neutral',    color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200' },
};

const DEFAULT_WEIGHTS: Record<PriorityAxis, number> = {
  ecological: 20,
  economic: 20,
  environmentalJustice: 20,
  regulatoryCompliance: 20,
  climateResilience: 20,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function BudgetPlannerPanel() {
  // State
  const [budget, setBudget] = useState(1_000_000);
  const [budgetInput, setBudgetInput] = useState('1,000,000');
  const [weights, setWeights] = useState<Record<PriorityAxis, number>>({ ...DEFAULT_WEIGHTS });
  const [stateAbbr] = useState('FL');
  const [showUpstreamInfo, setShowUpstreamInfo] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  // Budget input handler
  const handleBudgetInput = useCallback((raw: string) => {
    const stripped = raw.replace(/[^0-9]/g, '');
    const num = parseInt(stripped, 10) || 0;
    setBudgetInput(num.toLocaleString());
    setBudget(num);
  }, []);

  // Quick-set budget
  const handleQuickBudget = useCallback((amount: number) => {
    setBudget(amount);
    setBudgetInput(amount.toLocaleString());
  }, []);

  // Slider auto-balance: when one moves, others adjust proportionally to keep sum=100
  const handleWeightChange = useCallback((changedAxis: PriorityAxis, newValue: number) => {
    setWeights(prev => {
      const clamped = Math.min(100, Math.max(0, Math.round(newValue)));
      const otherAxes = PRIORITY_AXES.map(a => a.key).filter(k => k !== changedAxis);
      const otherSum = otherAxes.reduce((s, k) => s + prev[k], 0);
      const remaining = 100 - clamped;

      const next = { ...prev, [changedAxis]: clamped };

      if (otherSum === 0) {
        // Distribute remaining equally among others
        const each = Math.floor(remaining / otherAxes.length);
        let leftover = remaining - each * otherAxes.length;
        for (const k of otherAxes) {
          next[k] = each + (leftover > 0 ? 1 : 0);
          if (leftover > 0) leftover--;
        }
      } else {
        // Proportional redistribution
        let distributed = 0;
        for (let i = 0; i < otherAxes.length; i++) {
          const k = otherAxes[i];
          if (i === otherAxes.length - 1) {
            // Last one gets rounding remainder
            next[k] = remaining - distributed;
          } else {
            const share = Math.round((prev[k] / otherSum) * remaining);
            next[k] = share;
            distributed += share;
          }
        }
      }

      return next;
    });
  }, []);

  // Run allocation
  const result: BudgetPlannerResult | null = useMemo(() => {
    if (!hasRun) return null;
    return allocateBudget({ totalBudget: budget, weights, stateAbbr });
  }, [hasRun, budget, weights, stateAbbr]);

  // Chart data
  const barChartData = useMemo(() => {
    if (!result) return [];
    return result.allocations
      .filter(a => a.allocatedBudget > 0)
      .map(a => ({
        name: a.intervention.name.length > 18
          ? a.intervention.name.slice(0, 16) + '...'
          : a.intervention.name,
        fullName: a.intervention.name,
        budget: a.allocatedBudget,
        category: a.intervention.category,
      }));
  }, [result]);

  const radarData = useMemo(() => {
    if (!result) return [];
    // Target = user weights (normalized to 0-100)
    // Achieved = weighted avg of axis scores for funded interventions
    const active = result.allocations.filter(a => a.estimatedUnits >= 1);
    const totalBudget = active.reduce((s, a) => s + a.allocatedBudget, 0);

    return PRIORITY_AXES.map(({ key, label }) => {
      const achieved = totalBudget > 0
        ? Math.round(
            active.reduce((s, a) => s + a.axisScores[key] * a.allocatedBudget, 0) /
            totalBudget * 100,
          )
        : 0;
      return { axis: label, target: weights[key], achieved };
    });
  }, [result, weights]);

  const weightSum = Object.values(weights).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign size={16} className="text-emerald-600" />
            Budget Planner
            <MockDataBadge />
          </CardTitle>
          <CardDescription>
            Set a spending amount and weighted priorities to generate an optimized allocation
            across 9 restoration interventions. Upstream solutions receive a 1.3x impact multiplier.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Budget Input */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Total Budget</label>
            <div className="relative flex-1 max-w-[200px]">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">$</span>
              <input
                type="text"
                value={budgetInput}
                onChange={e => handleBudgetInput(e.target.value)}
                className="w-full pl-6 pr-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {QUICK_BUDGETS.map(amt => (
              <button
                key={amt}
                onClick={() => handleQuickBudget(amt)}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-md border transition-all ${
                  budget === amt
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {formatDollars(amt)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Priority Weights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Priority Weights
            <span className={`text-[10px] font-mono ${weightSum === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
              ({weightSum}/100)
            </span>
          </CardTitle>
          <CardDescription className="text-[11px]">
            Adjust sliders to set relative importance. They auto-balance to 100%.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {PRIORITY_AXES.map(({ key, label, icon: Icon, color, trackColor }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon size={13} className={color} />
                  <span className="text-xs font-medium text-slate-700">{label}</span>
                </div>
                <span className="text-xs font-mono text-slate-500 w-8 text-right">{weights[key]}%</span>
              </div>
              <Slider
                value={[weights[key]]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => handleWeightChange(key, v)}
                className="[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Upstream Info */}
      <button
        onClick={() => setShowUpstreamInfo(!showUpstreamInfo)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all"
      >
        <Info size={12} />
        <span className="font-medium">How upstream/downstream multipliers work</span>
        {showUpstreamInfo ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
      </button>
      {showUpstreamInfo && (
        <Card>
          <CardContent className="pt-4 text-[11px] text-slate-600 space-y-2">
            <p>
              Interventions are classified by their position in the watershed. <strong>Upstream</strong> solutions
              (riparian buffers, constructed wetlands, stormwater BMPs) prevent pollution at the source and receive
              a <strong>1.3x</strong> multiplier on ecological scores.
            </p>
            <p>
              <strong>Downstream</strong> interventions (PEARL ALIA, sediment management, oyster reefs, SAV restoration)
              treat or filter water closer to the impaired waterbody and receive a <strong>0.8x</strong> multiplier.
              Both types are essential — upstream for prevention, downstream for remediation.
            </p>
            <p>
              <strong>Neutral</strong> interventions (nutrient trading, emerging tech) operate outside the
              physical stream corridor and receive a <strong>1.0x</strong> multiplier.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Run Button */}
      <Button
        onClick={() => setHasRun(true)}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm"
      >
        {hasRun ? 'Update Allocation' : 'Run Budget Planner'}
      </Button>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary Banner */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: 'Total Allocated', value: formatDollars(result.summary.totalAllocated), color: 'text-emerald-700' },
              { label: 'Ecological Impact', value: `${result.summary.ecologicalImpact}/100`, color: 'text-green-700' },
              { label: 'Est. Jobs', value: String(result.summary.estimatedJobs), color: 'text-blue-700' },
              { label: 'EJ Score', value: `${result.summary.ejScore}/100`, color: 'text-purple-700' },
              { label: 'Climate Score', value: `${result.summary.climateScore}/100`, color: 'text-amber-700' },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardContent className="pt-3 pb-3 text-center">
                  <div className={`text-lg font-bold ${color}`}>{value}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Allocation Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Allocation Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-1 font-semibold text-slate-600">Intervention</th>
                      <th className="text-center py-2 px-1 font-semibold text-slate-600">Category</th>
                      <th className="text-center py-2 px-1 font-semibold text-slate-600">Position</th>
                      <th className="text-right py-2 px-1 font-semibold text-slate-600">Score</th>
                      <th className="text-right py-2 px-1 font-semibold text-slate-600">Budget</th>
                      <th className="text-right py-2 px-1 font-semibold text-slate-600">%</th>
                      <th className="text-right py-2 px-1 font-semibold text-slate-600">Units</th>
                      <th className="py-2 px-1 w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.allocations.map((a) => {
                      const pos = POSITION_CONFIG[a.position];
                      const pctVal = result.summary.totalAllocated > 0
                        ? (a.allocatedBudget / result.summary.totalAllocated) * 100
                        : 0;
                      return (
                        <tr key={a.intervention.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-1.5 px-1 font-medium text-slate-800">{a.intervention.name}</td>
                          <td className="py-1.5 px-1 text-center">
                            <Badge variant="outline" className="text-[9px] px-1.5" style={{ borderColor: CATEGORY_COLORS[a.intervention.category] + '66', color: CATEGORY_COLORS[a.intervention.category] }}>
                              {a.intervention.category}
                            </Badge>
                          </td>
                          <td className="py-1.5 px-1 text-center">
                            <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded border ${pos.bg} ${pos.color}`}>
                              {a.position === 'upstream' && <ArrowUpRight size={9} />}
                              {a.position === 'downstream' && <ArrowDownRight size={9} />}
                              {a.position === 'neutral' && <Minus size={9} />}
                              {pos.label}
                              <span className="opacity-60 ml-0.5">{a.positionMultiplier}x</span>
                            </span>
                          </td>
                          <td className="py-1.5 px-1 text-right font-mono text-slate-600">{a.compositeScore.toFixed(3)}</td>
                          <td className="py-1.5 px-1 text-right font-mono text-slate-800 font-semibold">{formatDollars(a.allocatedBudget)}</td>
                          <td className="py-1.5 px-1 text-right font-mono text-slate-500">{pctVal.toFixed(1)}%</td>
                          <td className="py-1.5 px-1 text-right font-mono text-slate-700">
                            {a.estimatedUnits > 0 ? (
                              <span>{a.estimatedUnits} <span className="text-slate-400">{a.intervention.cost.unitLabel}{a.estimatedUnits !== 1 ? 's' : ''}</span></span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-1.5 px-1">
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, pctVal)}%`,
                                  backgroundColor: CATEGORY_COLORS[a.intervention.category],
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Bar Chart */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm">Allocation by Intervention</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={barChartData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={(v) => formatDollars(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} width={110} />
                    <RTooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      formatter={(value: number) => formatDollars(value)}
                    />
                    <Bar dataKey="budget" radius={[0, 4, 4, 0]}>
                      {barChartData.map((entry, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[entry.category] ?? '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Radar Chart */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm">Priority Achievement</CardTitle>
                <CardDescription className="text-[10px]">Target weights vs achieved scores</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: '#64748b' }} />
                    <PolarRadiusAxis tick={{ fontSize: 8, fill: '#94a3b8' }} domain={[0, 100]} />
                    <Radar name="Target" dataKey="target" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.1} strokeDasharray="4 4" />
                    <Radar name="Achieved" dataKey="achieved" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Removal Rates Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Combined Removal Rates</CardTitle>
              <CardDescription className="text-[10px]">
                Multiplicative combination across all funded interventions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-2 font-semibold text-slate-600">Pollutant</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-600">Min</th>
                    <th className="text-right py-2 px-2 font-semibold text-emerald-600">Expected</th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-600">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { id: 'TN' as const, label: 'Total Nitrogen' },
                    { id: 'TP' as const, label: 'Total Phosphorus' },
                    { id: 'TSS' as const, label: 'Total Suspended Solids' },
                    { id: 'bacteria' as const, label: 'Bacteria' },
                    { id: 'DO_improvement' as const, label: 'DO Improvement' },
                  ]).map(({ id, label }) => {
                    const r = result.summary.combinedRemovalRates[id];
                    return (
                      <tr key={id} className="border-b border-slate-100">
                        <td className="py-1.5 px-2 font-medium text-slate-700">{label}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-500">{pct(r.min)}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-emerald-700 font-semibold">{pct(r.expected)}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-500">{pct(r.max)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
