import type { HabObservation } from '@/lib/habsosCache';

export function makeHabObservation(overrides: Partial<HabObservation> = {}): HabObservation {
  return {
    lat: 30.0,
    lng: -88.0,
    state: 'MS',
    genus: 'Karenia',
    cellCount: 50000,
    sampleDate: '2024-06-15',
    description: 'Medium concentration bloom',
    ...overrides,
  };
}
