/* ------------------------------------------------------------------ */
/*  SentinelIntelFeed — Filterable 48h Sentinel Event Timeline         */
/* ------------------------------------------------------------------ */

'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Shield,
  Eye,
  Clock,
  ChevronDown,
  ChevronRight,
  Activity,
  Zap,
  Check,
  X,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { useSentinelFeed, type SentinelFeedFilters } from '@/hooks/useSentinelFeed';
import type {
  SentinelFeedEntry,
  ScoreLevel,
  ChangeSource,
  ConfounderCheck,
  ClassificationReasoning,
  CbrnIndicator,
} from '@/lib/sentinel/types';
import { cn } from '@/lib/utils';
import { LEVEL_COLORS, CLASSIFICATION_COLORS, CBRN_COLORS } from '@/lib/design-tokens';

interface SentinelIntelFeedProps {
  hucNames: Record<string, string>;
}

/* ── Colour Constants (dynamic — used for inline style bindings) ── */

const LEVEL_BORDER: Record<string, string> = {
  ANOMALY: LEVEL_COLORS.ANOMALY,
  CRITICAL: LEVEL_COLORS.CRITICAL,
  WATCH: LEVEL_COLORS.WATCH,
  ADVISORY: LEVEL_COLORS.ADVISORY,
};

const LEVEL_BG: Record<string, string> = {
  ANOMALY: `${LEVEL_COLORS.ANOMALY}1a`,
  CRITICAL: `${LEVEL_COLORS.CRITICAL}1a`,
  WATCH: `${LEVEL_COLORS.WATCH}1a`,
  ADVISORY: `${LEVEL_COLORS.ADVISORY}14`,
};

const CLASSIFICATION_BADGE: Record<string, { bg: string; text: string }> = {
  likely_attack: { bg: CLASSIFICATION_COLORS.likely_attack, text: '#fff' },
  possible_attack: { bg: CLASSIFICATION_COLORS.possible_attack, text: '#fff' },
  likely_benign: { bg: CLASSIFICATION_COLORS.likely_benign, text: '#fff' },
  insufficient_data: { bg: CLASSIFICATION_COLORS.insufficient_data, text: '#fff' },
};

const TIME_RANGES = [
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
] as const;

const LEVELS: ScoreLevel[] = ['ANOMALY', 'CRITICAL', 'WATCH', 'ADVISORY'];

const LEVEL_PRIORITY: Record<string, number> = {
  ANOMALY: 0,
  CRITICAL: 1,
  WATCH: 2,
  ADVISORY: 3,
  NOMINAL: 4,
};

const INITIAL_VISIBLE = 5;

/* ── Helpers ── */

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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

const SOURCE_LABELS: Partial<Record<ChangeSource, string>> = {
  NWS_ALERTS: 'NWS', AIR_QUALITY: 'AQI', NWPS_FLOOD: 'Flood', NWPS_FORECAST: 'NWPS',
  USGS_IV: 'USGS', SSO_CSO: 'SSO/CSO', NPDES_DMR: 'NPDES', QPE_RAINFALL: 'QPE',
  ATTAINS: 'ATTAINS', STATE_DISCHARGE: 'Discharge', FEMA_DISASTER: 'FEMA',
  ECHO_ENFORCEMENT: 'ECHO', CDC_NWSS: 'NWSS', HABSOS: 'HAB', EPA_BEACON: 'Beacon',
  TRI_RELEASE: 'TRI', RCRA_VIOLATION: 'RCRA', SEMS_SUPERFUND: 'Superfund', CAMPD_EMISSIONS: 'CAMPD',
};

/* ── Sub-Components ── */

function ConfounderRow({ c }: { c: ConfounderCheck }) {
  return (
    <div className="flex items-center gap-1.5 text-pin-xs">
      {c.matched
        ? <Check size={13} className="text-pin-success" />
        : <X size={13} className="text-pin-nominal" />}
      <span className={cn(c.matched ? 'text-pin-success' : 'text-pin-text-secondary')}>{c.rule}</span>
      <span className="text-pin-text-secondary text-pin-xs">{c.detail}</span>
    </div>
  );
}

function ReasoningRow({ r }: { r: ClassificationReasoning }) {
  return (
    <div className="flex items-center gap-1.5 text-pin-xs">
      <span className={cn('font-semibold', r.effect === 'boost' ? 'text-pin-critical' : 'text-pin-success')}>
        {r.effect === 'boost' ? '+' : '-'}{r.magnitude.toFixed(2)}
      </span>
      <span>{r.rule}</span>
      <span className="text-pin-text-secondary text-pin-xs">{r.detail}</span>
    </div>
  );
}

function CbrnBadge({ ind }: { ind: CbrnIndicator }) {
  const color = CBRN_COLORS[ind.category as keyof typeof CBRN_COLORS] ?? '#616161';
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-pin-sm px-2 py-0.5 text-pin-xs"
      style={{ background: `${color}18`, border: `1px solid ${color}40` }}
    >
      <span className="font-semibold uppercase" style={{ color }}>{ind.category}</span>
      <div className="h-1 w-10 overflow-hidden rounded-full bg-neutral-300">
        <div className="h-full rounded-full" style={{ width: `${ind.confidence * 100}%`, background: color }} />
      </div>
      <span className="text-pin-text-secondary text-pin-xs">{(ind.confidence * 100).toFixed(0)}%</span>
    </div>
  );
}

function classificationSummary(entry: SentinelFeedEntry): string {
  const parts: string[] = [];
  const boosts = entry.reasoning.filter(r => r.effect === 'boost');
  if (boosts.length > 0) {
    const topBoost = boosts.sort((a, b) => b.magnitude - a.magnitude)[0];
    parts.push(topBoost.rule);
  }
  if (entry.coordination) {
    parts.push(`${entry.coordination.memberHucs.length} correlated HUCs`);
  }
  if (entry.cbrnIndicators.length > 0) {
    const top = entry.cbrnIndicators.sort((a, b) => b.confidence - a.confidence)[0];
    parts.push(`${top.category} indicator ${(top.confidence * 100).toFixed(0)}%`);
  }
  const confMatched = entry.confounders.filter(c => c.matched).length;
  const confTotal = entry.confounders.length;
  if (confTotal > 0 && confMatched < confTotal) {
    parts.push(`${confTotal - confMatched}/${confTotal} confounders ruled out`);
  }
  return parts.length > 0 ? parts.join(' · ') : '';
}

function EntryCard({ entry, hucName }: { entry: SentinelFeedEntry; hucName: string }) {
  const [expanded, setExpanded] = useState(false);
  const border = LEVEL_BORDER[entry.hucLevel] ?? 'var(--border-default)';
  const bg = LEVEL_BG[entry.hucLevel] ?? 'transparent';
  const classBadge = CLASSIFICATION_BADGE[entry.classification] ?? CLASSIFICATION_BADGE.insufficient_data;
  const showClassContext = entry.classification === 'likely_attack' || entry.classification === 'possible_attack';
  const classSummary = showClassContext ? classificationSummary(entry) : '';

  return (
    <div
      className="mb-1.5 overflow-hidden rounded-pin-sm"
      style={{ border: `1px solid ${border}`, borderLeft: `3px solid ${border}`, background: bg }}
    >
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full cursor-pointer flex-wrap items-center gap-2 border-none bg-transparent px-3 py-2 text-left text-pin-sm"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="min-w-[50px] text-pin-text-secondary text-pin-xs">{formatTimeSince(entry.detectedAt)}</span>
          <span className="flex-1 overflow-hidden truncate font-semibold">{hucName}</span>
          <span className="rounded-pin-sm bg-pin-bg-surface px-1.5 py-px text-pin-xs">{SOURCE_LABELS[entry.source] ?? entry.source}</span>
          <span
            className="rounded-pin-sm px-1.5 py-px text-pin-xs"
            style={{ background: classBadge.bg, color: classBadge.text }}
          >
            {entry.classification.replace(/_/g, ' ')}
          </span>
          <span className="min-w-[40px] text-right font-semibold text-pin-xs">{entry.hucScore.toFixed(0)}</span>
        </div>
        {showClassContext && classSummary && (
          <div className="w-full pl-7 text-pin-xs opacity-85" style={{ color: classBadge.bg }}>
            {classSummary}
          </div>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="flex flex-col gap-2.5 px-3 pb-3 pl-[30px] text-pin-sm">
          {/* Event info */}
          <div>
            <div className="mb-1 font-semibold">Event Details</div>
            <div className="flex flex-wrap gap-2 text-pin-xs">
              <span>Source: <strong>{entry.source}</strong></span>
              <span>Type: <strong>{entry.changeType}</strong></span>
              <span>Severity: <strong>{entry.severityHint}</strong></span>
              <span>Time: <strong>{formatTime(entry.detectedAt)}</strong></span>
            </div>
          </div>

          {/* Score contribution */}
          <div>
            <div className="mb-1 font-semibold">Score Contribution</div>
            <div className="flex gap-4 text-pin-xs">
              <span>Base: <strong>{entry.baseScore.toFixed(1)}</strong></span>
              <span>Decayed: <strong>{entry.decayedScore.toFixed(1)}</strong></span>
              <span>HUC Total: <strong>{entry.hucScore.toFixed(0)}</strong> ({entry.hucLevel})</span>
            </div>
            {entry.activePatterns.length > 0 && (
              <div className="mt-1 text-pin-xs">
                Patterns: {entry.activePatterns.map(p => (
                  <span key={p} className="mr-1 rounded-pin-sm bg-pin-bg-surface px-1.5 py-px text-pin-xs">{p}</span>
                ))}
              </div>
            )}
          </div>

          {/* Reasoning chain */}
          {entry.reasoning.length > 0 && (
            <div>
              <div className="mb-1 font-semibold">Classification Reasoning</div>
              {entry.reasoning.map((r, i) => <ReasoningRow key={i} r={r} />)}
            </div>
          )}

          {/* Confounders */}
          {entry.confounders.length > 0 && (
            <div>
              <div className="mb-1 font-semibold">Confounder Checks</div>
              {entry.confounders.map((c, i) => <ConfounderRow key={i} c={c} />)}
            </div>
          )}

          {/* CBRN indicators */}
          {entry.cbrnIndicators.length > 0 && (
            <div>
              <div className="mb-1 font-semibold">CBRN Indicators</div>
              <div className="flex flex-wrap gap-1.5">
                {entry.cbrnIndicators.map((ind, i) => <CbrnBadge key={i} ind={ind} />)}
              </div>
            </div>
          )}

          {/* Coordination */}
          {entry.coordination && (
            <div>
              <div className="mb-1 font-semibold">Coordination Cluster</div>
              <div className="flex gap-4 text-pin-xs">
                <span>Score: <strong>{entry.coordination.coordinationScore.toFixed(1)}</strong></span>
                <span>HUCs: <strong>{entry.coordination.memberHucs.length}</strong></span>
                <span>Breadth: <strong>{entry.coordination.parameterBreadth}</strong></span>
                <span>Spread: <strong>{(entry.coordination.temporalSpread / 3_600_000).toFixed(1)}h</strong></span>
              </div>
            </div>
          )}

          {/* Plume adjustment */}
          {entry.plumeAdjustment && (
            <div>
              <div className="mb-1 font-semibold">Plume Analysis</div>
              <div className="text-pin-xs">
                Exposure: <strong>{entry.plumeAdjustment.exposure}</strong> |
                Target: <strong>{entry.plumeAdjustment.targetName}</strong> |
                Adjustment: <strong>{entry.plumeAdjustment.adjustment > 0 ? '+' : ''}{entry.plumeAdjustment.adjustment.toFixed(1)}</strong>
                {entry.plumeAdjustment.arrivalTimeHours != null && <> | ETA: <strong>{entry.plumeAdjustment.arrivalTimeHours.toFixed(1)}h</strong></>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */

export default function SentinelIntelFeed({ hucNames }: SentinelIntelFeedProps) {
  const [activeLevels, setActiveLevels] = useState<ScoreLevel[]>([]);
  const [activeHours, setActiveHours] = useState(48);
  const [showAll, setShowAll] = useState(false);

  const filters: SentinelFeedFilters = useMemo(() => ({
    levels: activeLevels.length > 0 ? activeLevels : undefined,
    hours: activeHours,
  }), [activeLevels, activeHours]);

  const { entries, summary, isLoading, error, lastFetched, refetch } = useSentinelFeed(filters);

  // Sort by threat level priority, then by threatScore descending
  const sortedEntries = useMemo(() =>
    [...entries].sort((a, b) => {
      const levelDiff = (LEVEL_PRIORITY[a.hucLevel] ?? 4) - (LEVEL_PRIORITY[b.hucLevel] ?? 4);
      if (levelDiff !== 0) return levelDiff;
      return b.threatScore - a.threatScore;
    }),
    [entries],
  );

  const visibleEntries = showAll ? sortedEntries : sortedEntries.slice(0, INITIAL_VISIBLE);
  const hiddenCount = sortedEntries.length - INITIAL_VISIBLE;

  const toggleLevel = (l: ScoreLevel) => {
    setActiveLevels(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  };

  if (error && entries.length === 0) {
    return (
      <div className="p-4 text-pin-text-secondary">
        <AlertTriangle size={16} className="mr-1.5 inline" />
        Sentinel feed unavailable: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-pin-text-secondary" />
        {LEVELS.map(l => (
          <button
            key={l}
            onClick={() => toggleLevel(l)}
            className="cursor-pointer rounded-full px-2.5 py-0.5 text-pin-xs font-semibold"
            style={{
              border: `1px solid ${LEVEL_BORDER[l]}`,
              background: activeLevels.includes(l) ? LEVEL_BORDER[l] : 'transparent',
              color: activeLevels.includes(l) ? '#fff' : LEVEL_BORDER[l],
            }}
          >
            {l}
          </button>
        ))}
        <span className="mx-1 h-5 border-l border-pin-border-default" />
        {TIME_RANGES.map(t => (
          <button
            key={t.hours}
            onClick={() => setActiveHours(t.hours)}
            className={cn(
              'cursor-pointer rounded-pin-sm border border-pin-border-default px-2 py-0.5 text-pin-xs',
              activeHours === t.hours ? 'bg-pin-bg-surface font-semibold' : 'bg-transparent font-normal',
            )}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={refetch}
          className="ml-auto flex cursor-pointer items-center gap-1 rounded-pin-sm border border-pin-border-default bg-transparent px-2 py-0.5 text-pin-xs"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="flex flex-wrap gap-3 text-pin-xs text-pin-text-secondary">
          <span><Activity size={12} className="mr-0.5 inline" /><strong>{summary.total}</strong> events</span>
          {Object.entries(summary.byLevel).map(([level, count]) => (
            <span key={level} style={{ color: LEVEL_BORDER[level] ?? 'inherit' }}>
              <strong>{count}</strong> {level}
            </span>
          ))}
          {summary.coordinatedClusters > 0 && (
            <span style={{ color: LEVEL_COLORS.ANOMALY }}>
              <Zap size={12} className="mr-0.5 inline" /><strong>{summary.coordinatedClusters}</strong> coordinated
            </span>
          )}
          {summary.cbrnDetections > 0 && (
            <span className="text-pin-critical">
              <Shield size={12} className="mr-0.5 inline" /><strong>{summary.cbrnDetections}</strong> CBRN
            </span>
          )}
          {lastFetched && (
            <span className="ml-auto">
              <Clock size={11} className="mr-0.5 inline" />Updated {formatTimeSince(lastFetched)}
            </span>
          )}
        </div>
      )}

      {/* Timeline */}
      {isLoading && entries.length === 0 ? (
        <div className="p-6 text-center text-pin-text-secondary">Loading sentinel feed...</div>
      ) : entries.length === 0 ? (
        <div className="p-6 text-center text-pin-text-secondary">
          <Eye size={20} className="mb-2 inline" /><br />
          No sentinel events match the current filters.
        </div>
      ) : (
        <div>
          {visibleEntries.map(entry => (
            <EntryCard
              key={entry.eventId}
              entry={entry}
              hucName={hucNames[entry.huc8] ?? entry.huc8}
            />
          ))}
          {!showAll && hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-1 w-full cursor-pointer rounded-pin-sm border border-pin-border-default bg-pin-bg-surface py-2 text-pin-xs font-semibold text-pin-text-secondary"
            >
              Show {hiddenCount} more event{hiddenCount !== 1 ? 's' : ''}
            </button>
          )}
          {showAll && sortedEntries.length > INITIAL_VISIBLE && (
            <button
              onClick={() => setShowAll(false)}
              className="mt-1 w-full cursor-pointer rounded-pin-sm border border-pin-border-default bg-pin-bg-surface py-2 text-pin-xs font-semibold text-pin-text-secondary"
            >
              Show fewer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
