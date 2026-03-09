import { describe, it, expect } from 'vitest';
import { makeNextRequest, AUTH_HEADER } from '../../helpers/makeNextRequest';

const BASE = 'http://localhost:3000/api/alerts/suppress';

describe('/api/alerts/suppress', () => {
  describe('GET', () => {
    it('returns 401 without auth', async () => {
      const { GET } = await import('@/app/api/alerts/suppress/route');
      const req = makeNextRequest(BASE);
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('returns 200 with suppressions array', async () => {
      const { GET } = await import('@/app/api/alerts/suppress/route');
      const req = makeNextRequest(BASE, { headers: AUTH_HEADER });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('suppressions');
      expect(Array.isArray(json.suppressions)).toBe(true);
    });
  });

  describe('POST', () => {
    it('returns 401 without auth', async () => {
      const { POST } = await import('@/app/api/alerts/suppress/route');
      const req = makeNextRequest(BASE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dedupKey: 'test-key' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('creates suppression with valid body', async () => {
      const { POST } = await import('@/app/api/alerts/suppress/route');
      const req = makeNextRequest(BASE, {
        method: 'POST',
        headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
        body: JSON.stringify({
          dedupKey: 'test-dedup-key',
          reason: 'Test suppression',
        }),
      });
      const res = await POST(req);
      expect([201, 400]).toContain(res.status);
    });
  });

  describe('DELETE', () => {
    it('returns 401 without auth', async () => {
      const { DELETE } = await import('@/app/api/alerts/suppress/route');
      const req = makeNextRequest(BASE, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dedupKey: 'test-key' }),
      });
      const res = await DELETE(req);
      expect(res.status).toBe(401);
    });

    it('returns non-401 with valid auth', async () => {
      const { DELETE } = await import('@/app/api/alerts/suppress/route');
      const req = makeNextRequest(BASE, {
        method: 'DELETE',
        headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
        body: JSON.stringify({ dedupKey: 'test-key' }),
      });
      const res = await DELETE(req);
      expect(res.status).not.toBe(401);
    });
  });
});
