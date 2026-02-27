/* ------------------------------------------------------------------ */
/*  SentinelAlertPanel — Click-to-expand HUC alert detail overlay     */
/* ------------------------------------------------------------------ */

'use client';

import React from 'react';
import { X, AlertTriangle, Eye, Info, ExternalLink } from 'lucide-react';
import type { ScoredHucClient, ScoreLevel } from '@/lib/sentinel/types';

interface SentinelAlertPanelProps {
  huc8: string;
  level: ScoreLevel;
  hucName: string;
  scoredHuc: ScoredHucClient | undefined;
  onClose: () => void;
}

const LEVEL_COLORS: Record<string, string> = {
  CRITICAL: '#D32F2F',
  WATCH: '#F9A825',
  ADVISORY: '#FDD835',
};

const LEVEL_ICONS: Record<string, React.ReactNode> = {
  CRITICAL: <AlertTriangle className="w-5 h-5 text-red-500" />,
  WATCH: <Eye className="w-5 h-5 text-amber-500" />,
  ADVISORY: <Info className="w-5 h-5 text-yellow-500" />,
};

export function SentinelAlertPanel({
  huc8,
  level,
  hucName,
  scoredHuc,
  onClose,
}: SentinelAlertPanelProps) {
  const borderColor = LEVEL_COLORS[level] ?? '#999';

  return (
    <div
      className="absolute top-3 right-3 z-50 w-80 max-h-[60%] overflow-y-auto rounded-lg shadow-lg"
      style={{
        background: 'var(--bg-surface)',
        borderLeft: `4px solid ${borderColor}`,
        border: `1px solid var(--border-default)`,
        borderLeftWidth: '4px',
        borderLeftColor: borderColor,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-3 pb-2">
        <div className="flex items-center gap-2">
          {LEVEL_ICONS[level]}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: borderColor }}>
              {level}
            </div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-bright)' }}>
              {hucName || huc8}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Close alert panel"
        >
          <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      {/* Content */}
      <div className="px-3 pb-3 space-y-3">
        {scoredHuc ? (
          <>
            {/* Composite score */}
            <div className="flex items-center gap-3">
              <div
                className="sentinel-score-badge text-lg w-10 h-10"
                data-level={level}
                style={{ fontSize: '16px', width: '40px', height: '40px' }}
              >
                {Math.round(scoredHuc.score)}
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Composite Score
                </div>
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  {scoredHuc.eventCount} signal{scoredHuc.eventCount !== 1 ? 's' : ''} detected
                </div>
              </div>
            </div>

            {/* Pattern names */}
            {scoredHuc.patternNames.length > 0 && (
              <div>
                <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Active Patterns
                </div>
                <div className="flex flex-wrap gap-1">
                  {scoredHuc.patternNames.map(p => (
                    <span
                      key={p}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: level === 'CRITICAL' ? 'rgba(211,47,47,0.1)' : 'rgba(249,168,37,0.1)',
                        color: borderColor,
                      }}
                    >
                      {p.replace(/-/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tier-specific content */}
            {level === 'CRITICAL' && (
              <div className="pt-1">
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Last scored: {new Date(scoredHuc.lastScored).toLocaleString()}
                </div>
              </div>
            )}

            {level === 'WATCH' && (
              <div className="text-xs p-2 rounded" style={{ background: 'rgba(249,168,37,0.06)' }}>
                <span className="font-medium">Escalation condition: </span>
                Would escalate if additional signals detected in this HUC
              </div>
            )}

            {level === 'ADVISORY' && (
              <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                Single signal detected — monitoring for compound patterns
              </div>
            )}
          </>
        ) : (
          <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
            No detailed data available for this watershed.
          </div>
        )}
      </div>
    </div>
  );
}
