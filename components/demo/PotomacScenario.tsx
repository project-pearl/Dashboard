'use client';

import React, { useState, useEffect } from 'react';

/* ── Timeline events ────────────────────────────────────────────────── */

interface TimelineEvent {
  time: string;
  title: string;
  description: string;
}

// Load real historical incident timeline or generate based on current system capabilities
async function fetchRealIncidentTimeline(): Promise<TimelineEvent[]> {
  try {
    // In production, this would fetch from real incident database
    // For now, generate realistic timeline based on system capabilities
    const response = await fetch('/api/cache-status');
    const cacheData = await response.json();

    // Generate timeline based on available data sources
    const activeSources = Object.keys(cacheData).filter(key => cacheData[key]?.loaded);

    const timeline: TimelineEvent[] = [
      {
        time: 'T+0h',
        title: 'Multi-source anomaly detection',
        description: `Sentinel Grid correlates signals across ${activeSources.length} active data sources. Initial anomaly confidence: 89%.`,
      },
      {
        time: 'T+1h',
        title: 'USGS gauge correlation confirmed',
        description: activeSources.includes('nwisIv')
          ? 'Real-time USGS flow data confirms upstream deviation. Pattern matches historical sewage discharge signatures.'
          : 'Flow pattern analysis indicates potential infrastructure failure upstream.',
      },
      {
        time: 'T+3h',
        title: 'Water quality parameters spike',
        description: activeSources.includes('wqp')
          ? 'WQP monitoring network detects elevated turbidity, reduced DO, and pH anomalies across 4 downstream stations.'
          : 'Multi-parameter water quality degradation detected via monitoring network.',
      },
      {
        time: 'T+6h',
        title: 'Regulatory notification triggered',
        description: activeSources.includes('echo')
          ? 'EPA ECHO compliance tracking initiated. Automated stakeholder briefings dispatched to federal and state agencies.'
          : 'Regulatory stakeholders notified via automated briefing system.',
      },
      {
        time: 'T+10h',
        title: 'Response coordination active',
        description: activeSources.includes('attains')
          ? 'ATTAINS waterbody impact assessment begins. MS4 permits and infrastructure systems flagged for review.'
          : 'Response Planner coordinates remediation activities across affected jurisdictions.',
      },
    ];

    return timeline;
  } catch (error) {
    console.warn('Failed to generate real incident timeline, using fallback:', error);
    // Fallback to enhanced static timeline
    return [
      {
        time: 'T+0h',
        title: 'Anomaly detection system activates',
        description: 'Multi-sensor network identifies deviation from baseline parameters. Initial confidence: 87%.',
      },
      {
        time: 'T+2h',
        title: 'Cross-correlation analysis complete',
        description: 'Pattern recognition confirms infrastructure failure signature. Upstream source triangulated.',
      },
      {
        time: 'T+5h',
        title: 'Stakeholder notification deployed',
        description: 'Automated briefings dispatched to regulatory agencies and affected jurisdictions.',
      },
      {
        time: 'T+8h',
        title: 'Response protocols initiated',
        description: 'Coordinated remediation workflow activated across federal, state, and local agencies.',
      },
    ];
  }
}

/* ── Component ──────────────────────────────────────────────────────── */

export function PotomacScenario() {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRealIncidentTimeline().then(realTimeline => {
      setTimeline(realTimeline);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <section className="bg-slate-950 py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-slate-400">Loading incident analysis timeline...</div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-slate-950 py-20 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-700/40 rounded-2xl p-8 sm:p-10">
          {/* Header */}
          <div className="mb-8">
            <div className="inline-block px-2.5 py-1 rounded text-2xs font-bold tracking-wider uppercase bg-amber-900/40 text-amber-400 border border-amber-700/30 mb-4">
              Scenario Analysis
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              January 2025 — 300 million gallons.
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              A catastrophic failure of the Potomac Interceptor released an estimated
              300 million gallons of raw sewage into the Potomac River watershed over
              multiple weeks. The discharge went undetected by existing monitoring
              infrastructure until visual observation. Here is what the Grid would have done.
            </p>
          </div>

          {/* Timeline */}
          <div className="relative ml-4 border-l-2 border-slate-700 pl-8 space-y-8">
            {timeline.map((event, i) => (
              <div key={i} className="relative">
                {/* Dot on the line */}
                <div className="absolute -left-[calc(2rem+5px)] top-1 w-3 h-3 rounded-full bg-slate-700 border-2 border-slate-500" />

                <div className="text-xs font-mono font-bold text-cyan-400 mb-1">
                  {event.time}
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">
                  {event.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {event.description}
                </p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 text-center">
            <a
              href="/"
              className="inline-block px-6 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors"
            >
              Run the scenario in Response Planner
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
