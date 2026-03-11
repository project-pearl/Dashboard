import type { UsgsIvSite, UsgsIvReading } from '@/lib/nwisIvCache';

export function makeUsgsIvSite(overrides: Partial<UsgsIvSite> = {}): UsgsIvSite {
  return {
    siteNumber: '01646500',
    siteName: 'Potomac River at Chain Bridge',
    siteType: 'ST',
    state: 'DC',
    huc: '02070008',
    lat: 38.93,
    lng: -77.12,
    parameterCodes: ['00060', '00065'],
    ...overrides,
  };
}

export function makeUsgsIvReading(overrides: Partial<UsgsIvReading> = {}): UsgsIvReading {
  return {
    siteNumber: '01646500',
    dateTime: '2024-06-15T12:00:00Z',
    parameterCd: '00060',
    parameterName: 'Discharge',
    value: 5400,
    unit: 'ft3/s',
    qualifier: 'P',
    lat: 38.93,
    lng: -77.12,
    ...overrides,
  };
}
