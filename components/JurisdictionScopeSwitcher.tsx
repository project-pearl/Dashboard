'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MapPin, X, Search } from 'lucide-react';
import { useJurisdictionContext } from '@/lib/jurisdiction-context';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export function JurisdictionScopeSwitcher() {
  const {
    activeJurisdiction,
    roleDefaultJurisdiction,
    overrideJurisdiction,
    availableJurisdictions,
    canOverride,
    setJurisdictionOverride,
    clearJurisdictionOverride,
  } = useJurisdictionContext();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync jurisdiction from URL on mount
  useEffect(() => {
    const urlJurisdiction = searchParams.get('jurisdiction');
    if (urlJurisdiction && urlJurisdiction !== (overrideJurisdiction?.jurisdiction_id || '')) {
      setJurisdictionOverride(urlJurisdiction);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist jurisdiction to URL when override changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (overrideJurisdiction?.jurisdiction_id) {
      params.set('jurisdiction', overrideJurisdiction.jurisdiction_id);
    } else {
      params.delete('jurisdiction');
    }
    const newUrl = `${pathname}?${params.toString()}`;
    if (newUrl !== `${pathname}?${searchParams.toString()}`) {
      router.replace(newUrl, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideJurisdiction?.jurisdiction_id]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return availableJurisdictions;
    const q = query.toLowerCase();
    return availableJurisdictions.filter(
      (j) =>
        j.jurisdiction_name.toLowerCase().includes(q) ||
        j.parent_state.toLowerCase().includes(q) ||
        j.jurisdiction_id.toLowerCase().includes(q)
    );
  }, [query, availableJurisdictions]);

  if (!canOverride && !activeJurisdiction) return null;
  if (availableJurisdictions.length === 0 && !activeJurisdiction) return null;

  const selected = overrideJurisdiction?.jurisdiction_id || '';
  const selectedLabel = overrideJurisdiction?.jurisdiction_name
    || (roleDefaultJurisdiction ? `Role default: ${roleDefaultJurisdiction.jurisdiction_name}` : 'Entity default');

  return (
    <div ref={containerRef} className="relative flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
      <MapPin className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" aria-hidden="true" />

      {/* Typeahead search input */}
      {open ? (
        <div className="relative">
          <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setOpen(false); setQuery(''); }
              if (e.key === 'Enter' && filtered.length === 1) {
                setJurisdictionOverride(filtered[0].jurisdiction_id);
                setOpen(false);
                setQuery('');
              }
            }}
            placeholder="Type to filter..."
            className="bg-white text-xs text-slate-700 outline-none min-w-[180px] pl-5 pr-2 py-0.5 rounded border border-slate-200"
            aria-label="Filter jurisdictions"
            autoFocus
          />
          {/* Dropdown */}
          {filtered.length > 0 && (
            <div className="absolute z-dropdown left-0 top-full mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-elevated">
              <button
                onClick={() => { setJurisdictionOverride(null); setOpen(false); setQuery(''); }}
                className={`block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 min-h-[44px] flex items-center ${
                  !selected ? 'font-semibold text-slate-800' : 'text-slate-600'
                }`}
              >
                {roleDefaultJurisdiction
                  ? `Role default: ${roleDefaultJurisdiction.jurisdiction_name}`
                  : 'Entity default (unscoped)'}
              </button>
              {filtered.map((j) => (
                <button
                  key={j.jurisdiction_id}
                  onClick={() => { setJurisdictionOverride(j.jurisdiction_id); setOpen(false); setQuery(''); }}
                  className={`block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 min-h-[44px] flex items-center ${
                    selected === j.jurisdiction_id ? 'font-semibold text-slate-800 bg-slate-50' : 'text-slate-600'
                  }`}
                >
                  {j.jurisdiction_name} ({j.parent_state})
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          className="bg-transparent text-xs text-slate-700 outline-none min-w-[180px] text-left cursor-pointer hover:text-slate-900"
          aria-label="Select jurisdiction"
        >
          {selectedLabel}
        </button>
      )}

      {overrideJurisdiction && (
        <button
          onClick={() => { clearJurisdictionOverride(); setQuery(''); }}
          className="inline-flex items-center rounded px-1.5 py-0.5 text-2xs text-slate-600 hover:bg-slate-200 min-h-[44px]"
          title="Clear jurisdiction override"
        >
          <X className="h-3 w-3 mr-1" aria-hidden="true" />
          Clear
        </button>
      )}
      {activeJurisdiction && (
        <span className="hidden xl:inline text-2xs text-slate-500">
          Scoped: {activeJurisdiction.jurisdiction_name}
        </span>
      )}
    </div>
  );
}
