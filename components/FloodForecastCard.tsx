/* ------------------------------------------------------------------ */
/*  FloodForecastCard — Predicted Flood Exceedances                   */
/*  Displays NWPS gauge forecasts compared to flood stage thresholds. */
/*  Shows predicted floods sorted by severity + lead time.            */
/* ------------------------------------------------------------------ */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Waves,
  TrendingUp,
  Clock,
  MapPin,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Gauge,
} from 'lucide-react';
import type { FloodForecastGauge } from '@/app/api/flood-forecast/route';

// ── Props ────────────────────────────────────────────────────────────────────

interface FloodForecastCardProps {
  forecasts: FloodForecastGauge[];
  summary: {
    total: number;
    major: number;
    moderate: number;
    minor: number;
    action: number;
    currentlyFlooding: number;
  };
  updatedAt: string | null;
  isLoading: boolean;
  error: string | null;
  onRefresh?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  major:    { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-800',    label: 'Major Flood' },
  moderate: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', label: 'Moderate Flood' },
  minor:    { bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-800',  label: 'Minor Flood' },
  action:   { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-800', label: 'Action Stage' },
  none:     { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   label: 'Rising' },
};

function formatLeadTime(hours: number | null): string {
  if (hours == null) return 'unknown';
  if (hours < 1) return 'imminent';
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function formatTimeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Sparkline ────────────────────────────────────────────────────────────────

function StageSparkline({
  stageflow,
  actionStage,
  minorStage,
}: {
  stageflow: Array<{ time: string; stage: number | null; flow: number | null }>;
  actionStage: number | null;
  minorStage: number | null;
}) {
  const stages = stageflow
    .map(e => e.stage)
    .filter((s): s is number => s != null);
  if (stages.length < 2) return null;

  const min = Math.min(...stages, actionStage ?? Infinity, minorStage ?? Infinity);
  const max = Math.max(...stages, actionStage ?? -Infinity, minorStage ?? -Infinity);
  const range = max - min || 1;
  const h = 32;
  const w = 120;

  const points = stages
    .map((s, i) => {
      const x = (i / (stages.length - 1)) * w;
      const y = h - ((s - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h + 4} className="inline-block align-middle" aria-hidden="true">
      {/* Flood threshold line */}
      {minorStage != null && (
        <line
          x1={0} y1={h - ((minorStage - min) / range) * h}
          x2={w} y2={h - ((minorStage - min) / range) * h}
          stroke="#EF4444" strokeWidth={1} strokeDasharray="3,2" opacity={0.6}
        />
      )}
      {actionStage != null && (
        <line
          x1={0} y1={h - ((actionStage - min) / range) * h}
          x2={w} y2={h - ((actionStage - min) / range) * h}
          stroke="#F59E0B" strokeWidth={1} strokeDasharray="3,2" opacity={0.6}
        />
      )}
      {/* Stage line */}
      <polyline
        points={points}
        fill="none"
        stroke="#3B82F6"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Gauge Row ────────────────────────────────────────────────────────────────

function GaugeRow({ gauge }: { gauge: FloodForecastGauge }) {
  const [expanded, setExpanded] = useState(false);
  const style = CATEGORY_STYLES[gauge.predictedCategory] || CATEGORY_STYLES.none;

  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} p-3`}>
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate" style={{ color: 'var(--text-bright)' }}>
              {gauge.name || gauge.lid}
            </span>
            <Badge variant="outline" className={`text-2xs px-1.5 py-0 ${style.text} ${style.border}`}>
              {style.label}
            </Badge>
            {gauge.state && (
              <span className="text-2xs text-slate-500">{gauge.state}</span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
            {gauge.currentStage != null && (
              <span className="flex items-center gap-1">
                <Gauge className="h-3 w-3" />
                Now: {gauge.currentStage} {gauge.unit}
              </span>
            )}
            {gauge.forecastPeak != null && (
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Peak: {gauge.forecastPeak} {gauge.unit}
              </span>
            )}
            {gauge.hoursUntilExceedance != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatLeadTime(gauge.hoursUntilExceedance)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2 shrink-0">
          <StageSparkline
            stageflow={gauge.stageflow}
            actionStage={gauge.actionStage}
            minorStage={gauge.minorStage}
          />
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-200/50 text-xs text-slate-600 space-y-1.5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span>LID: <span className="font-mono">{gauge.lid}</span></span>
            <span>County: {gauge.county || '—'}</span>
            <span>Action Stage: {gauge.actionStage ?? '—'} {gauge.unit}</span>
            <span>Minor Flood: {gauge.minorStage ?? '—'} {gauge.unit}</span>
            <span>Moderate Flood: {gauge.moderateStage ?? '—'} {gauge.unit}</span>
            <span>Major Flood: {gauge.majorStage ?? '—'} {gauge.unit}</span>
            {gauge.forecastPeakTime && (
              <span className="col-span-2">
                Peak at: {new Date(gauge.forecastPeakTime).toLocaleString()}
              </span>
            )}
            {gauge.percentAboveFlood != null && (
              <span className="col-span-2">
                {gauge.percentAboveFlood > 0
                  ? `${gauge.percentAboveFlood}% above flood stage`
                  : `${Math.abs(gauge.percentAboveFlood)}% below flood stage`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-2xs text-slate-400 pt-1">
            <MapPin className="h-3 w-3" />
            {gauge.lat.toFixed(4)}, {gauge.lng.toFixed(4)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Monitoring Summary (compact) ─────────────────────────────────────────────

interface FloodStatusSummaryProps {
  forecasts: FloodForecastGauge[];
  summary: FloodForecastCardProps['summary'];
  updatedAt: string | null;
  isLoading: boolean;
  onViewDetails?: () => void;
}

export function FloodStatusSummary({
  forecasts,
  summary,
  updatedAt,
  isLoading,
  onViewDetails,
}: FloodStatusSummaryProps) {
  const hasAlerts = summary.major + summary.moderate + summary.minor > 0;
  const topGauges = forecasts
    .filter(g => g.predictedCategory !== 'none' && g.predictedCategory !== 'action')
    .slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Waves className={`h-4 w-4 ${hasAlerts ? 'text-red-500' : 'text-blue-500'}`} />
            River Flood Status
          </CardTitle>
          {updatedAt && (
            <span className="text-2xs text-slate-400">{formatTimeSince(updatedAt)}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading && forecasts.length === 0 ? (
          <div className="text-xs text-slate-400 py-2">Loading...</div>
        ) : (
          <>
            {/* Stat tiles */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[
                { label: 'Gauges', value: summary.total, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
                { label: 'Major', value: summary.major, color: 'text-red-700', bg: summary.major > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200' },
                { label: 'Moderate', value: summary.moderate, color: 'text-orange-700', bg: summary.moderate > 0 ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200' },
                { label: 'Active', value: summary.currentlyFlooding, color: 'text-blue-700', bg: summary.currentlyFlooding > 0 ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200' },
              ].map(t => (
                <div key={t.label} className={`rounded-lg border p-2 text-center ${t.bg}`}>
                  <div className={`text-lg font-bold ${t.color}`}>{t.value}</div>
                  <div className="text-2xs uppercase tracking-wider text-slate-500 font-medium">{t.label}</div>
                </div>
              ))}
            </div>

            {/* Top predicted floods (compact list) */}
            {topGauges.length > 0 && (
              <div className="space-y-1 mt-2">
                {topGauges.map(g => {
                  const style = CATEGORY_STYLES[g.predictedCategory] || CATEGORY_STYLES.none;
                  return (
                    <div key={g.lid} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-slate-50/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className={`text-2xs px-1 py-0 shrink-0 ${style.text} ${style.border}`}>
                          {g.predictedCategory}
                        </Badge>
                        <span className="truncate text-slate-700">{g.name || g.lid}</span>
                        <span className="text-slate-400 shrink-0">{g.state}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 shrink-0 ml-2">
                        <Clock className="h-3 w-3" />
                        {formatLeadTime(g.hoursUntilExceedance)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!hasAlerts && (
              <div className="text-center text-xs text-slate-400 py-1">
                No flood exceedances predicted
              </div>
            )}

            {onViewDetails && hasAlerts && (
              <button
                onClick={onViewDetails}
                className="w-full text-center text-2xs text-blue-600 hover:text-blue-800 mt-2 py-1 transition-colors"
              >
                View full forecast &rarr;
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Full Card (Disaster/Emergency) ───────────────────────────────────────────

export function FloodForecastCard({
  forecasts,
  summary,
  updatedAt,
  isLoading,
  error,
  onRefresh,
}: FloodForecastCardProps) {
  const [showAll, setShowAll] = useState(false);
  const displayCount = showAll ? forecasts.length : 8;
  const displayed = forecasts.slice(0, displayCount);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Waves className="h-5 w-5 text-blue-600" />
              Flood Forecast
            </CardTitle>
            <CardDescription className="mt-1">
              Predicted flood exceedances from NWPS river gauge forecasts
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {updatedAt && (
              <span className="text-2xs text-slate-400">
                {formatTimeSince(updatedAt)}
              </span>
            )}
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1 rounded hover:bg-slate-100 transition-colors"
                title="Refresh forecasts"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {summary.major > 0 && (
            <Badge variant="destructive" className="text-2xs">
              {summary.major} Major
            </Badge>
          )}
          {summary.moderate > 0 && (
            <Badge className="text-2xs bg-orange-100 text-orange-800 border-orange-200">
              {summary.moderate} Moderate
            </Badge>
          )}
          {summary.minor > 0 && (
            <Badge className="text-2xs bg-amber-100 text-amber-800 border-amber-200">
              {summary.minor} Minor
            </Badge>
          )}
          {summary.action > 0 && (
            <Badge className="text-2xs bg-yellow-100 text-yellow-800 border-yellow-200">
              {summary.action} Action
            </Badge>
          )}
          {summary.currentlyFlooding > 0 && (
            <Badge className="text-2xs bg-blue-100 text-blue-800 border-blue-200">
              {summary.currentlyFlooding} Active
            </Badge>
          )}
          {summary.total === 0 && !isLoading && (
            <span className="text-xs text-slate-400">No flood exceedances predicted</span>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 mb-3">
            <AlertTriangle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}

        {isLoading && forecasts.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-400">Loading forecast data...</div>
        ) : forecasts.length === 0 ? (
          <div className="text-center py-6">
            <Waves className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No flood exceedances predicted</p>
            <p className="text-2xs text-slate-300 mt-1">All monitored gauges are within normal parameters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map((gauge) => (
              <GaugeRow key={gauge.lid} gauge={gauge} />
            ))}

            {forecasts.length > 8 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full text-center text-xs text-blue-600 hover:text-blue-800 py-1.5 transition-colors"
              >
                {showAll ? 'Show less' : `Show all ${forecasts.length} gauges`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
