import { describe, it, expect } from 'vitest';
import { makeNextRequest, AUTH_HEADER } from '../../helpers/makeNextRequest';

const BASE = 'http://localhost:3000/api/cache-refresh';

describe('POST /api/cache-refresh', () => {
  it('returns 401 without auth', async () => {
    const { POST } = await import('@/app/api/cache-refresh/route');
    const req = makeNextRequest(BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'icis', scopeKey: 'MD' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 with missing source', async () => {
    const { POST } = await import('@/app/api/cache-refresh/route');
    const req = makeNextRequest(BASE, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 with empty body', async () => {
    const { POST } = await import('@/app/api/cache-refresh/route');
    const req = makeNextRequest(BASE, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
      body: JSON.stringify({ source: '' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns non-401 with valid auth and valid source', async () => {
    const { POST } = await import('@/app/api/cache-refresh/route');
    const req = makeNextRequest(BASE, {
      method: 'POST',
      headers: { ...AUTH_HEADER, 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'icis', scopeKey: 'MD' }),
    });
    const res = await POST(req);
    // May succeed, error, or timeout — but should not be 401
    expect(res.status).not.toBe(401);
  }, 30000);
});
