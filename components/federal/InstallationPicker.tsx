/* ------------------------------------------------------------------ */
/*  InstallationPicker — Shared installation dropdown for FMC cards    */
/* ------------------------------------------------------------------ */

'use client';

import React, { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import installationsData from '@/data/military-installations.json';

interface Installation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  branch: string;
  type: string;
  state: string | null;
}

interface InstallationPickerProps {
  selected: string | null;
  onSelect: (id: string) => void;
  /** Restrict to CONUS only (state !== null). Default true */
  conusOnly?: boolean;
}

const REGION_ORDER: Record<string, number> = {
  conus: 0,
  'indo-pacific': 1,
  europe: 2,
  'middle-east': 3,
  africa: 4,
};

const REGION_LABELS: Record<string, string> = {
  conus: 'CONUS',
  'indo-pacific': 'Indo-Pacific',
  europe: 'Europe',
  'middle-east': 'Middle East',
  africa: 'Africa',
};

export default function InstallationPicker({ selected, onSelect, conusOnly = true }: InstallationPickerProps) {
  const installations = installationsData as Installation[];

  const grouped = useMemo(() => {
    const filtered = conusOnly
      ? installations.filter(i => i.state !== null && i.type === 'installation')
      : installations.filter(i => i.type === 'installation');

    const groups = new Map<string, Installation[]>();
    for (const inst of filtered) {
      const region = inst.region ?? 'other';
      if (!groups.has(region)) groups.set(region, []);
      groups.get(region)!.push(inst);
    }
    // Sort within each group
    for (const list of groups.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    // Sort groups by order
    return [...groups.entries()].sort(
      ([a], [b]) => (REGION_ORDER[a] ?? 99) - (REGION_ORDER[b] ?? 99),
    );
  }, [conusOnly, installations]);

  return (
    <div className="flex items-center gap-2">
      <Building2 size={16} className="text-pin-text-secondary" />
      <span className="text-pin-sm font-semibold text-pin-text-secondary">Installation:</span>
      <select
        value={selected ?? ''}
        onChange={e => onSelect(e.target.value)}
        className="px-2.5 py-1.5 rounded-pin-md border border-pin-border-default bg-pin-bg-surface text-pin-sm min-w-[220px] cursor-pointer"
      >
        <option value="">Select an installation...</option>
        {grouped.map(([region, instList]) => (
          <optgroup key={region} label={REGION_LABELS[region] ?? region}>
            {instList.map(inst => (
              <option key={inst.id} value={inst.id}>
                {inst.name}{inst.state ? ` (${inst.state})` : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
