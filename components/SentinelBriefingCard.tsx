/* ------------------------------------------------------------------ */
/*  SentinelBriefingCard — 3-layer National Intelligence Briefing     */
/*  Layer 1: Active events  |  Layer 2: Recent resolutions           */
/*  Layer 3: Structural context (passed as children)                  */
/* ------------------------------------------------------------------ */

'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Eye,
  CheckCircle,
  Shield,
  Clock,
  TrendingDown,
  Check,
  ChevronDown,
} from 'lucide-react';
import { FIPS_TO_ABBR } from '@/lib/mapUtils';
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

function scoreSeverity(score: number): { label: string; color: string } {
  if (score >= 400) return { label: 'Critical', color: 'var(--status-critical, #D32F2F)' };
  if (score >= 300) return { label: 'Severe', color: '#E65100' };
  if (score >= 200) return { label: 'Elevated', color: '#F9A825' };
  return { label: 'Watch', color: 'var(--text-secondary)' };
}

function hucStateAbbr(huc8: string): string {
  const fips = huc8.slice(0, 2);
  return FIPS_TO_ABBR[fips] || '';
}

const LEVEL_BORDER: Record<string, string> = {
  CRITICAL: '#D32F2F',
  WATCH: '#F9A825',
};

function EventRow({
  huc,
  hucNames,
  onMarkReviewed,
}: {
  huc: ScoredHucClient;
  hucNames: Record<string, string>;
  onMarkReviewed?: (id: string) => void;
}) {
  const border = LEVEL_BORDER[huc.level] ?? 'var(--border-default)';
  const stateAbbr = hucStateAbbr(huc.huc8);
  const hucName = hucNames[huc.huc8] ?? huc.huc8;
  const displayName = stateAbbr ? `${hucName}, ${stateAbbr}` : hucName;
  const severity = scoreSeverity(huc.score);

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
              {displayName}
            </div>
            {huc.patternNames.length > 0 && (
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {huc.patternNames.map(p => p.replace(/-/g, ' ')).join(' + ')}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-1">
              <span
                className="sentinel-score-badge text-[10px] w-6 h-6"
                data-level={huc.level}
                style={{ width: '24px', height: '24px', fontSize: '10px' }}
              >
                {Math.round(huc.score)}
              </span>
              <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>/500</span>
            </div>
            <div className="text-[9px] font-medium mt-0.5" style={{ color: severity.color }}>
              {severity.label}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
              {huc.eventCount} signal{huc.eventCount !== 1 ? 's' : ''}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
              {formatTimeSince(huc.lastScored)}
            </div>
          </div>
          {onMarkReviewed && (
            <button
              onClick={() => onMarkReviewed(huc.huc8)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="Mark Reviewed"
              style={{ color: 'var(--text-dim)' }}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ResolutionRow({ r, hucNames }: { r: ResolvedHuc; hucNames: Record<string, string> }) {
  const stateAbbr = hucStateAbbr(r.huc8);
  const hucName = hucNames[r.huc8] ?? r.huc8;
  const displayName = stateAbbr ? `${hucName}, ${stateAbbr}` : hucName;

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
            {displayName}
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
  const allActiveEvents = [...criticalHucs, ...watchHucs].sort((a, b) => b.score - a.score);
  const healthySources = sources.filter(s => s.status === 'HEALTHY').length;

  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showReviewed, setShowReviewed] = useState(false);

  const activeEvents = allActiveEvents.filter(h => !reviewedIds.has(h.huc8));
  const reviewedEvents = allActiveEvents.filter(h => reviewedIds.has(h.huc8));
  const visibleEvents = showAllEvents ? activeEvents : activeEvents.slice(0, 3);

  const handleMarkReviewed = (huc8: string) => {
    setReviewedIds(prev => {
      const next = new Set(prev);
      next.add(huc8);
      return next;
    });
  };

  const handleUnmarkReviewed = (huc8: string) => {
    setReviewedIds(prev => {
      const next = new Set(prev);
      next.delete(huc8);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* ── Score Legend ── */}
      <div className="flex items-center gap-3 flex-wrap text-[9px]" style={{ color: 'var(--text-dim)' }}>
        <span className="font-medium">Severity:</span>
        {[
          { label: 'Critical', range: '400+', color: '#D32F2F' },
          { label: 'Severe', range: '300–399', color: '#E65100' },
          { label: 'Elevated', range: '200–299', color: '#F9A825' },
          { label: 'Watch', range: '<200', color: 'var(--text-secondary)' },
        ].map(s => (
          <span key={s.label} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
            {s.label} ({s.range})
          </span>
        ))}
        <span className="ml-auto">Score out of 500</span>
      </div>

      {/* ── Layer 1: Active Sentinel Events ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4" style={{ color: 'var(--accent-teal)' }} />
          <span className="pin-section-label">Active Sentinel Events</span>
          {activeEvents.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
              background: 'var(--bg-card)',
              color: 'var(--text-dim)',
              border: '1px solid var(--border-subtle)',
            }}>
              {activeEvents.length} active
            </span>
          )}
          {reviewedEvents.length > 0 && (
            <button
              onClick={() => setShowReviewed(!showReviewed)}
              className="text-[10px] px-1.5 py-0.5 rounded-full transition-colors"
              style={{
                background: showReviewed ? 'var(--accent-teal)' : 'var(--bg-card)',
                color: showReviewed ? 'white' : 'var(--text-dim)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {reviewedEvents.length} reviewed
            </button>
          )}
        </div>

        {activeEvents.length > 0 ? (
          <div className="space-y-2">
            {visibleEvents.map(h => (
              <EventRow key={h.huc8} huc={h} hucNames={hucNames} onMarkReviewed={handleMarkReviewed} />
            ))}
            {activeEvents.length > 3 && (
              <button
                onClick={() => setShowAllEvents(!showAllEvents)}
                className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllEvents ? 'rotate-180' : ''}`} />
                {showAllEvents
                  ? 'Show top 3'
                  : `View all ${activeEvents.length} events`}
              </button>
            )}
            {!showAllEvents && activeEvents.length > 3 && (
              <div className="text-[10px] text-center" style={{ color: 'var(--text-dim)' }}>
                Showing 3 of {activeEvents.length} active events
              </div>
            )}
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

      {/* ── Reviewed Events ── */}
      {showReviewed && reviewedEvents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-4 h-4" style={{ color: 'var(--status-healthy)' }} />
            <span className="pin-section-label">Reviewed Events</span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {reviewedEvents.map(h => (
              <div key={h.huc8} className="relative">
                <EventRow huc={h} hucNames={hucNames} />
                <button
                  onClick={() => handleUnmarkReviewed(h.huc8)}
                  className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded transition-colors"
                  style={{
                    color: 'var(--text-dim)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
