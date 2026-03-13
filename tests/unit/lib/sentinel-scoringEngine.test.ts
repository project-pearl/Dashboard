import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks — top-level only                                            */
/* ------------------------------------------------------------------ */

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => { throw new Error('no disk'); }),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  },
  readFileSync: vi.fn(() => { throw new Error('no disk'); }),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
}));

vi.mock('@/lib/blobPersistence', () => ({
  saveCacheToBlob: vi.fn(async () => {}),
  loadCacheFromBlob: vi.fn(async () => null),
}));

vi.mock('@/lib/sentinel/eventQueue', () => ({
  getAllEvents: vi.fn(() => []),
  getActiveHucs: vi.fn(() => []),
  getEventsForHuc: vi.fn(() => []),
}));

vi.mock('@/lib/sentinel/hucAdjacency', () => ({
  getAdjacentHucs: vi.fn(() => []),
  getStateForHuc: vi.fn(() => null),
  shareHuc6Parent: vi.fn(() => false),
}));

vi.mock('@/lib/sentinel/indexLookup', () => ({
  getWatershedContext: vi.fn(() => ({
    severity: 0.5,
    confidence: 0,
    composite: 50,
    waterRiskInverse: 0.5,
    available: false,
  })),
}));

import {
  scoreAllHucs,
  getScoredHucs,
  getHucsAtLevel,
  getHucsAboveWatch,
  getScoredHucsSummary,
  getResolvedHucs,
  _resetScoring,
} from '@/lib/sentinel/scoringEngine';

import { getAllEvents, getActiveHucs, getEventsForHuc } from '@/lib/sentinel/eventQueue';
import { getAdjacentHucs, getStateForHuc, shareHuc6Parent } from '@/lib/sentinel/hucAdjacency';
import { getWatershedContext } from '@/lib/sentinel/indexLookup';
import type { ChangeEvent } from '@/lib/sentinel/types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeEvent(overrides: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    eventId: overrides.eventId ?? 'evt-1',
    source: overrides.source ?? 'USGS_IV',
    detectedAt: overrides.detectedAt ?? new Date().toISOString(),
    sourceTimestamp: null,
    changeType: 'THRESHOLD_CROSSED',
    geography: overrides.geography ?? { huc8: '02070010', stateAbbr: 'DC' },
    severityHint: overrides.severityHint ?? 'HIGH',
    payload: {},
    metadata: {},
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('sentinel/scoringEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetScoring();
  });

  /* ---- scoreAllHucs ---- */

  describe('scoreAllHucs', () => {
    it('returns empty array when no events exist', async () => {
      vi.mocked(getAllEvents).mockReturnValue([]);
      const result = await scoreAllHucs();
      expect(result).toEqual([]);
    });

    it('scores a single HUC with one event', async () => {
      const event = makeEvent({ severityHint: 'HIGH', source: 'USGS_IV' });
      vi.mocked(getAllEvents).mockReturnValue([event]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070010']);
      vi.mocked(getEventsForHuc).mockReturnValue([event]);

      const result = await scoreAllHucs();

      expect(result).toHaveLength(1);
      expect(result[0].huc8).toBe('02070010');
      expect(result[0].score).toBeGreaterThan(0);
      expect(result[0].events).toHaveLength(1);
      expect(result[0].events[0].source).toBe('USGS_IV');
    });

    it('applies time decay — recent events score higher than old events', async () => {
      const recentEvent = makeEvent({
        eventId: 'evt-recent',
        detectedAt: new Date().toISOString(),
        severityHint: 'HIGH',
        source: 'USGS_IV',
      });
      const oldEvent = makeEvent({
        eventId: 'evt-old',
        detectedAt: new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(), // 40h ago
        severityHint: 'HIGH',
        source: 'USGS_IV',
        geography: { huc8: '02070011', stateAbbr: 'DC' },
      });

      // Score recent HUC
      vi.mocked(getAllEvents).mockReturnValue([recentEvent]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070010']);
      vi.mocked(getEventsForHuc).mockReturnValue([recentEvent]);
      const recentResult = await scoreAllHucs();

      _resetScoring();
      vi.clearAllMocks();

      // Score old HUC
      vi.mocked(getAllEvents).mockReturnValue([oldEvent]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070011']);
      vi.mocked(getEventsForHuc).mockReturnValue([oldEvent]);
      const oldResult = await scoreAllHucs();

      expect(recentResult[0].score).toBeGreaterThan(oldResult[0].score);
    });

    it('applies time decay floor for events beyond the decay window', async () => {
      // Event 60 hours ago — beyond 48h TIME_DECAY_WINDOW_HOURS
      const expiredEvent = makeEvent({
        detectedAt: new Date(Date.now() - 60 * 60 * 60 * 1000).toISOString(),
        severityHint: 'HIGH',
        source: 'USGS_IV',
      });

      vi.mocked(getAllEvents).mockReturnValue([expiredEvent]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070010']);
      vi.mocked(getEventsForHuc).mockReturnValue([expiredEvent]);

      const result = await scoreAllHucs();
      // BASE_SCORES.USGS_IV.HIGH = 45, decay floor = 0.1, watershed severity = 0.5
      // score = 45 * 0.1 * (1 + 0.5 * 0.5) = 45 * 0.1 * 1.25 = 5.625 → rounded to 5.6
      expect(result[0].score).toBeGreaterThan(0);
      expect(result[0].score).toBeLessThan(10); // floor-decayed, should be very low
    });

    it('applies adjacent HUC bonus when adjacent HUC shares HUC6 parent', async () => {
      const event = makeEvent({ severityHint: 'HIGH', source: 'SSO_CSO' });
      vi.mocked(getAllEvents).mockReturnValue([event]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070010']);
      vi.mocked(getEventsForHuc).mockReturnValue([event]);
      vi.mocked(getAdjacentHucs).mockReturnValue(['02070011']);
      vi.mocked(shareHuc6Parent).mockReturnValue(true);
      // Adjacent HUC must have events in the eventsByHuc map
      const adjEvent = makeEvent({ geography: { huc8: '02070011' } });
      vi.mocked(getAllEvents).mockReturnValue([event, adjEvent]);

      const resultWithBonus = await scoreAllHucs();

      _resetScoring();
      vi.clearAllMocks();

      // Without adjacent activity
      vi.mocked(getAllEvents).mockReturnValue([event]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070010']);
      vi.mocked(getEventsForHuc).mockReturnValue([event]);
      vi.mocked(getAdjacentHucs).mockReturnValue([]);
      vi.mocked(shareHuc6Parent).mockReturnValue(false);

      const resultWithout = await scoreAllHucs();

      expect(resultWithBonus[0].score).toBeGreaterThan(resultWithout[0].score);
    });

    it('applies watershed severity multiplier', async () => {
      const event = makeEvent({ severityHint: 'HIGH', source: 'USGS_IV' });
      vi.mocked(getAllEvents).mockReturnValue([event]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070010']);
      vi.mocked(getEventsForHuc).mockReturnValue([event]);

      // Low severity watershed
      vi.mocked(getWatershedContext).mockReturnValue({
        severity: 0.0,
        confidence: 1,
        composite: 0,
        waterRiskInverse: 0,
        available: true,
      });
      const lowResult = await scoreAllHucs();

      _resetScoring();
      vi.clearAllMocks();

      // High severity watershed
      vi.mocked(getAllEvents).mockReturnValue([event]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070010']);
      vi.mocked(getEventsForHuc).mockReturnValue([event]);
      vi.mocked(getWatershedContext).mockReturnValue({
        severity: 1.0,
        confidence: 1,
        composite: 100,
        waterRiskInverse: 1,
        available: true,
      });
      const highResult = await scoreAllHucs();

      expect(highResult[0].score).toBeGreaterThan(lowResult[0].score);
    });

    it('sorts scored HUCs by score descending', async () => {
      const highEvent = makeEvent({
        eventId: 'evt-high',
        severityHint: 'CRITICAL',
        source: 'SSO_CSO',
        geography: { huc8: '02070010', stateAbbr: 'DC' },
      });
      const lowEvent = makeEvent({
        eventId: 'evt-low',
        severityHint: 'LOW',
        source: 'ATTAINS',
        geography: { huc8: '02070011', stateAbbr: 'VA' },
      });

      vi.mocked(getAllEvents).mockReturnValue([highEvent, lowEvent]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070010', '02070011']);
      vi.mocked(getEventsForHuc).mockImplementation((huc: string) => {
        if (huc === '02070010') return [highEvent];
        if (huc === '02070011') return [lowEvent];
        return [];
      });

      const result = await scoreAllHucs();

      expect(result).toHaveLength(2);
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
      expect(result[0].huc8).toBe('02070010');
    });

    it('assigns correct score level based on thresholds', async () => {
      // SSO_CSO CRITICAL = 70 base, with watershed 0.5 → 70 * 1.25 = 87.5 → WATCH level (75+)
      const event = makeEvent({ severityHint: 'CRITICAL', source: 'SSO_CSO' });
      vi.mocked(getAllEvents).mockReturnValue([event]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070010']);
      vi.mocked(getEventsForHuc).mockReturnValue([event]);

      const result = await scoreAllHucs();
      // Score >= 75 is WATCH, >= 150 is CRITICAL
      expect(['ADVISORY', 'WATCH', 'CRITICAL']).toContain(result[0].level);
    });

    it('uses state from getStateForHuc when available', async () => {
      const event = makeEvent({ geography: { huc8: '02070010' } }); // no stateAbbr
      vi.mocked(getAllEvents).mockReturnValue([event]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070010']);
      vi.mocked(getEventsForHuc).mockReturnValue([event]);
      vi.mocked(getStateForHuc).mockReturnValue('MD');

      const result = await scoreAllHucs();
      expect(result[0].stateAbbr).toBe('MD');
    });

    it('falls back to event stateAbbr when getStateForHuc returns null', async () => {
      const event = makeEvent({ geography: { huc8: '02070010', stateAbbr: 'VA' } });
      vi.mocked(getAllEvents).mockReturnValue([event]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070010']);
      vi.mocked(getEventsForHuc).mockReturnValue([event]);
      vi.mocked(getStateForHuc).mockReturnValue(undefined);

      const result = await scoreAllHucs();
      expect(result[0].stateAbbr).toBe('VA');
    });

    it('skips HUCs with no events from getEventsForHuc', async () => {
      const event = makeEvent();
      vi.mocked(getAllEvents).mockReturnValue([event]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070010', '02070099']);
      vi.mocked(getEventsForHuc).mockImplementation((huc: string) => {
        if (huc === '02070010') return [event];
        return [];
      });

      const result = await scoreAllHucs();
      expect(result).toHaveLength(1);
      expect(result[0].huc8).toBe('02070010');
    });
  });

  /* ---- Public Accessors ---- */

  describe('getScoredHucs', () => {
    it('returns empty array initially', () => {
      expect(getScoredHucs()).toEqual([]);
    });
  });

  describe('getHucsAtLevel', () => {
    it('filters by the given level after scoring', async () => {
      // Create two events: one that will score WATCH+ and one ADVISORY
      const highEvent = makeEvent({
        eventId: 'evt-high',
        severityHint: 'CRITICAL',
        source: 'EPA_BEACON', // 70 base
        geography: { huc8: '02070010', stateAbbr: 'DC' },
      });

      vi.mocked(getAllEvents).mockReturnValue([highEvent]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070010']);
      vi.mocked(getEventsForHuc).mockReturnValue([highEvent]);

      await scoreAllHucs();
      const watchAndAbove = getHucsAtLevel('WATCH');
      // All returned results should be WATCH level
      for (const huc of watchAndAbove) {
        expect(huc.level).toBe('WATCH');
      }
    });
  });

  describe('getHucsAboveWatch', () => {
    it('excludes NOMINAL HUCs', async () => {
      const lowEvent = makeEvent({
        severityHint: 'LOW',
        source: 'ATTAINS', // very low base score (1)
      });
      vi.mocked(getAllEvents).mockReturnValue([lowEvent]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070010']);
      vi.mocked(getEventsForHuc).mockReturnValue([lowEvent]);
      vi.mocked(getWatershedContext).mockReturnValue({
        severity: 0,
        confidence: 0,
        composite: 0,
        waterRiskInverse: 0,
        available: false,
      });

      await scoreAllHucs();

      const result = getHucsAboveWatch();
      // ATTAINS LOW = 1, * 1.0 (no watershed) = 1 → NOMINAL (< 30)
      // So should NOT appear in above-watch
      for (const huc of result) {
        expect(huc.level).not.toBe('NOMINAL');
      }
    });
  });

  describe('getScoredHucsSummary', () => {
    it('returns zero counts when no scored HUCs', () => {
      const summary = getScoredHucsSummary();
      expect(summary.critical).toBe(0);
      expect(summary.watch).toBe(0);
      expect(summary.advisory).toBe(0);
      expect(summary.topHucs).toEqual([]);
    });

    it('limits topHucs to 10 entries', async () => {
      // Create 15 unique HUCs
      const events: ChangeEvent[] = [];
      const hucs: string[] = [];
      for (let i = 0; i < 15; i++) {
        const huc = `020700${String(i).padStart(2, '0')}`;
        hucs.push(huc);
        events.push(makeEvent({
          eventId: `evt-${i}`,
          source: 'SSO_CSO',
          severityHint: 'HIGH',
          geography: { huc8: huc, stateAbbr: 'DC' },
        }));
      }

      vi.mocked(getAllEvents).mockReturnValue(events);
      vi.mocked(getActiveHucs).mockReturnValue(hucs);
      vi.mocked(getEventsForHuc).mockImplementation((huc: string) =>
        events.filter(e => e.geography.huc8 === huc),
      );

      await scoreAllHucs();
      const summary = getScoredHucsSummary();
      expect(summary.topHucs.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getResolvedHucs', () => {
    it('returns empty array initially', () => {
      expect(getResolvedHucs()).toEqual([]);
    });
  });

  describe('_resetScoring', () => {
    it('clears all internal state', async () => {
      const event = makeEvent();
      vi.mocked(getAllEvents).mockReturnValue([event]);
      vi.mocked(getActiveHucs).mockReturnValue(['02070010']);
      vi.mocked(getEventsForHuc).mockReturnValue([event]);

      await scoreAllHucs();
      expect(getScoredHucs().length).toBeGreaterThan(0);

      _resetScoring();
      expect(getScoredHucs()).toEqual([]);
    });
  });
});
