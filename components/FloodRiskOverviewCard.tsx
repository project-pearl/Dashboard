/* ------------------------------------------------------------------ */
/*  FloodRiskOverviewCard — Watershed-level flood probability          */
/*  Groups gauges by RFC basin and shows risk scores per major waterway*/
/* ------------------------------------------------------------------ */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Droplets,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Clock,
  Gauge,
  Activity,
} from 'lucide-react';
import type { BasinRisk, BasinTopGauge } from '@/app/api/flood-risk-overview/route';

// ── Props ───────────────────────────────────────────────────────────────────

interface FloodRiskOverviewCardProps {
  basins: BasinRisk[];
  national: {
    totalBasins: number;
    totalGauges: number;
    criticalBasins: number;
    highBasins: number;
    elevatedBasins: number;
    totalMajor: number;
    totalModerate: number;
    totalMinor: number;
    totalFlooding: number;
    maxRiskScore: number;
  };
  updatedAt: string | null;
  isLoading: boolean;
  error: string | null;
  onRefresh?: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const RISK_STYLES: Record<string, { bg: string; border: string; text: string; barColor: string }> = {
  critical: { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700',    barColor: 'bg-red-500' },
  high:     { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', barColor: 'bg-orange-500' },
  elevated: { bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-700',  barColor: 'bg-amber-500' },
  moderate: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', barColor: 'bg-yellow-400' },
  low:      { bg: 'bg-slate-50',  border: 'border-slate-200',  text: 'text-slate-500',  barColor: 'bg-slate-300' },
};

function formatTimeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatLeadTime(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1) return 'now';
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

// ── Risk Bar ────────────────────────────────────────────────────────────────

function RiskBar({ score, level }: { score: number; level: string }) {
  const style = RISK_STYLES[level] || RISK_STYLES.low;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${style.barColor}`}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      <span className={`text-[10px] font-bold w-7 text-right ${style.text}`}>
        {score}
      </span>
    </div>
  );
}

// ── Basin Row ───────────────────────────────────────────────────────────────

function BasinRow({ basin }: { basin: BasinRisk }) {
  const [expanded, setExpanded] = useState(false);
  const style = RISK_STYLES[basin.riskLevel] || RISK_STYLES.low;
  const hasActivity = basin.major + basin.moderate + basin.minor + basin.action > 0;

  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} p-3`}>
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm" style={{ color: 'var(--text-bright)' }}>
              {basin.region}
            </span>
            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 uppercase tracking-wider ${style.text} ${style.border}`}>
              {basin.riskLevel}
            </Badge>
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Gauge className="h-3 w-3" />
              {basin.gaugesWithData} gauges
            </span>
            {basin.major > 0 && (
              <span className="flex items-center gap-1 text-red-600 font-medium">
                <AlertTriangle className="h-3 w-3" />
                {basin.major} major
              </span>
            )}
            {basin.moderate > 0 && (
              <span className="flex items-center gap-1 text-orange-600">
                {basin.moderate} moderate
              </span>
            )}
            {basin.minor > 0 && (
              <span className="text-amber-600">{basin.minor} minor</span>
            )}
            {basin.risingTrend > 0 && (
              <span className="flex items-center gap-1 text-blue-600">
                <TrendingUp className="h-3 w-3" />
                {basin.risingTrend} rising
              </span>
            )}
          </div>

          {/* Risk bar */}
          <div className="mt-2 max-w-[200px]">
            <RiskBar score={basin.riskScore} level={basin.riskLevel} />
          </div>
        </div>

        <div className="flex items-center ml-2 shrink-0">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-200/50 space-y-2">
          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2 text-[10px]">
            <StatCell label="Total Gauges" value={basin.totalGauges} />
            <StatCell label="Flooding" value={basin.currentlyFlooding} highlight={basin.currentlyFlooding > 0} />
            <StatCell label="Near Threshold" value={basin.nearThreshold} />
            <StatCell label="RFC" value={basin.rfcCode} />
          </div>

          {/* Top gauges */}
          {basin.topGauges.length > 0 && (
            <div className="space-y-1 mt-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                Highest Risk Gauges
              </span>
              {basin.topGauges.map(g => (
                <TopGaugeRow key={g.lid} gauge={g} />
              ))}
            </div>
          )}

          {!hasActivity && basin.topGauges.length === 0 && (
            <div className="text-[11px] text-slate-400 text-center py-1">
              No flood exceedances predicted in this basin
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className={`font-bold text-sm ${highlight ? 'text-red-600' : 'text-slate-700'}`}>{value}</div>
      <div className="text-slate-400 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function TopGaugeRow({ gauge }: { gauge: BasinTopGauge }) {
  const catColors: Record<string, string> = {
    major: 'text-red-700 border-red-300',
    moderate: 'text-orange-700 border-orange-300',
    minor: 'text-amber-700 border-amber-300',
    action: 'text-yellow-700 border-yellow-300',
    none: 'text-slate-500 border-slate-200',
  };
  const color = catColors[gauge.predictedCategory] || catColors.none;

  return (
    <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-white/60">
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="outline" className={`text-[9px] px-1 py-0 shrink-0 ${color}`}>
          {gauge.predictedCategory}
        </Badge>
        <span className="truncate text-slate-700">{gauge.name || gauge.lid}</span>
        <span className="text-slate-400 shrink-0">{gauge.state}</span>
      </div>
      <div className="flex items-center gap-3 text-slate-500 shrink-0 ml-2">
        {gauge.forecastPeak != null && (
          <span className="text-[10px]">
            peak {gauge.forecastPeak}{gauge.unit}
          </span>
        )}
        {gauge.hoursUntilExceedance != null && (
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {formatLeadTime(gauge.hoursUntilExceedance)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── National Summary Header ─────────────────────────────────────────────────

function NationalSummary({ national }: { national: FloodRiskOverviewCardProps['national'] }) {
  const tiles = [
    { label: 'Basins', value: national.totalBasins, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
    { label: 'Critical', value: national.criticalBasins, color: 'text-red-700', bg: national.criticalBasins > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200' },
    { label: 'High', value: national.highBasins, color: 'text-orange-700', bg: national.highBasins > 0 ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200' },
    { label: 'Flooding', value: national.totalFlooding, color: 'text-blue-700', bg: national.totalFlooding > 0 ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 mb-3">
      {tiles.map(t => (
        <div key={t.label} className={`rounded-lg border p-2 text-center ${t.bg}`}>
          <div className={`text-lg font-bold ${t.color}`}>{t.value}</div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-medium">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Compact Summary (Monitoring Lens) ───────────────────────────────────────

interface FloodRiskSummaryProps {
  basins: BasinRisk[];
  national: FloodRiskOverviewCardProps['national'];
  updatedAt: string | null;
  isLoading: boolean;
  onViewDetails?: () => void;
}

export function FloodRiskSummary({
  basins,
  national,
  updatedAt,
  isLoading,
  onViewDetails,
}: FloodRiskSummaryProps) {
  const hasRisk = national.criticalBasins + national.highBasins + national.elevatedBasins > 0;
  const topBasins = basins.filter(b => b.riskLevel !== 'low').slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Droplets className={`h-4 w-4 ${hasRisk ? 'text-orange-500' : 'text-blue-500'}`} />
            Flood Risk by Watershed
          </CardTitle>
          {updatedAt && (
            <span className="text-[10px] text-slate-400">{formatTimeSince(updatedAt)}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading && basins.length === 0 ? (
          <div className="text-[11px] text-slate-400 py-2">Loading...</div>
        ) : (
          <>
            {/* Compact stat tiles */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[
                { label: 'Basins', value: national.totalBasins, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
                { label: 'Critical', value: national.criticalBasins, color: 'text-red-700', bg: national.criticalBasins > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200' },
                { label: 'High', value: national.highBasins, color: 'text-orange-700', bg: national.highBasins > 0 ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200' },
                { label: 'Flooding', value: national.totalFlooding, color: 'text-blue-700', bg: national.totalFlooding > 0 ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200' },
              ].map(t => (
                <div key={t.label} className={`rounded-lg border p-2 text-center ${t.bg}`}>
                  <div className={`text-lg font-bold ${t.color}`}>{t.value}</div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-500 font-medium">{t.label}</div>
                </div>
              ))}
            </div>

            {/* Top at-risk basins */}
            {topBasins.length > 0 && (
              <div className="space-y-1 mt-2">
                {topBasins.map(b => {
                  const style = RISK_STYLES[b.riskLevel] || RISK_STYLES.low;
                  return (
                    <div key={b.rfcCode} className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded bg-slate-50/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 shrink-0 uppercase ${style.text} ${style.border}`}>
                          {b.riskLevel}
                        </Badge>
                        <span className="truncate text-slate-700">{b.region}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <RiskBar score={b.riskScore} level={b.riskLevel} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!hasRisk && (
              <div className="text-center text-[11px] text-slate-400 py-1">
                All basins at low risk
              </div>
            )}

            {onViewDetails && hasRisk && (
              <button
                onClick={onViewDetails}
                className="w-full text-center text-[10px] text-blue-600 hover:text-blue-800 mt-2 py-1 transition-colors"
              >
                View full risk overview &rarr;
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Full Card (Disaster/Emergency) ──────────────────────────────────────────

export function FloodRiskOverviewCard({
  basins,
  national,
  updatedAt,
  isLoading,
  error,
  onRefresh,
}: FloodRiskOverviewCardProps) {
  const [showAll, setShowAll] = useState(false);
  const activeBasins = basins.filter(b => b.riskLevel !== 'low');
  const lowBasins = basins.filter(b => b.riskLevel === 'low');
  const displayed = showAll ? basins : [...activeBasins, ...lowBasins.slice(0, 3)];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-blue-600" />
              Flood Risk Overview
            </CardTitle>
            <CardDescription className="mt-1">
              Flood probability by major waterway — {national.totalGauges.toLocaleString()} gauges across {national.totalBasins} river basins
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {updatedAt && (
              <span className="text-[10px] text-slate-400">{formatTimeSince(updatedAt)}</span>
            )}
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1 rounded hover:bg-slate-100 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="flex items-center gap-2 text-[11px] text-red-600 mb-3">
            <AlertTriangle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        {isLoading && basins.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-400">Loading basin risk data...</div>
        ) : basins.length === 0 ? (
          <div className="text-center py-6">
            <Droplets className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No basin data available</p>
          </div>
        ) : (
          <>
            <NationalSummary national={national} />

            <div className="space-y-2">
              {displayed.map(basin => (
                <BasinRow key={basin.rfcCode} basin={basin} />
              ))}
            </div>

            {basins.length > displayed.length && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full text-center text-[11px] text-blue-600 hover:text-blue-800 py-1.5 mt-2 transition-colors"
              >
                Show all {basins.length} basins
              </button>
            )}
            {showAll && lowBasins.length > 0 && (
              <button
                onClick={() => setShowAll(false)}
                className="w-full text-center text-[11px] text-slate-400 hover:text-slate-600 py-1 transition-colors"
              >
                Hide low-risk basins
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
