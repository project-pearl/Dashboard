// ─── What-If Scenario Simulator — Scenario Definitions & Baseline Data ──────
// Pure data module — no cache reads, no blob writes, no side effects.

export interface StateModification {
  target: 'score' | 'cat5' | 'totalImpaired' | 'high' | 'medium' | 'monitored';
  operation: 'multiply' | 'add' | 'set';
  value: number;
}

export interface ScenarioEvent {
  id: string;
  label: string;
  category: 'environmental' | 'compliance' | 'infrastructure' | 'crisis';
  icon: string;
  description: string;
  affectedStates: string[];   // empty = nationwide
  modifications: StateModification[];
}

export const SCENARIO_CATEGORIES = [
  'environmental', 'compliance', 'infrastructure', 'crisis',
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  environmental: 'Environmental',
  compliance: 'Compliance',
  infrastructure: 'Infrastructure',
  crisis: 'Crisis',
};

export const SCENARIO_CATALOG: ScenarioEvent[] = [
  // ── Environmental ──
  {
    id: 'hurricane-gulf', label: 'Cat 4 Hurricane — Gulf Coast', category: 'environmental', icon: '\uD83C\uDF00',
    description: 'Major hurricane makes landfall across Gulf states, overwhelming stormwater systems and flushing contaminants into receiving waters.',
    affectedStates: ['FL', 'AL', 'MS', 'LA', 'TX'],
    modifications: [
      { target: 'score', operation: 'multiply', value: 0.6 },
      { target: 'high', operation: 'multiply', value: 3 },
      { target: 'totalImpaired', operation: 'multiply', value: 1.4 },
    ],
  },
  {
    id: 'drought-west', label: 'Severe Drought — Western States', category: 'environmental', icon: '\u2600\uFE0F',
    description: 'Extended drought concentrates pollutants in reduced streamflows, stressing aquatic life and drinking water intakes.',
    affectedStates: ['CA', 'AZ', 'NV', 'UT', 'CO'],
    modifications: [
      { target: 'score', operation: 'multiply', value: 0.7 },
      { target: 'monitored', operation: 'multiply', value: 0.5 },
    ],
  },
  {
    id: 'hab-greatlakes', label: 'Harmful Algal Bloom — Great Lakes', category: 'environmental', icon: '\uD83E\UDDA0',
    description: 'Phosphorus-driven cyanobacteria bloom spreads across western Lake Erie, triggering drinking water advisories.',
    affectedStates: ['OH', 'MI', 'IN', 'WI'],
    modifications: [
      { target: 'score', operation: 'add', value: -15 },
      { target: 'cat5', operation: 'add', value: 200 },
    ],
  },
  {
    id: 'agrunoff-midwest', label: 'Agricultural Runoff Surge — Midwest', category: 'environmental', icon: '\uD83C\uDF3E',
    description: 'Record spring rains flush fertilizer and manure from fields into tributaries, creating hypoxic conditions downstream.',
    affectedStates: ['IA', 'IL', 'IN', 'OH', 'MN'],
    modifications: [
      { target: 'score', operation: 'add', value: -12 },
      { target: 'medium', operation: 'multiply', value: 2.5 },
    ],
  },
  {
    id: 'wildfire-pnw', label: 'Wildfire Watershed — Pacific NW', category: 'environmental', icon: '\uD83D\uDD25',
    description: 'Large wildfires strip vegetation from steep watersheds, causing massive sediment and ash loading in downstream waters.',
    affectedStates: ['OR', 'WA', 'CA'],
    modifications: [
      { target: 'score', operation: 'add', value: -20 },
      { target: 'cat5', operation: 'add', value: 300 },
    ],
  },

  // ── Compliance ──
  {
    id: 'npdes-tristate', label: 'Major NPDES Violations — Tri-State', category: 'compliance', icon: '\u26A0\uFE0F',
    description: 'Multiple large dischargers exceed permit limits simultaneously, creating acute impairment across the tri-state area.',
    affectedStates: ['NY', 'NJ', 'CT'],
    modifications: [
      { target: 'score', operation: 'add', value: -10 },
      { target: 'high', operation: 'multiply', value: 2 },
      { target: 'cat5', operation: 'add', value: 50 },
    ],
  },
  {
    id: 'pfas-national', label: 'PFAS MCL Exceedances — Nationwide', category: 'compliance', icon: '\u2623\uFE0F',
    description: 'New federal PFAS MCLs reveal widespread exceedances in drinking water systems across the country.',
    affectedStates: [],
    modifications: [
      { target: 'score', operation: 'add', value: -5 },
      { target: 'cat5', operation: 'multiply', value: 1.15 },
    ],
  },
  {
    id: 'tmdl-southeast', label: 'TMDL Deadline Cascade — Southeast', category: 'compliance', icon: '\uD83D\uDCC5',
    description: 'Missed TMDL implementation deadlines trigger EPA enforcement actions and reclassification of waterbodies to Category 5.',
    affectedStates: ['GA', 'NC', 'SC', 'TN'],
    modifications: [
      { target: 'cat5', operation: 'multiply', value: 1.5 },
      { target: 'score', operation: 'add', value: -8 },
    ],
  },

  // ── Infrastructure ──
  {
    id: 'plant-failure', label: 'Treatment Plant Failure — Major City', category: 'infrastructure', icon: '\uD83C\uDFED',
    description: 'A major municipal WWTP experiences catastrophic equipment failure, discharging partially treated effluent for weeks.',
    affectedStates: ['MD'],
    modifications: [
      { target: 'score', operation: 'set', value: 25 },
      { target: 'high', operation: 'set', value: 50 },
    ],
  },
  {
    id: 'cso-event', label: 'Combined Sewer Overflow Event', category: 'infrastructure', icon: '\uD83C\uDF0A',
    description: 'Intense rainfall overwhelms combined sewer systems, releasing untreated sewage into rivers and harbors.',
    affectedStates: ['NY', 'NJ', 'PA'],
    modifications: [
      { target: 'score', operation: 'add', value: -18 },
      { target: 'high', operation: 'multiply', value: 4 },
    ],
  },
  {
    id: 'aging-pipes', label: 'Aging Pipe Network Failure', category: 'infrastructure', icon: '\uD83D\uDD27',
    description: 'Cascading water main breaks and lead service line failures from deteriorating infrastructure.',
    affectedStates: ['OH', 'PA', 'WV'],
    modifications: [
      { target: 'score', operation: 'add', value: -15 },
      { target: 'totalImpaired', operation: 'multiply', value: 1.3 },
    ],
  },

  // ── Crisis ──
  {
    id: 'chemical-spill', label: 'Multi-State Chemical Spill', category: 'crisis', icon: '\u2620\uFE0F',
    description: 'Industrial chemical train derailment contaminates the Ohio River watershed, affecting multiple downstream communities.',
    affectedStates: ['OH', 'PA', 'WV'],
    modifications: [
      { target: 'score', operation: 'set', value: 20 },
      { target: 'high', operation: 'set', value: 100 },
    ],
  },
  {
    id: 'boil-water', label: 'Boil Water Advisory — Large Metro', category: 'crisis', icon: '\uD83D\uDCA7',
    description: 'Major metropolitan area issues boil water advisory after treatment system compromise, affecting millions.',
    affectedStates: ['TX'],
    modifications: [
      { target: 'score', operation: 'add', value: -25 },
      { target: 'high', operation: 'multiply', value: 5 },
    ],
  },
  {
    id: 'ej-emergency', label: 'Environmental Justice Emergency', category: 'crisis', icon: '\u2696\uFE0F',
    description: 'Systemic failures in underserved communities lead to widespread contamination, triggering federal emergency response.',
    affectedStates: ['MS', 'AL', 'LA'],
    modifications: [
      { target: 'score', operation: 'add', value: -20 },
      { target: 'high', operation: 'multiply', value: 3 },
      { target: 'totalImpaired', operation: 'multiply', value: 2 },
    ],
  },
];

// ─── Baseline State Rollup (static snapshot for demo reproducibility) ────────
// Representative data inspired by actual ATTAINS patterns. NOT live data.

export interface BaselineStateRow {
  abbr: string;
  name: string;
  score: number;
  high: number;
  medium: number;
  low: number;
  none: number;
  cat5: number;
  cat4a: number;
  cat4b: number;
  cat4c: number;
  totalImpaired: number;
  waterbodies: number;
  assessed: number;
  monitored: number;
  unmonitored: number;
  topCauses: { cause: string; count: number }[];
}

export const BASELINE_STATE_ROLLUP: BaselineStateRow[] = [
  { abbr: 'AL', name: 'Alabama', score: 52, high: 8, medium: 15, low: 22, none: 55, cat5: 180, cat4a: 90, cat4b: 60, cat4c: 30, totalImpaired: 620, waterbodies: 1800, assessed: 1400, monitored: 900, unmonitored: 500, topCauses: [{ cause: 'Pathogens', count: 210 }, { cause: 'Nutrients', count: 150 }, { cause: 'Sediment', count: 120 }] },
  { abbr: 'AK', name: 'Alaska', score: 82, high: 1, medium: 3, low: 5, none: 91, cat5: 20, cat4a: 15, cat4b: 10, cat4c: 5, totalImpaired: 80, waterbodies: 3200, assessed: 800, monitored: 400, unmonitored: 400, topCauses: [{ cause: 'Mercury', count: 25 }, { cause: 'Turbidity', count: 18 }] },
  { abbr: 'AZ', name: 'Arizona', score: 58, high: 5, medium: 12, low: 18, none: 65, cat5: 110, cat4a: 55, cat4b: 40, cat4c: 20, totalImpaired: 320, waterbodies: 900, assessed: 700, monitored: 450, unmonitored: 250, topCauses: [{ cause: 'Selenium', count: 80 }, { cause: 'Suspended Solids', count: 65 }] },
  { abbr: 'AR', name: 'Arkansas', score: 55, high: 6, medium: 14, low: 20, none: 60, cat5: 150, cat4a: 70, cat4b: 50, cat4c: 25, totalImpaired: 480, waterbodies: 1200, assessed: 950, monitored: 600, unmonitored: 350, topCauses: [{ cause: 'Turbidity', count: 160 }, { cause: 'Pathogens', count: 110 }] },
  { abbr: 'CA', name: 'California', score: 48, high: 12, medium: 20, low: 25, none: 43, cat5: 450, cat4a: 200, cat4b: 150, cat4c: 80, totalImpaired: 1800, waterbodies: 4500, assessed: 3600, monitored: 2500, unmonitored: 1100, topCauses: [{ cause: 'Pesticides', count: 380 }, { cause: 'Metals', count: 320 }, { cause: 'Nutrients', count: 280 }] },
  { abbr: 'CO', name: 'Colorado', score: 62, high: 4, medium: 10, low: 16, none: 70, cat5: 90, cat4a: 50, cat4b: 35, cat4c: 15, totalImpaired: 280, waterbodies: 1100, assessed: 850, monitored: 550, unmonitored: 300, topCauses: [{ cause: 'Metals', count: 95 }, { cause: 'Temperature', count: 70 }] },
  { abbr: 'CT', name: 'Connecticut', score: 56, high: 5, medium: 12, low: 18, none: 65, cat5: 85, cat4a: 45, cat4b: 30, cat4c: 15, totalImpaired: 240, waterbodies: 600, assessed: 500, monitored: 380, unmonitored: 120, topCauses: [{ cause: 'Pathogens', count: 80 }, { cause: 'Mercury', count: 60 }] },
  { abbr: 'DE', name: 'Delaware', score: 45, high: 8, medium: 16, low: 20, none: 56, cat5: 50, cat4a: 25, cat4b: 18, cat4c: 8, totalImpaired: 150, waterbodies: 280, assessed: 240, monitored: 180, unmonitored: 60, topCauses: [{ cause: 'Nutrients', count: 55 }, { cause: 'Pathogens', count: 40 }] },
  { abbr: 'FL', name: 'Florida', score: 50, high: 10, medium: 18, low: 22, none: 50, cat5: 380, cat4a: 180, cat4b: 120, cat4c: 60, totalImpaired: 1400, waterbodies: 3500, assessed: 2800, monitored: 2000, unmonitored: 800, topCauses: [{ cause: 'Nutrients', count: 420 }, { cause: 'Mercury', count: 280 }, { cause: 'Dissolved Oxygen', count: 220 }] },
  { abbr: 'GA', name: 'Georgia', score: 54, high: 7, medium: 14, low: 20, none: 59, cat5: 200, cat4a: 100, cat4b: 70, cat4c: 35, totalImpaired: 650, waterbodies: 1900, assessed: 1500, monitored: 950, unmonitored: 550, topCauses: [{ cause: 'Pathogens (E. coli)', count: 220 }, { cause: 'Dissolved Oxygen', count: 160 }] },
  { abbr: 'HI', name: 'Hawaii', score: 68, high: 3, medium: 8, low: 12, none: 77, cat5: 40, cat4a: 20, cat4b: 15, cat4c: 8, totalImpaired: 120, waterbodies: 450, assessed: 350, monitored: 250, unmonitored: 100, topCauses: [{ cause: 'Turbidity', count: 35 }, { cause: 'Nutrients', count: 28 }] },
  { abbr: 'ID', name: 'Idaho', score: 65, high: 3, medium: 8, low: 14, none: 75, cat5: 70, cat4a: 40, cat4b: 25, cat4c: 12, totalImpaired: 210, waterbodies: 800, assessed: 620, monitored: 400, unmonitored: 220, topCauses: [{ cause: 'Temperature', count: 75 }, { cause: 'Sediment', count: 55 }] },
  { abbr: 'IL', name: 'Illinois', score: 44, high: 10, medium: 18, low: 22, none: 50, cat5: 280, cat4a: 140, cat4b: 100, cat4c: 50, totalImpaired: 900, waterbodies: 2200, assessed: 1800, monitored: 1200, unmonitored: 600, topCauses: [{ cause: 'Phosphorus', count: 310 }, { cause: 'Pathogens', count: 240 }] },
  { abbr: 'IN', name: 'Indiana', score: 42, high: 11, medium: 19, low: 22, none: 48, cat5: 260, cat4a: 130, cat4b: 90, cat4c: 45, totalImpaired: 850, waterbodies: 2000, assessed: 1600, monitored: 1050, unmonitored: 550, topCauses: [{ cause: 'E. coli', count: 280 }, { cause: 'Nutrients', count: 220 }] },
  { abbr: 'IA', name: 'Iowa', score: 40, high: 12, medium: 20, low: 22, none: 46, cat5: 300, cat4a: 150, cat4b: 110, cat4c: 55, totalImpaired: 950, waterbodies: 2100, assessed: 1700, monitored: 1000, unmonitored: 700, topCauses: [{ cause: 'Nitrate', count: 350 }, { cause: 'Bacteria', count: 280 }] },
  { abbr: 'KS', name: 'Kansas', score: 50, high: 7, medium: 14, low: 20, none: 59, cat5: 140, cat4a: 70, cat4b: 50, cat4c: 25, totalImpaired: 450, waterbodies: 1100, assessed: 880, monitored: 550, unmonitored: 330, topCauses: [{ cause: 'Atrazine', count: 130 }, { cause: 'Sediment', count: 100 }] },
  { abbr: 'KY', name: 'Kentucky', score: 53, high: 6, medium: 14, low: 20, none: 60, cat5: 170, cat4a: 85, cat4b: 60, cat4c: 30, totalImpaired: 560, waterbodies: 1500, assessed: 1200, monitored: 780, unmonitored: 420, topCauses: [{ cause: 'Pathogens', count: 190 }, { cause: 'Sediment', count: 140 }] },
  { abbr: 'LA', name: 'Louisiana', score: 47, high: 9, medium: 17, low: 22, none: 52, cat5: 220, cat4a: 110, cat4b: 80, cat4c: 40, totalImpaired: 720, waterbodies: 1800, assessed: 1400, monitored: 850, unmonitored: 550, topCauses: [{ cause: 'Mercury', count: 240 }, { cause: 'Dissolved Oxygen', count: 180 }] },
  { abbr: 'ME', name: 'Maine', score: 72, high: 2, medium: 6, low: 12, none: 80, cat5: 45, cat4a: 25, cat4b: 18, cat4c: 8, totalImpaired: 140, waterbodies: 700, assessed: 550, monitored: 400, unmonitored: 150, topCauses: [{ cause: 'Dissolved Oxygen', count: 45 }, { cause: 'Mercury', count: 35 }] },
  { abbr: 'MD', name: 'Maryland', score: 46, high: 9, medium: 17, low: 22, none: 52, cat5: 160, cat4a: 80, cat4b: 55, cat4c: 28, totalImpaired: 520, waterbodies: 1200, assessed: 980, monitored: 700, unmonitored: 280, topCauses: [{ cause: 'Nutrients', count: 180 }, { cause: 'Sediment', count: 140 }, { cause: 'Pathogens', count: 100 }] },
  { abbr: 'MA', name: 'Massachusetts', score: 58, high: 5, medium: 12, low: 18, none: 65, cat5: 110, cat4a: 55, cat4b: 40, cat4c: 20, totalImpaired: 350, waterbodies: 900, assessed: 740, monitored: 560, unmonitored: 180, topCauses: [{ cause: 'Pathogens', count: 120 }, { cause: 'Mercury', count: 80 }] },
  { abbr: 'MI', name: 'Michigan', score: 55, high: 6, medium: 14, low: 20, none: 60, cat5: 200, cat4a: 100, cat4b: 70, cat4c: 35, totalImpaired: 650, waterbodies: 2000, assessed: 1600, monitored: 1100, unmonitored: 500, topCauses: [{ cause: 'Mercury', count: 210 }, { cause: 'E. coli', count: 170 }] },
  { abbr: 'MN', name: 'Minnesota', score: 48, high: 9, medium: 17, low: 22, none: 52, cat5: 250, cat4a: 120, cat4b: 85, cat4c: 42, totalImpaired: 800, waterbodies: 2400, assessed: 1900, monitored: 1300, unmonitored: 600, topCauses: [{ cause: 'Nutrients', count: 280 }, { cause: 'Mercury', count: 220 }] },
  { abbr: 'MS', name: 'Mississippi', score: 44, high: 10, medium: 18, low: 22, none: 50, cat5: 200, cat4a: 100, cat4b: 70, cat4c: 35, totalImpaired: 650, waterbodies: 1600, assessed: 1200, monitored: 700, unmonitored: 500, topCauses: [{ cause: 'Pathogens', count: 220 }, { cause: 'Dissolved Oxygen', count: 160 }] },
  { abbr: 'MO', name: 'Missouri', score: 50, high: 7, medium: 14, low: 20, none: 59, cat5: 180, cat4a: 90, cat4b: 65, cat4c: 32, totalImpaired: 580, waterbodies: 1500, assessed: 1200, monitored: 780, unmonitored: 420, topCauses: [{ cause: 'Bacteria', count: 195 }, { cause: 'Nutrients', count: 150 }] },
  { abbr: 'MT', name: 'Montana', score: 70, high: 2, medium: 6, low: 12, none: 80, cat5: 55, cat4a: 30, cat4b: 20, cat4c: 10, totalImpaired: 170, waterbodies: 900, assessed: 680, monitored: 450, unmonitored: 230, topCauses: [{ cause: 'Metals', count: 60 }, { cause: 'Temperature', count: 45 }] },
  { abbr: 'NE', name: 'Nebraska', score: 52, high: 6, medium: 14, low: 20, none: 60, cat5: 120, cat4a: 60, cat4b: 42, cat4c: 20, totalImpaired: 380, waterbodies: 950, assessed: 760, monitored: 480, unmonitored: 280, topCauses: [{ cause: 'E. coli', count: 130 }, { cause: 'Atrazine', count: 90 }] },
  { abbr: 'NV', name: 'Nevada', score: 60, high: 4, medium: 10, low: 16, none: 70, cat5: 50, cat4a: 25, cat4b: 18, cat4c: 8, totalImpaired: 150, waterbodies: 400, assessed: 320, monitored: 200, unmonitored: 120, topCauses: [{ cause: 'Mercury', count: 40 }, { cause: 'Temperature', count: 30 }] },
  { abbr: 'NH', name: 'New Hampshire', score: 70, high: 2, medium: 6, low: 12, none: 80, cat5: 35, cat4a: 18, cat4b: 12, cat4c: 6, totalImpaired: 100, waterbodies: 500, assessed: 400, monitored: 300, unmonitored: 100, topCauses: [{ cause: 'Mercury', count: 30 }, { cause: 'pH', count: 22 }] },
  { abbr: 'NJ', name: 'New Jersey', score: 42, high: 11, medium: 19, low: 22, none: 48, cat5: 200, cat4a: 100, cat4b: 70, cat4c: 35, totalImpaired: 650, waterbodies: 1200, assessed: 1000, monitored: 760, unmonitored: 240, topCauses: [{ cause: 'Phosphorus', count: 220 }, { cause: 'Pathogens', count: 180 }] },
  { abbr: 'NM', name: 'New Mexico', score: 56, high: 5, medium: 12, low: 18, none: 65, cat5: 80, cat4a: 40, cat4b: 28, cat4c: 14, totalImpaired: 240, waterbodies: 650, assessed: 520, monitored: 320, unmonitored: 200, topCauses: [{ cause: 'Temperature', count: 65 }, { cause: 'Metals', count: 50 }] },
  { abbr: 'NY', name: 'New York', score: 52, high: 7, medium: 15, low: 22, none: 56, cat5: 280, cat4a: 140, cat4b: 100, cat4c: 50, totalImpaired: 900, waterbodies: 2500, assessed: 2000, monitored: 1500, unmonitored: 500, topCauses: [{ cause: 'Pathogens', count: 300 }, { cause: 'Phosphorus', count: 250 }] },
  { abbr: 'NC', name: 'North Carolina', score: 54, high: 7, medium: 14, low: 20, none: 59, cat5: 220, cat4a: 110, cat4b: 78, cat4c: 38, totalImpaired: 700, waterbodies: 2000, assessed: 1600, monitored: 1050, unmonitored: 550, topCauses: [{ cause: 'Pathogens', count: 235 }, { cause: 'Turbidity', count: 180 }] },
  { abbr: 'ND', name: 'North Dakota', score: 60, high: 4, medium: 10, low: 16, none: 70, cat5: 45, cat4a: 22, cat4b: 16, cat4c: 8, totalImpaired: 140, waterbodies: 500, assessed: 400, monitored: 250, unmonitored: 150, topCauses: [{ cause: 'Selenium', count: 40 }, { cause: 'Sulfate', count: 30 }] },
  { abbr: 'OH', name: 'Ohio', score: 46, high: 9, medium: 17, low: 22, none: 52, cat5: 260, cat4a: 130, cat4b: 92, cat4c: 46, totalImpaired: 850, waterbodies: 2200, assessed: 1800, monitored: 1200, unmonitored: 600, topCauses: [{ cause: 'Nutrients', count: 290 }, { cause: 'Habitat', count: 220 }] },
  { abbr: 'OK', name: 'Oklahoma', score: 50, high: 7, medium: 14, low: 20, none: 59, cat5: 140, cat4a: 70, cat4b: 50, cat4c: 25, totalImpaired: 450, waterbodies: 1100, assessed: 880, monitored: 550, unmonitored: 330, topCauses: [{ cause: 'Bacteria', count: 150 }, { cause: 'Turbidity', count: 110 }] },
  { abbr: 'OR', name: 'Oregon', score: 60, high: 4, medium: 10, low: 16, none: 70, cat5: 120, cat4a: 60, cat4b: 42, cat4c: 20, totalImpaired: 380, waterbodies: 1100, assessed: 880, monitored: 600, unmonitored: 280, topCauses: [{ cause: 'Temperature', count: 130 }, { cause: 'Sediment', count: 90 }] },
  { abbr: 'PA', name: 'Pennsylvania', score: 48, high: 9, medium: 17, low: 22, none: 52, cat5: 320, cat4a: 160, cat4b: 112, cat4c: 55, totalImpaired: 1050, waterbodies: 2800, assessed: 2200, monitored: 1500, unmonitored: 700, topCauses: [{ cause: 'Sediment', count: 350 }, { cause: 'Metals', count: 270 }] },
  { abbr: 'RI', name: 'Rhode Island', score: 54, high: 5, medium: 12, low: 18, none: 65, cat5: 30, cat4a: 15, cat4b: 10, cat4c: 5, totalImpaired: 90, waterbodies: 220, assessed: 180, monitored: 140, unmonitored: 40, topCauses: [{ cause: 'Pathogens', count: 30 }, { cause: 'Nutrients', count: 22 }] },
  { abbr: 'SC', name: 'South Carolina', score: 56, high: 6, medium: 13, low: 18, none: 63, cat5: 130, cat4a: 65, cat4b: 45, cat4c: 22, totalImpaired: 420, waterbodies: 1100, assessed: 880, monitored: 580, unmonitored: 300, topCauses: [{ cause: 'Pathogens', count: 140 }, { cause: 'Mercury', count: 100 }] },
  { abbr: 'SD', name: 'South Dakota', score: 58, high: 5, medium: 12, low: 18, none: 65, cat5: 55, cat4a: 28, cat4b: 20, cat4c: 10, totalImpaired: 175, waterbodies: 600, assessed: 480, monitored: 300, unmonitored: 180, topCauses: [{ cause: 'TSS', count: 58 }, { cause: 'E. coli', count: 42 }] },
  { abbr: 'TN', name: 'Tennessee', score: 52, high: 7, medium: 14, low: 20, none: 59, cat5: 180, cat4a: 90, cat4b: 63, cat4c: 32, totalImpaired: 580, waterbodies: 1500, assessed: 1200, monitored: 780, unmonitored: 420, topCauses: [{ cause: 'Pathogens', count: 195 }, { cause: 'Sediment', count: 150 }] },
  { abbr: 'TX', name: 'Texas', score: 50, high: 8, medium: 16, low: 22, none: 54, cat5: 350, cat4a: 175, cat4b: 125, cat4c: 62, totalImpaired: 1150, waterbodies: 3200, assessed: 2600, monitored: 1800, unmonitored: 800, topCauses: [{ cause: 'Bacteria', count: 380 }, { cause: 'Dissolved Oxygen', count: 290 }] },
  { abbr: 'UT', name: 'Utah', score: 60, high: 4, medium: 10, low: 16, none: 70, cat5: 70, cat4a: 35, cat4b: 25, cat4c: 12, totalImpaired: 210, waterbodies: 650, assessed: 520, monitored: 340, unmonitored: 180, topCauses: [{ cause: 'Mercury', count: 55 }, { cause: 'Temperature', count: 40 }] },
  { abbr: 'VT', name: 'Vermont', score: 68, high: 3, medium: 8, low: 12, none: 77, cat5: 35, cat4a: 18, cat4b: 12, cat4c: 6, totalImpaired: 100, waterbodies: 450, assessed: 360, monitored: 270, unmonitored: 90, topCauses: [{ cause: 'Sediment', count: 32 }, { cause: 'Nutrients', count: 25 }] },
  { abbr: 'VA', name: 'Virginia', score: 52, high: 7, medium: 15, low: 20, none: 58, cat5: 220, cat4a: 110, cat4b: 78, cat4c: 38, totalImpaired: 710, waterbodies: 2000, assessed: 1600, monitored: 1050, unmonitored: 550, topCauses: [{ cause: 'Pathogens (E. coli)', count: 240 }, { cause: 'Sediment', count: 180 }] },
  { abbr: 'WA', name: 'Washington', score: 62, high: 4, medium: 10, low: 16, none: 70, cat5: 110, cat4a: 55, cat4b: 38, cat4c: 18, totalImpaired: 340, waterbodies: 1100, assessed: 880, monitored: 600, unmonitored: 280, topCauses: [{ cause: 'Temperature', count: 110 }, { cause: 'Dissolved Oxygen', count: 80 }] },
  { abbr: 'WV', name: 'West Virginia', score: 50, high: 7, medium: 14, low: 20, none: 59, cat5: 120, cat4a: 60, cat4b: 42, cat4c: 20, totalImpaired: 380, waterbodies: 900, assessed: 720, monitored: 460, unmonitored: 260, topCauses: [{ cause: 'Metals', count: 130 }, { cause: 'Sediment', count: 95 }] },
  { abbr: 'WI', name: 'Wisconsin', score: 52, high: 7, medium: 14, low: 20, none: 59, cat5: 200, cat4a: 100, cat4b: 70, cat4c: 35, totalImpaired: 650, waterbodies: 1800, assessed: 1440, monitored: 960, unmonitored: 480, topCauses: [{ cause: 'Mercury', count: 220 }, { cause: 'Phosphorus', count: 180 }] },
  { abbr: 'WY', name: 'Wyoming', score: 72, high: 2, medium: 5, low: 10, none: 83, cat5: 30, cat4a: 15, cat4b: 10, cat4c: 5, totalImpaired: 90, waterbodies: 500, assessed: 380, monitored: 250, unmonitored: 130, topCauses: [{ cause: 'Temperature', count: 28 }, { cause: 'Selenium', count: 20 }] },
];
