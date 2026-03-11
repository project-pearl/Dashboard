import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mock dependencies                                                  */
/* ------------------------------------------------------------------ */

vi.mock('@/lib/blobPersistence', () => ({
  saveCacheToBlob: vi.fn().mockResolvedValue(undefined),
  loadCacheFromBlob: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/sentinel/eventQueue', () => ({
  getEventsForHuc: vi.fn().mockReturnValue([]),
  getAllEvents: vi.fn().mockReturnValue([]),
  ensureWarmed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/sentinel/indexLookup', () => ({
  getWatershedContext: vi.fn().mockReturnValue({ available: false, severity: 0 }),
}));

vi.mock('@/lib/sentinel/hucAdjacency', () => ({
  getStateForHuc: vi.fn().mockReturnValue('MD'),
  getAdjacentHucs: vi.fn().mockReturnValue([]),
  shareHuc6Parent: vi.fn().mockReturnValue(false),
}));

import { gatherConfounders, classifyEvent } from '@/lib/sentinel/classificationEngine';
import { CONFOUNDER_RULES, ATTACK_SIGNALS } from '@/lib/sentinel/classificationConfig';
import type { ScoredHuc, ChangeEvent, ConfounderCheck } from '@/lib/sentinel/types';
import { getAllEvents } from '@/lib/sentinel/eventQueue';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeScoredHuc(overrides: Partial<ScoredHuc> = {}): ScoredHuc {
  return {
    huc8: '02060003',
    stateAbbr: 'MD',
    score: 80,
    level: 'CRITICAL',
    events: [],
    activePatterns: [],
    ...overrides,
  } as ScoredHuc;
}

function makeChangeEvent(overrides: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    id: 'evt-1',
    source: 'NWS_ALERTS',
    type: 'threshold_breach',
    detectedAt: new Date().toISOString(),
    geography: { huc8: '02060003', stateAbbr: 'MD', lat: 39.0, lng: -76.5 },
    severityHint: 'HIGH',
    payload: { event: 'Tornado Warning' },
    metadata: {},
    ...overrides,
  } as ChangeEvent;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('SEVERE_WEATHER_CONFOUNDER', () => {
  it('exists in CONFOUNDER_RULES', () => {
    const rule = CONFOUNDER_RULES.find(r => r.id === 'SEVERE_WEATHER_CONFOUNDER');
    expect(rule).toBeDefined();
    expect(rule!.reductionMagnitude).toBe(0.35);
    expect(rule!.affectedParamCds).toHaveLength(0); // affects all
  });

  it('matches when NWS_ALERTS events with severe weather exist in same area', () => {
    const tornadoEvent = makeChangeEvent({
      source: 'NWS_ALERTS',
      geography: { huc8: '02060003', stateAbbr: 'MD', lat: 39.0, lng: -76.5 },
      payload: { event: 'Tornado Warning' },
    });

    vi.mocked(getAllEvents).mockReturnValue([tornadoEvent]);
    const checks = gatherConfounders('02060003', [tornadoEvent]);

    const severeCheck = checks.find(c => c.rule === 'SEVERE_WEATHER_CONFOUNDER');
    expect(severeCheck).toBeDefined();
    expect(severeCheck!.matched).toBe(true);
    expect(severeCheck!.detail).toContain('severe weather warning');
  });

  it('does NOT match when no severe weather events exist', () => {
    vi.mocked(getAllEvents).mockReturnValue([]);
    const checks = gatherConfounders('02060003', []);

    const severeCheck = checks.find(c => c.rule === 'SEVERE_WEATHER_CONFOUNDER');
    expect(severeCheck).toBeDefined();
    expect(severeCheck!.matched).toBe(false);
  });

  it('reduces threat score when matched in classifyEvent', () => {
    const huc = makeScoredHuc({ level: 'CRITICAL', score: 80 });

    // With severe weather confounder matched
    const confoundersWithWeather: ConfounderCheck[] = [
      { rule: 'SEVERE_WEATHER_CONFOUNDER', matched: true, detail: '1 active severe weather warning(s)' },
    ];
    const withWeather = classifyEvent(huc, confoundersWithWeather);

    // Without severe weather confounder
    const confoundersNoWeather: ConfounderCheck[] = [
      { rule: 'SEVERE_WEATHER_CONFOUNDER', matched: false, detail: 'No active severe weather warnings' },
    ];
    const noWeather = classifyEvent(huc, confoundersNoWeather);

    // Threat score should be lower when severe weather is active
    expect(withWeather.threatScore).toBeLessThan(noWeather.threatScore);
  });
});

describe('CLEAR_WEATHER_CONFIDENCE', () => {
  it('exists in ATTACK_SIGNALS', () => {
    const signal = ATTACK_SIGNALS.find(s => s.id === 'CLEAR_WEATHER_CONFIDENCE');
    expect(signal).toBeDefined();
    expect(signal!.boostMagnitude).toBe(0.1);
  });

  it('boosts threat score for CRITICAL HUCs when no weather confounders matched', () => {
    const huc = makeScoredHuc({ level: 'CRITICAL', score: 80 });

    // No weather confounders at all
    const confounders: ConfounderCheck[] = [
      { rule: 'FLOOD_CONFOUNDER', matched: false, detail: 'No floods' },
      { rule: 'SEVERE_WEATHER_CONFOUNDER', matched: false, detail: 'No severe weather' },
    ];

    const result = classifyEvent(huc, confounders);

    // Should have clear weather confidence boost in reasoning
    const clearWeatherReason = result.reasoning.find(r => r.rule === 'CLEAR_WEATHER_CONFIDENCE');
    expect(clearWeatherReason).toBeDefined();
    expect(clearWeatherReason!.effect).toBe('boost');
    expect(clearWeatherReason!.magnitude).toBe(0.1);
  });

  it('does NOT boost when flood confounder is matched', () => {
    const huc = makeScoredHuc({ level: 'CRITICAL', score: 80 });

    const confounders: ConfounderCheck[] = [
      { rule: 'FLOOD_CONFOUNDER', matched: true, detail: 'Active flood warning' },
      { rule: 'SEVERE_WEATHER_CONFOUNDER', matched: false, detail: 'No severe weather' },
    ];

    const result = classifyEvent(huc, confounders);
    const clearWeatherReason = result.reasoning.find(r => r.rule === 'CLEAR_WEATHER_CONFIDENCE');
    expect(clearWeatherReason).toBeUndefined();
  });

  it('does NOT boost when severe weather confounder is matched', () => {
    const huc = makeScoredHuc({ level: 'CRITICAL', score: 80 });

    const confounders: ConfounderCheck[] = [
      { rule: 'FLOOD_CONFOUNDER', matched: false, detail: 'No floods' },
      { rule: 'SEVERE_WEATHER_CONFOUNDER', matched: true, detail: '1 active severe weather warning' },
    ];

    const result = classifyEvent(huc, confounders);
    const clearWeatherReason = result.reasoning.find(r => r.rule === 'CLEAR_WEATHER_CONFIDENCE');
    expect(clearWeatherReason).toBeUndefined();
  });

  it('does NOT boost for non-CRITICAL HUCs', () => {
    const huc = makeScoredHuc({ level: 'WATCH', score: 50 });

    const confounders: ConfounderCheck[] = [
      { rule: 'FLOOD_CONFOUNDER', matched: false, detail: 'No floods' },
      { rule: 'SEVERE_WEATHER_CONFOUNDER', matched: false, detail: 'No severe weather' },
    ];

    const result = classifyEvent(huc, confounders);
    const clearWeatherReason = result.reasoning.find(r => r.rule === 'CLEAR_WEATHER_CONFIDENCE');
    expect(clearWeatherReason).toBeUndefined();
  });
});

describe('siteThrottle key extraction for nws_weather', () => {
  it('strips severity suffix from nws_weather dedupKey', async () => {
    const { extractSiteKey } = await import('@/lib/alerts/siteThrottle');

    const result = extractSiteKey('nws_weather:tornado:fort-liberty:critical');
    expect(result).toBe('nws_weather:tornado:fort-liberty');
  });

  it('strips severity suffix from firms dedupKey', async () => {
    const { extractSiteKey } = await import('@/lib/alerts/siteThrottle');

    const result = extractSiteKey('firms|fire_near_installation|us-centcom|warning');
    expect(result).toBe('firms|fire_near_installation|us-centcom');
  });
});
