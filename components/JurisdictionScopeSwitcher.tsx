'use client';

import React from 'react';
import { MapPin, X } from 'lucide-react';
import { useJurisdictionContext } from '@/lib/jurisdiction-context';

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

  if (!canOverride && !activeJurisdiction) return null;
  if (availableJurisdictions.length === 0 && !activeJurisdiction) return null;

  const selected = overrideJurisdiction?.jurisdiction_id || '';

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
      <MapPin className="h-3.5 w-3.5 text-slate-500" />
      <select
        value={selected}
        onChange={(e) => setJurisdictionOverride(e.target.value || null)}
        className="bg-transparent text-xs text-slate-700 outline-none min-w-[180px]"
        title="Local context scope"
      >
        <option value="">
          {roleDefaultJurisdiction
            ? `Role default: ${roleDefaultJurisdiction.jurisdiction_name}`
            : 'Entity default (unscoped)'}
        </option>
        {availableJurisdictions.map((j) => (
          <option key={j.jurisdiction_id} value={j.jurisdiction_id}>
            {j.jurisdiction_name} ({j.parent_state})
          </option>
        ))}
      </select>
      {overrideJurisdiction && (
        <button
          onClick={clearJurisdictionOverride}
          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-200"
          title="Clear jurisdiction override"
        >
          <X className="h-3 w-3 mr-1" />
          Clear
        </button>
      )}
      {activeJurisdiction && (
        <span className="hidden xl:inline text-[10px] text-slate-500">
          Scoped: {activeJurisdiction.jurisdiction_name}
        </span>
      )}
    </div>
  );
}

