// app/api/cron/rebuild-usgs-ogc/route.ts
// Cron endpoint — fetches USGS monitoring locations from the OGC API v0
// and builds a grid-indexed spatial cache with byState lookup.
// Schedule: daily via Vercel cron or manual trigger.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setUsgsOgcCache, getUsgsOgcCacheStatus,
  isUsgsOgcBuildInProgress, setUsgsOgcBuildInProgress,
  type UsgsOgcStation,
} from '@/lib/usgsOgcCache';
import { ALL_STATES_WITH_FIPS } from '@/lib/constants';
import { gridKey } from '@/lib/cacheUtils';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// -- Config -------------------------------------------------------------------

const OGC_MONITORING_URL = 'https://api.waterdata.usgs.gov/ogcapi/v0/collections/monitoring-locations/items';
const BATCH_SIZE = 8;
const DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 30_000;

// -- Helpers ------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Fetch all monitoring locations for a state FIPS code.
 * The OGC API supports `stateFIPS` as a query parameter and returns GeoJSON.
 * Handles pagination via `next` links.
 */
async function fetchStateStations(state: string, fips: string): Promise<UsgsOgcStation[]> {
  const stations: UsgsOgcStation[] = [];
  let url: string | null =
    `${OGC_MONITORING_URL}?stateFIPS=${fips}&limit=10000&f=json`;

  const MAX_PAGES = 20;
  let page = 0;

  while (url && page < MAX_PAGES) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/geo+json',
          'User-Agent': 'PEARL-Platform/1.0',
          ...(process.env.USGS_WATERDATA_API_KEY
            ? { 'X-Api-Key': process.env.USGS_WATERDATA_API_KEY }
            : {}),
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (res.status === 429) {
        console.warn(`[USGS OGC Cron] ${state} rate-limited, waiting 3s...`);
        await delay(3000);
        continue;
      }

      if (!res.ok) {
        console.warn(`[USGS OGC Cron] ${state} page ${page}: HTTP ${res.status}`);
        break;
      }

      const data = await res.json();
      const features: any[] = data?.features || [];
      if (features.length === 0) break;

      for (const feature of features) {
        const props = feature.properties || {};
        const coords = feature.geometry?.coordinates;
        if (!coords || coords.length < 2) continue;

        const lng = coords[0];
        const lat = coords[1];
        if (isNaN(lat) || isNaN(lng) || lat === 0) continue;

        const monId = props.monitoring_location_id || props.id || '';
        const id = monId.replace(/^USGS-/, '');
        if (!id) continue;

        stations.push({
          id,
          name: props.monitoring_location_name || props.station_nm || '',
          state: props.state_code || props.monitoring_location_state_code || state,
          county: props.county_name || props.county_nm || '',
          huc8: props.hydrologic_unit_code || props.huc_cd || '',
          siteType: props.site_type_description || props.site_tp_ln || props.site_type_code || '',
          lat: Math.round(lat * 100000) / 100000,
          lng: Math.round(lng * 100000) / 100000,
          agencyCode: props.agency_code || props.agency_cd || 'USGS',
          parameters: [],
          hasRealtimeData: !!props.real_time_data,
          latestObservation: null,
        });
      }

      // Follow pagination via `next` link
      const nextLink = (data.links || []).find((l: any) => l.rel === 'next');
      url = nextLink?.href ?? null;
      page++;
    } catch (e) {
      console.warn(
        `[USGS OGC Cron] ${state} page ${page}: ${e instanceof Error ? e.message : e}`,
      );
      break;
    }
  }

  return stations;
}

// -- GET Handler --------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isUsgsOgcBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'USGS OGC build already in progress',
      cache: getUsgsOgcCacheStatus(),
    });
  }

  setUsgsOgcBuildInProgress(true);
  const startTime = Date.now();

  try {
    const grid: Record<string, { stations: UsgsOgcStation[] }> = {};
    const stateIndex: Record<string, UsgsOgcStation[]> = {};
    let totalStations = 0;
    const allSiteTypes = new Set<string>();
    const allAgencies = new Set<string>();
    const stateResults: string[] = [];
    const failedStates: string[] = [];

    // Fetch states in parallel batches
    for (let i = 0; i < ALL_STATES_WITH_FIPS.length; i += BATCH_SIZE) {
      const batch = ALL_STATES_WITH_FIPS.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async ([state, fips]) => {
          console.log(`[USGS OGC Cron] Fetching ${state} (FIPS ${fips})...`);
          const stations = await fetchStateStations(state, fips);
          return { state, stations };
        }),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled') {
          const { state, stations } = result.value;
          if (stations.length > 0) {
            stateIndex[state] = stations;

            for (const s of stations) {
              const key = gridKey(s.lat, s.lng);
              if (!grid[key]) grid[key] = { stations: [] };
              grid[key].stations.push(s);

              if (s.siteType) allSiteTypes.add(s.siteType);
              if (s.agencyCode) allAgencies.add(s.agencyCode);
            }

            totalStations += stations.length;
            stateResults.push(`${state}:${stations.length}`);
            console.log(`[USGS OGC Cron] ${state}: ${stations.length} stations`);
          } else {
            stateResults.push(`${state}:0`);
          }
        } else {
          const [state] = batch[j];
          console.error(`[USGS OGC Cron] ${state} failed:`, result.reason);
          failedStates.push(state);
        }
      }

      // Delay between batches
      if (i + BATCH_SIZE < ALL_STATES_WITH_FIPS.length) {
        await delay(DELAY_MS);
      }
    }

    // Retry failed states once with longer timeout
    if (failedStates.length > 0) {
      console.log(`[USGS OGC Cron] Retrying ${failedStates.length} failed states...`);
      await delay(5000);

      for (const state of failedStates) {
        const fipsTuple = ALL_STATES_WITH_FIPS.find(([s]) => s === state);
        if (!fipsTuple) continue;
        const [, fips] = fipsTuple;

        try {
          const stations = await fetchStateStations(state, fips);
          if (stations.length > 0) {
            stateIndex[state] = stations;

            for (const s of stations) {
              const key = gridKey(s.lat, s.lng);
              if (!grid[key]) grid[key] = { stations: [] };
              grid[key].stations.push(s);

              if (s.siteType) allSiteTypes.add(s.siteType);
              if (s.agencyCode) allAgencies.add(s.agencyCode);
            }

            totalStations += stations.length;
            console.log(`[USGS OGC Cron] ${state} retry succeeded: ${stations.length} stations`);
          }
        } catch (e) {
          console.error(`[USGS OGC Cron] ${state} retry failed:`, e);
        }
        await delay(1000);
      }
    }

    // Empty-data guard
    if (totalStations === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[USGS OGC Cron] 0 stations in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getUsgsOgcCacheStatus(),
      });
    }

    // Save cache
    await setUsgsOgcCache({
      _meta: {
        built: new Date().toISOString(),
        stationCount: totalStations,
        statesCovered: Object.keys(stateIndex).length,
        gridCells: Object.keys(grid).length,
      },
      grid,
      stateIndex,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[USGS OGC Cron] Build complete in ${elapsed}s — ` +
      `${totalStations} stations, ${Object.keys(stateIndex).length} states, ` +
      `${Object.keys(grid).length} cells`,
    );

    recordCronRun('rebuild-usgs-ogc', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      stationCount: totalStations,
      statesCovered: Object.keys(stateIndex).length,
      gridCells: Object.keys(grid).length,
      stateBreakdown: stateResults,
      cache: getUsgsOgcCacheStatus(),
    });

  } catch (err: any) {
    console.error('[USGS OGC Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-usgs-ogc' } });

    notifySlackCronFailure({
      cronName: 'rebuild-usgs-ogc',
      error: err.message || 'build failed',
      duration: Date.now() - startTime,
    });

    recordCronRun('rebuild-usgs-ogc', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'USGS OGC build failed' },
      { status: 500 },
    );
  } finally {
    setUsgsOgcBuildInProgress(false);
  }
}
