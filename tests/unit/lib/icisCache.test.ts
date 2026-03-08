import { describe, it, expect } from 'vitest';
import {
  getIcisCache,
  getIcisCacheStatus,
  setIcisCache,
  gridKey,
} from '@/lib/icisCache';
import { makeIcisPermit, makeIcisViolation, makeIcisDmr, makeIcisEnforcement, makeIcisInspection } from '../../mocks/fixtures/icis-sample-grid';

describe('icisCache', () => {
  describe('getIcisCache', () => {
    it('returns null when cache is cold', () => {
      const result = getIcisCache(38.93, -77.12);
      expect(result).toBeNull();
    });

    it('returns all 5 arrays after setIcisCache', async () => {
      const key = gridKey(39.24, -76.53);
      await setIcisCache({
        _meta: {
          built: new Date().toISOString(),
          permitCount: 1,
          violationCount: 1,
          dmrCount: 1,
          enforcementCount: 1,
          inspectionCount: 1,
          statesProcessed: ['MD'],
          gridCells: 1,
        },
        grid: {
          [key]: {
            permits: [makeIcisPermit()],
            violations: [makeIcisViolation()],
            dmr: [makeIcisDmr()],
            enforcement: [makeIcisEnforcement()],
            inspections: [makeIcisInspection()],
          },
        },
      });

      const result = getIcisCache(39.24, -76.53);
      expect(result).not.toBeNull();
      expect(result!.permits).toHaveLength(1);
      expect(result!.violations).toHaveLength(1);
      expect(result!.dmr).toHaveLength(1);
      expect(result!.enforcement).toHaveLength(1);
      expect(result!.inspections).toHaveLength(1);
      expect(result!.fromCache).toBe(true);
    });

    it('aggregates from neighbor cells', async () => {
      const key1 = gridKey(39.0, -77.0);
      const key2 = gridKey(39.1, -77.0);
      await setIcisCache({
        _meta: {
          built: new Date().toISOString(),
          permitCount: 2,
          violationCount: 0,
          dmrCount: 0,
          enforcementCount: 0,
          inspectionCount: 0,
          statesProcessed: ['MD'],
          gridCells: 2,
        },
        grid: {
          [key1]: {
            permits: [makeIcisPermit({ permit: 'A' })],
            violations: [],
            dmr: [],
            enforcement: [],
            inspections: [],
          },
          [key2]: {
            permits: [makeIcisPermit({ permit: 'B' })],
            violations: [],
            dmr: [],
            enforcement: [],
            inspections: [],
          },
        },
      });

      const result = getIcisCache(39.0, -77.0);
      expect(result).not.toBeNull();
      expect(result!.permits.length).toBeGreaterThanOrEqual(2);
    });
  });
});
