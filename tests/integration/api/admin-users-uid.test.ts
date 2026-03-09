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
      admin: {
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
      },
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
          delete: () => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {};
    },
  }),
}));

const BASE = 'http://localhost:3000/api/admin/users/target-uid';

describe('DELETE /api/admin/users/[uid]', () => {
  it('returns 401 without auth token', async () => {
    const { DELETE } = await import('@/app/api/admin/users/[uid]/route');
    const req = makeNextRequest(BASE, { method: 'DELETE' });
    const res = await DELETE(req, { params: { uid: 'target-uid' } });
    expect(res.status).toBe(401);
  });

  it('returns non-401 with Bearer token', async () => {
    const { DELETE } = await import('@/app/api/admin/users/[uid]/route');
    const req = makeNextRequest(BASE, {
      method: 'DELETE',
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = await DELETE(req, { params: { uid: 'target-uid' } });
    expect(res.status).not.toBe(401);
  });

  it('returns 400 without uid param', async () => {
    const { DELETE } = await import('@/app/api/admin/users/[uid]/route');
    const req = makeNextRequest('http://localhost:3000/api/admin/users/', {
      method: 'DELETE',
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = await DELETE(req, { params: { uid: '' } });
    expect(res.status).toBe(400);
  });

  it('prevents self-deletion', async () => {
    const { DELETE } = await import('@/app/api/admin/users/[uid]/route');
    const req = makeNextRequest('http://localhost:3000/api/admin/users/caller-uid', {
      method: 'DELETE',
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = await DELETE(req, { params: { uid: 'caller-uid' } });
    // Should be 400 or 403 (can't delete yourself)
    expect([400, 403]).toContain(res.status);
  });

  it('returns JSON response', async () => {
    const { DELETE } = await import('@/app/api/admin/users/[uid]/route');
    const req = makeNextRequest(BASE, {
      method: 'DELETE',
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = await DELETE(req, { params: { uid: 'target-uid' } });
    const json = await res.json();
    expect(typeof json).toBe('object');
  });
});
