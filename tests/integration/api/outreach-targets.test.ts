import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeNextRequest, AUTH_HEADER } from '../../helpers/makeNextRequest';

const BASE = 'http://localhost:3000/api/outreach/targets';

describe('/api/outreach/targets', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('GET', () => {
    it('returns 401 without auth', async () => {
      const { GET } = await import('@/app/api/outreach/targets/route');
      const req = makeNextRequest(BASE);
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('returns 200 with targets array', async () => {
      const { GET } = await import('@/app/api/outreach/targets/route');
      const req = makeNextRequest(BASE, { headers: AUTH_HEADER });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('targets');
      expect(Array.isArray(json.targets)).toBe(true);
    });
  });

  describe('POST', () => {
    it('returns 401 without auth', async () => {
      const { POST } = await import('@/app/api/outreach/targets/route');
      const req = makeNextRequest(BASE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgName: 'Test', orgType: 'federal', whyTarget: 'Test' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('returns 400 with invalid body', async () => {
      const { POST } = await import('@/app/api/outreach/targets/route');
      const req = makeNextRequest(BASE, {
        method: 'POST',
        headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('creates target with valid body', async () => {
      const { POST } = await import('@/app/api/outreach/targets/route');
      const req = makeNextRequest(BASE, {
        method: 'POST',
        headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
        body: JSON.stringify({
          orgName: `TestOrg_${Date.now()}`,
          orgType: 'federal',
          whyTarget: 'They fund water security R&D',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.target).toHaveProperty('id');
      expect(json.target.status).toBe('pending');
    });

    it('rejects invalid orgType', async () => {
      const { POST } = await import('@/app/api/outreach/targets/route');
      const req = makeNextRequest(BASE, {
        method: 'POST',
        headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
        body: JSON.stringify({
          orgName: 'Test',
          orgType: 'invalid_type',
          whyTarget: 'Test reason',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE', () => {
    it('returns 401 without auth', async () => {
      const { DELETE } = await import('@/app/api/outreach/targets/route');
      const req = makeNextRequest(`${BASE}?id=test-id`, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(401);
    });

    it('returns 400 without id param', async () => {
      const { DELETE } = await import('@/app/api/outreach/targets/route');
      const req = makeNextRequest(BASE, {
        method: 'DELETE',
        headers: AUTH_HEADER,
      });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('returns 404 for nonexistent id', async () => {
      const { DELETE } = await import('@/app/api/outreach/targets/route');
      const req = makeNextRequest(`${BASE}?id=nonexistent`, {
        method: 'DELETE',
        headers: AUTH_HEADER,
      });
      const res = await DELETE(req);
      expect(res.status).toBe(404);
    });
  });
});
