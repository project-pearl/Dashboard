'use client';

import React from 'react';

/* ── Timeline events ────────────────────────────────────────────────── */

interface TimelineEvent {
  time: string;
  title: string;
  description: string;
}

const TIMELINE: TimelineEvent[] = [
  {
    time: 'T+0h',
    title: 'Sentinel detects pressure anomaly',
    description: 'Upstream gauge station registers abnormal flow pattern inconsistent with seasonal baseline.',
  },
  {
    time: 'T+2h',
    title: 'BED flags multi-parameter deviation',
    description: 'Binomial Event Discriminator identifies correlated anomalies across pH, DO, and turbidity — confidence 91%.',
  },
  {
    time: 'T+4h',
    title: 'Cross-site correlation confirmed',
    description: 'Pattern propagation detected across 3 downstream monitoring stations. Upstream origin triangulated.',
  },
  {
    time: 'T+8h',
    title: 'Auto-generated briefing dispatched',
    description: 'Federal, State, and MS4 stakeholders receive prioritized Sentinel briefing with response recommendations.',
  },
  {
    time: 'T+12h',
    title: 'Resolution Planner activates',
    description: 'Remediation workflow initiated with jurisdiction-specific action items and compliance tracking.',
  },
];

/* ── Component ──────────────────────────────────────────────────────── */

export function PotomacScenario() {
  return (
    <section className="bg-slate-950 py-20 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-700/40 rounded-2xl p-8 sm:p-10">
          {/* Header */}
          <div className="mb-8">
            <div className="inline-block px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-900/40 text-amber-400 border border-amber-700/30 mb-4">
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
            {TIMELINE.map((event, i) => (
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
