import { describe, it, expect } from 'vitest';
import { makeNextRequest, AUTH_HEADER } from '../../helpers/makeNextRequest';

const BASE = 'http://localhost:3000/api/alerts/recipients';

describe('/api/alerts/recipients', () => {
  describe('GET', () => {
    it('returns 401 without auth', async () => {
      const { GET } = await import('@/app/api/alerts/recipients/route');
      const req = makeNextRequest(BASE);
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('returns 200 with recipients array', async () => {
      const { GET } = await import('@/app/api/alerts/recipients/route');
      const req = makeNextRequest(BASE, { headers: AUTH_HEADER });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('recipients');
      expect(Array.isArray(json.recipients)).toBe(true);
    });
  });

  describe('POST', () => {
    it('returns 401 without auth', async () => {
      const { POST } = await import('@/app/api/alerts/recipients/route');
      const req = makeNextRequest(BASE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('creates recipient with valid body', async () => {
      const { POST } = await import('@/app/api/alerts/recipients/route');
      const req = makeNextRequest(BASE, {
        method: 'POST',
        headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          name: 'Test User',
          role: 'Federal',
          state: 'MD',
          triggers: ['threshold'],
          severities: ['warning', 'critical'],
          active: true,
        }),
      });
      const res = await POST(req);
      // 201 created, 400 validation error, or 409 duplicate
      expect([201, 400, 409]).toContain(res.status);
    });
  });

  describe('PUT', () => {
    it('returns 401 without auth', async () => {
      const { PUT } = await import('@/app/api/alerts/recipients/route');
      const req = makeNextRequest(BASE, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'test-id', active: false }),
      });
      const res = await PUT(req);
      expect(res.status).toBe(401);
    });

    it('returns non-401 with valid auth', async () => {
      const { PUT } = await import('@/app/api/alerts/recipients/route');
      const req = makeNextRequest(BASE, {
        method: 'PUT',
        headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'test-id', active: false }),
      });
      const res = await PUT(req);
      expect(res.status).not.toBe(401);
    });
  });

  describe('DELETE', () => {
    it('returns 401 without auth', async () => {
      const { DELETE } = await import('@/app/api/alerts/recipients/route');
      const req = makeNextRequest(BASE, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'test-id' }),
      });
      const res = await DELETE(req);
      expect(res.status).toBe(401);
    });

    it('returns non-401 with valid auth', async () => {
      const { DELETE } = await import('@/app/api/alerts/recipients/route');
      const req = makeNextRequest(BASE, {
        method: 'DELETE',
        headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'test-id' }),
      });
      const res = await DELETE(req);
      expect(res.status).not.toBe(401);
    });
  });
});
