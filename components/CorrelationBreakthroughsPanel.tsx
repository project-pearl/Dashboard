'use client';

import React, { useEffect, useState } from 'react';

// ── Types (mirror server response) ──────────────────────────────────────────

interface CorrelationFinding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'moderate' | 'informational';
  agencies: string[];
  datasets: string[];
  state: string;
  county?: string;
  location?: { lat: number; lng: number };
  metrics: Record<string, number | string>;
  narrative: string;
  novelty: string;
}

interface BreakthroughSummary {
  id: string;
  name: string;
  tagline: string;
  agencies: string[];
  findingCount: number;
  criticalCount: number;
  topFindings: CorrelationFinding[];
}

interface CorrelationResponse {
  status: string;
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  breakthroughs: BreakthroughSummary[];
  findings: CorrelationFinding[];
  errors?: string[];
}

// ── Severity styling ────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Critical' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', label: 'High' },
  moderate: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400', label: 'Moderate' },
  informational: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400', label: 'Info' },
};

// ── Component ───────────────────────────────────────────────────────────────

export default function CorrelationBreakthroughsPanel({
  state,
}: {
  state?: string;
}) {
  const [data, setData] = useState<CorrelationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBreakthrough, setExpandedBreakthrough] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (state) params.set('state', state);

    fetch(`/api/correlations?${params}`)
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
  }, [state]);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-2/3" />
        <div className="h-20 bg-slate-100 rounded" />
        <div className="h-20 bg-slate-100 rounded" />
        <div className="h-20 bg-slate-100 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
        Failed to load correlation analysis: {error}
      </div>
    );
  }

  if (!data || data.totalFindings === 0) {
    return (
      <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-4 text-center">
        No cross-agency correlations detected{state ? ` for ${state}` : ''}.
        Correlations require data from multiple caches to be populated.
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const activeSummaries = data.breakthroughs.filter(b => b.findingCount > 0);

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-slate-800">{data.totalFindings}</div>
          <div className="text-xs text-slate-500 mt-0.5">Correlations Found</div>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{data.criticalFindings}</div>
          <div className="text-xs text-slate-500 mt-0.5">Critical Severity</div>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">{data.highFindings}</div>
          <div className="text-xs text-slate-500 mt-0.5">High Severity</div>
        </div>
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-600">{activeSummaries.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Active Breakthroughs</div>
        </div>
      </div>

      {/* Breakthrough cards */}
      {activeSummaries.map(bt => {
        const isExpanded = expandedBreakthrough === bt.id;

        return (
          <div key={bt.id} className="border rounded-lg overflow-hidden bg-white">
            {/* Header */}
            <button
              className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
              onClick={() => setExpandedBreakthrough(isExpanded ? null : bt.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-slate-800">{bt.name}</span>
                  {bt.criticalCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                      {bt.criticalCount} critical
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 italic">{bt.tagline}</p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {bt.agencies.map(a => (
                    <span key={a} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {a}
                    </span>
                  ))}
                  <span className="text-[10px] text-slate-400 ml-1">{bt.findingCount} finding{bt.findingCount !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <svg className={`w-4 h-4 text-slate-400 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded findings */}
            {isExpanded && bt.topFindings.length > 0 && (
              <div className="border-t divide-y">
                {bt.topFindings.map(f => {
                  const sev = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.informational;
                  return (
                    <div key={f.id} className={`p-3 ${sev.bg}`}>
                      <div className="flex items-start gap-2">
                        <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sev.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-slate-800">{f.title}</span>
                            <span className={`text-[10px] font-medium ${sev.text}`}>{sev.label}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{f.narrative}</p>
                          {/* Key metrics */}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {Object.entries(f.metrics).slice(0, 4).map(([k, v]) => (
                              <span key={k} className="text-[10px] text-slate-500">
                                <span className="font-medium text-slate-700">{typeof v === 'number' ? v.toLocaleString() : v}</span>{' '}
                                {k.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}
                              </span>
                            ))}
                          </div>
                          {/* Novelty callout */}
                          <details className="mt-2">
                            <summary className="text-[10px] text-blue-600 cursor-pointer hover:text-blue-800">Why this matters</summary>
                            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed pl-2 border-l-2 border-blue-200">{f.novelty}</p>
                          </details>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
