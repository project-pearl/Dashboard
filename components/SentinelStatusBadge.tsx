/* ------------------------------------------------------------------ */
/*  SentinelStatusBadge — Corner status indicator for map card        */
/* ------------------------------------------------------------------ */

'use client';

import React, { useState } from 'react';
import type { SystemStatus } from '@/hooks/useSentinelAlerts';
import type { SentinelSourceState } from '@/lib/sentinel/types';

interface SentinelStatusBadgeProps {
  systemStatus: SystemStatus;
  lastFetched: string | null;
  sources: SentinelSourceState[];
  criticalCount: number;
  watchCount: number;
}

function formatTimeSince(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

const STATUS_LABELS: Record<SystemStatus, string> = {
  active: 'Sentinel Active',
  degraded: 'Sentinel Active',
  offline: 'Sentinel Offline',
};

export function SentinelStatusBadge({
  systemStatus,
  lastFetched,
  sources,
  criticalCount,
  watchCount,
}: SentinelStatusBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  const degradedCount = sources.filter(s => s.status === 'DEGRADED').length;
  const offlineCount = sources.filter(s => s.status === 'OFFLINE').length;

  const subtextParts: string[] = [];
  if (systemStatus === 'degraded') {
    const issues = [];
    if (degradedCount > 0) issues.push(`${degradedCount} degraded`);
    if (offlineCount > 0) issues.push(`${offlineCount} offline`);
    subtextParts.push(issues.join(', '));
  } else if (systemStatus === 'offline') {
    subtextParts.push(`${offlineCount} sources unreachable`);
  } else {
    subtextParts.push(`Last scan: ${formatTimeSince(lastFetched)}`);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span className="sentinel-status-dot" data-status={systemStatus} />
        <span className="font-medium">{STATUS_LABELS[systemStatus]}</span>
        <span className="hidden sm:inline">— {subtextParts[0]}</span>

        {criticalCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-600 text-white">
            {criticalCount} CRITICAL
          </span>
        )}
        {watchCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500 text-black">
            {watchCount} WATCH
          </span>
        )}
      </button>

      {/* Expanded source health detail */}
      {expanded && (
        <div
          className="absolute top-full right-0 mt-1 z-50 w-64 rounded-lg shadow-lg p-3 space-y-1.5"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
          }}
        >
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-bright)' }}>
            Source Health
          </div>
          {sources.map(s => (
            <div key={s.source} className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--text-primary)' }}>
                {s.source.replace(/_/g, ' ')}
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="sentinel-status-dot"
                  data-status={
                    s.status === 'HEALTHY' ? 'active' : s.status === 'DEGRADED' ? 'degraded' : 'offline'
                  }
                />
                <span style={{ color: 'var(--text-dim)' }}>
                  {s.lastSuccessAt ? formatTimeSince(s.lastSuccessAt) : 'never'}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
