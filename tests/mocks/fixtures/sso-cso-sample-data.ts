import type { SsoEvent } from '@/lib/ssoCsoCache';

export function makeSsoEvent(overrides: Partial<SsoEvent> = {}): SsoEvent {
  return {
    npdesId: 'MD0021601',
    facilityName: 'Back River WWTP',
    state: 'MD',
    lat: 39.24,
    lng: -76.53,
    eventType: 'SSO',
    startDate: '2024-06-10',
    endDate: '2024-06-11',
    volume: 50000,
    duration: 24,
    receivingWater: 'Back River',
    cause: 'Equipment failure',
    ...overrides,
  };
}
