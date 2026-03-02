// app/api/cron/rebuild-nws-alerts/route.ts
// Cron endpoint — fetches NWS weather alerts for all 50 states + DC,
// filters to water-relevant events (floods, tsunamis, storm surge, etc.).
// Schedule: every 30 minutes via Vercel cron.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setNwsAlertCache, getNwsAlertCacheStatus,
  isNwsAlertBuildInProgress, setNwsAlertBuildInProgress,
  type NwsAlert,
} from '@/lib/nwsAlertCache';
import { ALL_STATES } from '@/lib/constants';

// ── Config ───────────────────────────────────────────────────────────────────

const NWS_API = 'https://api.weather.gov/alerts/active';
const NWS_POINTS_API = 'https://api.weather.gov/points';
const NWS_GRIDPOINTS_API = 'https://api.weather.gov/gridpoints';
const CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_PRECIP_LOCATIONS = 20; // Limit precip lookups to avoid timeout
const NWS_USER_AGENT = 'PEARL-Platform/1.0 (water-quality-dashboard)';

// Water-relevant event types (case-insensitive partial match)
const WATER_EVENTS = [
  'flood', 'flash flood', 'coastal flood', 'lakeshore flood',
  'tsunami', 'storm surge', 'rip current', 'high surf',
  'marine', 'small craft', 'gale', 'hurricane', 'tropical storm',
  'water', 'hydrologic', 'dam', 'levee', 'ice jam',
];

function isWaterRelevant(event: string): boolean {
  const lower = event.toLowerCase();
  return WATER_EVENTS.some(w => lower.includes(w));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchStateAlerts(state: string): Promise<NwsAlert[]> {
  const url = `${NWS_API}?area=${state}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'PEARL-Platform/1.0 (water-quality-dashboard)',
      'Accept': 'application/geo+json',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    console.warn(`[NWS Cron] ${state}: HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  const features = data?.features || [];

  const alerts: NwsAlert[] = [];
  for (const f of features) {
    const p = f.properties;
    if (!p?.event || !isWaterRelevant(p.event)) continue;

    // Extract centroid from geometry if available (for precip forecast)
    const geom = f.geometry;
    let centroidLat: number | null = null;
    let centroidLng: number | null = null;
    if (geom?.type === 'Point' && geom?.coordinates) {
      centroidLng = geom.coordinates[0];
      centroidLat = geom.coordinates[1];
    } else if (geom?.type === 'Polygon' && geom?.coordinates?.[0]) {
      // Compute simple centroid from polygon vertices
      const coords = geom.coordinates[0];
      let sumLat = 0, sumLng = 0;
      for (const [lng, lat] of coords) {
        sumLat += lat;
        sumLng += lng;
      }
      centroidLat = sumLat / coords.length;
      centroidLng = sumLng / coords.length;
    }

    alerts.push({
      id: p.id || f.id || '',
      event: p.event,
      severity: p.severity || 'Unknown',
      certainty: p.certainty || 'Unknown',
      urgency: p.urgency || 'Unknown',
      headline: p.headline || '',
      description: (p.description || '').slice(0, 500),
      areaDesc: p.areaDesc || '',
      onset: p.onset || null,
      expires: p.expires || null,
      senderName: p.senderName || '',
      affectedZones: (p.affectedZones || []).slice(0, 20),
      precipForecast: null,
      _centroidLat: centroidLat,
      _centroidLng: centroidLng,
    } as NwsAlert & { _centroidLat: number | null; _centroidLng: number | null });
  }

  return alerts;
}

// ── Flood event keywords ─────────────────────────────────────────────────────

const FLOOD_EVENTS = ['flood', 'flash flood', 'coastal flood', 'lakeshore flood', 'dam', 'levee'];

function isFloodAlert(event: string): boolean {
  const lower = event.toLowerCase();
  return FLOOD_EVENTS.some(w => lower.includes(w));
}

// ── Precipitation Forecast Helpers ──────────────────────────────────────────

interface PrecipForecast {
  total6hr: number | null;
  total24hr: number | null;
}

async function fetchPrecipForecast(lat: number, lng: number): Promise<PrecipForecast | null> {
  try {
    // Step 1: Get grid coordinates from lat/lng
    const pointsUrl = `${NWS_POINTS_API}/${lat.toFixed(4)},${lng.toFixed(4)}`;
    const pointsRes = await fetch(pointsUrl, {
      headers: {
        'User-Agent': NWS_USER_AGENT,
        'Accept': 'application/geo+json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!pointsRes.ok) return null;

    const pointsData = await pointsRes.json();
    const office = pointsData?.properties?.gridId;
    const gridX = pointsData?.properties?.gridX;
    const gridY = pointsData?.properties?.gridY;
    if (!office || gridX == null || gridY == null) return null;

    // Step 2: Get gridpoint forecast data
    const gridUrl = `${NWS_GRIDPOINTS_API}/${office}/${gridX},${gridY}`;
    const gridRes = await fetch(gridUrl, {
      headers: {
        'User-Agent': NWS_USER_AGENT,
        'Accept': 'application/geo+json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!gridRes.ok) return null;

    const gridData = await gridRes.json();
    const qpf = gridData?.properties?.quantitativePrecipitation;
    if (!qpf?.values || !Array.isArray(qpf.values)) return null;

    // Sum precipitation for 6hr and 24hr windows from now
    const now = Date.now();
    const sixHrEnd = now + 6 * 60 * 60 * 1000;
    const twentyFourHrEnd = now + 24 * 60 * 60 * 1000;
    let total6hr = 0;
    let total24hr = 0;
    let has6hr = false;
    let has24hr = false;

    for (const v of qpf.values) {
      // ISO 8601 duration format: "2024-03-01T00:00:00+00:00/PT6H"
      const validTime = v.validTime || '';
      const slashIdx = validTime.indexOf('/');
      if (slashIdx < 0) continue;

      const startStr = validTime.substring(0, slashIdx);
      const startMs = new Date(startStr).getTime();
      if (isNaN(startMs)) continue;

      const val = parseFloat(v.value);
      if (isNaN(val) || val <= 0) continue;

      // Convert mm to inches for display (NWS grid returns mm)
      const valMm = val;

      if (startMs < sixHrEnd && startMs >= now - 60 * 60 * 1000) {
        total6hr += valMm;
        has6hr = true;
      }
      if (startMs < twentyFourHrEnd && startMs >= now - 60 * 60 * 1000) {
        total24hr += valMm;
        has24hr = true;
      }
    }

    return {
      total6hr: has6hr ? Math.round(total6hr * 100) / 100 : null,
      total24hr: has24hr ? Math.round(total24hr * 100) / 100 : null,
    };
  } catch {
    return null;
  }
}

/**
 * Enrich flood alerts with precipitation forecast data.
 * Limited to MAX_PRECIP_LOCATIONS to stay within time budget.
 */
async function enrichFloodAlertsWithPrecip(
  alertsByState: Record<string, { alerts: (NwsAlert & { _centroidLat?: number | null; _centroidLng?: number | null })[]; fetched: string }>
): Promise<number> {
  // Collect flood alerts with coordinates
  const floodAlerts: { alert: NwsAlert & { _centroidLat?: number | null; _centroidLng?: number | null }; lat: number; lng: number }[] = [];

  for (const entry of Object.values(alertsByState)) {
    for (const alert of entry.alerts) {
      if (isFloodAlert(alert.event) && alert._centroidLat != null && alert._centroidLng != null) {
        floodAlerts.push({
          alert,
          lat: alert._centroidLat,
          lng: alert._centroidLng,
        });
      }
      if (floodAlerts.length >= MAX_PRECIP_LOCATIONS) break;
    }
    if (floodAlerts.length >= MAX_PRECIP_LOCATIONS) break;
  }

  if (floodAlerts.length === 0) return 0;

  console.log(`[NWS Cron] Fetching precip forecasts for ${floodAlerts.length} flood alert locations...`);

  // Fetch in parallel with concurrency of 5
  let enriched = 0;
  const queue = [...floodAlerts];
  let idx = 0;
  let running = 0;

  await new Promise<void>((resolve) => {
    function next() {
      if (idx >= queue.length && running === 0) return resolve();
      while (running < 5 && idx < queue.length) {
        const item = queue[idx++];
        running++;
        (async () => {
          try {
            const forecast = await fetchPrecipForecast(item.lat, item.lng);
            if (forecast) {
              item.alert.precipForecast = forecast;
              enriched++;
            }
          } catch {
            // Leave as null on failure
          } finally {
            running--;
            next();
          }
        })();
      }
    }
    next();
  });

  // Clean up temporary centroid fields
  for (const entry of Object.values(alertsByState)) {
    for (const alert of entry.alerts) {
      delete (alert as any)._centroidLat;
      delete (alert as any)._centroidLng;
    }
  }

  return enriched;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isNwsAlertBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'NWS alert build already in progress',
      cache: getNwsAlertCacheStatus(),
    });
  }

  setNwsAlertBuildInProgress(true);
  const startTime = Date.now();

  try {
    const alertsByState: Record<string, { alerts: NwsAlert[]; fetched: string }> = {};
    let totalAlerts = 0;
    let failedStates = 0;

    // Process states with semaphore concurrency
    const queue = [...ALL_STATES];
    const inFlight: Promise<void>[] = [];

    async function processState(state: string) {
      try {
        const alerts = await fetchStateAlerts(state);
        alertsByState[state] = {
          alerts,
          fetched: new Date().toISOString(),
        };
        totalAlerts += alerts.length;
        if (alerts.length > 0) {
          console.log(`[NWS Cron] ${state}: ${alerts.length} water alerts`);
        }
      } catch (err: any) {
        console.warn(`[NWS Cron] ${state} failed: ${err.message}`);
        failedStates++;
        // Keep existing data for failed states
      }
    }

    while (queue.length > 0 || inFlight.length > 0) {
      while (inFlight.length < CONCURRENCY && queue.length > 0) {
        const state = queue.shift()!;
        const p = processState(state).then(() => {
          inFlight.splice(inFlight.indexOf(p), 1);
        });
        inFlight.push(p);
      }
      if (inFlight.length > 0) {
        await Promise.race(inFlight);
      }
    }

    // Empty-data guard — but for alerts, 0 is normal (no active alerts)
    // Only skip if ALL states failed
    if (Object.keys(alertsByState).length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[NWS Cron] All states failed in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'error',
        duration: `${elapsed}s`,
        failedStates,
        cache: getNwsAlertCacheStatus(),
      });
    }

    // Enrich flood alerts with precipitation forecast data
    let precipEnriched = 0;
    try {
      precipEnriched = await enrichFloodAlertsWithPrecip(alertsByState as any);
      if (precipEnriched > 0) {
        console.log(`[NWS Cron] Precip enrichment: ${precipEnriched} flood alerts enriched`);
      }
    } catch (e: any) {
      console.warn(`[NWS Cron] Precip enrichment failed: ${e.message} — continuing without precip data`);
    }

    await setNwsAlertCache(alertsByState);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[NWS Cron] Complete in ${elapsed}s — ${totalAlerts} water alerts across ${Object.keys(alertsByState).length} states`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      totalAlerts,
      statesFetched: Object.keys(alertsByState).length,
      failedStates,
      precipEnriched,
      cache: getNwsAlertCacheStatus(),
    });

  } catch (err: any) {
    console.error('[NWS Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'NWS alert build failed' },
      { status: 500 },
    );
  } finally {
    setNwsAlertBuildInProgress(false);
  }
}
