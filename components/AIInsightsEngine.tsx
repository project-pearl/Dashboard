'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw, ChevronDown, Minus, AlertTriangle,
  TrendingUp, Search, Lightbulb, FileText, Info, ShieldAlert, Clock
} from 'lucide-react';
import { PearlIcon } from './PearlIcon';

// ─── Types ──────────────────────────────────────────────────────────────────

type Role = 'MS4' | 'State' | 'Federal' | 'Corporate' | 'K12' | 'College' | 'Researcher' | 'NGO' | 'Temp';
type InsightType = 'predictive' | 'anomaly' | 'comparison' | 'recommendation' | 'summary';
type Severity = 'info' | 'warning' | 'critical';

interface Insight {
  type: InsightType;
  severity: Severity;
  title: string;
  body: string;
  waterbody?: string;
  timeframe?: string;
}

interface SelectedWaterbody {
  name: string;
  parameters: any;
  causes: string[];
  category: string;
}

interface NationalData {
  catCounts: Record<string, number>;
  totalAssessed: number;
  totalImpaired: number;
  cat5: number;
  cat4a: number;
  cat4b: number;
  cat4c: number;
  tmdlGapPct: number;
  topCauses: Array<{ cause: string; count: number }>;
  addressableCount: number;
  totalCauseInstances: number;
  addressablePct: number;
  worstStates?: Array<{ abbr: string; name: string; cat5: number; totalImpaired: number; topCauses: Array<{ cause: string; count: number }> }>;
}

interface Props {
  role: Role;
  stateAbbr: string;
  selectedWaterbody?: SelectedWaterbody;
  regionData?: Array<{ name: string; alertLevel: string; causes: string[] }>;
  nationalData?: NationalData;
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const insightCache = new Map<string, { insights: Insight[]; timestamp: number }>();

function getCacheKey(role: Role, stateAbbr: string, wb?: SelectedWaterbody, hasNational?: boolean): string {
  return `${role}:${hasNational ? 'NATIONAL' : stateAbbr}:${wb?.name || 'none'}`;
}

// ─── Role tone descriptors ──────────────────────────────────────────────────

const ROLE_TONE: Record<Role, string> = {
  MS4: 'Focus on compliance risk, permit deadlines, cost optimization, and MS4 regulatory obligations.',
  State: 'Focus on statewide trends, impairment reclassification risk, resource allocation, and TMDL progress.',
  Federal: 'Focus on cross-state patterns, national trends, policy impact, and Clean Water Act implications.',
  Corporate: 'Focus on portfolio risk, sustainability disclosure readiness, supply chain water risk, and investor-relevant metrics.',
  K12: 'Focus on fun discoveries, wildlife impacts, "did you know" style facts, and engaging educational content for students.',
  College: 'Focus on research-worthy anomalies, data quality assessment, publication-ready findings, and methodology rigor.',
  Researcher: 'Focus on statistical anomalies, research-worthy patterns, data quality, and peer-comparable findings.',
  NGO: 'Focus on community impact, advocacy opportunities, environmental justice, and public health connections.',
  Temp: 'Focus on healthcare revenue cycle insights, denial trends, and billing optimization.',
};

// ─── Insight type config ────────────────────────────────────────────────────

const INSIGHT_CONFIG: Record<InsightType, { icon: any; label: string; color: string }> = {
  predictive: { icon: TrendingUp, label: 'Predictive', color: 'text-blue-600' },
  anomaly: { icon: Search, label: 'Anomaly', color: 'text-amber-600' },
  comparison: { icon: FileText, label: 'Comparison', color: 'text-violet-600' },
  recommendation: { icon: Lightbulb, label: 'Recommendation', color: 'text-emerald-600' },
  summary: { icon: Info, label: 'Summary', color: 'text-slate-600' },
};

const SEVERITY_CONFIG: Record<Severity, { bg: string; text: string; border: string }> = {
  info: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function AIInsightsEngine({ role, stateAbbr, selectedWaterbody, regionData, nationalData }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false); // prevent concurrent fetches

  const fetchInsights = useCallback(async (force = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    const isNational = !!nationalData && nationalData.totalAssessed > 0;
    const cacheKey = getCacheKey(role, stateAbbr, selectedWaterbody, isNational);

    // Check cache
    if (!force) {
      const cached = insightCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setInsights(cached.insights);
        setLastUpdated(new Date(cached.timestamp));
        fetchingRef.current = false;
        return;
      }
    }

    setLoading(true);
    setError(null);

    // Build context for the API
    const regionSummary = regionData
      ? {
          totalWaterbodies: regionData.length,
          highAlert: regionData.filter(r => r.alertLevel === 'high').length,
          mediumAlert: regionData.filter(r => r.alertLevel === 'medium').length,
          lowAlert: regionData.filter(r => r.alertLevel === 'low').length,
          topCauses: Array.from(new Set(regionData.flatMap(r => r.causes || []))).slice(0, 10),
        }
      : null;

    // National ATTAINS aggregation (when available)
    const nationalSummary = isNational ? {
      totalAssessed: nationalData.totalAssessed,
      totalImpaired: nationalData.totalImpaired,
      cat5_noTMDL: nationalData.cat5,
      cat4a_hasTMDL: nationalData.cat4a,
      cat4b_altControls: nationalData.cat4b,
      cat4c_notPollutant: nationalData.cat4c,
      tmdlGapPct: nationalData.tmdlGapPct,
      topCauses: nationalData.topCauses.slice(0, 15),
      addressablePct: nationalData.addressablePct,
      addressableCount: nationalData.addressableCount,
      totalCauseInstances: nationalData.totalCauseInstances,
      worstStates: nationalData.worstStates?.slice(0, 8) || [],
    } : null;

    // Fetch active signals (beach closures, harvest stops, sensor alerts)
    let activeSignals: any[] = [];
    try {
      const sigRes = await fetch(`/api/water-data?action=signals&statecode=${stateAbbr}&limit=10`);
      if (sigRes.ok) {
        const sigData = await sigRes.json();
        activeSignals = sigData?.signals || [];
      }
    } catch { /* signals unavailable — proceed without */ }

    const userMessage = JSON.stringify({
      role,
      state: stateAbbr,
      scope: isNational ? 'national' : 'state',
      selectedWaterbody: selectedWaterbody
        ? { name: selectedWaterbody.name, category: selectedWaterbody.category, causes: selectedWaterbody.causes, parameters: selectedWaterbody.parameters }
        : null,
      regionSummary,
      nationalSummary,
      activeSignals: activeSignals.length > 0 ? activeSignals : undefined,
    });

    // Build system prompt — national or state scope
    const nationalPromptAddendum = isNational ? `
NATIONAL SCOPE: You are analyzing ALL 50 states + DC. The data includes EPA ATTAINS assessment categories (Cat 1-5), TMDL status, impairment causes, and treatability analysis.
ATTAINS CATEGORIES: Cat 5 = impaired, NO approved TMDL (on 303(d) list — worst). Cat 4a = impaired, HAS approved TMDL. Cat 4b = impaired, alternative controls. Cat 4c = impaired, not pollutant-caused. Cat 3 = insufficient data. Cat 2 = good with some concerns. Cat 1 = fully meeting standards.
TREATABLE POLLUTANTS: Sediment/TSS, nutrients (N, P), bacteria (E. coli, Enterococci), dissolved oxygen, and stormwater metals are addressable through treatment technologies. Mercury, PCBs, PFAS, and legacy contaminants require specialized approaches.
Use the nationalSummary data to provide specific numbers: cat5 count, TMDL gap percentage, top impairment causes with counts, treatable percentage, and worst states by Cat 5 concentration. Highlight any major infrastructure failures, sewage discharges, or enforcement actions that appear in the data.` : '';

    try {
      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: `You are a water quality data analyst. Generate actionable insights based on the provided water quality data. Be specific, cite parameter values, and provide early warnings. When analyzing waterbody data near major infrastructure (CSO outfalls, interceptors, treatment plants), flag sudden multi-parameter anomalies (simultaneous E. coli spike + DO crash + turbidity surge) as potential sewage discharge events. If activeSignals are present in the data, incorporate them prominently into your analysis — these represent active conditions that need immediate attention. Let the data drive the narrative — highlight whatever the most significant patterns, violations, or anomalies are.

Signal type guide for activeSignals:
- "discharge_signature": Multi-parameter sewage signature (DO crash + conductivity spike + turbidity surge). URGENT — recommend immediate investigation of upstream outfalls and interceptors.
- "statewide_alert": USGS real-time sensor reading exceeded a statistical threshold statewide. Indicates emerging water quality degradation beyond sentinel sites.
- "exceedance_probability": USGS NRTWQ modeled prediction of parameter exceedance (probability 0–1). Values >0.8 are high confidence. Recommend preemptive monitoring.
- "lab_exceedance": Discrete water sample from WQP showing violation of an EPA MCL. Lab-confirmed contamination — cite the exceedance ratio.
- "state_advisory": Official state-level health or environmental advisory (beach closures, shellfish harvest restrictions). Regulatory action already taken — connect to public health and economic impact.
- "permit_violation": EPA ECHO facility in significant CWA non-compliance. May indicate ongoing unpermitted discharge.
- "sensor_alert": Single-parameter threshold exceedance at a sentinel monitoring site.
- "beach_closure": EPA BEACON beach advisory or closure.
For beach closures or harvest stops, connect them to downstream impact on public health and economy.${nationalPromptAddendum} ${ROLE_TONE[role]} Format your response as a JSON array of exactly ${isNational ? 6 : 4} objects, each with: {type: "predictive"|"anomaly"|"comparison"|"recommendation"|"summary", severity: "info"|"warning"|"critical", title: string, body: string, waterbody?: string, timeframe?: string}. Return ONLY the JSON array, no markdown or extra text.`,
          userMessage,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.error || `API error: ${res.status}`);
      }

      const data = await res.json();
      let parsed: Insight[] = [];

      if (Array.isArray(data.insights)) {
        parsed = data.insights;
      } else if (typeof data.text === 'string') {
        // Try to parse from text response
        const jsonMatch = data.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      }

      // Validate and sanitize
      parsed = parsed.filter(i =>
        i && typeof i.title === 'string' && typeof i.body === 'string' &&
        ['predictive', 'anomaly', 'comparison', 'recommendation', 'summary'].includes(i.type) &&
        ['info', 'warning', 'critical'].includes(i.severity)
      ).slice(0, isNational ? 7 : 5);

      if (parsed.length === 0) {
        throw new Error('No valid insights returned');
      }

      // Cache results
      const now = Date.now();
      insightCache.set(cacheKey, { insights: parsed, timestamp: now });
      setInsights(parsed);
      setLastUpdated(new Date(now));
    } catch (err: any) {
      setError(err.message || 'Failed to generate insights');
      // Fallback: generate local placeholder insights
      const fallback = generateFallbackInsights(role, stateAbbr, selectedWaterbody, regionData, nationalData);
      setInsights(fallback);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [role, stateAbbr, selectedWaterbody, regionData, nationalData]);

  // Fetch when expanded — cache key includes state+role+scope, so:
  // - Same state/role → cache hit, returns instantly (no duplicate API call)
  // - New state/role  → cache miss, fetches fresh data
  // On state/role change: clear stale insights so shimmer shows, then fetch
  const isNational = !!nationalData && nationalData.totalAssessed > 0;
  const prevKeyRef = useRef(getCacheKey(role, stateAbbr, selectedWaterbody, isNational));
  useEffect(() => {
    const key = getCacheKey(role, stateAbbr, selectedWaterbody, isNational);
    const keyChanged = key !== prevKeyRef.current;
    prevKeyRef.current = key;

    if (keyChanged) {
      // State/role/waterbody changed — clear old insights immediately
      setInsights([]);
      setLastUpdated(null);
      setError(null);
    }

    if (expanded) {
      fetchInsights(keyChanged); // force bypass cache if key changed
    }
  }, [expanded, role, stateAbbr, selectedWaterbody, isNational, fetchInsights]);

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', boxShadow: 'var(--shadow-card)' }}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 transition-colors"
        style={{ background: expanded ? 'var(--bg-surface)' : 'transparent' }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <PearlIcon size={18} className="flex-shrink-0" />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-bright)' }}>PIN Insights{isNational ? ' — National' : ` — ${stateAbbr}`}</span>
            <PearlIcon size={14} />
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-dim)' }}>
                <Clock className="h-2.5 w-2.5" />
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {expanded ? <Minus className="h-4 w-4" style={{ color: 'var(--text-dim)' }} /> : <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-dim)' }} />}
          </div>
        </div>
        <p className="text-xs leading-relaxed mt-1" style={{ color: 'var(--text-secondary)' }}>
          Compiled analysis of the most current data in PIN as well as outside sources.
        </p>
        {/* Preview of loaded insights when collapsed */}
        {!expanded && insights.length > 0 && (
          <div className="mt-2 pt-2 space-y-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {insights.slice(0, 2).map((ins, i) => {
              const sevColor = ins.severity === 'critical' ? 'var(--status-severe)' : ins.severity === 'warning' ? 'var(--status-warning)' : 'var(--text-dim)';
              return (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sevColor }} />
                  <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{ins.title}</span>
                </div>
              );
            })}
            {insights.length > 2 && (
              <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>+{insights.length - 2} more findings — click to expand</div>
            )}
          </div>
        )}
        {!expanded && insights.length === 0 && (
          <div className="mt-2.5 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-default)' }}>
            <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--accent-teal)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--accent-teal)' }}>Click here to find out the latest data</span>
          </div>
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="p-4 space-y-3">
          {/* Loading shimmer */}
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="rounded-lg border border-slate-100 p-3 animate-pulse">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded bg-slate-200" />
                    <div className="h-4 w-24 rounded bg-slate-200" />
                    <div className="h-4 w-14 rounded bg-slate-200 ml-auto" />
                  </div>
                  <div className="h-3 w-3/4 rounded bg-slate-100 mb-1.5" />
                  <div className="h-3 w-full rounded bg-slate-100 mb-1" />
                  <div className="h-3 w-2/3 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          )}

          {/* Insight cards */}
          {!loading && insights.map((insight, idx) => {
            const typeConf = INSIGHT_CONFIG[insight.type] || INSIGHT_CONFIG.summary;
            const sevConf = SEVERITY_CONFIG[insight.severity] || SEVERITY_CONFIG.info;
            const Icon = typeConf.icon;

            return (
              <div key={idx} className={`rounded-lg border p-3 ${sevConf.border} ${sevConf.bg}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className={`h-4 w-4 ${typeConf.color}`} />
                  <span className="text-xs font-bold text-slate-800">{insight.title}</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {insight.waterbody && (
                      <Badge variant="secondary" className="text-[9px] bg-white/80 border-slate-200">{insight.waterbody}</Badge>
                    )}
                    <Badge variant="secondary" className={`text-[9px] ${sevConf.bg} ${sevConf.text} border-current/20`}>
                      {insight.severity === 'critical' && <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />}
                      {insight.severity === 'warning' && <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                      {insight.severity}
                    </Badge>
                  </div>
                </div>
                <div className="text-xs text-slate-700 leading-relaxed">{insight.body}</div>
                {insight.timeframe && (
                  <div className="mt-1.5 text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" /> Timeframe: {insight.timeframe}
                  </div>
                )}
              </div>
            );
          })}

          {/* Error state */}
          {error && !loading && insights.length > 0 && (
            <div className="text-[10px] text-amber-600 flex items-center gap-1" title={error}>
              <AlertTriangle className="h-3 w-3" /> Using locally generated insights ({error.length > 80 ? error.slice(0, 80) + '…' : error})
            </div>
          )}

          {/* Actions */}
          {!loading && (
            <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div className="text-[10px] leading-tight max-w-[70%]" style={{ color: 'var(--text-dim)' }}>
                Sources: Compiled analysis of EPA ATTAINS, SDWIS, ICIS, USGS, and external regulatory data. Verify critical findings independently.
              </div>
              <button
                onClick={() => fetchInsights(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                style={{ background: 'var(--accent-teal)', color: '#fff' }}
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Fallback insights (when API is unavailable) ────────────────────────────

function generateFallbackInsights(
  role: Role,
  stateAbbr: string,
  wb?: SelectedWaterbody,
  regionData?: Array<{ name: string; alertLevel: string; causes: string[] }>,
  nationalData?: NationalData,
): Insight[] {
  const isNational = !!nationalData && nationalData.totalAssessed > 0;

  // ═══ NATIONAL-SCALE FALLBACK ═══
  if (isNational) {
    const nd = nationalData;
    const worstStates = nd.worstStates?.slice(0, 5) || [];
    const topCauses = nd.topCauses.slice(0, 5);

    const insights: Insight[] = [
      {
        type: 'anomaly',
        severity: 'critical',
        title: `${nd.cat5.toLocaleString()} Waterbodies on 303(d) List — No Approved TMDL`,
        body: `Of ${nd.totalImpaired.toLocaleString()} impaired waterbodies nationally, ${nd.tmdlGapPct}% are Category 5 — impaired with no Total Maximum Daily Load plan. Only ${nd.cat4a.toLocaleString()} have approved TMDLs (Cat 4a), while ${nd.cat4b.toLocaleString()} rely on alternative controls (Cat 4b). States face increasing EPA enforcement pressure to close this regulatory gap.${worstStates.length > 0 ? ` Worst states by Cat 5 concentration: ${worstStates.map(s => `${s.name} (${s.cat5})`).join(', ')}.` : ''}`,
      },
      {
        type: 'comparison',
        severity: 'warning',
        title: `${nd.addressablePct}% of National Impairment Causes Are Treatable`,
        body: `Of ${nd.totalCauseInstances.toLocaleString()} cause-instances across all impaired waterbodies, ${nd.addressableCount.toLocaleString()} involve treatable pollutants: sediment/TSS, nutrients (N, P), bacteria (E. coli, Enterococci), dissolved oxygen, and stormwater metals. The remaining ${100 - nd.addressablePct}% include mercury, PCBs, PFAS, and legacy contaminants requiring specialized approaches.${topCauses.length > 0 ? ` Top national impairment causes: ${topCauses.map(c => `${c.cause} (${c.count.toLocaleString()})`).join(', ')}.` : ''}`,
      },
      {
        type: 'predictive',
        severity: 'warning',
        title: 'Spring Runoff Will Intensify Nutrient Loading Nationwide',
        body: `Historical patterns show 40-60% of annual nitrogen and phosphorus loads are delivered during March-June storm events. Waterbodies already impaired for nutrients will see elevated concentrations. States with large Cat 5 backlogs should anticipate worsening conditions during this window.`,
        timeframe: 'March–June 2026',
      },
      {
        type: 'summary',
        severity: 'info',
        title: `National Assessment: ${nd.totalAssessed.toLocaleString()} Waterbodies Evaluated`,
        body: `EPA ATTAINS data shows ${nd.totalAssessed.toLocaleString()} assessed waterbodies nationwide, with ${nd.totalImpaired.toLocaleString()} (${nd.totalAssessed > 0 ? Math.round((nd.totalImpaired / nd.totalAssessed) * 100) : 0}%) classified as impaired. ${worstStates.length > 0 ? `States with highest impairment concentrations: ${worstStates.map(s => `${s.name} (${s.totalImpaired.toLocaleString()} impaired)`).join(', ')}.` : ''}`,
      },
      {
        type: 'recommendation',
        severity: 'info',
        title: 'Focus Resources on Highest-Impact Impairments',
        body: `${nd.cat5 > 0 ? `With ${nd.cat5.toLocaleString()} Cat 5 waterbodies lacking TMDLs, ` : ''}prioritizing the most concentrated pollution sources per waterbody yields the greatest measurable improvement. ${nd.addressablePct}% of impairment causes are treatable with current technologies, making targeted intervention a viable path to compliance progress.`,
      },
    ];

    return insights;
  }

  // ═══ STATE-LEVEL FALLBACK (original logic) ═══
  const highCount = regionData?.filter(r => r.alertLevel === 'high').length || 0;
  const total = regionData?.length || 0;
  const topCauses = Array.from(new Set(regionData?.flatMap(r => r.causes || []) || [])).slice(0, 3);
  const wbName = wb?.name || 'the selected waterbody';
  const pct = total > 0 ? Math.round((highCount / total) * 100) : 0;

  const base: Insight[] = [
    {
      type: 'summary',
      severity: pct > 30 ? 'warning' : 'info',
      title: `${stateAbbr} Water Quality Overview`,
      body: `Currently monitoring ${total} waterbodies in ${stateAbbr}. ${highCount} (${pct}%) show elevated concern levels.${topCauses.length > 0 ? ` Leading impairment causes include ${topCauses.join(', ')}.` : ''} Continued monitoring recommended to track seasonal trends.`,
    },
    {
      type: 'predictive',
      severity: 'info',
      title: 'Seasonal Pattern Forecast',
      body: `Based on historical patterns, nutrient loading typically increases during spring runoff season. Waterbodies with existing impairments for nitrogen and phosphorus may see elevated readings in the coming weeks.`,
      timeframe: 'Next 4-8 weeks',
    },
  ];

  if (wb) {
    base.push({
      type: 'anomaly',
      severity: wb.category === 'Impaired' ? 'warning' : 'info',
      title: `${wbName} — Status Assessment`,
      body: `${wbName} is currently classified as "${wb.category}".${wb.causes?.length > 0 ? ` Listed impairment causes: ${wb.causes.join(', ')}.` : ''} This waterbody warrants focused monitoring to detect early changes in water quality parameters.`,
      waterbody: wb.name,
    });
  }

  if (role === 'MS4') {
    base.push({
      type: 'recommendation',
      severity: 'warning',
      title: 'BMP Verification Priority',
      body: `${highCount} waterbodies with high alert status may require accelerated BMP verification to maintain MS4 permit compliance. Consider prioritizing inspection schedules for receiving waters in impaired segments.`,
    });
  } else if (role === 'K12') {
    base.push({
      type: 'recommendation',
      severity: 'info',
      title: 'Classroom Connection',
      body: `Did you know? The waterbodies in your area support diverse ecosystems. ${topCauses.length > 0 ? `Studying how ${topCauses[0]} affects local wildlife makes a great field research project!` : 'Try measuring dissolved oxygen levels at different times of day to see how aquatic life responds.'}`,
    });
  } else {
    base.push({
      type: 'recommendation',
      severity: 'info',
      title: 'Data-Driven Priority',
      body: `Based on current alert distribution, focus monitoring resources on the ${highCount} high-alert waterbodies. Cross-referencing impairment causes with upstream land use data may reveal actionable intervention points.`,
    });
  }

  return base;
}
