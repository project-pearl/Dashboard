import type { EchoFacility, EchoViolation } from '@/lib/echoCache';

export function makeEchoFacility(overrides: Partial<EchoFacility> = {}): EchoFacility {
  return {
    registryId: '110000350016',
    name: 'Back River WWTP',
    state: 'MD',
    permitId: 'MD0021601',
    lat: 39.24,
    lng: -76.53,
    complianceStatus: 'Violation',
    qtrsInViolation: 3,
    effluentViolations: 5,
    snc: true,
    quarterlyViolations: 2,
    ...overrides,
  };
}

export function makeEchoViolation(overrides: Partial<EchoViolation> = {}): EchoViolation {
  return {
    registryId: '110000350016',
    name: 'Back River WWTP',
    state: 'MD',
    lat: 39.24,
    lng: -76.53,
    violationType: 'Effluent',
    pollutant: 'Total Suspended Solids',
    qtrsInNc: 4,
    ...overrides,
  };
}
