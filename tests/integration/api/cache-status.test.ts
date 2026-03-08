import { describe, it, expect } from 'vitest';

// Helper to create a NextRequest-like object with cookies support
function makeNextRequest(url: string, init?: RequestInit) {
  const req = new Request(url, init);
  (req as any).cookies = {
    has: () => false,
    get: () => undefined,
  };
  (req as any).nextUrl = new URL(url);
  return req as any;
}

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
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
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
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json).toBe('object');
  });
});
