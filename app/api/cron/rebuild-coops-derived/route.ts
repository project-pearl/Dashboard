// app/api/cron/rebuild-coops-derived/route.ts
// Cron endpoint — fetches NOAA CO-OPS derived products: sea level trends,
// high tide flooding annual stats, and sea level rise projections.
// Schedule: weekly (Sunday) via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setCoopsDerivedCache, getCoopsDerivedCacheStatus,
  isCoopsDerivedBuildInProgress, setCoopsDerivedBuildInProgress,
  gridKey,
  type CoopsDerivedStation,
} from '@/lib/coopsDerivedCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const SEA_LEVEL_TRENDS_URL = 'https://api.tidesandcurrents.noaa.gov/dpapi/prod/webapi/product/sealvltrends.json';
const HTF_ANNUAL_URL = 'https://api.tidesandcurrents.noaa.gov/dpapi/prod/webapi/htf/htf_annual.json';
const SLR_PROJECTIONS_URL = 'https://api.tidesandcurrents.noaa.gov/dpapi/prod/webapi/product/slr_projections.json';
const CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 15_000;
const DELAY_MS = 200;

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

interface TrendStation {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  trend: number | null;
  ci: number | null;
}

function parseTrendsResponse(data: any): TrendStation[] {
  // The response can be an object with a stationList or an array directly
  const list = data?.stationList || data?.sealvltrends || data;
  if (!Array.isArray(list)) return [];

  const stations: TrendStation[] = [];
  for (const s of list) {
    const id = s.id || s.stationId || s.station_id || '';
    const lat = parseNum(s.lat || s.latitude);
    const lng = parseNum(s.lng || s.lon || s.longitude);
    if (!id || lat === null || lng === null) continue;

    stations.push({
      id: String(id),
      name: s.name || s.stationName || s.station_name || '',
      state: s.state || '',
      lat,
      lng,
      trend: parseNum(s.trend || s.linearTrend || s.msl_trend),
      ci: parseNum(s.confidence_interval || s.ci || s.msl_trend_ci),
    });
  }
  return stations;
}

async function fetchHtfAnnual(stationId: string): Promise<{ days: number | null; year: number | null }> {
  try {
    const res = await fetch(`${HTF_ANNUAL_URL}?station=${stationId}`, {
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { days: null, year: null };
    const data = await res.json();

    // Look for most recent year entry
    const entries = data?.htfAnnual || data?.AnnualFloodDays || data;
    if (!Array.isArray(entries) || entries.length === 0) return { days: null, year: null };

    // Sort by year descending to get most recent
    const sorted = [...entries].sort((a: any, b: any) => {
      const ya = parseInt(a.year || a.Year || '0');
      const yb = parseInt(b.year || b.Year || '0');
      return yb - ya;
    });

    const latest = sorted[0];
    const year = parseInt(latest.year || latest.Year || '0') || null;
    const days = parseNum(latest.floodDays || latest.count || latest.FloodDays || latest.Count);
    return { days, year };
  } catch {
    return { days: null, year: null };
  }
}

async function fetchSlrProjection(stationId: string): Promise<number | null> {
  try {
    const res = await fetch(`${SLR_PROJECTIONS_URL}?station=${stationId}`, {
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();

    // Look for intermediate scenario 2050 projection
    const projections = data?.slrProjections || data?.projections || data;
    if (!Array.isArray(projections)) return null;

    for (const p of projections) {
      const scenario = (p.scenario || p.Scenario || '').toLowerCase();
      const year = parseInt(p.year || p.Year || '0');
      if (
        (scenario.includes('intermediate') || scenario.includes('int')) &&
        year === 2050
      ) {
        return parseNum(p.value || p.Value || p.projection);
      }
    }

    // Fallback: look for any 2050 entry
    for (const p of projections) {
      const year = parseInt(p.year || p.Year || '0');
      if (year === 2050) {
        return parseNum(p.value || p.Value || p.projection);
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isCoopsDerivedBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'CO-OPS Derived build already in progress',
      cache: getCoopsDerivedCacheStatus(),
    });
  }

  setCoopsDerivedBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Step 1: Fetch sea level trends (single bulk call)
    console.log('[CO-OPS Derived Cron] Fetching sea level trends...');
    const trendsRes = await fetch(SEA_LEVEL_TRENDS_URL, {
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!trendsRes.ok) throw new Error(`Sea level trends: HTTP ${trendsRes.status}`);
    const trendsData = await trendsRes.json();
    const trendStations = parseTrendsResponse(trendsData);
    console.log(`[CO-OPS Derived Cron] ${trendStations.length} stations with sea level trends`);

    // Filter to stations that have a trend value
    const stationsWithTrend = trendStations.filter(s => s.trend !== null);
    console.log(`[CO-OPS Derived Cron] ${stationsWithTrend.length} stations with valid trends — fetching HTF + SLR...`);

    // Step 2: Batch fetch HTF annual + SLR projections
    const stations: CoopsDerivedStation[] = [];
    let fetchErrors = 0;

    for (let i = 0; i < stationsWithTrend.length; i += CONCURRENCY) {
      const batch = stationsWithTrend.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (s) => {
          try {
            const [htf, slr] = await Promise.all([
              fetchHtfAnnual(s.id),
              fetchSlrProjection(s.id),
            ]);

            return {
              id: s.id,
              name: s.name,
              state: s.state,
              lat: s.lat,
              lng: s.lng,
              seaLevelTrend: s.trend,
              seaLevelTrendCI: s.ci,
              htfAnnualDays: htf.days,
              htfAnnualYear: htf.year,
              slrProjection2050: slr,
            } as CoopsDerivedStation;
          } catch {
            fetchErrors++;
            return {
              id: s.id,
              name: s.name,
              state: s.state,
              lat: s.lat,
              lng: s.lng,
              seaLevelTrend: s.trend,
              seaLevelTrendCI: s.ci,
              htfAnnualDays: null,
              htfAnnualYear: null,
              slrProjection2050: null,
            } as CoopsDerivedStation;
          }
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          stations.push(r.value);
        }
      }

      if (i + CONCURRENCY < stationsWithTrend.length) await delay(DELAY_MS);
    }

    // Also include stations with trends but no enrichment data
    // (they're already included via the batch above)

    console.log(`[CO-OPS Derived Cron] ${stations.length} stations processed`);

    // Build grid index
    const grid: Record<string, { stations: CoopsDerivedStation[] }> = {};
    for (const s of stations) {
      const key = gridKey(s.lat, s.lng);
      if (!grid[key]) grid[key] = { stations: [] };
      grid[key].stations.push(s);
    }

    // Empty-data guard
    if (stations.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[CO-OPS Derived Cron] 0 stations in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getCoopsDerivedCacheStatus(),
      });
    }

    await setCoopsDerivedCache({
      _meta: {
        built: new Date().toISOString(),
        stationCount: stations.length,
        gridCells: Object.keys(grid).length,
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[CO-OPS Derived Cron] Complete in ${elapsed}s — ${stations.length} stations, ${Object.keys(grid).length} cells`);

    recordCronRun('rebuild-coops-derived', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      stationCount: stations.length,
      gridCells: Object.keys(grid).length,
      fetchErrors,
      cache: getCoopsDerivedCacheStatus(),
    });

  } catch (err: any) {
    console.error('[CO-OPS Derived Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-coops-derived' } });

    notifySlackCronFailure({ cronName: 'rebuild-coops-derived', error: err.message || 'build failed', duration: Date.now() - startTime });

    recordCronRun('rebuild-coops-derived', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'CO-OPS Derived build failed' },
      { status: 500 },
    );
  } finally {
    setCoopsDerivedBuildInProgress(false);
  }
}
