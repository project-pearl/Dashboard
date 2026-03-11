import type { NdbcStation } from '@/lib/ndbcCache';

export function makeNdbcStation(overrides: Partial<NdbcStation> = {}): NdbcStation {
  return {
    id: '44009',
    name: 'Delaware Bay',
    lat: 38.46,
    lng: -74.70,
    type: 'buoy',
    owner: 'NDBC',
    hasMeteo: true,
    hasWQ: false,
    observation: null,
    ocean: null,
    observedAt: '2024-06-15T12:00:00Z',
    adcpCurrentSpeed: null,
    adcpCurrentDir: null,
    tideLevel: null,
    waveHeight: 1.2,
    wavePeriod: 6.5,
    waveDir: 180,
    ...overrides,
  };
}
