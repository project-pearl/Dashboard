import type { HefsEnsemble } from '@/lib/hefsCache';

export function makeHefsEnsemble(overrides: Partial<HefsEnsemble> = {}): HefsEnsemble {
  return {
    lid: 'BLTM2',
    name: 'Baltimore Inner Harbor',
    lat: 39.28,
    lng: -76.61,
    state: 'MD',
    quantiles: { q10: 2.5, q25: 3.0, q50: 3.8, q75: 4.5, q90: 5.2 },
    validTime: '2024-06-15T18:00:00Z',
    members: 51,
    ...overrides,
  };
}
