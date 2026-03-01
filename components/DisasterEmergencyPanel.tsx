'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Activity, Waves, Gauge, Info, TrendingDown, CloudRain, Shield, FlaskConical, Landmark } from 'lucide-react';

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

// ── NWS Alert Types ─────────────────────────────────────────────────────────

interface NwsAlertData {
  totalAlerts: number;
  severityCounts: Record<string, number>;
  topAlerts: Array<{
    id: string;
    event: string;
    severity: string;
    areaDesc: string;
    onset: string | null;
    expires: string | null;
    headline: string;
  }>;
}

// ── FEMA Types ──────────────────────────────────────────────────────────────

interface FemaData {
  totalDeclarations: number;
  byType: Record<string, number>;
  byState: Record<string, number>;
  topDeclarations: Array<{
    disasterNumber: number;
    incidentType: string;
    declarationTitle: string;
    state: string;
    designatedArea: string;
    declarationDate: string;
    declarationType: string;
  }>;
}

// ── Superfund Types ─────────────────────────────────────────────────────────

interface SuperfundData {
  totalSites: number;
  activeNpl: number;
  proposedNpl: number;
  byState: Record<string, number>;
  topBySiteScore: Array<{
    siteEpaId: string;
    siteName: string;
    stateAbbr: string;
    city: string;
    status: string;
    siteScore: number | null;
    listingDate: string | null;
  }>;
}

// ── TRI Types ───────────────────────────────────────────────────────────────

interface TriSummary {
  totalFacilities: number;
  totalReleases: number;
  carcinogenFacilities: number;
  topFacilities: Array<{
    facilityName: string;
    state: string;
    totalReleases: number;
    carcinogenReleases: number;
    topChemical: string;
  }>;
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

function formatWeight(lbs: number): string {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(1)}M lbs`;
  if (lbs >= 1_000) return `${(lbs / 1_000).toFixed(1)}K lbs`;
  return `${lbs.toLocaleString()} lbs`;
}

const SEVERITY_COLORS: Record<string, string> = {
  Extreme: 'bg-red-100 text-red-800',
  Severe: 'bg-orange-100 text-orange-800',
  Moderate: 'bg-amber-100 text-amber-800',
  Minor: 'bg-blue-100 text-blue-800',
  Unknown: 'bg-slate-100 text-slate-600',
};

const INCIDENT_TYPE_COLORS: Record<string, string> = {
  Flood: 'bg-blue-100 text-blue-800',
  Hurricane: 'bg-red-100 text-red-800',
  'Severe Storm(s)': 'bg-purple-100 text-purple-800',
  Typhoon: 'bg-red-100 text-red-800',
  'Coastal Storm': 'bg-cyan-100 text-cyan-800',
  'Dam/Levee Break': 'bg-red-100 text-red-800',
  Tornado: 'bg-orange-100 text-orange-800',
  'Tropical Storm': 'bg-indigo-100 text-indigo-800',
  'Severe Ice Storm': 'bg-sky-100 text-sky-800',
};

/** Group an array of trends by state (extracted from siteName or falling back to 'Unknown'). */
function groupTrendsByState(
  trends: NwisGwTrend[],
  sites: NwisGwSite[],
): Record<string, NwisGwTrend[]> {
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
  // ── Data Fetches ──────────────────────────────────────────────────────────
  const [nwisData, setNwisData] = useState<NwisGwData | null>(null);
  const [nwsData, setNwsData] = useState<NwsAlertData | null>(null);
  const [femaData, setFemaData] = useState<FemaData | null>(null);
  const [superfundData, setSuperfundData] = useState<SuperfundData | null>(null);
  const [triData, setTriData] = useState<TriSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [nwisRes, nwsRes, femaRes, superfundRes, triRes] = await Promise.allSettled([
          fetch('/api/nwis-gw/national-summary'),
          fetch('/api/nws-alerts'),
          fetch('/api/fema-declarations'),
          fetch('/api/superfund-sites'),
          fetch('/api/tri-releases/emergency-summary'),
        ]);

        if (nwisRes.status === 'fulfilled' && nwisRes.value.ok) {
          setNwisData(await nwisRes.value.json());
        }
        if (nwsRes.status === 'fulfilled' && nwsRes.value.ok) {
          setNwsData(await nwsRes.value.json());
        }
        if (femaRes.status === 'fulfilled' && femaRes.value.ok) {
          setFemaData(await femaRes.value.json());
        }
        if (superfundRes.status === 'fulfilled' && superfundRes.value.ok) {
          setSuperfundData(await superfundRes.value.json());
        }
        if (triRes.status === 'fulfilled' && triRes.value.ok) {
          setTriData(await triRes.value.json());
        }
      } catch (e) {
        console.error('[DisasterEmergency] Data fetch failed:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
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
                Loading disaster &amp; emergency data...
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── No Data State ───────────────────────────────────────────────────────
  if (!nwisData && !nwsData && !femaData && !superfundData && !triData && stateRollup.length === 0) {
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
          USGS WDFN + EPA ATTAINS + NWS + FEMA + TRI — Disaster &amp; Emergency Readiness
          {selectedState ? ` (${selectedState})` : ' (National)'}
        </span>
      </div>

      {/* ── Section 1: Hero Stats Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
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
                  GW Stations
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
                  Declining Tables
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
                  Alert Waterbodies
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center">
                <CloudRain size={20} className="text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-700">
                  {formatNumber(nwsData?.totalAlerts ?? 0)}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  Weather Alerts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                <Landmark size={20} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-700">
                  {formatNumber(femaData?.totalDeclarations ?? 0)}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  FEMA Declarations
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-center">
                <Shield size={20} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-700">
                  {formatNumber(superfundData?.totalSites ?? 0)}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  Superfund Sites
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-50 border border-violet-200 flex items-center justify-center">
                <FlaskConical size={20} className="text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-700">
                  {formatNumber(triData?.totalFacilities ?? 0)}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                  TRI Facilities
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
            WDFN groundwater level trends by state — sites grouped by monitoring status
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

      {/* ── Section 5: Active Weather Alerts (NWS) ────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudRain size={16} className="text-orange-600" />
            Active Weather Alerts
            {nwsData && nwsData.totalAlerts > 0 && (
              <Badge className="ml-1 text-[10px] bg-orange-100 text-orange-700">
                {nwsData.totalAlerts} active
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            NWS water-relevant weather alerts — floods, storms, marine warnings, and coastal hazards
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!nwsData || nwsData.topAlerts.length === 0 ? (
            <div className="flex items-center gap-3 py-6">
              <Info size={16} className="text-slate-400" />
              <span className="text-sm text-slate-500">
                No active water-relevant weather alerts.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex items-center gap-2 mb-3">
                {Object.entries(nwsData.severityCounts)
                  .filter(([, count]) => count > 0)
                  .sort(([a], [b]) => {
                    const order = ['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'];
                    return order.indexOf(a) - order.indexOf(b);
                  })
                  .map(([severity, count]) => (
                    <span
                      key={severity}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SEVERITY_COLORS[severity] || SEVERITY_COLORS.Unknown}`}
                    >
                      {severity}: {count}
                    </span>
                  ))}
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="pb-2 font-semibold">Event</th>
                    <th className="pb-2 font-semibold">Severity</th>
                    <th className="pb-2 font-semibold">Area</th>
                    <th className="pb-2 font-semibold text-right">Onset</th>
                    <th className="pb-2 font-semibold text-right">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {nwsData.topAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-2 font-semibold text-slate-700 max-w-[200px] truncate">
                        {alert.event}
                      </td>
                      <td className="py-2">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.Unknown}`}>
                          {alert.severity}
                        </span>
                      </td>
                      <td className="py-2 text-slate-600 max-w-[250px] truncate">
                        {alert.areaDesc}
                      </td>
                      <td className="py-2 text-right text-slate-500 tabular-nums">
                        {alert.onset ? formatDate(alert.onset) : '--'}
                      </td>
                      <td className="py-2 text-right text-slate-500 tabular-nums">
                        {alert.expires ? formatDate(alert.expires) : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
                <Info size={10} />
                Showing top {nwsData.topAlerts.length} alerts sorted by severity. Data refreshed every 30 minutes from NWS API.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 6: FEMA Disaster Declarations ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark size={16} className="text-indigo-600" />
            FEMA Disaster Declarations
            {femaData && femaData.totalDeclarations > 0 && (
              <Badge className="ml-1 text-[10px] bg-indigo-100 text-indigo-700">
                {femaData.totalDeclarations} declarations
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Water-relevant federal disaster declarations from the last 90 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!femaData || femaData.topDeclarations.length === 0 ? (
            <div className="flex items-center gap-3 py-6">
              <Info size={16} className="text-slate-400" />
              <span className="text-sm text-slate-500">
                No recent water-relevant disaster declarations.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {Object.entries(femaData.byType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <span
                      key={type}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${INCIDENT_TYPE_COLORS[type] || 'bg-slate-100 text-slate-600'}`}
                    >
                      {type}: {count}
                    </span>
                  ))}
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="pb-2 font-semibold">Disaster #</th>
                    <th className="pb-2 font-semibold">Type</th>
                    <th className="pb-2 font-semibold">Title</th>
                    <th className="pb-2 font-semibold">State</th>
                    <th className="pb-2 font-semibold">Area</th>
                    <th className="pb-2 font-semibold text-right">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {femaData.topDeclarations.map((d, i) => (
                    <tr
                      key={`${d.disasterNumber}-${i}`}
                      className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                        selectedState && d.state === selectedState
                          ? 'bg-blue-50 border-blue-100'
                          : ''
                      }`}
                    >
                      <td className="py-2 font-mono text-slate-600">{d.disasterNumber}</td>
                      <td className="py-2">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${INCIDENT_TYPE_COLORS[d.incidentType] || 'bg-slate-100 text-slate-600'}`}>
                          {d.incidentType}
                        </span>
                      </td>
                      <td className="py-2 font-semibold text-slate-700 max-w-[200px] truncate">
                        {d.declarationTitle}
                      </td>
                      <td className="py-2 text-slate-600">{d.state}</td>
                      <td className="py-2 text-slate-500 max-w-[150px] truncate">
                        {d.designatedArea}
                      </td>
                      <td className="py-2 text-right text-slate-500 tabular-nums">
                        {formatDate(d.declarationDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
                <Info size={10} />
                Showing top {femaData.topDeclarations.length} declarations sorted by date. Filtered to water-relevant incident types.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 7: Superfund NPL Sites ────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield size={16} className="text-yellow-600" />
            Superfund NPL Sites
            {superfundData && superfundData.totalSites > 0 && (
              <Badge className="ml-1 text-[10px] bg-yellow-100 text-yellow-700">
                {superfundData.activeNpl} active
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            EPA National Priorities List sites sorted by Hazard Ranking System (HRS) score
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!superfundData || superfundData.topBySiteScore.length === 0 ? (
            <div className="flex items-center gap-3 py-6">
              <Info size={16} className="text-slate-400" />
              <span className="text-sm text-slate-500">
                No Superfund site data available.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="pb-2 font-semibold">Site Name</th>
                    <th className="pb-2 font-semibold">State</th>
                    <th className="pb-2 font-semibold">City</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 font-semibold text-right">HRS Score</th>
                    <th className="pb-2 font-semibold text-right">Listed</th>
                  </tr>
                </thead>
                <tbody>
                  {superfundData.topBySiteScore.map((s) => (
                    <tr
                      key={s.siteEpaId}
                      className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                        selectedState && s.stateAbbr === selectedState
                          ? 'bg-blue-50 border-blue-100'
                          : ''
                      }`}
                    >
                      <td className="py-2 font-semibold text-slate-700 max-w-[200px] truncate">
                        {s.siteName}
                      </td>
                      <td className="py-2 text-slate-600">{s.stateAbbr}</td>
                      <td className="py-2 text-slate-500">{s.city}</td>
                      <td className="py-2">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                          s.status.toLowerCase().includes('final') || s.status.toLowerCase() === 'npl site'
                            ? 'bg-red-100 text-red-700'
                            : s.status.toLowerCase().includes('proposed')
                              ? 'bg-amber-100 text-amber-700'
                              : s.status.toLowerCase().includes('deleted')
                                ? 'bg-slate-100 text-slate-500'
                                : 'bg-blue-100 text-blue-700'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <span className={`font-bold tabular-nums ${
                          (s.siteScore ?? 0) >= 50 ? 'text-red-600' :
                          (s.siteScore ?? 0) >= 28.5 ? 'text-orange-600' :
                          'text-slate-600'
                        }`}>
                          {s.siteScore?.toFixed(2) ?? '--'}
                        </span>
                      </td>
                      <td className="py-2 text-right text-slate-500 tabular-nums">
                        {s.listingDate ? formatDate(s.listingDate) : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
                <Info size={10} />
                Top {superfundData.topBySiteScore.length} sites by HRS score. Score of 28.50+ qualifies for NPL listing.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 8: Chemical Releases (TRI) ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical size={16} className="text-violet-600" />
            Chemical Releases (TRI)
            {triData && triData.carcinogenFacilities > 0 && (
              <Badge className="ml-1 text-[10px] bg-violet-100 text-violet-700">
                {triData.carcinogenFacilities} carcinogen reporters
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            EPA Toxics Release Inventory — facilities with the highest chemical releases
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!triData || triData.topFacilities.length === 0 ? (
            <div className="flex items-center gap-3 py-6">
              <Info size={16} className="text-slate-400" />
              <span className="text-sm text-slate-500">
                No TRI chemical release data available.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="pb-2 font-semibold">Facility</th>
                    <th className="pb-2 font-semibold">State</th>
                    <th className="pb-2 font-semibold text-right">Total Releases</th>
                    <th className="pb-2 font-semibold text-center">Carcinogen</th>
                    <th className="pb-2 font-semibold">Top Chemical</th>
                  </tr>
                </thead>
                <tbody>
                  {triData.topFacilities.map((f, i) => (
                    <tr
                      key={`${f.facilityName}-${i}`}
                      className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                        selectedState && f.state === selectedState
                          ? 'bg-blue-50 border-blue-100'
                          : ''
                      }`}
                    >
                      <td className="py-2 font-semibold text-slate-700 max-w-[200px] truncate">
                        {f.facilityName}
                      </td>
                      <td className="py-2 text-slate-600">{f.state}</td>
                      <td className="py-2 text-right font-bold tabular-nums text-slate-700">
                        {formatWeight(f.totalReleases)}
                      </td>
                      <td className="py-2 text-center">
                        {f.carcinogenReleases > 0 ? (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                            YES
                          </span>
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>
                      <td className="py-2 text-slate-500 max-w-[150px] truncate">
                        {f.topChemical}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
                <Info size={10} />
                Top {triData.topFacilities.length} facilities by total release volume.
                Total releases across all TRI facilities: {formatWeight(triData.totalReleases)}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
