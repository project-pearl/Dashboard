/* ------------------------------------------------------------------ */
/*  EscalationSummary — Ranked HUC table with sparklines + velocity    */
/* ------------------------------------------------------------------ */

'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Clock,
  Zap,
  Activity,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LEVEL_COLORS,
  STATUS_CRITICAL,
  STATUS_SUCCESS,
  STATUS_WARNING,
  STATUS_NOMINAL,
} from '@/lib/design-tokens';
import { useEscalationIndicators } from '@/hooks/useEscalationIndicators';
import type { EscalationIndicators, ScoreLevel } from '@/lib/sentinel/types';

interface EscalationSummaryProps {
  hucNames: Record<string, string>;
}

/* ── Constants ── */

const LEVEL_COLOR: Record<ScoreLevel, string> = {
  ANOMALY: LEVEL_COLORS.ANOMALY,
  CRITICAL: LEVEL_COLORS.CRITICAL,
  WATCH: LEVEL_COLORS.WATCH,
  ADVISORY: LEVEL_COLORS.ADVISORY,
  NOMINAL: LEVEL_COLORS.NOMINAL,
};

const CLASS_STYLE: Record<EscalationIndicators['escalationClass'], { color: string; label: string }> = {
  rapid: { color: STATUS_CRITICAL, label: 'RAPID' },
  steady: { color: STATUS_WARNING, label: 'STEADY' },
  plateaued: { color: STATUS_NOMINAL, label: 'PLATEAU' },
  deescalating: { color: STATUS_SUCCESS, label: 'DE-ESC' },
};

/* ── Inline Sparkline ── */

function Sparkline({ points, color }: { points: { hoursAgo: number; score: number }[]; color: string }) {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => b.hoursAgo - a.hoursAgo); // oldest first
  const maxScore = Math.max(...sorted.map(p => p.score), 1);
  const w = 80;
  const h = 24;
  const pad = 2;
  const xStep = (w - 2 * pad) / (sorted.length - 1);
  const yScale = (h - 2 * pad) / maxScore;

  const d = sorted
    .map((p, i) => {
      const x = pad + i * xStep;
      const y = h - pad - p.score * yScale;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} className="block">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      {/* Dot on current value */}
      {sorted.length > 0 && (() => {
        const last = sorted[sorted.length - 1];
        const x = pad + (sorted.length - 1) * xStep;
        const y = h - pad - last.score * yScale;
        return <circle cx={x} cy={y} r={2.5} fill={color} />;
      })()}
    </svg>
  );
}

/* ── Velocity Arrow ── */

function VelocityArrow({ velocity }: { velocity: number }) {
  if (velocity > 2) return <TrendingUp size={14} className="text-pin-critical" />;
  if (velocity < -2) return <TrendingDown size={14} className="text-pin-success" />;
  return <Minus size={14} className="text-pin-nominal" />;
}

/* ── Table Row ── */

function EscalationRow({
  ind,
  hucName,
  rank,
}: {
  ind: EscalationIndicators;
  hucName: string;
  rank: number;
}) {
  const cls = CLASS_STYLE[ind.escalationClass];
  const highlight = rank < 5 && (ind.escalationClass === 'rapid' || ind.escalationClass === 'steady');
  const borderColor = highlight
    ? (ind.escalationClass === 'rapid' ? STATUS_CRITICAL : STATUS_WARNING)
    : 'transparent';

  return (
    <tr style={{ borderLeft: `3px solid ${borderColor}` }}>
      <td className="px-2 py-1.5 font-semibold">
        {hucName}
        <span className="text-pin-text-secondary text-pin-xs ml-1.5">{ind.stateAbbr}</span>
      </td>
      <td className="px-2 py-1.5 text-center">
        <span
          className="px-2 py-px rounded-pin-sm text-pin-xs font-semibold"
          style={{
            background: `${LEVEL_COLOR[ind.level]}20`,
            color: LEVEL_COLOR[ind.level],
          }}
        >
          {ind.level}
        </span>
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums">
        {ind.score.toFixed(0)}
      </td>
      <td className="px-2 py-1.5 text-center">
        <div className="flex items-center justify-center gap-1">
          <VelocityArrow velocity={ind.velocity} />
          <span
            className={cn(
              'tabular-nums text-pin-xs',
              ind.velocity > 2
                ? 'text-pin-critical'
                : ind.velocity < -2
                  ? 'text-pin-success'
                  : 'text-pin-text-secondary'
            )}
          >
            {ind.velocity > 0 ? '+' : ''}{ind.velocity.toFixed(1)}/hr
          </span>
        </div>
      </td>
      <td className="px-1 py-1.5">
        <Sparkline points={ind.trajectory} color={LEVEL_COLOR[ind.level]} />
      </td>
      <td className="px-2 py-1.5 text-center text-pin-xs tabular-nums">
        {ind.estimatedHoursToNext != null ? (
          <span
            className={cn(
              ind.estimatedHoursToNext < 3 ? 'text-pin-critical' : 'text-pin-text-secondary'
            )}
          >
            ~{ind.estimatedHoursToNext.toFixed(1)}h
          </span>
        ) : (
          <span className="text-pin-text-secondary">&mdash;</span>
        )}
      </td>
      <td className="px-2 py-1.5">
        <div className="flex flex-wrap gap-0.5">
          {ind.patternEmergence.newPatterns.map(p => (
            <span
              key={p}
              className="bg-pin-info-bg text-pin-info text-2xs px-1 rounded-pin-sm"
            >
              {p}
            </span>
          ))}
          {ind.patternEmergence.newPatterns.length === 0 && ind.patternEmergence.totalActive > 0 && (
            <span className="text-pin-xs text-pin-text-secondary">
              {ind.patternEmergence.totalActive} active
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 text-center">
        <span
          className={cn(
            'px-1.5 py-px rounded-pin-sm text-2xs font-semibold',
            ind.escalationClass === 'rapid' && 'sentinel-pulse'
          )}
          style={{
            background: `${cls.color}18`,
            color: cls.color,
          }}
        >
          {cls.label}
        </span>
      </td>
    </tr>
  );
}

/* ── Main Component ── */

const VISIBLE_ROWS = 5;

export default function EscalationSummary({ hucNames }: EscalationSummaryProps) {
  const { indicators, isLoading, error } = useEscalationIndicators();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return indicators;
    const q = search.toLowerCase();
    return indicators.filter(ind => {
      const name = (hucNames[ind.huc8] ?? ind.huc8).toLowerCase();
      return name.includes(q) || ind.stateAbbr.toLowerCase().includes(q) || ind.huc8.includes(q)
        || ind.level.toLowerCase().includes(q) || ind.escalationClass.includes(q);
    });
  }, [indicators, search, hucNames]);

  if (error && indicators.length === 0) {
    return (
      <div className="p-4 text-pin-text-secondary">
        <AlertTriangle size={16} className="inline mr-1.5" />
        Escalation data unavailable: {error}
      </div>
    );
  }

  if (isLoading && indicators.length === 0) {
    return (
      <div className="p-6 text-center text-pin-text-secondary">
        Loading escalation indicators...
      </div>
    );
  }

  if (indicators.length === 0) {
    return (
      <div className="p-6 text-center text-pin-text-secondary">
        <Activity size={20} className="inline mb-2" /><br />
        No active escalation indicators. All HUCs at NOMINAL.
      </div>
    );
  }

  const rapidCount = indicators.filter(i => i.escalationClass === 'rapid').length;
  const urgentCount = indicators.filter(i => i.estimatedHoursToNext != null && i.estimatedHoursToNext < 3).length;
  const hasMore = filtered.length > VISIBLE_ROWS;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Summary strip + search */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-3 text-pin-xs text-pin-text-secondary">
          <span><Activity size={12} className="inline mr-0.5" /><strong>{indicators.length}</strong> active HUCs</span>
          {rapidCount > 0 && (
            <span className="text-pin-critical">
              <Zap size={12} className="inline mr-0.5" /><strong>{rapidCount}</strong> rapid
            </span>
          )}
          {urgentCount > 0 && (
            <span className="text-pin-critical">
              <Clock size={12} className="inline mr-0.5" /><strong>{urgentCount}</strong> {'<'}3h to next level
            </span>
          )}
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search HUCs..."
            className="pl-6 pr-2 py-1 text-xs rounded border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-200 w-44 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* Table with top-5 visible + scroll for rest */}
      <div className={cn('overflow-x-auto', hasMore && 'max-h-[280px] overflow-y-auto')}>
        <table className="w-full border-collapse text-pin-sm">
          <thead className="sticky top-0 z-10 bg-white dark:bg-gray-900">
            <tr className="pin-table-header">
              <th className="px-2 py-1.5 text-left">HUC</th>
              <th className="px-2 py-1.5 text-center">Level</th>
              <th className="px-2 py-1.5 text-right">Score</th>
              <th className="px-2 py-1.5 text-center">Velocity</th>
              <th className="px-1 py-1.5 text-left">Trend</th>
              <th className="px-2 py-1.5 text-center">Next Level</th>
              <th className="px-2 py-1.5 text-left">Patterns</th>
              <th className="px-2 py-1.5 text-center">Class</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ind, i) => (
              <EscalationRow
                key={ind.huc8}
                ind={ind}
                hucName={hucNames[ind.huc8] ?? ind.huc8}
                rank={i}
              />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-4 text-pin-xs text-pin-text-secondary">No HUCs match &ldquo;{search}&rdquo;</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {hasMore && !search && (
        <div className="text-2xs text-center text-slate-400">
          Scroll to see all {filtered.length} HUCs
        </div>
      )}
    </div>
  );
}
