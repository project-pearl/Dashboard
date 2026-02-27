/* ------------------------------------------------------------------ */
/*  SentinelBriefingCard — 3-layer National Intelligence Briefing     */
/*  Layer 1: Active events  |  Layer 2: Recent resolutions           */
/*  Layer 3: Structural context (passed as children)                  */
/* ------------------------------------------------------------------ */

'use client';

import React from 'react';
import {
  AlertTriangle,
  Eye,
  CheckCircle,
  Shield,
  Clock,
  TrendingDown,
} from 'lucide-react';
import type { ScoredHucClient, ResolvedHuc, SentinelSourceState } from '@/lib/sentinel/types';
import type { SystemStatus } from '@/hooks/useSentinelAlerts';

interface SentinelBriefingCardProps {
  criticalHucs: ScoredHucClient[];
  watchHucs: ScoredHucClient[];
  recentResolutions: ResolvedHuc[];
  hucNames: Record<string, string>;
  sources: SentinelSourceState[];
  systemStatus: SystemStatus;
  lastFetched: string | null;
  children?: React.ReactNode; // Layer 3 — structural context (ATTAINS etc.)
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

const LEVEL_BORDER: Record<string, string> = {
  CRITICAL: '#D32F2F',
  WATCH: '#F9A825',
};

function EventRow({ huc, hucNames }: { huc: ScoredHucClient; hucNames: Record<string, string> }) {
  const border = LEVEL_BORDER[huc.level] ?? 'var(--border-default)';
  return (
    <div
      className="p-3 rounded-lg"
      style={{
        background: 'var(--bg-card)',
        borderLeft: `3px solid ${border}`,
        border: '1px solid var(--border-subtle)',
        borderLeftWidth: '3px',
        borderLeftColor: border,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {huc.level === 'CRITICAL' ? (
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          ) : (
            <Eye className="w-4 h-4 text-amber-500 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-bright)' }}>
              {hucNames[huc.huc8] ?? huc.huc8}
            </div>
            {huc.patternNames.length > 0 && (
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {huc.patternNames.map(p => p.replace(/-/g, ' ')).join(' + ')}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="sentinel-score-badge text-[10px] w-6 h-6"
            data-level={huc.level}
            style={{ width: '24px', height: '24px', fontSize: '10px' }}
          >
            {Math.round(huc.score)}
          </span>
          <div className="text-right">
            <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
              {huc.eventCount} signal{huc.eventCount !== 1 ? 's' : ''}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
              {formatTimeSince(huc.lastScored)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResolutionRow({ r, hucNames }: { r: ResolvedHuc; hucNames: Record<string, string> }) {
  return (
    <div
      className="p-2.5 rounded-lg opacity-70"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--status-healthy)' }} />
          <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
            {hucNames[r.huc8] ?? r.huc8}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 text-[10px]" style={{ color: 'var(--text-dim)' }}>
          <span>Peak: {Math.round(r.peakScore)}</span>
          <span>{formatTimeSince(r.resolvedAt)}</span>
        </div>
      </div>
    </div>
  );
}

export function SentinelBriefingCard({
  criticalHucs,
  watchHucs,
  recentResolutions,
  hucNames,
  sources,
  systemStatus,
  lastFetched,
  children,
}: SentinelBriefingCardProps) {
  const activeEvents = [...criticalHucs, ...watchHucs].sort((a, b) => b.score - a.score);
  const healthySources = sources.filter(s => s.status === 'HEALTHY').length;

  return (
    <div className="space-y-4">
      {/* ── Layer 1: Active Sentinel Events ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4" style={{ color: 'var(--accent-teal)' }} />
          <span className="pin-section-label">Active Sentinel Events</span>
        </div>

        {activeEvents.length > 0 ? (
          <div className="space-y-2">
            {activeEvents.map(h => (
              <EventRow key={h.huc8} huc={h} hucNames={hucNames} />
            ))}
          </div>
        ) : (
          <div
            className="p-3 rounded-lg text-xs text-center"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <CheckCircle className="w-3.5 h-3.5" style={{ color: 'var(--status-healthy)' }} />
              <span className="font-medium">No active alerts</span>
            </div>
            <span style={{ color: 'var(--text-dim)' }}>
              Sentinel monitoring {healthySources} sources
              {lastFetched && ` — Last scan: ${formatTimeSince(lastFetched)}`}
            </span>
          </div>
        )}
      </div>

      {/* ── Layer 2: Recent Resolutions ── */}
      {recentResolutions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />
            <span className="pin-section-label">Recent Resolutions</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
              background: 'var(--bg-card)',
              color: 'var(--text-dim)',
              border: '1px solid var(--border-subtle)',
            }}>
              past 7d
            </span>
          </div>
          <div className="space-y-1.5">
            {recentResolutions.slice(0, 5).map(r => (
              <ResolutionRow key={`${r.huc8}-${r.resolvedAt}`} r={r} hucNames={hucNames} />
            ))}
          </div>
        </div>
      )}

      {/* ── Layer 3: Structural Context (ATTAINS etc.) ── */}
      {children && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4" style={{ color: 'var(--text-dim)' }} />
            <span className="pin-section-label">Structural Context</span>
          </div>
          {children}
        </div>
      )}
    </div>
  );
}
