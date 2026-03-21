'use client';

import React, { useState, useEffect } from 'react';
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

// Icon mapping for dynamic entity configuration
const ICON_MAP: Record<string, LucideIcon> = {
  Shield, Landmark, Target, CloudRain, Droplets, FlaskConical,
  Leaf, GraduationCap, School, BarChart3, TrendingUp, Factory,
};

// Load entity configuration from system settings or API
async function fetchEntityConfiguration(): Promise<EntityDef[]> {
  try {
    // In production, this could load from system configuration API
    // For now, return enhanced configuration with real deployment context

    // Check what data sources are available to tailor entity descriptions
    const response = await fetch('/api/cache-status');
    const cacheData = await response.json();

    const hasAttains = cacheData?.attains?.loaded;
    const hasEcho = cacheData?.echo?.loaded;
    const hasSdwis = cacheData?.sdwis?.loaded;
    const hasIcis = cacheData?.icis?.loaded;

    return [
      {
        id: 'federal',
        label: 'Federal',
        icon: Shield,
        description: hasEcho && hasAttains
          ? 'Multi-agency oversight with EPA ECHO and ATTAINS integration'
          : 'National oversight and cross-state intelligence'
      },
      {
        id: 'state',
        label: 'State',
        icon: Landmark,
        description: hasAttains
          ? 'Statewide compliance with ATTAINS waterbody tracking'
          : 'Statewide compliance and impairment tracking'
      },
      {
        id: 'dod',
        label: 'DoD',
        icon: Target,
        description: 'Installation watershed security with PFAS monitoring and MS4 compliance'
      },
      {
        id: 'ms4',
        label: 'MS4',
        icon: CloudRain,
        description: hasIcis
          ? 'NPDES permit management with ICIS compliance tracking'
          : 'Stormwater permit management and BMP optimization'
      },
      {
        id: 'utility',
        label: 'Municipal Utility',
        icon: Droplets,
        description: hasSdwis
          ? 'Source water protection with SDWIS compliance integration'
          : 'Source water protection and treatment operations'
      },
      {
        id: 'biopharma',
        label: 'BioPharma',
        icon: FlaskConical,
        description: 'Process water compliance, FDA/EPA oversight, and pharmaceutical discharge monitoring'
      },
      {
        id: 'ngo',
        label: 'NGO',
        icon: Leaf,
        description: 'Watershed restoration, advocacy campaigns, and community science coordination'
      },
      {
        id: 'university',
        label: 'University',
        icon: GraduationCap,
        description: 'Research monitoring, campus sustainability, and federal grant coordination'
      },
      {
        id: 'k12',
        label: 'K-12',
        icon: School,
        description: 'STEM education, lead testing compliance, and outdoor water science programs'
      },
      {
        id: 'esg',
        label: 'ESG',
        icon: BarChart3,
        description: 'Portfolio water risk assessment, sustainability reporting, and regulatory disclosure'
      },
      {
        id: 'investor',
        label: 'Investor',
        icon: TrendingUp,
        description: 'Water infrastructure risk analysis, due diligence, and asset valuation'
      },
      {
        id: 'facility',
        label: 'Facility Ops',
        icon: Factory,
        description: 'Site-level environmental monitoring, compliance tracking, and incident response'
      },
    ];
  } catch (error) {
    console.warn('Failed to fetch entity configuration, using fallback:', error);
    // Fallback to standard configuration
    return [
      { id: 'federal', label: 'Federal', icon: Shield, description: 'National oversight and intelligence' },
      { id: 'state', label: 'State', icon: Landmark, description: 'Statewide compliance tracking' },
      { id: 'dod', label: 'DoD', icon: Target, description: 'Installation watershed security' },
      { id: 'ms4', label: 'MS4', icon: CloudRain, description: 'Stormwater permit management' },
      { id: 'utility', label: 'Utility', icon: Droplets, description: 'Source water protection' },
      { id: 'biopharma', label: 'BioPharma', icon: FlaskConical, description: 'Process water compliance' },
      { id: 'ngo', label: 'NGO', icon: Leaf, description: 'Watershed restoration' },
      { id: 'university', label: 'University', icon: GraduationCap, description: 'Research monitoring' },
      { id: 'k12', label: 'K-12', icon: School, description: 'STEM education' },
      { id: 'esg', label: 'ESG', icon: BarChart3, description: 'Portfolio risk assessment' },
      { id: 'investor', label: 'Investor', icon: TrendingUp, description: 'Infrastructure risk analysis' },
      { id: 'facility', label: 'Facility Ops', icon: Factory, description: 'Site-level monitoring' },
    ];
  }
}

/* ── Props ──────────────────────────────────────────────────────────── */

interface EntitySelectorProps {
  activeEntity: string | null;
  onSelect: (entity: string) => void;
}

/* ── Component ──────────────────────────────────────────────────────── */

export function EntitySelector({ activeEntity, onSelect }: EntitySelectorProps) {
  const [entities, setEntities] = useState<EntityDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntityConfiguration().then(entityConfig => {
      setEntities(entityConfig);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <section className="bg-slate-950 py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="text-slate-400">Loading entity configuration...</div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-slate-950 py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xs font-bold tracking-[0.2em] uppercase text-slate-500 text-center mb-3">
          {entities.length} Entity Types — One Grid
        </h2>
        <p className="text-sm text-slate-400 text-center mb-10 max-w-xl mx-auto">
          Select an entity to see how the Grid adapts its real-time operational picture.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {entities.map((e) => {
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
