'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Wrench, Target, Clock, DollarSign, TrendingUp, CheckCircle2,
  ChevronDown, ChevronUp, Shield, Zap, Leaf, AlertTriangle,
  Droplets, Activity, Users, Heart,
} from 'lucide-react';
import { calculateGrade, type WaterQualityGrade } from '@/lib/waterQualityScore';
import {
  MODULES, MODULE_CATS, CAT_COLORS, NGOS, EVENTS, GRANTS,
  CK, CONTAMINANT_LABELS, CONTAMINANT_COLORS,
  OPEX_TEAM_YEAR, ALIA_PER_TEAM,
  runCalc, fmt,
  type Watershed, type TreatmentModule, type ModuleCategory,
  type ContaminantKey, type CalcResult, type NGO, type CommunityEvent,
} from '@/components/treatment/treatmentData';
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

// ─── Constants ──────────────────────────────────────────────────────────────

type TargetOutcome = 'fishable' | 'swimmable' | 'healthy' | 'shellfish_safe';
type TimelineYears = 2 | 5 | 10 | 15;

const TARGET_LABELS: Record<TargetOutcome, string> = {
  fishable: 'Fishable', swimmable: 'Swimmable',
  healthy: 'Healthy Ecosystem', shellfish_safe: 'Shellfish Safe',
};

const TARGET_PCT: Record<TargetOutcome, number> = {
  fishable: 50, swimmable: 65, healthy: 80, shellfish_safe: 75,
};

const TIMELINE_OPTIONS: TimelineYears[] = [2, 5, 10, 15];

const THRESHOLDS: Record<string, { key: ContaminantKey; threshold: number; inverse?: boolean }> = {
  TN:           { key: 'nit',   threshold: 1.0 },
  TP:           { key: 'pho',   threshold: 0.1 },
  TSS:          { key: 'tss',   threshold: 25 },
  Turbidity:    { key: 'tss',   threshold: 10 },
  Ecoli:        { key: 'bac',   threshold: 126 },
  Enterococcus: { key: 'bac',   threshold: 35 },
  DO:           { key: 'tss',   threshold: 5.0, inverse: true },
  PFAS:         { key: 'pfas',  threshold: 70 },
};

const DEFAULT_MODULES = new Set(['sensors', 'alia_50', 'riparian']);

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Derive baseline contaminant % from waterData parameters */
function deriveBaseline(
  waterData: Record<string, { value: number }> | null,
): Record<ContaminantKey, number> {
  const base: Record<ContaminantKey, number> = { tss: 15, bac: 10, nit: 20, pho: 18, pfas: 8, trash: 5 };
  if (!waterData) return base;

  for (const [param, { value }] of Object.entries(waterData)) {
    const mapping = THRESHOLDS[param];
    if (!mapping || value == null) continue;
    const { key, threshold, inverse } = mapping;
    if (inverse) {
      // DO: lower = worse → higher impairment
      base[key] = Math.max(base[key], clamp(Math.round((1 - Math.min(value, 10) / 10) * 100), 5, 95));
    } else {
      base[key] = Math.max(base[key], clamp(Math.round((value / threshold) * 42), 5, 95));
    }
  }
  return base;
}

/** Build a virtual Watershed object from props for runCalc */
function buildVirtualWatershed(
  id: string,
  name: string,
  stateAbbr: string,
  baseline: Record<ContaminantKey, number>,
  doMgL: number,
): Watershed {
  return {
    id, state: stateAbbr, name, huc: '', acres: 2000, flowMGD: 100,
    salinity: 0, doMgL, baseline, causes: [], context: '',
    treatable: 70, aquaculture: [],
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function RestorationPlanner({
  regionId, regionName, stateAbbr, waterData, alertLevel, attainsCategory, attainsCauses,
}: RestorationPlannerProps) {
  // ── Module selection state ──
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set(DEFAULT_MODULES));
  const [unitCounts, setUnitCounts] = useState<Record<string, number>>({});
  const [selectedNGOs, setSelectedNGOs] = useState<Set<string>>(new Set());
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());

  // ── UI state ──
  const [activeTab, setActiveTab] = useState<'modules' | 'partners' | 'events'>('modules');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(MODULE_CATS));
  const [target, setTarget] = useState<TargetOutcome>('fishable');
  const [timelineYrs, setTimelineYrs] = useState<TimelineYears>(5);
  const [generated, setGenerated] = useState(false);
  const [budgetExpanded, setBudgetExpanded] = useState(false);

  // ── Grade ──
  const grade: WaterQualityGrade = useMemo(() => {
    try {
      return calculateGrade(waterData ?? undefined, 'freshwater', {
        attainsCategory: attainsCategory || '',
        is303dListed: attainsCategory?.includes('5') ?? false,
        hasTmdl: attainsCategory ? !attainsCategory.includes('5') : undefined,
      });
    } catch {
      return { canBeGraded: false, score: 0, letter: 'F', label: 'Error', reason: '', color: '', bgColor: '', borderColor: '', parameterScores: [], coverage: {} as any, avgFreshnessWeight: 0, regulatoryPenalty: 0, gradedParamCount: 0, gradedParamTotal: 0, isPartialGrade: false, gradeSource: 'none' as const };
    }
  }, [waterData, attainsCategory]);

  // ── Baseline derivation ──
  const baseline = useMemo(() => deriveBaseline(waterData), [waterData]);
  const doMgL = waterData?.DO?.value ?? 5.5;

  // ── Virtual watershed ──
  const virtualWs = useMemo(() =>
    buildVirtualWatershed(regionId || 'unknown', regionName || 'Unknown', stateAbbr, baseline, doMgL),
    [regionId, regionName, stateAbbr, baseline, doMgL],
  );

  // ── Live calculation ──
  const targetPct = TARGET_PCT[target];
  const calc: CalcResult | null = useMemo(() => {
    if (selectedModules.size === 0) return null;
    return runCalc(virtualWs, selectedModules, unitCounts, timelineYrs, targetPct);
  }, [virtualWs, selectedModules, unitCounts, timelineYrs, targetPct]);

  // ── NGO + community costs ──
  const ngoValue = useMemo(() =>
    NGOS.filter(n => selectedNGOs.has(n.id)).reduce((s, n) => s + n.value, 0),
    [selectedNGOs],
  );
  const eventCostYr = useMemo(() =>
    EVENTS.filter(e => selectedEvents.has(e.id)).reduce((s, e) => s + e.cost, 0),
    [selectedEvents],
  );

  // ── State grants ──
  const stateGrantsList: GrantOpportunity[] = useMemo(() => getStateGrants(stateAbbr), [stateAbbr]);

  // ── Trajectory points ──
  const trajectoryPoints = useMemo(() => {
    if (!calc || !generated) return [];
    const maxMonths = timelineYrs * 12;
    const baseScore = grade.score ?? 50;
    const improvementPotential = calc.avg / 100 * (100 - baseScore) * 0.8;

    // Weighted average ramp based on module deployment times
    const activeModules = calc.active;
    const totalCost = activeModules.reduce((s, m) => s + m.totalCost, 0);

    const points: { month: number; score: number; min: number; max: number }[] = [];
    for (let mo = 0; mo <= maxMonths; mo += Math.max(1, Math.floor(maxMonths / 60))) {
      let ramp = 0;
      if (totalCost > 0) {
        for (const m of activeModules) {
          const moduleRamp = m.mo > 0 ? Math.min(1, mo / m.mo) : 1;
          ramp += (m.totalCost / totalCost) * moduleRamp;
        }
      }
      const projected = baseScore + improvementPotential * ramp;
      points.push({
        month: mo,
        score: Math.min(100, projected),
        min: Math.min(100, projected * 0.85),
        max: Math.min(100, projected * 1.12),
      });
    }
    return points;
  }, [calc, generated, timelineYrs, grade.score]);

  // ── Handlers ──
  const toggleModule = useCallback((id: string) => {
    setSelectedModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setGenerated(false);
  }, []);

  const setUnits = useCallback((id: string, v: number) => {
    setUnitCounts(prev => ({ ...prev, [id]: Math.max(1, v) }));
    setGenerated(false);
  }, []);

  const toggleNGO = useCallback((id: string) => {
    setSelectedNGOs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleEvent = useCallback((id: string) => {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleCat = useCallback((cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
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
          <CardDescription>Interactive treatment module selection & impact modeling</CardDescription>
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

  // Module counts per category
  const catCounts: Record<string, number> = {};
  for (const cat of MODULE_CATS) {
    catCounts[cat] = MODULES.filter(m => m.cat === cat && selectedModules.has(m.id)).length;
  }

  const totalLifecycle = (calc?.lifecycle ?? 0) + eventCostYr * timelineYrs;
  const totalGrants = (calc?.grantTotal ?? 0) + ngoValue;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-cyan-600" />
          Restoration Planner
        </CardTitle>
        <CardDescription>
          Configure treatment modules, project water quality improvements, and estimate costs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── Waterbody Summary Bar ── */}
        <div className="flex items-center gap-3 flex-wrap bg-slate-50 rounded-lg px-4 py-2.5 border border-slate-200">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-800 truncate">{regionName || regionId}</div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[10px] font-mono text-slate-400">{stateAbbr}</span>
              {attainsCategory && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  attainsCategory.includes('5') ? 'bg-red-100 text-red-700'
                  : attainsCategory.includes('4') ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
                }`}>
                  Cat {attainsCategory}
                </span>
              )}
              {(attainsCauses ?? []).slice(0, 3).map(c => (
                <span key={c} className="text-[9px] px-1 py-0.5 rounded bg-red-50 text-red-600">{c}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center">
              <div className={`text-lg font-bold font-mono ${
                (grade.score ?? 0) >= 70 ? 'text-green-600' : (grade.score ?? 0) >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>{grade.letter}</div>
              <div className="text-[9px] text-slate-400">Grade</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold font-mono text-slate-700">{grade.score ?? '—'}</div>
              <div className="text-[9px] text-slate-400">Score</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold font-mono text-cyan-700">{doMgL.toFixed(1)}</div>
              <div className="text-[9px] text-slate-400">DO mg/L</div>
            </div>
          </div>
        </div>

        {/* ── Two-column: Module Selection + Live Preview ── */}
        <div className="flex gap-4 flex-col lg:flex-row">
          {/* LEFT: Module Selection */}
          <div className="flex-1 min-w-0 border rounded-lg overflow-hidden">
            {/* Tab Bar */}
            <div className="flex border-b border-slate-200 bg-slate-50">
              {([
                { id: 'modules' as const, label: 'Treatment Modules', count: selectedModules.size },
                { id: 'partners' as const, label: 'Partners', count: selectedNGOs.size },
                { id: 'events' as const, label: 'Community', count: selectedEvents.size },
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-cyan-700 border-b-2 border-cyan-600 bg-white'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-1 text-[9px] bg-cyan-100 text-cyan-700 px-1 rounded-full">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Module List */}
            <div className="max-h-[420px] overflow-y-auto">
              {activeTab === 'modules' && MODULE_CATS.map(cat => {
                const catModules = MODULES.filter(m => m.cat === cat);
                const isExpanded = expandedCats.has(cat);
                const count = catCounts[cat] || 0;
                return (
                  <div key={cat}>
                    <button
                      onClick={() => toggleCat(cat)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors sticky top-0 z-10"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CAT_COLORS[cat] }} />
                        <span className="text-[11px] font-semibold text-slate-700">{cat}</span>
                        {count > 0 && (
                          <span className="text-[9px] px-1.5 rounded-full font-bold text-white" style={{ background: CAT_COLORS[cat] }}>
                            {count}
                          </span>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="h-3 w-3 text-slate-400" /> : <ChevronDown className="h-3 w-3 text-slate-400" />}
                    </button>
                    {isExpanded && catModules.map(m => (
                      <ModRow
                        key={m.id}
                        m={m}
                        checked={selectedModules.has(m.id)}
                        onToggle={toggleModule}
                        units={unitCounts[m.id] ?? m.defUnits}
                        onUnits={setUnits}
                      />
                    ))}
                  </div>
                );
              })}

              {activeTab === 'partners' && (
                <div>
                  <div className="px-3 py-2 bg-green-50 border-b text-[10px] text-green-700 font-medium">
                    Partnership In-Kind Value: {fmt$(ngoValue)}
                  </div>
                  {NGOS.map(n => (
                    <NgoRow key={n.id} n={n} checked={selectedNGOs.has(n.id)} onToggle={toggleNGO} />
                  ))}
                </div>
              )}

              {activeTab === 'events' && (
                <div>
                  <div className="px-3 py-2 bg-amber-50 border-b text-[10px] text-amber-700 font-medium">
                    Community Programs: {fmt$(eventCostYr)}/yr
                  </div>
                  {EVENTS.map(ev => (
                    <EventRow key={ev.id} ev={ev} checked={selectedEvents.has(ev.id)} onToggle={toggleEvent} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Live Impact Preview */}
          <div className="w-full lg:w-[280px] shrink-0 space-y-3">
            {/* Contaminant Bars */}
            <div className="border rounded-lg p-3">
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Contaminant Reduction
              </h4>
              {CK.map(k => (
                <ContaminantBar
                  key={k}
                  colorKey={k}
                  base={baseline[k]}
                  result={calc?.ach[k]}
                />
              ))}
            </div>

            {/* Performance Metrics */}
            <div className="border rounded-lg p-3">
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Performance
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <MetricBox label="Avg Reduction" value={calc ? `${calc.avg.toFixed(0)}%` : '—'} color={
                  calc && calc.avg >= targetPct ? 'text-green-600' : 'text-slate-700'
                } />
                <MetricBox label="Projected DO" value={calc ? `${calc.projDO.toFixed(1)} mg/L` : '—'} color={
                  calc && calc.projDO >= 5.0 ? 'text-green-600' : 'text-amber-600'
                } />
                <MetricBox label="GPM Deployed" value={calc ? calc.totGPM.toLocaleString() : '—'} color="text-blue-600" />
                <MetricBox label="Target" value={calc?.met ? 'Met' : 'Below'} color={
                  calc?.met ? 'text-green-600' : 'text-amber-600'
                } icon={calc?.met ? CheckCircle2 : AlertTriangle} />
              </div>
            </div>

            {/* Cost Summary */}
            <div className="border rounded-lg p-3 bg-slate-50">
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Cost Summary
              </h4>
              <div className="space-y-1">
                <LedgerLine label="CapEx" value={calc ? fmt$(calc.capex) : '—'} />
                {calc && calc.teams > 0 && (
                  <LedgerLine label="OpEx" value={`${fmt$(calc.annualOpex)}/yr`} sub={`${calc.teams} team${calc.teams > 1 ? 's' : ''}`} />
                )}
                {eventCostYr > 0 && (
                  <LedgerLine label="Community" value={`${fmt$(eventCostYr)}/yr`} color="#e65100" />
                )}
                <LedgerLine label={`Lifecycle (${timelineYrs}yr)`} value={fmt$(totalLifecycle)} bold />
                {totalGrants > 0 && (
                  <LedgerLine label="Grants / In-Kind" value={`-${fmt$(totalGrants)}`} color="#16a34a" />
                )}
                {totalGrants > 0 && (
                  <LedgerLine label="Net Cost" value={fmt$(Math.max(0, totalLifecycle - totalGrants))} bold color="#0e7490" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Planning Controls ── */}
        <div className="space-y-3 bg-slate-50 rounded-lg p-4 border border-slate-200">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Target Outcome */}
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Target Outcome</label>
              <div className="flex gap-1.5 flex-wrap">
                {(Object.entries(TARGET_LABELS) as [TargetOutcome, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setTarget(key); setGenerated(false); }}
                    className={`px-2.5 py-1.5 text-[11px] rounded-md border transition-colors ${
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
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Timeline</label>
              <div className="flex gap-1.5">
                {TIMELINE_OPTIONS.map(yr => (
                  <button
                    key={yr}
                    onClick={() => { setTimelineYrs(yr); setGenerated(false); }}
                    className={`px-2.5 py-1.5 text-[11px] rounded-md border transition-colors ${
                      timelineYrs === yr
                        ? 'bg-cyan-600 text-white border-cyan-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-cyan-300'
                    }`}
                  >
                    {yr}yr
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={() => setGenerated(true)}
            disabled={selectedModules.size === 0}
            className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-md transition-colors"
          >
            Generate Restoration Plan
          </button>
        </div>

        {/* ── Results ── */}
        {generated && calc && (
          <>
            {/* Analysis Summary */}
            <AnalysisSummary
              regionName={regionName || regionId || 'this waterbody'}
              grade={grade}
              calc={calc}
              baseline={baseline}
              targetPct={targetPct}
              target={target}
              timelineYrs={timelineYrs}
              attainsCategory={attainsCategory}
              attainsCauses={attainsCauses}
            />

            {/* Trajectory Chart */}
            {trajectoryPoints.length > 0 && (
              <TrajectoryChart
                points={trajectoryPoints}
                baselineScore={grade.score ?? 50}
                targetScore={targetPct + 20}
              />
            )}

            {/* Scenario Outcome */}
            <ScenarioOutcome
              calc={calc}
              baseline={baseline}
              grade={grade}
              targetPct={targetPct}
              target={target}
              timelineYrs={timelineYrs}
              regionName={regionName || regionId || 'this waterbody'}
            />

            {/* Budget Breakdown */}
            {calc.active.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setBudgetExpanded(!budgetExpanded)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    Budget Breakdown ({calc.active.length} modules)
                  </span>
                  {budgetExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {budgetExpanded && <BudgetTable calc={calc} timelineYrs={timelineYrs} />}
              </div>
            )}

            {/* Grant Matches */}
            {(calc.grants.length > 0 || stateGrantsList.length > 0) && (
              <div className="border rounded-lg p-3">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Grant Eligibility
                </h3>
                {calc.grants.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {calc.grants.map(g => (
                      <div key={g.id} className="flex items-center justify-between text-xs bg-green-50 px-3 py-2 rounded">
                        <div>
                          <span className="font-medium text-slate-700">{g.name}</span>
                          <span className="text-slate-400 ml-2">{Math.round(g.match * 100)}% match</span>
                        </div>
                        <span className="font-mono font-semibold text-green-700">-{fmt$(g.savings)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-semibold pt-1 border-t border-green-200">
                      <span className="text-slate-600">Total Grant Potential</span>
                      <span className="text-green-700 font-mono">{fmt$(calc.grantTotal)}</span>
                    </div>
                  </div>
                )}
                {stateGrantsList.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-400 mb-1.5">Additional {stateAbbr} grant programs:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {stateGrantsList.slice(0, 6).map((g, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs p-2 rounded bg-slate-50">
                          <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                            g.fit === 'high' ? 'bg-green-100 text-green-700'
                            : g.fit === 'medium' ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-slate-100 text-slate-500'
                          }`}>{g.fit === 'high' ? 'High' : g.fit === 'medium' ? 'Good' : 'Low'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-600 truncate">{g.name}</p>
                            <p className="text-slate-400 text-[10px]">{g.amount}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Closing Summary */}
            <ClosingSummary
              calc={calc}
              grade={grade}
              target={target}
              timelineYrs={timelineYrs}
              totalLifecycle={totalLifecycle}
              totalGrants={totalGrants}
              ngoCount={selectedNGOs.size}
              eventCount={selectedEvents.size}
              regionName={regionName || regionId || 'this waterbody'}
              stateAbbr={stateAbbr}
              stateGrantCount={stateGrantsList.filter(g => g.fit === 'high').length}
            />
          </>
        )}

        {/* Empty result guard */}
        {generated && calc && calc.active.length === 0 && (
          <div className="text-center py-6 text-slate-400">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
            <p className="text-sm font-medium text-slate-600">No treatment modules selected</p>
            <p className="text-xs mt-1">Select modules from the panel above to generate a restoration plan</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

// ─── Contaminant Bar ─────────────────────────────────────────────────────────

function ContaminantBar({ base, result, colorKey }: { base: number; result?: number; colorKey: ContaminantKey }) {
  const remaining = result != null ? Math.max(0, base - (base * result / 100)) : base;
  const color = CONTAMINANT_COLORS[colorKey];
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <div className="w-[58px] text-[9px] text-slate-400 font-mono truncate">
        {CONTAMINANT_LABELS[colorKey]?.split(' / ')[0]}
      </div>
      <div className="flex-1 h-[5px] bg-slate-100 rounded-sm overflow-hidden relative">
        <div
          className="absolute left-0 top-0 h-full rounded-sm opacity-[0.18]"
          style={{ width: `${base}%`, background: color }}
        />
        {result != null && (
          <div
            className="absolute left-0 top-0 h-full rounded-sm opacity-80 transition-[width] duration-300"
            style={{ width: `${remaining}%`, background: color }}
          />
        )}
      </div>
      <div className="w-[55px] text-[9px] font-mono text-right text-slate-600">
        {base}%{result != null ? ` \u2192 ${remaining.toFixed(0)}%` : ''}
      </div>
    </div>
  );
}

// ─── Metric Box ─────────────────────────────────────────────────────────────

function MetricBox({ label, value, color, icon: Icon }: {
  label: string; value: string; color: string; icon?: typeof CheckCircle2;
}) {
  return (
    <div className="bg-white rounded border border-slate-100 p-2 text-center">
      <div className={`text-sm font-bold font-mono ${color} flex items-center justify-center gap-1`}>
        {Icon && <Icon className="h-3 w-3" />}
        {value}
      </div>
      <div className="text-[9px] text-slate-400">{label}</div>
    </div>
  );
}

// ─── Ledger Line ─────────────────────────────────────────────────────────────

function LedgerLine({ label, value, sub, color, bold }: {
  label: string; value: string; sub?: string; color?: string; bold?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline py-0.5">
      <div>
        <span className="text-[10px] text-slate-500">{label}</span>
        {sub && <span className="text-[8px] text-slate-300 ml-1">{sub}</span>}
      </div>
      <span className={`font-mono text-[11px] ${bold ? 'font-bold' : 'font-medium'}`} style={{ color: color || '#334155' }}>
        {value}
      </span>
    </div>
  );
}

// ─── Module Row ─────────────────────────────────────────────────────────────

function ModRow({ m, checked, onToggle, units, onUnits }: {
  m: TreatmentModule; checked: boolean; onToggle: (id: string) => void;
  units: number; onUnits: (id: string, v: number) => void;
}) {
  const cost = units * m.costPer;
  const catColor = CAT_COLORS[m.cat];
  return (
    <div
      onClick={() => onToggle(m.id)}
      className={`flex items-start gap-2 px-3 py-2 border-b border-slate-100 cursor-pointer transition-colors ${
        checked ? 'bg-blue-50/60' : 'hover:bg-slate-50'
      }`}
      style={{ borderLeft: `3px solid ${checked ? catColor : 'transparent'}` }}
    >
      <div
        className="w-3.5 h-3.5 rounded shrink-0 mt-0.5 flex items-center justify-center"
        style={{ border: checked ? 'none' : '1.5px solid #c8d4e0', background: checked ? catColor : 'white' }}
      >
        {checked && (
          <svg width="9" height="7" viewBox="0 0 10 8">
            <path d="M1 3.5L4 6.5L9 1" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[11px]">{m.icon}</span>
          <span className={`text-[10px] font-semibold ${checked ? 'text-slate-800' : 'text-slate-500'}`}>
            {m.name.trim()}
          </span>
          {!m.isBMP && <span className="text-[7px] bg-red-50 text-red-700 px-1 rounded font-bold">PILOT</span>}
          {m.trl != null && <span className="text-[7px] bg-purple-50 text-purple-700 px-1 rounded">TRL {m.trl}</span>}
          {m.hasOpex && <span className="text-[7px] bg-orange-50 text-orange-700 px-1 rounded font-bold">OPEX</span>}
          {m.isAddon && <span className="text-[7px] bg-green-50 text-green-800 px-1 rounded">ADD-ON</span>}
        </div>
        {(m.desc || m.pilotNote) && (
          <div className="text-[8px] text-slate-400 mt-0.5 leading-snug">{m.desc || m.pilotNote}</div>
        )}
        <div className="flex gap-0.5 mt-0.5 flex-wrap">
          {CK.map(k => m[k] > 0 && (
            <span key={k} className="text-[7px] px-1 rounded font-mono"
              style={{
                background: m[k] > 60 ? CONTAMINANT_COLORS[k] + '22' : '#f0f3f7',
                color: m[k] > 60 ? CONTAMINANT_COLORS[k] : '#8a9bb0',
              }}
            >
              {k.toUpperCase()} {m[k]}%
            </span>
          ))}
          {m.gpm > 0 && (
            <span className="text-[7px] px-1 rounded font-mono bg-blue-50 text-blue-700">
              {(m.gpm * units).toLocaleString()} GPM
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0" onClick={e => e.stopPropagation()}>
        <span className={`font-mono text-[10px] font-medium ${checked ? 'text-slate-800' : 'text-slate-300'}`}>
          {checked ? fmt(cost) : '\u2014'}
        </span>
        {checked && (
          <div className="flex items-center gap-0.5">
            <button onClick={() => onUnits(m.id, units - 1)}
              className="w-[16px] h-[16px] rounded border border-slate-200 bg-slate-50 text-[10px] flex items-center justify-center text-slate-500 hover:bg-slate-100">&minus;</button>
            <span className="text-[10px] font-mono text-slate-800 min-w-[14px] text-center">{units}</span>
            <button onClick={() => onUnits(m.id, units + 1)}
              className="w-[16px] h-[16px] rounded border border-slate-200 bg-slate-50 text-[10px] flex items-center justify-center text-slate-500 hover:bg-slate-100">+</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── NGO Row ─────────────────────────────────────────────────────────────────

function NgoRow({ n, checked, onToggle }: { n: NGO; checked: boolean; onToggle: (id: string) => void }) {
  return (
    <div
      onClick={() => onToggle(n.id)}
      className={`flex items-start gap-2 px-3 py-2 border-b border-slate-100 cursor-pointer transition-colors ${
        checked ? 'bg-green-50/60' : 'hover:bg-slate-50'
      }`}
      style={{ borderLeft: `3px solid ${checked ? '#2e7d32' : 'transparent'}` }}
    >
      <div className="w-3.5 h-3.5 rounded shrink-0 mt-0.5 flex items-center justify-center"
        style={{ border: checked ? 'none' : '1.5px solid #c8d4e0', background: checked ? '#2e7d32' : 'white' }}>
        {checked && <svg width="9" height="7" viewBox="0 0 10 8"><path d="M1 3.5L4 6.5L9 1" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[11px]">{n.icon}</span>
          <span className={`text-[10px] font-semibold ${checked ? 'text-slate-800' : 'text-slate-500'}`}>{n.name}</span>
          {n.grant && <span className="text-[7px] bg-green-50 text-green-800 px-1 rounded font-bold">GRANT</span>}
        </div>
        <div className="text-[8px] text-slate-400 mt-0.5">{n.type} &mdash; {n.desc}</div>
      </div>
      <span className={`font-mono text-[9px] font-medium shrink-0 ${checked ? 'text-green-700' : 'text-slate-300'}`}>
        {checked ? '+' + fmt(n.value) : '\u2014'}
      </span>
    </div>
  );
}

// ─── Event Row ───────────────────────────────────────────────────────────────

function EventRow({ ev, checked, onToggle }: { ev: CommunityEvent; checked: boolean; onToggle: (id: string) => void }) {
  return (
    <div
      onClick={() => onToggle(ev.id)}
      className={`flex items-start gap-2 px-3 py-2 border-b border-slate-100 cursor-pointer transition-colors ${
        checked ? 'bg-amber-50/60' : 'hover:bg-slate-50'
      }`}
      style={{ borderLeft: `3px solid ${checked ? '#e65100' : 'transparent'}` }}
    >
      <div className="w-3.5 h-3.5 rounded shrink-0 mt-0.5 flex items-center justify-center"
        style={{ border: checked ? 'none' : '1.5px solid #c8d4e0', background: checked ? '#e65100' : 'white' }}>
        {checked && <svg width="9" height="7" viewBox="0 0 10 8"><path d="M1 3.5L4 6.5L9 1" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[11px]">{ev.icon}</span>
          <span className={`text-[10px] font-semibold ${checked ? 'text-slate-800' : 'text-slate-500'}`}>{ev.name}</span>
          <span className="text-[7px] bg-orange-50 text-orange-700 px-1 rounded">{ev.freq}</span>
          <span className="text-[7px] bg-slate-100 text-slate-500 px-1 rounded">{ev.cat}</span>
        </div>
        <div className="text-[8px] text-slate-400 mt-0.5">{ev.desc}</div>
      </div>
      <span className={`font-mono text-[9px] font-medium shrink-0 ${checked ? 'text-orange-700' : 'text-slate-300'}`}>
        {checked ? fmt(ev.cost) + '/yr' : '\u2014'}
      </span>
    </div>
  );
}

// ─── Trajectory Chart ────────────────────────────────────────────────────────

function TrajectoryChart({ points, baselineScore, targetScore }: {
  points: { month: number; score: number; min: number; max: number }[];
  baselineScore: number; targetScore: number;
}) {
  const W = 760, H = 320;
  const PAD = { top: 25, right: 60, bottom: 35, left: 45 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const maxMonth = points[points.length - 1]?.month ?? 60;
  const x = (mo: number) => PAD.left + (mo / maxMonth) * plotW;
  const y = (s: number) => PAD.top + plotH - (s / 100) * plotH;
  const yTicks = [0, 20, 40, 60, 80, 100];
  const xTicks: number[] = [];
  for (let m = 0; m <= maxMonth; m += Math.max(1, Math.floor(maxMonth / 6))) xTicks.push(m);
  if (!xTicks.includes(maxMonth)) xTicks.push(maxMonth);

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.month)} ${y(p.score)}`).join(' ');
  const bandUpper = points.map(p => `${x(p.month)},${y(p.max)}`).join(' ');
  const bandLower = points.map(p => `${x(p.month)},${y(p.min)}`).reverse().join(' ');

  return (
    <div className="border rounded-lg p-3">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
        <TrendingUp className="h-4 w-4 text-cyan-600" />
        Projected Water Quality Trajectory
      </h3>
      <div className="w-full aspect-[2.4/1]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {yTicks.map(t => (
            <line key={t} x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
          ))}
          <line x1={PAD.left} y1={y(baselineScore)} x2={W - PAD.right} y2={y(baselineScore)}
            stroke="#94a3b8" strokeWidth={1} strokeDasharray="6,4" />
          <text x={W - PAD.right + 4} y={y(baselineScore) + 4} fontSize={9} fill="#94a3b8">Baseline</text>
          <line x1={PAD.left} y1={y(targetScore)} x2={W - PAD.right} y2={y(targetScore)}
            stroke="#16a34a" strokeWidth={1.5} strokeDasharray="4,3" />
          <text x={W - PAD.right + 4} y={y(targetScore) + 4} fontSize={9} fill="#16a34a">Target</text>
          <polygon points={`${bandUpper} ${bandLower}`} fill="#0891b2" fillOpacity={0.08} stroke="none" />
          <path d={linePath} fill="none" stroke="#0891b2" strokeWidth={2.5} />
          {yTicks.map(t => (
            <text key={`yl-${t}`} x={PAD.left - 6} y={y(t) + 3} fontSize={9} fill="#64748b" textAnchor="end">{t}</text>
          ))}
          {xTicks.map(t => (
            <text key={`xl-${t}`} x={x(t)} y={H - PAD.bottom + 14} fontSize={9} fill="#64748b" textAnchor="middle">{t}mo</text>
          ))}
          <text x={PAD.left - 32} y={H / 2} fontSize={10} fill="#64748b" textAnchor="middle"
            transform={`rotate(-90 ${PAD.left - 32} ${H / 2})`}>WQ Score</text>
          <text x={W / 2} y={H - 3} fontSize={10} fill="#64748b" textAnchor="middle">Months</text>
        </svg>
      </div>
    </div>
  );
}

// ─── Budget Table ────────────────────────────────────────────────────────────

function BudgetTable({ calc, timelineYrs }: { calc: CalcResult; timelineYrs: number }) {
  const byCat: Record<string, typeof calc.active> = {};
  for (const m of calc.active) {
    if (!byCat[m.cat]) byCat[m.cat] = [];
    byCat[m.cat].push(m);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 text-slate-600">
            <th className="px-3 py-2 text-left font-medium">Module</th>
            <th className="px-3 py-2 text-right font-medium">Units</th>
            <th className="px-3 py-2 text-right font-medium">Unit Cost</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            <th className="px-3 py-2 text-right font-medium">Deploy (mo)</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(byCat).map(([cat, modules]) => (
            <React.Fragment key={cat}>
              <tr className="bg-slate-100">
                <td colSpan={5} className="px-3 py-1.5 font-semibold text-slate-700">
                  <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: CAT_COLORS[cat as ModuleCategory] }} />
                  {cat}
                  <span className="ml-2 font-normal text-slate-400">
                    Subtotal: {fmt$(modules.reduce((s, m) => s + m.totalCost, 0))}
                  </span>
                </td>
              </tr>
              {modules.map(m => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 text-slate-700">{m.icon} {m.name.trim()}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{m.units}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{fmt$(m.costPer)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600">{fmt$(m.totalCost)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-400">{m.mo}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
            <td className="px-3 py-2 text-slate-700">Total CapEx</td>
            <td className="px-3 py-2 text-right text-slate-600">{calc.active.reduce((s, m) => s + m.units, 0)}</td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-right text-slate-700">{fmt$(calc.capex)}</td>
            <td className="px-3 py-2" />
          </tr>
          {calc.teams > 0 && (
            <tr className="bg-slate-50">
              <td className="px-3 py-1.5 text-slate-600" colSpan={3}>
                OpEx: {calc.teams} team{calc.teams > 1 ? 's' : ''} x {fmt$(OPEX_TEAM_YEAR)}/yr x {timelineYrs}yr
              </td>
              <td className="px-3 py-1.5 text-right font-semibold text-orange-700">{fmt$(calc.totalOpex)}</td>
              <td />
            </tr>
          )}
          <tr className="bg-slate-800 text-white font-bold">
            <td className="px-3 py-2" colSpan={3}>Lifecycle ({timelineYrs}yr)</td>
            <td className="px-3 py-2 text-right">{fmt$(calc.lifecycle)}</td>
            <td />
          </tr>
          {calc.grantTotal > 0 && (
            <tr className="bg-green-50 text-green-800 font-semibold">
              <td className="px-3 py-1.5" colSpan={3}>Grant Potential</td>
              <td className="px-3 py-1.5 text-right">-{fmt$(calc.grantTotal)}</td>
              <td />
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}

// ─── Analysis Summary ────────────────────────────────────────────────────────

function AnalysisSummary({ regionName, grade, calc, baseline, targetPct, target, timelineYrs, attainsCategory, attainsCauses }: {
  regionName: string; grade: WaterQualityGrade; calc: CalcResult;
  baseline: Record<ContaminantKey, number>; targetPct: number;
  target: TargetOutcome; timelineYrs: number;
  attainsCategory?: string; attainsCauses?: string[];
}) {
  const attainsDesc = attainsCategory?.includes('5') ? '303(d)-listed as impaired'
    : attainsCategory?.includes('4') ? 'impaired with a TMDL or alternative plan'
    : attainsCategory?.includes('3') ? 'insufficient data for assessment'
    : attainsCategory?.includes('2') ? 'attaining some designated uses'
    : attainsCategory?.includes('1') ? 'meeting all designated uses'
    : 'not yet fully assessed';

  const causeList = attainsCauses?.length
    ? attainsCauses.slice(0, 5).join(', ')
    : null;

  const highImpairment = CK.filter(k => baseline[k] > 50);
  const moduleCount = calc.active.length;
  const catCount = new Set(calc.active.map(m => m.cat)).size;

  return (
    <div className="bg-gradient-to-br from-cyan-50 to-slate-50 border border-cyan-200 rounded-lg p-4 space-y-2">
      <h3 className="text-sm font-semibold text-cyan-800 flex items-center gap-2">
        <Target className="h-4 w-4" />
        Analysis Summary
      </h3>
      <div className="text-xs text-slate-700 leading-relaxed space-y-2">
        <p>
          <strong>{regionName}</strong> currently holds a water quality score of{' '}
          <strong>{grade.score ?? 'N/A'}/100</strong> (grade <strong>{grade.letter}</strong>).
          Under EPA ATTAINS, this waterbody is <strong>{attainsDesc}</strong>.
          {causeList && <> Listed impairment causes include: <em>{causeList}</em>.</>}
        </p>
        <p>
          You have configured <strong>{moduleCount} treatment module{moduleCount !== 1 ? 's' : ''}</strong> across{' '}
          <strong>{catCount} categor{catCount !== 1 ? 'ies' : 'y'}</strong>, targeting{' '}
          <strong>{TARGET_LABELS[target]}</strong> status within <strong>{timelineYrs} years</strong>.
          {highImpairment.length > 0 && (
            <> Key contaminants above 50% baseline impairment: <strong>
              {highImpairment.map(k => CONTAMINANT_LABELS[k].split(' / ')[0]).join(', ')}
            </strong>.</>
          )}
        </p>
        <p>
          The treatment stack projects an average contaminant reduction of{' '}
          <strong>{calc.avg.toFixed(0)}%</strong> with{' '}
          <strong>{calc.totGPM.toLocaleString()} GPM</strong> deployed.
          {calc.met ? (
            <> The target threshold of <strong>{targetPct}%</strong> is projected to be achievable.</>
          ) : (
            <> Additional modules or higher unit counts may be needed to reach the <strong>{targetPct}%</strong> target.</>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Scenario Outcome ────────────────────────────────────────────────────────

function ScenarioOutcome({ calc, baseline, grade, targetPct, target, timelineYrs, regionName }: {
  calc: CalcResult; baseline: Record<ContaminantKey, number>;
  grade: WaterQualityGrade; targetPct: number;
  target: TargetOutcome; timelineYrs: number; regionName: string;
}) {
  const baseScore = grade.score ?? 50;
  const projectedScore = Math.min(100, Math.round(baseScore + (calc.avg / 100) * (100 - baseScore) * 0.8));
  const projectedLetter = projectedScore >= 90 ? 'A' : projectedScore >= 80 ? 'B' : projectedScore >= 70 ? 'C' : projectedScore >= 60 ? 'D' : 'F';
  const delta = projectedScore - baseScore;

  // Top performing contaminants
  const topReductions = CK
    .filter(k => calc.ach[k] > 0 && baseline[k] > 10)
    .sort((a, b) => calc.ach[b] - calc.ach[a])
    .slice(0, 3);

  // Weak contaminants
  const weakContaminants = CK.filter(k => baseline[k] > 40 && calc.ach[k] < 30);

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-slate-50 border border-emerald-200 rounded-lg p-4 space-y-2">
      <h3 className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
        <TrendingUp className="h-4 w-4" />
        Scenario Outcome
      </h3>
      <div className="text-xs text-slate-700 leading-relaxed space-y-2">
        <p>
          If fully implemented, the projected water quality score for <strong>{regionName}</strong> would move from{' '}
          <strong>{baseScore}/100 ({grade.letter})</strong> to approximately{' '}
          <strong>{projectedScore}/100 ({projectedLetter})</strong> &mdash; a{' '}
          <strong>{delta > 0 ? '+' : ''}{delta}-point</strong> improvement over <strong>{timelineYrs} years</strong>.
        </p>
        {topReductions.length > 0 && (
          <p>
            <strong>Top reductions:</strong>{' '}
            {topReductions.map(k =>
              `${CONTAMINANT_LABELS[k].split(' / ')[0]} (${calc.ach[k].toFixed(0)}%)`
            ).join(', ')}.
          </p>
        )}
        {weakContaminants.length > 0 && (
          <p>
            <strong>Residual gaps:</strong>{' '}
            {weakContaminants.map(k => CONTAMINANT_LABELS[k].split(' / ')[0]).join(', ')}{' '}
            remain elevated. Consider adding targeted modules for{' '}
            {weakContaminants.length === 1 ? 'this parameter' : 'these parameters'}.
          </p>
        )}
        <p>
          Estimated capital: <strong>{fmt$(calc.capex)}</strong>.
          {calc.teams > 0 && <> Annual operating cost: <strong>{fmt$(calc.annualOpex)}</strong>.</>}
          {calc.grantTotal > 0 && <> Up to <strong>{fmt$(calc.grantTotal)}</strong> in grant savings may apply.</>}
        </p>
      </div>
    </div>
  );
}

// ─── Closing Summary ─────────────────────────────────────────────────────────

function ClosingSummary({ calc, grade, target, timelineYrs, totalLifecycle, totalGrants, ngoCount, eventCount, regionName, stateAbbr, stateGrantCount }: {
  calc: CalcResult; grade: WaterQualityGrade;
  target: TargetOutcome; timelineYrs: number;
  totalLifecycle: number; totalGrants: number;
  ngoCount: number; eventCount: number;
  regionName: string; stateAbbr: string; stateGrantCount: number;
}) {
  const netCost = Math.max(0, totalLifecycle - totalGrants);

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-lg p-4 space-y-2">
      <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-blue-600" />
        Summary & Recommendations
      </h3>
      <div className="text-xs text-slate-700 leading-relaxed space-y-2">
        <p>
          This restoration analysis configured <strong>{calc.active.length} treatment modules</strong> for{' '}
          <strong>{regionName}</strong> targeting <strong>{TARGET_LABELS[target]}</strong> status
          over <strong>{timelineYrs} years</strong>.
          The projected average contaminant reduction is <strong>{calc.avg.toFixed(0)}%</strong> at a
          lifecycle cost of <strong>{fmt$(totalLifecycle)}</strong>
          {totalGrants > 0 && <> (net <strong>{fmt$(netCost)}</strong> after grants/in-kind)</>}.
        </p>
        {ngoCount > 0 && (
          <p>
            <strong>{ngoCount} NGO partner{ngoCount > 1 ? 's' : ''}</strong> selected for in-kind support,
            contributing monitoring, advocacy, and technical capacity.
          </p>
        )}
        {eventCount > 0 && (
          <p>
            <strong>{eventCount} community program{eventCount > 1 ? 's' : ''}</strong> included for
            stakeholder engagement, volunteer coordination, and public education.
          </p>
        )}
        {stateGrantCount > 0 && stateAbbr && (
          <p>
            <strong>{stateGrantCount}</strong> high-fit grant program{stateGrantCount > 1 ? 's' : ''} in{' '}
            <strong>{stateAbbr}</strong> may further offset costs. Early coordination with state water quality
            agencies and SRF programs can accelerate permitting and funding timelines.
          </p>
        )}
        <p className="text-slate-500 italic">
          All projections are modeled estimates based on EPA ATTAINS assessments, published intervention efficacy
          literature, and industry cost data. Actual outcomes depend on site-specific hydrology, land use, climate
          variability, and implementation fidelity. A site-specific feasibility study is recommended before committing capital.
        </p>
      </div>
    </div>
  );
}
