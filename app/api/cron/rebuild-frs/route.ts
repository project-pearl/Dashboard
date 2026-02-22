// app/api/cron/rebuild-frs/route.ts
// Cron endpoint — fetches EPA FRS facility data (FRS_FACILITY_SITE table
// for coordinates) for priority states, deduplicates, and populates the
// in-memory spatial cache for instant lookups.
// Schedule: daily via Vercel cron (10 AM UTC) or manual trigger.

import { NextRequest, NextResponse } from 'next/server';
import {
  setFrsCache, getFrsCacheStatus,
  isFrsBuildInProgress, setFrsBuildInProgress,
  gridKey,
  type FrsFacility,
} from '@/lib/frsCache';

// ── Config ───────────────────────────────────────────────────────────────────

const EF_BASE = 'https://data.epa.gov/efservice';
const STATE_DELAY_MS = 2000;
const PAGE_SIZE = 5000;

import { PRIORITY_STATES } from '@/lib/constants';

// ── Paginated fetch helper ──────────────────────────────────────────────────

async function fetchTable<T>(
  table: string,
  stateFilter: string,
  stateAbbr: string,
  transform: (row: Record<string, any>) => T | null,
): Promise<T[]> {
  const results: T[] = [];
  let offset = 0;

  while (true) {
    const url = `${EF_BASE}/${table}/${stateFilter}/${stateAbbr}/ROWS/${offset}:${offset + PAGE_SIZE - 1}/JSON`;
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        console.warn(`[FRS Cron] ${table} ${stateAbbr}: HTTP ${res.status}`);
        break;
      }

      const text = await res.text();
      if (!text || text.trim() === '' || text.trim() === '[]') break;

      let data: any[];
      try {
        data = JSON.parse(text);
      } catch {
        break;
      }

      if (!Array.isArray(data) || data.length === 0) break;

      for (const row of data) {
        const item = transform(row);
        if (item !== null) results.push(item);
      }

      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    } catch (e) {
      console.warn(`[FRS Cron] ${table} ${stateAbbr} page ${offset}: ${e instanceof Error ? e.message : e}`);
      break;
    }
  }

  return results;
}

// ── Row transform ────────────────────────────────────────────────────────────

function transformFacility(row: Record<string, any>): FrsFacility | null {
  const lat = parseFloat(row.LATITUDE83 || row.LATITUDE_MEASURE || '');
  const lng = parseFloat(row.LONGITUDE83 || row.LONGITUDE_MEASURE || '');
  if (isNaN(lat) || isNaN(lng) || lat <= 0) return null;

  return {
    registryId: row.REGISTRY_ID || '',
    name: row.PRIMARY_NAME || row.SITE_NAME || '',
    state: row.STATE_CODE || row.STATE_ABBR || '',
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000,
    pgmSysId: row.PGM_SYS_ID || row.FEDERAL_FACILITY_CODE || '',
    postalCode: row.POSTAL_CODE || row.ZIP_CODE || '',
    county: row.COUNTY_NAME || '',
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isFrsBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'FRS build already in progress',
      cache: getFrsCacheStatus(),
    });
  }

  setFrsBuildInProgress(true);
  const startTime = Date.now();
  const stateResults: Record<string, Record<string, number>> = {};

  try {
    const allFacilities: FrsFacility[] = [];
    const processedStates: string[] = [];

    for (const stateAbbr of PRIORITY_STATES) {
      try {
        console.log(`[FRS Cron] Fetching ${stateAbbr}...`);

        // Use FRS_FACILITY_SITE which has LATITUDE83/LONGITUDE83
        const facilities = await fetchTable(
          'FRS_FACILITY_SITE', 'STATE_CODE', stateAbbr, transformFacility,
        );

        // Deduplicate facilities by registryId
        const facMap = new Map<string, FrsFacility>();
        for (const f of facilities) {
          if (!facMap.has(f.registryId)) facMap.set(f.registryId, f);
        }
        const dedupedFacilities = Array.from(facMap.values());

        allFacilities.push(...dedupedFacilities);
        processedStates.push(stateAbbr);

        stateResults[stateAbbr] = {
          facilities: dedupedFacilities.length,
        };

        console.log(`[FRS Cron] ${stateAbbr}: ${dedupedFacilities.length} facilities`);
      } catch (e) {
        console.warn(`[FRS Cron] ${stateAbbr} failed:`, e instanceof Error ? e.message : e);
        stateResults[stateAbbr] = { facilities: 0 };
      }

      // Rate limit delay between states
      await delay(STATE_DELAY_MS);
    }

    // ── Retry failed states ───────────────────────────────────────────────
    const failedStates = PRIORITY_STATES.filter(s => !processedStates.includes(s));
    if (failedStates.length > 0) {
      console.log(`[FRS Cron] Retrying ${failedStates.length} failed states...`);
      for (const stateAbbr of failedStates) {
        await delay(5000);
        try {
          const facilities = await fetchTable('FRS_FACILITY_SITE', 'STATE_CODE', stateAbbr, transformFacility);
          const facMap = new Map<string, FrsFacility>();
          for (const f of facilities) if (!facMap.has(f.registryId)) facMap.set(f.registryId, f);
          allFacilities.push(...facMap.values());
          processedStates.push(stateAbbr);
          stateResults[stateAbbr] = { facilities: facMap.size };
          console.log(`[FRS Cron] ${stateAbbr}: RETRY OK`);
        } catch (e) {
          console.warn(`[FRS Cron] ${stateAbbr}: RETRY FAILED — ${e instanceof Error ? e.message : e}`);
        }
      }
    }

    // ── Build Grid Index ───────────────────────────────────────────────────
    const grid: Record<string, { facilities: FrsFacility[] }> = {};

    for (const f of allFacilities) {
      const key = gridKey(f.lat, f.lng);
      if (!grid[key]) grid[key] = { facilities: [] };
      grid[key].facilities.push(f);
    }

    // ── Store in memory ────────────────────────────────────────────────────
    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        facilityCount: allFacilities.length,
        statesProcessed: processedStates,
        gridCells: Object.keys(grid).length,
      },
      grid,
    };

    setFrsCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[FRS Cron] Build complete in ${elapsed}s — ` +
      `${allFacilities.length} facilities, ${Object.keys(grid).length} cells`
    );

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      facilities: allFacilities.length,
      gridCells: Object.keys(grid).length,
      statesProcessed: processedStates.length,
      states: stateResults,
      cache: getFrsCacheStatus(),
    });

  } catch (err: any) {
    console.error('[FRS Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'FRS build failed' },
      { status: 500 },
    );
  } finally {
    setFrsBuildInProgress(false);
  }
}
