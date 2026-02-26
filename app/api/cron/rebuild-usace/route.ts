// app/api/cron/rebuild-usace/route.ts
// Cron endpoint — fetches USACE (Army Corps of Engineers) reservoir/dam locations
// and recent water temperature data from CWMS Data API for all 38 district offices.
// Schedule: daily via Vercel cron (4 PM UTC) or manual trigger.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setUsaceCache, getUsaceCacheStatus,
  isUsaceBuildInProgress, setUsaceBuildInProgress,
  gridKey,
  type UsaceLocation,
} from '@/lib/usaceCache';

// ── Config ───────────────────────────────────────────────────────────────────

const CWMS_BASE = 'https://cwms-data.usace.army.mil/cwms-data';
const FETCH_TIMEOUT_MS = 30_000;
const DELAY_MS = 500;

// All USACE district offices (~38 districts across 8 divisions)
const ALL_OFFICES = [
  // Great Lakes and Ohio River Division (LRD)
  'LRB', // Buffalo (NY, OH)
  'LRC', // Chicago (IL, IN, MI)
  'LRE', // Detroit (MI, OH)
  'LRH', // Huntington (WV, OH, KY)
  'LRL', // Louisville (KY, IN)
  'LRN', // Nashville (TN, KY)
  'LRP', // Pittsburgh (PA, WV)
  // Mississippi Valley Division (MVD)
  'MVK', // Vicksburg (MS, LA, AR)
  'MVM', // Memphis (TN, MS, AR)
  'MVN', // New Orleans (LA)
  'MVP', // St. Paul (MN, WI)
  'MVR', // Rock Island (IA, IL, MO)
  'MVS', // St. Louis (MO, IL)
  // North Atlantic Division (NAD)
  'NAB', // Baltimore (MD, VA, DC, DE)
  'NAE', // New England (MA, CT, NH, VT, ME, RI)
  'NAN', // New York (NY, NJ)
  'NAO', // Norfolk (VA)
  'NAP', // Philadelphia (PA, NJ, DE)
  // Northwestern Division (NWD)
  'NWK', // Kansas City (KS, MO)
  'NWO', // Omaha (NE, SD, ND, MT, CO, WY)
  'NWP', // Portland (OR, WA, ID)
  'NWS', // Seattle (WA)
  'NWW', // Walla Walla (WA, OR, ID)
  // Pacific Ocean Division (POD)
  'POA', // Alaska (AK)
  'POH', // Honolulu (HI)
  // South Atlantic Division (SAD)
  'SAC', // Charleston (SC)
  'SAJ', // Jacksonville (FL)
  'SAM', // Mobile (AL, MS, FL)
  'SAS', // Savannah (GA)
  'SAW', // Wilmington (NC)
  // South Pacific Division (SPD)
  'SPA', // Albuquerque (NM, AZ, CO)
  'SPK', // Sacramento (CA, NV, UT)
  'SPL', // Los Angeles (CA, AZ)
  // Southwestern Division (SWD)
  'SWF', // Fort Worth (TX, OK)
  'SWG', // Galveston (TX)
  'SWL', // Little Rock (AR, MO)
  'SWT', // Tulsa (OK, KS, TX)
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function cwmsFetch<T = any>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${CWMS_BASE}${path}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PEARL-Platform/1.0',
      },
    });
    if (!res.ok) {
      console.warn(`[USACE Cron] ${path}: HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(`[USACE Cron] ${path}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isUsaceBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'USACE build already in progress',
      cache: getUsaceCacheStatus(),
    });
  }

  setUsaceBuildInProgress(true);
  const startTime = Date.now();

  try {
    const allLocations: UsaceLocation[] = [];
    let withTemp = 0;
    let officesQueried = 0;

    // Fetch timeseries catalog for water temp across offices
    for (let i = 0; i < ALL_OFFICES.length; i += 6) {
      const batch = ALL_OFFICES.slice(i, i + 6);

      const results = await Promise.allSettled(
        batch.map(async (office) => {
          // Search for water temperature timeseries in this office
          const catalog = await cwmsFetch<any>(
            `/catalog/TIMESERIES?office=${office}&like=*Temp-Water*&page-size=500`
          );

          if (!catalog?.entries?.length) return { office, locations: [] as UsaceLocation[] };

          // Extract unique location names from timeseries catalog
          const locationNames = new Set<string>();
          for (const entry of catalog.entries) {
            const name = entry.name?.split('.')[0]; // "JPLT2.Temp-Water..." → "JPLT2"
            if (name) locationNames.add(name);
          }

          // Fetch location details individually (batch endpoint unreliable)
          const locations: UsaceLocation[] = [];
          const nameArray = [...locationNames].slice(0, 50); // Cap per office

          for (const locName of nameArray) {
            const loc = await cwmsFetch<any>(
              `/locations/${encodeURIComponent(locName)}?office=${office}`
            );

            if (loc) {
              const lat = loc.latitude;
              const lng = loc.longitude;
              if (lat && lng) {
                locations.push({
                  name: loc.name || locName,
                  office,
                  lat,
                  lng,
                  type: loc['location-kind'] || loc['location-type'] || '',
                  nearestCity: loc['nearest-city'] || '',
                  state: loc['state-initial'] || '',
                  waterTemp: null,
                  waterTempTime: null,
                  poolLevel: null,
                  poolLevelTime: null,
                });
              }
            }

            await delay(100);
          }

          return { office, locations };
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.locations.length > 0) {
          allLocations.push(...r.value.locations);
          officesQueried++;
          console.log(`[USACE Cron] ${r.value.office}: ${r.value.locations.length} locations`);
        }
      }

      if (i + 6 < ALL_OFFICES.length) await delay(DELAY_MS);
    }

    // Fetch recent water temp for locations (batch by office)
    const locationsByOffice = new Map<string, UsaceLocation[]>();
    for (const loc of allLocations) {
      const group = locationsByOffice.get(loc.office) || [];
      group.push(loc);
      locationsByOffice.set(loc.office, group);
    }

    for (const [office, locs] of locationsByOffice) {
      // Get recent timeseries for a sample of locations (limit to 20 per office)
      const sample = locs.slice(0, 20);
      for (const loc of sample) {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const tsName = `${loc.name}.Temp-Water.Inst.1Hour.0.Rev`;

        const tsData = await cwmsFetch<any>(
          `/timeseries/recent/${encodeURIComponent(tsName)}?office=${office}&unit=C`
        );

        if (tsData?.values?.length > 0) {
          const latest = tsData.values[tsData.values.length - 1];
          if (Array.isArray(latest) && latest.length >= 2 && latest[1] != null) {
            loc.waterTemp = Math.round(latest[1] * 10) / 10;
            loc.waterTempTime = new Date(latest[0]).toISOString();
            withTemp++;
          }
        }

        await delay(200);
      }
    }

    console.log(`[USACE Cron] Total: ${allLocations.length} locations, ${withTemp} with water temp`);

    // Build grid index
    const grid: Record<string, { locations: UsaceLocation[] }> = {};
    for (const loc of allLocations) {
      const key = gridKey(loc.lat, loc.lng);
      if (!grid[key]) grid[key] = { locations: [] };
      grid[key].locations.push(loc);
    }

    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        locationCount: allLocations.length,
        officesQueried,
        withWaterTemp: withTemp,
        gridCells: Object.keys(grid).length,
      },
      grid,
    };

    if (allLocations.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[USACE Cron] 0 locations in ${elapsed}s — skipping cache save`);
      return NextResponse.json({ status: 'empty', duration: `${elapsed}s`, cache: getUsaceCacheStatus() });
    }

    await setUsaceCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[USACE Cron] Built in ${elapsed}s — ${allLocations.length} locations, ${Object.keys(grid).length} cells`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      locations: allLocations.length,
      withWaterTemp: withTemp,
      offices: officesQueried,
      gridCells: Object.keys(grid).length,
      cache: getUsaceCacheStatus(),
    });

  } catch (err: any) {
    console.error('[USACE Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'USACE build failed' },
      { status: 500 },
    );
  } finally {
    setUsaceBuildInProgress(false);
  }
}
