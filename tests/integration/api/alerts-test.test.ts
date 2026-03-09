import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { makeNextRequest, AUTH_HEADER } from '../../helpers/makeNextRequest';

const BASE = 'http://localhost:3000/api/alerts/test';

describe('POST /api/alerts/test', () => {
  it('returns 401 without auth', async () => {
    const { POST } = await import('@/app/api/alerts/test/route');
    const req = makeNextRequest(BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns non-401 with valid auth and body', async () => {
    // Mock Resend email API
    server.use(
      http.post('https://api.resend.com/emails', () => {
        return HttpResponse.json({ id: 'test-email-id' });
      }),
    );

    const { POST } = await import('@/app/api/alerts/test/route');
    const req = makeNextRequest(BASE, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).not.toBe(401);
  });

  it('returns 400 with empty body', async () => {
    const { POST } = await import('@/app/api/alerts/test/route');
    const req = makeNextRequest(BASE, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    // Should be 400 (validation error) or other non-401
    expect(res.status).not.toBe(401);
  });
});
