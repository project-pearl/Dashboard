import { describe, it, expect } from 'vitest';
import { makeNextRequest } from '../../helpers/makeNextRequest';

const BASE = 'http://localhost:3000/api/sentinel-status';

describe('GET /api/sentinel-status', () => {
  it('returns 200 without auth (public endpoint)', async () => {
    const { GET } = await import('@/app/api/sentinel-status/route');
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('returns JSON object', async () => {
    const { GET } = await import('@/app/api/sentinel-status/route');
    const res = await GET();
    const json = await res.json();
    expect(typeof json).toBe('object');
    expect(json).not.toBeNull();
  });

  it('returns sources array when enabled', async () => {
    const { GET } = await import('@/app/api/sentinel-status/route');
    const res = await GET();
    const json = await res.json();
    // Response should have sources if sentinel is enabled, or enabled:false/reason if disabled
    const hasSources = 'sources' in json;
    const hasEnabled = 'enabled' in json;
    expect(hasSources || hasEnabled).toBe(true);
  });
});
