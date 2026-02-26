// =============================================================
// Resolution Modules — 27 Typed Strategy Definitions + Scoring
// =============================================================

export type CostTier = '$' | '$$' | '$$$' | '$$$$';
export type Timeline = '0-6 months' | '6-18 months' | '1-3 years' | '3-5 years' | '5+ years';

export interface StrategyModule {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  icon: string;
  dataSources: string[];
  primaryUsers: string[];
  outputs: string[];
  triggerCauses: string[];
  triggerConditions?: {
    tmdlNeeded?: boolean;
    minImpairedPct?: number;
    requireMultipleCauses?: boolean;
  };
  loadReductionRange: string;
  timeline: Timeline;
  costTier: CostTier;
  costNote: string;
  applicabilityBase: number;
}

export interface StrategyCategory {
  id: string;
  title: string;
  icon: string;
  color: string;
  modules: StrategyModule[];
}

export interface ScoredModule extends StrategyModule {
  applicabilityScore: number;
  matchedCauses: string[];
}

export interface ScoredCategory extends StrategyCategory {
  modules: ScoredModule[];
  topScore: number;
}

export interface ModuleScoringInput {
  topCauses: { cause: string; count: number }[];
  totalImpaired: number;
  totalWaterbodies: number;
  tmdlNeeded?: number;
  cat5?: number;
  cat4a?: number;
}

// ── Category 1: Source Control — Upstream BMPs (7 modules) ──

const SOURCE_CONTROL_MODULES: StrategyModule[] = [
  {
    id: '1.1', categoryId: 'source-control',
    title: 'Stormwater Retrofit Prioritizer',
    description: 'Ranks sub-catchments by impervious cover, pollutant loading, and downstream impairment severity to prioritize bioretention, permeable pavement, and green-roof retrofits where they deliver the greatest load reduction per dollar.',
    icon: '🏗️',
    dataSources: ['ATTAINS impairment data', 'NLCD impervious cover', 'MS4 outfall inventory', 'NWIS stream gauges'],
    primaryUsers: ['MS4 Managers', 'Stormwater Engineers', 'Municipal Planners'],
    outputs: ['Prioritized retrofit site list', 'Estimated load-reduction curves', 'Capital cost estimates per site'],
    triggerCauses: ['nutrient', 'nitrogen', 'phosphor', 'sediment', 'turbidity', 'metal', 'bacteria'],
    loadReductionRange: '40-80% TSS, 30-60% nutrients, 50-90% metals',
    timeline: '1-3 years', costTier: '$$$', costNote: '$100K-$2M per project',
    applicabilityBase: 30,
  },
  {
    id: '1.2', categoryId: 'source-control',
    title: 'Illicit Discharge Elimination Tracker',
    description: 'Maps every MS4 outfall, schedules dry-weather screening rounds, logs field results, and tracks source-tracing investigations through to confirmed elimination — generating the documentation trail MS4 permits require.',
    icon: '🔍',
    dataSources: ['MS4 outfall GIS layer', 'Dry-weather screening logs', 'ICIS-NPDES permit records', 'WQP field results'],
    primaryUsers: ['MS4 Managers', 'Field Inspectors', 'Permit Compliance Officers'],
    outputs: ['Outfall screening schedule', 'Source-trace investigation log', 'Annual IDDE compliance report'],
    triggerCauses: ['pathogen', 'bacteria', 'e. coli', 'fecal', 'enterococ', 'nutrient', 'oil', 'toxic'],
    loadReductionRange: 'Varies by source eliminated',
    timeline: '6-18 months', costTier: '$$', costNote: '$50K-$300K program cost',
    applicabilityBase: 25,
  },
  {
    id: '1.3', categoryId: 'source-control',
    title: 'Construction Erosion Control Monitor',
    description: 'Overlays active construction permits with downstream 303(d) segments to flag high-risk sites, schedules inspections, and tracks BMP installation and maintenance through project close-out.',
    icon: '🚧',
    dataSources: ['Construction permit database', 'ATTAINS 303(d) listings', 'NLCD land-cover change', 'Inspection records'],
    primaryUsers: ['Construction Inspectors', 'MS4 Managers', 'State Regulators'],
    outputs: ['High-risk site watchlist', 'Inspection schedule with results', 'Erosion BMP compliance tracker'],
    triggerCauses: ['sediment', 'turbidity', 'siltation', 'total suspended'],
    loadReductionRange: '60-90% TSS during construction',
    timeline: '0-6 months', costTier: '$', costNote: '$5K-$50K per site',
    applicabilityBase: 20,
  },
  {
    id: '1.4', categoryId: 'source-control',
    title: 'Agricultural Load Allocator',
    description: 'Combines USDA cropland data with edge-of-field monitoring and ATTAINS impairment causes to allocate nutrient and sediment reduction targets across agricultural parcels, recommending cover-crop, no-till, and buffer practices that meet TMDL wasteload allocations.',
    icon: '🌾',
    dataSources: ['USDA Cropland Data Layer', 'ATTAINS impairment data', 'NWIS nutrient monitoring', 'CEAP edge-of-field data'],
    primaryUsers: ['Agricultural Advisors', 'State NPS Program Staff', 'Conservation Districts'],
    outputs: ['Parcel-level load-reduction targets', 'BMP recommendation matrix', 'Cost-share eligibility report'],
    triggerCauses: ['nutrient', 'nitrogen', 'phosphor', 'sediment', 'siltation', 'pesticide', 'herbicide'],
    loadReductionRange: '25-50% nutrients, 40-70% sediment',
    timeline: '6-18 months', costTier: '$$', costNote: '$50-$200 per acre annually',
    applicabilityBase: 15,
  },
  {
    id: '1.5', categoryId: 'source-control',
    title: 'MS4 Outfall Screening Scheduler',
    description: 'Generates optimized dry-weather and wet-weather screening routes for MS4 outfalls based on drainage area risk scores, past violations, and downstream impairment status — ensuring permit-required screening frequencies are met efficiently.',
    icon: '📋',
    dataSources: ['MS4 outfall inventory', 'ATTAINS downstream impairments', 'ICIS-NPDES violation history', 'Weather forecast API'],
    primaryUsers: ['MS4 Managers', 'Field Crew Supervisors', 'Permit Compliance Officers'],
    outputs: ['Optimized screening route maps', 'Risk-ranked outfall priority list', 'Screening frequency compliance dashboard'],
    triggerCauses: ['pathogen', 'bacteria', 'nutrient', 'sediment', 'metal', 'oil'],
    loadReductionRange: 'Indirect — enables faster IDDE detection',
    timeline: '0-6 months', costTier: '$', costNote: '$10K-$50K program setup',
    applicabilityBase: 20,
  },
  {
    id: '1.6', categoryId: 'source-control',
    title: 'Industrial Pretreatment Compliance Tracker',
    description: 'Monitors Significant Industrial Users against categorical and local pretreatment limits, flags exceedances, tracks enforcement actions, and generates the reporting packages POTWs must submit to their control authority.',
    icon: '🏭',
    dataSources: ['ICIS-NPDES permit & DMR data', 'Local pretreatment limits', 'SIU self-monitoring reports', 'ECHO compliance history'],
    primaryUsers: ['POTW Pretreatment Coordinators', 'Industrial Compliance Officers', 'State Regulators'],
    outputs: ['SIU compliance status dashboard', 'Exceedance alert log', 'Annual pretreatment report package'],
    triggerCauses: ['metal', 'mercury', 'lead', 'copper', 'zinc', 'toxic', 'organic', 'pcb', 'pfas', 'ph'],
    loadReductionRange: 'Source-dependent, 50-95% at point of discharge',
    timeline: '1-3 years', costTier: '$$$', costNote: '$200K-$5M per facility',
    applicabilityBase: 10,
  },
  {
    id: '1.7', categoryId: 'source-control',
    title: 'Septic System Risk Mapper',
    description: 'Identifies high-risk septic areas by overlaying soil permeability, water-table depth, system age, and proximity to impaired waterways — then prioritizes inspections, pump-out enforcement, and sewer-conversion funding.',
    icon: '🏠',
    dataSources: ['County septic permits', 'SSURGO soil data', 'ATTAINS impairment data', 'Census housing-age data'],
    primaryUsers: ['County Health Departments', 'MS4 Managers', 'State NPS Program Staff'],
    outputs: ['Septic risk heat map', 'Inspection priority list', 'Sewer-conversion cost-benefit analysis'],
    triggerCauses: ['pathogen', 'bacteria', 'nutrient', 'nitrogen', 'nitrate', 'fecal'],
    loadReductionRange: '50-90% bacteria, 30-70% nitrogen',
    timeline: '1-3 years', costTier: '$$$', costNote: '$10K-$30K per system conversion',
    applicabilityBase: 10,
  },
];

// ── Category 2: Nature-Based Solutions ──

const NATURE_BASED_MODULES: StrategyModule[] = [
  {
    id: '2.1', categoryId: 'nature-based',
    title: 'Wetland Restoration & Construction',
    description: 'Restore degraded wetlands or construct treatment wetlands to provide natural filtration, nutrient uptake, and pathogen die-off in the watershed.',
    icon: '🌿',
    triggerCauses: ['nutrient', 'nitrogen', 'phosphor', 'pathogen', 'bacteria', 'sediment', 'metal'],
    loadReductionRange: '50-90% nutrients, 60-80% pathogens, 70-95% TSS',
    timeline: '1-3 years', costTier: '$$$', costNote: '$50K-$500K per acre',
    applicabilityBase: 25,
  },
  {
    id: '2.2', categoryId: 'nature-based',
    title: 'Riparian Buffer Establishment',
    description: 'Plant native vegetation buffers along streams and rivers to filter runoff, stabilize banks, provide shade, and reduce thermal pollution.',
    icon: '🌳',
    triggerCauses: ['nutrient', 'sediment', 'temperature', 'thermal', 'siltation'],
    loadReductionRange: '30-80% nutrients, 50-90% sediment, 2-5°C thermal reduction',
    timeline: '1-3 years', costTier: '$$', costNote: '$500-$3K per acre',
    applicabilityBase: 25,
  },
  {
    id: '2.3', categoryId: 'nature-based',
    title: 'Living Shoreline Installation',
    description: 'Use natural materials — oyster reefs, marsh plantings, coir logs — to stabilize shorelines while enhancing habitat and water quality.',
    icon: '🐚',
    triggerCauses: ['sediment', 'turbidity', 'habitat', 'erosion'],
    loadReductionRange: '40-70% shoreline erosion reduction',
    timeline: '6-18 months', costTier: '$$$', costNote: '$200-$1K per linear foot',
    applicabilityBase: 10,
  },
  {
    id: '2.4', categoryId: 'nature-based',
    title: 'Stream & Channel Restoration',
    description: 'Restore natural channel geometry, reconnect floodplains, and install grade controls to reduce erosion, improve habitat, and stabilize baseflow.',
    icon: '🏞️',
    triggerCauses: ['sediment', 'turbidity', 'habitat', 'biological', 'benthic', 'dissolved oxygen'],
    loadReductionRange: '50-80% bank erosion, habitat score improvement',
    timeline: '1-3 years', costTier: '$$$$', costNote: '$500K-$5M per mile',
    applicabilityBase: 15,
  },
  {
    id: '2.5', categoryId: 'nature-based',
    title: 'Floodplain Reconnection & Dam Removal',
    description: 'Remove obsolete dams and reconnect floodplains to restore natural hydrology, fish passage, sediment transport, and temperature regimes.',
    icon: '🌊',
    triggerCauses: ['flow', 'hydrologic', 'habitat', 'temperature', 'dissolved oxygen', 'sediment'],
    loadReductionRange: 'Hydrologic regime restoration, fish passage',
    timeline: '3-5 years', costTier: '$$$$', costNote: '$1M-$20M per project',
    applicabilityBase: 10,
  },
  {
    id: '2.6', categoryId: 'nature-based',
    title: 'Reforestation & Land Conservation',
    description: 'Acquire conservation easements and plant trees in critical watershed areas to reduce runoff, lower stream temperatures, and sequester carbon.',
    icon: '🌲',
    triggerCauses: ['nutrient', 'sediment', 'temperature', 'habitat'],
    loadReductionRange: '20-40% nutrient runoff, 2-5°C canopy cooling',
    timeline: '5+ years', costTier: '$$', costNote: '$1K-$10K per acre',
    applicabilityBase: 20,
  },
];

// ── Category 3: PEARL Treatment Accelerator ──

const PEARL_MODULES: StrategyModule[] = [
  {
    id: '3.1', categoryId: 'pearl-accelerator',
    title: 'PEARL ALIA — Biofiltration Deployment',
    description: 'Deploy PEARL ALIA biofiltration units at strategic outfalls and discharge points for rapid, high-efficiency removal of sediment, bacteria, and nutrients.',
    icon: '🔬',
    triggerCauses: ['nutrient', 'nitrogen', 'phosphor', 'sediment', 'turbidity', 'pathogen', 'bacteria', 'total suspended'],
    loadReductionRange: '88-95% TSS, 94% bacteria, 30-60% nutrients',
    timeline: '0-6 months', costTier: '$$$', costNote: '$50K-$500K per deployment',
    applicabilityBase: 30,
  },
  {
    id: '3.2', categoryId: 'pearl-accelerator',
    title: 'PEARL ALIA — Mechanical Treatment Integration',
    description: 'Integrate PEARL mechanical treatment modules for targeted removal of metals, PFAS, and other persistent organic pollutants at point sources.',
    icon: '⚙️',
    triggerCauses: ['metal', 'lead', 'copper', 'zinc', 'pfas', 'pcb', 'toxic', 'organic', 'mercury'],
    loadReductionRange: 'Pollutant-specific: 50-95% removal',
    timeline: '0-6 months', costTier: '$$$', costNote: '$100K-$1M per installation',
    applicabilityBase: 15,
  },
  {
    id: '3.3', categoryId: 'pearl-accelerator',
    title: 'PEARL ALIA — Real-Time Adaptive Control',
    description: 'Implement sensor-driven adaptive treatment controls that optimize dosing, flow routing, and treatment intensity based on real-time water quality data.',
    icon: '📡',
    triggerCauses: ['dissolved oxygen', 'chlorophyll', 'algae', 'cyanobacteria', 'nutrient', 'temperature'],
    loadReductionRange: 'Optimized treatment via continuous data feedback',
    timeline: '0-6 months', costTier: '$$', costNote: '$25K-$200K per system',
    applicabilityBase: 25,
  },
  {
    id: '3.4', categoryId: 'pearl-accelerator',
    title: 'PEARL ALIA — Pilot-to-Permanent Scaling',
    description: 'Transition successful PEARL pilot deployments to permanent installations with performance documentation for regulatory credit and TMDL compliance.',
    icon: '📈',
    triggerCauses: ['nutrient', 'sediment', 'pathogen', 'bacteria', 'metal', 'dissolved oxygen', 'temperature', 'turbidity'],
    triggerConditions: { tmdlNeeded: true, minImpairedPct: 20 },
    loadReductionRange: 'Phase-dependent, documented benchmarks',
    timeline: '6-18 months', costTier: '$$$$', costNote: '$500K-$5M scaling budget',
    applicabilityBase: 20,
  },
];

// ── Category 4: Community Engagement & Stewardship ──

const COMMUNITY_MODULES: StrategyModule[] = [
  {
    id: '4.1', categoryId: 'community',
    title: 'Volunteer Water Quality Monitoring',
    description: 'Establish citizen science monitoring programs to expand data coverage, engage communities, and provide early warning of water quality changes.',
    icon: '🧪',
    triggerCauses: ['nutrient', 'pathogen', 'bacteria', 'sediment', 'dissolved oxygen', 'temperature', 'metal'],
    loadReductionRange: 'N/A — data collection & coverage expansion',
    timeline: '0-6 months', costTier: '$', costNote: '$5K-$50K program startup',
    applicabilityBase: 35,
  },
  {
    id: '4.2', categoryId: 'community',
    title: 'Adopt-a-Stream / Adopt-a-Watershed Programs',
    description: 'Organize community groups to adopt local waterways for regular cleanup, monitoring, and stewardship activities.',
    icon: '🤝',
    triggerCauses: ['trash', 'debris', 'habitat', 'biological', 'bacteria'],
    loadReductionRange: 'Localized cleanup and stewardship impact',
    timeline: '0-6 months', costTier: '$', costNote: '$2K-$20K per program',
    applicabilityBase: 30,
  },
  {
    id: '4.3', categoryId: 'community',
    title: 'Stormwater Education & Outreach',
    description: 'Launch targeted public education campaigns on stormwater pollution prevention, lawn care practices, and proper waste disposal.',
    icon: '📢',
    triggerCauses: ['nutrient', 'sediment', 'pathogen', 'bacteria'],
    loadReductionRange: '5-15% behavioral load reduction',
    timeline: '6-18 months', costTier: '$', costNote: '$10K-$100K campaign cost',
    applicabilityBase: 30,
  },
  {
    id: '4.4', categoryId: 'community',
    title: 'Stakeholder Coalition Building',
    description: 'Convene watershed stakeholders — municipalities, utilities, NGOs, agriculture, industry — into a collaborative governance structure for coordinated action.',
    icon: '🏛️',
    triggerCauses: ['nutrient', 'sediment', 'pathogen', 'bacteria', 'metal', 'habitat'],
    loadReductionRange: 'Governance and coordination improvement',
    timeline: '6-18 months', costTier: '$', costNote: '$20K-$100K facilitation cost',
    applicabilityBase: 30,
  },
  {
    id: '4.5', categoryId: 'community',
    title: 'Environmental Justice & Equity Integration',
    description: 'Prioritize investments in underserved communities disproportionately impacted by water quality impairments using EJ screening tools.',
    icon: '⚖️',
    triggerCauses: ['nutrient', 'pathogen', 'bacteria', 'metal', 'toxic', 'pfas'],
    loadReductionRange: 'Equitable investment targeting',
    timeline: '1-3 years', costTier: '$$', costNote: '$50K-$500K program integration',
    applicabilityBase: 25,
  },
];

// ── Category 5: Regulatory & Planning ──

const REGULATORY_MODULES: StrategyModule[] = [
  {
    id: '5.1', categoryId: 'regulatory',
    title: 'TMDL Development & Implementation Tracking',
    description: 'Develop Total Maximum Daily Loads for impaired waters and establish tracking systems to monitor implementation progress and load reductions.',
    icon: '📋',
    triggerCauses: ['nutrient', 'sediment', 'pathogen', 'bacteria', 'metal', 'dissolved oxygen', 'temperature', 'turbidity'],
    triggerConditions: { tmdlNeeded: true },
    loadReductionRange: 'Regulatory load allocation framework',
    timeline: '1-3 years', costTier: '$$$', costNote: '$100K-$500K per TMDL',
    applicabilityBase: 15,
  },
  {
    id: '5.2', categoryId: 'regulatory',
    title: 'MS4 Permit Compliance Alignment',
    description: 'Align municipal stormwater management activities with MS4 permit requirements, establish BMP tracking, and document pollutant reduction credits.',
    icon: '📄',
    triggerCauses: ['nutrient', 'sediment', 'metal', 'pathogen', 'bacteria'],
    loadReductionRange: 'Permit-driven BMP tracking',
    timeline: '6-18 months', costTier: '$$', costNote: '$50K-$300K compliance program',
    applicabilityBase: 20,
  },
  {
    id: '5.3', categoryId: 'regulatory',
    title: 'Watershed-Based Plan Development (EPA 9-Element)',
    description: 'Develop a comprehensive EPA-approved 9-element watershed plan to establish 319 grant eligibility and coordinate restoration across jurisdictions.',
    icon: '🗺️',
    triggerCauses: ['nutrient', 'sediment', 'pathogen', 'bacteria', 'metal', 'habitat', 'dissolved oxygen'],
    loadReductionRange: 'Comprehensive planning framework, 319 eligibility',
    timeline: '1-3 years', costTier: '$$', costNote: '$100K-$400K plan development',
    applicabilityBase: 25,
  },
  {
    id: '5.4', categoryId: 'regulatory',
    title: 'Nutrient Trading & Credit Banking',
    description: 'Establish or participate in nutrient trading programs to achieve load reductions cost-effectively through market-based mechanisms between point and nonpoint sources.',
    icon: '💱',
    triggerCauses: ['nutrient', 'nitrogen', 'phosphor'],
    loadReductionRange: 'Cost-efficient load reduction via market mechanisms',
    timeline: '1-3 years', costTier: '$$', costNote: '$50K-$200K program setup',
    applicabilityBase: 10,
  },
];

// ── Category Definitions ──

export const ALL_CATEGORIES: StrategyCategory[] = [
  {
    id: 'source-control',
    title: 'Source Control — Upstream BMPs',
    icon: '🛡️',
    color: 'border-green-200 bg-green-50/30',
    modules: SOURCE_CONTROL_MODULES,
  },
  {
    id: 'nature-based',
    title: 'Nature-Based Solutions',
    icon: '🌿',
    color: 'border-emerald-200 bg-emerald-50/30',
    modules: NATURE_BASED_MODULES,
  },
  {
    id: 'pearl-accelerator',
    title: 'PEARL Treatment Accelerator',
    icon: '⚡',
    color: 'border-cyan-200 bg-cyan-50/30',
    modules: PEARL_MODULES,
  },
  {
    id: 'community',
    title: 'Community Engagement & Stewardship',
    icon: '👥',
    color: 'border-violet-200 bg-violet-50/30',
    modules: COMMUNITY_MODULES,
  },
  {
    id: 'regulatory',
    title: 'Regulatory & Planning',
    icon: '⚖️',
    color: 'border-indigo-200 bg-indigo-50/30',
    modules: REGULATORY_MODULES,
  },
];

// ── Scoring Engine ──

export function scoreModules(input: ModuleScoringInput): ScoredCategory[] {
  const { topCauses, totalImpaired, totalWaterbodies, tmdlNeeded, cat5 } = input;
  const impairmentPct = totalWaterbodies > 0 ? (totalImpaired / totalWaterbodies) * 100 : 0;
  const causesLower = topCauses.map(c => ({ cause: c.cause.toLowerCase(), count: c.count }));

  return ALL_CATEGORIES
    .map((cat): ScoredCategory => {
      const scoredModules = cat.modules.map((mod): ScoredModule => {
        let score = mod.applicabilityBase;
        const matchedCauses: string[] = [];

        // Cause-match bonus: 8-18 per match, capped at +50
        let causeBonus = 0;
        for (const trigger of mod.triggerCauses) {
          const triggerLower = trigger.toLowerCase();
          for (const c of causesLower) {
            if (c.cause.includes(triggerLower) || triggerLower.includes(c.cause)) {
              const points = 8 + Math.min(10, Math.ceil(c.count / 100));
              causeBonus += points;
              matchedCauses.push(c.cause);
              break; // one match per trigger keyword
            }
          }
        }
        score += Math.min(50, causeBonus);

        // Condition bonuses (up to +20)
        const conds = mod.triggerConditions;
        if (conds) {
          if (conds.tmdlNeeded && ((tmdlNeeded && tmdlNeeded > 0) || (cat5 && cat5 > 0))) {
            score += 10;
          }
          if (conds.minImpairedPct && impairmentPct >= conds.minImpairedPct) {
            score += 5;
          }
          if (conds.requireMultipleCauses && topCauses.length >= 3) {
            score += 5;
          }
        }

        return {
          ...mod,
          applicabilityScore: Math.min(100, score),
          matchedCauses: [...new Set(matchedCauses)],
        };
      });

      // Sort modules by score descending
      scoredModules.sort((a, b) => b.applicabilityScore - a.applicabilityScore);

      return {
        ...cat,
        modules: scoredModules,
        topScore: scoredModules[0]?.applicabilityScore ?? 0,
      };
    })
    // Sort categories by highest module score
    .sort((a, b) => b.topScore - a.topScore);
}
