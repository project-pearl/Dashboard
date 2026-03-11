import type { NwmReach } from '@/lib/nwmCache';

export function makeNwmReach(overrides: Partial<NwmReach> = {}): NwmReach {
  return {
    featureId: '2586614',
    lat: 39.0,
    lng: -77.0,
    streamflow: 125.5,
    velocity: 0.85,
    recurrence: 2,
    ...overrides,
  };
}
