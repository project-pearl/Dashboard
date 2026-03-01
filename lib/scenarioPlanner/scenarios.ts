// ─── Scenario Catalog ────────────────────────────────────────────────────────
// 4 categories, 2 representative events each (8 total for MVP).

import type { ScenarioDefinition, ScenarioCategory } from './types';

export const SCENARIO_CATEGORIES: { id: ScenarioCategory; label: string; icon: string; color: string }[] = [
  { id: 'infrastructure', label: 'Infrastructure', icon: 'Wrench', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { id: 'natural-event', label: 'Natural Events', icon: 'Cloud', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'contamination', label: 'Contamination', icon: 'Biohazard', color: 'text-red-600 bg-red-50 border-red-200' },
  { id: 'regulatory', label: 'Regulatory', icon: 'Scale', color: 'text-purple-600 bg-purple-50 border-purple-200' },
];

export const SCENARIOS: ScenarioDefinition[] = [
  // ── Infrastructure ──
  {
    id: 'water-main-break',
    label: 'Water Main Break',
    category: 'infrastructure',
    icon: 'Droplets',
    description: 'Catastrophic failure of a transmission or distribution water main, requiring emergency repair, boil-water advisory, and service restoration.',
    parameters: [
      {
        id: 'pipe-diameter',
        label: 'Pipe Diameter',
        type: 'select',
        options: [
          { value: '8', label: '8" (residential)' },
          { value: '16', label: '16" (collector)' },
          { value: '24', label: '24" (transmission)' },
          { value: '36', label: '36" (major trunk)' },
        ],
        default: '16',
      },
      {
        id: 'duration-hours',
        label: 'Outage Duration',
        type: 'select',
        options: [
          { value: '6', label: '6 hours' },
          { value: '24', label: '24 hours' },
          { value: '72', label: '72 hours (3 days)' },
          { value: '168', label: '168 hours (1 week)' },
        ],
        default: '24',
      },
      {
        id: 'location-type',
        label: 'Location Type',
        type: 'select',
        options: [
          { value: 'residential', label: 'Residential neighborhood' },
          { value: 'commercial', label: 'Commercial district' },
          { value: 'arterial', label: 'Major road/arterial' },
          { value: 'critical', label: 'Near hospital/school' },
        ],
        default: 'residential',
      },
    ],
    applicableRoles: ['ms4-manager', 'utility-director', 'city-manager', 'state-regulator', 'insurer', 'consultant'],
  },
  {
    id: 'sso-overflow',
    label: 'Sanitary Sewer Overflow',
    category: 'infrastructure',
    icon: 'AlertTriangle',
    description: 'Unpermitted discharge of raw sewage from the sanitary sewer system due to blockage, capacity exceedance, or pump failure.',
    parameters: [
      {
        id: 'volume-gallons',
        label: 'Estimated Volume',
        type: 'select',
        options: [
          { value: '10000', label: '10,000 gal (minor)' },
          { value: '100000', label: '100,000 gal (moderate)' },
          { value: '1000000', label: '1M gal (major)' },
          { value: '10000000', label: '10M gal (catastrophic)' },
        ],
        default: '100000',
      },
      {
        id: 'receiving-water',
        label: 'Receiving Water',
        type: 'select',
        options: [
          { value: 'storm-drain', label: 'Storm drain (contained)' },
          { value: 'stream', label: 'Stream/creek' },
          { value: 'river', label: 'Major river' },
          { value: 'bay-estuary', label: 'Bay/estuary/coast' },
        ],
        default: 'stream',
      },
      {
        id: 'cause',
        label: 'Primary Cause',
        type: 'select',
        options: [
          { value: 'blockage', label: 'Grease/debris blockage' },
          { value: 'capacity', label: 'Wet-weather capacity' },
          { value: 'pump-failure', label: 'Pump station failure' },
          { value: 'pipe-collapse', label: 'Pipe collapse/break' },
        ],
        default: 'capacity',
      },
    ],
    applicableRoles: ['ms4-manager', 'utility-director', 'city-manager', 'state-regulator', 'consultant'],
  },

  // ── Natural Events ──
  {
    id: 'hurricane-storm-surge',
    label: 'Hurricane / Storm Surge',
    category: 'natural-event',
    icon: 'Wind',
    description: 'Major tropical cyclone making landfall, bringing storm surge, flooding, and infrastructure damage to water/wastewater systems.',
    parameters: [
      {
        id: 'storm-category',
        label: 'Storm Category',
        type: 'select',
        options: [
          { value: '1', label: 'Category 1 (74-95 mph)' },
          { value: '2', label: 'Category 2 (96-110 mph)' },
          { value: '3', label: 'Category 3 (111-129 mph)' },
          { value: '4', label: 'Category 4 (130-156 mph)' },
        ],
        default: '2',
      },
      {
        id: 'surge-height',
        label: 'Storm Surge',
        type: 'select',
        options: [
          { value: '3', label: '3 ft' },
          { value: '6', label: '6 ft' },
          { value: '10', label: '10 ft' },
          { value: '15', label: '15 ft' },
        ],
        default: '6',
      },
      {
        id: 'coastal-distance',
        label: 'Distance from Coast',
        type: 'select',
        options: [
          { value: 'coastal', label: 'Coastal (< 5 mi)' },
          { value: 'near-coastal', label: 'Near-coastal (5-25 mi)' },
          { value: 'inland', label: 'Inland (> 25 mi)' },
        ],
        default: 'near-coastal',
      },
    ],
    applicableRoles: ['ms4-manager', 'utility-director', 'city-manager', 'state-regulator', 'insurer', 'consultant'],
  },
  {
    id: 'drought',
    label: 'Prolonged Drought',
    category: 'natural-event',
    icon: 'Sun',
    description: 'Extended period of below-normal precipitation affecting water supply, source water quality, and ecosystem health.',
    parameters: [
      {
        id: 'severity',
        label: 'Drought Severity',
        type: 'select',
        options: [
          { value: 'moderate', label: 'D2 — Moderate' },
          { value: 'severe', label: 'D3 — Severe' },
          { value: 'extreme', label: 'D4 — Extreme' },
          { value: 'exceptional', label: 'D5 — Exceptional' },
        ],
        default: 'severe',
      },
      {
        id: 'duration-months',
        label: 'Duration',
        type: 'select',
        options: [
          { value: '3', label: '3 months' },
          { value: '6', label: '6 months' },
          { value: '12', label: '12 months' },
          { value: '24', label: '24 months' },
        ],
        default: '6',
      },
      {
        id: 'source-type',
        label: 'Primary Water Source',
        type: 'select',
        options: [
          { value: 'reservoir', label: 'Surface reservoir' },
          { value: 'river', label: 'River intake' },
          { value: 'groundwater', label: 'Groundwater wells' },
          { value: 'mixed', label: 'Mixed sources' },
        ],
        default: 'mixed',
      },
    ],
    applicableRoles: ['utility-director', 'city-manager', 'state-regulator', 'consultant'],
  },

  // ── Contamination ──
  {
    id: 'pfas-detection',
    label: 'PFAS Detection',
    category: 'contamination',
    icon: 'FlaskConical',
    description: 'Detection of per- and polyfluoroalkyl substances (PFAS) above proposed MCLs in drinking water supply or discharge.',
    parameters: [
      {
        id: 'concentration',
        label: 'PFAS Level (ppt)',
        type: 'select',
        options: [
          { value: '4', label: '4 ppt (at proposed MCL)' },
          { value: '10', label: '10 ppt (2.5× MCL)' },
          { value: '50', label: '50 ppt (well above MCL)' },
          { value: '200', label: '200 ppt (severely elevated)' },
        ],
        default: '10',
      },
      {
        id: 'media',
        label: 'Detected In',
        type: 'select',
        options: [
          { value: 'drinking-water', label: 'Drinking water supply' },
          { value: 'wastewater', label: 'Wastewater effluent' },
          { value: 'stormwater', label: 'Stormwater runoff' },
          { value: 'groundwater', label: 'Groundwater wells' },
        ],
        default: 'drinking-water',
      },
      {
        id: 'population-served',
        label: 'Population Served',
        type: 'select',
        options: [
          { value: '5000', label: '5,000 (small system)' },
          { value: '25000', label: '25,000 (medium system)' },
          { value: '100000', label: '100,000 (large system)' },
          { value: '500000', label: '500,000 (metro system)' },
        ],
        default: '25000',
      },
    ],
    applicableRoles: ['ms4-manager', 'utility-director', 'city-manager', 'state-regulator', 'insurer', 'consultant'],
  },
  {
    id: 'chemical-spill',
    label: 'Chemical Spill',
    category: 'contamination',
    icon: 'Skull',
    description: 'Accidental or intentional release of hazardous chemicals into a waterbody or water supply intake zone.',
    parameters: [
      {
        id: 'chemical-type',
        label: 'Chemical Type',
        type: 'select',
        options: [
          { value: 'petroleum', label: 'Petroleum/fuel' },
          { value: 'industrial', label: 'Industrial solvent' },
          { value: 'agricultural', label: 'Agricultural chemical' },
          { value: 'unknown', label: 'Unknown substance' },
        ],
        default: 'petroleum',
      },
      {
        id: 'volume-gallons',
        label: 'Spill Volume',
        type: 'select',
        options: [
          { value: '100', label: '100 gal (minor)' },
          { value: '5000', label: '5,000 gal (moderate)' },
          { value: '50000', label: '50,000 gal (major)' },
          { value: '500000', label: '500,000 gal (catastrophic)' },
        ],
        default: '5000',
      },
      {
        id: 'proximity',
        label: 'Proximity to Intake',
        type: 'select',
        options: [
          { value: 'upstream-close', label: 'Upstream, < 1 mile' },
          { value: 'upstream-far', label: 'Upstream, 1-10 miles' },
          { value: 'downstream', label: 'Downstream of intake' },
          { value: 'groundwater', label: 'Groundwater pathway' },
        ],
        default: 'upstream-far',
      },
    ],
    applicableRoles: ['ms4-manager', 'utility-director', 'city-manager', 'state-regulator', 'insurer', 'consultant'],
  },

  // ── Regulatory ──
  {
    id: 'new-tmdl',
    label: 'New TMDL Imposed',
    category: 'regulatory',
    icon: 'FileText',
    description: 'EPA or state agency establishes a new Total Maximum Daily Load for a waterbody, requiring point-source load reductions.',
    parameters: [
      {
        id: 'parameter',
        label: 'TMDL Parameter',
        type: 'select',
        options: [
          { value: 'nitrogen', label: 'Total Nitrogen' },
          { value: 'phosphorus', label: 'Total Phosphorus' },
          { value: 'sediment', label: 'Sediment/TSS' },
          { value: 'bacteria', label: 'Bacteria (E. coli)' },
        ],
        default: 'nitrogen',
      },
      {
        id: 'reduction-percent',
        label: 'Required Reduction',
        type: 'select',
        options: [
          { value: '20', label: '20% reduction' },
          { value: '40', label: '40% reduction' },
          { value: '60', label: '60% reduction' },
          { value: '80', label: '80% reduction' },
        ],
        default: '40',
      },
      {
        id: 'compliance-timeline',
        label: 'Compliance Timeline',
        type: 'select',
        options: [
          { value: '3', label: '3 years' },
          { value: '5', label: '5 years' },
          { value: '10', label: '10 years' },
          { value: '20', label: '20 years (phased)' },
        ],
        default: '5',
      },
    ],
    applicableRoles: ['ms4-manager', 'utility-director', 'city-manager', 'state-regulator', 'consultant'],
  },
  {
    id: 'permit-limit-tightening',
    label: 'Permit Limit Tightening',
    category: 'regulatory',
    icon: 'ShieldAlert',
    description: 'NPDES permit renewal includes significantly tighter effluent limits, requiring treatment upgrades or process changes.',
    parameters: [
      {
        id: 'parameter',
        label: 'Tightened Parameter',
        type: 'select',
        options: [
          { value: 'nitrogen', label: 'Total Nitrogen' },
          { value: 'phosphorus', label: 'Total Phosphorus' },
          { value: 'ammonia', label: 'Ammonia' },
          { value: 'metals', label: 'Heavy Metals' },
        ],
        default: 'nitrogen',
      },
      {
        id: 'current-limit',
        label: 'Current Limit',
        type: 'select',
        options: [
          { value: 'high', label: 'High (monthly avg 10+ mg/L)' },
          { value: 'moderate', label: 'Moderate (5-10 mg/L)' },
          { value: 'low', label: 'Low (2-5 mg/L)' },
        ],
        default: 'moderate',
      },
      {
        id: 'new-limit',
        label: 'New Limit',
        type: 'select',
        options: [
          { value: 'moderate', label: 'Moderate (5-10 mg/L)' },
          { value: 'low', label: 'Low (2-5 mg/L)' },
          { value: 'very-low', label: 'Very Low (< 2 mg/L)' },
          { value: 'lod', label: 'LOD/Technology-based' },
        ],
        default: 'low',
      },
    ],
    applicableRoles: ['utility-director', 'city-manager', 'state-regulator', 'consultant'],
  },
];

export function getScenariosByCategory(category: ScenarioCategory): ScenarioDefinition[] {
  return SCENARIOS.filter(s => s.category === category);
}

export function getScenarioById(id: string): ScenarioDefinition | undefined {
  return SCENARIOS.find(s => s.id === id);
}
