"use client";

import { useState } from "react";
import type { ScoredCategory, ScoredModule, CostTier } from "@/lib/resolutionModules";

interface Props {
  categories: ScoredCategory[];
  minScore?: number;
}

const COST_COLORS: Record<CostTier, string> = {
  '$': 'bg-green-100 text-green-700',
  '$$': 'bg-blue-100 text-blue-700',
  '$$$': 'bg-amber-100 text-amber-700',
  '$$$$': 'bg-red-100 text-red-700',
};

function scoreBarColor(score: number) {
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-gray-400';
}

function ModuleCard({ mod }: { mod: ScoredModule }) {
  const [showOutputs, setShowOutputs] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-2.5">
      {/* Row 1: Title + Score bar */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base flex-shrink-0">{mod.icon}</span>
          <span className="text-sm font-semibold text-gray-800 leading-tight">{mod.title}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-medium text-gray-500">{mod.applicabilityScore}</span>
          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${scoreBarColor(mod.applicabilityScore)}`}
              style={{ width: `${mod.applicabilityScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Row 2: Description */}
      <p className="text-xs text-gray-600 leading-relaxed">{mod.description}</p>

      {/* Row 3: Primary Users */}
      {mod.primaryUsers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {mod.primaryUsers.map(user => (
            <span key={user} className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">
              {user}
            </span>
          ))}
        </div>
      )}

      {/* Row 4: Matched causes */}
      {mod.matchedCauses.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {mod.matchedCauses.map(cause => (
            <span key={cause} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
              {cause}
            </span>
          ))}
        </div>
      )}

      {/* Row 5: Data Sources */}
      {mod.dataSources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {mod.dataSources.map(src => (
            <span key={src} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              {src}
            </span>
          ))}
        </div>
      )}

      {/* Row 6: Metadata chips */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">{mod.loadReductionRange}</span>
        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">{mod.timeline}</span>
        <span className={`px-2 py-0.5 rounded font-medium ${COST_COLORS[mod.costTier]}`}>
          {mod.costTier} — {mod.costNote}
        </span>
      </div>

      {/* Row 7: Outputs (collapsible) */}
      {mod.outputs.length > 0 && (
        <div>
          <button
            onClick={() => setShowOutputs(v => !v)}
            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {showOutputs ? 'Hide deliverables' : 'Show deliverables'}
          </button>
          {showOutputs && (
            <ul className="mt-1.5 space-y-0.5 text-[11px] text-gray-600 list-disc list-inside">
              {mod.outputs.map(output => (
                <li key={output}>{output}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function StrategyModulesSection({ categories, minScore = 20 }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Auto-expand first category
    const first = categories[0]?.id;
    return first ? new Set([first]) : new Set();
  });

  // Filter modules below minScore
  const filtered = categories
    .map(cat => ({
      ...cat,
      modules: cat.modules.filter(m => m.applicabilityScore >= minScore),
    }))
    .filter(cat => cat.modules.length > 0);

  if (filtered.length === 0) return null;

  const toggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="print:hidden space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Recommended Strategy Modules</h3>
        <p className="text-xs text-gray-400 mt-0.5">Algorithmically matched to impairment causes — not AI-generated.</p>
      </div>

      {filtered.map(cat => {
        const isOpen = expandedIds.has(cat.id);
        return (
          <div key={cat.id} className={`border rounded-lg overflow-hidden ${cat.color}`}>
            {/* Category header */}
            <button
              onClick={() => toggle(cat.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{cat.icon}</span>
                <span className="text-sm font-semibold text-gray-700">{cat.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/60 text-gray-500 font-medium">
                  {cat.modules.length} module{cat.modules.length !== 1 ? 's' : ''}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Module cards */}
            {isOpen && (
              <div className="px-4 pb-4 space-y-3">
                {cat.modules.map(mod => (
                  <ModuleCard key={mod.id} mod={mod} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
