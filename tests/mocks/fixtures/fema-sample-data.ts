import type { FemaDeclaration, NfipCommunity, StateRiskIndex } from '@/lib/femaCache';

export function makeFemaDeclaration(overrides: Partial<FemaDeclaration> = {}): FemaDeclaration {
  return {
    disasterNumber: 4757,
    state: 'MD',
    declarationDate: '2024-06-01T00:00:00Z',
    incidentType: 'Flood',
    declarationTitle: 'Severe Storms and Flooding',
    declarationType: 'Major Disaster',
    designatedArea: 'Baltimore County (County)',
    fipsStateCode: '24',
    fipsCountyCode: '005',
    ...overrides,
  };
}

export function makeNfipCommunity(overrides: Partial<NfipCommunity> = {}): NfipCommunity {
  return {
    communityId: '240001',
    communityName: 'Baltimore County',
    state: 'MD',
    countyFips: '24005',
    status: 'Regular',
    crsClass: 7,
    ...overrides,
  };
}

export function makeStateRiskIndex(overrides: Partial<StateRiskIndex> = {}): StateRiskIndex {
  return {
    state: 'MD',
    riskScore: 15.3,
    expectedAnnualLoss: 2500000,
    socialVulnerability: 0.45,
    communityResilience: 0.62,
    ...overrides,
  };
}
