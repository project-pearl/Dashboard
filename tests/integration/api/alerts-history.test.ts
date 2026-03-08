import { describe, it, expect } from 'vitest';

describe('GET /api/alerts/history', () => {
  it('returns 401 without auth', async () => {
    const { GET } = await import('@/app/api/alerts/history/route');
    const url = 'http://localhost:3000/api/alerts/history';
    const req = new Request(url);
    // NextRequest-like: needs nextUrl
    (req as any).nextUrl = new URL(url);
    (req as any).cookies = { has: () => false, get: () => undefined };
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('returns events array with counts', async () => {
    const { GET } = await import('@/app/api/alerts/history/route');
    const url = 'http://localhost:3000/api/alerts/history';
    const req = new Request(url, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    (req as any).nextUrl = new URL(url);
    (req as any).cookies = { has: () => false, get: () => undefined };
    const res = await GET(req as any);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('events');
    expect(Array.isArray(json.events)).toBe(true);
    expect(json).toHaveProperty('totalEvents');
  });
});
