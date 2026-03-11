import type { DroughtState } from '@/lib/usdmCache';

export function makeDroughtState(overrides: Partial<DroughtState> = {}): DroughtState {
  return {
    state: 'MD',
    fips: '24',
    date: '2024-06-11',
    none: 65.5,
    d0: 20.0,
    d1: 10.0,
    d2: 4.0,
    d3: 0.5,
    d4: 0,
    ...overrides,
  };
}
