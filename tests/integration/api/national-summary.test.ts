import { describe, it, expect } from 'vitest';
import { makeNextRequest } from '../../helpers/makeNextRequest';

const BASE = 'http://localhost:3000/api/national-summary';

describe('GET /api/national-summary', () => {
  it('returns 200 without auth (public endpoint)', async () => {
    const { GET } = await import('@/app/api/national-summary/route');
    const req = makeNextRequest(BASE);
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('returns JSON response', async () => {
    const { GET } = await import('@/app/api/national-summary/route');
    const req = makeNextRequest(BASE);
    const res = await GET(req);
    const json = await res.json();
    expect(typeof json).toBe('object');
    expect(json).not.toBeNull();
  });

  it('handles cold caches gracefully', async () => {
    const { GET } = await import('@/app/api/national-summary/route');
    const req = makeNextRequest(BASE);
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
