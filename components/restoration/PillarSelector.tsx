'use client';

import React from 'react';
import { Droplets, CloudRain, Waves, GlassWater, Factory } from 'lucide-react';
import type { Pillar } from '@/components/treatment/treatmentData';

interface PillarConfig {
  id: Pillar;
  label: string;
  icon: typeof Droplets;
  color: string;
  bgActive: string;
  borderActive: string;
}

const PILLAR_CONFIG: PillarConfig[] = [
  { id: 'GW',    label: 'Groundwater',    icon: Droplets,    color: 'text-blue-700',   bgActive: 'bg-blue-50',    borderActive: 'border-blue-400' },
  { id: 'SW',    label: 'Stormwater',     icon: CloudRain,   color: 'text-sky-700',    bgActive: 'bg-sky-50',     borderActive: 'border-sky-400' },
  { id: 'SurfW', label: 'Surface Water',  icon: Waves,       color: 'text-cyan-700',   bgActive: 'bg-cyan-50',    borderActive: 'border-cyan-400' },
  { id: 'DW',    label: 'Drinking Water', icon: GlassWater,  color: 'text-teal-700',   bgActive: 'bg-teal-50',    borderActive: 'border-teal-400' },
  { id: 'WW',    label: 'Wastewater',     icon: Factory,     color: 'text-slate-700',  bgActive: 'bg-slate-100',  borderActive: 'border-slate-400' },
];

interface PillarSelectorProps {
  activePillars: Set<Pillar>;
  onToggle: (pillar: Pillar) => void;
}

export default function PillarSelector({ activePillars, onToggle }: PillarSelectorProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
        Pillars
      </span>
      {PILLAR_CONFIG.map(p => {
        const active = activePillars.has(p.id);
        const Icon = p.icon;
        return (
          <button
            key={p.id}
            onClick={() => onToggle(p.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-all ${
              active
                ? `${p.bgActive} ${p.borderActive} ${p.color}`
                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
            }`}
          >
            <Icon className="h-3 w-3" />
            <span>{p.label}</span>
            {active && (
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export { PILLAR_CONFIG };
