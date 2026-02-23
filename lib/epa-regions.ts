// ═══════════════════════════════════════════════════════════════════
// EPA Region Configuration
// Official 10 EPA regions with state mappings and helper functions
// ═══════════════════════════════════════════════════════════════════

export interface EpaRegion {
  id: number;
  name: string;
  states: string[];   // 2-letter abbreviations
  hq: string;         // headquarters city
}

export const EPA_REGIONS: Record<number, EpaRegion> = {
  1:  { id: 1,  name: 'Region 1',  states: ['CT','ME','MA','NH','RI','VT'],                   hq: 'Boston' },
  2:  { id: 2,  name: 'Region 2',  states: ['NJ','NY','PR','VI'],                              hq: 'New York City' },
  3:  { id: 3,  name: 'Region 3',  states: ['DC','DE','MD','PA','VA','WV'],                    hq: 'Philadelphia' },
  4:  { id: 4,  name: 'Region 4',  states: ['AL','FL','GA','KY','MS','NC','SC','TN'],          hq: 'Atlanta' },
  5:  { id: 5,  name: 'Region 5',  states: ['IL','IN','MI','MN','OH','WI'],                    hq: 'Chicago' },
  6:  { id: 6,  name: 'Region 6',  states: ['AR','LA','NM','OK','TX'],                         hq: 'Dallas' },
  7:  { id: 7,  name: 'Region 7',  states: ['IA','KS','MO','NE'],                              hq: 'Lenexa' },
  8:  { id: 8,  name: 'Region 8',  states: ['CO','MT','ND','SD','UT','WY'],                    hq: 'Denver' },
  9:  { id: 9,  name: 'Region 9',  states: ['AZ','CA','HI','NV','AS','GU','MP'],               hq: 'San Francisco' },
  10: { id: 10, name: 'Region 10', states: ['AK','ID','OR','WA'],                              hq: 'Seattle' },
};

// Pre-built reverse lookup for O(1) state → region
const STATE_TO_REGION: Record<string, number> = {};
for (const region of Object.values(EPA_REGIONS)) {
  for (const st of region.states) {
    STATE_TO_REGION[st] = region.id;
  }
}

/** Reverse lookup: state abbreviation → region number */
export function getEpaRegionForState(abbr: string): number | null {
  return STATE_TO_REGION[abbr.toUpperCase()] ?? null;
}

/** Get all state abbreviations for a region */
export function getStatesInRegion(regionId: number): string[] {
  return EPA_REGIONS[regionId]?.states ?? [];
}

/** Get region by ID */
export function getEpaRegion(regionId: number): EpaRegion | null {
  return EPA_REGIONS[regionId] ?? null;
}
