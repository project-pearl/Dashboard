import type { NwisGwSite, NwisGwLevel, NwisGwTrend } from '@/lib/nwisGwCache';

export function makeNwisGwSite(overrides: Partial<NwisGwSite> = {}): NwisGwSite {
  return {
    siteNumber: '390000076300001',
    siteName: 'MD-BA-0001 Baltimore Co Well',
    aquiferCode: '111ALVM',
    wellDepth: 150,
    state: 'MD',
    county: 'Baltimore',
    huc: '02060003',
    lat: 39.0,
    lng: -76.3,
    ...overrides,
  };
}

export function makeNwisGwLevel(overrides: Partial<NwisGwLevel> = {}): NwisGwLevel {
  return {
    siteNumber: '390000076300001',
    dateTime: '2024-06-15T12:00:00',
    value: 25.5,
    unit: 'ft below land surface',
    parameterCd: '72019',
    parameterName: 'Depth to water level',
    qualifier: 'A',
    isRealtime: false,
    lat: 39.0,
    lng: -76.3,
    ...overrides,
  };
}

export function makeNwisGwTrend(overrides: Partial<NwisGwTrend> = {}): NwisGwTrend {
  return {
    siteNumber: '390000076300001',
    siteName: 'MD-BA-0001 Baltimore Co Well',
    latestLevel: 25.5,
    latestDate: '2024-06-15',
    avgLevel30d: 26.0,
    avgLevel90d: 27.0,
    trend: 'rising',
    trendMagnitude: 1.5,
    lat: 39.0,
    lng: -76.3,
    ...overrides,
  };
}
