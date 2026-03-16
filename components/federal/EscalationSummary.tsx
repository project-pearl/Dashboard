/* ------------------------------------------------------------------ */
/*  EscalationSummary — Ranked HUC table with sparklines + velocity    */
/* ------------------------------------------------------------------ */

'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Clock,
  Zap,
  Activity,
} from 'lucide-react';
import { useEscalationIndicators } from '@/hooks/useEscalationIndicators';
import type { EscalationIndicators, ScoreLevel } from '@/lib/sentinel/types';

interface EscalationSummaryProps {
  hucNames: Record<string, string>;
}

/* ── Constants ── */

const LEVEL_COLOR: Record<ScoreLevel, string> = {
  ANOMALY: '#7B1FA2',
  CRITICAL: '#D32F2F',
  WATCH: '#F9A825',
  ADVISORY: '#9E9E9E',
  NOMINAL: '#4CAF50',
};

const CLASS_STYLE: Record<EscalationIndicators['escalationClass'], { color: string; label: string }> = {
  rapid: { color: '#D32F2F', label: 'RAPID' },
  steady: { color: '#F9A825', label: 'STEADY' },
  plateaued: { color: '#9E9E9E', label: 'PLATEAU' },
  deescalating: { color: '#388E3C', label: 'DE-ESC' },
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
    <svg width={w} height={h} style={{ display: 'block' }}>
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
  if (velocity > 2) return <TrendingUp size={14} style={{ color: '#D32F2F' }} />;
  if (velocity < -2) return <TrendingDown size={14} style={{ color: '#388E3C' }} />;
  return <Minus size={14} style={{ color: '#9E9E9E' }} />;
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
  const borderColor = highlight ? (ind.escalationClass === 'rapid' ? '#D32F2F' : '#F9A825') : 'transparent';

  return (
    <tr style={{ borderLeft: `3px solid ${borderColor}` }}>
      <td style={{ padding: '6px 8px', fontWeight: 600 }}>
        {hucName}
        <span style={{ color: 'var(--text-secondary)', fontSize: 11, marginLeft: 6 }}>{ind.stateAbbr}</span>
      </td>
      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
        <span style={{
          background: `${LEVEL_COLOR[ind.level]}20`,
          color: LEVEL_COLOR[ind.level],
          padding: '1px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
        }}>
          {ind.level}
        </span>
      </td>
      <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {ind.score.toFixed(0)}
      </td>
      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <VelocityArrow velocity={ind.velocity} />
          <span style={{
            fontVariantNumeric: 'tabular-nums',
            fontSize: 12,
            color: ind.velocity > 2 ? '#D32F2F' : ind.velocity < -2 ? '#388E3C' : 'var(--text-secondary)',
          }}>
            {ind.velocity > 0 ? '+' : ''}{ind.velocity.toFixed(1)}/hr
          </span>
        </div>
      </td>
      <td style={{ padding: '6px 4px' }}>
        <Sparkline points={ind.trajectory} color={LEVEL_COLOR[ind.level]} />
      </td>
      <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
        {ind.estimatedHoursToNext != null ? (
          <span style={{ color: ind.estimatedHoursToNext < 3 ? '#D32F2F' : 'var(--text-secondary)' }}>
            ~{ind.estimatedHoursToNext.toFixed(1)}h
          </span>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>—</span>
        )}
      </td>
      <td style={{ padding: '6px 8px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {ind.patternEmergence.newPatterns.map(p => (
            <span key={p} style={{ background: '#E3F2FD', color: '#1565C0', fontSize: 10, padding: '0 4px', borderRadius: 3 }}>
              {p}
            </span>
          ))}
          {ind.patternEmergence.newPatterns.length === 0 && ind.patternEmergence.totalActive > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{ind.patternEmergence.totalActive} active</span>
          )}
        </div>
      </td>
      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
        <span style={{
          background: `${cls.color}18`,
          color: cls.color,
          padding: '1px 6px',
          borderRadius: 3,
          fontSize: 10,
          fontWeight: 600,
          ...(ind.escalationClass === 'rapid' ? { animation: 'pulse 1.5s infinite' } : {}),
        }}>
          {cls.label}
        </span>
      </td>
    </tr>
  );
}

/* ── Main Component ── */

export default function EscalationSummary({ hucNames }: EscalationSummaryProps) {
  const { indicators, isLoading, error } = useEscalationIndicators();

  if (error && indicators.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-secondary)' }}>
        <AlertTriangle size={16} style={{ marginRight: 6 }} />
        Escalation data unavailable: {error}
      </div>
    );
  }

  if (isLoading && indicators.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading escalation indicators...</div>;
  }

  if (indicators.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Activity size={20} style={{ marginBottom: 8 }} /><br />
        No active escalation indicators. All HUCs at NOMINAL.
      </div>
    );
  }

  const rapidCount = indicators.filter(i => i.escalationClass === 'rapid').length;
  const urgentCount = indicators.filter(i => i.estimatedHoursToNext != null && i.estimatedHoursToNext < 3).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Summary strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
        <span><Activity size={12} style={{ marginRight: 3 }} /><strong>{indicators.length}</strong> active HUCs</span>
        {rapidCount > 0 && (
          <span style={{ color: '#D32F2F' }}><Zap size={12} style={{ marginRight: 2 }} /><strong>{rapidCount}</strong> rapid</span>
        )}
        {urgentCount > 0 && (
          <span style={{ color: '#D32F2F' }}><Clock size={12} style={{ marginRight: 2 }} /><strong>{urgentCount}</strong> {'<'}3h to next level</span>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>HUC</th>
              <th style={{ padding: '6px 8px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Level</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Score</th>
              <th style={{ padding: '6px 8px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Velocity</th>
              <th style={{ padding: '6px 4px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Trend</th>
              <th style={{ padding: '6px 8px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Next Level</th>
              <th style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Patterns</th>
              <th style={{ padding: '6px 8px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Class</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((ind, i) => (
              <EscalationRow
                key={ind.huc8}
                ind={ind}
                hucName={hucNames[ind.huc8] ?? ind.huc8}
                rank={i}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pulse animation style */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
