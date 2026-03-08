'use client';

import React from 'react';

/* ── Component ──────────────────────────────────────────────────────── */

export function AccessGate() {
  return (
    <section className="bg-slate-950 py-20 px-6 border-t border-slate-800/50">
      <div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Explorer Access */}
          <div className="bg-slate-900/80 border border-slate-700/40 rounded-2xl p-8 flex flex-col">
            <div className="inline-block self-start px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-900/40 text-emerald-400 border border-emerald-700/30 mb-4">
              Instant Access
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Explorer Access</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-6 flex-1">
              Full read access to the Grid. Synthetic data environment. No approval required.
            </p>
            <a
              href="/"
              className="block w-full py-3 rounded-lg bg-white text-slate-900 text-sm font-semibold text-center hover:bg-slate-100 transition-colors"
            >
              Access the Grid
            </a>
          </div>

          {/* Operator Access */}
          <div className="bg-slate-900/80 border border-slate-700/40 rounded-2xl p-8 flex flex-col">
            <div className="inline-block self-start px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-cyan-900/40 text-cyan-400 border border-cyan-700/30 mb-4">
              Jurisdiction-Bound
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Operator Access</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-6 flex-1">
              Admin-approved access. Real data. Jurisdiction-scoped permissions and audit trail.
            </p>
            <a
              href="/"
              className="block w-full py-3 rounded-lg bg-cyan-600 text-white text-sm font-semibold text-center hover:bg-cyan-500 transition-colors"
            >
              Request Operator Access
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
