'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Activity, Waves, Gauge, Info, TrendingDown } from 'lucide-react';

// ── Props ───────────────────────────────────────────────────────────────────

interface DisasterEmergencyPanelProps {
  selectedState: string;
  stateRollup: Array<{
    abbr: string;
    name: string;
    high: number;
    medium: number;
    totalImpaired: number;
    assessed: number;
    waterbodies: number;
    cat5: number;
  }>;
}

// ── NWIS-GW Data Types ──────────────────────────────────────────────────────

interface NwisGwSite {
  siteNumber: string;
  siteName: string;
  state: string;
  county: string;
  wellDepth: number | null;
  lat: number;
  lng: number;
}

interface NwisGwTrend {
  siteNumber: string;
  siteName: string;
  trend: 'rising' | 'falling' | 'stable' | 'unknown';
  trendMagnitude: number;
  latestLevel: number;
  latestDate: string;
  lat: number;
  lng: number;
}

interface NwisGwData {
  sites: NwisGwSite[];
  trends: NwisGwTrend[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDepth(ft: number | null | undefined): string {
  if (ft === null || ft === undefined) return '--';
  return `${ft.toFixed(1)} ft`;
}

/** Group an array of trends by state (extracted from siteName or falling back to 'Unknown'). */
function groupTrendsByState(
  trends: NwisGwTrend[],
  sites: NwisGwSite[],
): Record<string, NwisGwTrend[]> {
  // Build a lookup from siteNumber -> state abbreviation
  const siteStateMap: Record<string, string> = {};
  for (const s of sites) {
    siteStateMap[s.siteNumber] = s.state;
  }
  const grouped: Record<string, NwisGwTrend[]> = {};
  for (const t of trends) {
    const state = siteStateMap[t.siteNumber] || 'Unknown';
    if (!grouped[state]) grouped[state] = [];
    grouped[state].push(t);
  }
  return grouped;
}

// ── Component ───────────────────────────────────────────────────────────────

export function DisasterEmergencyPanel({
  selectedState,
  stateRollup,
}: DisasterEmergencyPanelProps) {
  // ── NWIS-GW Data Fetch ──────────────────────────────────────────────────
  const [nwisData, setNwisData] = useState<NwisGwData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/nwis-gw/national-summary');
        if (res.ok) {
          const data = await res.json();
          setNwisData(data);
        }
      } catch (e) {
        console.error('[DisasterEmergency] NWIS-GW fetch failed:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // ── Derived Data ────────────────────────────────────────────────────────

  const sites = nwisData?.sites ?? [];
  const trends = nwisData?.trends ?? [];

  const activeTrendCount = useMemo(
    () => trends.filter((t) => t.trend !== 'unknown').length,
    [trends],
  );

  const decliningCount = useMemo(
    () => trends.filter((t) => t.trend === 'falling').length,
    [trends],
  );

  const highAlertWaterbodies = useMemo(
    () => stateRollup.reduce((sum, s) => sum + s.high, 0),
    [stateRollup],
  );

  // ── Groundwater Monitoring by State ─────────────────────────────────────
  const stateMonitoringRows = useMemo(() => {
    const grouped = groupTrendsByState(trends, sites);
    return Object.entries(grouped)
      .map(([state, stateTrends]) => ({
        state,
        siteCount: stateTrends.length,
        rising: stateTrends.filter((t) => t.trend === 'rising').length,
        falling: stateTrends.filter((t) => t.trend === 'falling').length,
        stable: stateTrends.filter((t) => t.trend === 'stable').length,
        unknown: stateTrends.filter((t) => t.trend === 'unknown').length,
      }))
      .sort((a, b) => a.state.localeCompare(b.state));
  }, [trends, sites]);

  // ── Critical Groundwater Trends (top 20 fastest declining) ──────────────
  const criticalTrends = useMemo(() => {
    const siteStateMap: Record<string, string> = {};
    for (const s of sites) {
      siteStateMap[s.siteNumber] = s.state;
    }
    return trends
      .filter((t) => t.trend === 'falling')
      .sort((a, b) => b.trendMagnitude - a.trendMagnitude)
      .slice(0, 20)
      .map((t) => ({
        ...t,
        state: siteStateMap[t.siteNumber] || 'Unknown',
      }));
  }, [trends, sites]);

  // ── High-Severity Surface Water (top 20 by cat5) ───────────────────────
  const highSeverityStates = useMemo(
    () =>
      [...stateRollup]
        .filter((s) => s.cat5 > 0)
        .sort((a, b) => b.cat5 - a.cat5)
        .slice(0, 20)
        .map((s) => ({
          ...s,
          assessmentGap: s.waterbodies - s.assessed,
        })),
    [stateRollup],
  );

  // ── Loading State ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Disaster &amp; Emergency Readiness</span>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Waves className="w-5 h-5 text-cyan-500 animate-pulse" />
              <span className="text-sm text-slate-500">
                Loading groundwater monitoring data...
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── No Data State ───────────────────────────────────────────────────────
  if (!nwisData && stateRollup.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Disaster &amp; Emergency Readiness</span>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-400">
                No monitoring data available
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>
          USGS WDFN + EPA ATTAINS — Disaster &amp; Emergency Readiness
          {selectedState ? ` (${selectedState})` : ' (National)'}
        </span>
      </div>

      {/* ── Section 1: Hero Stats Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center">
                <Waves size={20} className="text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {formatNumber(sites.length)}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  Monitoring Stations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <Activity size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {formatNumber(activeTrendCount)}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  Active Trends
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center">
                <TrendingDown size={20} className="text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700">
                  {formatNumber(decliningCount)}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  Declining Water Tables
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">
                  {formatNumber(highAlertWaterbodies)}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  High-Alert Waterbodies
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 2: Groundwater Monitoring Status ───────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge size={16} className="text-cyan-600" />
            Groundwater Monitoring Status
            {stateMonitoringRows.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {stateMonitoringRows.length} states
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            NWIS groundwater level trends by state — sites grouped by monitoring status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stateMonitoringRows.length === 0 ? (
            <div className="flex items-center gap-3 py-6">
              <Info size={16} className="text-slate-400" />
              <span className="text-sm text-slate-500">
                No groundwater monitoring data available.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="pb-2 font-semibold">State</th>
                    <th className="pb-2 font-semibold text-right">Sites</th>
                    <th className="pb-2 font-semibold text-right">
                      <span className="text-emerald-600">Rising</span>
                    </th>
                    <th className="pb-2 font-semibold text-right">
                      <span className="text-red-600">Falling</span>
                    </th>
                    <th className="pb-2 font-semibold text-right">
                      <span className="text-blue-600">Stable</span>
                    </th>
                    <th className="pb-2 font-semibold text-right">
                      <span className="text-slate-400">Unknown</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stateMonitoringRows.map((row) => (
                    <tr
                      key={row.state}
                      className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                        selectedState && row.state === selectedState
                          ? 'bg-blue-50 border-blue-100'
                          : ''
                      }`}
                    >
                      <td className="py-2 font-semibold text-slate-700">{row.state}</td>
                      <td className="py-2 text-right text-slate-600">{row.siteCount}</td>
                      <td className="py-2 text-right">
                        <span className={row.rising > 0 ? 'text-emerald-600 font-semibold' : 'text-slate-300'}>
                          {row.rising}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <span className={row.falling > 0 ? 'text-red-600 font-semibold' : 'text-slate-300'}>
                          {row.falling}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <span className={row.stable > 0 ? 'text-blue-600 font-semibold' : 'text-slate-300'}>
                          {row.stable}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <span className="text-slate-400">{row.unknown}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Critical Groundwater Trends ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown size={16} className="text-red-600" />
            Critical Groundwater Trends
            {criticalTrends.length > 0 && (
              <Badge className="ml-1 text-[10px] bg-red-100 text-red-700">
                {criticalTrends.length} sites declining
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Sites with the fastest declining groundwater levels — potential emergency watch areas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {criticalTrends.length === 0 ? (
            <div className="flex items-center gap-3 py-6">
              <Info size={16} className="text-slate-400" />
              <span className="text-sm text-slate-500">
                No declining groundwater trends detected in current monitoring data.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {criticalTrends.map((t, i) => (
                <div
                  key={`${t.siteNumber}-${i}`}
                  className={`rounded-lg border p-3 transition-colors ${
                    t.trendMagnitude > 2
                      ? 'border-red-200 bg-red-50'
                      : t.trendMagnitude > 1
                        ? 'border-orange-200 bg-orange-50'
                        : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <TrendingDown
                        size={14}
                        className={
                          t.trendMagnitude > 2
                            ? 'text-red-600 shrink-0'
                            : t.trendMagnitude > 1
                              ? 'text-orange-600 shrink-0'
                              : 'text-amber-600 shrink-0'
                        }
                      />
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {t.siteName || t.siteNumber}
                      </span>
                      <Badge variant="secondary" className="text-[9px] shrink-0">
                        {t.state}
                      </Badge>
                    </div>
                    <span
                      className={`text-xs font-bold tabular-nums shrink-0 ml-2 ${
                        t.trendMagnitude > 2
                          ? 'text-red-700'
                          : t.trendMagnitude > 1
                            ? 'text-orange-700'
                            : 'text-amber-700'
                      }`}
                    >
                      -{t.trendMagnitude.toFixed(2)} ft/mo
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-slate-500 ml-5">
                    <span>
                      Latest: <span className="font-medium text-slate-700">{formatDepth(t.latestLevel)}</span>
                    </span>
                    <span>
                      Date: <span className="font-medium text-slate-700">{formatDate(t.latestDate)}</span>
                    </span>
                    <span className="font-mono text-slate-400">{t.siteNumber}</span>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                <Info size={10} />
                Showing top {criticalTrends.length} sites by decline rate (ft/month).
                Higher magnitude indicates faster groundwater depletion.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 4: High-Severity Surface Water ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle size={16} className="text-amber-600" />
            High-Severity Surface Water
            {highSeverityStates.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {highSeverityStates.length} states
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            States with highest Category 5 impairments — potential emergency watch zones
          </CardDescription>
        </CardHeader>
        <CardContent>
          {highSeverityStates.length === 0 ? (
            <div className="flex items-center gap-3 py-6">
              <Info size={16} className="text-slate-400" />
              <span className="text-sm text-slate-500">
                No Category 5 impairment data available in current state rollup.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="pb-2 font-semibold">State</th>
                    <th className="pb-2 font-semibold text-right">Cat 5 Impairments</th>
                    <th className="pb-2 font-semibold text-right">Total Impaired</th>
                    <th className="pb-2 font-semibold text-right">Assessment Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {highSeverityStates.map((s) => (
                    <tr
                      key={s.abbr}
                      className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                        selectedState && s.abbr === selectedState
                          ? 'bg-blue-50 border-blue-100'
                          : ''
                      }`}
                    >
                      <td className="py-2">
                        <span className="font-semibold text-slate-700">{s.abbr}</span>
                        {s.name && (
                          <span className="text-slate-400 ml-1.5">{s.name}</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <span className="text-red-600 font-bold">
                          {s.cat5.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 text-right text-slate-600">
                        {s.totalImpaired.toLocaleString()}
                      </td>
                      <td className="py-2 text-right">
                        <span
                          className={
                            s.assessmentGap > 0
                              ? 'text-amber-600 font-semibold'
                              : 'text-slate-400'
                          }
                        >
                          {s.assessmentGap > 0
                            ? `+${s.assessmentGap.toLocaleString()}`
                            : s.assessmentGap.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
                <Info size={10} />
                Assessment Gap = total waterbodies minus assessed. Positive values
                indicate unassessed waterbodies that may harbor unknown impairments.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 5: Coming Soon — Additional Data Sources ────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info size={16} className="text-blue-600" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            Additional data source integrations for enhanced disaster and emergency monitoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              {
                name: 'FEMA Disaster Declarations API',
                desc: 'Real-time federal disaster declarations and emergency status',
                status: 'In Development',
                statusColor: 'bg-amber-100 text-amber-700',
              },
              {
                name: 'NRC Spill Reports Database',
                desc: 'National Response Center incident reports and spill tracking',
                status: 'In Development',
                statusColor: 'bg-amber-100 text-amber-700',
              },
              {
                name: 'NOAA Weather Alerts',
                desc: 'Severe weather and flood warnings impacting water infrastructure',
                status: 'Beta',
                statusColor: 'bg-cyan-100 text-cyan-700',
              },
              {
                name: 'EPA Emergency Response',
                desc: 'Superfund emergency response actions and removal site data',
                status: 'Planned',
                statusColor: 'bg-slate-100 text-slate-600',
              },
            ].map((item) => (
              <div
                key={item.name}
                className="rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-slate-800">{item.name}</p>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${item.statusColor}`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
