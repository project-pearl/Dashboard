import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const DISK_FILE = path.join(process.cwd(), '.cache', 'outreach-targets.json');

// Clean disk state before each test to avoid cross-test contamination
beforeEach(() => {
  try { if (fs.existsSync(DISK_FILE)) fs.unlinkSync(DISK_FILE); } catch { /* ignore */ }
  vi.resetModules();
});

afterAll(() => {
  try { if (fs.existsSync(DISK_FILE)) fs.unlinkSync(DISK_FILE); } catch { /* ignore */ }
});

describe('targetCache', () => {
  it('returns empty array on cold start', async () => {
    const { loadTargets } = await import('@/lib/outreach/targetCache');
    const targets = await loadTargets();
    expect(Array.isArray(targets)).toBe(true);
    expect(targets).toHaveLength(0);
  });

  it('round-trips targets through save/load', async () => {
    const { saveTargets } = await import('@/lib/outreach/targetCache');

    const sample = [
      {
        id: 'tgt_1',
        orgName: 'DARPA',
        orgType: 'federal' as const,
        whyTarget: 'They fund water security R&D',
        status: 'pending' as const,
        createdAt: '2026-03-14T00:00:00Z',
      },
      {
        id: 'tgt_2',
        orgName: 'EPA Office of Water',
        orgType: 'federal' as const,
        whyTarget: 'Primary regulator',
        status: 'researched' as const,
        createdAt: '2026-03-14T00:00:00Z',
        aiResearch: {
          summary: 'EPA Office of Water oversees...',
          relevance: 'PIN provides real-time data...',
          keyRoles: ['Program Manager'],
          painPoints: ['Legacy systems'],
          talkingPoints: ['Real-time compliance'],
          approachStrategy: 'Start with regional offices',
          generatedAt: '2026-03-14T01:00:00Z',
        },
      },
    ];

    await saveTargets(sample);

    // Re-import to get fresh module that reads from disk
    vi.resetModules();
    const mod2 = await import('@/lib/outreach/targetCache');
    const loaded = await mod2.loadTargets();

    expect(loaded).toHaveLength(2);
    expect(loaded[0].orgName).toBe('DARPA');
    expect(loaded[1].orgName).toBe('EPA Office of Water');
    expect(loaded[1].aiResearch?.summary).toBe('EPA Office of Water oversees...');
  });

  it('overwrites previous data on save', async () => {
    const { saveTargets } = await import('@/lib/outreach/targetCache');

    await saveTargets([
      {
        id: 'tgt_a',
        orgName: 'Org A',
        orgType: 'utility',
        whyTarget: 'Test',
        status: 'pending',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]);

    await saveTargets([
      {
        id: 'tgt_b',
        orgName: 'Org B',
        orgType: 'military',
        whyTarget: 'Test 2',
        status: 'pending',
        createdAt: '2026-01-02T00:00:00Z',
      },
    ]);

    vi.resetModules();
    const mod2 = await import('@/lib/outreach/targetCache');
    const loaded = await mod2.loadTargets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].orgName).toBe('Org B');
  });
});
