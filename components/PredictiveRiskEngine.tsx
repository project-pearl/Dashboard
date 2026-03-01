'use client';

import React, { useState } from 'react';
import {
  Wrench, Waves, Scale, Gauge, GitBranch, Clock, HeartPulse, TrendingUp,
  ChevronDown, ChevronUp, Info, Target, AlertTriangle, Shield, BarChart3,
  Zap, Eye, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MockDataBadge } from './MockDataBadge';
import type { RiskPrediction, RiskLevel, ConfidenceTier, ContributingFactor } from '@/lib/siteIntelTypes';

// ─── Icon Map ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  Wrench, Waves, Scale, Gauge, GitBranch, Clock, HeartPulse, TrendingUp,
};

// ─── Color Maps ──────────────────────────────────────────────────────────────

const RISK_COLORS: Record<RiskLevel, { bg: string; text: string; bar: string; dot: string; border: string }> = {
  green: { bg: 'bg-green-50', text: 'text-green-700', bar: 'bg-green-500', dot: 'bg-green-500', border: 'border-green-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500', dot: 'bg-amber-500', border: 'border-amber-200' },
  red:   { bg: 'bg-red-50',   text: 'text-red-700',   bar: 'bg-red-500',   dot: 'bg-red-500',   border: 'border-red-200' },
  gray:  { bg: 'bg-slate-50', text: 'text-slate-500',  bar: 'bg-slate-400', dot: 'bg-slate-400', border: 'border-slate-200' },
};

const CONFIDENCE_BADGE: Record<ConfidenceTier, { bg: string; text: string }> = {
  HIGH:     { bg: 'bg-green-100', text: 'text-green-700' },
  MODERATE: { bg: 'bg-amber-100', text: 'text-amber-700' },
  LOW:      { bg: 'bg-slate-100', text: 'text-slate-500' },
};

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_PREDICTIONS: RiskPrediction[] = [
  {
    category: 'infrastructure-failure',
    label: 'Infrastructure Failure Forecast',
    probability: 68,
    riskLevel: 'red',
    timeframe: '12 months',
    confidence: 'HIGH',
    summary: 'Your system has a 68% probability of an SSO event in the next 12 months.',
    icon: 'Wrench',
    factors: [
      { name: 'Infrastructure Failure Prob.', value: 82, weight: 0.30, direction: 'negative' },
      { name: 'Treatment Efficacy Index', value: 45, weight: 0.20, direction: 'negative' },
      { name: 'Climate Vulnerability Factor', value: 71, weight: 0.20, direction: 'negative' },
      { name: 'PEARL Load Velocity', value: 58, weight: 0.10, direction: 'negative' },
      { name: 'Reg. Compliance Trajectory', value: 35, weight: 0.10, direction: 'neutral' },
      { name: 'Data Confidence Level', value: 88, weight: 0.05, direction: 'positive' },
      { name: 'Population Exposure Risk', value: 62, weight: 0.05, direction: 'negative' },
    ],
  },
  {
    category: 'impairment-breach',
    label: 'Impairment Threshold Breach',
    probability: 74,
    riskLevel: 'red',
    timeframe: 'Q3 2026',
    confidence: 'HIGH',
    summary: 'At current loading rates, Mill Creek will cross the impairment threshold for dissolved oxygen by Q3 2026.',
    icon: 'Waves',
    factors: [
      { name: 'PEARL Load Velocity', value: 78, weight: 0.25, direction: 'negative' },
      { name: 'Climate Vulnerability Factor', value: 71, weight: 0.20, direction: 'negative' },
      { name: 'Contaminant Interaction', value: 65, weight: 0.20, direction: 'negative' },
      { name: 'Temporal Trend Severity', value: 72, weight: 0.15, direction: 'negative' },
      { name: 'Infrastructure Failure Prob.', value: 52, weight: 0.10, direction: 'negative' },
      { name: 'Treatment Efficacy Index', value: 40, weight: 0.05, direction: 'neutral' },
      { name: 'Data Confidence Level', value: 85, weight: 0.05, direction: 'positive' },
    ],
  },
  {
    category: 'enforcement-probability',
    label: 'Regulatory Enforcement Probability',
    probability: 55,
    riskLevel: 'amber',
    timeframe: 'next permit cycle',
    confidence: 'MODERATE',
    summary: 'Based on your compliance trajectory, there is a 55% probability of receiving an NOV within the next permit cycle.',
    icon: 'Scale',
    factors: [
      { name: 'Reg. Compliance Trajectory', value: 68, weight: 0.30, direction: 'negative' },
      { name: 'Infrastructure Failure Prob.', value: 52, weight: 0.20, direction: 'negative' },
      { name: 'Population Exposure Risk', value: 62, weight: 0.15, direction: 'negative' },
      { name: 'Temporal Trend Severity', value: 55, weight: 0.15, direction: 'negative' },
      { name: 'Contaminant Interaction', value: 40, weight: 0.10, direction: 'neutral' },
      { name: 'Data Confidence Level', value: 72, weight: 0.05, direction: 'positive' },
      { name: 'Source Attribution Confidence', value: 60, weight: 0.05, direction: 'neutral' },
    ],
  },
  {
    category: 'capacity-exceedance',
    label: 'Capacity Exceedance Risk',
    probability: 87,
    riskLevel: 'red',
    timeframe: 'Q2 2027',
    confidence: 'HIGH',
    summary: 'At current growth rates, your WWTP will exceed design capacity by Q2 2027. Assimilative capacity in the receiving stream is already at 87%.',
    icon: 'Gauge',
    factors: [
      { name: 'PEARL Load Velocity', value: 91, weight: 0.25, direction: 'negative' },
      { name: 'Infrastructure Failure Prob.', value: 75, weight: 0.20, direction: 'negative' },
      { name: 'Treatment Efficacy Index', value: 38, weight: 0.20, direction: 'negative' },
      { name: 'Climate Vulnerability Factor', value: 71, weight: 0.15, direction: 'negative' },
      { name: 'Contaminant Interaction', value: 55, weight: 0.10, direction: 'negative' },
      { name: 'Data Confidence Level', value: 90, weight: 0.05, direction: 'positive' },
      { name: 'Temporal Trend Severity', value: 60, weight: 0.05, direction: 'negative' },
    ],
  },
  {
    category: 'cascading-impact',
    label: 'Cascading Impact Projection',
    probability: 41,
    riskLevel: 'amber',
    timeframe: '72 hours',
    confidence: 'MODERATE',
    summary: 'A failure at the Potomac Interceptor will impact 47 downstream assessment units, 3 drinking water intakes, and 12 MS4 jurisdictions within 72 hours.',
    icon: 'GitBranch',
    factors: [
      { name: 'Cross-Domain Impact', value: 78, weight: 0.25, direction: 'negative' },
      { name: 'Climate Vulnerability Factor', value: 65, weight: 0.20, direction: 'negative' },
      { name: 'Contaminant Interaction', value: 60, weight: 0.15, direction: 'negative' },
      { name: 'PEARL Load Velocity', value: 50, weight: 0.10, direction: 'neutral' },
      { name: 'Infrastructure Failure Prob.', value: 52, weight: 0.10, direction: 'negative' },
      { name: 'Population Exposure Risk', value: 62, weight: 0.10, direction: 'negative' },
      { name: 'Watershed Recovery Rate', value: 35, weight: 0.05, direction: 'neutral' },
      { name: 'Data Confidence Level', value: 68, weight: 0.05, direction: 'neutral' },
    ],
  },
  {
    category: 'recovery-timeline',
    label: 'Recovery Timeline Estimate',
    probability: 62,
    riskLevel: 'amber',
    timeframe: '18-24 months',
    confidence: 'MODERATE',
    summary: 'If restoration begins now, this watershed is projected to return to attainment status in 18-24 months. Delay by 12 months extends recovery to 36-48 months.',
    icon: 'Clock',
    factors: [
      { name: 'Watershed Recovery Rate', value: 42, weight: 0.30, direction: 'negative' },
      { name: 'Treatment Efficacy Index', value: 55, weight: 0.20, direction: 'neutral' },
      { name: 'Intervention ROI Predictor', value: 70, weight: 0.15, direction: 'positive' },
      { name: 'Ecosystem Service Valuation', value: 48, weight: 0.10, direction: 'neutral' },
      { name: 'PEARL Load Velocity', value: 58, weight: 0.10, direction: 'negative' },
      { name: 'Source Attribution Confidence', value: 60, weight: 0.10, direction: 'neutral' },
      { name: 'Data Confidence Level', value: 75, weight: 0.05, direction: 'positive' },
    ],
  },
  {
    category: 'public-health-exposure',
    label: 'Public Health Exposure Forecast',
    probability: 48,
    riskLevel: 'amber',
    timeframe: '18 months',
    confidence: 'MODERATE',
    summary: 'At current contamination trends, an estimated 42,000 residents served by this drinking water system face elevated PFAS exposure risk within 18 months.',
    icon: 'HeartPulse',
    factors: [
      { name: 'Population Exposure Risk', value: 75, weight: 0.25, direction: 'negative' },
      { name: 'Contaminant Interaction', value: 68, weight: 0.20, direction: 'negative' },
      { name: 'Cross-Domain Impact', value: 55, weight: 0.15, direction: 'negative' },
      { name: 'PEARL Load Velocity', value: 58, weight: 0.10, direction: 'negative' },
      { name: 'Infrastructure Failure Prob.', value: 45, weight: 0.10, direction: 'neutral' },
      { name: 'Watershed Recovery Rate', value: 40, weight: 0.10, direction: 'neutral' },
      { name: 'Data Confidence Level', value: 65, weight: 0.05, direction: 'neutral' },
      { name: 'Source Attribution Confidence', value: 55, weight: 0.05, direction: 'neutral' },
    ],
  },
  {
    category: 'intervention-roi',
    label: 'Intervention ROI Forecast',
    probability: 82,
    riskLevel: 'green',
    timeframe: '10 years',
    confidence: 'HIGH',
    summary: 'Installing a bioretention system at this location is projected to improve your watershed score by 15 points, reduce enforcement probability by 22%, and deliver a 3.2x return on investment over 10 years.',
    icon: 'TrendingUp',
    factors: [
      { name: 'Intervention ROI Predictor', value: 85, weight: 0.25, direction: 'positive' },
      { name: 'Source Attribution Confidence', value: 72, weight: 0.20, direction: 'positive' },
      { name: 'Ecosystem Service Valuation', value: 68, weight: 0.15, direction: 'positive' },
      { name: 'Watershed Recovery Rate', value: 42, weight: 0.10, direction: 'neutral' },
      { name: 'Treatment Efficacy Index', value: 55, weight: 0.10, direction: 'positive' },
      { name: 'PEARL Load Velocity', value: 58, weight: 0.05, direction: 'neutral' },
      { name: 'Contaminant Interaction', value: 40, weight: 0.05, direction: 'neutral' },
      { name: 'Data Confidence Level', value: 88, weight: 0.05, direction: 'positive' },
      { name: 'Reg. Compliance Trajectory', value: 50, weight: 0.05, direction: 'neutral' },
    ],
  },
];

// ─── Index → Prediction Matrix (Table 2 from doc) ───────────────────────────
// P = Primary, S = Secondary, '' = no contribution

type MatrixRole = 'P' | 'S' | '';

interface IndexRow {
  name: string;
  mapping: [MatrixRole, MatrixRole, MatrixRole, MatrixRole, MatrixRole, MatrixRole, MatrixRole, MatrixRole];
}

const PREDICTION_ABBREVS = ['Infra', 'Impr', 'Enf', 'Cap', 'Casc', 'Recv', 'PH', 'ROI'];

const INDEX_MATRIX: IndexRow[] = [
  { name: 'PEARL Load Velocity',           mapping: ['S','P','S','P','S','S','S','S'] },
  { name: 'Infrastructure Failure Prob.',   mapping: ['P','S','P','P','S','S','S','S'] },
  { name: 'Watershed Recovery Rate',        mapping: ['','S','','','S','P','S','P'] },
  { name: 'Reg. Compliance Trajectory',     mapping: ['S','S','P','','','S','','S'] },
  { name: 'Contaminant Interaction',        mapping: ['','P','S','S','P','S','P','S'] },
  { name: 'Source Attribution Confidence',  mapping: ['S','S','S','','S','S','S','P'] },
  { name: 'Ecosystem Service Valuation',    mapping: ['','S','','','S','S','S','P'] },
  { name: 'Treatment Efficacy Index',       mapping: ['P','S','S','P','S','P','','P'] },
  { name: 'Climate Vulnerability Factor',   mapping: ['P','P','S','P','P','S','S','S'] },
  { name: 'Data Confidence Level',          mapping: ['S','S','S','S','S','S','S','S'] },
  { name: 'Population Exposure Risk',       mapping: ['S','','P','','P','','P','S'] },
  { name: 'Temporal Trend Severity',        mapping: ['S','P','P','S','S','S','S','S'] },
  { name: 'Cross-Domain Impact',            mapping: ['S','S','S','S','P','S','P','S'] },
  { name: 'Intervention ROI Predictor',     mapping: ['','S','','','','P','','P'] },
];

// ─── Prediction Cycle (Table 4) ─────────────────────────────────────────────

const PREDICTION_CYCLE = [
  {
    phase: 'PREDICT',
    icon: Eye,
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    iconColor: 'text-blue-600',
    categories: ['Infrastructure Failure', 'Impairment Breach', 'Enforcement Probability', 'Capacity Exceedance', 'Public Health Exposure'],
    feature: 'PIN Water Score dashboard, "What You Missed" digest, automated alerts, risk rankings',
  },
  {
    phase: 'RESPOND',
    icon: Zap,
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    iconColor: 'text-amber-600',
    categories: ['Cascading Impact', 'Public Health Exposure (crisis mode)'],
    feature: 'Response Planner — crisis plans, real-time cascade modeling, resource allocation',
  },
  {
    phase: 'RESOLVE',
    icon: Shield,
    color: 'bg-green-50 border-green-200 text-green-700',
    iconColor: 'text-green-600',
    categories: ['Recovery Timeline', 'Intervention ROI'],
    feature: 'Resolution Planner — recommended actions, projected outcomes, cost-benefit analysis',
  },
  {
    phase: 'PREDICT AGAIN',
    icon: RefreshCw,
    color: 'bg-purple-50 border-purple-200 text-purple-700',
    iconColor: 'text-purple-600',
    categories: ['All 8 categories recalculated with post-intervention data'],
    feature: 'Updated PIN Water Score, new baseline, "Your score improved X points" notification',
  },
];

// ─── Confidence Tiers (Table 5) ──────────────────────────────────────────────

const CONFIDENCE_TIERS: { tier: ConfidenceTier; criteria: string; format: string; guardrail: string }[] = [
  {
    tier: 'HIGH',
    criteria: 'Dense monitoring data, recent assessments, multiple corroborating sources',
    format: 'Point estimate with narrow confidence band: "68% probability (+/-8%)"',
    guardrail: 'Full prediction output with specific timelines and quantified impacts',
  },
  {
    tier: 'MODERATE',
    criteria: 'Some monitoring gaps, older assessment data, fewer corroborating sources',
    format: 'Range estimate: "45-65% probability"',
    guardrail: 'Prediction with caveats about data limitations and wider confidence interval',
  },
  {
    tier: 'LOW',
    criteria: 'Sparse data, stale assessments, single-source information',
    format: 'Directional indicator only: "Elevated risk" / "Trending toward exceedance"',
    guardrail: 'No specific probabilities or timelines. Flag data gaps. Recommend additional monitoring.',
  },
];

// ─── Segment Examples (section 4.1 from doc) ─────────────────────────────────

const SEGMENT_EXAMPLES: { segment: string; quote: string }[] = [
  {
    segment: 'Phase II MS4',
    quote: 'Your stormwater infrastructure has a 42% chance of a permit-triggering failure before your next annual report deadline. Key risk: aging outfall structures in the Oak Creek subwatershed.',
  },
  {
    segment: 'Utility',
    quote: 'Pump Station #7 has a 71% probability of failure in the next 6 months based on capacity trends and maintenance history. Failure would cause SSO at outfall 003, impacting 2.3 miles of receiving stream.',
  },
  {
    segment: 'State Agency',
    quote: '14 permitted facilities in your jurisdiction have infrastructure failure probabilities exceeding 50% in the next 12 months. Combined, these facilities serve 340,000 people.',
  },
  {
    segment: 'Federal',
    quote: 'National infrastructure failure risk is concentrated in the Mid-Atlantic and Great Lakes regions. 847 facilities nationally exceed the 60% probability threshold for 12-month failure.',
  },
  {
    segment: 'Real Estate',
    quote: 'The wastewater system serving this parcel has elevated failure probability (58%). Properties in this service area may face service disruptions, potential sewer moratoriums, or special assessments for infrastructure repair.',
  },
  {
    segment: 'Insurance',
    quote: 'Portfolio exposure: 23% of insured municipalities in this region carry infrastructure failure probabilities above 50%. Recommend premium adjustment for environmental liability coverage.',
  },
];

// ─── Prediction Card (inline, mirrors RiskForecastPanel pattern) ─────────────

function PredictionCard({ prediction, segmentQuote }: { prediction: RiskPrediction; segmentQuote?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const colors = RISK_COLORS[prediction.riskLevel];
  const confBadge = CONFIDENCE_BADGE[prediction.confidence];
  const IconComponent = ICON_MAP[prediction.icon] || AlertTriangle;

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-3 space-y-2">
        {/* Icon + label */}
        <div className="flex items-center gap-2">
          <IconComponent className={`h-4 w-4 flex-shrink-0 ${colors.text}`} />
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

        {/* Expand factors toggle */}
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

        {/* Segment quote toggle */}
        {segmentQuote && (
          <>
            <button
              onClick={() => setShowQuote(!showQuote)}
              className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-600 transition-colors"
            >
              {showQuote ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showQuote ? 'Hide' : 'Show'} example output
            </button>
            {showQuote && (
              <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px] text-blue-700 italic leading-relaxed">
                &ldquo;{segmentQuote}&rdquo;
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PredictiveRiskEngine() {
  const [highlightedRow, setHighlightedRow] = useState<number | null>(null);
  const [showSegments, setShowSegments] = useState(false);

  // Compute overall risk from mock predictions
  const redCount = MOCK_PREDICTIONS.filter(p => p.riskLevel === 'red').length;
  const overallRisk: RiskLevel = redCount >= 3 ? 'red' : redCount >= 1 ? 'amber' : 'green';
  const overallColors = RISK_COLORS[overallRisk];
  const avgProbability = Math.round(MOCK_PREDICTIONS.reduce((s, p) => s + p.probability, 0) / MOCK_PREDICTIONS.length);
  const dataCompleteness = 78;

  // Map a segment quote to each prediction card (first 6 get quotes from segments; 7 & 8 don't)
  const segmentQuotes = SEGMENT_EXAMPLES.map(s => s.quote);

  return (
    <div className="space-y-4">

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* A. HERO — "Your Water Risk Forecast" */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Target size={20} className="text-blue-600" />
                  Your Water Risk Forecast
                  <MockDataBadge />
                </h2>
              </div>
              <p className="text-xs text-slate-500 max-w-lg">
                Like a FICO score predicts default — PIN predicts water system risk.
                14 proprietary indices feed 8 forward-looking predictions using public data and disclosed models.
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Composite risk badge */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${overallColors.bg} ${overallColors.border}`}>
                <span className={`w-3 h-3 rounded-full ${overallColors.dot}`} />
                <div>
                  <div className={`text-xs font-bold uppercase tracking-wide ${overallColors.text}`}>
                    {overallRisk === 'red' ? 'HIGH RISK' : overallRisk === 'amber' ? 'MODERATE RISK' : 'LOW RISK'}
                  </div>
                  <div className="text-[10px] text-slate-400">Composite: {avgProbability}% avg</div>
                </div>
              </div>

              {/* Data completeness */}
              <div className="text-center">
                <div className="text-xl font-bold font-mono text-slate-700">{dataCompleteness}%</div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">Data Complete</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* B. 8 PREDICTION CARDS (2×4 grid) */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <BarChart3 size={14} /> 8 Risk Predictions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {MOCK_PREDICTIONS.map((pred, i) => (
            <PredictionCard
              key={pred.category}
              prediction={pred}
              segmentQuote={i < segmentQuotes.length ? segmentQuotes[i] : undefined}
            />
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* C. 14-INDEX → 8-PREDICTION MATRIX TABLE */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 size={16} className="text-indigo-600" />
            Index → Prediction Matrix
          </CardTitle>
          <p className="text-xs text-slate-500">
            14 proprietary indices feed 8 prediction categories. <strong>P</strong> = Primary driver, <strong>S</strong> = Secondary input. Click a row to highlight.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2 font-semibold text-slate-600 sticky left-0 bg-white z-10">Index</th>
                {PREDICTION_ABBREVS.map(abbr => (
                  <th key={abbr} className="text-center py-2 px-1.5 font-semibold text-slate-600 whitespace-nowrap">{abbr}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INDEX_MATRIX.map((row, ri) => (
                <tr
                  key={row.name}
                  className={`border-b border-slate-100 cursor-pointer transition-colors ${
                    highlightedRow === ri ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => setHighlightedRow(highlightedRow === ri ? null : ri)}
                >
                  <td className="py-1.5 px-2 font-medium text-slate-700 sticky left-0 bg-inherit z-10 whitespace-nowrap">
                    {row.name}
                  </td>
                  {row.mapping.map((role, ci) => (
                    <td key={ci} className="text-center py-1.5 px-1.5">
                      {role === 'P' && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold">P</span>
                      )}
                      {role === 'S' && (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">S</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* D. PREDICTION CYCLE VISUALIZATION */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw size={16} className="text-purple-600" />
            Prediction Cycle
          </CardTitle>
          <p className="text-xs text-slate-500">
            4-phase cycle: Predict → Respond → Resolve → Predict Again
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PREDICTION_CYCLE.map((phase, i) => {
              const PhaseIcon = phase.icon;
              return (
                <div key={phase.phase} className="relative">
                  <div className={`rounded-lg border p-3 h-full ${phase.color}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <PhaseIcon size={16} className={phase.iconColor} />
                      <span className="text-xs font-bold uppercase tracking-wide">{phase.phase}</span>
                    </div>
                    <div className="space-y-1 mb-2">
                      {phase.categories.map(cat => (
                        <div key={cat} className="text-[10px] flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                          {cat}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] opacity-70 leading-relaxed border-t border-current/10 pt-2 mt-auto">
                      {phase.feature}
                    </p>
                  </div>
                  {/* Arrow connector */}
                  {i < PREDICTION_CYCLE.length - 1 && (
                    <div className="hidden lg:flex absolute top-1/2 -right-3 z-10 text-slate-300">
                      <ChevronDown size={14} className="rotate-[-90deg]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* E. CONFIDENCE TIERS */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield size={16} className="text-emerald-600" />
            Confidence Tiers
          </CardTitle>
          <p className="text-xs text-slate-500">
            Data quality determines how predictions are displayed and what guardrails apply.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {CONFIDENCE_TIERS.map(ct => {
              const badge = CONFIDENCE_BADGE[ct.tier];
              return (
                <div key={ct.tier} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                  <Badge className={`${badge.bg} ${badge.text} text-[10px]`}>{ct.tier}</Badge>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Data Criteria</div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{ct.criteria}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Display Format</div>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-mono">{ct.format}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Guardrail</div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{ct.guardrail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* F. SEGMENT EXAMPLES (collapsible) */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <Card>
        <div
          className="p-4 cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-between"
          onClick={() => setShowSegments(!showSegments)}
        >
          <div className="flex items-center gap-2">
            <Target size={16} className="text-teal-600" />
            <span className="text-base font-semibold text-slate-900">Customer Segment Examples</span>
            <Badge variant="secondary" className="text-[10px]">6 segments</Badge>
          </div>
          {showSegments ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>

        {showSegments && (
          <CardContent className="pt-0 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {SEGMENT_EXAMPLES.map(seg => (
                <div key={seg.segment} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{seg.segment}</div>
                  <p className="text-[11px] text-slate-700 leading-relaxed italic">&ldquo;{seg.quote}&rdquo;</p>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* G. GUARDRAILS DISCLAIMER */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold">Guardrails:</span>
          <span> Forecasts are intelligence products derived from public data and disclosed models.
          They do not constitute regulatory determinations. Predictions do not replace professional
          engineering analysis for capital planning, do not make clinical or epidemiological claims
          about health outcomes, and represent the best available estimate — not certainty.
          Confidence bands must always be displayed alongside point estimates.
          Data gaps and limitations must be disclosed when they materially affect prediction quality.</span>
        </div>
      </div>
    </div>
  );
}
