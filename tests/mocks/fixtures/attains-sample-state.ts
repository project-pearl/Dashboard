import type { StateSummary, CachedWaterbody } from '@/lib/attainsCache';

export function makeWaterbody(overrides: Partial<CachedWaterbody> = {}): CachedWaterbody {
  return {
    id: 'MD-02130903',
    name: 'Middle Branch Patapsco River',
    category: '5',
    alertLevel: 'high',
    tmdlStatus: 'needed',
    causes: ['Nutrients', 'Sediment'],
    causeCount: 2,
    lat: 39.26,
    lon: -76.62,
    waterType: 'RIVER/STREAM',
    ...overrides,
  };
}

export function makeStateSummary(overrides: Partial<StateSummary> = {}): StateSummary {
  return {
    state: 'MD',
    total: 100,
    fetched: 80,
    stored: 80,
    high: 30,
    medium: 20,
    low: 15,
    none: 35,
    tmdlNeeded: 30,
    tmdlCompleted: 15,
    tmdlAlternative: 5,
    topCauses: ['Nutrients', 'Sediment', 'Pathogens', 'Temperature', 'Metals (Other than Mercury)'],
    waterTypeCounts: { 'RIVER/STREAM': 60, 'LAKE/RESERVOIR': 20 },
    waterbodies: [makeWaterbody()],
    ...overrides,
  };
}
