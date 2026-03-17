// app/api/cron/rebuild-ngwmn/route.ts
// Cron endpoint — fetches groundwater monitoring sites from the USGS Water
// Services API (replacing the retired cida.usgs.gov/ngwmn REST API) and
// builds a grid-indexed spatial cache with byState lookup.
// Schedule: daily via Vercel cron or manual trigger.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setNgwmnCache, getNgwmnCacheStatus,
  isNgwmnBuildInProgress, setNgwmnBuildInProgress,
  type NgwmnSite,
} from '@/lib/ngwmnCache';
import { ALL_STATES } from '@/lib/constants';
import { gridKey } from '@/lib/cacheUtils';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// -- Config -------------------------------------------------------------------

const NWIS_SITE_URL = 'https://waterservices.usgs.gov/nwis/site/';
const BATCH_SIZE = 4;
const DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 45_000;

// -- Helpers ------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Parse USGS RDB (tab-delimited) response into an array of row objects.
 * RDB format: comment lines start with #, first non-comment line is headers,
 * second non-comment line is column widths (e.g. "5s\t15s"), then data rows.
 */
function parseRdb(text: string): Record<string, string>[] {
  const lines = text.split('\n');
  const dataLines: string[] = [];

  for (const line of lines) {
    // Skip comment lines and empty lines
    if (line.startsWith('#') || line.trim() === '') continue;
    dataLines.push(line);
  }

  if (dataLines.length < 3) return []; // Need header + type line + at least one data row

  const headers = dataLines[0].split('\t');
  // dataLines[1] is the column-width descriptor line (e.g. "5s\t15s\t...")
  const rows: Record<string, string>[] = [];

  for (let i = 2; i < dataLines.length; i++) {
    const values = dataLines[i].split('\t');
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Fetch all active groundwater monitoring sites for a state from USGS Water Services.
 * Uses the expanded site output RDB format.
 */
async function fetchStateSites(state: string): Promise<NgwmnSite[]> {
  const sites: NgwmnSite[] = [];

  try {
    const params = new URLSearchParams({
      stateCd: state,
      siteType: 'GW',
      siteStatus: 'active',
      hasDataTypeCd: 'gw',
      format: 'rdb',
      siteOutput: 'expanded',
    });

    const res = await fetch(`${NWIS_SITE_URL}?${params}`, {
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status === 429) {
      console.warn(`[NGWMN Cron] ${state} rate-limited, waiting 5s...`);
      await delay(5000);
      // Retry once
      const retry = await fetch(`${NWIS_SITE_URL}?${params}`, {
        headers: { 'User-Agent': 'PEARL-Platform/1.0' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!retry.ok) return sites;
      const text = await retry.text();
      return parseSiteRows(text, state);
    }

    if (!res.ok) {
      console.warn(`[NGWMN Cron] ${state}: HTTP ${res.status}`);
      return sites;
    }

    const text = await res.text();
    return parseSiteRows(text, state);
  } catch (e) {
    console.warn(
      `[NGWMN Cron] ${state} error: ${e instanceof Error ? e.message : e}`,
    );
    return sites;
  }
}

/** Parse RDB text into NgwmnSite[] */
function parseSiteRows(text: string, fallbackState: string): NgwmnSite[] {
  const rows = parseRdb(text);
  const sites: NgwmnSite[] = [];

  for (const r of rows) {
    const lat = parseFloat(r.dec_lat_va);
    const lng = parseFloat(r.dec_long_va);
    if (isNaN(lat) || isNaN(lng) || lat === 0) continue;

    const agencyCd = r.agency_cd || 'USGS';
    const siteNo = r.site_no || '';
    if (!siteNo) continue;

    const wellDepthRaw = r.well_depth_va ? parseFloat(r.well_depth_va) : null;

    sites.push({
      id: `${agencyCd}-${siteNo}`,
      agencyCd,
      siteNo,
      siteName: (r.station_nm || '').trim(),
      state: fallbackState,
      county: '', // RDB gives county_cd (FIPS), not name
      aquiferName: r.aqfr_cd || r.nat_aqfr_cd || '',
      wellDepth: wellDepthRaw !== null && !isNaN(wellDepthRaw) ? wellDepthRaw : null,
      lat: Math.round(lat * 100000) / 100000,
      lng: Math.round(lng * 100000) / 100000,
      waterLevels: [],
      waterQuality: [],
    });
  }

  return sites;
}

// -- GET Handler --------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isNgwmnBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'NGWMN build already in progress',
      cache: getNgwmnCacheStatus(),
    });
  }

  setNgwmnBuildInProgress(true);
  const startTime = Date.now();

  try {
    console.log('[NGWMN Cron] Fetching groundwater sites via USGS Water Services...');

    const grid: Record<string, { sites: NgwmnSite[] }> = {};
    const stateIndex: Record<string, NgwmnSite[]> = {};
    let totalSites = 0;
    const stateResults: string[] = [];
    const failedStates: string[] = [];

    // Fetch states in parallel batches
    for (let i = 0; i < ALL_STATES.length; i += BATCH_SIZE) {
      const batch = ALL_STATES.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (state) => {
          console.log(`[NGWMN Cron] Fetching ${state}...`);
          const sites = await fetchStateSites(state);
          return { state, sites };
        }),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled') {
          const { state, sites } = result.value;
          if (sites.length > 0) {
            stateIndex[state] = sites;

            for (const site of sites) {
              const key = gridKey(site.lat, site.lng);
              if (!grid[key]) grid[key] = { sites: [] };
              grid[key].sites.push(site);
            }

            totalSites += sites.length;
            stateResults.push(`${state}:${sites.length}`);
            console.log(`[NGWMN Cron] ${state}: ${sites.length} sites`);
          } else {
            stateResults.push(`${state}:0`);
          }
        } else {
          const state = batch[j];
          console.error(`[NGWMN Cron] ${state} failed:`, result.reason);
          failedStates.push(state);
        }
      }

      // Delay between batches
      if (i + BATCH_SIZE < ALL_STATES.length) {
        await delay(DELAY_MS);
      }
    }

    // Retry failed states once with longer timeout
    if (failedStates.length > 0) {
      console.log(`[NGWMN Cron] Retrying ${failedStates.length} failed states...`);
      await delay(5000);

      for (const state of failedStates) {
        try {
          const sites = await fetchStateSites(state);
          if (sites.length > 0) {
            stateIndex[state] = sites;

            for (const site of sites) {
              const key = gridKey(site.lat, site.lng);
              if (!grid[key]) grid[key] = { sites: [] };
              grid[key].sites.push(site);
            }

            totalSites += sites.length;
            console.log(`[NGWMN Cron] ${state} retry succeeded: ${sites.length} sites`);
          }
        } catch (e) {
          console.error(`[NGWMN Cron] ${state} retry failed:`, e);
        }
        await delay(1000);
      }
    }

    // Empty-data guard
    if (totalSites === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[NGWMN Cron] 0 sites in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getNgwmnCacheStatus(),
      });
    }

    // Save cache
    await setNgwmnCache({
      _meta: {
        built: new Date().toISOString(),
        siteCount: totalSites,
        providerCount: 1, // Single source: USGS Water Services
        gridCells: Object.keys(grid).length,
      },
      grid,
      stateIndex,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[NGWMN Cron] Build complete in ${elapsed}s — ` +
      `${totalSites} sites, ${Object.keys(stateIndex).length} states, ` +
      `${Object.keys(grid).length} cells`,
    );

    recordCronRun('rebuild-ngwmn', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      siteCount: totalSites,
      stateCount: Object.keys(stateIndex).length,
      gridCells: Object.keys(grid).length,
      stateBreakdown: stateResults,
      cache: getNgwmnCacheStatus(),
    });

  } catch (err: any) {
    console.error('[NGWMN Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-ngwmn' } });

    notifySlackCronFailure({
      cronName: 'rebuild-ngwmn',
      error: err.message || 'build failed',
      duration: Date.now() - startTime,
    });

    recordCronRun('rebuild-ngwmn', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'NGWMN build failed' },
      { status: 500 },
    );
  } finally {
    setNgwmnBuildInProgress(false);
  }
}
