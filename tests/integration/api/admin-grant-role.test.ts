import { describe, it, expect, vi } from 'vitest';
import { makeNextRequest } from '../../helpers/makeNextRequest';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: { id: 'caller-uid', email: 'doug@project-pearl.org' },
        },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { admin_level: 'super_admin', email: 'doug@project-pearl.org' },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'invite_audit_log') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    },
  }),
}));

const BASE = 'http://localhost:3000/api/admin/grant-role-admin';

describe('POST /api/admin/grant-role-admin', () => {
  it('returns 401 without auth token', async () => {
    const { POST } = await import('@/app/api/admin/grant-role-admin/route');
    const req = makeNextRequest(BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetUserId: 'target-uid', adminLevel: 'role_admin' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns non-401 with Bearer token', async () => {
    const { POST } = await import('@/app/api/admin/grant-role-admin/route');
    const req = makeNextRequest(BASE, {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ targetUserId: 'target-uid', adminLevel: 'role_admin' }),
    });
    const res = await POST(req);
    // With mocked Supabase, should not be 401
    expect(res.status).not.toBe(401);
  });

  it('returns 400 with empty body', async () => {
    const { POST } = await import('@/app/api/admin/grant-role-admin/route');
    const req = makeNextRequest(BASE, {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns JSON response', async () => {
    const { POST } = await import('@/app/api/admin/grant-role-admin/route');
    const req = makeNextRequest(BASE, {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ targetUserId: 'target-uid', adminLevel: 'role_admin' }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(typeof json).toBe('object');
  });
});
