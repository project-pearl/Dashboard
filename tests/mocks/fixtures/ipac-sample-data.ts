import type { IpacStateData } from '@/lib/ipacCache';

export function makeIpacStateData(overrides: Partial<IpacStateData> = {}): IpacStateData {
  return {
    state: 'MD',
    totalListed: 25,
    endangered: 10,
    threatened: 12,
    candidate: 3,
    aquaticSpecies: ['Atlantic sturgeon', 'Dwarf wedgemussel'],
    ...overrides,
  };
}
