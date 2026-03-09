import { describe, it, expect } from 'vitest';
import { makeNextRequest, AUTH_HEADER } from '../../helpers/makeNextRequest';

describe('GET /api/cache-status', () => {
  it('returns 401 without auth', async () => {
    const { GET } = await import('@/app/api/cache-status/route');
    const req = makeNextRequest('http://localhost:3000/api/cache-status');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid auth and JSON body', async () => {
    const { GET } = await import('@/app/api/cache-status/route');
    const req = makeNextRequest('http://localhost:3000/api/cache-status', {
      headers: AUTH_HEADER,
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    // The response is a large object with many cache keys
    expect(typeof json).toBe('object');
    expect(json).not.toBeNull();
  });

  it('handles all-cold caches gracefully', async () => {
    const { GET } = await import('@/app/api/cache-status/route');
    const req = makeNextRequest('http://localhost:3000/api/cache-status', {
      headers: AUTH_HEADER,
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json).toBe('object');
  });
});
