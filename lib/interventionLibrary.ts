// lib/interventionLibrary.ts
// Intervention efficacy database for restoration planning
// 9 intervention types with removal rates, cost models, ramp-up curves, and tidal adjustments
// Pure data — zero React, zero side effects

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConfidenceRange {
  min: number;
  expected: number;
  max: number;
}

export type PollutantId = 'TN' | 'TP' | 'TSS' | 'bacteria' | 'DO_improvement';

export type WaterbodyCategory = 'estuary' | 'tidal_river' | 'freshwater' | 'coastal' | 'lake';

export type RampFunction = 'linear' | 'logarithmic' | 'step';

export interface RampUpCurve {
  monthsToMinEfficacy: number;
  monthsToFullEfficacy: number;
  rampFunction: RampFunction;
}

export interface CostModel {
  capitalPerUnit: ConfidenceRange;   // $ per unit
  annualOMPerUnit: ConfidenceRange;  // $ per unit per year
  unitLabel: string;                 // e.g. 'unit', 'acre', 'project'
  /** Regional cost multiplier keys — caller applies if needed */
  regionalNotes?: string;
}

export interface TidalAdjustment {
  flushingRateMultiplier: number;    // 0–1: high flushing reduces contact time
  depthMultiplier: number;           // deeper = less effective for some interventions
  salinityMultiplier: number;        // high salinity affects biological interventions
}

export interface InterventionType {
  id: string;
  name: string;
  category: 'treatment' | 'nature-based' | 'infrastructure' | 'market' | 'management' | 'emerging';
  description: string;
  removalRates: Record<PollutantId, ConfidenceRange | null>;
  tidalAdjustment: TidalAdjustment | null;
  cost: CostModel;
  rampUp: RampUpCurve;
  compatibleWaterbodies: WaterbodyCategory[];
  requiresLand: boolean;
  requiresPermitting: boolean;
  citations: string[];
}

// ─── Intervention Library ───────────────────────────────────────────────────

export const INTERVENTION_LIBRARY: InterventionType[] = [
  // 1. PEARL ALIA Treatment
  {
    id: 'pearl-alia',
    name: 'PEARL ALIA Treatment',
    category: 'treatment',
    description: 'Autonomous Living Infrastructure Array — modular biofiltration + pre-screening + UV + ion exchange. Milton FL pilot demonstrated 88-95% TSS and 94% bacteria removal.',
    removalRates: {
      TN:             { min: 0.30, expected: 0.50, max: 0.70 },
      TP:             { min: 0.25, expected: 0.45, max: 0.65 },
      TSS:            { min: 0.88, expected: 0.92, max: 0.95 },
      bacteria:       { min: 0.90, expected: 0.94, max: 0.97 },
      DO_improvement: { min: 0.05, expected: 0.10, max: 0.20 },
    },
    tidalAdjustment: {
      flushingRateMultiplier: 0.85,
      depthMultiplier: 1.0,
      salinityMultiplier: 0.95,
    },
    cost: {
      capitalPerUnit: { min: 150_000, expected: 300_000, max: 500_000 },
      annualOMPerUnit: { min: 25_000, expected: 50_000, max: 80_000 },
      unitLabel: 'unit',
      regionalNotes: 'Milton FL pilot basis; costs scale with treatment volume',
    },
    rampUp: {
      monthsToMinEfficacy: 1,
      monthsToFullEfficacy: 3,
      rampFunction: 'logarithmic',
    },
    compatibleWaterbodies: ['estuary', 'tidal_river', 'freshwater', 'coastal', 'lake'],
    requiresLand: false,
    requiresPermitting: true,
    citations: ['Milton FL PEARL Pilot 2024', 'ALIA Treatment Train Spec v2.1'],
  },

  // 2. Oyster Reef Restoration
  {
    id: 'oyster-reef',
    name: 'Oyster Reef Restoration',
    category: 'nature-based',
    description: 'Establish or enhance oyster reef habitat. Each adult oyster filters ~50 gal/day, removing suspended solids and nutrients. Provides shoreline protection and fish nursery habitat.',
    removalRates: {
      TN:             { min: 0.05, expected: 0.10, max: 0.15 },
      TP:             { min: 0.03, expected: 0.08, max: 0.12 },
      TSS:            { min: 0.10, expected: 0.20, max: 0.30 },
      bacteria:       null,
      DO_improvement: { min: 0.02, expected: 0.05, max: 0.10 },
    },
    tidalAdjustment: {
      flushingRateMultiplier: 1.0,
      depthMultiplier: 0.8,
      salinityMultiplier: 1.0,
    },
    cost: {
      capitalPerUnit: { min: 50_000, expected: 100_000, max: 200_000 },
      annualOMPerUnit: { min: 2_000, expected: 5_000, max: 10_000 },
      unitLabel: 'acre',
    },
    rampUp: {
      monthsToMinEfficacy: 24,
      monthsToFullEfficacy: 36,
      rampFunction: 'logarithmic',
    },
    compatibleWaterbodies: ['estuary', 'tidal_river', 'coastal'],
    requiresLand: false,
    requiresPermitting: true,
    citations: ['NOAA Oyster Reef Restoration Guidelines', 'Chesapeake Bay Foundation Reef Data'],
  },

  // 3. Riparian Buffer
  {
    id: 'riparian-buffer',
    name: 'Riparian Buffer',
    category: 'nature-based',
    description: 'Forested and vegetated streamside zones (min 100ft recommended). Filters overland flow, stabilizes banks, moderates temperature. USDA NRCS Conservation Practice Standard 391.',
    removalRates: {
      TN:             { min: 0.30, expected: 0.55, max: 0.80 },
      TP:             { min: 0.30, expected: 0.55, max: 0.80 },
      TSS:            { min: 0.50, expected: 0.70, max: 0.90 },
      bacteria:       { min: 0.20, expected: 0.40, max: 0.60 },
      DO_improvement: { min: 0.02, expected: 0.05, max: 0.10 },
    },
    tidalAdjustment: null,
    cost: {
      capitalPerUnit: { min: 500, expected: 1_500, max: 3_000 },
      annualOMPerUnit: { min: 50, expected: 150, max: 300 },
      unitLabel: 'acre',
    },
    rampUp: {
      monthsToMinEfficacy: 12,
      monthsToFullEfficacy: 36,
      rampFunction: 'logarithmic',
    },
    compatibleWaterbodies: ['freshwater', 'lake', 'estuary', 'tidal_river'],
    requiresLand: true,
    requiresPermitting: false,
    citations: ['USDA NRCS CPS 391', 'EPA Riparian Buffer Literature Review 2005'],
  },

  // 4. Constructed Wetlands
  {
    id: 'constructed-wetland',
    name: 'Constructed Wetlands',
    category: 'nature-based',
    description: 'Engineered wetland cells for nutrient uptake, pathogen die-off, and sediment settling. Provides habitat co-benefits. 50-90% nutrient removal at scale.',
    removalRates: {
      TN:             { min: 0.40, expected: 0.60, max: 0.80 },
      TP:             { min: 0.35, expected: 0.55, max: 0.75 },
      TSS:            { min: 0.60, expected: 0.80, max: 0.95 },
      bacteria:       { min: 0.50, expected: 0.70, max: 0.90 },
      DO_improvement: { min: 0.05, expected: 0.10, max: 0.20 },
    },
    tidalAdjustment: {
      flushingRateMultiplier: 0.7,
      depthMultiplier: 0.9,
      salinityMultiplier: 0.8,
    },
    cost: {
      capitalPerUnit: { min: 50_000, expected: 200_000, max: 500_000 },
      annualOMPerUnit: { min: 3_000, expected: 10_000, max: 25_000 },
      unitLabel: 'acre',
    },
    rampUp: {
      monthsToMinEfficacy: 6,
      monthsToFullEfficacy: 18,
      rampFunction: 'logarithmic',
    },
    compatibleWaterbodies: ['freshwater', 'lake', 'estuary', 'tidal_river'],
    requiresLand: true,
    requiresPermitting: true,
    citations: ['EPA Constructed Wetlands Treatment of Municipal Wastewaters', 'USACE Wetland Design Manual'],
  },

  // 5. Stormwater BMP Retrofits
  {
    id: 'stormwater-bmp',
    name: 'Stormwater BMP Retrofits',
    category: 'infrastructure',
    description: 'Bioretention, permeable pavement, detention/retention, green roofs. Captures and treats stormwater runoff before reaching waterbodies. MS4 permit credit eligible.',
    removalRates: {
      TN:             { min: 0.20, expected: 0.35, max: 0.50 },
      TP:             { min: 0.20, expected: 0.35, max: 0.50 },
      TSS:            { min: 0.40, expected: 0.60, max: 0.80 },
      bacteria:       { min: 0.15, expected: 0.30, max: 0.50 },
      DO_improvement: null,
    },
    tidalAdjustment: null,
    cost: {
      capitalPerUnit: { min: 100_000, expected: 500_000, max: 2_000_000 },
      annualOMPerUnit: { min: 5_000, expected: 20_000, max: 50_000 },
      unitLabel: 'project',
    },
    rampUp: {
      monthsToMinEfficacy: 1,
      monthsToFullEfficacy: 6,
      rampFunction: 'linear',
    },
    compatibleWaterbodies: ['freshwater', 'lake', 'estuary', 'tidal_river', 'coastal'],
    requiresLand: true,
    requiresPermitting: true,
    citations: ['EPA BMP Performance Summary', 'International BMP Database 2020'],
  },

  // 6. Nutrient Trading/Offsets
  {
    id: 'nutrient-trading',
    name: 'Nutrient Trading/Offsets',
    category: 'market',
    description: 'Purchase nutrient credits from upstream sources achieving surplus reductions. Cost-effective for meeting TMDL wasteload allocations when on-site reduction is expensive.',
    removalRates: {
      TN:             { min: 0.10, expected: 0.30, max: 0.60 },
      TP:             { min: 0.10, expected: 0.30, max: 0.60 },
      TSS:            null,
      bacteria:       null,
      DO_improvement: null,
    },
    tidalAdjustment: null,
    cost: {
      capitalPerUnit: { min: 5, expected: 15, max: 30 },
      annualOMPerUnit: { min: 2, expected: 8, max: 15 },
      unitLabel: 'lb credit',
      regionalNotes: 'Credit prices vary by market (Chesapeake Bay, Long Island Sound, etc.)',
    },
    rampUp: {
      monthsToMinEfficacy: 0,
      monthsToFullEfficacy: 1,
      rampFunction: 'step',
    },
    compatibleWaterbodies: ['freshwater', 'lake', 'estuary', 'tidal_river', 'coastal'],
    requiresLand: false,
    requiresPermitting: false,
    citations: ['EPA Water Quality Trading Policy 2003', 'Chesapeake Bay Nutrient Trading Program'],
  },

  // 7. Sediment Management
  {
    id: 'sediment-mgmt',
    name: 'Sediment Management',
    category: 'management',
    description: 'Dredging, erosion control, bank stabilization, and sediment trapping. Directly removes accumulated sediment load and prevents new deposition.',
    removalRates: {
      TN:             { min: 0.05, expected: 0.15, max: 0.25 },
      TP:             { min: 0.10, expected: 0.20, max: 0.35 },
      TSS:            { min: 0.30, expected: 0.50, max: 0.70 },
      bacteria:       null,
      DO_improvement: { min: 0.02, expected: 0.05, max: 0.10 },
    },
    tidalAdjustment: {
      flushingRateMultiplier: 0.9,
      depthMultiplier: 0.7,
      salinityMultiplier: 1.0,
    },
    cost: {
      capitalPerUnit: { min: 50_000, expected: 200_000, max: 500_000 },
      annualOMPerUnit: { min: 5_000, expected: 15_000, max: 30_000 },
      unitLabel: 'acre',
    },
    rampUp: {
      monthsToMinEfficacy: 1,
      monthsToFullEfficacy: 6,
      rampFunction: 'step',
    },
    compatibleWaterbodies: ['freshwater', 'lake', 'estuary', 'tidal_river', 'coastal'],
    requiresLand: false,
    requiresPermitting: true,
    citations: ['USACE Dredging Handbook', 'EPA Contaminated Sediment Remediation Guidance'],
  },

  // 8. SAV Restoration
  {
    id: 'sav-restoration',
    name: 'SAV Restoration',
    category: 'nature-based',
    description: 'Submerged Aquatic Vegetation restoration — eelgrass, widgeon grass, wild celery. Natural biofilters that stabilize sediment, improve clarity, provide habitat, and sequester nutrients.',
    removalRates: {
      TN:             { min: 0.05, expected: 0.12, max: 0.20 },
      TP:             { min: 0.03, expected: 0.08, max: 0.15 },
      TSS:            { min: 0.10, expected: 0.18, max: 0.25 },
      bacteria:       null,
      DO_improvement: { min: 0.05, expected: 0.10, max: 0.15 },
    },
    tidalAdjustment: {
      flushingRateMultiplier: 0.9,
      depthMultiplier: 0.6,   // SAV needs shallow water + light
      salinityMultiplier: 0.85,
    },
    cost: {
      capitalPerUnit: { min: 10_000, expected: 40_000, max: 80_000 },
      annualOMPerUnit: { min: 1_000, expected: 3_000, max: 8_000 },
      unitLabel: 'acre',
    },
    rampUp: {
      monthsToMinEfficacy: 12,
      monthsToFullEfficacy: 36,
      rampFunction: 'logarithmic',
    },
    compatibleWaterbodies: ['estuary', 'tidal_river', 'coastal', 'lake'],
    requiresLand: false,
    requiresPermitting: true,
    citations: ['VIMS SAV Restoration Monitoring Program', 'Chesapeake Bay SAV Technical Synthesis'],
  },

  // 9. Emerging Technologies
  {
    id: 'emerging-tech',
    name: 'Emerging Technologies',
    category: 'emerging',
    description: 'Placeholder for pilot-stage technologies: algal turf scrubbers, biochar filters, electrochemical treatment, nanobubble aeration. Efficacy data is limited and site-specific.',
    removalRates: {
      TN:             { min: 0.10, expected: 0.25, max: 0.50 },
      TP:             { min: 0.10, expected: 0.25, max: 0.50 },
      TSS:            { min: 0.15, expected: 0.30, max: 0.60 },
      bacteria:       { min: 0.10, expected: 0.25, max: 0.50 },
      DO_improvement: { min: 0.05, expected: 0.15, max: 0.30 },
    },
    tidalAdjustment: null,
    cost: {
      capitalPerUnit: { min: 50_000, expected: 250_000, max: 1_000_000 },
      annualOMPerUnit: { min: 10_000, expected: 30_000, max: 100_000 },
      unitLabel: 'project',
    },
    rampUp: {
      monthsToMinEfficacy: 3,
      monthsToFullEfficacy: 12,
      rampFunction: 'linear',
    },
    compatibleWaterbodies: ['freshwater', 'lake', 'estuary', 'tidal_river', 'coastal'],
    requiresLand: false,
    requiresPermitting: true,
    citations: ['EPA Environmental Technology Verification Program'],
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const _byId = new Map(INTERVENTION_LIBRARY.map(i => [i.id, i]));

export function getIntervention(id: string): InterventionType | undefined {
  return _byId.get(id);
}

export function getInterventionsForWaterbody(type: WaterbodyCategory): InterventionType[] {
  return INTERVENTION_LIBRARY.filter(i => i.compatibleWaterbodies.includes(type));
}
