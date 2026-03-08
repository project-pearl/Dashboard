import type { WqpRecord } from '@/lib/wqpCache';

export function makeWqpRecord(overrides: Partial<WqpRecord> = {}): WqpRecord {
  return {
    stn: 'USGS-01646500',
    name: 'Potomac River at Chain Bridge',
    date: '2024-06-15',
    key: 'DO',
    char: 'Dissolved oxygen (DO)',
    val: 8.5,
    unit: 'mg/l',
    org: 'USGS',
    lat: 38.93,
    lng: -77.12,
    state: 'DC',
    ...overrides,
  };
}
