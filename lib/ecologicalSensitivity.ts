// lib/ecologicalSensitivity.ts
// Ecological sensitivity scoring based on USFWS Endangered Species Act data
// Source: U.S. Fish & Wildlife Service ECOS (Environmental Conservation Online System)
// T&E species counts per state from USFWS published listings (2024-2025 data)
// Aquatic species counts include freshwater mussels, fish, amphibians, marine mammals,
// sea turtles, and aquatic invertebrates — weighted higher for PEARL relevance
//
// Scoring: 0-100 composite of total T&E density + aquatic species ratio + critical habitat

export interface EcoStateData {
  abbr: string;
  totalTE: number;        // Total threatened + endangered species (animals + plants)
  aquaticTE: number;      // Aquatic/freshwater/marine T&E species
  criticalHabitat: number; // Number of species with designated critical habitat in state
  score: number;          // Computed 0-100 ecological sensitivity score
}

// ── USFWS T&E Species Counts by State ──────────────────────────────────────────
// Total: ESA-listed species with current range in state (animals + plants)
// Aquatic: subset that are freshwater/marine (fish, mussels, amphibians, crustaceans,
//          marine mammals, sea turtles, aquatic snails, aquatic plants)
// CritHab: species with designated critical habitat within the state
//
// Data compiled from ECOS species-by-state reports and critical habitat mapper
// Reference: https://ecos.fws.gov/ecp/species-reports
// Last updated: 2025 (ESA listings change ~2-5 species/year nationally)

const STATE_TE_DATA: Record<string, { total: number; aquatic: number; critHab: number }> = {
  AL: { total: 127, aquatic: 98, critHab: 68 },   // Highest freshwater biodiversity in US
  AK: { total: 22,  aquatic: 12, critHab: 14 },
  AZ: { total: 64,  aquatic: 22, critHab: 48 },
  AR: { total: 44,  aquatic: 28, critHab: 20 },
  CA: { total: 299, aquatic: 68, critHab: 195 },   // Most total T&E species
  CO: { total: 36,  aquatic: 14, critHab: 22 },
  CT: { total: 18,  aquatic: 8,  critHab: 6 },
  DE: { total: 17,  aquatic: 8,  critHab: 5 },
  DC: { total: 8,   aquatic: 3,  critHab: 2 },
  FL: { total: 135, aquatic: 42, critHab: 78 },    // Marine + freshwater hotspot
  GA: { total: 75,  aquatic: 42, critHab: 38 },
  HI: { total: 503, aquatic: 8,  critHab: 285 },   // Most T&E overall (endemic plants), low aquatic
  ID: { total: 24,  aquatic: 12, critHab: 16 },
  IL: { total: 38,  aquatic: 22, critHab: 12 },
  IN: { total: 30,  aquatic: 18, critHab: 10 },
  IA: { total: 20,  aquatic: 10, critHab: 6 },
  KS: { total: 22,  aquatic: 10, critHab: 8 },
  KY: { total: 52,  aquatic: 38, critHab: 22 },    // Tennessee/Cumberland river mussels
  LA: { total: 36,  aquatic: 16, critHab: 14 },
  ME: { total: 18,  aquatic: 10, critHab: 8 },
  MD: { total: 24,  aquatic: 12, critHab: 8 },     // Chesapeake species
  MA: { total: 22,  aquatic: 12, critHab: 10 },
  MI: { total: 26,  aquatic: 14, critHab: 10 },
  MN: { total: 18,  aquatic: 8,  critHab: 6 },
  MS: { total: 55,  aquatic: 32, critHab: 24 },
  MO: { total: 42,  aquatic: 22, critHab: 16 },
  MT: { total: 18,  aquatic: 8,  critHab: 10 },
  NE: { total: 18,  aquatic: 6,  critHab: 8 },
  NV: { total: 38,  aquatic: 18, critHab: 24 },
  NH: { total: 14,  aquatic: 6,  critHab: 4 },
  NJ: { total: 20,  aquatic: 8,  critHab: 6 },
  NM: { total: 52,  aquatic: 18, critHab: 34 },
  NY: { total: 28,  aquatic: 12, critHab: 10 },
  NC: { total: 72,  aquatic: 42, critHab: 36 },    // Appalachian mussels + coastal
  ND: { total: 12,  aquatic: 4,  critHab: 4 },
  OH: { total: 30,  aquatic: 18, critHab: 10 },
  OK: { total: 30,  aquatic: 14, critHab: 12 },
  OR: { total: 62,  aquatic: 28, critHab: 42 },    // Salmon + coastal species
  PA: { total: 24,  aquatic: 14, critHab: 8 },
  RI: { total: 12,  aquatic: 6,  critHab: 4 },
  SC: { total: 42,  aquatic: 20, critHab: 18 },
  SD: { total: 14,  aquatic: 4,  critHab: 6 },
  TN: { total: 102, aquatic: 78, critHab: 48 },    // #2 freshwater biodiversity (mussels)
  TX: { total: 105, aquatic: 36, critHab: 62 },
  UT: { total: 42,  aquatic: 16, critHab: 28 },
  VT: { total: 12,  aquatic: 4,  critHab: 4 },
  VA: { total: 72,  aquatic: 42, critHab: 32 },    // Appalachian + Chesapeake species
  WA: { total: 52,  aquatic: 26, critHab: 36 },
  WV: { total: 28,  aquatic: 18, critHab: 10 },
  WI: { total: 20,  aquatic: 8,  critHab: 6 },
  WY: { total: 14,  aquatic: 6,  critHab: 8 },
};

// ── Scoring Algorithm ──────────────────────────────────────────────────────────
// Three components, weighted for PEARL relevance (aquatic restoration focus):
//
// 1. Aquatic T&E Density (50% weight)
//    - How many aquatic T&E species does the state have?
//    - Normalized: 0 at 0 species, 100 at 80+ species (Alabama/Tennessee tier)
//    - This is the primary driver — PEARL treats water, so aquatic species matter most
//
// 2. Total T&E Presence (25% weight)
//    - Overall biodiversity pressure from ESA listings
//    - Normalized: 0 at 0 species, 100 at 200+ species
//    - Captures terrestrial species that benefit from watershed health
//
// 3. Critical Habitat Density (25% weight)
//    - How much designated critical habitat exists in the state?
//    - Normalized: 0 at 0 designations, 100 at 80+ designations
//    - Critical habitat = regulatory significance + recovery priority
//
// Final score clamped to 0-100

function computeScore(total: number, aquatic: number, critHab: number): number {
  // Normalize each component (sigmoid-like curve using min/max scaling with cap)
  const aquaticNorm = Math.min(100, Math.round((aquatic / 80) * 100));
  const totalNorm = Math.min(100, Math.round((total / 200) * 100));
  const critHabNorm = Math.min(100, Math.round((critHab / 80) * 100));

  // Weighted composite
  const raw = aquaticNorm * 0.50 + totalNorm * 0.25 + critHabNorm * 0.25;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

// ── Pre-computed scores ────────────────────────────────────────────────────────

const ECO_SCORES: Record<string, EcoStateData> = {};
for (const [abbr, data] of Object.entries(STATE_TE_DATA)) {
  ECO_SCORES[abbr] = {
    abbr,
    totalTE: data.total,
    aquaticTE: data.aquatic,
    criticalHabitat: data.critHab,
    score: computeScore(data.total, data.aquatic, data.critHab),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Get ecological sensitivity score for a state (0-100).
 * Returns 0 if state not found.
 */
export function getEcoScore(stateAbbr: string): number {
  return ECO_SCORES[stateAbbr.toUpperCase()]?.score ?? 0;
}

/**
 * Get full ecological data for a state.
 */
export function getEcoData(stateAbbr: string): EcoStateData | null {
  return ECO_SCORES[stateAbbr.toUpperCase()] ?? null;
}

/**
 * Get all state scores as a map (for bulk use in overlays).
 */
export function getAllEcoScores(): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [abbr, data] of Object.entries(ECO_SCORES)) {
    result[abbr] = data.score;
  }
  return result;
}

/**
 * Get all state data (for detailed ecological overlay).
 */
export function getAllEcoData(): Record<string, EcoStateData> {
  return { ...ECO_SCORES };
}

/**
 * Get a human-readable label for an eco score.
 */
export function ecoScoreLabel(score: number): string {
  if (score >= 80) return 'Very High';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Low';
  return 'Minimal';
}

/**
 * Get source attribution text for display.
 */
export function ecoSourceAttribution(): string {
  return 'Source: USFWS ECOS — ESA-listed species by state (2024-2025)';
}
