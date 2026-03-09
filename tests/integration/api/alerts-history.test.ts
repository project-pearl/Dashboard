import { describe, it, expect } from 'vitest';
import { makeNextRequest, AUTH_HEADER } from '../../helpers/makeNextRequest';

describe('GET /api/alerts/history', () => {
  it('returns 401 without auth', async () => {
    const { GET } = await import('@/app/api/alerts/history/route');
    const req = makeNextRequest('http://localhost:3000/api/alerts/history');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('returns events array with counts', async () => {
    const { GET } = await import('@/app/api/alerts/history/route');
    const req = makeNextRequest('http://localhost:3000/api/alerts/history', {
      headers: AUTH_HEADER,
    });
    const res = await GET(req as any);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('events');
    expect(Array.isArray(json.events)).toBe(true);
    expect(json).toHaveProperty('totalEvents');
  });
});
