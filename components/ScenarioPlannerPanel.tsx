'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MockDataBadge } from './MockDataBadge';
import {
  DollarSign, ChevronDown, ChevronUp, AlertTriangle, TrendingDown,
  Wrench, Cloud, FlaskConical, Scale, Droplets, Wind, Sun,
  FileText, ShieldAlert, Skull, Play, Users, Info,
} from 'lucide-react';
import { SCENARIO_CATEGORIES, SCENARIOS, getScenariosByCategory } from '@/lib/scenarioPlanner/scenarios';
import { computeScenarioCost, fmt$ } from '@/lib/scenarioPlanner/costEngine';
import type {
  ScenarioCategory,
  ScenarioDefinition,
  ScenarioPlannerRole,
  ScenarioResult,
  CostTierOutput,
} from '@/lib/scenarioPlanner/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLES: { id: ScenarioPlannerRole; label: string; description: string }[] = [
  { id: 'ms4-manager', label: 'MS4 Manager', description: 'Stormwater permit compliance focus' },
  { id: 'utility-director', label: 'Utility Director', description: 'System operations & capital planning' },
  { id: 'city-manager', label: 'City Manager', description: 'Budget & constituent impact' },
  { id: 'state-regulator', label: 'State Regulator', description: 'Aggregate enforcement view' },
  { id: 'insurer', label: 'Insurer', description: 'Loss modeling & portfolio risk' },
  { id: 'consultant', label: 'Consultant', description: 'Service opportunity assessment' },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  Wrench: <Wrench size={16} />,
  Cloud: <Cloud size={16} />,
  FlaskConical: <FlaskConical size={16} />,
  Scale: <Scale size={16} />,
  Droplets: <Droplets size={16} />,
  AlertTriangle: <AlertTriangle size={16} />,
  Wind: <Wind size={16} />,
  Sun: <Sun size={16} />,
  FileText: <FileText size={16} />,
  ShieldAlert: <ShieldAlert size={16} />,
  Skull: <Skull size={16} />,
};

const TIER_COLORS: Record<string, string> = {
  direct: 'border-orange-200 bg-orange-50',
  regulatory: 'border-red-200 bg-red-50',
  economic: 'border-blue-200 bg-blue-50',
  timeline: 'border-slate-200 bg-slate-50',
};

const TIER_ICONS: Record<string, React.ReactNode> = {
  direct: <Wrench size={14} className="text-orange-600" />,
  regulatory: <Scale size={14} className="text-red-600" />,
  economic: <DollarSign size={14} className="text-blue-600" />,
  timeline: <TrendingDown size={14} className="text-slate-600" />,
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ScenarioPlannerPanel() {
  const [role, setRole] = useState<ScenarioPlannerRole>('city-manager');
  const [activeCategory, setActiveCategory] = useState<ScenarioCategory>('infrastructure');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioDefinition | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string | number>>({});
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set(['direct']));
  const [stateAbbr] = useState('US'); // could be wired to user context later

  const categoryScenarios = useMemo(() => getScenariosByCategory(activeCategory), [activeCategory]);

  const selectScenario = useCallback((s: ScenarioDefinition) => {
    setSelectedScenario(s);
    setResult(null);
    const defaults: Record<string, string | number> = {};
    for (const p of s.parameters) {
      defaults[p.id] = p.default;
    }
    setParamValues(defaults);
  }, []);

  const runScenario = useCallback(() => {
    if (!selectedScenario) return;
    const r = computeScenarioCost(selectedScenario, paramValues, role, stateAbbr);
    setResult(r);
    setExpandedTiers(new Set(['direct']));
  }, [selectedScenario, paramValues, role, stateAbbr]);

  const toggleTier = useCallback((tier: string) => {
    setExpandedTiers(prev => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign size={18} className="text-emerald-600" />
                Scenario Cost Planner
                <MockDataBadge />
              </CardTitle>
              <CardDescription className="mt-1">
                Model the financial impact of water infrastructure scenarios. Select a role, pick a scenario, adjust parameters, and run.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Users size={14} className="text-slate-400" />
              <select
                value={role}
                onChange={e => { setRole(e.target.value as ScenarioPlannerRole); setResult(null); }}
                className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map(r => (
                  <option key={r.id} value={r.id}>{r.label} — {r.description}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ── Category Tabs ── */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
        {SCENARIO_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategory(cat.id); setSelectedScenario(null); setResult(null); }}
            className={`flex-1 px-3 py-2 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeCategory === cat.id
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            {ICON_MAP[cat.icon] || null}
            <span className="hidden sm:inline">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* ── Scenario Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {categoryScenarios.map(s => {
          const isSelected = selectedScenario?.id === s.id;
          return (
            <Card
              key={s.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''
              }`}
              onClick={() => selectScenario(s)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${SCENARIO_CATEGORIES.find(c => c.id === s.category)?.color || 'bg-slate-50'}`}>
                    {ICON_MAP[s.icon] || <AlertTriangle size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">{s.label}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{s.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.applicableRoles.includes(role) ? (
                        <Badge className="bg-green-100 text-green-700 border-green-300 text-[9px]">Relevant to {ROLES.find(r => r.id === role)?.label}</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 text-[9px]">Less relevant for {ROLES.find(r => r.id === role)?.label}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Parameter Adjusters ── */}
      {selectedScenario && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {ICON_MAP[selectedScenario.icon]}
              {selectedScenario.label} — Parameters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedScenario.parameters.map(p => (
                <div key={p.id}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">{p.label}</label>
                  {p.type === 'select' && p.options ? (
                    <select
                      value={String(paramValues[p.id] ?? p.default)}
                      onChange={e => setParamValues(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {p.options.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={Number(paramValues[p.id] ?? p.default)}
                      onChange={e => setParamValues(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) }))}
                      className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={runScenario} size="sm" className="gap-1.5">
                <Play size={14} /> Run Scenario
              </Button>
              <span className="text-[10px] text-slate-400">
                State factor: {stateAbbr} | Role: {ROLES.find(r => r.id === role)?.label}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Results ── */}
      {result && (
        <div className="space-y-4">
          {/* Expected Loss Banner */}
          {result.expectedLoss && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={20} className="text-amber-600" />
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Expected Annual Loss</div>
                    <div className="text-2xl font-bold text-amber-900 font-mono">{fmt$(result.expectedLoss.expectedValue)}</div>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {result.expectedLoss.probability}% probability × {fmt$(result.expectedLoss.totalCost)} midpoint cost
                      <span className="opacity-70"> — linked from Risk Forecast engine</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Total Cost Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Estimated Cost Range</div>
                  <div className="text-3xl font-bold text-slate-900 font-mono">
                    {fmt$(result.totalCostLow)} <span className="text-lg text-slate-400">–</span> {fmt$(result.totalCostHigh)}
                  </div>
                </div>
                {result.scoreImpact && (
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-[10px] text-slate-400 uppercase">Water Score Impact</div>
                      <div className="flex items-center gap-2 mt-1">
                        <ScoreGauge value={result.scoreImpact.before} label="Before" />
                        <span className="text-slate-300">→</span>
                        <ScoreGauge value={result.scoreImpact.after} label="After" />
                        <Badge className={`text-xs font-mono ${result.scoreImpact.delta < -10 ? 'bg-red-100 text-red-700' : result.scoreImpact.delta < -5 ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {result.scoreImpact.delta > 0 ? '+' : ''}{result.scoreImpact.delta} pts
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cost Tier Accordions */}
          {result.costTiers.filter(t => t.items.length > 0).map(tier => (
            <CostTierCard
              key={tier.tier}
              tier={tier}
              expanded={expandedTiers.has(tier.tier)}
              onToggle={() => toggleTier(tier.tier)}
            />
          ))}

          {/* Timeline */}
          {result.timeline.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recovery Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {result.timeline.map((phase, i) => (
                    <div key={i} className="flex gap-3 pb-4 last:pb-0">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full border-2 ${i === 0 ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'}`} />
                        {i < result.timeline.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0 -mt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{phase.phase}</span>
                          <Badge variant="secondary" className="text-[9px]">{phase.duration}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{phase.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Role-Specific Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users size={14} />
                {ROLES.find(r => r.id === role)?.label} Perspective
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 px-2 py-3 rounded-lg bg-slate-50 border border-slate-200">
            <Info size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 leading-relaxed">{result.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function ScoreGauge({ value, label }: { value: number; label: string }) {
  const color = value >= 70 ? 'text-green-600' : value >= 50 ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="text-center">
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
      <div className="text-[9px] text-slate-400">{label}</div>
    </div>
  );
}

function CostTierCard({ tier, expanded, onToggle }: { tier: CostTierOutput; expanded: boolean; onToggle: () => void }) {
  return (
    <Card className={`overflow-hidden border ${TIER_COLORS[tier.tier] || ''}`}>
      <div
        className="p-3 cursor-pointer hover:bg-white/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {TIER_ICONS[tier.tier]}
            <span className="text-sm font-bold text-slate-900">{tier.label}</span>
            <Badge variant="secondary" className="text-[9px] font-mono">
              {tier.items.length} item{tier.items.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold font-mono text-slate-700">
              {fmt$(tier.totalLow)} – {fmt$(tier.totalHigh)}
            </span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-3 py-2 text-slate-500 font-medium">Item</th>
                <th className="text-right px-3 py-2 text-slate-500 font-medium">Low</th>
                <th className="text-right px-3 py-2 text-slate-500 font-medium">High</th>
                <th className="text-left px-3 py-2 text-slate-500 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {tier.items.map((item, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-3 py-2 text-slate-700">{item.label}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-600">
                    {item.lowEstimate > 0 ? fmt$(item.lowEstimate) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">
                    {item.highEstimate > 0 ? fmt$(item.highEstimate) : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-400 max-w-[200px] truncate">{item.notes || ''}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2 text-slate-700">Subtotal</td>
                <td className="px-3 py-2 text-right font-mono text-slate-700">{fmt$(tier.totalLow)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-900">{fmt$(tier.totalHigh)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
