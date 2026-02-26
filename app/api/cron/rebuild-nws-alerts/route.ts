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
const CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 15_000;

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
    });
  }

  return alerts;
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

    await setNwsAlertCache(alertsByState);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[NWS Cron] Complete in ${elapsed}s — ${totalAlerts} water alerts across ${Object.keys(alertsByState).length} states`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      totalAlerts,
      statesFetched: Object.keys(alertsByState).length,
      failedStates,
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
