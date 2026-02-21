'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, AlertTriangle, Database, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useSourceHealth, SourceHealth } from '@/lib/useSourceHealth';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function responseTimeColor(ms: number): string {
  if (ms < 0) return 'text-gray-400';
  if (ms < 500) return 'text-green-600';
  if (ms < 2000) return 'text-amber-600';
  if (ms < 5000) return 'text-orange-600';
  return 'text-red-600';
}

const STATUS_STYLES = {
  online: {
    dot: 'bg-green-500 animate-pulse',
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-700',
  },
  degraded: {
    dot: 'bg-amber-500 animate-pulse',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
  },
  offline: {
    dot: 'bg-red-500',
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
  },
  unknown: {
    dot: 'bg-gray-400',
    bg: 'bg-gray-50 border-gray-200',
    text: 'text-gray-600',
  },
};

// ─── Source Card ──────────────────────────────────────────────────────────────

function SourceCard({ source }: { source: SourceHealth }) {
  const style = STATUS_STYLES[source.status] || STATUS_STYLES.unknown;

  return (
    <div className={`rounded-lg border p-3 ${style.bg} transition-colors`}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
        <span className="text-xs font-semibold text-slate-800 truncate">{source.name}</span>
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span className={`font-medium capitalize ${style.text}`}>
          {source.status === 'online' && <Wifi size={10} className="inline mr-0.5 -mt-px" />}
          {source.status === 'offline' && <WifiOff size={10} className="inline mr-0.5 -mt-px" />}
          {source.status}
        </span>
        {source.responseTimeMs >= 0 && (
          <span className={`font-mono ${responseTimeColor(source.responseTimeMs)}`}>
            {source.responseTimeMs}ms
          </span>
        )}
      </div>

      {source.status === 'offline' && source.offlineSince && (
        <p className="text-[10px] text-red-600 mt-1 font-medium">
          Offline for {formatDuration(source.offlineSince)}
        </p>
      )}
      {source.status === 'offline' && source.error && (
        <p className="text-[10px] text-red-500 mt-0.5 truncate" title={source.error}>
          {source.error}
        </p>
      )}
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function SourceHealthPanel() {
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

  const offlineSources = useMemo(
    () =>
      sources
        .filter((s) => s.status === 'offline')
        .sort((a, b) => {
          if (!a.offlineSince) return 1;
          if (!b.offlineSince) return -1;
          return new Date(a.offlineSince).getTime() - new Date(b.offlineSince).getTime();
        }),
    [sources],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base flex-wrap">
          <Activity size={16} className="text-slate-600" />
          Data Source Health
          {sources.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {onlineCount}/{sources.length} online
            </Badge>
          )}
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
        {/* ─── Summary Bar ─────────────────────────────────────────────── */}
        {sources.length > 0 && (
          <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
            {/* Datapoint count */}
            <div className="flex items-center gap-2 min-w-0">
              <Database size={14} className="text-blue-600 shrink-0" />
              <div className="min-w-0">
                <span className="text-lg font-bold text-slate-800 leading-tight">
                  {datapoints ? formatNumber(datapoints.total) : '—'}
                </span>
                <span className="text-[10px] text-slate-500 ml-1">datapoints live</span>
              </div>
            </div>

            {/* Source status */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 border-l border-slate-200 pl-4">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>
                <span className="font-semibold text-slate-800">{onlineCount}</span>/{sources.length} sources
              </span>
            </div>

            {/* Offline indicator */}
            {offlineCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 border-l border-slate-200 pl-4">
                <AlertTriangle size={12} />
                <span className="font-semibold">{offlineCount} offline</span>
              </div>
            )}
          </div>
        )}

        {/* ─── Offline Sources Alert ───────────────────────────────────── */}
        {offlineSources.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle size={12} className="text-red-600" />
              <span className="text-xs font-semibold text-red-700">Offline Sources</span>
            </div>
            <div className="space-y-1.5">
              {offlineSources.map((src) => (
                <div key={src.id} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <WifiOff size={10} className="text-red-500 shrink-0" />
                    <span className="font-medium text-red-800 truncate">{src.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-right">
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
        )}

        {/* ─── Source Grid ─────────────────────────────────────────────── */}
        {isLoading && sources.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {Array.from({ length: 13 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {sources.map((src) => (
              <SourceCard key={src.id} source={src} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
