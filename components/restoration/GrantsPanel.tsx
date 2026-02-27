'use client';

import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  type Pillar, type ModuleCategory, type SizeTier,
  type Grant, fmt,
} from '@/components/treatment/treatmentData';
import type { GrantOpportunity } from '@/lib/stateWaterData';

/* ─── Adaptive Grant Scoring ────────────────────────────────────────────── */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Infrastructure: ['sensor', 'monitoring', 'telemetry', 'infrastructure', 'technology'],
  Interception: ['trash', 'debris', 'floatable', 'interception', 'litter'],
  'PEARL ALIA': ['biofiltration', 'pearl', 'innovative', 'nature-based', 'bmp', 'pilot'],
  Biological: ['wetland', 'habitat', 'restoration', 'biological', 'riparian', 'reef', 'oyster'],
  Mechanical: ['membrane', 'flotation', 'mechanical', 'treatment', 'wwtp'],
  Chemical: ['disinfection', 'carbon', 'ozone', 'pfas', 'chemical'],
  'Source Control': ['stormwater', 'runoff', 'conservation', 'bmp', 'agricultural', 'green infrastructure'],
  'DO Mgmt': ['dissolved oxygen', 'aeration', 'oxygenation', 'hypoxia'],
  Emerging: ['innovative', 'pilot', 'emerging', 'electrocoag', 'biochar'],
};

const PILLAR_KEYWORDS: Record<string, string[]> = {
  GW: ['groundwater', 'aquifer', 'well'],
  SW: ['stormwater', 'runoff', 'urban'],
  SurfW: ['surface water', 'stream', 'river', 'bay', 'estuary', 'lake', 'watershed'],
  DW: ['drinking water', 'potable', 'treatment'],
  WW: ['wastewater', 'effluent', 'sewage', 'discharge'],
};

const SIZE_AMOUNT_RANGES: Record<string, [number, number]> = {
  XS: [0, 100],     // $0-100K
  S:  [25, 500],
  M:  [50, 2000],
  L:  [100, 5000],
  XL: [200, 10000],
};

function scoreGrantOpportunity(
  grant: GrantOpportunity,
  activePillars: Set<Pillar>,
  selectedCats: Set<ModuleCategory>,
  attainsCauses: string[],
  sizeTier: SizeTier,
): { fit: 'high' | 'medium' | 'low'; reason: string } {
  let score = 0;
  const reasons: string[] = [];
  const descLower = (grant.description + ' ' + grant.name).toLowerCase();

  // Category overlap (30pts)
  let catScore = 0;
  for (const cat of selectedCats) {
    const keywords = CATEGORY_KEYWORDS[cat] || [];
    if (keywords.some(kw => descLower.includes(kw))) {
      catScore += 30 / Math.max(1, selectedCats.size);
    }
  }
  if (catScore > 0) reasons.push('Matches selected treatment categories');
  score += Math.min(30, catScore);

  // Pillar alignment (25pts)
  let pillarScore = 0;
  for (const p of activePillars) {
    const keywords = PILLAR_KEYWORDS[p] || [];
    if (keywords.some(kw => descLower.includes(kw))) {
      pillarScore += 25 / Math.max(1, activePillars.size);
    }
  }
  if (pillarScore > 0) reasons.push('Aligns with active water pillars');
  score += Math.min(25, pillarScore);

  // Cause relevance (25pts)
  let causeScore = 0;
  for (const cause of attainsCauses) {
    if (descLower.includes(cause.toLowerCase())) {
      causeScore += 25 / Math.max(1, attainsCauses.length);
    }
  }
  if (causeScore > 0) reasons.push('Addresses listed impairment causes');
  score += Math.min(25, causeScore);

  // Size appropriateness (20pts)
  const [minK, maxK] = SIZE_AMOUNT_RANGES[sizeTier] || [50, 2000];
  if (grant.maxAmount >= minK && grant.maxAmount <= maxK * 2) {
    score += 20;
    reasons.push('Grant amount fits project scale');
  } else if (grant.maxAmount >= minK * 0.5) {
    score += 10;
  }

  const fit = score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low';
  return { fit, reason: reasons.length > 0 ? reasons.join('; ') : 'General eligibility' };
}

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface GrantsPanelProps {
  stateAbbr: string;
  activePillars: Set<Pillar>;
  selectedCats: Set<ModuleCategory>;
  attainsCauses: string[];
  sizeTier: SizeTier;
  stateGrants: GrantOpportunity[];
  federalGrants: (Grant & { eligible: number; savings: number })[];
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function GrantsPanel({
  stateAbbr,
  activePillars,
  selectedCats,
  attainsCauses,
  sizeTier,
  stateGrants,
  federalGrants,
}: GrantsPanelProps) {
  // Score state grants adaptively
  const scoredStateGrants = useMemo(() =>
    stateGrants.map(g => {
      const { fit, reason } = scoreGrantOpportunity(g, activePillars, selectedCats, attainsCauses, sizeTier);
      return { ...g, fit, reason };
    }).sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.fit] - order[b.fit];
    }),
    [stateGrants, activePillars, selectedCats, attainsCauses, sizeTier],
  );

  const totalPotential = useMemo(() => {
    const fedTotal = federalGrants.reduce((s, g) => s + g.savings, 0);
    const stateTotal = scoredStateGrants
      .filter(g => g.fit === 'high')
      .reduce((s, g) => s + g.maxAmount * 1000, 0);
    return fedTotal + stateTotal;
  }, [federalGrants, scoredStateGrants]);

  const highCount = scoredStateGrants.filter(g => g.fit === 'high').length + federalGrants.length;

  return (
    <div>
      {/* Header Banner */}
      <div className="px-3 py-2 bg-green-50 border-b text-[10px] text-green-700 font-medium flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3" />
          Grant Potential: {fmt(totalPotential)}
        </span>
        <span className="text-green-600">{highCount} high-fit program{highCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Federal Grants (from calc) */}
      {federalGrants.length > 0 && (
        <div className="px-3 pt-2 pb-1">
          <h4 className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Federal Grant Matches
          </h4>
          <div className="space-y-1">
            {federalGrants.map(g => (
              <div key={g.id} className="flex items-center justify-between text-[10px] bg-green-50 px-2.5 py-1.5 rounded">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-green-100 text-green-700 shrink-0">
                    HIGH
                  </span>
                  <span className="font-medium text-slate-700 truncate">{g.name}</span>
                  <span className="text-slate-400 shrink-0">{Math.round(g.match * 100)}% match</span>
                </div>
                <span className="font-mono font-semibold text-green-700 shrink-0 ml-2">-{fmt(g.savings)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* State Grants */}
      {scoredStateGrants.length > 0 && (
        <div className="px-3 pt-2 pb-1">
          <h4 className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            {stateAbbr} Grant Programs
          </h4>
          <div className="space-y-1">
            {scoredStateGrants.map((g, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[10px] px-2.5 py-1.5 rounded bg-slate-50">
                <span className={`px-1 py-0.5 rounded text-[8px] font-bold shrink-0 ${
                  g.fit === 'high' ? 'bg-green-100 text-green-700'
                  : g.fit === 'medium' ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-slate-100 text-slate-500'
                }`}>
                  {g.fit === 'high' ? 'HIGH' : g.fit === 'medium' ? 'GOOD' : 'LOW'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-700 truncate">{g.name}</p>
                  <p className="text-slate-400 text-[9px]">{g.amount} &mdash; {g.source}</p>
                  {g.reason && <p className="text-slate-400 text-[8px] italic mt-0.5">{g.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {federalGrants.length === 0 && scoredStateGrants.length === 0 && (
        <div className="text-center py-6 text-slate-400 text-xs">
          <p>No grant matches found. Select treatment modules to see eligible grants.</p>
        </div>
      )}
    </div>
  );
}
