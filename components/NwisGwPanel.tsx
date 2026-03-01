'use client';

import React, { useState, useMemo } from 'react';
import { Waves, TrendingUp, TrendingDown, Minus, Activity, Droplets, Gauge, Filter, Search } from 'lucide-react';
import { KPIStrip, type KPICard } from '@/components/KPIStrip';
import { DashboardSection } from '@/components/DashboardSection';
import { StatusCard } from '@/components/StatusCard';
import { useNwisGwData } from '@/lib/useNwisGwData';

// ── Props ───────────────────────────────────────────────────────────────────

interface NwisGwPanelProps {
  state?: string;
  lat?: number;
  lng?: number;
  siteNumber?: string;
  compactMode?: boolean;
  federalMode?: boolean;
  className?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDepth(ft: number | null): string {
  if (ft === null) return '--';
  return `${ft.toFixed(1)} ft`;
}

function trendIcon(trend: string) {
  switch (trend) {
    case 'rising': return <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />;
    case 'falling': return <TrendingDown className="w-3.5 h-3.5 text-red-600" />;
    case 'stable': return <Minus className="w-3.5 h-3.5 text-blue-600" />;
    default: return <Minus className="w-3.5 h-3.5 text-slate-400" />;
  }
}

function trendStatus(trend: string): 'good' | 'warning' | 'critical' {
  switch (trend) {
    case 'rising': return 'good';
    case 'stable': return 'good';
    case 'falling': return 'warning';
    default: return 'warning';
  }
}

function trendLabel(trend: string): string {
  switch (trend) {
    case 'rising': return 'Rising';
    case 'falling': return 'Falling';
    case 'stable': return 'Stable';
    default: return 'Unknown';
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export function NwisGwPanel({
  state,
  lat,
  lng,
  siteNumber,
  compactMode = false,
  federalMode = false,
  className = '',
}: NwisGwPanelProps) {
  const { sites, levels, trends, summary, isLoading, error, fromCache } = useNwisGwData({
    state,
    lat,
    lng,
    siteNumber,
    enabled: !!(state || (lat && lng) || siteNumber),
  });

  // ── Filter state ──────────────────────────────────────────────────────
  const [trendFilter, setTrendFilter] = useState<'all' | 'rising' | 'falling' | 'stable'>('all');
  const [wellSearch, setWellSearch] = useState('');
  const [wellPage, setWellPage] = useState(0);
  const [fallingPage, setFallingPage] = useState(0);
  const PAGE_SIZE = compactMode ? 10 : 20;

  // ── Filtered + sorted trends ──────────────────────────────────────────
  const filteredTrends = useMemo(() => {
    let list = [...trends];
    if (trendFilter !== 'all') list = list.filter(t => t.trend === trendFilter);
    if (wellSearch) {
      const q = wellSearch.toLowerCase();
      list = list.filter(t =>
        (t.siteNumber || '').toLowerCase().includes(q) ||
        (t.siteName || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (a.trend === 'falling' && b.trend !== 'falling') return -1;
      if (b.trend === 'falling' && a.trend !== 'falling') return 1;
      return b.trendMagnitude - a.trendMagnitude;
    });
    return list;
  }, [trends, trendFilter, wellSearch]);

  const filteredFalling = useMemo(() =>
    trends
      .filter(t => t.trend === 'falling')
      .sort((a, b) => b.trendMagnitude - a.trendMagnitude),
    [trends]
  );

  if (isLoading) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <Waves className="w-5 h-5 text-cyan-500 animate-pulse" />
          <span className="text-sm text-slate-500">Loading USGS WDFN groundwater data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <Waves className="w-5 h-5 text-slate-400" />
          <span className="text-sm text-slate-400">Groundwater data unavailable: {error}</span>
        </div>
      </div>
    );
  }

  if (sites.length === 0 && levels.length === 0 && trends.length === 0) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <Waves className="w-5 h-5 text-slate-400" />
          <span className="text-sm text-slate-400">
            {federalMode
              ? '195 wells monitored — 0 with real-time data. This is a national monitoring gap.'
              : 'No groundwater monitoring data found for this area'}
          </span>
        </div>
      </div>
    );
  }

  // ── KPI Cards ──────────────────────────────────────────────────────────
  const kpiCards: KPICard[] = [
    {
      label: 'Monitoring Wells',
      value: summary.totalSites,
      icon: Waves,
      status: summary.totalSites > 0 ? 'good' : 'warning',
    },
    {
      label: 'Real-Time Sensors',
      value: summary.sitesWithRealtimeData,
      icon: Activity,
      status: summary.sitesWithRealtimeData > 0 ? 'good' : 'warning',
    },
    {
      label: 'Wells Rising',
      value: summary.sitesRising,
      icon: TrendingUp,
      status: 'good',
    },
    {
      label: 'Wells Falling',
      value: summary.sitesFalling,
      icon: TrendingDown,
      status: summary.sitesFalling === 0 ? 'good'
        : summary.sitesFalling > (summary.sitesRising + summary.sitesStable) ? 'critical'
        : 'warning',
    },
    {
      label: 'Avg Depth to Water',
      value: formatDepth(summary.avgDepthToWater),
      icon: Gauge,
      status: summary.avgDepthToWater === null ? 'warning'
        : summary.avgDepthToWater < 5 ? 'critical'
        : 'good',
    },
    {
      label: 'Shallowest Level',
      value: formatDepth(summary.shallowestLevel),
      icon: Droplets,
      status: summary.shallowestLevel === null ? 'warning'
        : summary.shallowestLevel < 3 ? 'critical'
        : summary.shallowestLevel < 10 ? 'warning'
        : 'good',
    },
  ];

  // ── Trend summary ─────────────────────────────────────────────────────
  const totalTrended = summary.sitesRising + summary.sitesFalling + summary.sitesStable;
  const risingPct = totalTrended > 0 ? Math.round((summary.sitesRising / totalTrended) * 100) : 0;
  const fallingPct = totalTrended > 0 ? Math.round((summary.sitesFalling / totalTrended) * 100) : 0;
  const stablePct = totalTrended > 0 ? 100 - risingPct - fallingPct : 0;

  // ── Paginated slices ─────────────────────────────────────────────────
  const wellPageCount = Math.max(1, Math.ceil(filteredTrends.length / PAGE_SIZE));
  const pagedTrends = filteredTrends.slice(wellPage * PAGE_SIZE, (wellPage + 1) * PAGE_SIZE);

  const fallingPageCount = Math.max(1, Math.ceil(filteredFalling.length / PAGE_SIZE));
  const pagedFalling = filteredFalling.slice(fallingPage * PAGE_SIZE, (fallingPage + 1) * PAGE_SIZE);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Source badge */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Waves className="w-3.5 h-3.5" />
        <span>USGS WDFN — Groundwater Levels{fromCache ? ' (cached)' : ' (live)'}</span>
        <span className="text-[10px] text-slate-300 ml-1">(NWIS transitioning to WDFN — Spring 2026)</span>
      </div>

      {/* KPI Strip */}
      <KPIStrip cards={kpiCards} />

      {/* Trend Breakdown */}
      {totalTrended > 0 && (
        <DashboardSection
          title="Aquifer Trend Summary"
          subtitle={`${totalTrended} wells with trend data`}
          accent="blue"
          icon={<Activity className="w-4 h-4" />}
          defaultExpanded={!compactMode}
        >
          <div className="mt-3 space-y-2">
            {[
              { label: 'Rising (water table up)', pct: risingPct, count: summary.sitesRising, color: 'bg-emerald-500' },
              { label: 'Stable', pct: stablePct, count: summary.sitesStable, color: 'bg-blue-500' },
              { label: 'Falling (water table down)', pct: fallingPct, count: summary.sitesFalling, color: 'bg-red-500' },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600">{t.label}</span>
                    <span className="font-semibold text-slate-700">{t.count} ({t.pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${t.color}`}
                      style={{ width: `${t.pct}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DashboardSection>
      )}

      {/* Well Detail Table */}
      {trends.length > 0 && (
        <DashboardSection
          title="Well Monitoring Detail"
          subtitle={`${filteredTrends.length}${filteredTrends.length !== trends.length ? ' filtered' : ''} of ${trends.length} wells tracked`}
          accent="cyan"
          icon={<Waves className="w-4 h-4" />}
          defaultExpanded={!compactMode}
        >
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 mt-2 mb-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <select
              value={trendFilter}
              onChange={e => { setTrendFilter(e.target.value as 'all' | 'rising' | 'falling' | 'stable'); setWellPage(0); }}
              className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:ring-1 focus:ring-cyan-300 focus:border-cyan-300"
            >
              <option value="all">All Trends</option>
              <option value="falling">Falling Only</option>
              <option value="rising">Rising Only</option>
              <option value="stable">Stable Only</option>
            </select>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search site ID or name..."
                value={wellSearch}
                onChange={e => { setWellSearch(e.target.value); setWellPage(0); }}
                className="text-xs border border-slate-200 rounded-md pl-7 pr-2 py-1.5 w-48 bg-white text-slate-700 placeholder:text-slate-400 focus:ring-1 focus:ring-cyan-300 focus:border-cyan-300"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-2.5 py-2">Site</th>
                  <th className="px-2.5 py-2 text-right">Latest Level</th>
                  <th className="px-2.5 py-2 text-center">Trend</th>
                  <th className="px-2.5 py-2 text-right">30d Avg</th>
                  <th className="px-2.5 py-2 text-right">90d Avg</th>
                  <th className="px-2.5 py-2">Last Reading</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedTrends.map((t, i) => (
                  <tr key={`${t.siteNumber}-${i}`} className="hover:bg-slate-50">
                    <td className="px-2.5 py-2">
                      <div className="font-mono text-slate-700 text-[11px]">{t.siteNumber}</div>
                      {t.siteName && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{t.siteName}</div>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-right font-semibold text-slate-700">
                      {formatDepth(t.latestLevel)}
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {trendIcon(t.trend)}
                        <span className={`text-[10px] font-medium ${
                          t.trend === 'rising' ? 'text-emerald-600' :
                          t.trend === 'falling' ? 'text-red-600' :
                          t.trend === 'stable' ? 'text-blue-600' : 'text-slate-400'
                        }`}>
                          {trendLabel(t.trend)}
                        </span>
                      </div>
                    </td>
                    <td className="px-2.5 py-2 text-right text-slate-500">
                      {t.avgLevel30d !== null ? formatDepth(t.avgLevel30d) : '--'}
                    </td>
                    <td className="px-2.5 py-2 text-right text-slate-500">
                      {t.avgLevel90d !== null ? formatDepth(t.avgLevel90d) : '--'}
                    </td>
                    <td className="px-2.5 py-2 text-slate-500">{formatDate(t.latestDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {wellPageCount > 1 && (
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span>Page {wellPage + 1} of {wellPageCount}</span>
              <div className="flex gap-1">
                <button
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  disabled={wellPage === 0}
                  onClick={() => setWellPage(p => p - 1)}
                >Prev</button>
                <button
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  disabled={wellPage >= wellPageCount - 1}
                  onClick={() => setWellPage(p => p + 1)}
                >Next</button>
              </div>
            </div>
          )}
        </DashboardSection>
      )}

      {/* Falling Wells Alert */}
      {summary.sitesFalling > 0 && summary.sitesFalling > summary.sitesRising && (
        <DashboardSection
          title="Declining Aquifer Alert"
          subtitle={`${summary.sitesFalling} wells showing falling water tables`}
          accent="red"
          icon={<TrendingDown className="w-4 h-4" />}
          defaultExpanded={!compactMode}
        >
          <div className="space-y-2 mt-3">
            {pagedFalling.map((t, i) => (
              <StatusCard
                key={`${t.siteNumber}-falling-${i}`}
                title={`${t.siteNumber} — ${t.siteName || 'Monitoring Well'}`}
                description={`Declining ${t.trendMagnitude.toFixed(1)} ft/month | Latest: ${formatDepth(t.latestLevel)} (${formatDate(t.latestDate)})`}
                status={t.trendMagnitude > 2 ? 'critical' : 'warning'}
              />
            ))}
          </div>

          {/* Pagination */}
          {fallingPageCount > 1 && (
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
              <span>Page {fallingPage + 1} of {fallingPageCount}</span>
              <div className="flex gap-1">
                <button
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  disabled={fallingPage === 0}
                  onClick={() => setFallingPage(p => p - 1)}
                >Prev</button>
                <button
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  disabled={fallingPage >= fallingPageCount - 1}
                  onClick={() => setFallingPage(p => p + 1)}
                >Next</button>
              </div>
            </div>
          )}
        </DashboardSection>
      )}
    </div>
  );
}
