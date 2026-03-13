import type { BwbStation } from '@/lib/bwbCache';

export function makeBwbStation(overrides: Partial<BwbStation> = {}): BwbStation {
  return {
    stationId: 1,
    datasetId: 100,
    name: 'Chesapeake Bay Station Alpha',
    lat: 38.93,
    lng: -76.38,
    isActive: true,
    lastSampled: '2024-06-15',
    parameters: [{ name: 'Dissolved Oxygen', normalizedName: 'DO', unit: 'mg/L', latestValue: 7.5, latestDate: '2024-06-15' }],
    ...overrides,
  };
}
