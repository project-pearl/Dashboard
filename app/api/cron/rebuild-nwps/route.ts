// app/api/cron/rebuild-nwps/route.ts
// Cron endpoint — fetches NOAA NWPS river flood gauge data for all 50 states + DC.
// Schedule: every 30 minutes via Vercel cron.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setNwpsCache, getNwpsCacheStatus,
  isNwpsBuildInProgress, setNwpsBuildInProgress,
  gridKey,
  type NwpsGauge,
} from '@/lib/nwpsCache';
import { ALL_STATES } from '@/lib/constants';

// ── Config ───────────────────────────────────────────────────────────────────

const NWPS_API = 'https://api.water.noaa.gov/nwps/v1/gauges';
const CONCURRENCY = 10;
const STAGEFLOW_CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 20_000;
const STAGEFLOW_TIMEOUT_MS = 10_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseStatus(s: string | undefined | null): NwpsGauge['status'] {
  if (!s) return 'not_defined';
  const lower = s.toLowerCase().replace(/\s+/g, '_');
  if (lower === 'no_flooding') return 'no_flooding';
  if (lower === 'minor') return 'minor';
  if (lower === 'moderate') return 'moderate';
  if (lower === 'major') return 'major';
  return 'not_defined';
}

async function fetchStateGauges(state: string): Promise<NwpsGauge[]> {
  const url = `${NWPS_API}?stateCd=${state}&srid=epsg:4326`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PEARL-Platform/1.0', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    console.warn(`[NWPS Cron] ${state}: HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  const gauges: NwpsGauge[] = [];

  // API returns { gauges: [...] } array
  const rawGauges = data?.gauges || data || [];
  const list = Array.isArray(rawGauges) ? rawGauges : [];

  for (const g of list) {
    const lat = parseFloat(g.latitude ?? g.lat ?? '');
    const lng = parseFloat(g.longitude ?? g.lng ?? g.lon ?? '');
    if (isNaN(lat) || isNaN(lng)) continue;

    const obs = g.status?.observed || g.observed || null;
    const fcst = g.status?.forecast || g.forecast || null;

    const rfcRaw = g.rfc || null;
    const rfc = rfcRaw && rfcRaw.abbreviation
      ? { abbreviation: rfcRaw.abbreviation, name: rfcRaw.name || rfcRaw.abbreviation }
      : null;

    gauges.push({
      lid: g.lid || g.gaugeId || g.id || '',
      name: g.name || g.gaugeName || '',
      state: state,
      county: g.county || '',
      lat,
      lng,
      wfo: typeof g.wfo === 'string' ? g.wfo : g.wfo?.abbreviation || '',
      rfc,
      status: parseStatus(g.status?.floodStatus || g.floodStatus || g.status),
      observed: obs ? {
        primary: obs.primary ?? obs.value ?? null,
        unit: obs.primaryUnit ?? obs.unit ?? 'ft',
        time: obs.validTime ?? obs.time ?? '',
      } : null,
      forecast: fcst ? {
        primary: fcst.primary ?? fcst.value ?? null,
        unit: fcst.primaryUnit ?? fcst.unit ?? 'ft',
        time: fcst.validTime ?? fcst.time ?? '',
      } : null,
      stageflow: null,
    });
  }

  return gauges;
}

// ── Stageflow Helper ─────────────────────────────────────────────────────

async function fetchStageflow(lid: string): Promise<Array<{ time: string; stage: number | null; flow: number | null }> | null> {
  try {
    const url = `${NWPS_API}/${lid}/stageflow`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PEARL-Platform/1.0', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(STAGEFLOW_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // API may return { stageflow: [...] } or top-level array
    const raw = data?.stageflow || data || [];
    const list = Array.isArray(raw) ? raw : [];
    if (list.length === 0) return null;

    // Take up to 28 entries (7 days at 6h intervals) for flood prediction
    const entries = list.slice(0, 28).map((entry: any) => ({
      time: entry.validTime ?? entry.time ?? entry.dateTime ?? '',
      stage: entry.stage != null ? parseFloat(entry.stage) : null,
      flow: entry.flow != null ? parseFloat(entry.flow) : null,
    }));

    // Filter out entries where both stage and flow are null/NaN
    const valid = entries.filter((e: any) => (e.stage !== null && !isNaN(e.stage)) || (e.flow !== null && !isNaN(e.flow)));
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

async function enrichGaugesWithStageflow(gauges: NwpsGauge[]): Promise<void> {
  // Only fetch stageflow for gauges with a lid and status !== 'not_defined'
  const eligible = gauges.filter(g => g.lid && g.status !== 'not_defined');
  if (eligible.length === 0) return;

  // Process in batches with STAGEFLOW_CONCURRENCY
  for (let i = 0; i < eligible.length; i += STAGEFLOW_CONCURRENCY) {
    const batch = eligible.slice(i, i + STAGEFLOW_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (g) => {
        const sf = await fetchStageflow(g.lid);
        return { lid: g.lid, stageflow: sf };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.stageflow) {
        const gauge = gauges.find(g => g.lid === r.value.lid);
        if (gauge) gauge.stageflow = r.value.stageflow;
      }
    }
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isNwpsBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'NWPS build already in progress',
      cache: getNwpsCacheStatus(),
    });
  }

  setNwpsBuildInProgress(true);
  const startTime = Date.now();

  try {
    const allGauges: NwpsGauge[] = [];
    let failedStates = 0;

    // Process states with semaphore concurrency
    const queue = [...ALL_STATES];
    const inFlight: Promise<void>[] = [];

    async function processState(state: string) {
      try {
        const gauges = await fetchStateGauges(state);
        // Enrich eligible gauges with stageflow data
        if (gauges.length > 0) {
          await enrichGaugesWithStageflow(gauges);
        }
        allGauges.push(...gauges);
        if (gauges.length > 0) {
          const sfCount = gauges.filter(g => g.stageflow !== null).length;
          console.log(`[NWPS Cron] ${state}: ${gauges.length} gauges (${sfCount} with stageflow)`);
        }
      } catch (err: any) {
        console.warn(`[NWPS Cron] ${state} failed: ${err.message}`);
        failedStates++;
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

    // Build grid index
    const grid: Record<string, { gauges: NwpsGauge[] }> = {};
    for (const g of allGauges) {
      const key = gridKey(g.lat, g.lng);
      if (!grid[key]) grid[key] = { gauges: [] };
      grid[key].gauges.push(g);
    }

    // Empty-data guard
    if (allGauges.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[NWPS Cron] 0 gauges in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        failedStates,
        cache: getNwpsCacheStatus(),
      });
    }

    await setNwpsCache({
      _meta: {
        built: new Date().toISOString(),
        gaugeCount: allGauges.length,
        gridCells: Object.keys(grid).length,
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const flooding = allGauges.filter(g => g.status !== 'no_flooding' && g.status !== 'not_defined');
    console.log(`[NWPS Cron] Complete in ${elapsed}s — ${allGauges.length} gauges, ${flooding.length} flooding`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      gaugeCount: allGauges.length,
      floodingCount: flooding.length,
      gridCells: Object.keys(grid).length,
      failedStates,
      cache: getNwpsCacheStatus(),
    });

  } catch (err: any) {
    console.error('[NWPS Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'NWPS build failed' },
      { status: 500 },
    );
  } finally {
    setNwpsBuildInProgress(false);
  }
}
