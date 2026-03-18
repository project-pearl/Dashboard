/* ------------------------------------------------------------------ */
/*  LensBriefing — Per-lens context card with static copy + dynamic   */
/*  data-driven callouts. Replaces the old generic Data Story panel.  */
/* ------------------------------------------------------------------ */

'use client';

import React, { useEffect, useState } from 'react';
import { Lightbulb, AlertTriangle, TrendingUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LensStory, StoryFinding } from '@/lib/lensStoryEngine';
import DisasterDeclarationsModal from './DisasterDeclarationsModal';

// ── Props (same interface as old LensDataStory) ─────────────────────────────

interface LensDataStoryProps {
  lens: string;
  role: string;
  state?: string | null;
}

// ── Static per-lens copy ────────────────────────────────────────────────────

const LENS_COPY: Record<string, string> = {
  'habitat-ecology':
    'This lens aggregates EPA ATTAINS waterbody assessment data with ecological sensitivity scores to show where aquatic life use standards are being met or threatened. It is designed to help identify watersheds where ecological degradation is outpacing restoration investment.',
  'habitat':
    'This lens aggregates EPA ATTAINS waterbody assessment data with ecological sensitivity scores to show where aquatic life use standards are being met or threatened. It is designed to help identify watersheds where ecological degradation is outpacing restoration investment.',
  'compliance':
    'This lens tracks NPDES permit compliance, SDWIS drinking water violations, and enforcement actions from EPA ECHO and ICIS. It is designed to surface facilities and jurisdictions with elevated violation risk before they escalate to enforcement or public notice.',
  'water-quality':
    'This lens scores waterbodies using PIN\u2019s proprietary indices against EPA ATTAINS, USGS monitoring, and TMDL status. The PIN Water Score (0\u2013100) reflects composite health across impairment, load, infrastructure risk, and environmental justice factors.',
  'fire-air-quality':
    'This lens correlates NASA FIRMS active fire detections, EPA air quality monitoring, and NWS severe weather alerts with military installation proximity and PACT Act burn pit documentation. It provides force protection and public health intelligence for fire and air quality threats.',
  'monitoring':
    'This lens aggregates real-time and historical water quality monitoring data from USGS, NGWMN groundwater networks, and NWS forecast systems. It provides baseline signal for anomaly detection and trend analysis across the PIN Fusion Engine.',
  'sentinel-monitoring':
    'This lens aggregates real-time and historical water quality monitoring data from USGS, NGWMN groundwater networks, and NWS forecast systems. It provides baseline signal for anomaly detection and trend analysis across the PIN Fusion Engine.',
  'infrastructure':
    'This lens assesses water and environmental infrastructure risk using flood impact modeling, cyber vulnerability assessments, and facility condition data. It identifies systems most likely to fail under stress conditions and prioritizes resilience investment.',
  'public-health':
    'This lens correlates waterborne illness surveillance, PFAS detection, environmental justice indicators, and EPA EJScreen data to identify populations facing compounded environmental health risk. It supports proactive public health intervention and grant prioritization.',
  'policy':
    'This lens tracks major federal rulemaking milestones, CWA compliance deadlines, and emergency regulatory actions affecting water and environmental programs. It keeps federal program managers ahead of reporting requirements and enforcement windows.',
  'policy-tracker':
    'This lens tracks major federal rulemaking milestones, CWA compliance deadlines, and emergency regulatory actions affecting water and environmental programs. It keeps federal program managers ahead of reporting requirements and enforcement windows.',
  'funding':
    'This lens aggregates federal, state, and NGO funding opportunities relevant to water quality restoration, infrastructure improvement, and environmental justice. It matches available funding to jurisdictional need based on PIN\u2019s risk scoring.',
  'overview':
    'This is the national situation overview aggregating critical findings across all domains \u2014 compliance, water quality, infrastructure, natural hazards, and public health. It surfaces the highest-priority items that require attention across the federal portfolio.',
  'briefing':
    'This lens generates an AI-assisted executive briefing summarizing the most significant environmental and infrastructure developments for the current reporting period.',
  'political-briefing':
    'This lens generates talking points, funding optics, and constituent impact summaries tailored for elected officials and their staff.',
  'scorecard':
    'This lens provides graded performance metrics across states, comparing compliance rates, infrastructure condition, water quality trends, and enforcement activity against national benchmarks.',
  'disaster-emergency':
    'This lens integrates FEMA disaster declarations, US Drought Monitor data, USGS flood monitoring, and NWS severe weather alerts to provide a unified natural hazard picture for emergency planning and response coordination.',
  'disaster':
    'This lens integrates FEMA disaster declarations, US Drought Monitor data, USGS flood monitoring, and NWS severe weather alerts to provide a unified natural hazard picture for emergency planning and response coordination.',
  'emergency':
    'This lens integrates FEMA disaster declarations, US Drought Monitor data, USGS flood monitoring, and NWS severe weather alerts to provide a unified natural hazard picture for emergency planning and response coordination.',
  'military-installations':
    'This lens monitors DOD installation environmental compliance, PFAS contamination tracking, and water supply chain analysis. It provides force protection intelligence for military installations and their surrounding communities.',
  'agricultural-nps':
    'This lens tracks agriculture-related impairments, nutrient loading trends, and nonpoint source pollution data to support TMDL implementation and agricultural best management practice planning.',
  'agriculture':
    'This lens tracks agriculture-related impairments, nutrient loading trends, and nonpoint source pollution data to support TMDL implementation and agricultural best management practice planning.',
  'trends':
    'This lens surfaces long-term environmental trends, watershed forecasts, and climate overlay data to support strategic planning and early warning of emerging risks.',
  'reports':
    'This lens provides export capabilities for role-specific formatted reports, data summaries, and briefing documents.',
  'interagency':
    'This lens surfaces cross-agency coordination items \u2014 shared enforcement targets, joint monitoring gaps, and overlapping jurisdictional responsibilities.',
  'ej-equity':
    'This lens highlights environmental justice indicators, EJScreen vulnerability indices, and demographic data to identify communities bearing disproportionate environmental burden.',
  'stormwater':
    'This lens tracks NPDES stormwater permit compliance, MS4 program metrics, and green infrastructure performance to support municipal stormwater management.',
  'permits':
    'This lens tracks NPDES permit status, renewal timelines, and compliance histories for permitted facilities in the current scope.',
  'contaminants-tracker':
    'This lens monitors emerging contaminant detections including PFAS, microplastics, and pharmaceutical compounds across public water systems and environmental monitoring networks.',
  'wqt':
    'This lens tracks water quality trading program performance, credit generation, and market activity to support nutrient trading and compliance flexibility mechanisms.',
};

// ── Callout formatting ──────────────────────────────────────────────────────

interface Callout {
  severity: 'critical' | 'warning' | 'info';
  text: string;
  sources?: string[];
  id?: string;
}

function findingsToCallouts(findings: StoryFinding[]): Callout[] {
  return findings.slice(0, 4).map(f => ({
    severity: f.severity,
    text: f.metric
      ? `${f.title} \u2014 ${f.detail}`
      : f.title,
    sources: f.sources,
    id: f.id,
  }));
}

function CalloutIcon({ severity }: { severity: Callout['severity'] }) {
  switch (severity) {
    case 'critical':
      return <AlertTriangle size={14} className="text-pin-critical shrink-0 mt-0.5" />;
    case 'warning':
      return <TrendingUp size={14} className="text-pin-warning shrink-0 mt-0.5" />;
    default:
      return <Info size={14} className="text-pin-info shrink-0 mt-0.5" />;
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function LensDataStory({ lens, role, state }: LensDataStoryProps) {
  const [data, setData] = useState<LensStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDisasterModal, setShowDisasterModal] = useState(false);

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

  const staticCopy = LENS_COPY[lens] ?? LENS_COPY['overview'];
  const lensLabel = lens.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Build dynamic callouts from findings
  const callouts: Callout[] = data ? findingsToCallouts(data.findings) : [];

  return (
    <div className="rounded-pin-lg border-l-[3px] border-l-pin-primary border border-pin-border-default bg-pin-primary-light/40 dark:bg-pin-primary-light/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Lightbulb size={16} className="text-pin-primary shrink-0" />
        <span className="text-pin-sm font-semibold text-pin-text-bright">
          {lensLabel} — Lens Briefing
        </span>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Section 1: What this lens shows */}
        <p className="text-pin-sm text-pin-text-primary leading-relaxed">
          {staticCopy}
        </p>

        {/* Divider */}
        <div className="border-t border-pin-primary/15" />

        {/* Section 2: What to watch right now */}
        <div>
          <h4 className="text-pin-xs font-semibold uppercase tracking-[0.05em] text-pin-text-dim mb-2">
            What to Watch Right Now
          </h4>

          {loading && (
            <p className="text-pin-sm text-pin-text-secondary italic">
              Data loading — insights will appear once this lens has populated data.
            </p>
          )}

          {error && (
            <p className="text-pin-sm text-pin-critical">
              Unable to load lens data: {error}
            </p>
          )}

          {!loading && !error && callouts.length === 0 && (
            <p className="text-pin-sm text-pin-text-secondary italic">
              No actionable findings for the current scope.
              {state ? ` Data for ${state} may not yet be cached.` : ''}
            </p>
          )}

          {!loading && !error && callouts.length > 0 && (
            <ul className="space-y-2">
              {callouts.map((c, i) => {
                const isDisasterDeclaration = c.sources?.includes('fema') || c.text.includes('FEMA disaster declaration');

                return (
                  <li key={i} className="flex items-start gap-2">
                    <CalloutIcon severity={c.severity} />
                    {isDisasterDeclaration ? (
                      <button
                        onClick={() => setShowDisasterModal(true)}
                        className={cn(
                          'text-pin-sm leading-snug text-left hover:underline cursor-pointer',
                          c.severity === 'critical' ? 'text-pin-critical font-medium' :
                          c.severity === 'warning' ? 'text-pin-text-bright' :
                          'text-pin-text-primary',
                        )}
                      >
                        {c.text}
                      </button>
                    ) : (
                      <span className={cn(
                        'text-pin-sm leading-snug',
                        c.severity === 'critical' ? 'text-pin-critical font-medium' :
                        c.severity === 'warning' ? 'text-pin-text-bright' :
                        'text-pin-text-primary',
                      )}>
                        {c.text}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Data source attribution */}
        {data && data.dataSources.length > 0 && (
          <div className="pt-2 border-t border-pin-primary/10">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-2xs text-pin-text-dim">
              {data.dataSources.map(ds => (
                <span key={ds.name}>
                  {ds.name} <span className="opacity-60">({ds.agency} · {ds.freshness})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Disaster Declarations Modal */}
      <DisasterDeclarationsModal
        isOpen={showDisasterModal}
        onClose={() => setShowDisasterModal(false)}
      />
    </div>
  );
}
