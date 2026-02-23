// app/api/cron/rebuild-usace/route.ts
// Cron endpoint — fetches USACE (Army Corps of Engineers) reservoir/dam locations
// and recent water temperature data from CWMS Data API.
// Schedule: daily via Vercel cron (4 PM UTC) or manual trigger.

export const maxDuration = 120;

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

// USACE offices that cover priority states
const PRIORITY_OFFICES = [
  'NAB', // Baltimore (MD, VA, DC, PA, DE)
  'NAE', // New England (MA)
  'NAN', // New York (NY, NJ)
  'NAP', // Philadelphia (PA, NJ, DE)
  'SAJ', // Jacksonville (FL)
  'SAW', // Wilmington (NC)
  'SAS', // Savannah (GA)
  'LRB', // Buffalo (OH, NY)
  'LRC', // Chicago (IL, MI)
  'LRE', // Detroit (MI, OH)
  'SWF', // Fort Worth (TX)
  'SPL', // Los Angeles (CA)
  'SPK', // Sacramento (CA)
  'NWP', // Portland (OR, WA)
  'NWS', // Seattle (WA)
  'LRH', // Huntington (WV, OH)
  'LRP', // Pittsburgh (PA, WV)
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
    for (let i = 0; i < PRIORITY_OFFICES.length; i += 3) {
      const batch = PRIORITY_OFFICES.slice(i, i + 3);

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

      if (i + 3 < PRIORITY_OFFICES.length) await delay(DELAY_MS);
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
