import { describe, it, expect } from 'vitest';
import { makeNextRequest } from '../../helpers/makeNextRequest';

const BASE = 'http://localhost:3000/api/pfas/national-summary';

describe('GET /api/pfas/national-summary', () => {
  it('returns 200 without auth (public endpoint)', async () => {
    const { GET } = await import('@/app/api/pfas/national-summary/route');
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('returns results array', async () => {
    const { GET } = await import('@/app/api/pfas/national-summary/route');
    const res = await GET();
    const json = await res.json();
    expect(json).toHaveProperty('results');
    expect(Array.isArray(json.results)).toBe(true);
  });

  it('handles cold cache gracefully', async () => {
    const { GET } = await import('@/app/api/pfas/national-summary/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toBeDefined();
  });
});
