'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Target, Wrench, Waves, Scale, Gauge, GitBranch, Clock, HeartPulse,
  TrendingUp, TrendingDown, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle, RefreshCw, Zap, Info, Loader2,
} from 'lucide-react';
import type { HucIndices, IndexScore, IndexId } from '@/lib/indices/types';
import type { RiskForecastCategory, RiskLevel } from '@/lib/siteIntelTypes';
import { INDEX_WEIGHTS } from '@/lib/indices/config';

// ─── Constants ──────────────────────────────────────────────────────────────

const ALL_INDEX_IDS: IndexId[] = [
  'pearlLoadVelocity', 'infrastructureFailure', 'watershedRecovery',
  'permitRiskExposure', 'perCapitaLoad', 'waterfrontExposure',
  'ecologicalHealth', 'ejVulnerability', 'governanceResponse',
];

const INDEX_LABELS: Record<IndexId, string> = {
  pearlLoadVelocity: 'PEARL Load Velocity',
  infrastructureFailure: 'Infrastructure Failure',
  watershedRecovery: 'Watershed Recovery',
  permitRiskExposure: 'Permit Risk Exposure',
  perCapitaLoad: 'Per Capita Load',
  waterfrontExposure: 'Waterfront Exposure',
  ecologicalHealth: 'Ecological Health',
  ejVulnerability: 'EJ Vulnerability',
  governanceResponse: 'Governance Response',
};

const INDEX_SHORT: Record<IndexId, string> = {
  pearlLoadVelocity: 'PLV',
  infrastructureFailure: 'Infra',
  watershedRecovery: 'Recovery',
  permitRiskExposure: 'Permit',
  perCapitaLoad: 'PCLoad',
  waterfrontExposure: 'Waterfront',
  ecologicalHealth: 'Ecology',
  ejVulnerability: 'EJ',
  governanceResponse: 'Governance',
};

type PredictionId = 'infrastructure-failure' | 'impairment-breach' | 'enforcement-probability'
  | 'capacity-exceedance' | 'cascading-impact' | 'recovery-timeline'
  | 'public-health-exposure' | 'intervention-roi';

interface PredictionDef {
  id: PredictionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  weights: Partial<Record<IndexId, number>>;
  invertedIndices: IndexId[];
  neutralDefault: IndexId[];
}

const PREDICTIONS: PredictionDef[] = [
  {
    id: 'infrastructure-failure',
    label: 'Infrastructure Failure',
    icon: Wrench,
    weights: { infrastructureFailure: 0.50, perCapitaLoad: 0.30 },
    invertedIndices: [],
    neutralDefault: [], // uses 50 for SDWIS proxy
  },
  {
    id: 'impairment-breach',
    label: 'Impairment Breach',
    icon: Waves,
    weights: { pearlLoadVelocity: 0.45, watershedRecovery: 0.35, ecologicalHealth: 0.20 },
    invertedIndices: ['watershedRecovery', 'ecologicalHealth'],
    neutralDefault: [],
  },
  {
    id: 'enforcement-probability',
    label: 'Enforcement Probability',
    icon: Scale,
    weights: { permitRiskExposure: 0.45, governanceResponse: 0.35, infrastructureFailure: 0.20 },
    invertedIndices: ['governanceResponse'],
    neutralDefault: [],
  },
  {
    id: 'capacity-exceedance',
    label: 'Capacity Exceedance',
    icon: Gauge,
    weights: { pearlLoadVelocity: 0.40, infrastructureFailure: 0.35, perCapitaLoad: 0.25 },
    invertedIndices: [],
    neutralDefault: [],
  },
  {
    id: 'cascading-impact',
    label: 'Cascading Impact',
    icon: GitBranch,
    weights: { ecologicalHealth: 0.40, ejVulnerability: 0.35, pearlLoadVelocity: 0.25 },
    invertedIndices: ['ecologicalHealth'],
    neutralDefault: [],
  },
  {
    id: 'recovery-timeline',
    label: 'Recovery Timeline',
    icon: Clock,
    weights: { watershedRecovery: 0.50, pearlLoadVelocity: 0.30, governanceResponse: 0.20 },
    invertedIndices: ['watershedRecovery', 'governanceResponse'],
    neutralDefault: [],
  },
  {
    id: 'public-health-exposure',
    label: 'Public Health Exposure',
    icon: HeartPulse,
    weights: { ejVulnerability: 0.40, infrastructureFailure: 0.30 },
    invertedIndices: [],
    neutralDefault: [], // uses 50 for contaminant proxy
  },
  {
    id: 'intervention-roi',
    label: 'Intervention ROI',
    icon: TrendingUp,
    weights: {},
    invertedIndices: [],
    neutralDefault: [],
  },
];

// ─── Risk approximation engine ──────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function idxVal(idx: IndexScore | undefined): number {
  return idx?.value ?? 50;
}

function riskLevel(p: number): RiskLevel {
  if (p >= 60) return 'red';
  if (p >= 30) return 'amber';
  return 'green';
}

type ConfidenceTier = 'HIGH' | 'MODERATE' | 'LOW';

function confidenceTier(avgConf: number): ConfidenceTier {
  if (avgConf >= 70) return 'HIGH';
  if (avgConf >= 40) return 'MODERATE';
  return 'LOW';
}

/** Format probability per v2 spec confidence guardrails */
function formatProbDisplay(probability: number, tier: ConfidenceTier, level: RiskLevel): string {
  if (tier === 'HIGH') {
    const band = Math.round(probability * 0.12);
    return `${probability}% (\u00b1${band}%)`;
  }
  if (tier === 'MODERATE') {
    const lo = Math.max(0, probability - 10);
    const hi = Math.min(100, probability + 10);
    return `${lo}\u2013${hi}%`;
  }
  // LOW — directional only
  return level === 'red' ? 'Elevated risk' : level === 'amber' ? 'Trending toward exceedance' : 'Low risk signal';
}

interface ApproxPrediction {
  id: PredictionId;
  label: string;
  probability: number;
  level: RiskLevel;
}

function approximateRisks(huc: HucIndices): ApproxPrediction[] {
  const plv = idxVal(huc.pearlLoadVelocity);
  const infra = idxVal(huc.infrastructureFailure);
  const recovery = idxVal(huc.watershedRecovery);
  const permit = idxVal(huc.permitRiskExposure);
  const pcLoad = idxVal(huc.perCapitaLoad);
  const ecology = idxVal(huc.ecologicalHealth);
  const ejVuln = idxVal(huc.ejVulnerability);
  const governance = idxVal(huc.governanceResponse);

  const scores: [PredictionId, string, number][] = [
    ['infrastructure-failure', 'Infrastructure Failure', clamp(Math.round(infra * 0.50 + pcLoad * 0.30 + 50 * 0.20))],
    ['impairment-breach', 'Impairment Breach', clamp(Math.round(plv * 0.45 + (100 - recovery) * 0.35 + (100 - ecology) * 0.20))],
    ['enforcement-probability', 'Enforcement Probability', clamp(Math.round(permit * 0.45 + (100 - governance) * 0.35 + infra * 0.20))],
    ['capacity-exceedance', 'Capacity Exceedance', clamp(Math.round(plv * 0.40 + infra * 0.35 + pcLoad * 0.25))],
    ['cascading-impact', 'Cascading Impact', clamp(Math.round((100 - ecology) * 0.40 + ejVuln * 0.35 + plv * 0.25))],
    ['recovery-timeline', 'Recovery Timeline', clamp(Math.round((100 - recovery) * 0.50 + plv * 0.30 + (100 - governance) * 0.20))],
    ['public-health-exposure', 'Public Health Exposure', clamp(Math.round(ejVuln * 0.40 + infra * 0.30 + 50 * 0.30))],
    ['intervention-roi', 'Intervention ROI', clamp(100 - huc.composite)],
  ];

  return scores.map(([id, label, p]) => ({ id, label, probability: p, level: riskLevel(p) }));
}

// ─── Computed national stats ────────────────────────────────────────────────

interface IndexStat {
  id: IndexId;
  label: string;
  avg: number;
  avgConfidence: number;
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
  worstHuc: string;
  worstValue: number;
}

interface HucRiskRow {
  huc8: string;
  stateAbbr: string;
  composite: number;
  predictions: ApproxPrediction[];
  topRisk: ApproxPrediction;
  avgConfidence: number;
}

function computeNationalStats(hucs: HucIndices[]) {
  // Per-index averages
  const indexStats: IndexStat[] = ALL_INDEX_IDS.map(id => {
    const values: number[] = [];
    const confidences: number[] = [];
    const trends: Record<string, number> = { improving: 0, stable: 0, declining: 0, unknown: 0 };
    let worstHuc = '';
    let worstValue = -1;

    for (const huc of hucs) {
      const score = huc[id] as IndexScore | undefined;
      if (score) {
        values.push(score.value);
        confidences.push(score.confidence);
        trends[score.trend]++;
        if (score.value > worstValue) {
          worstValue = score.value;
          worstHuc = huc.huc8;
        }
      }
    }

    const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    const avgConf = confidences.length > 0 ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0;
    const dominant = (Object.entries(trends) as [string, number][]).sort((a, b) => b[1] - a[1])[0][0] as IndexStat['trend'];

    return { id, label: INDEX_LABELS[id], avg, avgConfidence: avgConf, trend: dominant, worstHuc, worstValue: Math.round(worstValue) };
  });

  // Per-HUC risk approximation
  const hucRisks: HucRiskRow[] = hucs.map(huc => {
    const preds = approximateRisks(huc);
    const nonRoi = preds.filter(p => p.id !== 'intervention-roi');
    const topRisk = nonRoi.reduce((max, p) => (p.probability > max.probability ? p : max), nonRoi[0]);
    return {
      huc8: huc.huc8,
      stateAbbr: huc.stateAbbr,
      composite: huc.composite,
      predictions: preds,
      topRisk,
      avgConfidence: huc.compositeConfidence,
    };
  }).sort((a, b) => b.topRisk.probability - a.topRisk.probability);

  // Per-prediction heatmap
  const heatmap = PREDICTIONS.filter(p => p.id !== 'intervention-roi').map(pred => {
    let red = 0, amber = 0, green = 0;
    for (const row of hucRisks) {
      const match = row.predictions.find(p => p.id === pred.id);
      if (match) {
        if (match.level === 'red') red++;
        else if (match.level === 'amber') amber++;
        else green++;
      }
    }
    return { id: pred.id, label: pred.label, red, amber, green, total: red + amber + green };
  });

  // Per-index confidence
  const confidenceStats = ALL_INDEX_IDS.map(id => {
    const stat = indexStats.find(s => s.id === id)!;
    let high = 0, moderate = 0, low = 0;
    for (const huc of hucs) {
      const score = huc[id] as IndexScore | undefined;
      if (score) {
        if (score.confidence >= 70) high++;
        else if (score.confidence >= 40) moderate++;
        else low++;
      }
    }
    return { id, label: INDEX_LABELS[id], short: INDEX_SHORT[id], avgConfidence: stat.avgConfidence, high, moderate, low };
  });

  return { indexStats, hucRisks, heatmap, confidenceStats };
}

// ─── P/S matrix (matches v2 spec Table 3) ───────────────────────────────────
// Row = prediction, column = index. P = Primary driver, S = Secondary input.
// This uses the 9 implemented indices mapped to the spec's 14-index P/S grid.

type MatrixRole = 'P' | 'S' | '';

const PS_MATRIX: Record<PredictionId, Record<IndexId, MatrixRole>> = {
  'infrastructure-failure': {
    pearlLoadVelocity: 'S', infrastructureFailure: 'P', watershedRecovery: '',
    permitRiskExposure: 'S', perCapitaLoad: 'S', waterfrontExposure: '',
    ecologicalHealth: '', ejVulnerability: 'S', governanceResponse: '',
  },
  'impairment-breach': {
    pearlLoadVelocity: 'P', infrastructureFailure: 'S', watershedRecovery: 'S',
    permitRiskExposure: 'S', perCapitaLoad: '', waterfrontExposure: '',
    ecologicalHealth: 'S', ejVulnerability: '', governanceResponse: '',
  },
  'enforcement-probability': {
    pearlLoadVelocity: 'S', infrastructureFailure: 'P', watershedRecovery: '',
    permitRiskExposure: 'P', perCapitaLoad: '', waterfrontExposure: '',
    ecologicalHealth: '', ejVulnerability: '', governanceResponse: 'S',
  },
  'capacity-exceedance': {
    pearlLoadVelocity: 'P', infrastructureFailure: 'P', watershedRecovery: '',
    permitRiskExposure: '', perCapitaLoad: 'S', waterfrontExposure: '',
    ecologicalHealth: '', ejVulnerability: '', governanceResponse: '',
  },
  'cascading-impact': {
    pearlLoadVelocity: 'S', infrastructureFailure: 'S', watershedRecovery: 'S',
    permitRiskExposure: '', perCapitaLoad: '', waterfrontExposure: '',
    ecologicalHealth: 'S', ejVulnerability: 'P', governanceResponse: '',
  },
  'recovery-timeline': {
    pearlLoadVelocity: 'S', infrastructureFailure: 'S', watershedRecovery: 'P',
    permitRiskExposure: '', perCapitaLoad: '', waterfrontExposure: '',
    ecologicalHealth: 'S', ejVulnerability: '', governanceResponse: 'S',
  },
  'public-health-exposure': {
    pearlLoadVelocity: 'S', infrastructureFailure: 'S', watershedRecovery: 'S',
    permitRiskExposure: '', perCapitaLoad: '', waterfrontExposure: '',
    ecologicalHealth: '', ejVulnerability: 'P', governanceResponse: '',
  },
  'intervention-roi': {
    pearlLoadVelocity: 'S', infrastructureFailure: 'S', watershedRecovery: 'P',
    permitRiskExposure: 'S', perCapitaLoad: '', waterfrontExposure: '',
    ecologicalHealth: 'S', ejVulnerability: 'S', governanceResponse: '',
  },
};

// ─── Component ──────────────────────────────────────────────────────────────

const RISK_COLORS = { red: '#ef4444', amber: '#f59e0b', green: '#22c55e', gray: '#94a3b8' };
const RISK_BG: Record<RiskLevel, string> = { red: 'bg-red-50', amber: 'bg-amber-50', green: 'bg-green-50', gray: 'bg-slate-50' };
const RISK_TEXT: Record<RiskLevel, string> = { red: 'text-red-700', amber: 'text-amber-700', green: 'text-green-700', gray: 'text-slate-500' };
const RISK_DOT: Record<RiskLevel, string> = { red: 'bg-red-500', amber: 'bg-amber-500', green: 'bg-green-500', gray: 'bg-slate-400' };

const TREND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  improving: TrendingUp,
  declining: TrendingDown,
  stable: Target,
  unknown: Info,
};

export default function PredictiveRiskEnginePanel() {
  const [hucs, setHucs] = useState<HucIndices[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedHuc, setExpandedHuc] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/indices')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setHucs(data.hucIndices || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const stats = useMemo(() => {
    if (hucs.length === 0) return null;
    return computeNationalStats(hucs);
  }, [hucs]);

  // weightMatrix removed — using spec P/S matrix instead

  // ── Loading state ──
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400 mr-3" />
          <span className="text-sm text-slate-500">Loading indices data...</span>
        </CardContent>
      </Card>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-12 justify-center">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span className="text-sm text-slate-600">Failed to load indices: {error}</span>
        </CardContent>
      </Card>
    );
  }

  // ── Empty state ──
  if (!stats || hucs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16">
          <Info className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500 text-center max-w-md">
            Indices cache is empty. The indices cron builds data daily — check{' '}
            <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">/api/cache-status</code>{' '}
            for cache health.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { indexStats, hucRisks, heatmap, confidenceStats } = stats;
  const top20 = hucRisks.slice(0, 20);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold text-slate-800">Predictive Risk Engine</h2>
          <Badge variant="outline" className="text-2xs font-mono">
            {hucs.length} HUCs
          </Badge>
        </div>
        <p className="text-xs text-slate-500">
          9 indices x 8 FICO-style predictions — national fleet view
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: Index Health Overview                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Index Health Overview</CardTitle>
          <CardDescription className="text-xs">National averages across all {hucs.length} HUCs for each of the 9 proprietary indices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 9 index tiles */}
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
            {indexStats.map(stat => {
              const TrendIcon = TREND_ICON[stat.trend] || Info;
              const trendColor = stat.trend === 'improving' ? 'text-green-500' : stat.trend === 'declining' ? 'text-red-500' : 'text-slate-400';
              const confTier = stat.avgConfidence >= 70 ? 'HIGH' : stat.avgConfidence >= 40 ? 'MOD' : 'LOW';
              const confColor = stat.avgConfidence >= 70 ? 'bg-green-100 text-green-700' : stat.avgConfidence >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500';
              return (
                <div key={stat.id} className="border border-slate-200 rounded-lg p-2 bg-white text-center space-y-1">
                  <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider truncate" title={stat.label}>
                    {INDEX_SHORT[stat.id]}
                  </p>
                  <p className="text-xl font-bold text-slate-800">{stat.avg}</p>
                  <div className="flex items-center justify-center gap-1">
                    <TrendIcon className={`h-3 w-3 ${trendColor}`} />
                    <span className={`text-2xs px-1 py-0.5 rounded ${confColor}`}>{confTier}</span>
                  </div>
                  <p className="text-2xs text-slate-400 truncate" title={`Worst: ${stat.worstHuc}`}>
                    Worst: {stat.worstHuc || '—'}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Radar chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={indexStats.map(s => ({ index: INDEX_SHORT[s.id], value: s.avg, fullMark: 100 }))}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="index" tick={{ fontSize: 10, fill: '#64748b' }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar name="National Avg" dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: Index-to-Prediction Matrix                                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Index-to-Prediction Matrix</CardTitle>
          <CardDescription className="text-xs"><strong>P</strong> = Primary driver, <strong>S</strong> = Secondary/contextual input. Mapped from v2 spec across 9 implemented indices.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-2xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-2 text-slate-500 font-semibold sticky left-0 bg-white z-10">Prediction</th>
                  {ALL_INDEX_IDS.map(id => (
                    <th key={id} className="text-center px-1 py-2 text-slate-500 font-semibold whitespace-nowrap">
                      {INDEX_SHORT[id]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PREDICTIONS.map(pred => (
                  <tr key={pred.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-1.5 pr-2 font-medium text-slate-700 whitespace-nowrap sticky left-0 bg-white z-10">
                      {pred.label}
                    </td>
                    {ALL_INDEX_IDS.map(idx => {
                      const role = PS_MATRIX[pred.id]?.[idx] ?? '';
                      if (!role) return <td key={idx} className="text-center px-1 py-1.5" />;
                      return (
                        <td key={idx} className="text-center px-1 py-1.5">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-2xs font-bold ${
                            role === 'P' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {role}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-2xs text-slate-400 mt-2">
            Showing 9 implemented indices. The full v2 spec defines 14 indices — 5 additional indices (Treatment Efficacy, Climate Vulnerability, Contaminant Interaction, Source Attribution, Temporal Trend Severity) are planned.
          </p>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3: National Risk Heatmap                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">National Risk Heatmap</CardTitle>
          <CardDescription className="text-xs">Distribution of HUCs across risk tiers per prediction category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={heatmap} layout="vertical" margin={{ left: 120, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={110} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(val: number, name: string) => [val, name === 'red' ? 'High Risk' : name === 'amber' ? 'Moderate' : 'Low Risk']}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="red" stackId="a" fill={RISK_COLORS.red} name="High Risk" radius={[0, 0, 0, 0]} />
                <Bar dataKey="amber" stackId="a" fill={RISK_COLORS.amber} name="Moderate" />
                <Bar dataKey="green" stackId="a" fill={RISK_COLORS.green} name="Low Risk" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4: Prediction Cycle                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Prediction Cycle</CardTitle>
          <CardDescription className="text-xs">5-phase cycle: Predict → Quantify → Respond → Resolve → Cycle Reset</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {[
              { phase: 'PREDICT', icon: Zap, color: 'text-blue-600 bg-blue-50 border-blue-200', features: ['Infra Failure, Impairment Breach', 'Enforcement, Capacity, Public Health'], feature: 'PIN Water Score dashboard, alerts, risk rankings' },
              { phase: 'QUANTIFY', icon: Gauge, color: 'text-indigo-600 bg-indigo-50 border-indigo-200', features: ['Expected Loss = Prob \u00d7 Cost', 'Prevention vs. Failure comparison'], feature: 'Scenario Planner \u2014 cost modeling by role/state/domain' },
              { phase: 'RESPOND', icon: Target, color: 'text-amber-600 bg-amber-50 border-amber-200', features: ['Cascading Impact Projection', 'Public Health (crisis mode)'], feature: 'Response Planner \u2014 crisis plans, cascade modeling' },
              { phase: 'RESOLVE', icon: Wrench, color: 'text-green-600 bg-green-50 border-green-200', features: ['Recovery Timeline Estimate', 'Intervention ROI Forecast'], feature: 'Resolution Planner \u2014 actions, outcomes, cost-benefit' },
              { phase: 'CYCLE RESET', icon: RefreshCw, color: 'text-purple-600 bg-purple-50 border-purple-200', features: ['All 8 categories recalculated', 'Forecast accuracy vs. actuals'], feature: 'Updated PIN Water Score, new baseline' },
            ].map((step, i) => {
              const StepIcon = step.icon;
              return (
                <div key={step.phase} className={`rounded-lg border p-2.5 ${step.color} relative`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <StepIcon className="h-3.5 w-3.5" />
                    <span className="text-2xs font-bold uppercase tracking-wide">{step.phase}</span>
                  </div>
                  <ul className="space-y-1 mb-2">
                    {step.features.map(f => (
                      <li key={f} className="text-2xs text-slate-600 flex items-center gap-1">
                        <CheckCircle className="h-2.5 w-2.5 text-slate-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <p className="text-2xs text-slate-500 border-t border-current/10 pt-1.5">{step.feature}</p>
                  {i < 4 && (
                    <div className="absolute top-1/2 -right-1.5 transform -translate-y-1/2 text-slate-300 text-sm font-bold hidden lg:block">
                      ›
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 5: Top Risk HUCs                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top Risk HUCs</CardTitle>
          <CardDescription className="text-xs">Top 20 HUCs ranked by highest approximate risk probability</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="text-left py-2 pr-3 font-semibold">#</th>
                  <th className="text-left py-2 pr-3 font-semibold">HUC-8</th>
                  <th className="text-left py-2 pr-3 font-semibold">State</th>
                  <th className="text-right py-2 pr-3 font-semibold">Composite</th>
                  <th className="text-left py-2 pr-3 font-semibold">Top Risk Category</th>
                  <th className="text-center py-2 pr-3 font-semibold">Risk Level</th>
                  <th className="text-right py-2 font-semibold">Confidence</th>
                  <th className="py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {top20.map((row, i) => {
                  const isExpanded = expandedHuc === row.huc8;
                  const rowTier = confidenceTier(row.avgConfidence);
                  const topDisplay = formatProbDisplay(row.topRisk.probability, rowTier, row.topRisk.level);
                  return (
                    <React.Fragment key={row.huc8}>
                      <tr className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${isExpanded ? 'bg-slate-50' : ''}`}
                        onClick={() => setExpandedHuc(isExpanded ? null : row.huc8)}>
                        <td className="py-2 pr-3 text-slate-400 font-mono">{i + 1}</td>
                        <td className="py-2 pr-3 font-mono font-medium text-slate-700">{row.huc8}</td>
                        <td className="py-2 pr-3 text-slate-600">{row.stateAbbr}</td>
                        <td className="py-2 pr-3 text-right font-bold text-slate-800">{Math.round(row.composite)}</td>
                        <td className="py-2 pr-3 text-slate-700">{row.topRisk.label}</td>
                        <td className="py-2 pr-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold ${RISK_BG[row.topRisk.level]} ${RISK_TEXT[row.topRisk.level]}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[row.topRisk.level]}`} />
                            {topDisplay}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          <span className={`text-2xs px-1.5 py-0.5 rounded ${
                            rowTier === 'HIGH' ? 'bg-green-100 text-green-700' : rowTier === 'MODERATE' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                          }`}>{rowTier}</span>
                        </td>
                        <td className="py-2 text-center">
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-4 py-3 bg-slate-50">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {row.predictions.map(pred => {
                                const predDisplay = formatProbDisplay(pred.probability, rowTier, pred.level);
                                return (
                                  <div key={pred.id} className="flex items-center gap-2 p-2 rounded border border-slate-200 bg-white">
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${RISK_DOT[pred.level]}`} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-2xs font-medium text-slate-700 truncate">{pred.label}</p>
                                      <p className={`text-xs font-bold ${RISK_TEXT[pred.level]}`}>{predDisplay}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hucRisks.length > 20 && (
            <p className="text-2xs text-slate-400 mt-2 text-center">
              Showing top 20 of {hucRisks.length} HUCs
            </p>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 6: Confidence Dashboard                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Confidence Dashboard</CardTitle>
          <CardDescription className="text-xs">Average confidence per index with tier distribution across all HUCs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bar chart of confidence averages */}
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confidenceStats.map(c => ({ name: c.short, confidence: c.avgConfidence }))} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="confidence" name="Avg Confidence" radius={[4, 4, 0, 0]}>
                  {confidenceStats.map(c => (
                    <Cell key={c.id} fill={c.avgConfidence >= 70 ? '#22c55e' : c.avgConfidence >= 40 ? '#f59e0b' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tier distribution */}
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
            {confidenceStats.map(c => {
              const total = c.high + c.moderate + c.low;
              return (
                <div key={c.id} className="border border-slate-200 rounded-lg p-2 text-center bg-white">
                  <p className="text-2xs font-semibold text-slate-500 uppercase truncate" title={c.label}>{c.short}</p>
                  <div className="flex justify-center gap-0.5 mt-1.5">
                    {total > 0 && (
                      <>
                        <div className="h-3 bg-green-400 rounded-l" style={{ width: `${(c.high / total) * 40}px` }} title={`HIGH: ${c.high}`} />
                        <div className="h-3 bg-amber-400" style={{ width: `${(c.moderate / total) * 40}px` }} title={`MOD: ${c.moderate}`} />
                        <div className="h-3 bg-slate-300 rounded-r" style={{ width: `${(c.low / total) * 40}px` }} title={`LOW: ${c.low}`} />
                      </>
                    )}
                  </div>
                  <p className="text-2xs text-slate-400 mt-1">{c.high}H / {c.moderate}M / {c.low}L</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Confidence Display Guardrails */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { tier: 'HIGH' as const, color: 'bg-green-100 text-green-700', format: 'Point estimate with narrow band', example: '68% (\u00b18%)', guardrail: 'Full prediction with specific timelines' },
          { tier: 'MODERATE' as const, color: 'bg-amber-100 text-amber-700', format: 'Range estimate', example: '45\u201365%', guardrail: 'Prediction with data limitation caveats' },
          { tier: 'LOW' as const, color: 'bg-slate-100 text-slate-500', format: 'Directional indicator only', example: '"Elevated risk"', guardrail: 'No specific probabilities. Flag data gaps.' },
        ].map(t => (
          <div key={t.tier} className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1">
            <span className={`inline-block px-1.5 py-0.5 rounded text-2xs font-bold ${t.color}`}>{t.tier}</span>
            <p className="text-2xs text-slate-600"><span className="font-semibold">Format:</span> {t.format}</p>
            <p className="text-2xs text-slate-500 font-mono">{t.example}</p>
            <p className="text-2xs text-slate-400">{t.guardrail}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
