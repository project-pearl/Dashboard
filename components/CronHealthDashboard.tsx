'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer,
} from 'recharts';
import { Activity, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { useCacheStatus } from '@/hooks/useCacheStatus';

// ── Types ────────────────────────────────────────────────────────────────────

interface CronHealthSummary {
  lastRun: string | null;
  lastStatus: 'success' | 'error' | null;
  successRate24h: number;
  totalRuns24h: number;
  avgDurationMs: number;
}

interface CronRunRecord {
  name: string;
  status: 'success' | 'error';
  durationMs: number;
  error?: string;
  timestamp: string;
}

interface CacheStatusEntry {
  built?: string;
  lastBuilt?: string;
  recordCount?: number;
  totalRecords?: number;
  status?: string;
  [key: string]: unknown;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CronHealthDashboard() {
  const [healthData, setHealthData] = useState<{
    summary: Record<string, CronHealthSummary>;
    history: Record<string, CronRunRecord[]>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Shared cache-status poller (polls at 60s, deduped across all subscribers)
  const { data: cacheStatusData } = useCacheStatus({ periodMs: 60_000 });
  const cacheData = cacheStatusData?.caches as Record<string, CacheStatusEntry> | null ?? null;

  const fetchCronHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cron-health');
      if (res.ok) setHealthData(await res.json());
      setLastRefresh(new Date());
    } catch {
      // Silent — dashboard is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCronHealth();
    const interval = setInterval(fetchCronHealth, 60_000);
    return () => clearInterval(interval);
  }, [fetchCronHealth]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const summary = healthData?.summary ?? {};
  const history = healthData?.history ?? {};

  const totalCrons = Object.keys(summary).length;
  const failedCrons = Object.values(summary).filter(s => s.lastStatus === 'error').length;
  const overallSuccessRate = totalCrons > 0
    ? Math.round(Object.values(summary).reduce((sum, s) => sum + s.successRate24h, 0) / totalCrons)
    : 100;

  // Count stale caches (built > 26h ago)
  const staleCaches = useMemo(() => {
    if (!cacheData) return 0;
    const staleThreshold = Date.now() - 26 * 60 * 60 * 1000;
    let count = 0;
    for (const val of Object.values(cacheData)) {
      if (typeof val !== 'object' || val === null) continue;
      const builtStr = val.built || val.lastBuilt;
      if (typeof builtStr === 'string') {
        const builtTime = new Date(builtStr).getTime();
        if (builtTime < staleThreshold) count++;
      }
    }
    return count;
  }, [cacheData]);

  // Recent failures across all crons
  const recentFailures = useMemo(() => {
    const failures: CronRunRecord[] = [];
    for (const runs of Object.values(history)) {
      for (const r of runs) {
        if (r.status === 'error') failures.push(r);
      }
    }
    return failures
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);
  }, [history]);

  // Success rate chart data (hourly buckets over last 24h)
  const chartData = useMemo(() => {
    const now = Date.now();
    const buckets: { hour: string; success: number; error: number }[] = [];
    for (let i = 23; i >= 0; i--) {
      const bucketStart = now - (i + 1) * 3600_000;
      const bucketEnd = now - i * 3600_000;
      const label = new Date(bucketEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let success = 0;
      let error = 0;
      for (const runs of Object.values(history)) {
        for (const r of runs) {
          const t = new Date(r.timestamp).getTime();
          if (t >= bucketStart && t < bucketEnd) {
            if (r.status === 'success') success++;
            else error++;
          }
        }
      }
      buckets.push({ hour: label, success, error });
    }
    return buckets;
  }, [history]);

  // Cache status entries for the grid
  const cacheEntries = useMemo(() => {
    if (!cacheData) return [];
    return Object.entries(cacheData)
      .filter(([, val]) => typeof val === 'object' && val !== null)
      .map(([name, val]) => {
        const builtStr = (val as CacheStatusEntry).built || (val as CacheStatusEntry).lastBuilt || '';
        const builtTime = builtStr ? new Date(builtStr).getTime() : 0;
        const ageH = builtTime ? (Date.now() - builtTime) / 3600_000 : Infinity;
        const badge: 'fresh' | 'stale' | 'missing' =
          ageH === Infinity ? 'missing' : ageH > 26 ? 'stale' : 'fresh';
        return { name, badge, builtStr, ageH };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cacheData]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-slate-500">
          <RefreshCw size={16} className="inline animate-spin mr-2" />
          Loading cron health data...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Summary Strip ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity size={16} className="text-slate-700" />
              Cron & Cache Health
            </CardTitle>
            {lastRefresh && (
              <span className="text-2xs text-slate-400">
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold font-mono text-slate-800">{totalCrons}</div>
              <div className="text-xs text-slate-500">Crons Tracked</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className={`text-2xl font-bold font-mono ${overallSuccessRate >= 90 ? 'text-green-700' : overallSuccessRate >= 70 ? 'text-amber-700' : 'text-red-700'}`}>
                {overallSuccessRate}%
              </div>
              <div className="text-xs text-slate-500">24h Success Rate</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className={`text-2xl font-bold font-mono ${failedCrons > 0 ? 'text-red-700' : 'text-green-700'}`}>
                {failedCrons}
              </div>
              <div className="text-xs text-slate-500">Failed (Last Run)</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className={`text-2xl font-bold font-mono ${staleCaches > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                {staleCaches}
              </div>
              <div className="text-xs text-slate-500">Stale Caches</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Success Rate Chart ────────────────────────────────────── */}
      {chartData.some(d => d.success > 0 || d.error > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cron Runs (24h)</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <RTooltip contentStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="success" stackId="1" fill="#86efac" stroke="#22c55e" name="Success" />
                  <Area type="monotone" dataKey="error" stackId="1" fill="#fca5a5" stroke="#ef4444" name="Error" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Cache Status Grid ─────────────────────────────────────── */}
      {cacheEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cache Status</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex flex-wrap gap-2">
              {cacheEntries.map(c => (
                <Badge
                  key={c.name}
                  className={
                    c.badge === 'fresh'
                      ? 'bg-green-100 text-green-800 hover:bg-green-100'
                      : c.badge === 'stale'
                      ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                      : 'bg-red-100 text-red-800 hover:bg-red-100'
                  }
                  title={c.builtStr ? `Built ${new Date(c.builtStr).toLocaleString()} (${Math.round(c.ageH)}h ago)` : 'No data'}
                >
                  {c.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Recent Failures ───────────────────────────────────────── */}
      {recentFailures.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-600" />
              Recent Failures
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-2 py-1.5 font-medium text-slate-600">Cron</th>
                    <th className="px-2 py-1.5 font-medium text-slate-600">Time</th>
                    <th className="px-2 py-1.5 font-medium text-slate-600">Duration</th>
                    <th className="px-2 py-1.5 font-medium text-slate-600">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {recentFailures.map((f, i) => (
                    <tr key={`${f.name}-${f.timestamp}-${i}`} className="border-b last:border-b-0">
                      <td className="px-2 py-1.5 font-mono text-xs text-slate-800">{f.name}</td>
                      <td className="px-2 py-1.5 text-xs text-slate-500">
                        {new Date(f.timestamp).toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-slate-500">
                        {(f.durationMs / 1000).toFixed(1)}s
                      </td>
                      <td className="px-2 py-1.5 text-xs text-red-600 max-w-xs truncate">
                        {f.error || 'Unknown error'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Per-Cron Summary Table ────────────────────────────────── */}
      {totalCrons > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">All Crons</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-2 py-1.5 font-medium text-slate-600">Name</th>
                    <th className="px-2 py-1.5 font-medium text-slate-600">Last Run</th>
                    <th className="px-2 py-1.5 font-medium text-slate-600">Status</th>
                    <th className="px-2 py-1.5 font-medium text-slate-600">24h Rate</th>
                    <th className="px-2 py-1.5 font-medium text-slate-600">Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([name, s]) => (
                      <tr key={name} className="border-b last:border-b-0">
                        <td className="px-2 py-1.5 font-mono text-xs text-slate-800">{name}</td>
                        <td className="px-2 py-1.5 text-xs text-slate-500">
                          {s.lastRun ? new Date(s.lastRun).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-2 py-1.5">
                          {s.lastStatus === 'success' ? (
                            <CheckCircle size={14} className="text-green-600" />
                          ) : s.lastStatus === 'error' ? (
                            <AlertTriangle size={14} className="text-red-600" />
                          ) : (
                            <Clock size={14} className="text-slate-400" />
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`text-xs font-mono ${s.successRate24h >= 90 ? 'text-green-700' : s.successRate24h >= 70 ? 'text-amber-700' : 'text-red-700'}`}>
                            {s.successRate24h}%
                          </span>
                          <span className="text-2xs text-slate-400 ml-1">({s.totalRuns24h})</span>
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-500 font-mono">
                          {s.avgDurationMs > 0 ? `${(s.avgDurationMs / 1000).toFixed(1)}s` : '-'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
