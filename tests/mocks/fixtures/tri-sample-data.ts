import type { TriFacility } from '@/lib/triCache';

export function makeTriFacility(overrides: Partial<TriFacility> = {}): TriFacility {
  return {
    triId: '21043BTHSTLHWY7',
    facilityName: 'Bethlehem Steel',
    state: 'MD',
    city: 'Sparrows Point',
    county: 'Baltimore',
    lat: 39.22,
    lng: -76.45,
    totalReleases: 15000,
    carcinogenReleases: 500,
    topChemicals: ['Zinc', 'Lead', 'Chromium'],
    industryCode: '3312',
    year: 2023,
    ...overrides,
  };
}
