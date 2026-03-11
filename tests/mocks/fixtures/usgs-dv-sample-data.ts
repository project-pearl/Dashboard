import type { UsgsDvStation } from '@/lib/usgsDvCache';

export function makeUsgsDvStation(overrides: Partial<UsgsDvStation> = {}): UsgsDvStation {
  return {
    siteId: '01646500',
    name: 'Potomac River at Chain Bridge',
    state: 'DC',
    lat: 38.93,
    lng: -77.12,
    params: {
      '00060': { mean: 5400, min: 4200, max: 7800, unit: 'ft3/s', date: '2024-06-15' },
    },
    ...overrides,
  };
}
