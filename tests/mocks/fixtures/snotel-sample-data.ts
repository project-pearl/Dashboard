import type { SnotelStation } from '@/lib/snotelCache';

export function makeSnotelStation(overrides: Partial<SnotelStation> = {}): SnotelStation {
  return {
    id: '1050',
    name: 'Hogg Pass',
    state: 'OR',
    lat: 44.42,
    lng: -121.85,
    elevation: 4860,
    snowWaterEquiv: 12.5,
    snowDepth: 38,
    precip: 45.2,
    avgTemp: -2.1,
    observedDate: '2024-03-15',
    ...overrides,
  };
}
