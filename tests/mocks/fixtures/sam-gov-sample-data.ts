import type { SamEntity } from '@/lib/samGovCache';

export function makeSamEntity(overrides: Partial<SamEntity> = {}): SamEntity {
  return {
    ueiSAM: 'ABC123DEF456',
    cageCode: '1A2B3',
    legalBusinessName: 'Test Environmental Services LLC',
    dbaName: 'Test Enviro',
    city: 'Baltimore',
    stateCode: 'MD',
    zipCode: '21201',
    primaryNaics: '562910',
    naicsDescription: 'Remediation Services',
    businessType: 'Small Business',
    registrationStatus: 'Active',
    registrationDate: '2020-01-15',
    expirationDate: '2025-01-15',
    entityUrl: 'https://sam.gov/entity/ABC123DEF456',
    ...overrides,
  };
}
