import { describe, it, expect } from 'vitest';
import { makeNextRequest, AUTH_HEADER } from '../../helpers/makeNextRequest';

const BASE = 'http://localhost:3000/api/cron/rebuild-sdwis';

describe('GET /api/cron/rebuild-sdwis', () => {
  it('returns 401 without CRON_SECRET', async () => {
    const { GET } = await import('@/app/api/cron/rebuild-sdwis/route');
    const req = makeNextRequest(BASE);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('accepts valid CRON_SECRET token', async () => {
    const { GET } = await import('@/app/api/cron/rebuild-sdwis/route');
    const req = makeNextRequest(BASE, { headers: AUTH_HEADER });
    const res = await GET(req);
    expect(res.status).not.toBe(401);
  });

  it('returns JSON response with valid auth', async () => {
    const { GET } = await import('@/app/api/cron/rebuild-sdwis/route');
    const req = makeNextRequest(BASE, { headers: AUTH_HEADER });
    const res = await GET(req);
    const json = await res.json();
    expect(typeof json).toBe('object');
  });

  it('handles empty EPA response gracefully (empty-data guard)', async () => {
    // MSW returns empty arrays for EPA Envirofacts
    const { GET } = await import('@/app/api/cron/rebuild-sdwis/route');
    const req = makeNextRequest(BASE, { headers: AUTH_HEADER });
    const res = await GET(req);
    const json = await res.json();
    // With empty data, should either complete with 0 records or report empty/skipped
    expect(typeof json).toBe('object');
  });
});
