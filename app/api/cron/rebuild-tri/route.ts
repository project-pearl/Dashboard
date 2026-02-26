// app/api/cron/rebuild-tri/route.ts
// Cron endpoint — fetches EPA TRI (Toxics Release Inventory) facility data
// from ENVIROFACTS REST API for all 50 states + DC.
// Schedule: daily at 6 PM UTC via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setTriCache, getTriCacheStatus,
  isTriBuildInProgress, setTriBuildInProgress,
  gridKey,
  type TriFacility,
} from '@/lib/triCache';
import { ALL_STATES } from '@/lib/constants';

// ── Config ───────────────────────────────────────────────────────────────────

const ENVIROFACTS_URL = 'https://data.epa.gov/efservice/MV_TRI_BASIC_DOWNLOAD';
const CONCURRENCY = 6;
const FETCH_TIMEOUT_MS = 30_000;
const PAGE_SIZE = 5000;
const TRI_YEAR = 2023; // Latest available TRI reporting year

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

interface RawTriRow {
  TRI_FACILITY_ID?: string;
  FACILITY_NAME?: string;
  ST_ABBR?: string;
  CITY_NAME?: string;
  COUNTY_NAME?: string;
  LATITUDE?: string | number;
  LONGITUDE?: string | number;
  CHEMICAL?: string;
  CARCINOGEN?: string;
  TOTAL_RELEASES?: string | number;
  ON_SITE_RELEASE_TOTAL?: string | number;
  OFF_SITE_RELEASE_TOTAL?: string | number;
  SIC_CODE?: string;
  NAICS_CODE?: string;
  REPORTING_YEAR?: string | number;
  [key: string]: any;
}

async function fetchStateTRI(state: string): Promise<TriFacility[]> {
  const facilities = new Map<string, {
    triId: string; facilityName: string; state: string; city: string;
    county: string; lat: number; lng: number; totalReleases: number;
    carcinogenReleases: number; chemicals: Set<string>; industryCode: string;
  }>();

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `${ENVIROFACTS_URL}/REPORTING_YEAR/=/${TRI_YEAR}/ST_ABBR/=/${state}/rows/${offset}:${offset + PAGE_SIZE - 1}/JSON`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'PEARL-Platform/1.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.warn(`[TRI Cron] ${state} page ${offset}: HTTP ${res.status}`);
        break;
      }
      const rows: RawTriRow[] = await res.json();

      if (!Array.isArray(rows) || rows.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of rows) {
        const id = row.TRI_FACILITY_ID || '';
        if (!id) continue;

        const lat = parseNum(row.LATITUDE);
        const lng = parseNum(row.LONGITUDE);
        if (lat === null || lng === null) continue;

        const release = (parseNum(row.ON_SITE_RELEASE_TOTAL) || 0) + (parseNum(row.OFF_SITE_RELEASE_TOTAL) || 0);
        const chemical = row.CHEMICAL || '';
        const isCarcinogen = (row.CARCINOGEN || '').toUpperCase() === 'YES';

        if (!facilities.has(id)) {
          facilities.set(id, {
            triId: id,
            facilityName: row.FACILITY_NAME || '',
            state: state,
            city: row.CITY_NAME || '',
            county: row.COUNTY_NAME || '',
            lat,
            lng,
            totalReleases: 0,
            carcinogenReleases: 0,
            chemicals: new Set<string>(),
            industryCode: row.NAICS_CODE || row.SIC_CODE || '',
          });
        }

        const fac = facilities.get(id)!;
        fac.totalReleases += release;
        if (isCarcinogen) fac.carcinogenReleases += release;
        if (chemical) fac.chemicals.add(chemical);
      }

      if (rows.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    } catch (err: any) {
      console.warn(`[TRI Cron] ${state} fetch error at offset ${offset}: ${err.message}`);
      break;
    }
  }

  return Array.from(facilities.values()).map(f => ({
    triId: f.triId,
    facilityName: f.facilityName,
    state: f.state,
    city: f.city,
    county: f.county,
    lat: f.lat,
    lng: f.lng,
    totalReleases: Math.round(f.totalReleases * 100) / 100,
    carcinogenReleases: Math.round(f.carcinogenReleases * 100) / 100,
    topChemicals: Array.from(f.chemicals).slice(0, 10),
    industryCode: f.industryCode,
    year: TRI_YEAR,
  }));
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isTriBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'TRI build already in progress',
      cache: getTriCacheStatus(),
    });
  }

  setTriBuildInProgress(true);
  const startTime = Date.now();

  try {
    const allFacilities: TriFacility[] = [];
    let failedStates = 0;

    // Process states with semaphore concurrency
    const queue = [...ALL_STATES];
    const inFlight: Promise<void>[] = [];

    async function processState(state: string) {
      try {
        const facilities = await fetchStateTRI(state);
        allFacilities.push(...facilities);
        if (facilities.length > 0) {
          console.log(`[TRI Cron] ${state}: ${facilities.length} facilities`);
        }
      } catch (err: any) {
        console.warn(`[TRI Cron] ${state} failed: ${err.message}`);
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
    const grid: Record<string, { facilities: TriFacility[] }> = {};
    for (const f of allFacilities) {
      const key = gridKey(f.lat, f.lng);
      if (!grid[key]) grid[key] = { facilities: [] };
      grid[key].facilities.push(f);
    }

    // Empty-data guard
    if (allFacilities.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[TRI Cron] 0 facilities in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        failedStates,
        cache: getTriCacheStatus(),
      });
    }

    await setTriCache({
      _meta: {
        built: new Date().toISOString(),
        facilityCount: allFacilities.length,
        gridCells: Object.keys(grid).length,
        year: TRI_YEAR,
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[TRI Cron] Complete in ${elapsed}s — ${allFacilities.length} facilities, ${Object.keys(grid).length} cells`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      facilityCount: allFacilities.length,
      gridCells: Object.keys(grid).length,
      failedStates,
      year: TRI_YEAR,
      cache: getTriCacheStatus(),
    });

  } catch (err: any) {
    console.error('[TRI Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'TRI build failed' },
      { status: 500 },
    );
  } finally {
    setTriBuildInProgress(false);
  }
}
