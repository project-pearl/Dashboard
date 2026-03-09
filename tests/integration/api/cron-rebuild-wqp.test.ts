import { describe, it, expect } from 'vitest';
import { makeNextRequest, AUTH_HEADER } from '../../helpers/makeNextRequest';

describe('GET /api/cron/rebuild-wqp', () => {
  it('returns 401 without CRON_SECRET', async () => {
    const { GET } = await import('@/app/api/cron/rebuild-wqp/route');
    const req = makeNextRequest('http://localhost:3000/api/cron/rebuild-wqp');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('accepts valid CRON_SECRET token', async () => {
    const { GET } = await import('@/app/api/cron/rebuild-wqp/route');
    const req = makeNextRequest('http://localhost:3000/api/cron/rebuild-wqp', {
      headers: AUTH_HEADER,
    });
    // This will attempt to run the WQP cron — MSW intercepts the actual API calls.
    // The test validates it doesn't crash and returns a response.
    const res = await GET(req as any);
    // Should be 200 (success) or potentially still building — not 401
    expect(res.status).not.toBe(401);
  });
});
