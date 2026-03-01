'use client';

import React, { useState } from 'react';
import {
  Wrench, Waves, Scale, Gauge, GitBranch, Clock, HeartPulse, TrendingUp,
  ChevronDown, ChevronUp, AlertTriangle, Info,
} from 'lucide-react';
import type { RiskForecastResult, RiskPrediction, RiskLevel, ConfidenceTier } from '@/lib/siteIntelTypes';

// ─── Constants ──────────────────────────────────────────────────────────────

const RISK_COLORS: Record<RiskLevel, { bg: string; text: string; bar: string; dot: string }> = {
  green: { bg: 'bg-green-50', text: 'text-green-700', bar: 'bg-green-500', dot: 'bg-green-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500', dot: 'bg-amber-500' },
  red:   { bg: 'bg-red-50',   text: 'text-red-700',   bar: 'bg-red-500',   dot: 'bg-red-500' },
  gray:  { bg: 'bg-slate-50', text: 'text-slate-500',  bar: 'bg-slate-400', dot: 'bg-slate-400' },
};

const CONFIDENCE_BADGE: Record<ConfidenceTier, { bg: string; text: string }> = {
  HIGH:     { bg: 'bg-green-100', text: 'text-green-700' },
  MODERATE: { bg: 'bg-amber-100', text: 'text-amber-700' },
  LOW:      { bg: 'bg-slate-100', text: 'text-slate-500' },
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wrench, Waves, Scale, Gauge, GitBranch, Clock, HeartPulse, TrendingUp,
};

// ─── Component ──────────────────────────────────────────────────────────────

interface RiskForecastPanelProps {
  forecast: RiskForecastResult | null | undefined;
}

export default function RiskForecastPanel({ forecast }: RiskForecastPanelProps) {
  if (!forecast) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
        <Info className="h-3.5 w-3.5 flex-shrink-0" />
        Insufficient data to generate risk forecasts for this location.
      </div>
    );
  }

  const overallColors = RISK_COLORS[forecast.overallRiskLevel];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${overallColors.bg} ${overallColors.text}`}>
            <span className={`w-2 h-2 rounded-full mr-1.5 ${overallColors.dot}`} />
            {forecast.overallRiskLevel === 'red' ? 'High Risk' : forecast.overallRiskLevel === 'amber' ? 'Moderate Risk' : 'Low Risk'}
          </span>
        </div>
        <span className="text-[10px] text-slate-400">
          {forecast.dataCompleteness}% data completeness
        </span>
      </div>

      {/* Prediction grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {forecast.predictions.map(prediction => (
          <PredictionCard key={prediction.category} prediction={prediction} />
        ))}
      </div>

      {/* Disclaimer */}
      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Forecasts are intelligence products derived from public data and disclosed models.
          They do not constitute regulatory determinations.
        </span>
      </div>
    </div>
  );
}

// ─── Prediction Card ────────────────────────────────────────────────────────

function PredictionCard({ prediction }: { prediction: RiskPrediction }) {
  const [expanded, setExpanded] = useState(false);
  const colors = RISK_COLORS[prediction.riskLevel];
  const confBadge = CONFIDENCE_BADGE[prediction.confidence];
  const IconComponent = ICON_MAP[prediction.icon] || AlertTriangle;

  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden`}>
      <div className="p-3 space-y-2">
        {/* Icon + label */}
        <div className="flex items-center gap-2">
          <IconComponent className={`h-4 w-4 ${colors.text}`} />
          <span className="text-xs font-semibold text-slate-800 leading-tight">{prediction.label}</span>
        </div>

        {/* Probability bar */}
        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
            style={{ width: `${prediction.probability}%` }}
          />
        </div>

        {/* Probability + badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-sm font-bold ${colors.text}`}>{prediction.probability}%</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
            {prediction.timeframe}
          </span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold ${confBadge.bg} ${confBadge.text}`}>
            {prediction.confidence}
          </span>
        </div>

        {/* Summary */}
        <p className="text-[11px] text-slate-600 leading-relaxed">{prediction.summary}</p>

        {/* Expand toggle */}
        {prediction.factors.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Hide' : 'Show'} factors ({prediction.factors.length})
          </button>
        )}

        {/* Expanded factors */}
        {expanded && (
          <div className="space-y-1 pt-1 border-t border-slate-100">
            {prediction.factors.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  f.direction === 'negative' ? 'bg-red-400' : f.direction === 'positive' ? 'bg-green-400' : 'bg-slate-300'
                }`} />
                <span className="text-slate-600 flex-1 truncate">{f.name}</span>
                <span className="text-slate-400 font-mono">{f.value > 0 ? `+${f.value}` : f.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
