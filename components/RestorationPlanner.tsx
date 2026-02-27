'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Wrench, Target, Clock, DollarSign, TrendingUp, CheckCircle2,
  ChevronDown, ChevronUp, Shield, Zap, Leaf, AlertTriangle,
} from 'lucide-react';
import { calculateGrade, type WaterQualityGrade } from '@/lib/waterQualityScore';
import { computeRestorationPlan, type RestorationResult } from '@/lib/restorationEngine';
import type { WaterbodyCategory } from '@/lib/interventionLibrary';
import {
  generatePortfolios,
  type PlannerConstraints,
  type TargetOutcome,
  type TimelineCommitment,
  type Portfolio,
  type PortfolioResult,
} from '@/lib/portfolioEngine';
import { projectTrajectory, type Trajectory } from '@/lib/trajectoryEngine';
import { getStateGrants, type GrantOpportunity } from '@/lib/stateWaterData';

// ─── Props ──────────────────────────────────────────────────────────────────

interface RestorationPlannerProps {
  regionId: string | null;
  regionName?: string;
  stateAbbr: string;
  waterData: Record<string, { value: number; lastSampled?: string | null; unit?: string }> | null;
  alertLevel?: string;
  attainsCategory?: string;
  attainsCauses?: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtRange$(r: { min: number; expected: number; max: number }): string {
  return `${fmt$(r.min)}-${fmt$(r.max)}`;
}

const TARGET_LABELS: Record<TargetOutcome, { label: string; icon: typeof Target }> = {
  healthy:        { label: 'Healthy Ecosystem', icon: Leaf },
  swimmable:      { label: 'Swimmable',         icon: Target },
  fishable:       { label: 'Fishable',           icon: Target },
  shellfish_safe: { label: 'Shellfish Safe',     icon: Shield },
};

const TIMELINE_LABELS: Record<TimelineCommitment, string> = {
  '1yr': '1 Year', '5yr': '5 Years', '10yr': '10 Years', '25yr': '25 Years',
};

const STRATEGY_ICONS: Record<string, typeof DollarSign> = {
  cheapest: DollarSign,
  fastest: Zap,
  resilient: Shield,
};

const STRATEGY_COLORS: Record<string, string> = {
  cheapest: 'border-green-300 bg-green-50',
  fastest: 'border-amber-300 bg-amber-50',
  resilient: 'border-blue-300 bg-blue-50',
};

const STRATEGY_LINE_COLORS: Record<string, string> = {
  cheapest: '#16a34a',
  fastest: '#d97706',
  resilient: '#2563eb',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function RestorationPlanner({
  regionId,
  regionName,
  stateAbbr,
  waterData,
  alertLevel,
  attainsCategory,
  attainsCauses,
}: RestorationPlannerProps) {
  // ── Compute grade from waterData ──
  const grade: WaterQualityGrade = useMemo(() => {
    return calculateGrade(waterData ?? undefined, 'freshwater', {
      attainsCategory: attainsCategory || '',
      is303dListed: attainsCategory?.includes('5') ?? false,
      hasTmdl: attainsCategory ? !attainsCategory.includes('5') : undefined,
    });
  }, [waterData, attainsCategory]);

  // ── Compute restoration plan from waterData ──
  const restoration: RestorationResult = useMemo(() => {
    const params: Record<string, { value: number; lastSampled?: string | null; unit?: string }> = waterData ?? {};
    return computeRestorationPlan({
      regionName: regionName || regionId || 'Unknown',
      stateAbbr,
      alertLevel: (alertLevel || 'none') as any,
      params,
      attainsCategory: attainsCategory || '',
      attainsCauses: attainsCauses || [],
      attainsCycle: '',
      attainsAcres: null,
    });
  }, [waterData, regionName, regionId, stateAbbr, alertLevel, attainsCategory, attainsCauses]);

  // ── User constraint state ──
  const [target, setTarget] = useState<TargetOutcome>('fishable');
  const [timeline, setTimeline] = useState<TimelineCommitment>('10yr');
  const [budgetMin, setBudgetMin] = useState(100_000);
  const [budgetMax, setBudgetMax] = useState(5_000_000);
  const [landAvailable, setLandAvailable] = useState(true);
  const [permittingFeasible, setPermittingFeasible] = useState(true);
  const [politicalSupport, setPoliticalSupport] = useState(true);
  const [selectedPortfolio, setSelectedPortfolio] = useState<number>(0);
  const [generated, setGenerated] = useState(false);
  const [budgetExpanded, setBudgetExpanded] = useState(false);

  // ── Constraints ──
  const constraints: PlannerConstraints = useMemo(() => ({
    target, timeline, budgetMin, budgetMax,
    landAvailable, permittingFeasible, politicalSupport,
  }), [target, timeline, budgetMin, budgetMax, landAvailable, permittingFeasible, politicalSupport]);

  // ── Map waterType for portfolio engine ──
  const waterbodyType: WaterbodyCategory = restoration.waterType === 'brackish' ? 'estuary' : 'freshwater';

  // ── Generate portfolios ──
  const result: PortfolioResult | null = useMemo(() => {
    if (!generated) return null;
    return generatePortfolios(grade, restoration, waterData, waterbodyType, constraints);
  }, [generated, grade, restoration, waterData, waterbodyType, constraints]);

  // ── Project trajectories for each portfolio ──
  const TIMELINE_MONTHS: Record<TimelineCommitment, number> = {
    '1yr': 12, '5yr': 60, '10yr': 120, '25yr': 300,
  };

  const trajectories: Trajectory[] = useMemo(() => {
    if (!result) return [];
    const baseScore = grade.score ?? 50;
    const baselineParams: Partial<Record<string, number>> = {};
    if (waterData) {
      for (const [k, v] of Object.entries(waterData)) {
        baselineParams[k] = v.value;
      }
    }
    return result.portfolios.map(p =>
      projectTrajectory(p, baseScore, baselineParams as any, waterbodyType, TIMELINE_MONTHS[timeline])
    );
  }, [result, grade.score, waterData, waterbodyType, timeline]);

  // ── Grant eligibility ──
  const grants: GrantOpportunity[] = useMemo(() => getStateGrants(stateAbbr), [stateAbbr]);

  const handleGenerate = useCallback(() => {
    setGenerated(true);
    setSelectedPortfolio(0);
  }, []);

  // ── No data guard ──
  if (!regionId || !waterData || !grade.canBeGraded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-cyan-600" />
            Restoration Planner
          </CardTitle>
          <CardDescription>Path-to-Fix portfolio optimizer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-400">
            <Wrench className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium">Select a waterbody with monitoring data to begin planning</p>
            <p className="text-xs mt-1">The planner requires water quality grades and parameter data to generate restoration portfolios</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-cyan-600" />
          Restoration Planner
        </CardTitle>
        <CardDescription>
          Generate ranked intervention portfolios with cost breakdowns and projected water quality trajectories
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Input Panel ────────────────────────────────────────── */}
        <div className="space-y-4 bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700">Planning Parameters</h3>

          {/* Target Outcome */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Target Outcome</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.entries(TARGET_LABELS) as [TargetOutcome, { label: string; icon: typeof Target }][]).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() => { setTarget(key); setGenerated(false); }}
                  className={`px-3 py-2 text-xs rounded-md border transition-colors ${
                    target === key
                      ? 'bg-cyan-600 text-white border-cyan-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-cyan-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Timeline Commitment</label>
            <div className="flex gap-2">
              {(Object.entries(TIMELINE_LABELS) as [TimelineCommitment, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setTimeline(key); setGenerated(false); }}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    timeline === key
                      ? 'bg-cyan-600 text-white border-cyan-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-cyan-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Budget Range */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Budget Range</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                <input
                  type="number"
                  value={budgetMin}
                  onChange={e => { setBudgetMin(Number(e.target.value)); setGenerated(false); }}
                  className="w-full pl-5 pr-2 py-1.5 text-xs border rounded-md border-slate-200"
                  placeholder="Min"
                />
              </div>
              <span className="text-xs text-slate-400">to</span>
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                <input
                  type="number"
                  value={budgetMax}
                  onChange={e => { setBudgetMax(Number(e.target.value)); setGenerated(false); }}
                  className="w-full pl-5 pr-2 py-1.5 text-xs border rounded-md border-slate-200"
                  placeholder="Max"
                />
              </div>
            </div>
          </div>

          {/* Constraint Checkboxes */}
          <div className="flex flex-wrap gap-4">
            {[
              { label: 'Land available', checked: landAvailable, set: setLandAvailable },
              { label: 'Permitting feasible', checked: permittingFeasible, set: setPermittingFeasible },
              { label: 'Political support', checked: politicalSupport, set: setPoliticalSupport },
            ].map(({ label, checked, set }) => (
              <label key={label} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => { set(e.target.checked); setGenerated(false); }}
                  className="rounded border-slate-300"
                />
                {label}
              </label>
            ))}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            Generate Restoration Portfolios
          </button>
        </div>

        {/* ── Results ────────────────────────────────────────────── */}
        {result && result.portfolios.length > 0 && (
          <>
            {/* Portfolio Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {result.portfolios.map((portfolio, i) => {
                const Icon = STRATEGY_ICONS[portfolio.strategy] || Target;
                const isSelected = selectedPortfolio === i;
                return (
                  <button
                    key={portfolio.strategy}
                    onClick={() => setSelectedPortfolio(i)}
                    className={`text-left p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? STRATEGY_COLORS[portfolio.strategy] + ' ring-2 ring-cyan-400'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4 text-slate-600" />
                      <span className="text-sm font-semibold text-slate-800">{portfolio.label}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{portfolio.description}</p>

                    {/* Intervention List */}
                    <div className="space-y-1 mb-3">
                      {portfolio.allocations.map(a => (
                        <div key={a.interventionId} className="flex justify-between text-xs">
                          <span className="text-slate-600 truncate mr-2">{a.interventionName}</span>
                          <span className="text-slate-400 whitespace-nowrap">{fmt$(a.capitalCost.expected)}</span>
                        </div>
                      ))}
                      {portfolio.allocations.length === 0 && (
                        <p className="text-xs text-slate-400 italic">No interventions fit constraints</p>
                      )}
                    </div>

                    {/* Summary Stats */}
                    <div className="flex items-center justify-between text-xs border-t border-slate-200 pt-2">
                      <div>
                        <span className="text-slate-500">Cost: </span>
                        <span className="font-medium text-slate-700">{fmtRange$(portfolio.totalCapital)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Time: </span>
                        <span className="font-medium text-slate-700">{portfolio.monthsToTarget}mo</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <div>
                        <span className="text-slate-500">Score: </span>
                        <span className="font-medium text-slate-700">
                          {grade.score ?? '?'} → {portfolio.projectedScore}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Types: </span>
                        <span className="font-medium text-slate-700">{portfolio.interventionTypeCount}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Trajectory Chart (SVG) */}
            {trajectories.length > 0 && (
              <TrajectoryChart
                trajectories={trajectories}
                portfolios={result.portfolios}
                selectedIndex={selectedPortfolio}
                baselineScore={grade.score ?? 50}
                targetScore={80}
                timeline={timeline}
              />
            )}

            {/* Budget Breakdown Table */}
            {result.portfolios[selectedPortfolio]?.phases.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setBudgetExpanded(!budgetExpanded)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    Budget Breakdown
                  </span>
                  {budgetExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {budgetExpanded && (
                  <BudgetTable portfolio={result.portfolios[selectedPortfolio]} />
                )}
              </div>
            )}

            {/* Grant Eligibility */}
            {grants.length > 0 && (
              <div className="border rounded-lg p-3">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Potential Grant Matches ({stateAbbr})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {grants.slice(0, 6).map((g, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs p-2 rounded bg-slate-50">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        g.fit === 'high' ? 'bg-green-100 text-green-700'
                        : g.fit === 'medium' ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-slate-100 text-slate-600'
                      }`}>
                        {g.fit === 'high' ? 'High' : g.fit === 'medium' ? 'Good' : 'Review'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-700 truncate">{g.name}</p>
                        <p className="text-slate-400">{g.amount}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty result guard */}
        {result && result.portfolios.every(p => p.allocations.length === 0) && (
          <div className="text-center py-6 text-slate-400">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
            <p className="text-sm font-medium text-slate-600">No interventions fit current constraints</p>
            <p className="text-xs mt-1">Try increasing the budget, timeline, or enabling land/permitting options</p>
          </div>
        )}

        <p className="text-xs text-slate-400 italic">
          Data source: EPA ATTAINS, PEARL pilot data, literature efficacy ranges. Projections are modeled estimates — site-specific assessment recommended.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Trajectory SVG Chart ───────────────────────────────────────────────────

function TrajectoryChart({
  trajectories,
  portfolios,
  selectedIndex,
  baselineScore,
  targetScore,
  timeline,
}: {
  trajectories: Trajectory[];
  portfolios: Portfolio[];
  selectedIndex: number;
  baselineScore: number;
  targetScore: number;
  timeline: TimelineCommitment;
}) {
  const W = 800;
  const H = 400;
  const PAD = { top: 30, right: 20, bottom: 40, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxMonths = trajectories.length > 0
    ? Math.max(...trajectories.map(t => t.points.length - 1))
    : 12;

  const xScale = (month: number) => PAD.left + (month / maxMonths) * plotW;
  const yScale = (score: number) => PAD.top + plotH - ((score / 100) * plotH);

  // Y-axis ticks
  const yTicks = [0, 20, 40, 60, 80, 100];

  // X-axis ticks (roughly every 12 months)
  const xTicks: number[] = [];
  for (let m = 0; m <= maxMonths; m += Math.max(1, Math.floor(maxMonths / 6))) {
    xTicks.push(m);
  }
  if (!xTicks.includes(maxMonths)) xTicks.push(maxMonths);

  return (
    <div className="border rounded-lg p-3">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
        <TrendingUp className="h-4 w-4 text-cyan-600" />
        Projected Water Quality Trajectory
      </h3>
      <div className="w-full aspect-[2/1]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {yTicks.map(tick => (
            <line
              key={`grid-${tick}`}
              x1={PAD.left} y1={yScale(tick)}
              x2={W - PAD.right} y2={yScale(tick)}
              stroke="#e2e8f0" strokeWidth={1}
            />
          ))}

          {/* Baseline reference */}
          <line
            x1={PAD.left} y1={yScale(baselineScore)}
            x2={W - PAD.right} y2={yScale(baselineScore)}
            stroke="#94a3b8" strokeWidth={1} strokeDasharray="6,4"
          />
          <text x={W - PAD.right + 4} y={yScale(baselineScore) + 4} fontSize={10} fill="#94a3b8">
            Baseline
          </text>

          {/* Target reference */}
          <line
            x1={PAD.left} y1={yScale(targetScore)}
            x2={W - PAD.right} y2={yScale(targetScore)}
            stroke="#16a34a" strokeWidth={1.5} strokeDasharray="4,3"
          />
          <text x={W - PAD.right + 4} y={yScale(targetScore) + 4} fontSize={10} fill="#16a34a">
            Target
          </text>

          {/* Confidence band for selected portfolio */}
          {trajectories[selectedIndex] && (() => {
            const pts = trajectories[selectedIndex].points;
            const upper = pts.map(p => `${xScale(p.month)},${yScale(p.projectedScore.max)}`).join(' ');
            const lower = pts.map(p => `${xScale(p.month)},${yScale(p.projectedScore.min)}`).reverse().join(' ');
            const color = STRATEGY_LINE_COLORS[portfolios[selectedIndex]?.strategy] || '#2563eb';
            return (
              <polygon
                points={`${upper} ${lower}`}
                fill={color}
                fillOpacity={0.1}
                stroke="none"
              />
            );
          })()}

          {/* Portfolio lines */}
          {trajectories.map((traj, i) => {
            const isSelected = i === selectedIndex;
            const color = STRATEGY_LINE_COLORS[portfolios[i]?.strategy] || '#64748b';
            const pts = traj.points;
            const d = pts.map((p, j) =>
              `${j === 0 ? 'M' : 'L'} ${xScale(p.month)} ${yScale(p.projectedScore.expected)}`
            ).join(' ');
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={isSelected ? 3 : 1.5}
                strokeOpacity={isSelected ? 1 : 0.35}
              />
            );
          })}

          {/* Milestone markers for selected */}
          {trajectories[selectedIndex]?.points.map(point =>
            point.milestones.map((ms, j) => (
              <g key={`ms-${point.month}-${j}`}>
                <line
                  x1={xScale(point.month)} y1={PAD.top}
                  x2={xScale(point.month)} y2={H - PAD.bottom}
                  stroke="#cbd5e1" strokeWidth={1} strokeDasharray="2,3"
                />
                <text
                  x={xScale(point.month) + 3}
                  y={PAD.top + 10 + j * 12}
                  fontSize={8} fill="#64748b"
                  className="pointer-events-none"
                >
                  {ms.label.length > 30 ? ms.label.slice(0, 28) + '...' : ms.label}
                </text>
              </g>
            ))
          )}

          {/* Y-axis labels */}
          {yTicks.map(tick => (
            <text
              key={`ylabel-${tick}`}
              x={PAD.left - 8} y={yScale(tick) + 4}
              fontSize={10} fill="#64748b" textAnchor="end"
            >
              {tick}
            </text>
          ))}

          {/* X-axis labels */}
          {xTicks.map(tick => (
            <text
              key={`xlabel-${tick}`}
              x={xScale(tick)} y={H - PAD.bottom + 16}
              fontSize={10} fill="#64748b" textAnchor="middle"
            >
              {tick}mo
            </text>
          ))}

          {/* Axis labels */}
          <text x={PAD.left - 35} y={H / 2} fontSize={11} fill="#64748b" textAnchor="middle" transform={`rotate(-90 ${PAD.left - 35} ${H / 2})`}>
            WQ Score
          </text>
          <text x={W / 2} y={H - 4} fontSize={11} fill="#64748b" textAnchor="middle">
            Months
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 justify-center">
        {portfolios.map((p, i) => {
          const color = STRATEGY_LINE_COLORS[p.strategy] || '#64748b';
          return (
            <button
              key={p.strategy}
              onClick={() => {/* parent handles selection via portfolio cards */}}
              className={`flex items-center gap-1.5 text-xs ${i === selectedIndex ? 'font-semibold' : 'text-slate-400'}`}
            >
              <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Budget Breakdown Table ─────────────────────────────────────────────────

function BudgetTable({ portfolio }: { portfolio: Portfolio }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 text-slate-600">
            <th className="px-3 py-2 text-left font-medium">Intervention</th>
            <th className="px-3 py-2 text-right font-medium">Qty</th>
            <th className="px-3 py-2 text-right font-medium">Capital</th>
            <th className="px-3 py-2 text-right font-medium">Annual O&M</th>
            <th className="px-3 py-2 text-right font-medium">Ramp (mo)</th>
          </tr>
        </thead>
        <tbody>
          {portfolio.phases.map(phase => (
            <>
              <tr key={`phase-${phase.phase}`} className="bg-slate-100">
                <td colSpan={5} className="px-3 py-1.5 font-semibold text-slate-700">
                  {phase.label}
                  <span className="ml-2 font-normal text-slate-400">
                    Subtotal: {fmtRange$(phase.phaseCost)}
                  </span>
                </td>
              </tr>
              {phase.allocations.map(a => (
                <tr key={`${phase.phase}-${a.interventionId}`} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 text-slate-700">{a.interventionName}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{a.quantity} {a.unitLabel}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{fmtRange$(a.capitalCost)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{fmtRange$(a.annualOM)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-400">{a.monthsToFull}</td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
            <td className="px-3 py-2 text-slate-700">Total</td>
            <td className="px-3 py-2 text-right text-slate-600">{portfolio.allocations.length}</td>
            <td className="px-3 py-2 text-right text-slate-700">{fmtRange$(portfolio.totalCapital)}</td>
            <td className="px-3 py-2 text-right text-slate-700">{fmtRange$(portfolio.totalAnnualOM)}</td>
            <td className="px-3 py-2 text-right text-slate-400">{portfolio.monthsToTarget}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
