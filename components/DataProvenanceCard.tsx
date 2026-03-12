// components/DataProvenanceCard.tsx
// Compact, collapsible source catalog card for inline display on every lens
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TierBadge } from '@/components/TierBadge';
import type { DataConfidenceTier } from '@/lib/useWaterData';
import { ChevronDown, ExternalLink, Database } from 'lucide-react';

// ─── Static source catalog (mirrors data-provenance page §6) ─────────────

interface SourceEntry {
  name: string;
  org: string;
  refresh: string;
}

const TIER_SOURCES: { tier: DataConfidenceTier; label: string; sources: SourceEntry[] }[] = [
  {
    tier: 1,
    label: 'Federal / Regulatory',
    sources: [
      { name: 'ATTAINS',         org: 'EPA',               refresh: 'Daily' },
      { name: 'WQP',             org: 'EPA / USGS / USDA', refresh: 'Daily' },
      { name: 'ECHO / ICIS',     org: 'EPA',               refresh: 'Daily' },
      { name: 'SDWIS',           org: 'EPA',               refresh: 'Daily' },
      { name: 'USGS WDFN',       org: 'USGS',              refresh: '15-min' },
      { name: 'EJScreen',        org: 'EPA',               refresh: 'Annual' },
      { name: 'NOAA CO-OPS',     org: 'NOAA',              refresh: '6-min' },
      { name: 'NHD / NHDPlus',   org: 'USGS',              refresh: 'Annual' },
      { name: 'WATERS Geo',      org: 'EPA',               refresh: 'Synced' },
      { name: 'USFWS ECOS',      org: 'USFWS',             refresh: 'Periodic' },
      { name: 'CEJST',           org: 'CEQ',               refresh: 'Annual' },
      { name: 'Census ACS',      org: 'Census Bureau',     refresh: 'Annual' },
      { name: 'NWIS-GW',         org: 'USGS',              refresh: 'Daily' },
      { name: 'NetDMR',          org: 'EPA',               refresh: 'Monthly' },
      { name: 'NPDES Permits',   org: 'EPA / States',      refresh: 'Monthly' },
      { name: 'Grants.gov',      org: 'Multi-Agency',      refresh: 'Daily' },
      { name: 'SAM.gov',         org: 'GSA',               refresh: 'Weekly' },
    ],
  },
  {
    tier: 2,
    label: 'State / Academic / Research',
    sources: [
      { name: 'CBP DataHub',     org: 'Chesapeake Bay Program', refresh: 'Monthly' },
      { name: 'State MDE',       org: 'State agencies',         refresh: 'Varies' },
      { name: 'NERRS',           org: 'NOAA',                   refresh: '15-min' },
    ],
  },
  {
    tier: 3,
    label: 'Community',
    sources: [
      { name: 'Blue Water Baltimore', org: 'BWB',         refresh: 'Monthly' },
      { name: 'Waterkeeper Alliance', org: 'Waterkeeper', refresh: 'Varies' },
    ],
  },
  {
    tier: 4,
    label: 'Derived / Observational',
    sources: [
      { name: 'PIN Composite Indices', org: 'PIN Platform', refresh: 'Daily (computed)' },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function DataProvenanceCard() {
  const [expandedTier, setExpandedTier] = useState<DataConfidenceTier | null>(null);

  const toggleTier = (tier: DataConfidenceTier) =>
    setExpandedTier(prev => (prev === tier ? null : tier));

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Database className="w-4 h-4 text-slate-500" />
          Data Provenance
        </CardTitle>
        <p className="text-xs text-slate-500 mt-0.5">
          PIN integrates 20+ sources across federal, state, and community organizations.
          All data is fetched via official APIs, cached daily, and timestamped for provenance.
        </p>
      </CardHeader>

      <CardContent className="pt-0 space-y-1.5">
        {TIER_SOURCES.map(({ tier, label, sources }) => {
          const isOpen = expandedTier === tier;
          return (
            <div key={tier} className="border rounded-md overflow-hidden">
              {/* Tier header row */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleTier(tier)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTier(tier); } }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <TierBadge tier={tier} size="sm" />
                <span className="text-sm font-medium text-slate-700 flex-1">{label}</span>
                <span className="text-xs text-slate-400">{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>

              {/* Expanded source table */}
              {isOpen && (
                <div className="border-t">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500">
                        <th className="text-left px-3 py-1 font-medium">Source</th>
                        <th className="text-left px-3 py-1 font-medium">Organization</th>
                        <th className="text-right px-3 py-1 font-medium">Refresh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sources.map((s) => (
                        <tr key={s.name} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-3 py-1.5 font-medium text-slate-700">{s.name}</td>
                          <td className="px-3 py-1.5 text-slate-500">{s.org}</td>
                          <td className="px-3 py-1.5 text-right text-slate-500">{s.refresh}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {/* Methodology link */}
        <div className="pt-2 flex items-center justify-between">
          <Link
            href="/dashboard/data-provenance"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            View full methodology
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Disclaimer */}
        <p className="text-2xs text-slate-400 leading-relaxed pt-1 border-t border-slate-100">
          Data is provided for research and planning purposes only. Source agencies retain authoritative
          status over their respective datasets. See the full Data Provenance page for QA/QC methodology
          and confidence tier definitions.
        </p>
      </CardContent>
    </Card>
  );
}
