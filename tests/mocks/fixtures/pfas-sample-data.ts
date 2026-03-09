import type { PfasResult } from '@/lib/pfasCache';

export function makePfasResult(overrides: Partial<PfasResult> = {}): PfasResult {
  return {
    facilityName: 'Potomac WTP',
    state: 'MD',
    contaminant: 'PFOS',
    resultValue: 4.2,
    detected: true,
    sampleDate: '2024-06-15',
    lat: 39.0,
    lng: -77.0,
    ...overrides,
  };
}
