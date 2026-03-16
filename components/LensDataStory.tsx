'use client';

import React, { useEffect, useState } from 'react';
import type { LensStory, StoryFinding } from '@/lib/lensStoryEngine';

// ── Props ────────────────────────────────────────────────────────────────────

interface LensDataStoryProps {
  lens: string;
  role: string;
  state?: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LensDataStory({ lens, role, state }: LensDataStoryProps) {
  const [data, setData] = useState<LensStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('lens', lens);
    params.set('role', role);
    if (state) params.set('state', state);

    fetch(`/api/lens-story?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        if (!cancelled) setData(json);
      })
      .catch(e => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [lens, role, state]);

  // ── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-700">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3 animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-2/3 animate-pulse" />
          <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg p-3">
        Failed to load data story: {error}
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  if (!data || data.findings.length === 0) {
    return (
      <div className="text-sm text-slate-500 bg-slate-50 dark:bg-slate-800 dark:text-slate-400 rounded-lg p-4 text-center">
        No actionable findings for this view.
        {state ? ` Data for ${state} may not yet be cached.` : ''}
      </div>
    );
  }

  // ── Partition findings ───────────────────────────────────────────────────

  const takeAction = data.findings.filter(f => f.category === 'take-action');
  const monitor = data.findings.filter(f => f.category === 'monitor');
  const criticalCount = data.findings.filter(f => f.severity === 'critical').length;
  const warningCount = data.findings.filter(f => f.severity === 'warning').length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-700">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 hover:from-indigo-100 hover:to-blue-100 dark:hover:from-indigo-950/50 dark:hover:to-blue-950/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
            {data.headline}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {criticalCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {warningCount} warning{warningCount > 1 ? 's' : ''}
            </span>
          )}
          <svg className={`h-4 w-4 text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="p-4 space-y-4">
          {/* Take Action section */}
          {takeAction.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
                Take Action ({takeAction.length})
              </h4>
              <div className="space-y-2">
                {takeAction.map(f => (
                  <FindingRow key={f.id} finding={f} accent="action" />
                ))}
              </div>
            </div>
          )}

          {/* Monitor section */}
          {monitor.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
                Monitor ({monitor.length})
              </h4>
              <div className="space-y-2">
                {monitor.map(f => (
                  <FindingRow key={f.id} finding={f} accent="monitor" />
                ))}
              </div>
            </div>
          )}

          {/* Footer — data sources */}
          {data.dataSources.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400 dark:text-slate-500">
                {data.dataSources.map(ds => (
                  <span key={ds.name}>
                    {ds.name} <span className="text-slate-300 dark:text-slate-600">({ds.agency} &middot; {ds.freshness})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Finding Row ──────────────────────────────────────────────────────────────

function FindingRow({ finding, accent }: { finding: StoryFinding; accent: 'action' | 'monitor' }) {
  const borderColor = accent === 'action'
    ? finding.severity === 'critical'
      ? 'border-red-400 dark:border-red-600'
      : 'border-orange-400 dark:border-orange-600'
    : finding.severity === 'critical'
      ? 'border-blue-500 dark:border-blue-500'
      : 'border-blue-300 dark:border-blue-600';

  const dotColor = finding.severity === 'critical'
    ? 'bg-red-500'
    : finding.severity === 'warning'
      ? 'bg-amber-500'
      : 'bg-blue-400';

  return (
    <div className={`border-l-[3px] ${borderColor} pl-3 py-1.5`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
            {finding.title}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            {finding.detail}
          </p>
          {finding.metric && (
            <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-xs">
              <span className="text-slate-400 dark:text-slate-500">{finding.metric.label}:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{finding.metric.value}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
