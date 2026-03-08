'use client';

import React, { useEffect, useCallback } from 'react';

/* ── Alert data ─────────────────────────────────────────────────────── */

interface AlertData {
  id: string;
  badge: string;
  location: string;
  method: string;
  confidence: number;
  deviations: { param: string; sigma: string }[];
  crossSite: string;
  scoreDelta: { from: number; to: number; window: string };
  actions: string[];
}

const ALERTS: Record<string, AlertData> = {
  'back-river-md': {
    id: 'back-river-md',
    badge: 'ANOMALY DETECTED — CHEMICAL SIGNATURE',
    location: 'Back River, Maryland',
    method: 'Binomial Event Discriminator (BED)',
    confidence: 94,
    deviations: [
      { param: 'pH', sigma: '+3.2σ' },
      { param: 'Conductivity', sigma: '+2.8σ' },
      { param: 'Turbidity', sigma: '+1.9σ' },
    ],
    crossSite:
      'Upstream station USGS-01585200 showed similar pattern 4.2 hours prior',
    scoreDelta: { from: 71, to: 43, window: '6-hour' },
    actions: [
      'Dispatch field verification team to Back River WWTP outfall',
      'Cross-reference NPDES permit MD0021601 discharge monitoring reports',
      'Escalate to MDE Water Quality Division for enforcement assessment',
    ],
  },
  'anacostia-dc': {
    id: 'anacostia-dc',
    badge: 'ANOMALY DETECTED — INFRASTRUCTURE FAILURE SIGNATURE',
    location: 'Anacostia River, Washington DC',
    method: 'Multivariate Nearest Neighbor (MVNN)',
    confidence: 88,
    deviations: [
      { param: 'Turbidity', sigma: '+4.1σ' },
      { param: 'Conductivity', sigma: '+2.4σ' },
      { param: 'Dissolved Oxygen', sigma: '-2.1σ' },
    ],
    crossSite:
      'Concurrent CSO overflow reported at Outfall 049 — volume 2.3M gallons',
    scoreDelta: { from: 64, to: 38, window: '4-hour' },
    actions: [
      'Alert DC Water CSO Long Term Control Plan team',
      'Activate downstream monitoring at USGS-01651000 (Anacostia at DC)',
      'Notify Anacostia Watershed Society for community advisory',
    ],
  },
};

/* ── Props ──────────────────────────────────────────────────────────── */

interface SentinelAlertDrawerProps {
  selectedAlert: string | null;
  onClose: () => void;
}

/* ── Component ──────────────────────────────────────────────────────── */

export function SentinelAlertDrawer({ selectedAlert, onClose }: SentinelAlertDrawerProps) {
  const alert = selectedAlert ? ALERTS[selectedAlert] : null;
  const isOpen = alert != null;

  /* Close on Escape */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-screen w-full max-w-[420px] z-50 overflow-y-auto
          bg-slate-900 border-l border-slate-700/50 shadow-2xl
          transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {alert && (
          <div className="p-6 flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="inline-block px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase bg-red-900/60 text-red-300 border border-red-700/40 mb-3">
                  {alert.badge}
                </div>
                <h2 className="text-xl font-bold text-white">{alert.location}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Detection method */}
            <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/40">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Detection Method</div>
              <div className="text-sm text-white font-medium">{alert.method}</div>
              <div className="text-sm text-emerald-400 font-mono mt-1">
                Confidence: {alert.confidence}%
              </div>
            </div>

            {/* Multi-parameter deviation */}
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">
                Multi-Parameter Deviation
              </div>
              <div className="space-y-2">
                {alert.deviations.map((d) => (
                  <div
                    key={d.param}
                    className="flex items-center justify-between bg-slate-800/40 rounded px-3 py-2"
                  >
                    <span className="text-sm text-slate-200">{d.param}</span>
                    <span className="text-sm font-mono font-bold text-red-400">{d.sigma}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cross-site correlation */}
            <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/40">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                Cross-Site Correlation
              </div>
              <p className="text-sm text-slate-200">{alert.crossSite}</p>
            </div>

            {/* Score delta */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-300 font-mono">{alert.scoreDelta.from}</div>
                <div className="text-[10px] text-slate-500 uppercase">Before</div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400 font-mono">{alert.scoreDelta.to}</div>
                <div className="text-[10px] text-slate-500 uppercase">After</div>
              </div>
              <div className="text-xs text-slate-400 ml-2">
                {alert.scoreDelta.window} window
              </div>
            </div>

            {/* Recommended actions */}
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">
                Recommended Actions
              </div>
              <ol className="space-y-2">
                {alert.actions.map((action, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-200">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-700 text-slate-300 text-xs flex items-center justify-center font-mono">
                      {i + 1}
                    </span>
                    {action}
                  </li>
                ))}
              </ol>
            </div>

            {/* CTA */}
            <button className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors mt-2">
              View full Sentinel report
            </button>
          </div>
        )}
      </div>
    </>
  );
}
