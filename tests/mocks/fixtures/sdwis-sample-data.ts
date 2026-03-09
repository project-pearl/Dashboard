import type { SdwisSystem, SdwisViolation, SdwisEnforcement } from '@/lib/sdwisCache';

export function makeSdwisSystem(overrides: Partial<SdwisSystem> = {}): SdwisSystem {
  return {
    pwsid: 'MD0300001',
    name: 'Baltimore City DPW',
    type: 'CWS',
    population: 620000,
    sourceWater: 'SW',
    state: 'MD',
    lat: 39.29,
    lng: -76.61,
    ...overrides,
  };
}

export function makeSdwisViolation(overrides: Partial<SdwisViolation> = {}): SdwisViolation {
  return {
    pwsid: 'MD0300001',
    code: '01',
    contaminant: 'Lead and Copper Rule',
    rule: 'Lead and Copper Rule',
    isMajor: true,
    isHealthBased: true,
    compliancePeriod: '2024-Q2',
    lat: 39.29,
    lng: -76.61,
    ...overrides,
  };
}

export function makeSdwisEnforcement(overrides: Partial<SdwisEnforcement> = {}): SdwisEnforcement {
  return {
    pwsid: 'MD0300001',
    actionType: 'Formal',
    date: '2024-03-15',
    lat: 39.29,
    lng: -76.61,
    ...overrides,
  };
}
