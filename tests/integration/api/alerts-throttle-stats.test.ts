import { describe, it, expect } from 'vitest';
import { makeNextRequest, AUTH_HEADER } from '../../helpers/makeNextRequest';

const BASE = 'http://localhost:3000/api/alerts/throttle-stats';

describe('GET /api/alerts/throttle-stats', () => {
  it('returns 401 without auth', async () => {
    const { GET } = await import('@/app/api/alerts/throttle-stats/route');
    const req = makeNextRequest(BASE);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid auth', async () => {
    const { GET } = await import('@/app/api/alerts/throttle-stats/route');
    const req = makeNextRequest(BASE, { headers: AUTH_HEADER });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('returns throttle stats shape', async () => {
    const { GET } = await import('@/app/api/alerts/throttle-stats/route');
    const req = makeNextRequest(BASE, { headers: AUTH_HEADER });
    const res = await GET(req);
    const json = await res.json();
    expect(json).toHaveProperty('totalTracked');
    expect(json).toHaveProperty('totalThrottled');
    expect(json).toHaveProperty('totalSuppressed');
    expect(json).toHaveProperty('sentThisHour');
    expect(json).toHaveProperty('rateLimitCap');
  });

  it('returns numeric values', async () => {
    const { GET } = await import('@/app/api/alerts/throttle-stats/route');
    const req = makeNextRequest(BASE, { headers: AUTH_HEADER });
    const res = await GET(req);
    const json = await res.json();
    expect(typeof json.totalTracked).toBe('number');
    expect(typeof json.rateLimitCap).toBe('number');
  });
});
