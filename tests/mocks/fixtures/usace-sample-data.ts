import type { UsaceLocation } from '@/lib/usaceCache';

export function makeUsaceLocation(overrides: Partial<UsaceLocation> = {}): UsaceLocation {
  return {
    name: 'Conowingo Dam',
    office: 'Baltimore',
    lat: 39.66,
    lng: -76.17,
    type: 'Dam',
    nearestCity: 'Conowingo',
    state: 'MD',
    waterTemp: 18.5,
    waterTempTime: '2024-06-15T12:00:00',
    poolLevel: 109.2,
    poolLevelTime: '2024-06-15T12:00:00',
    ...overrides,
  };
}
