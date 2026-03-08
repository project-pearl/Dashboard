import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gridKey, neighborKeys, computeCacheDelta, loadCacheFromDisk, saveCacheToDisk, exportDeltaLog } from '@/lib/cacheUtils';

// ── gridKey ──────────────────────────────────────────────────────────────────

describe('gridKey', () => {
  it('returns correct key for standard coords', () => {
    expect(gridKey(38.93, -77.12)).toBe('38.9_-77.2');
  });

  it('handles negative coordinates', () => {
    const key = gridKey(-33.87, -58.38);
    expect(key).toMatch(/^-\d+(\.\d+)?_-\d+(\.\d+)?$/);
  });

  it('handles zero crossing', () => {
    expect(gridKey(0.05, -0.05)).toBe('0_-0.1');
  });

  it('handles exact boundary values', () => {
    const key = gridKey(39.0, -77.0);
    expect(key).toBe('39_-77');
  });

  it('rounds consistently at 0.1° resolution', () => {
    // 38.95 should floor to 38.9
    expect(gridKey(38.95, -77.05)).toBe('38.9_-77.1');
    // 38.99 should still floor to 38.9
    expect(gridKey(38.99, -77.09)).toBe('38.9_-77.1');
  });
});

// ── neighborKeys ─────────────────────────────────────────────────────────────

describe('neighborKeys', () => {
  it('returns 9 keys', () => {
    const keys = neighborKeys(38.93, -77.12);
    expect(keys).toHaveLength(9);
  });

  it('returns unique keys', () => {
    const keys = neighborKeys(38.93, -77.12);
    const unique = new Set(keys);
    expect(unique.size).toBe(9);
  });

  it('center key matches gridKey', () => {
    const lat = 38.93;
    const lng = -77.12;
    const keys = neighborKeys(lat, lng);
    const center = gridKey(lat, lng);
    expect(keys).toContain(center);
  });
});

// ── computeCacheDelta ────────────────────────────────────────────────────────

describe('computeCacheDelta', () => {
  it('handles no previous data', () => {
    const delta = computeCacheDelta(null, { records: 100 }, null);
    expect(delta.dataChanged).toBe(true);
    expect(delta.previousBuild).toBeNull();
    expect(delta.counts.records.before).toBe(0);
    expect(delta.counts.records.after).toBe(100);
    expect(delta.counts.records.diff).toBe(100);
  });

  it('detects identical counts as no change', () => {
    const delta = computeCacheDelta({ records: 100 }, { records: 100 }, '2024-01-01T00:00:00Z');
    expect(delta.dataChanged).toBe(false);
    expect(delta.counts.records.diff).toBe(0);
  });

  it('detects increases', () => {
    const delta = computeCacheDelta({ records: 50 }, { records: 100 }, '2024-01-01T00:00:00Z');
    expect(delta.dataChanged).toBe(true);
    expect(delta.counts.records.diff).toBe(50);
  });

  it('detects decreases', () => {
    const delta = computeCacheDelta({ records: 100 }, { records: 80 }, '2024-01-01T00:00:00Z');
    expect(delta.dataChanged).toBe(true);
    expect(delta.counts.records.diff).toBe(-20);
  });

  it('tracks state additions', () => {
    const delta = computeCacheDelta(
      { records: 100 },
      { records: 150 },
      '2024-01-01T00:00:00Z',
      { prevStates: ['MD', 'VA'], newStates: ['MD', 'VA', 'DC'] },
    );
    expect(delta.dataChanged).toBe(true);
    expect(delta.states?.added).toEqual(['DC']);
    expect(delta.states?.removed).toEqual([]);
  });

  it('tracks state removals', () => {
    const delta = computeCacheDelta(
      { records: 100 },
      { records: 100 },
      '2024-01-01T00:00:00Z',
      { prevStates: ['MD', 'VA', 'DC'], newStates: ['MD', 'VA'] },
    );
    expect(delta.dataChanged).toBe(true);
    expect(delta.states?.removed).toEqual(['DC']);
  });

  it('computes build duration', () => {
    const start = Date.now() - 5000;
    const delta = computeCacheDelta(null, { records: 10 }, null, { buildStartTime: start });
    expect(delta.buildDurationSec).toBeGreaterThanOrEqual(4);
    expect(delta.buildDurationSec).toBeLessThanOrEqual(7);
  });
});

// ── loadCacheFromDisk / saveCacheToDisk ───────────────────────────────────────

describe('loadCacheFromDisk', () => {
  it('returns null for missing file', () => {
    const result = loadCacheFromDisk('nonexistent-cache-file-xyz.json');
    expect(result).toBeNull();
  });
});

describe('saveCacheToDisk + loadCacheFromDisk', () => {
  const testFile = `test-cache-${Date.now()}.json`;

  beforeEach(() => {
    // Clean up after test
    try {
      const fs = require('fs');
      const path = require('path');
      const file = path.join(process.cwd(), '.cache', testFile);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch { /* ignore */ }
  });

  it('round-trips data', () => {
    const data = { items: [1, 2, 3], meta: { built: '2024-01-01' } };
    const sizeMB = saveCacheToDisk(testFile, data);
    expect(sizeMB).toBeGreaterThan(0);

    const loaded = loadCacheFromDisk(testFile);
    expect(loaded).toEqual(data);

    // Clean up
    const fs = require('fs');
    const path = require('path');
    fs.unlinkSync(path.join(process.cwd(), '.cache', testFile));
  });
});

// ── exportDeltaLog ────────────────────────────────────────────────────────────

describe('exportDeltaLog', () => {
  it('filters null deltas', () => {
    const result = exportDeltaLog({
      wqp: { lastDelta: null },
      attains: {
        lastDelta: {
          computedAt: '2024-01-01T00:00:00Z',
          previousBuild: null,
          dataChanged: true,
          counts: { stateCount: { before: 0, after: 10, diff: 10 } },
        },
      },
      icis: { lastDelta: undefined },
    });
    expect(result.deltas).toHaveLength(1);
    expect(result.deltas[0].cacheName).toBe('attains');
  });

  it('includes cacheName in each entry', () => {
    const result = exportDeltaLog({
      wqp: {
        lastDelta: {
          computedAt: '2024-01-01T00:00:00Z',
          previousBuild: null,
          dataChanged: false,
          counts: {},
        },
      },
    });
    expect(result.deltas[0].cacheName).toBe('wqp');
  });

  it('has snapshotTimestamp', () => {
    const result = exportDeltaLog({});
    expect(result.snapshotTimestamp).toBeDefined();
    expect(result.deltas).toHaveLength(0);
  });
});
