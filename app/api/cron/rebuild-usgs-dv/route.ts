// app/api/cron/rebuild-usgs-dv/route.ts
// Cron endpoint — fetches USGS 7-day daily value summaries for stream stations.
// Parameters: discharge, gage height, water temp, DO, pH, conductivity.
// Schedule: daily via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setUsgsDvCache, getUsgsDvCacheStatus,
  isUsgsDvBuildInProgress, setUsgsDvBuildInProgress,
  gridKey,
  type UsgsDvStation,
} from '@/lib/usgsDvCache';
import { ALL_STATES } from '@/lib/constants';
import { isCronAuthorized } from '@/lib/apiAuth';

// ── Config ───────────────────────────────────────────────────────────────────

const DV_URL = 'https://waterservices.usgs.gov/nwis/dv/';
const PARAM_CODES = '00060,00065,00010,00300,00400,00095';
const CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 30_000;
const DELAY_MS = 500;

const PARAM_NAMES: Record<string, string> = {
  '00060': 'discharge',
  '00065': 'gageHeight',
  '00010': 'waterTemp',
  '00300': 'dissolvedOxygen',
  '00400': 'pH',
  '00095': 'conductivity',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

interface ParsedStation {
  siteId: string;
  name: string;
  lat: number;
  lng: number;
  params: Record<string, { mean: number | null; min: number | null; max: number | null; unit: string; date: string }>;
}

function parseUsgsResponse(json: any, stateCode: string): UsgsDvStation[] {
  const timeSeries = json?.value?.timeSeries;
  if (!Array.isArray(timeSeries)) return [];

  // Group by site
  const siteMap: Record<string, ParsedStation> = {};

  for (const ts of timeSeries) {
    try {
      const siteCode = ts.sourceInfo?.siteCode?.[0]?.value;
      const siteName = ts.sourceInfo?.siteName || '';
      const geo = ts.sourceInfo?.geoLocation?.geogLocation;
      const lat = parseFloat(geo?.latitude);
      const lng = parseFloat(geo?.longitude);
      if (!siteCode || isNaN(lat) || isNaN(lng)) continue;

      const varCode = ts.variable?.variableCode?.[0]?.value;
      const unit = ts.variable?.unit?.unitCode || '';
      const paramName = PARAM_NAMES[varCode] || varCode;
      const values = ts.values?.[0]?.value;

      if (!Array.isArray(values) || values.length === 0) continue;

      // Compute mean/min/max from 7-day values
      const nums: number[] = [];
      let latestDate = '';
      for (const v of values) {
        const n = parseNum(v.value);
        if (n !== null) nums.push(n);
        if (v.dateTime && v.dateTime > latestDate) latestDate = v.dateTime;
      }

      const mean = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
      const min = nums.length > 0 ? Math.min(...nums) : null;
      const max = nums.length > 0 ? Math.max(...nums) : null;

      if (!siteMap[siteCode]) {
        siteMap[siteCode] = {
          siteId: siteCode,
          name: siteName,
          lat,
          lng,
          params: {},
        };
      }

      siteMap[siteCode].params[paramName] = {
        mean: mean !== null ? Math.round(mean * 1000) / 1000 : null,
        min: min !== null ? Math.round(min * 1000) / 1000 : null,
        max: max !== null ? Math.round(max * 1000) / 1000 : null,
        unit,
        date: latestDate,
      };
    } catch {
      // skip malformed timeSeries entry
    }
  }

  return Object.values(siteMap).map(s => ({
    ...s,
    state: stateCode,
  }));
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isUsgsDvBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'USGS-DV build already in progress',
      cache: getUsgsDvCacheStatus(),
    });
  }

  setUsgsDvBuildInProgress(true);
  const startTime = Date.now();

  try {
    console.log(`[USGS-DV Cron] Fetching daily values for ${ALL_STATES.length} states (concurrency=${CONCURRENCY})...`);

    const allStations: UsgsDvStation[] = [];
    let fetchErrors = 0;
    const failedStates: string[] = [];

    // Process states in batches of CONCURRENCY
    for (let i = 0; i < ALL_STATES.length; i += CONCURRENCY) {
      const batch = ALL_STATES.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (st) => {
          const url = `${DV_URL}?stateCd=${st}&parameterCd=${PARAM_CODES}&period=P7D&format=json&siteType=ST`;
          try {
            const res = await fetch(url, {
              headers: { 'User-Agent': 'PEARL-Platform/1.0' },
              signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });
            if (!res.ok) {
              console.warn(`[USGS-DV Cron] ${st}: HTTP ${res.status}`);
              return { state: st, stations: [] as UsgsDvStation[], error: true };
            }
            const json = await res.json();
            const stations = parseUsgsResponse(json, st);
            return { state: st, stations, error: false };
          } catch (err: any) {
            console.warn(`[USGS-DV Cron] ${st}: ${err.message}`);
            return { state: st, stations: [] as UsgsDvStation[], error: true };
          }
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          if (r.value.error) {
            fetchErrors++;
            failedStates.push(r.value.state);
          }
          allStations.push(...r.value.stations);
        } else {
          fetchErrors++;
        }
      }

      if (i + CONCURRENCY < ALL_STATES.length) await delay(DELAY_MS);
    }

    // Retry failed states once
    if (failedStates.length > 0) {
      console.log(`[USGS-DV Cron] Retrying ${failedStates.length} failed states...`);
      await delay(5000);
      for (const st of failedStates) {
        try {
          const url = `${DV_URL}?stateCd=${st}&parameterCd=${PARAM_CODES}&period=P7D&format=json&siteType=ST`;
          const res = await fetch(url, {
            headers: { 'User-Agent': 'PEARL-Platform/1.0' },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS * 2),
          });
          if (res.ok) {
            const json = await res.json();
            const stations = parseUsgsResponse(json, st);
            allStations.push(...stations);
            fetchErrors--;
            console.log(`[USGS-DV Cron] Retry ${st}: OK (${stations.length} stations)`);
          }
        } catch {
          // keep original error count
        }
      }
    }

    console.log(`[USGS-DV Cron] Parsed ${allStations.length} stations total`);

    // Build grid index
    const grid: Record<string, { stations: UsgsDvStation[] }> = {};
    for (const s of allStations) {
      const key = gridKey(s.lat, s.lng);
      if (!grid[key]) grid[key] = { stations: [] };
      grid[key].stations.push(s);
    }

    // Empty-data guard
    if (allStations.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[USGS-DV Cron] 0 stations in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getUsgsDvCacheStatus(),
      });
    }

    await setUsgsDvCache({
      _meta: {
        built: new Date().toISOString(),
        stationCount: allStations.length,
        gridCells: Object.keys(grid).length,
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[USGS-DV Cron] Complete in ${elapsed}s — ${allStations.length} stations, ${Object.keys(grid).length} cells`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      stationCount: allStations.length,
      gridCells: Object.keys(grid).length,
      fetchErrors,
      cache: getUsgsDvCacheStatus(),
    });

  } catch (err: any) {
    console.error('[USGS-DV Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'USGS-DV build failed' },
      { status: 500 },
    );
  } finally {
    setUsgsDvBuildInProgress(false);
  }
}
