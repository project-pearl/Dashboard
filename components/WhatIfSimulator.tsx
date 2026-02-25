'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle, TrendingDown, TrendingUp, Play, RotateCcw,
  ChevronDown, ChevronUp, Zap,
} from 'lucide-react';
import ResolutionPlanner, { type ScopeContext } from '@/components/ResolutionPlanner';
import {
  SCENARIO_CATALOG, SCENARIO_CATEGORIES, CATEGORY_LABELS,
  BASELINE_STATE_ROLLUP,
  type ScenarioEvent,
} from '@/lib/scenarioCatalog';
import { applyScenarios, buildSimulatedNational } from '@/lib/scenarioEngine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function deltaArrow(current: number, baseline: number) {
  const diff = current - baseline;
  if (diff > 0) return <TrendingUp size={14} className="text-red-500" />;
  if (diff < 0) return <TrendingDown size={14} className="text-green-500" />;
  return null;
}

function deltaColor(current: number, baseline: number, lowerIsBetter = false) {
  const diff = current - baseline;
  if (diff === 0) return 'text-slate-500';
  // For scores: higher is better. For impairment/alerts: lower is better.
  if (lowerIsBetter) return diff > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold';
  return diff < 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WhatIfSimulator() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasRun, setHasRun] = useState(false);
  const [showResolutionPlanner, setShowResolutionPlanner] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(SCENARIO_CATEGORIES)
  );
  const [sortColumn, setSortColumn] = useState<'abbr' | 'score' | 'delta'>('delta');
  const [sortAsc, setSortAsc] = useState(true);

  // Compute baseline national summary (constant)
  const baselineNational = useMemo(
    () => buildSimulatedNational(
      BASELINE_STATE_ROLLUP.map(s => ({
        ...s,
        grade: { letter: '', color: '', bg: '' },
        scenarioApplied: false,
      }))
    ),
    []
  );

  // Build selected scenario list
  const selectedScenarios = useMemo(
    () => SCENARIO_CATALOG.filter(s => selectedIds.has(s.id)),
    [selectedIds]
  );

  // Apply scenarios (only meaningful when hasRun)
  const simulatedStates = useMemo(
    () => hasRun ? applyScenarios(BASELINE_STATE_ROLLUP, selectedScenarios) : null,
    [hasRun, selectedScenarios]
  );

  const simulatedNational = useMemo(
    () => simulatedStates ? buildSimulatedNational(simulatedStates) : null,
    [simulatedStates]
  );

  // Build scope context for Resolution Planner
  const scopeContext = useMemo((): ScopeContext | null => {
    if (!simulatedNational || !simulatedStates) return null;
    return {
      scope: 'national',
      data: {
        totalStates: simulatedStates.length,
        totalWaterbodies: simulatedNational.totalWaterbodies,
        totalImpaired: simulatedNational.totalImpaired,
        averageScore: simulatedNational.averageScore,
        highAlertStates: simulatedNational.highAlertStates,
        topCauses: simulatedNational.topCauses,
        worstStates: simulatedNational.worstStates,
      },
    };
  }, [simulatedNational, simulatedStates]);

  // Build scenario narrative for the AI prompt
  const scenarioNarrative = useMemo(() => {
    if (selectedScenarios.length === 0) return undefined;
    const baseMap = new Map(BASELINE_STATE_ROLLUP.map(s => [s.abbr, s]));
    const lines = selectedScenarios.map(s => {
      const states = s.affectedStates.length === 0 ? 'all states' : s.affectedStates.join(', ');
      return `- ${s.icon} ${s.label} (${s.category}): ${s.description} Affected: ${states}.`;
    });
    const impactLines = simulatedStates
      ? simulatedStates
          .filter(s => s.scenarioApplied)
          .sort((a, b) => a.score - b.score)
          .slice(0, 10)
          .map(s => {
            const base = baseMap.get(s.abbr);
            const delta = base ? s.score - base.score : 0;
            return `  ${s.abbr}: score ${base?.score ?? '?'} → ${s.score} (${delta > 0 ? '+' : ''}${delta}), ${s.high} high alerts, ${s.cat5} Cat 5`;
          })
      : [];
    return [
      `ACTIVE SIMULATED SCENARIOS (${selectedScenarios.length}):`,
      ...lines,
      '',
      'SIMULATED IMPACT ON WORST-HIT STATES:',
      ...impactLines,
      '',
      'Generate the plan AS IF these scenarios are real active crises. Create a compelling, detailed narrative. Name the events, describe cascading effects, reference PIN early-warning detections, and propose a full federal response.',
    ].join('\n');
  }, [selectedScenarios, simulatedStates]);

  // Affected states sorted for the impact table
  const sortedAffectedStates = useMemo(() => {
    if (!simulatedStates) return [];
    const affected = simulatedStates.filter(s => s.scenarioApplied);
    const baseMap = new Map(BASELINE_STATE_ROLLUP.map(s => [s.abbr, s]));

    return affected.sort((a, b) => {
      if (sortColumn === 'abbr') return sortAsc ? a.abbr.localeCompare(b.abbr) : b.abbr.localeCompare(a.abbr);
      if (sortColumn === 'score') return sortAsc ? a.score - b.score : b.score - a.score;
      // delta
      const dA = a.score - (baseMap.get(a.abbr)?.score || 0);
      const dB = b.score - (baseMap.get(b.abbr)?.score || 0);
      return sortAsc ? dA - dB : dB - dA;
    });
  }, [simulatedStates, sortColumn, sortAsc]);

  // Simulated alerts
  const simulatedAlerts = useMemo(() => {
    if (!simulatedStates) return [];
    const baseMap = new Map(BASELINE_STATE_ROLLUP.map(s => [s.abbr, s]));
    const alerts: { state: string; message: string; severity: 'critical' | 'warning' }[] = [];

    for (const st of simulatedStates) {
      if (!st.scenarioApplied) continue;
      const base = baseMap.get(st.abbr);
      if (!base) continue;

      if (st.score < 30) {
        alerts.push({ state: st.abbr, message: `${st.name} score critically low at ${st.score}/100 (was ${base.score})`, severity: 'critical' });
      } else if (st.score < 50 && base.score >= 50) {
        alerts.push({ state: st.abbr, message: `${st.name} dropped below 50 threshold: ${st.score}/100 (was ${base.score})`, severity: 'warning' });
      }

      if (st.high > base.high * 2) {
        alerts.push({ state: st.abbr, message: `${st.name} high alerts surged to ${st.high} (was ${base.high})`, severity: 'critical' });
      }
    }

    return alerts.sort((a, b) => (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1));
  }, [simulatedStates]);

  // ── Handlers ──

  function toggleScenario(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setHasRun(false);
    setShowResolutionPlanner(false);
  }

  function toggleCategory(cat: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  function runSimulation() {
    if (selectedIds.size === 0) return;
    setHasRun(true);
    setShowResolutionPlanner(false);
  }

  function resetSimulation() {
    setSelectedIds(new Set());
    setHasRun(false);
    setShowResolutionPlanner(false);
  }

  function handleSort(col: 'abbr' | 'score' | 'delta') {
    if (sortColumn === col) setSortAsc(!sortAsc);
    else { setSortColumn(col); setSortAsc(true); }
  }

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* ── Section 1: Scenario Builder ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap size={16} className="text-teal-600" /> What-If Scenario Builder
              </CardTitle>
              <CardDescription>
                Select one or more scenarios to simulate cascading water quality impacts across the national system.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button variant="ghost" size="sm" onClick={resetSimulation}>
                  <RotateCcw size={14} className="mr-1" /> Reset
                </Button>
              )}
              <Button
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={runSimulation}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Play size={14} className="mr-1" /> Run Simulation
                {selectedIds.size > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-teal-800 text-teal-100">
                    {selectedIds.size}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {SCENARIO_CATEGORIES.map(cat => {
            const scenarios = SCENARIO_CATALOG.filter(s => s.category === cat);
            const isExpanded = expandedCategories.has(cat);
            const selectedInCat = scenarios.filter(s => selectedIds.has(s.id)).length;

            return (
              <div key={cat} className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      {CATEGORY_LABELS[cat]}
                    </span>
                    {selectedInCat > 0 && (
                      <Badge variant="secondary" className="bg-teal-100 text-teal-700 text-[10px]">
                        {selectedInCat} selected
                      </Badge>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {isExpanded && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
                    {scenarios.map(scenario => {
                      const isSelected = selectedIds.has(scenario.id);
                      return (
                        <button
                          key={scenario.id}
                          onClick={() => toggleScenario(scenario.id)}
                          className={`text-left rounded-lg border-2 p-3 transition-all ${
                            isSelected
                              ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-200'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-lg leading-none mt-0.5">{scenario.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{scenario.label}</span>
                                {isSelected && (
                                  <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{scenario.description}</p>
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {scenario.affectedStates.length === 0 ? (
                                  <Badge variant="outline" className="text-[9px] py-0 h-4">Nationwide</Badge>
                                ) : (
                                  scenario.affectedStates.map(st => (
                                    <Badge key={st} variant="outline" className="text-[9px] py-0 h-4">{st}</Badge>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Section 2: Impact Dashboard ── */}
      {hasRun && simulatedStates && simulatedNational && (
        <>
          {/* SIMULATION WATERMARK BANNER */}
          <div className="bg-amber-100 border-2 border-amber-400 rounded-lg px-4 py-2 flex items-center gap-2 text-amber-800">
            <AlertTriangle size={16} className="flex-shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Simulation — Not Live Data
            </span>
            <span className="text-xs opacity-70 ml-2">
              {selectedScenarios.length} scenario{selectedScenarios.length !== 1 ? 's' : ''} applied: {selectedScenarios.map(s => s.label).join(', ')}
            </span>
          </div>

          {/* Before / After KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: 'Avg Score',
                before: baselineNational.averageScore,
                after: simulatedNational.averageScore,
                unit: '/100',
                lowerIsBetter: false,
              },
              {
                label: 'High-Alert States',
                before: baselineNational.highAlertStates,
                after: simulatedNational.highAlertStates,
                unit: '',
                lowerIsBetter: true,
              },
              {
                label: 'Total Impaired',
                before: baselineNational.totalImpaired,
                after: simulatedNational.totalImpaired,
                unit: '',
                lowerIsBetter: true,
                format: true,
              },
              {
                label: 'Cat 5 Waterbodies',
                before: baselineNational.totalCat5,
                after: simulatedNational.totalCat5,
                unit: '',
                lowerIsBetter: true,
                format: true,
              },
            ].map(kpi => {
              const diff = kpi.after - kpi.before;
              const pct = kpi.before > 0 ? ((diff / kpi.before) * 100).toFixed(1) : '0';
              return (
                <Card key={kpi.label} className="border-amber-200">
                  <CardContent className="p-3">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mb-1">
                      {kpi.label}
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="text-lg font-bold font-mono text-slate-400 line-through">
                        {(kpi as any).format ? formatNumber(kpi.before) : kpi.before}{kpi.unit}
                      </div>
                      <div className={`text-xl font-bold font-mono ${deltaColor(kpi.after, kpi.before, kpi.lowerIsBetter)}`}>
                        {(kpi as any).format ? formatNumber(kpi.after) : kpi.after}{kpi.unit}
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 text-xs mt-1 ${deltaColor(kpi.after, kpi.before, kpi.lowerIsBetter)}`}>
                      {deltaArrow(kpi.lowerIsBetter ? -diff : diff, 0)}
                      <span>{diff > 0 ? '+' : ''}{(kpi as any).format ? formatNumber(diff) : diff} ({diff > 0 ? '+' : ''}{pct}%)</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* State Impact Table */}
          <Card className="border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle size={16} className="text-amber-600" /> Affected States
                <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                  {sortedAffectedStates.length} impacted
                </Badge>
                <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300 ml-auto">
                  SIMULATED
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      {[
                        { key: 'abbr' as const, label: 'State' },
                        { key: 'score' as const, label: 'Current Score' },
                        { key: 'score' as const, label: 'Simulated Score' },
                        { key: 'delta' as const, label: '\u0394 Change' },
                        { key: 'abbr' as const, label: 'Grade Change' },
                        { key: 'abbr' as const, label: 'High Alerts' },
                        { key: 'abbr' as const, label: 'Cat 5' },
                      ].map((col, i) => (
                        <th
                          key={`${col.key}-${i}`}
                          onClick={i < 4 ? () => handleSort(col.key) : undefined}
                          className={`text-left py-2 px-2 text-slate-500 font-semibold uppercase tracking-wider ${
                            i < 4 ? 'cursor-pointer hover:text-slate-700' : ''
                          }`}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAffectedStates.map(st => {
                      const base = BASELINE_STATE_ROLLUP.find(b => b.abbr === st.abbr);
                      if (!base) return null;
                      const scoreDiff = st.score - base.score;

                      return (
                        <tr key={st.abbr} className="border-b border-slate-100 hover:bg-amber-50/50">
                          <td className="py-2 px-2 font-bold text-slate-900">{st.abbr}</td>
                          <td className="py-2 px-2 font-mono">{base.score}</td>
                          <td className={`py-2 px-2 font-mono font-bold ${st.score < 40 ? 'text-red-700' : st.score < 60 ? 'text-amber-700' : 'text-slate-900'}`}>
                            {st.score}
                          </td>
                          <td className={`py-2 px-2 font-mono font-bold ${scoreDiff < 0 ? 'text-red-600' : scoreDiff > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                            {scoreDiff > 0 ? '+' : ''}{scoreDiff}
                          </td>
                          <td className="py-2 px-2">
                            <span className="text-slate-400">{baseGrade(base.score)}</span>
                            <span className="mx-1 text-slate-300">&rarr;</span>
                            <span className={st.grade.color + ' font-bold'}>{st.grade.letter}</span>
                          </td>
                          <td className="py-2 px-2 font-mono">
                            <span className="text-slate-400">{base.high}</span>
                            <span className="mx-1 text-slate-300">&rarr;</span>
                            <span className={st.high > base.high ? 'text-red-600 font-bold' : ''}>{st.high}</span>
                          </td>
                          <td className="py-2 px-2 font-mono">
                            <span className="text-slate-400">{base.cat5}</span>
                            <span className="mx-1 text-slate-300">&rarr;</span>
                            <span className={st.cat5 > base.cat5 ? 'text-red-600 font-bold' : ''}>{st.cat5}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Simulated Alert Feed */}
          {simulatedAlerts.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle size={16} className="text-red-500" /> Simulated Alert Feed
                  <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300 ml-auto">
                    SIMULATED
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Alerts that would trigger based on the simulated scenario conditions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {simulatedAlerts.slice(0, 20).map((alert, i) => (
                  <div
                    key={`${alert.state}-${i}`}
                    className={`rounded-lg border p-3 ${
                      alert.severity === 'critical'
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={12} className={alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600'} />
                      <Badge
                        variant="outline"
                        className={`text-[9px] py-0 ${
                          alert.severity === 'critical' ? 'border-red-300 text-red-700' : 'border-amber-300 text-amber-700'
                        }`}
                      >
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] py-0 border-amber-300 text-amber-600">SIMULATED</Badge>
                      <span className="text-xs font-medium">{alert.message}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── Section 3: AI Resolution Response ── */}
          <Card className="border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap size={16} className="text-teal-600" /> AI Resolution Response
                <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300 ml-auto">
                  SIMULATED
                </Badge>
              </CardTitle>
              <CardDescription>
                AI-generated response plan for the simulated scenario. Uses the Resolution Planner to draft a comprehensive action plan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showResolutionPlanner ? (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-500 mb-3">
                    Generate an AI response plan for this simulated {selectedScenarios.length}-scenario crisis affecting {sortedAffectedStates.length} states.
                  </p>
                  <Button
                    onClick={() => setShowResolutionPlanner(true)}
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    <Zap size={14} className="mr-1" /> Generate Response Plan
                  </Button>
                </div>
              ) : scopeContext ? (
                <div className="relative">
                  <div className="absolute top-0 left-0 right-0 bg-amber-100 border-b-2 border-amber-400 px-3 py-1.5 z-10 flex items-center gap-2 rounded-t-lg">
                    <AlertTriangle size={12} className="text-amber-700" />
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                      AI-Generated Response Plan for Simulated Scenario
                    </span>
                  </div>
                  <div className="pt-10">
                    <ResolutionPlanner
                      scopeContext={scopeContext}
                      userRole="federal"
                      scenarioContext={scenarioNarrative}
                    />
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Grade helper (inline, avoids importing from another component) ──────────

function baseGrade(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D-';
  return 'F';
}
