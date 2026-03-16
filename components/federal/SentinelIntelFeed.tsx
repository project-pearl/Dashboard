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

interface SentinelIntelFeedProps {
  hucNames: Record<string, string>;
}

/* ── Colour Constants ── */

const LEVEL_BORDER: Record<string, string> = {
  ANOMALY: '#7B1FA2',
  CRITICAL: '#D32F2F',
  WATCH: '#F9A825',
  ADVISORY: '#9E9E9E',
};

const LEVEL_BG: Record<string, string> = {
  ANOMALY: 'rgba(123,31,162,0.10)',
  CRITICAL: 'rgba(211,47,47,0.10)',
  WATCH: 'rgba(249,168,37,0.10)',
  ADVISORY: 'rgba(158,158,158,0.08)',
};

const CLASSIFICATION_BADGE: Record<string, { bg: string; text: string }> = {
  likely_attack: { bg: '#D32F2F', text: '#fff' },
  possible_attack: { bg: '#F57C00', text: '#fff' },
  likely_benign: { bg: '#388E3C', text: '#fff' },
  insufficient_data: { bg: '#616161', text: '#fff' },
};

const CBRN_COLOR: Record<string, string> = {
  chemical: '#FF6F00',
  biological: '#2E7D32',
  radiological: '#6A1B9A',
  nuclear: '#B71C1C',
};

const TIME_RANGES = [
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
] as const;

const LEVELS: ScoreLevel[] = ['ANOMALY', 'CRITICAL', 'WATCH', 'ADVISORY'];

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      {c.matched
        ? <Check size={13} style={{ color: '#388E3C' }} />
        : <X size={13} style={{ color: '#9E9E9E' }} />}
      <span style={{ color: c.matched ? '#388E3C' : 'var(--text-secondary)' }}>{c.rule}</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{c.detail}</span>
    </div>
  );
}

function ReasoningRow({ r }: { r: ClassificationReasoning }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ color: r.effect === 'boost' ? '#D32F2F' : '#388E3C', fontWeight: 600 }}>
        {r.effect === 'boost' ? '+' : '-'}{r.magnitude.toFixed(2)}
      </span>
      <span>{r.rule}</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{r.detail}</span>
    </div>
  );
}

function CbrnBadge({ ind }: { ind: CbrnIndicator }) {
  const color = CBRN_COLOR[ind.category] ?? '#616161';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
      <span style={{ fontWeight: 600, color, textTransform: 'uppercase' }}>{ind.category}</span>
      <div style={{ width: 40, height: 4, background: '#e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${ind.confidence * 100}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{(ind.confidence * 100).toFixed(0)}%</span>
    </div>
  );
}

function EntryCard({ entry, hucName }: { entry: SentinelFeedEntry; hucName: string }) {
  const [expanded, setExpanded] = useState(false);
  const border = LEVEL_BORDER[entry.hucLevel] ?? 'var(--border-default)';
  const bg = LEVEL_BG[entry.hucLevel] ?? 'transparent';
  const classBadge = CLASSIFICATION_BADGE[entry.classification] ?? CLASSIFICATION_BADGE.insufficient_data;

  return (
    <div style={{ border: `1px solid ${border}`, borderLeft: `3px solid ${border}`, borderRadius: 6, background: bg, marginBottom: 6, overflow: 'hidden' }}>
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span style={{ color: 'var(--text-secondary)', minWidth: 50, fontSize: 11 }}>{formatTimeSince(entry.detectedAt)}</span>
        <span style={{ fontWeight: 600, flex: 1 }}>{hucName}</span>
        <span style={{ background: 'var(--bg-secondary)', borderRadius: 3, padding: '1px 6px', fontSize: 11 }}>{SOURCE_LABELS[entry.source] ?? entry.source}</span>
        <span style={{ background: classBadge.bg, color: classBadge.text, borderRadius: 3, padding: '1px 6px', fontSize: 11 }}>{entry.classification.replace(/_/g, ' ')}</span>
        <span style={{ fontWeight: 600, fontSize: 12, minWidth: 40, textAlign: 'right' }}>{entry.hucScore.toFixed(0)}</span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '0 12px 12px 30px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
          {/* Event info */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Event Details</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
              <span>Source: <strong>{entry.source}</strong></span>
              <span>Type: <strong>{entry.changeType}</strong></span>
              <span>Severity: <strong>{entry.severityHint}</strong></span>
              <span>Time: <strong>{formatTime(entry.detectedAt)}</strong></span>
            </div>
          </div>

          {/* Score contribution */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Score Contribution</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span>Base: <strong>{entry.baseScore.toFixed(1)}</strong></span>
              <span>Decayed: <strong>{entry.decayedScore.toFixed(1)}</strong></span>
              <span>HUC Total: <strong>{entry.hucScore.toFixed(0)}</strong> ({entry.hucLevel})</span>
            </div>
            {entry.activePatterns.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 12 }}>
                Patterns: {entry.activePatterns.map(p => (
                  <span key={p} style={{ background: 'var(--bg-secondary)', borderRadius: 3, padding: '1px 5px', marginRight: 4, fontSize: 11 }}>{p}</span>
                ))}
              </div>
            )}
          </div>

          {/* Reasoning chain */}
          {entry.reasoning.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Classification Reasoning</div>
              {entry.reasoning.map((r, i) => <ReasoningRow key={i} r={r} />)}
            </div>
          )}

          {/* Confounders */}
          {entry.confounders.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Confounder Checks</div>
              {entry.confounders.map((c, i) => <ConfounderRow key={i} c={c} />)}
            </div>
          )}

          {/* CBRN indicators */}
          {entry.cbrnIndicators.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>CBRN Indicators</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {entry.cbrnIndicators.map((ind, i) => <CbrnBadge key={i} ind={ind} />)}
              </div>
            </div>
          )}

          {/* Coordination */}
          {entry.coordination && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Coordination Cluster</div>
              <div style={{ fontSize: 12, display: 'flex', gap: 16 }}>
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
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Plume Analysis</div>
              <div style={{ fontSize: 12 }}>
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

  const filters: SentinelFeedFilters = useMemo(() => ({
    levels: activeLevels.length > 0 ? activeLevels : undefined,
    hours: activeHours,
  }), [activeLevels, activeHours]);

  const { entries, summary, isLoading, error, lastFetched, refetch } = useSentinelFeed(filters);

  const toggleLevel = (l: ScoreLevel) => {
    setActiveLevels(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  };

  if (error && entries.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-secondary)' }}>
        <AlertTriangle size={16} style={{ marginRight: 6 }} />
        Sentinel feed unavailable: {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
        {LEVELS.map(l => (
          <button
            key={l}
            onClick={() => toggleLevel(l)}
            style={{
              padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${LEVEL_BORDER[l]}`,
              background: activeLevels.includes(l) ? LEVEL_BORDER[l] : 'transparent',
              color: activeLevels.includes(l) ? '#fff' : LEVEL_BORDER[l],
            }}
          >
            {l}
          </button>
        ))}
        <span style={{ borderLeft: '1px solid var(--border-default)', height: 20, margin: '0 4px' }} />
        {TIME_RANGES.map(t => (
          <button
            key={t.hours}
            onClick={() => setActiveHours(t.hours)}
            style={{
              padding: '3px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
              border: '1px solid var(--border-default)',
              background: activeHours === t.hours ? 'var(--bg-secondary)' : 'transparent',
              fontWeight: activeHours === t.hours ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
        <button onClick={refetch} style={{ marginLeft: 'auto', padding: '3px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer', border: '1px solid var(--border-default)', background: 'transparent', display: 'flex', alignItems: 'center', gap: 4 }}>
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Summary strip */}
      {summary && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span><Activity size={12} style={{ marginRight: 3 }} /><strong>{summary.total}</strong> events</span>
          {Object.entries(summary.byLevel).map(([level, count]) => (
            <span key={level} style={{ color: LEVEL_BORDER[level] ?? 'inherit' }}>
              <strong>{count}</strong> {level}
            </span>
          ))}
          {summary.coordinatedClusters > 0 && (
            <span style={{ color: '#7B1FA2' }}><Zap size={12} style={{ marginRight: 2 }} /><strong>{summary.coordinatedClusters}</strong> coordinated</span>
          )}
          {summary.cbrnDetections > 0 && (
            <span style={{ color: '#D32F2F' }}><Shield size={12} style={{ marginRight: 2 }} /><strong>{summary.cbrnDetections}</strong> CBRN</span>
          )}
          {lastFetched && (
            <span style={{ marginLeft: 'auto' }}>
              <Clock size={11} style={{ marginRight: 3 }} />Updated {formatTimeSince(lastFetched)}
            </span>
          )}
        </div>
      )}

      {/* Timeline */}
      {isLoading && entries.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading sentinel feed...</div>
      ) : entries.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Eye size={20} style={{ marginBottom: 8 }} /><br />
          No sentinel events match the current filters.
        </div>
      ) : (
        <div>
          {entries.map(entry => (
            <EntryCard
              key={entry.eventId}
              entry={entry}
              hucName={hucNames[entry.huc8] ?? entry.huc8}
            />
          ))}
        </div>
      )}
    </div>
  );
}
