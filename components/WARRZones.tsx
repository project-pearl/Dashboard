'use client';

import React from 'react';
import { Gauge, AlertTriangle, Shield, CheckCircle, Eye } from 'lucide-react';
import { AIInsightsEngine } from '@/components/AIInsightsEngine';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WARRMetric {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconColor: string;
  subtitle?: string;
}

export interface WARREvent {
  id: string;
  name: string;
  location?: string;
  level: 'CRITICAL' | 'WATCH' | 'ADVISORY';
  score: number;
  signalCount: number;
  patterns: string[];
}

export interface WARRZonesProps {
  zone: 'warr-metrics' | 'warr-analyze' | 'warr-respond' | 'warr-resolve';
  role: string;
  stateAbbr: string;
  metrics: WARRMetric[];
  aiData?: Record<string, unknown>;
  events: WARREvent[];
  activeResolutionCount: number;
  onOpenPlanner?: () => void;
  onViewAllEvents?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WARRZones({
  zone,
  role,
  stateAbbr,
  metrics,
  aiData,
  events,
  activeResolutionCount,
  onOpenPlanner,
  onViewAllEvents,
}: WARRZonesProps) {
  switch (zone) {
    case 'warr-metrics':
      return (
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2 flex items-center gap-2" style={{ color: 'var(--text-dim)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-teal)' }} />
            WATCH
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {metrics.map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={i} className="rounded-lg p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" style={{ color: m.iconColor }} />
                    <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-dim)' }}>{m.label}</span>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--text-bright)' }}>
                    {m.value}
                  </div>
                  {m.subtitle && (
                    <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{m.subtitle}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );

    case 'warr-analyze':
      return (
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2 flex items-center gap-2" style={{ color: 'var(--text-dim)' }}>
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            ANALYZE
          </div>
          <AIInsightsEngine
            role={role as any}
            stateAbbr={stateAbbr}
            {...(aiData ? { nationalData: aiData as any } : { regionData: aiData as any })}
          />
        </div>
      );

    case 'warr-respond':
      return (
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2 flex items-center gap-2" style={{ color: 'var(--text-dim)' }}>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            RESPOND
          </div>
          {events.length > 0 ? (
            <div className="space-y-2">
              {events.slice(0, 3).map(ev => {
                const severity = ev.score >= 400 ? 'Critical' : ev.score >= 300 ? 'Severe' : ev.score >= 200 ? 'Elevated' : 'Watch';
                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{
                      background: 'var(--bg-card)',
                      border: `1px solid ${ev.level === 'CRITICAL' ? '#D32F2F40' : 'var(--border-subtle)'}`,
                      borderLeft: `3px solid ${ev.level === 'CRITICAL' ? '#D32F2F' : '#F9A825'}`,
                    }}
                  >
                    {ev.level === 'CRITICAL' ? (
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    ) : (
                      <Eye className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: 'var(--text-bright)' }}>
                        {ev.name}{ev.location ? `, ${ev.location}` : ''}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                        {ev.signalCount} signal{ev.signalCount !== 1 ? 's' : ''} · {ev.patterns.map(p => p.replace(/-/g, ' ')).join(' + ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="sentinel-score-badge text-[10px]"
                        data-level={ev.level}
                        style={{ width: '24px', height: '24px', fontSize: '10px' }}
                      >
                        {Math.round(ev.score)}
                      </span>
                      <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>/500</span>
                      <span className="text-[9px] font-medium" style={{ color: ev.score >= 400 ? '#D32F2F' : ev.score >= 300 ? '#E65100' : '#F9A825' }}>{severity}</span>
                    </div>
                  </div>
                );
              })}
              {onViewAllEvents && (
                <button
                  onClick={onViewAllEvents}
                  className="w-full text-center py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{ color: 'var(--text-secondary)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  View all events in AI Briefing →
                </button>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-lg text-center text-xs" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <CheckCircle className="w-4 h-4 mx-auto mb-1" style={{ color: 'var(--status-healthy)' }} />
              No active events. All monitored areas within normal parameters.
            </div>
          )}
        </div>
      );

    case 'warr-resolve':
      return (
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2 flex items-center gap-2" style={{ color: 'var(--text-dim)' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            RESOLVE
          </div>
          <div className="rounded-lg p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Active Response Plans</div>
              {onOpenPlanner && (
                <button
                  onClick={onOpenPlanner}
                  className="text-[10px] font-medium px-2 py-1 rounded transition-colors"
                  style={{ color: 'var(--accent-teal)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  Open Resolution Planner →
                </button>
              )}
            </div>
            <div className="space-y-2">
              {activeResolutionCount > 0 ? (
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {activeResolutionCount} area{activeResolutionCount !== 1 ? 's' : ''} pending response plan generation.
                  Use the Resolution Planner to create targeted action plans.
                </div>
              ) : (
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  No areas currently require response plans. Monitoring is active.
                </div>
              )}
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}
