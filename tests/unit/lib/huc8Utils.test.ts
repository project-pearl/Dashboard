import { describe, it, expect } from 'vitest';
import {
  extractHuc8,
  isPriorityWaterbody,
  isCoastalWaterbody,
  groupByWatershed,
  PRIORITY_WB_ALERT_THRESHOLD,
  COASTAL_WATER_TYPES,
} from '@/lib/huc8Utils';
import type { RegionRow, AttainsBulkEntry } from '@/lib/huc8Utils';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeRow(overrides: Partial<RegionRow> = {}): RegionRow {
  return {
    id: 'test-wb-001',
    name: 'Test Waterbody',
    state: 'MD',
    alertLevel: 'none',
    activeAlerts: 0,
    lastUpdatedISO: '2024-01-01T00:00:00Z',
    status: 'assessed',
    dataSourceCount: 1,
    ...overrides,
  };
}

function makeAttains(overrides: Partial<AttainsBulkEntry> = {}): AttainsBulkEntry {
  return {
    id: 'MD-02120201-Lower_Susquehanna',
    name: 'Lower Susquehanna',
    category: '5',
    alertLevel: 'high',
    causes: [],
    cycle: '2022',
    causeCount: 0,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  extractHuc8                                                        */
/* ------------------------------------------------------------------ */

describe('huc8Utils', () => {
  describe('extractHuc8', () => {
    it('extracts HUC-8 from STATE-XXXXXXXX pattern', () => {
      expect(extractHuc8('MD-02120201-Lower_Susquehanna')).toBe('02120201');
    });

    it('extracts HUC-8 from STXXXXXXXX pattern (no dash)', () => {
      expect(extractHuc8('AL03130002-0602-100')).toBe('03130002');
    });

    it('truncates long digit prefixes to first 8 digits', () => {
      expect(extractHuc8('MD-021202010319-Rock')).toBe('02120201');
    });

    it('returns null for null input', () => {
      expect(extractHuc8(null as unknown as string)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(extractHuc8('')).toBeNull();
    });

    it('returns null for string with no matching pattern', () => {
      expect(extractHuc8('no-match-here')).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  isPriorityWaterbody                                                */
  /* ------------------------------------------------------------------ */

  describe('isPriorityWaterbody', () => {
    it('returns true for high alertLevel + activeAlerts >= threshold', () => {
      const row = makeRow({ alertLevel: 'high', activeAlerts: PRIORITY_WB_ALERT_THRESHOLD });
      expect(isPriorityWaterbody(row)).toBe(true);
    });

    it('returns true for high alertLevel + causeCount >= 3 (via attainsEntry)', () => {
      const row = makeRow({ alertLevel: 'high', activeAlerts: 1 });
      const attains = makeAttains({ causeCount: 3 });
      expect(isPriorityWaterbody(row, attains)).toBe(true);
    });

    it('returns false for medium alertLevel even with 10 alerts', () => {
      const row = makeRow({ alertLevel: 'medium', activeAlerts: PRIORITY_WB_ALERT_THRESHOLD });
      expect(isPriorityWaterbody(row)).toBe(false);
    });

    it('returns false for high alertLevel + 1 alert + 1 cause', () => {
      const row = makeRow({ alertLevel: 'high', activeAlerts: 1 });
      const attains = makeAttains({ causeCount: 1 });
      expect(isPriorityWaterbody(row, attains)).toBe(false);
    });

    it('returns false for low alertLevel regardless of counts', () => {
      const row = makeRow({ alertLevel: 'low', activeAlerts: 50 });
      const attains = makeAttains({ causeCount: 10 });
      expect(isPriorityWaterbody(row, attains)).toBe(false);
    });

    it('does not use causes.length fallback when causeCount is explicitly 0', () => {
      // ?? only falls back on null/undefined, not 0
      const row = makeRow({ alertLevel: 'high', activeAlerts: 1 });
      const attains = makeAttains({ causeCount: 0, causes: ['N', 'P', 'Sediment'] });
      expect(isPriorityWaterbody(row, attains)).toBe(false);
    });

    it('uses causes.length as fallback when causeCount is undefined', () => {
      const row = makeRow({ alertLevel: 'high', activeAlerts: 1 });
      const attains = makeAttains({ causes: ['N', 'P', 'Sediment'] });
      // Remove causeCount to trigger fallback to causes.length
      delete (attains as any).causeCount;
      expect(isPriorityWaterbody(row, attains)).toBe(true);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  isCoastalWaterbody                                                 */
  /* ------------------------------------------------------------------ */

  describe('isCoastalWaterbody', () => {
    it('returns true for waterType "ES"', () => {
      expect(isCoastalWaterbody(makeAttains({ waterType: 'ES' }))).toBe(true);
    });

    it('returns true for waterType "ESTUARY"', () => {
      expect(isCoastalWaterbody(makeAttains({ waterType: 'ESTUARY' }))).toBe(true);
    });

    it('returns true for waterType "COASTAL"', () => {
      expect(isCoastalWaterbody(makeAttains({ waterType: 'COASTAL' }))).toBe(true);
    });

    it('returns true for waterType "OCEAN"', () => {
      expect(isCoastalWaterbody(makeAttains({ waterType: 'OCEAN' }))).toBe(true);
    });

    it('returns false for null waterType', () => {
      expect(isCoastalWaterbody(makeAttains({ waterType: null }))).toBe(false);
    });

    it('returns false when no attainsEntry provided', () => {
      expect(isCoastalWaterbody(null)).toBe(false);
      expect(isCoastalWaterbody(undefined)).toBe(false);
    });

    it('returns false for waterType "RIVER"', () => {
      expect(isCoastalWaterbody(makeAttains({ waterType: 'RIVER' }))).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isCoastalWaterbody(makeAttains({ waterType: 'estuary' }))).toBe(true);
      expect(isCoastalWaterbody(makeAttains({ waterType: 'Coastal' }))).toBe(true);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  COASTAL_WATER_TYPES set                                            */
  /* ------------------------------------------------------------------ */

  describe('COASTAL_WATER_TYPES', () => {
    it('contains all expected coastal type codes', () => {
      for (const wt of ['ES', 'OC', 'CW', 'ESTUARY', 'OCEAN', 'COASTAL']) {
        expect(COASTAL_WATER_TYPES.has(wt)).toBe(true);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  groupByWatershed                                                   */
  /* ------------------------------------------------------------------ */

  describe('groupByWatershed', () => {
    it('groups two rows sharing the same HUC-8 into one group', () => {
      const rows: RegionRow[] = [
        makeRow({ id: 'MD-02120201-A', name: 'Stream A', alertLevel: 'high', activeAlerts: 5 }),
        makeRow({ id: 'MD-02120201-B', name: 'Stream B', alertLevel: 'none', activeAlerts: 0 }),
      ];
      const attains: AttainsBulkEntry[] = [
        makeAttains({ id: 'MD-02120201-A', name: 'Stream A' }),
        makeAttains({ id: 'MD-02120201-B', name: 'Stream B', alertLevel: 'none' }),
      ];
      const huc8Names: Record<string, string> = { '02120201': 'Lower Susquehanna' };

      const groups = groupByWatershed(rows, attains, huc8Names, {});

      expect(groups).toHaveLength(1);
      expect(groups[0].huc8).toBe('02120201');
      expect(groups[0].name).toBe('Lower Susquehanna');
      expect(groups[0].total).toBe(2);
      expect(groups[0].impaired).toBe(1); // only the 'high' row
      expect(groups[0].severe).toBe(1);
      expect(groups[0].activeAlerts).toBe(5);
      expect(groups[0].healthPct).toBe(50); // 1 healthy out of 2
    });

    it('places unmatched rows into the OTHER group', () => {
      const rows: RegionRow[] = [
        makeRow({ id: 'unknown-1', name: 'Mystery Stream' }),
      ];

      const groups = groupByWatershed(rows, [], {}, {});

      expect(groups).toHaveLength(1);
      expect(groups[0].huc8).toBe('OTHER');
      expect(groups[0].name).toBe('Other Waterbodies');
      expect(groups[0].total).toBe(1);
    });

    it('sorts OTHER group last', () => {
      const rows: RegionRow[] = [
        makeRow({ id: 'unknown-1', name: 'Mystery Stream' }),
        makeRow({ id: 'MD-02120201-A', name: 'Stream A', alertLevel: 'high', activeAlerts: 2 }),
      ];
      const attains: AttainsBulkEntry[] = [
        makeAttains({ id: 'MD-02120201-A', name: 'Stream A' }),
      ];
      const huc8Names: Record<string, string> = { '02120201': 'Lower Susquehanna' };

      const groups = groupByWatershed(rows, attains, huc8Names, {});

      expect(groups[groups.length - 1].huc8).toBe('OTHER');
    });

    it('falls back to registryMeta huc8 when ATTAINS ID has no match', () => {
      const rows: RegionRow[] = [
        makeRow({ id: 'site-xyz', name: 'Some Creek' }),
      ];
      const registryMeta = {
        'site-xyz': { huc8: '05030101', name: 'Some Creek' },
      };
      const huc8Names: Record<string, string> = { '05030101': 'Upper Ohio' };

      const groups = groupByWatershed(rows, [], huc8Names, registryMeta);

      expect(groups).toHaveLength(1);
      expect(groups[0].huc8).toBe('05030101');
      expect(groups[0].name).toBe('Upper Ohio');
    });

    it('marks groups with coastal waterbodies', () => {
      const rows: RegionRow[] = [
        makeRow({ id: 'MD-02120201-A', name: 'Estuary Site' }),
      ];
      const attains: AttainsBulkEntry[] = [
        makeAttains({ id: 'MD-02120201-A', name: 'Estuary Site', waterType: 'ESTUARY' }),
      ];

      const groups = groupByWatershed(rows, attains, {}, {});

      expect(groups[0].hasCoastal).toBe(true);
    });

    it('computes healthPct correctly for all healthy rows', () => {
      const rows: RegionRow[] = [
        makeRow({ id: 'MD-02120201-A', name: 'A', alertLevel: 'none' }),
        makeRow({ id: 'MD-02120201-B', name: 'B', alertLevel: 'low' }),
      ];
      const attains: AttainsBulkEntry[] = [
        makeAttains({ id: 'MD-02120201-A', name: 'A' }),
        makeAttains({ id: 'MD-02120201-B', name: 'B' }),
      ];

      const groups = groupByWatershed(rows, attains, {}, {});

      expect(groups[0].healthPct).toBe(100);
    });
  });
});
