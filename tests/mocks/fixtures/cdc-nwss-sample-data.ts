import type { CdcNwssRecord } from '@/lib/cdcNwssCache';

export function makeCdcNwssRecord(overrides: Partial<CdcNwssRecord> = {}): CdcNwssRecord {
  return {
    wwtpId: 'NWSS-MD-001',
    wwtpJurisdiction: 'MD',
    countyFips: '24510',
    countyNames: 'Baltimore City',
    populationServed: 620000,
    dateStart: '2024-06-01',
    dateEnd: '2024-06-15',
    ptc15d: 12.5,
    detectProp15d: 0.85,
    percentile: 65,
    ...overrides,
  };
}
