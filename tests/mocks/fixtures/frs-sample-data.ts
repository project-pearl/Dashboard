import type { FrsFacility } from '@/lib/frsCache';

export function makeFrsFacility(overrides: Partial<FrsFacility> = {}): FrsFacility {
  return {
    registryId: '110000350016',
    name: 'Back River WWTP',
    state: 'MD',
    lat: 39.24,
    lng: -76.53,
    pgmSysId: 'MD0021601',
    postalCode: '21220',
    county: 'Baltimore',
    ...overrides,
  };
}
