'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, MapPin, Loader2 } from 'lucide-react';
import type { CachedWaterbody } from '@/lib/attainsCache';
import type { Pillar, SizeTier } from '@/components/treatment/treatmentData';
import type { ContaminantKey } from '@/components/treatment/treatmentData';
import { SIZE_TIER_ORDER } from '@/components/treatment/treatmentData';

// ─── CAUSE_MAP for baseline derivation from ATTAINS causes ──────────────────

const CAUSE_MAP: Record<string, { key: ContaminantKey; severity: number }> = {
  'Nitrogen':          { key: 'nit', severity: 60 },
  'Phosphorus':        { key: 'pho', severity: 55 },
  'Total Nitrogen':    { key: 'nit', severity: 65 },
  'Total Phosphorus':  { key: 'pho', severity: 60 },
  'Sediment':          { key: 'tss', severity: 50 },
  'Sedimentation':     { key: 'tss', severity: 50 },
  'Turbidity':         { key: 'tss', severity: 45 },
  'Bacteria':          { key: 'bac', severity: 55 },
  'E. coli':           { key: 'bac', severity: 60 },
  'Enterococcus':      { key: 'bac', severity: 60 },
  'Fecal Coliform':    { key: 'bac', severity: 55 },
  'PFAS':              { key: 'pfas', severity: 70 },
  'Trash':             { key: 'trash', severity: 40 },
  'Nutrients':         { key: 'nit', severity: 55 },
  'Pathogens':         { key: 'bac', severity: 55 },
  'Mercury':           { key: 'pfas', severity: 40 },
  'Oxygen Depletion':  { key: 'tss', severity: 50 },
};

// ─── Size Classification ────────────────────────────────────────────────────

export const SIZE_TIERS: { tier: SizeTier; label: string; maxAcres: number; unitMult: number }[] = [
  { tier: 'XS', label: 'Micro (<50 ac)',       maxAcres: 50,       unitMult: 0.5 },
  { tier: 'S',  label: 'Small (50-500 ac)',     maxAcres: 500,      unitMult: 0.75 },
  { tier: 'M',  label: 'Medium (500-5K ac)',    maxAcres: 5000,     unitMult: 1.0 },
  { tier: 'L',  label: 'Large (5K-50K ac)',     maxAcres: 50000,    unitMult: 1.5 },
  { tier: 'XL', label: 'Regional (50K+ ac)',    maxAcres: Infinity, unitMult: 2.5 },
];

export function classifySize(wb: CachedWaterbody): { tier: SizeTier; estAcres: number; label: string } {
  // Estimate from waterType since ATTAINS doesn't give acreage
  const wt = (wb.waterType || '').toUpperCase();
  let estAcres = 500; // default M
  if (['R', 'RIVER', 'S', 'STREAM'].some(t => wt.includes(t))) estAcres = 200;
  else if (['L', 'LAKE', 'RES', 'RESERVOIR'].some(t => wt.includes(t))) estAcres = 2000;
  else if (['ES', 'ESTUARY', 'BAY'].some(t => wt.includes(t))) estAcres = 10000;
  else if (['OC', 'OCEAN', 'CW', 'COASTAL'].some(t => wt.includes(t))) estAcres = 50000;

  const info = SIZE_TIERS.find(s => estAcres <= s.maxAcres) || SIZE_TIERS[2];
  return { tier: info.tier, estAcres, label: info.label };
}

/** Derive baseline contaminant percentages from ATTAINS causes list */
export function deriveBaselineFromCauses(
  causes: string[],
  category: string,
): Record<ContaminantKey, number> {
  const base: Record<ContaminantKey, number> = { tss: 15, bac: 10, nit: 20, pho: 18, pfas: 8, trash: 5 };

  // Category severity multiplier
  const cat = (category || '').toUpperCase();
  const catMult = cat.startsWith('5') ? 1.0
    : cat.startsWith('4') ? 0.75
    : cat.startsWith('3') ? 0.5
    : cat.startsWith('2') ? 0.3
    : 0.15;

  for (const cause of causes) {
    const mapping = CAUSE_MAP[cause];
    if (!mapping) continue;
    const val = Math.round(mapping.severity * catMult);
    base[mapping.key] = Math.max(base[mapping.key], Math.min(95, val));
  }

  return base;
}

/** Auto-detect likely pillars from waterbody data */
export function suggestPillars(wb: CachedWaterbody): Set<Pillar> {
  const pillars = new Set<Pillar>();
  const wt = (wb.waterType || '').toUpperCase();
  const causes = wb.causes.map(c => c.toLowerCase());

  // Surface water types
  if (['R', 'S', 'L', 'RES', 'ES', 'RIVER', 'STREAM', 'LAKE', 'RESERVOIR', 'ESTUARY']
    .some(t => wt.includes(t))) {
    pillars.add('SurfW');
  }

  // Stormwater indicators
  if (wt.includes('ST') || causes.some(c => c.includes('stormwater') || c.includes('runoff'))) {
    pillars.add('SW');
  }

  // Groundwater
  if (wt.includes('GW') || causes.some(c => c.includes('groundwater'))) {
    pillars.add('GW');
  }

  // Bacteria/pathogens suggest stormwater
  if (causes.some(c => c.includes('bacteria') || c.includes('pathogen') || c.includes('coli') || c.includes('enterococcus'))) {
    pillars.add('SW');
  }

  // Nutrients suggest surface water
  if (causes.some(c => c.includes('nitrogen') || c.includes('phosphorus') || c.includes('nutrient'))) {
    pillars.add('SurfW');
  }

  // Default: if nothing detected, assume SurfW + SW
  if (pillars.size === 0) {
    pillars.add('SurfW');
    pillars.add('SW');
  }

  return pillars;
}

// ─── Tier comparison helper ──────────────────────────────────────────────────

export function tierIndex(t: SizeTier): number {
  return SIZE_TIER_ORDER.indexOf(t);
}

export function moduleMatchesTier(sizeRange: [SizeTier, SizeTier], tier: SizeTier): boolean {
  return tierIndex(sizeRange[0]) <= tierIndex(tier) && tierIndex(tier) <= tierIndex(sizeRange[1]);
}

// ─── Types ───────────────────────────────────────────────────────────────────

type SearchMode = 'name' | 'huc' | 'ms4' | 'nearby';

interface SearchResult extends CachedWaterbody {
  distance?: number;
}

interface WaterbodySelectorProps {
  stateAbbr: string;
  selected: CachedWaterbody | null;
  onSelect: (wb: CachedWaterbody | null) => void;
  sizeTier?: SizeTier;
  sizeLabel?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WaterbodySelector({
  stateAbbr, selected, onSelect, sizeTier, sizeLabel,
}: WaterbodySelectorProps) {
  const [mode, setMode] = useState<SearchMode>('name');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string, searchMode: SearchMode) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('mode', searchMode);
      params.set('limit', '20');
      if (stateAbbr) params.set('state', stateAbbr);

      switch (searchMode) {
        case 'name':
          params.set('q', q);
          break;
        case 'huc':
          params.set('huc8', q);
          break;
        case 'ms4':
          params.set('ms4', q);
          break;
        case 'nearby': {
          const parts = q.split(',').map(s => s.trim());
          if (parts.length >= 2) {
            params.set('lat', parts[0]);
            params.set('lng', parts[1]);
            params.set('radius', '25');
          }
          break;
        }
      }

      const res = await fetch(`/api/waterbody-search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [stateAbbr]);

  const handleInput = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value, mode), 300);
  }, [mode, search]);

  const handleModeChange = useCallback((newMode: SearchMode) => {
    setMode(newMode);
    setQuery('');
    setResults([]);
  }, []);

  const handleSelect = useCallback((wb: CachedWaterbody) => {
    onSelect(wb);
    setOpen(false);
    setQuery('');
    setResults([]);
  }, [onSelect]);

  const handleClear = useCallback(() => {
    onSelect(null);
    setQuery('');
    setResults([]);
  }, [onSelect]);

  // Close dropdown on outside click
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const placeholders: Record<SearchMode, string> = {
    name: 'Search waterbody name...',
    huc: 'Enter HUC-8 code (e.g. 02070001)...',
    ms4: 'Search MS4 jurisdiction name...',
    nearby: 'Lat, Long (e.g. 39.28, -76.62)...',
  };

  const modeLabels: { id: SearchMode; label: string }[] = [
    { id: 'name', label: 'Name' },
    { id: 'huc', label: 'HUC-8' },
    { id: 'ms4', label: 'MS4' },
    { id: 'nearby', label: 'Lat/Lng' },
  ];

  return (
    <div ref={containerRef} className="relative">
      {/* Selected waterbody chip */}
      {selected && (
        <div className="flex items-center gap-2 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2 mb-2">
          <MapPin className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-semibold text-cyan-800 truncate block">
              {selected.name}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {selected.category && (
                <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${
                  selected.category.startsWith('5') ? 'bg-red-100 text-red-700'
                  : selected.category.startsWith('4') ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
                }`}>Cat {selected.category}</span>
              )}
              {selected.causeCount > 0 && (
                <span className="text-[8px] text-slate-400">{selected.causeCount} cause{selected.causeCount !== 1 ? 's' : ''}</span>
              )}
              {sizeTier && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                  Size: {sizeTier}{sizeLabel ? ` — ${sizeLabel}` : ''}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleClear}
            className="p-0.5 rounded hover:bg-cyan-100 text-cyan-500 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        {/* Mode tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50">
          {modeLabels.map(m => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              className={`flex-1 px-2 py-1.5 text-[10px] font-medium transition-colors ${
                mode === m.id
                  ? 'text-cyan-700 border-b-2 border-cyan-600 bg-white'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin shrink-0" />
          ) : (
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          )}
          <input
            type="text"
            value={query}
            onChange={e => handleInput(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholders[mode]}
            className="flex-1 text-[11px] text-slate-700 placeholder:text-slate-300 outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }}
              className="text-slate-300 hover:text-slate-500">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-[280px] overflow-y-auto">
          {results.map((wb, i) => (
            <button
              key={`${wb.id}-${i}`}
              onClick={() => handleSelect(wb)}
              className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold text-slate-700 truncate">{wb.name}</div>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  <span className="text-[8px] font-mono text-slate-400">{wb.id}</span>
                  {wb.category && (
                    <span className={`text-[7px] px-1 py-0.5 rounded font-bold ${
                      wb.category.startsWith('5') ? 'bg-red-100 text-red-700'
                      : wb.category.startsWith('4') ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-500'
                    }`}>Cat {wb.category}</span>
                  )}
                  {wb.causes.slice(0, 2).map(c => (
                    <span key={c} className="text-[7px] px-1 rounded bg-red-50 text-red-500">{c}</span>
                  ))}
                  {'distance' in wb && typeof wb.distance === 'number' && (
                    <span className="text-[7px] px-1 rounded bg-blue-50 text-blue-600">{wb.distance} km</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
