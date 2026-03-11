import type { BeachAdvisory } from '@/lib/beaconCache';

export function makeBeachAdvisory(overrides: Partial<BeachAdvisory> = {}): BeachAdvisory {
  return {
    beachId: 'MD001',
    beachName: 'Sandy Point State Park',
    state: 'MD',
    lat: 39.01,
    lng: -76.40,
    indicator: 'Enterococcus',
    value: 104,
    advisoryStatus: 'Advisory',
    sampleDate: '2024-06-15',
    notificationDate: '2024-06-15',
    ...overrides,
  };
}
