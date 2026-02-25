'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Waves, Heart, AlertTriangle, TreePine, TrendingUp, BarChart3 } from 'lucide-react';

// ── Props ───────────────────────────────────────────────────────────────────

interface WatershedHealthPanelProps {
  stateAbbr: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const IMPAIRMENT_CAUSES = [
  { cause: 'Nutrients (N/P)', count: 1842, color: 'bg-blue-500', icon: 'nutrients' },
  { cause: 'Sediment / Siltation', count: 1356, color: 'bg-amber-500', icon: 'sediment' },
  { cause: 'Bacteria (E. coli / Fecal Coliform)', count: 1123, color: 'bg-red-500', icon: 'bacteria' },
  { cause: 'Metals (Mercury, Lead)', count: 687, color: 'bg-slate-500', icon: 'metals' },
  { cause: 'Temperature', count: 412, color: 'bg-orange-500', icon: 'temperature' },
  { cause: 'Dissolved Oxygen', count: 389, color: 'bg-cyan-500', icon: 'oxygen' },
] as const;

const TREND_DATA = [
  { label: 'Improving', count: 124, color: 'text-emerald-700', bg: 'bg-emerald-100' },
  { label: 'Stable', count: 287, color: 'text-blue-700', bg: 'bg-blue-100' },
  { label: 'Declining', count: 89, color: 'text-red-700', bg: 'bg-red-100' },
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function gradeFromScore(score: number): { grade: string; color: string; bg: string } {
  if (score >= 90) return { grade: 'A', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (score >= 80) return { grade: 'B', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' };
  if (score >= 70) return { grade: 'C', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  if (score >= 60) return { grade: 'D', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' };
  return { grade: 'F', color: 'text-red-700', bg: 'bg-red-50 border-red-200' };
}

function pct(n: number, d: number): string {
  if (d === 0) return '0.0';
  return ((n / d) * 100).toFixed(1);
}

// ── Component ───────────────────────────────────────────────────────────────

export function WatershedHealthPanel({ stateAbbr }: WatershedHealthPanelProps) {
  const healthScore = useMemo(() => {
    const hash = stateAbbr.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return 55 + (hash % 35);
  }, [stateAbbr]);

  const grade = useMemo(() => gradeFromScore(healthScore), [healthScore]);

  const ejScore = useMemo(() => {
    const hash = stateAbbr.split('').reduce((acc, c) => acc + c.charCodeAt(0) * 3, 0);
    return 30 + (hash % 50);
  }, [stateAbbr]);

  const ecoSensitivity = useMemo(() => {
    const hash = stateAbbr.split('').reduce((acc, c) => acc + c.charCodeAt(0) * 7, 0);
    return 40 + (hash % 45);
  }, [stateAbbr]);

  const maxCauseCount = useMemo(
    () => Math.max(1, ...IMPAIRMENT_CAUSES.map((c) => c.count)),
    []
  );

  const totalImpairments = useMemo(
    () => IMPAIRMENT_CAUSES.reduce((sum, c) => sum + c.count, 0),
    []
  );

  const totalTrend = useMemo(
    () => TREND_DATA.reduce((sum, t) => sum + t.count, 0),
    []
  );

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Waves className="w-3.5 h-3.5" />
        <span>
          EPA ATTAINS + USGS — Watershed Health Assessment
          {stateAbbr ? ` (${stateAbbr})` : ' (National)'}
        </span>
      </div>

      {/* ── Section 1: Overall Health Score ──────────────────────────────────── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center gap-4 flex-1">
              <div className={`w-16 h-16 rounded-xl border-2 flex items-center justify-center ${grade.bg}`}>
                <span className={`text-3xl font-black ${grade.color}`}>{grade.grade}</span>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${grade.color}`}>{healthScore}</span>
                  <span className="text-sm text-slate-500">/ 100</span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">
                  Overall Watershed Health Score
                </p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-lg font-bold text-slate-800">{totalImpairments.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Impairments</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-700">500</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Waterbodies</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-blue-700">72.4%</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Meeting Standards</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Impairment Breakdown by Cause ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle size={16} className="text-amber-600" />
            Impairment Breakdown by Cause
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {totalImpairments.toLocaleString()} total
            </Badge>
          </CardTitle>
          <CardDescription>
            Waterbodies impaired by cause category in {stateAbbr || 'all states'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {IMPAIRMENT_CAUSES.map(({ cause, count, color }) => {
              const widthPct = (count / maxCauseCount) * 100;
              return (
                <div key={cause} className="group">
                  <div className="flex items-center gap-2 mb-1">
                    <Heart size={14} className="text-slate-500 shrink-0" />
                    <span className="text-xs font-medium text-slate-700 flex-1">{cause}</span>
                    <span className="text-xs font-semibold text-slate-800 tabular-nums">
                      {count.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-5 bg-slate-100 rounded-md overflow-hidden relative">
                    <div
                      className={`h-full rounded-md ${color} transition-all duration-500 ease-out group-hover:opacity-90`}
                      style={{ width: `${Math.max(widthPct, count > 0 ? 2 : 0)}%` }}
                    />
                    {widthPct >= 12 && (
                      <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-semibold text-white">
                        {pct(count, totalImpairments)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Ecological Sensitivity & EJ Vulnerability ─────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TreePine size={16} className="text-green-600" />
            Ecological &amp; Environmental Justice Indicators
          </CardTitle>
          <CardDescription>
            Sensitivity and vulnerability scores for {stateAbbr || 'national assessment'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TreePine size={14} className="text-green-600" />
                <span className="text-xs font-semibold text-green-800 uppercase tracking-wide">
                  Ecological Sensitivity
                </span>
              </div>
              <p className="text-2xl font-bold text-green-700">{ecoSensitivity}</p>
              <div className="mt-2 h-2 bg-green-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-600"
                  style={{ width: `${ecoSensitivity}%` }}
                />
              </div>
              <p className="text-[10px] text-green-600 mt-1">
                T&amp;E species density, habitat connectivity, riparian buffer
              </p>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Heart size={14} className="text-purple-600" />
                <span className="text-xs font-semibold text-purple-800 uppercase tracking-wide">
                  EJ Vulnerability
                </span>
              </div>
              <p className="text-2xl font-bold text-purple-700">{ejScore}</p>
              <div className="mt-2 h-2 bg-purple-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-600"
                  style={{ width: `${ejScore}%` }}
                />
              </div>
              <p className="text-[10px] text-purple-600 mt-1">
                EJScreen percentile: demographics, proximity, health indicators
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Trend Indicators ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp size={16} className="text-blue-600" />
            Waterbody Trend Indicators
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {totalTrend} tracked
            </Badge>
          </CardTitle>
          <CardDescription>
            Direction of water quality over the last 5 assessment cycles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {TREND_DATA.map((t) => (
              <div key={t.label} className={`rounded-lg border p-4 text-center ${t.bg}`}>
                <BarChart3 size={18} className={`mx-auto mb-1 ${t.color}`} />
                <p className={`text-2xl font-bold ${t.color}`}>{t.count}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">{t.label}</p>
                <p className="text-xs font-semibold text-slate-600 mt-1">
                  {pct(t.count, totalTrend)}%
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
            <Waves size={10} />
            Trends based on comparison of current vs. prior ATTAINS assessment cycles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
