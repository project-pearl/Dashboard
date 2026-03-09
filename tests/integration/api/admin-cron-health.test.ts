import { describe, it, expect } from 'vitest';
import { makeNextRequest, AUTH_HEADER } from '../../helpers/makeNextRequest';

const BASE = 'http://localhost:3000/api/admin/cron-health';

describe('GET /api/admin/cron-health', () => {
  it('returns 401 without auth', async () => {
    const { GET } = await import('@/app/api/admin/cron-health/route');
    const req = makeNextRequest(BASE);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid auth', async () => {
    const { GET } = await import('@/app/api/admin/cron-health/route');
    const req = makeNextRequest(BASE, { headers: AUTH_HEADER });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('returns timestamp and summary', async () => {
    const { GET } = await import('@/app/api/admin/cron-health/route');
    const req = makeNextRequest(BASE, { headers: AUTH_HEADER });
    const res = await GET(req);
    const json = await res.json();
    expect(json).toHaveProperty('timestamp');
    expect(json).toHaveProperty('summary');
  });

  it('returns JSON object with expected keys', async () => {
    const { GET } = await import('@/app/api/admin/cron-health/route');
    const req = makeNextRequest(BASE, { headers: AUTH_HEADER });
    const res = await GET(req);
    const json = await res.json();
    expect(typeof json).toBe('object');
    expect(json).not.toBeNull();
  });
});
