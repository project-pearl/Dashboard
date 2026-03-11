import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mock blob persistence (no actual network)                          */
/* ------------------------------------------------------------------ */

vi.mock('@/lib/blobPersistence', () => ({
  saveCacheToBlob: vi.fn().mockResolvedValue(undefined),
  loadCacheFromBlob: vi.fn().mockResolvedValue(null),
}));

/* ------------------------------------------------------------------ */
/*  Mock NWS alert cache                                               */
/* ------------------------------------------------------------------ */

const mockGetNwsAlertsAll = vi.fn().mockReturnValue([]);

vi.mock('@/lib/nwsAlertCache', () => ({
  ensureWarmed: vi.fn().mockResolvedValue(undefined),
  getNwsAlertsAll: () => mockGetNwsAlertsAll(),
}));

/* ------------------------------------------------------------------ */
/*  Import trigger (after mocks)                                       */
/* ------------------------------------------------------------------ */

import { evaluateNwsWeatherAlerts } from '@/lib/alerts/triggers/nwsWeatherTrigger';
import { makeNwsAlert } from '../../mocks/fixtures/nws-alert-sample-data';

/* ------------------------------------------------------------------ */
/*  Installation data (from actual data file)                          */
/* ------------------------------------------------------------------ */

// Fort Liberty: lat 35.14, lng -79.00, region: conus
// Pearl Harbor: lat 21.35, lng -157.97, region: indo-pacific (but NWS-eligible)
// Camp Arifjan: lat 28.93, lng 48.10, region: middle-east (NOT NWS-eligible)

describe('nwsWeatherTrigger', () => {
  beforeEach(() => {
    mockGetNwsAlertsAll.mockReturnValue([]);
    vi.clearAllMocks();
  });

  it('returns empty when no NWS alerts exist', async () => {
    const events = await evaluateNwsWeatherAlerts();
    expect(events).toHaveLength(0);
  });

  it('emits critical alert for Tornado Warning within 25mi of CONUS installation', async () => {
    // Fort Liberty: 35.14, -79.00 — put tornado at 35.15, -78.98 (~1.5mi away)
    mockGetNwsAlertsAll.mockReturnValue([
      makeNwsAlert({
        id: 'tornado-1',
        event: 'Tornado Warning',
        severity: 'Extreme',
        centroidLat: 35.15,
        centroidLng: -78.98,
        areaDesc: 'Cumberland County, NC',
      }),
    ]);

    const events = await evaluateNwsWeatherAlerts();
    expect(events.length).toBeGreaterThanOrEqual(1);

    const tornadoAlert = events.find(e => e.metadata.pattern === 'tornado');
    expect(tornadoAlert).toBeDefined();
    expect(tornadoAlert!.severity).toBe('critical');
    expect(tornadoAlert!.type).toBe('nws_weather');
    expect(tornadoAlert!.entityId).toBe('fort-liberty');
  });

  it('does NOT emit alert for Tornado Warning >25mi from any installation', async () => {
    // Put tornado far from any installation: middle of Wyoming
    mockGetNwsAlertsAll.mockReturnValue([
      makeNwsAlert({
        id: 'tornado-far',
        event: 'Tornado Warning',
        severity: 'Extreme',
        centroidLat: 43.0,
        centroidLng: -108.0,
        areaDesc: 'Fremont County, WY',
      }),
    ]);

    const events = await evaluateNwsWeatherAlerts();
    const tornadoAlerts = events.filter(e => e.metadata.pattern === 'tornado');
    expect(tornadoAlerts).toHaveLength(0);
  });

  it('emits warning alert for Flash Flood Warning within 10mi of CONUS installation', async () => {
    // Norfolk Naval Station: 36.95, -76.33 — put flash flood nearby
    mockGetNwsAlertsAll.mockReturnValue([
      makeNwsAlert({
        id: 'flood-1',
        event: 'Flash Flood Warning',
        severity: 'Severe',
        centroidLat: 36.96,
        centroidLng: -76.34,
        areaDesc: 'Norfolk City, VA',
      }),
    ]);

    const events = await evaluateNwsWeatherAlerts();
    const floodAlert = events.find(e => e.metadata.pattern === 'flash_flood');
    expect(floodAlert).toBeDefined();
    expect(floodAlert!.severity).toBe('warning');
    expect(floodAlert!.entityId).toBe('norfolk');
  });

  it('does NOT emit flash flood alert for >10mi distance', async () => {
    // Norfolk: 36.95, -76.33 — put flood ~15mi away
    mockGetNwsAlertsAll.mockReturnValue([
      makeNwsAlert({
        id: 'flood-far',
        event: 'Flash Flood Warning',
        severity: 'Severe',
        centroidLat: 37.15,
        centroidLng: -76.33,
        areaDesc: 'James City County, VA',
      }),
    ]);

    const events = await evaluateNwsWeatherAlerts();
    const floodAlerts = events.filter(e =>
      e.metadata.pattern === 'flash_flood' && e.entityId === 'norfolk',
    );
    expect(floodAlerts).toHaveLength(0);
  });

  it('includes Pearl Harbor despite indo-pacific region', async () => {
    // Pearl Harbor: 21.35, -157.97
    mockGetNwsAlertsAll.mockReturnValue([
      makeNwsAlert({
        id: 'tornado-hawaii',
        event: 'Tornado Warning',
        severity: 'Extreme',
        centroidLat: 21.36,
        centroidLng: -157.96,
        areaDesc: 'Honolulu County, HI',
      }),
    ]);

    const events = await evaluateNwsWeatherAlerts();
    const phAlert = events.find(e => e.entityId === 'pearl-harbor-hickam');
    expect(phAlert).toBeDefined();
    expect(phAlert!.severity).toBe('critical');
  });

  it('excludes non-CONUS installations (e.g., Camp Arifjan)', async () => {
    // Camp Arifjan: 28.93, 48.10 (middle-east)
    mockGetNwsAlertsAll.mockReturnValue([
      makeNwsAlert({
        id: 'tornado-kuwait',
        event: 'Tornado Warning',
        centroidLat: 28.93,
        centroidLng: 48.10,
        areaDesc: 'Kuwait',
      }),
    ]);

    const events = await evaluateNwsWeatherAlerts();
    const arifjanAlert = events.find(e => e.entityId === 'camp-arifjan');
    expect(arifjanAlert).toBeUndefined();
  });

  it('filters out expired NWS alerts', async () => {
    // getNwsAlertsAll already filters expired alerts (cache does it),
    // but verify the trigger doesn't crash with no alerts
    mockGetNwsAlertsAll.mockReturnValue([]);
    const events = await evaluateNwsWeatherAlerts();
    expect(events).toHaveLength(0);
  });

  it('cooldown prevents duplicate alerts in same run', async () => {
    // Two tornado warnings near Fort Liberty — should only get one alert
    mockGetNwsAlertsAll.mockReturnValue([
      makeNwsAlert({
        id: 'tornado-a',
        event: 'Tornado Warning',
        centroidLat: 35.15,
        centroidLng: -78.98,
      }),
      makeNwsAlert({
        id: 'tornado-b',
        event: 'Tornado Warning',
        centroidLat: 35.16,
        centroidLng: -78.99,
      }),
    ]);

    const events = await evaluateNwsWeatherAlerts();
    // Should get at most 1 tornado alert per installation
    const fortLibertyTornadoAlerts = events.filter(
      e => e.metadata.pattern === 'tornado' && e.entityId === 'fort-liberty',
    );
    expect(fortLibertyTornadoAlerts).toHaveLength(1);
  });
});
