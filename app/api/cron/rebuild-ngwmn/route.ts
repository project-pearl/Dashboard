// app/api/cron/rebuild-ngwmn/route.ts
// Cron endpoint — fetches site catalogs from the USGS/CIDA NGWMN REST API
// (National Ground Water Monitoring Network) and builds a grid-indexed
// spatial cache with byState lookup.
// Schedule: daily via Vercel cron or manual trigger.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setNgwmnCache, getNgwmnCacheStatus,
  isNgwmnBuildInProgress, setNgwmnBuildInProgress,
  type NgwmnSite,
} from '@/lib/ngwmnCache';
import { gridKey } from '@/lib/cacheUtils';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// -- Config -------------------------------------------------------------------

const NGWMN_BASE = 'https://cida.usgs.gov/ngwmn';
const BATCH_SIZE = 4;
const DELAY_MS = 500;
const FETCH_TIMEOUT_MS = 30_000;

// -- Types --------------------------------------------------------------------

interface NgwmnProvider {
  id: string;
  name: string;
}

interface RawSite {
  agencyCd?: string;
  agency_cd?: string;
  siteNo?: string;
  site_no?: string;
  siteName?: string;
  site_name?: string;
  site_nm?: string;
  stateCd?: string;
  state_cd?: string;
  countyNm?: string;
  county_nm?: string;
  aquiferName?: string;
  aquifer_name?: string;
  wellDepthVa?: string | number | null;
  well_depth_va?: string | number | null;
  decLatVa?: string | number;
  dec_lat_va?: string | number;
  lat?: string | number;
  latitude?: string | number;
  decLongVa?: string | number;
  dec_long_va?: string | number;
  lng?: string | number;
  longitude?: string | number;
  [key: string]: any;
}

// -- US State codes for mapping FIPS back to abbreviation ---------------------

const FIPS_TO_STATE: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY',
};

// -- Helpers ------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Resolve a state code from potentially numeric FIPS or 2-letter abbreviation.
 */
function resolveState(raw: string | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // Already a 2-letter code
  if (/^[A-Z]{2}$/i.test(trimmed)) return trimmed.toUpperCase();
  // FIPS code
  const padded = trimmed.padStart(2, '0');
  return FIPS_TO_STATE[padded] || trimmed.toUpperCase();
}

/**
 * Fetch provider list from the NGWMN REST API.
 */
async function fetchProviders(): Promise<NgwmnProvider[]> {
  try {
    const res = await fetch(`${NGWMN_BASE}/provider/`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[NGWMN Cron] Providers fetch: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();

    // API might return an array of provider objects or an object with a list
    if (Array.isArray(data)) {
      return data.map((p: any) => ({
        id: p.id || p.providerId || p.agency_cd || '',
        name: p.name || p.providerName || p.agency_nm || '',
      })).filter((p: NgwmnProvider) => p.id);
    }

    if (data?.providers && Array.isArray(data.providers)) {
      return data.providers.map((p: any) => ({
        id: p.id || p.providerId || '',
        name: p.name || p.providerName || '',
      })).filter((p: NgwmnProvider) => p.id);
    }

    console.warn('[NGWMN Cron] Unexpected providers response shape');
    return [];
  } catch (e) {
    console.warn(`[NGWMN Cron] Providers fetch error: ${e instanceof Error ? e.message : e}`);
    return [];
  }
}

/**
 * Fetch all sites for a given provider.
 */
async function fetchProviderSites(providerId: string): Promise<NgwmnSite[]> {
  const sites: NgwmnSite[] = [];

  try {
    const res = await fetch(`${NGWMN_BASE}/provider/${providerId}/sites`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[NGWMN Cron] Provider ${providerId}: HTTP ${res.status}`);
      return sites;
    }

    const data = await res.json();
    const rawSites: RawSite[] = Array.isArray(data)
      ? data
      : (data?.sites || data?.features || []);

    for (const r of rawSites) {
      const latRaw = r.decLatVa ?? r.dec_lat_va ?? r.lat ?? r.latitude;
      const lngRaw = r.decLongVa ?? r.dec_long_va ?? r.lng ?? r.longitude;
      const lat = typeof latRaw === 'number' ? latRaw : parseFloat(String(latRaw));
      const lng = typeof lngRaw === 'number' ? lngRaw : parseFloat(String(lngRaw));

      if (isNaN(lat) || isNaN(lng) || lat === 0) continue;

      const agencyCd = r.agencyCd || r.agency_cd || providerId;
      const siteNo = r.siteNo || r.site_no || '';
      const siteName = r.siteName || r.site_name || r.site_nm || '';
      const stateCd = r.stateCd || r.state_cd || '';
      const county = r.countyNm || r.county_nm || '';
      const aquifer = r.aquiferName || r.aquifer_name || '';
      const depthRaw = r.wellDepthVa ?? r.well_depth_va;
      const wellDepth = depthRaw != null ? parseFloat(String(depthRaw)) : null;
      const state = resolveState(stateCd);

      sites.push({
        id: `${agencyCd}-${siteNo}`,
        agencyCd,
        siteNo,
        siteName,
        state,
        county,
        aquiferName: aquifer,
        wellDepth: wellDepth !== null && !isNaN(wellDepth) ? wellDepth : null,
        lat: Math.round(lat * 100000) / 100000,
        lng: Math.round(lng * 100000) / 100000,
        waterLevels: [],
        waterQuality: [],
      });
    }
  } catch (e) {
    console.warn(
      `[NGWMN Cron] Provider ${providerId} error: ${e instanceof Error ? e.message : e}`,
    );
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
    // Step 1: Fetch provider list
    console.log('[NGWMN Cron] Fetching provider list...');
    const providers = await fetchProviders();
    console.log(`[NGWMN Cron] Found ${providers.length} providers`);

    if (providers.length === 0) {
      // Fallback: use known USGS provider directly
      console.warn('[NGWMN Cron] No providers found, using fallback USGS provider');
      providers.push({ id: 'USGS', name: 'U.S. Geological Survey' });
    }

    // Step 2: Fetch sites for all providers in batches
    const grid: Record<string, NgwmnSite[]> = {};
    const byState: Record<string, NgwmnSite[]> = {};
    let totalSites = 0;
    const providerResults: string[] = [];
    const failedProviders: string[] = [];

    for (let i = 0; i < providers.length; i += BATCH_SIZE) {
      const batch = providers.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (provider) => {
          console.log(`[NGWMN Cron] Fetching sites for provider ${provider.id} (${provider.name})...`);
          const sites = await fetchProviderSites(provider.id);
          return { provider, sites };
        }),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled') {
          const { provider, sites } = result.value;
          if (sites.length > 0) {
            for (const site of sites) {
              // Grid index
              const key = gridKey(site.lat, site.lng);
              if (!grid[key]) grid[key] = [];
              grid[key].push(site);

              // byState index
              if (site.state) {
                const st = site.state.toUpperCase();
                if (!byState[st]) byState[st] = [];
                byState[st].push(site);
              }
            }

            totalSites += sites.length;
            providerResults.push(`${provider.id}:${sites.length}`);
            console.log(`[NGWMN Cron] ${provider.id}: ${sites.length} sites`);
          } else {
            providerResults.push(`${provider.id}:0`);
          }
        } else {
          const provider = batch[j];
          console.error(`[NGWMN Cron] ${provider.id} failed:`, result.reason);
          failedProviders.push(provider.id);
        }
      }

      // Delay between batches
      if (i + BATCH_SIZE < providers.length) {
        await delay(DELAY_MS);
      }
    }

    // Retry failed providers once
    if (failedProviders.length > 0) {
      console.log(`[NGWMN Cron] Retrying ${failedProviders.length} failed providers...`);
      await delay(5000);

      for (const providerId of failedProviders) {
        try {
          const sites = await fetchProviderSites(providerId);
          if (sites.length > 0) {
            for (const site of sites) {
              const key = gridKey(site.lat, site.lng);
              if (!grid[key]) grid[key] = [];
              grid[key].push(site);

              if (site.state) {
                const st = site.state.toUpperCase();
                if (!byState[st]) byState[st] = [];
                byState[st].push(site);
              }
            }

            totalSites += sites.length;
            console.log(`[NGWMN Cron] ${providerId} retry succeeded: ${sites.length} sites`);
          }
        } catch (e) {
          console.error(`[NGWMN Cron] ${providerId} retry failed:`, e);
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
        stateCount: Object.keys(byState).length,
        providerCount: providers.length,
        qualityResultCount: 0, // Initial catalog — water quality fetched separately
      },
      grid,
      byState,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[NGWMN Cron] Build complete in ${elapsed}s — ` +
      `${totalSites} sites, ${Object.keys(byState).length} states, ` +
      `${providers.length} providers, ${Object.keys(grid).length} cells`,
    );

    recordCronRun('rebuild-ngwmn', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      siteCount: totalSites,
      stateCount: Object.keys(byState).length,
      providerCount: providers.length,
      gridCells: Object.keys(grid).length,
      qualityResultCount: 0,
      providerBreakdown: providerResults,
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
