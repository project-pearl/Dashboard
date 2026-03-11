'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
    case 'High':
      return 'text-red-700 bg-red-50 border-red-200';
    case 'Elevated':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'Moderate':
      return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    case 'Low':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    default:
      return 'text-green-700 bg-green-50 border-green-200';
  }
}

function riskBannerColor(label: string): string {
  if (label === 'High') return 'bg-red-50 border-red-200 text-red-800';
  if (label === 'Elevated') return 'bg-amber-50 border-amber-200 text-amber-800';
  return 'bg-emerald-50 border-emerald-200 text-emerald-800';
}

interface WaterfrontExposurePanelProps {
  selectedState?: string;
  stateRollup?: Array<{ abbr: string; score: number }>;
  compactMode?: boolean;
}

type DriverBar = {
  label: string;
  score: number;
  note: string;
  color: string;
};

export default function WaterfrontExposurePanel({ selectedState = 'MD', compactMode }: WaterfrontExposurePanelProps) {
  const [data, setData] = useState<WaterfrontExposureResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/waterfront-exposure?state=${selectedState}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedState]);

  const componentDrivers = useMemo<DriverBar[]>(() => {
    if (!data) return [];

    return [
      {
        label: 'Water Quality',
        score: Math.max(0, Math.min(100, Math.round(data.wqDegradationIndex * 40))),
        note: `${data.wqDegradationIndex.toFixed(2)} index`,
        color: 'bg-cyan-500',
      },
      {
        label: 'Property Exposure',
        score: Math.max(0, Math.min(100, Math.round(data.waterfrontSharePct * 2.5))),
        note: `${data.waterfrontSharePct}% waterfront share`,
        color: 'bg-blue-500',
      },
      {
        label: 'Economic Dependency',
        score: Math.max(0, Math.min(100, Math.round(data.waterDepGdpPct * 10))),
        note: `${data.waterDepGdpPct}% water-dependent GDP`,
        color: 'bg-violet-500',
      },
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-200 rounded w-48" />
          <div className="h-20 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-slate-500 text-sm">No exposure data available for {selectedState}.</p>
      </div>
    );
  }

  const showBanner = data.exposureScore >= 50;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-amber-600" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Waterfront Value Exposure</h3>
            <p className="text-2xs text-slate-500">{data.stateAbbr} - Hedonic property risk model</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${riskColor(data.riskLabel)}`}>
          {data.exposureScore} - {data.riskLabel}
        </span>
      </div>

      {showBanner && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${riskBannerColor(data.riskLabel)}`}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            {data.riskLabel === 'High' ? 'High' : 'Elevated'} Economic Risk - Water quality degradation threatens{' '}
            {formatDollars(data.estimatedValueAtRisk)} per waterfront property ({formatDollars(data.aggregateStateRisk * 1_000_000)} aggregate state exposure)
          </span>
        </div>
      )}

      <div className={`grid ${compactMode ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'} gap-3`}>
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Property</span>
          </div>
          <Metric label="Median Home Value" value={formatDollars(data.medianHomeValue)} />
          <Metric label="Waterfront Premium" value={`+${data.waterfrontPremiumPct}%`} />
          <Metric label="Est. Waterfront Value" value={formatDollars(data.estimatedWaterfrontValue)} highlight />
          <Metric label="Value at Risk" value={formatDollars(data.estimatedValueAtRisk)} warn={data.depreciationPct >= 10} />
          <Metric label="Depreciation" value={`${data.depreciationPct}%`} muted />
        </div>

        <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Droplets className="w-3.5 h-3.5 text-cyan-600" />
            <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">WQ Degradation</span>
          </div>
          <Metric label="Degradation Index" value={data.wqDegradationIndex.toFixed(2)} highlight={data.wqDegradationIndex >= 1.0} />
          <Metric label="Worst Parameter" value={data.worstParameter ? PARAM_LABELS[data.worstParameter] ?? data.worstParameter : 'N/A (ATTAINS)'} />
          <Metric label="Parameters Measured" value={data.parameterCount > 0 ? String(data.parameterCount) : 'Impairment fallback'} />
          <Metric label="Waterfront Share" value={`${data.waterfrontSharePct}%`} muted />
        </div>

        <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Economic Dependency</span>
          </div>
          <Metric label="Water-Dep GDP" value={`${data.waterDepGdpPct}%`} highlight={data.waterDepGdpPct >= 6} />
          <Metric label="Dependency Score" value={`${data.economicDependencyScore}/100`} />
          <Metric label="Aggregate State Risk" value={`$${data.aggregateStateRisk.toLocaleString()}M`} warn={data.aggregateStateRisk >= 5000} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Component Drivers</span>
        </div>
        <div className="space-y-2">
          {componentDrivers.map((driver) => (
            <div key={driver.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{driver.label}</span>
                <span className="font-semibold text-slate-800">{driver.score}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div className={`h-full ${driver.color}`} style={{ width: `${driver.score}%` }} />
              </div>
              <p className="text-2xs text-slate-500">{driver.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-700">Exposure Score = {data.exposureScore}/100 - {data.riskLabel}</p>
      </div>

      <p className="text-2xs text-slate-500 text-right">Census ACS 2018-2022 | BEA Regional GDP | EPA WQP | ATTAINS</p>
    </div>
  );
}

function Metric({ label, value, highlight, warn, muted }: { label: string; value: string; highlight?: boolean; warn?: boolean; muted?: boolean }) {
  let valueClass = 'text-slate-700';
  if (highlight) valueClass = 'text-slate-900 font-semibold';
  if (warn) valueClass = 'text-amber-700 font-semibold';
  if (muted) valueClass = 'text-slate-500';

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs ${valueClass}`}>{value}</span>
    </div>
  );
}
