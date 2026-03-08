import { describe, it, expect } from 'vitest';

describe('GET /api/cron/rebuild-wqp', () => {
  it('returns 401 without CRON_SECRET', async () => {
    const { GET } = await import('@/app/api/cron/rebuild-wqp/route');
    const req = new Request('http://localhost:3000/api/cron/rebuild-wqp');
    (req as any).cookies = { has: () => false, get: () => undefined };
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('accepts valid CRON_SECRET token', async () => {
    const { GET } = await import('@/app/api/cron/rebuild-wqp/route');
    const req = new Request('http://localhost:3000/api/cron/rebuild-wqp', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    (req as any).cookies = { has: () => false, get: () => undefined };
    // This will attempt to run the WQP cron — MSW intercepts the actual API calls.
    // The test validates it doesn't crash and returns a response.
    const res = await GET(req as any);
    // Should be 200 (success) or potentially still building — not 401
    expect(res.status).not.toBe(401);
  });
});
