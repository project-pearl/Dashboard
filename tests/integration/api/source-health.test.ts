import { describe, it, expect } from 'vitest';
import { makeNextRequest } from '../../helpers/makeNextRequest';

const BASE = 'http://localhost:3000/api/source-health';

describe('GET /api/source-health', () => {
  it('returns 200 without auth (public endpoint)', async () => {
    const { GET } = await import('@/app/api/source-health/route');
    const res = await GET();
    expect(res.status).toBe(200);
  }, 30_000);

  it('returns timestamp in response', async () => {
    const { GET } = await import('@/app/api/source-health/route');
    const res = await GET();
    const json = await res.json();
    expect(json).toHaveProperty('timestamp');
  }, 30_000);

  it('returns sources array', async () => {
    const { GET } = await import('@/app/api/source-health/route');
    const res = await GET();
    const json = await res.json();
    expect(json).toHaveProperty('sources');
    expect(Array.isArray(json.sources)).toBe(true);
  }, 30_000);

  it('returns datapoints object', async () => {
    const { GET } = await import('@/app/api/source-health/route');
    const res = await GET();
    const json = await res.json();
    expect(json).toHaveProperty('datapoints');
    expect(typeof json.datapoints).toBe('object');
  }, 30_000);
});
