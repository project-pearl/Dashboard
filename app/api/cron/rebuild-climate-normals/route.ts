// app/api/cron/rebuild-climate-normals/route.ts
// Cron endpoint — fetches NOAA Climate Data Online (CDO) county-level normals
// and recent extreme event counts.
// Schedule: weekly (Sunday 11:30 PM UTC) via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setClimateNormalsCache,
  getClimateNormalsCacheStatus,
  isClimateNormalsBuildInProgress,
  setClimateNormalsBuildInProgress,
  type CountyClimateNormals,
} from '@/lib/climateNormalsCache';
import { PRIORITY_STATES_WITH_FIPS } from '@/lib/constants';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const CDO_BASE = 'https://www.ncei.noaa.gov/cdo-web/api/v2';
const FETCH_TIMEOUT_MS = 30_000;
const CONCURRENCY = 3; // NOAA rate-limits aggressively
const DELAY_BETWEEN_STATES_MS = 2_000;

function getToken(): string {
  return process.env.NCDC_TOKEN || process.env.CDO_TOKEN || '';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

async function cdoFetch(endpoint: string): Promise<any> {
  const token = getToken();
  if (!token) throw new Error('No NCDC_TOKEN configured');

  const url = `${CDO_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'token': token,
      'User-Agent': 'PEARL-Platform/1.0',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (res.status === 429) {
    // Rate limited — wait and retry once
    await new Promise(r => setTimeout(r, 5000));
    const retry = await fetch(url, {
      headers: { 'token': token, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!retry.ok) throw new Error(`CDO rate-limited: HTTP ${retry.status}`);
    return retry.json();
  }

  if (!res.ok) throw new Error(`CDO API: HTTP ${res.status}`);
  return res.json();
}

function classifyDrought(avgPrecip: number | null, recentPrecip: number | null): CountyClimateNormals['droughtTendency'] {
  if (avgPrecip === null || recentPrecip === null) return null;
  if (avgPrecip === 0) return null;
  const ratio = recentPrecip / avgPrecip;
  if (ratio < 0.6) return 'drought';
  if (ratio < 0.85) return 'dry';
  if (ratio > 1.15) return 'wet';
  return 'normal';
}

// ── Fetch county normals for a state ────────────────────────────────────────

async function fetchStateNormals(stateAbbr: string, stateFips: string): Promise<CountyClimateNormals[]> {
  const counties: CountyClimateNormals[] = [];

  try {
    // 1. Get stations in state to build county station inventory
    const stationsData = await cdoFetch(
      `/stations?locationid=FIPS:${stateFips}&datasetid=NORMAL_DLY&limit=1000`
    );
    const stations = stationsData?.results || [];

    // Group stations by county FIPS
    const stationsByCounty = new Map<string, { id: string; name: string; countyFips: string; countyName: string }[]>();

    for (const stn of stations) {
      // Extract county FIPS from station metadata if available
      const countyFips = stn.countyFips || stn.locationId?.replace('FIPS:', '') || '';
      if (!countyFips || countyFips.length < 5) continue;

      if (!stationsByCounty.has(countyFips)) stationsByCounty.set(countyFips, []);
      stationsByCounty.get(countyFips)!.push({
        id: stn.id,
        name: stn.name || '',
        countyFips,
        countyName: stn.countyName || stn.name || '',
      });
    }

    // 2. Fetch normals data for state — NORMAL_DLY aggregate
    const normalsData = await cdoFetch(
      `/data?datasetid=NORMAL_DLY&locationid=FIPS:${stateFips}&datatypeid=DLY-TAVG-NORMAL,DLY-TMAX-NORMAL,DLY-TMIN-NORMAL,DLY-PRCP-NORMAL,DLY-HTDD-NORMAL,DLY-CLDD-NORMAL&startdate=2020-01-01&enddate=2020-12-31&limit=1000&units=standard`
    );
    const normalsResults = normalsData?.results || [];

    // Aggregate by station then by county
    const stationAgg = new Map<string, { tavg: number[]; tmax: number[]; tmin: number[]; prcp: number[]; htdd: number[]; cldd: number[] }>();
    for (const r of normalsResults) {
      const stationId = r.station;
      if (!stationAgg.has(stationId)) {
        stationAgg.set(stationId, { tavg: [], tmax: [], tmin: [], prcp: [], htdd: [], cldd: [] });
      }
      const agg = stationAgg.get(stationId)!;
      const val = parseNum(r.value);
      if (val === null) continue;

      switch (r.datatype) {
        case 'DLY-TAVG-NORMAL': agg.tavg.push(val); break;
        case 'DLY-TMAX-NORMAL': agg.tmax.push(val); break;
        case 'DLY-TMIN-NORMAL': agg.tmin.push(val); break;
        case 'DLY-PRCP-NORMAL': agg.prcp.push(val); break;
        case 'DLY-HTDD-NORMAL': agg.htdd.push(val); break;
        case 'DLY-CLDD-NORMAL': agg.cldd.push(val); break;
      }
    }

    // 3. Fetch recent extremes — GHCND for last year
    const lastYear = new Date().getFullYear() - 1;
    let extremeHeatDays = 0;
    let extremeColdDays = 0;
    let heavyPrecipDays = 0;
    let recentPrecipTotal = 0;

    try {
      const ghcndData = await cdoFetch(
        `/data?datasetid=GHCND&locationid=FIPS:${stateFips}&datatypeid=TMAX,TMIN,PRCP&startdate=${lastYear}-01-01&enddate=${lastYear}-12-31&limit=1000&units=standard`
      );
      const ghcndResults = ghcndData?.results || [];

      for (const r of ghcndResults) {
        const val = parseNum(r.value);
        if (val === null) continue;
        if (r.datatype === 'TMAX' && val >= 100) extremeHeatDays++;
        if (r.datatype === 'TMIN' && val <= 0) extremeColdDays++;
        if (r.datatype === 'PRCP') {
          if (val >= 2.0) heavyPrecipDays++;
          recentPrecipTotal += val;
        }
      }
    } catch {
      // GHCND extremes are best-effort
    }

    // 4. Build county-level aggregations
    // For simplicity, create one record per county with averaged station data
    const countyFipsSet = new Set<string>();
    for (const [countyFips, stns] of stationsByCounty) {
      if (countyFipsSet.has(countyFips)) continue;
      countyFipsSet.add(countyFips);

      const countyTavg: number[] = [];
      const countyTmax: number[] = [];
      const countyTmin: number[] = [];
      const countyPrcp: number[] = [];
      const countyHtdd: number[] = [];
      const countyCldd: number[] = [];

      for (const stn of stns) {
        const agg = stationAgg.get(stn.id);
        if (agg) {
          countyTavg.push(...agg.tavg);
          countyTmax.push(...agg.tmax);
          countyTmin.push(...agg.tmin);
          countyPrcp.push(...agg.prcp);
          countyHtdd.push(...agg.htdd);
          countyCldd.push(...agg.cldd);
        }
      }

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
      const sum = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) : null;
      const avgPrecip = avg(countyPrcp);

      counties.push({
        countyFips,
        countyName: stns[0]?.countyName || countyFips,
        state: stateAbbr,
        avgTempF: avg(countyTavg) !== null ? Math.round(avg(countyTavg)! * 10) / 10 : null,
        avgMaxTempF: avg(countyTmax) !== null ? Math.round(avg(countyTmax)! * 10) / 10 : null,
        avgMinTempF: avg(countyTmin) !== null ? Math.round(avg(countyTmin)! * 10) / 10 : null,
        avgPrecipIn: avgPrecip !== null ? Math.round(avgPrecip * 100) / 100 : null,
        heatingDegreeDays: sum(countyHtdd) !== null ? Math.round(sum(countyHtdd)!) : null,
        coolingDegreeDays: sum(countyCldd) !== null ? Math.round(sum(countyCldd)!) : null,
        extremeHeatDays,
        extremeColdDays,
        heavyPrecipDays,
        droughtTendency: classifyDrought(avgPrecip, recentPrecipTotal > 0 ? recentPrecipTotal / 365 : null),
        stationCount: stns.length,
      });
    }
  } catch (err: any) {
    console.warn(`[Climate Normals Cron] ${stateAbbr} failed: ${err.message}`);
  }

  return counties;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isClimateNormalsBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Climate normals build already in progress',
      cache: getClimateNormalsCacheStatus(),
    });
  }

  setClimateNormalsBuildInProgress(true);
  const startTime = Date.now();

  try {
    const countiesByState: Record<string, { normals: CountyClimateNormals[]; fetched: string }> = {};
    let totalCounties = 0;
    let failedStates = 0;

    // Process states sequentially with delay (NOAA rate limits)
    for (const [stateAbbr, stateFips] of PRIORITY_STATES_WITH_FIPS) {
      try {
        const normals = await fetchStateNormals(stateAbbr, stateFips);
        countiesByState[stateAbbr] = { normals, fetched: new Date().toISOString() };
        totalCounties += normals.length;
        if (normals.length > 0) {
          console.log(`[Climate Normals Cron] ${stateAbbr}: ${normals.length} counties`);
        }
      } catch (err: any) {
        console.warn(`[Climate Normals Cron] ${stateAbbr} failed: ${err.message}`);
        failedStates++;
      }

      // Rate limit delay between states
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_STATES_MS));
    }

    // Empty-data guard
    if (totalCounties === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[Climate Normals Cron] 0 counties in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        failedStates,
        cache: getClimateNormalsCacheStatus(),
      });
    }

    await setClimateNormalsCache(countiesByState);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Climate Normals Cron] Complete in ${elapsed}s — ${totalCounties} counties`);

    recordCronRun('rebuild-climate-normals', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      countyCount: totalCounties,
      statesProcessed: Object.keys(countiesByState).length,
      failedStates,
      cache: getClimateNormalsCacheStatus(),
    });

  } catch (err: any) {
    console.error('[Climate Normals Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-climate-normals' } });
    notifySlackCronFailure({ cronName: 'rebuild-climate-normals', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-climate-normals', 'error', Date.now() - startTime, err.message);

    return NextResponse.json(
      { status: 'error', error: err.message || 'Climate normals build failed' },
      { status: 500 },
    );
  } finally {
    setClimateNormalsBuildInProgress(false);
  }
}
