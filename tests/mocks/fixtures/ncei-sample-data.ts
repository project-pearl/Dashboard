import type { NceiStateClimate } from '@/lib/nceiCache';

export function makeNceiStateClimate(overrides: Partial<NceiStateClimate> = {}): NceiStateClimate {
  return {
    state: 'MD',
    fips: '24',
    recentPrecip: 3.8,
    precipAnomaly: 0.5,
    precipNormal: 3.3,
    period: '2024-06',
    ...overrides,
  };
}
