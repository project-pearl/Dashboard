import type { IcisPermit, IcisViolation, IcisDmr, IcisEnforcement, IcisInspection } from '@/lib/icisCache';

export function makeIcisPermit(overrides: Partial<IcisPermit> = {}): IcisPermit {
  return {
    permit: 'MD0021601',
    facility: 'Back River WWTP',
    state: 'MD',
    status: 'Effective',
    type: 'Individual',
    expiration: '2025-12-31',
    flow: 180,
    lat: 39.24,
    lng: -76.53,
    ...overrides,
  };
}

export function makeIcisViolation(overrides: Partial<IcisViolation> = {}): IcisViolation {
  return {
    permit: 'MD0021601',
    code: 'D80',
    desc: 'Effluent violation',
    date: '2024-06-01',
    rnc: true,
    severity: 'Category I',
    lat: 39.24,
    lng: -76.53,
    ...overrides,
  };
}

export function makeIcisDmr(overrides: Partial<IcisDmr> = {}): IcisDmr {
  return {
    permit: 'MD0021601',
    paramDesc: 'Biochemical Oxygen Demand',
    pearlKey: 'BOD',
    dmrValue: 35,
    limitValue: 30,
    unit: 'mg/l',
    exceedance: true,
    period: '2024-06-30',
    lat: 39.24,
    lng: -76.53,
    ...overrides,
  };
}

export function makeIcisEnforcement(overrides: Partial<IcisEnforcement> = {}): IcisEnforcement {
  return {
    permit: 'MD0021601',
    caseNumber: 'CWA-03-2024-0001',
    actionType: 'Consent Order',
    penaltyAssessed: 50000,
    penaltyCollected: 25000,
    settlementDate: '2024-03-15',
    lat: 39.24,
    lng: -76.53,
    ...overrides,
  };
}

export function makeIcisInspection(overrides: Partial<IcisInspection> = {}): IcisInspection {
  return {
    permit: 'MD0021601',
    type: 'Compliance Evaluation',
    date: '2024-01-15',
    complianceStatus: 'In Violation',
    leadAgency: 'EPA',
    lat: 39.24,
    lng: -76.53,
    ...overrides,
  };
}
