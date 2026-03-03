'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, AlertTriangle, ChevronDown, ChevronUp, Database, RefreshCw, WifiOff } from 'lucide-react';
import { useSourceHealth } from '@/lib/useSourceHealth';

function formatDuration(isoStart: string): string {
  const ms = Date.now() - new Date(isoStart).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours < 24) return `${hours}h ${remainMins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
}

interface SourceHealthPanelProps {
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function SourceHealthPanel({ collapsible, defaultCollapsed }: SourceHealthPanelProps = {}) {
  const {
    sources,
    isLoading,
    lastChecked,
    onlineCount,
    degradedCount,
    offlineCount,
    datapoints,
    refetch,
  } = useSourceHealth();

  const hasUnhealthy = offlineCount > 0 || degradedCount > 0;
  const [collapsed, setCollapsed] = useState(collapsible ? (defaultCollapsed ?? false) : false);
  const totalSourcesDisplay = sources.length > 0 ? sources.length : 34;
  const healthyDisplay = sources.length > 0 ? String(onlineCount) : '?';

  useEffect(() => {
    if (!collapsible) return;
    // Only auto-collapse when healthy; never force-expand when unhealthy
    if (!hasUnhealthy) setCollapsed(true);
  }, [collapsible, hasUnhealthy]);

  const unhealthySources = useMemo(
    () =>
      sources
        .filter((s) => s.status === 'offline' || s.status === 'degraded')
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'offline' ? -1 : 1;
          if (!a.offlineSince) return 1;
          if (!b.offlineSince) return -1;
          return new Date(a.offlineSince).getTime() - new Date(b.offlineSince).getTime();
        }),
    [sources],
  );

  // ── COLLAPSED: thin single-line bar ──────────────────────────────────────
  if (collapsed) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-1.5">
        <div className="flex items-center gap-2">
          {hasUnhealthy ? (
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-green-500" />
          )}
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sentinel Health</span>
          <span className="text-xs text-slate-400">
            {hasUnhealthy
              ? `${offlineCount > 0 ? `${offlineCount} offline` : ''}${offlineCount > 0 && degradedCount > 0 ? ' · ' : ''}${degradedCount > 0 ? `${degradedCount} degraded` : ''} — ${onlineCount}/${sources.length || totalSourcesDisplay} healthy`
              : `${healthyDisplay}/${totalSourcesDisplay} healthy`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={refetch}
            className="h-6 w-6 p-0"
            title="Refresh health checks"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin text-slate-400' : 'text-slate-400'} />
          </Button>
          <button
            onClick={() => setCollapsed(false)}
            className="p-0.5 rounded hover:bg-slate-100 transition-colors"
            title="Expand"
          >
            <ChevronDown size={14} className="text-slate-400" />
          </button>
        </div>
      </div>
    );
  }

  // ── EXPANDED: full card ────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base flex-wrap">
          {collapsible && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-0.5 -ml-1 rounded hover:bg-slate-100 transition-colors"
              title="Collapse"
            >
              <ChevronUp size={16} className="text-slate-500" />
            </button>
          )}
          <Activity size={16} className="text-slate-600" />
          Sentinel Health
          <Badge variant="secondary" className="ml-1 text-[10px]">
            {healthyDisplay}/{totalSourcesDisplay} healthy
          </Badge>
          {degradedCount > 0 && (
            <Badge className="bg-amber-100 text-amber-700 text-[10px]">
              {degradedCount} degraded
            </Badge>
          )}
          {offlineCount > 0 && (
            <Badge className="bg-red-100 text-red-700 text-[10px]">
              {offlineCount} offline
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={refetch}
            className="ml-auto h-7 w-7 p-0"
            title="Refresh health checks"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </CardTitle>
        {lastChecked && (
          <p className="text-[10px] text-slate-400">
            Last checked: {new Date(lastChecked).toLocaleTimeString()}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
          {sources.length > 0 && (
            <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Database size={14} className="text-blue-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-lg font-bold text-slate-800 leading-tight">
                    {datapoints ? formatNumber(datapoints.total) : '-'}
                  </span>
                  <span className="text-[10px] text-slate-500 ml-1">cached</span>
                  {datapoints?.totalAccessible && (
                    <>
                      <span className="text-[10px] text-slate-400 mx-1">&middot;</span>
                      <span className="text-sm font-semibold text-blue-600">
                        {formatNumber(datapoints.totalAccessible)}+
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1">accessible</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-600 border-l border-slate-200 pl-4">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>
                  <span className="font-semibold text-slate-800">{onlineCount}</span>/{sources.length} healthy
                </span>
              </div>

              {offlineCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 border-l border-slate-200 pl-4">
                  <AlertTriangle size={12} />
                  <span className="font-semibold">{offlineCount} offline</span>
                </div>
              )}
            </div>
          )}

          {unhealthySources.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle size={12} className="text-red-600" />
                <span className="text-xs font-semibold text-red-700">Attention Needed Sources</span>
              </div>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {unhealthySources.map((src) => (
                  <div key={src.id} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 min-w-0">
                      {src.status === 'offline' ? (
                        <WifiOff size={10} className="text-red-500 shrink-0" />
                      ) : (
                        <AlertTriangle size={10} className="text-amber-500 shrink-0" />
                      )}
                      <span className={`font-medium truncate ${src.status === 'offline' ? 'text-red-800' : 'text-amber-800'}`}>{src.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-right">
                      <span className={`uppercase text-[10px] font-semibold ${src.status === 'offline' ? 'text-red-600' : 'text-amber-600'}`}>
                        {src.status}
                      </span>
                      {src.offlineSince && (
                        <span className="text-red-600 font-semibold">
                          {formatDuration(src.offlineSince)}
                        </span>
                      )}
                      {src.error && (
                        <span className="text-red-400 truncate max-w-[120px]" title={src.error}>
                          {src.error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
              All tracked sources are healthy.
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Total Dataset
              <span className="normal-case tracking-normal font-normal text-slate-400 ml-1">
                {datapoints
                  ? ` - ${formatNumber(datapoints.total)} cached of ${datapoints.totalAccessible ? `${formatNumber(datapoints.totalAccessible)}+` : '-'} accessible across ${totalSourcesDisplay} federal sources`
                  : ` - loading cached totals across ${totalSourcesDisplay} federal sources`}
              </span>
            </div>
            {datapoints ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1.5 text-[11px]">
                {([
                  ['ATTAINS', datapoints.attains.waterbodies, 'waterbodies'],
                  ['ATTAINS Assessed', datapoints.attains.assessments, 'assessments'],
                  ['WQP', datapoints.wqp.records, 'records'],
                  ['ICIS Permits', datapoints.icis.permits, ''],
                  ['ICIS Violations', datapoints.icis.violations, ''],
                  ['ICIS DMR', datapoints.icis.dmr, ''],
                  ['ICIS Enforcement', datapoints.icis.enforcement, ''],
                  ['SDWIS Systems', datapoints.sdwis.systems, ''],
                  ['SDWIS Violations', datapoints.sdwis.violations, ''],
                  ['ECHO Facilities', datapoints.echo.facilities, ''],
                  ['ECHO Violations', datapoints.echo.violations, ''],
                  ['FRS WWTPs', datapoints.frs.facilities, ''],
                  ['WDFN-GW Sites', datapoints.nwisGw.sites, ''],
                  ['WDFN-GW Levels', datapoints.nwisGw.levels, ''],
                  ['PFAS Results', datapoints.pfas.results, ''],
                  ['CEDEN Chem', datapoints.ceden.chemistry, ''],
                  ['CEDEN Tox', datapoints.ceden.toxicity, ''],
                  ['BWB Stations', datapoints.bwb.stations, ''],
                  ['CDC NWSS', datapoints.cdcNwss?.records ?? 0, ''],
                  ['NOAA Buoys', datapoints.ndbc?.stations ?? 0, ''],
                  ['NASA CMR', datapoints.nasaCmr?.collections ?? 0, 'collections'],
                  ['NARS Sites', datapoints.nars?.sites ?? 0, ''],
                  ['Data.gov', datapoints.dataGov?.datasets ?? 0, 'datasets'],
                  ['USACE', datapoints.usace?.locations ?? 0, 'locations'],
                  ['MDE IR', datapoints.mde?.assessmentUnits ?? 0, 'units'],
                ] as [string, number, string][])
                  .filter(([, count]) => count > 0)
                  .map(([label, count, unit]) => (
                    <div key={label} className="flex items-baseline justify-between">
                      <span className="text-slate-500 truncate mr-2">{label}</span>
                      <span className="font-semibold text-slate-800 font-mono tabular-nums">
                        {formatNumber(count)}{unit ? <span className="text-slate-400 font-normal ml-0.5">{unit}</span> : ''}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400">Loading dataset totals...</div>
            )}
          </div>
        </CardContent>
    </Card>
  );
}
