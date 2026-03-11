'use client';

import React from 'react';
import {
  Shield,
  Landmark,
  Target,
  CloudRain,
  Droplets,
  FlaskConical,
  Leaf,
  GraduationCap,
  School,
  BarChart3,
  TrendingUp,
  Factory,
  type LucideIcon,
} from 'lucide-react';

/* ── Entity definitions ─────────────────────────────────────────────── */

interface EntityDef {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

const ENTITIES: EntityDef[] = [
  { id: 'federal',    label: 'Federal',           icon: Shield,        description: 'National oversight and cross-state intelligence' },
  { id: 'state',      label: 'State',             icon: Landmark,      description: 'Statewide compliance and impairment tracking' },
  { id: 'dod',        label: 'DoD',               icon: Target,        description: 'Installation watershed security and MS4 compliance' },
  { id: 'ms4',        label: 'MS4',               icon: CloudRain,     description: 'Stormwater permit management and BMP optimization' },
  { id: 'utility',    label: 'Municipal Utility',  icon: Droplets,      description: 'Source water protection and treatment operations' },
  { id: 'biopharma',  label: 'BioPharma',         icon: FlaskConical,  description: 'Process water compliance and discharge monitoring' },
  { id: 'ngo',        label: 'NGO',               icon: Leaf,          description: 'Watershed restoration and community advocacy' },
  { id: 'university', label: 'University',        icon: GraduationCap, description: 'Research monitoring and campus sustainability' },
  { id: 'k12',        label: 'K-12',              icon: School,        description: 'STEM education and outdoor water science' },
  { id: 'esg',        label: 'ESG',               icon: BarChart3,     description: 'Portfolio water risk and sustainability reporting' },
  { id: 'investor',   label: 'Investor',          icon: TrendingUp,    description: 'Water infrastructure risk and due diligence' },
  { id: 'facility',   label: 'Facility Ops',      icon: Factory,       description: 'Site-level environmental monitoring and compliance' },
];

/* ── Props ──────────────────────────────────────────────────────────── */

interface EntitySelectorProps {
  activeEntity: string | null;
  onSelect: (entity: string) => void;
}

/* ── Component ──────────────────────────────────────────────────────── */

export function EntitySelector({ activeEntity, onSelect }: EntitySelectorProps) {
  return (
    <section className="bg-slate-950 py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xs font-bold tracking-[0.2em] uppercase text-slate-500 text-center mb-3">
          12 Entity Types — One Grid
        </h2>
        <p className="text-sm text-slate-400 text-center mb-10 max-w-xl mx-auto">
          Select an entity to see how the Grid adapts its operational picture.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {ENTITIES.map((e) => {
            const Icon = e.icon;
            const isActive = activeEntity === e.id;
            return (
              <button
                key={e.id}
                onClick={() => onSelect(e.id)}
                className={`group relative p-4 rounded-xl border text-left transition-all duration-200
                  ${isActive
                    ? 'bg-slate-800 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-900/60 border-slate-700/40 hover:bg-slate-800/80 hover:border-slate-600'
                  }`}
              >
                <Icon
                  className={`w-6 h-6 mb-2 transition-colors ${
                    isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                />
                <div className={`text-sm font-semibold mb-1 ${isActive ? 'text-white' : 'text-slate-200'}`}>
                  {e.label}
                </div>
                <div className="text-xs text-slate-500 leading-snug">
                  {e.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
