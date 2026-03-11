import type { NwpsGauge } from '@/lib/nwpsCache';

export function makeNwpsGauge(overrides: Partial<NwpsGauge> = {}): NwpsGauge {
  return {
    lid: 'BLTM2',
    name: 'Baltimore Inner Harbor',
    state: 'MD',
    county: 'Baltimore City',
    lat: 39.28,
    lng: -76.61,
    wfo: 'LWX',
    rfc: { abbreviation: 'MARFC', name: 'Middle Atlantic RFC' },
    status: 'no_flooding',
    observed: { primary: 2.5, unit: 'ft', time: '2024-06-15T12:00:00Z' },
    forecast: { primary: 2.8, unit: 'ft', time: '2024-06-16T12:00:00Z' },
    stageflow: [{ time: '2024-06-15T12:00:00Z', stage: 2.5, flow: null }],
    ...overrides,
  };
}
