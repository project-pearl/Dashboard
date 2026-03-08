import { describe, it, expect } from 'vitest';
import { isAuthorized, isCronAuthorized } from '@/lib/apiAuth';

// Minimal mock of NextRequest for testing
function makeRequest(opts: {
  authorization?: string;
  origin?: string;
  referer?: string;
  host?: string;
  cookies?: Record<string, string>;
} = {}) {
  const headers = new Headers();
  if (opts.authorization) headers.set('authorization', opts.authorization);
  if (opts.origin) headers.set('origin', opts.origin);
  if (opts.referer) headers.set('referer', opts.referer);
  if (opts.host) headers.set('host', opts.host);

  const cookieStore = {
    has: (name: string) => !!(opts.cookies && name in opts.cookies),
    get: (name: string) => opts.cookies?.[name] ? { name, value: opts.cookies[name] } : undefined,
  };

  return { headers, cookies: cookieStore } as any;
}

describe('isAuthorized', () => {
  it('accepts valid CRON_SECRET Bearer token', () => {
    const req = makeRequest({ authorization: 'Bearer test-cron-secret' });
    expect(isAuthorized(req)).toBe(true);
  });

  it('rejects invalid Bearer token', () => {
    const req = makeRequest({ authorization: 'Bearer wrong-secret' });
    expect(isAuthorized(req)).toBe(false);
  });

  it('accepts same-origin via origin header', () => {
    const req = makeRequest({
      origin: 'https://dashboard.example.com',
      host: 'dashboard.example.com',
    });
    expect(isAuthorized(req)).toBe(true);
  });

  it('accepts same-origin via referer header', () => {
    const req = makeRequest({
      referer: 'https://dashboard.example.com/api/test',
      host: 'dashboard.example.com',
    });
    expect(isAuthorized(req)).toBe(true);
  });

  it('rejects cross-origin requests', () => {
    const req = makeRequest({
      origin: 'https://evil.com',
      host: 'dashboard.example.com',
    });
    expect(isAuthorized(req)).toBe(false);
  });

  it('accepts pin_session cookie', () => {
    const req = makeRequest({
      cookies: { pin_session: 'some-session-value' },
    });
    expect(isAuthorized(req)).toBe(true);
  });
});

describe('isCronAuthorized', () => {
  it('accepts valid CRON_SECRET', () => {
    const req = makeRequest({ authorization: 'Bearer test-cron-secret' });
    expect(isCronAuthorized(req)).toBe(true);
  });

  it('rejects invalid token', () => {
    const req = makeRequest({ authorization: 'Bearer wrong' });
    expect(isCronAuthorized(req)).toBe(false);
  });

  it('rejects when CRON_SECRET is unset', () => {
    const original = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    const req = makeRequest({ authorization: 'Bearer test-cron-secret' });
    expect(isCronAuthorized(req)).toBe(false);
    process.env.CRON_SECRET = original;
  });
});
