'use client';

import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, AlertTriangle, Droplets, Building2, BarChart3 } from 'lucide-react';
import type { WaterfrontExposureResult } from '@/lib/waterfrontExposure';

const PARAM_LABELS: Record<string, string> = {
  DO: 'Dissolved Oxygen',
  TN: 'Total Nitrogen',
  TP: 'Total Phosphorus',
  TSS: 'Total Suspended Solids',
  turbidity: 'Turbidity',
  pH: 'pH',
  temperature: 'Temperature',
  bacteria: 'Bacteria',
};

function formatDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function riskColor(label: string): string {
  switch (label) {
    case 'High': return 'text-red-400 bg-red-500/10 border-red-500/20';
    case 'Elevated': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'Moderate': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    case 'Low': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    default: return 'text-green-400 bg-green-500/10 border-green-500/20';
  }
}

function riskBannerColor(label: string): string {
  if (label === 'High') return 'bg-red-500/10 border-red-500/30 text-red-400';
  if (label === 'Elevated') return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
  return '';
}

interface WaterfrontExposurePanelProps {
  selectedState?: string;
  stateRollup?: Array<{ abbr: string; score: number }>;
  compactMode?: boolean;
}

export default function WaterfrontExposurePanel({ selectedState = 'MD', compactMode }: WaterfrontExposurePanelProps) {
  const [data, setData] = useState<WaterfrontExposureResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/waterfront-exposure?state=${selectedState}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedState]);

  if (loading) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-white/10 rounded w-48" />
          <div className="h-20 bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-6">
        <p className="text-white/40 text-sm">No exposure data available for {selectedState}.</p>
      </div>
    );
  }

  const showBanner = data.exposureScore >= 50;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">Waterfront Value Exposure</h3>
            <p className="text-[10px] text-white/30">{data.stateAbbr} — Hedonic property risk model</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${riskColor(data.riskLabel)}`}>
          {data.exposureScore} — {data.riskLabel}
        </span>
      </div>

      {/* Risk Banner */}
      {showBanner && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${riskBannerColor(data.riskLabel)}`}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            {data.riskLabel === 'High' ? 'High' : 'Elevated'} Economic Risk — Water quality degradation threatens
            {' '}{formatDollars(data.estimatedValueAtRisk)} per waterfront property
            ({formatDollars(data.aggregateStateRisk * 1_000_000)} aggregate state exposure)
          </span>
        </div>
      )}

      {/* 3-Column Metric Grid */}
      <div className={`grid ${compactMode ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'} gap-3`}>
        {/* Property Values */}
        <div className="bg-white/5 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Property</span>
          </div>
          <Metric label="Median Home Value" value={formatDollars(data.medianHomeValue)} />
          <Metric label="Waterfront Premium" value={`+${data.waterfrontPremiumPct}%`} />
          <Metric label="Est. Waterfront Value" value={formatDollars(data.estimatedWaterfrontValue)} highlight />
          <Metric label="Value at Risk" value={formatDollars(data.estimatedValueAtRisk)} warn={data.depreciationPct >= 10} />
          <Metric label="Depreciation" value={`${data.depreciationPct}%`} muted />
        </div>

        {/* WQ Degradation */}
        <div className="bg-white/5 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Droplets className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">WQ Degradation</span>
          </div>
          <Metric label="Degradation Index" value={data.wqDegradationIndex.toFixed(2)} highlight={data.wqDegradationIndex >= 1.0} />
          <Metric label="Worst Parameter" value={data.worstParameter ? PARAM_LABELS[data.worstParameter] ?? data.worstParameter : 'N/A (ATTAINS)'} />
          <Metric label="Parameters Measured" value={data.parameterCount > 0 ? String(data.parameterCount) : 'Impairment fallback'} />
          <Metric label="Waterfront Share" value={`${data.waterfrontSharePct}%`} muted />
        </div>

        {/* Economic Dependency */}
        <div className="bg-white/5 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Economic Dependency</span>
          </div>
          <Metric label="Water-Dep GDP" value={`${data.waterDepGdpPct}%`} highlight={data.waterDepGdpPct >= 6} />
          <Metric label="Dependency Score" value={`${data.economicDependencyScore}/100`} />
          <Metric label="Aggregate State Risk" value={`$${data.aggregateStateRisk.toLocaleString()}M`} warn={data.aggregateStateRisk >= 5000} />
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="bg-white/[0.03] rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp className="w-3.5 h-3.5 text-white/30" />
          <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Score Breakdown</span>
        </div>
        <div className="text-[11px] text-white/40 font-mono space-y-0.5">
          <p>Waterfront Value = {formatDollars(data.medianHomeValue)} x (1 + {data.waterfrontPremiumPct}%) = {formatDollars(data.estimatedWaterfrontValue)}</p>
          <p>Proximity Factor = min(1.0, {data.waterfrontSharePct}% / 25%) = {Math.min(1.0, data.waterfrontSharePct / 25).toFixed(2)}</p>
          <p>WQ Degradation = {data.wqDegradationIndex.toFixed(2)}{data.worstParameter ? ` (worst: ${PARAM_LABELS[data.worstParameter] ?? data.worstParameter})` : ''}</p>
          <p>Depreciation = clamp(2%, 25%, 2 + ({data.wqDegradationIndex.toFixed(2)} - 0.5) x 15.3) = {data.depreciationPct}%</p>
          <p>Dependency Mult = 1 + ({data.waterDepGdpPct}% / 100) x 2 = {(1 + (data.waterDepGdpPct / 100) * 2).toFixed(3)}</p>
          <p className="text-white/60 font-semibold">Exposure Score = {data.exposureScore}/100 → {data.riskLabel}</p>
        </div>
      </div>

      {/* Source Line */}
      <p className="text-[9px] text-white/20 text-right">
        Census ACS 2018-2022 · BEA Regional GDP · EPA WQP · ATTAINS
      </p>
    </div>
  );
}

function Metric({ label, value, highlight, warn, muted }: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
  muted?: boolean;
}) {
  let valueClass = 'text-white/70';
  if (highlight) valueClass = 'text-white font-semibold';
  if (warn) valueClass = 'text-amber-400 font-semibold';
  if (muted) valueClass = 'text-white/40';

  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-white/40">{label}</span>
      <span className={`text-[11px] ${valueClass}`}>{value}</span>
    </div>
  );
}
