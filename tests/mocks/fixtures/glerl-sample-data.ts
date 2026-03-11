import type { GlerlPixel } from '@/lib/glerlCache';

export function makeGlerlPixel(overrides: Partial<GlerlPixel> = {}): GlerlPixel {
  return {
    lat: 43.5,
    lng: -82.0,
    lakeSurfaceTemp: 15.2,
    iceCover: 0,
    time: '2024-06-15T12:00:00Z',
    ...overrides,
  };
}
