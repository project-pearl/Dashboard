// app/api/cron/rebuild-usda-cdc-batch/route.ts
// Batch cron -- rebuilds 4 USDA/CDC caches in one invocation:
//   1. SSURGO (USDA Web Soil Survey soil properties)
//   2. NASS Livestock (USDA NASS cattle/CAFO inventory)
//   3. NASS Crops (USDA NASS crop acreage + planting)
//   4. CDC PLACES (census tract-level health prevalence)
//
// Replaces 4 individual cron routes to conserve Vercel cron slots:
//   rebuild-ssurgo, rebuild-nass-livestock, rebuild-nass-crops, rebuild-cdc-places
//
// Schedule: weekly Sunday 7:30 PM UTC

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';
import { gridKey } from '@/lib/cacheUtils';
import { PRIORITY_STATES } from '@/lib/constants';

// SSURGO imports
import {
  setSsurgoCache,
  isSsurgoBuildInProgress,
  setSsurgoBuildInProgress,
  getSsurgoCacheStatus,
} from '@/lib/ssurgoCache';

// NASS Livestock imports
import {
  setNassLivestockCache,
  isNassLivestockBuildInProgress,
  setNassLivestockBuildInProgress,
  getNassLivestockCacheStatus,
} from '@/lib/nassLivestockCache';

// NASS Crops imports
import {
  setNassCropsCache,
  isNassCropsBuildInProgress,
  setNassCropsBuildInProgress,
  getNassCropsCacheStatus,
} from '@/lib/nassCropsCache';

// CDC PLACES imports
import {
  setCdcPlacesCache,
  isCdcPlacesBuildInProgress,
  setCdcPlacesBuildInProgress,
  getCdcPlacesCacheStatus,
} from '@/lib/cdcPlacesCache';

// ── Types ───────────────────────────────────────────────────────────────────

interface SubCronResult {
  name: string;
  status: 'success' | 'skipped' | 'empty' | 'error';
  durationMs: number;
  recordCount?: number;
  error?: string;
}

// ── State FIPS mapping for SSURGO queries ───────────────────────────────────

const STATE_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17',
  IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24',
  MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31',
  NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38',
  OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46',
  TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54',
  WI: '55', WY: '56',
};

// ── Sub-cron builders ───────────────────────────────────────────────────────

async function buildSsurgo(): Promise<SubCronResult> {
  const start = Date.now();

  if (isSsurgoBuildInProgress()) {
    return { name: 'ssurgo', status: 'skipped', durationMs: Date.now() - start };
  }

  setSsurgoBuildInProgress(true);
  try {
    const byState: Record<string, any[]> = {};
    const grid: Record<string, any[]> = {};
    let totalUnits = 0;

    for (const state of PRIORITY_STATES) {
      const fips = STATE_FIPS[state];
      if (!fips) continue;

      try {
        const query = `SELECT TOP 500 mu.mukey, mu.muname, mu.mukind,
          c.drclassdcd, c.hydgrpdcd, c.kffact, c.permzonegr, c.awc_r, c.flodfreqdcd,
          mu.lkey
          FROM mapunit mu
          INNER JOIN component c ON mu.mukey = c.mukey
          WHERE mu.lkey IN (
            SELECT lkey FROM legend WHERE areasymbol LIKE '${state}%'
          )
          AND c.comppct_r >= 50`;

        const res = await fetch('https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, format: 'JSON' }),
          signal: AbortSignal.timeout(30_000),
        });

        if (!res.ok) continue;
        const data = await res.json();
        const table = data?.Table || [];

        const stateUnits: any[] = [];
        for (const row of table) {
          // SSURGO returns arrays per row
          const values = Array.isArray(row) ? row : Object.values(row);
          const unit = {
            mukey: String(values[0] || ''),
            muname: String(values[1] || ''),
            state,
            county: '',
            drainageClass: String(values[3] || ''),
            hydrologicGroup: String(values[4] || ''),
            kFactor: parseFloat(String(values[5] || '0')) || null,
            permeabilityInHr: parseFloat(String(values[6] || '0')) || null,
            awcInch: parseFloat(String(values[7] || '0')) || null,
            floodFrequency: String(values[8] || 'None'),
            lat: 0,
            lng: 0,
          };
          stateUnits.push(unit);
        }

        if (stateUnits.length > 0) {
          byState[state] = stateUnits;
          totalUnits += stateUnits.length;
        }
      } catch (stateErr: any) {
        console.warn(`[USDA CDC Batch] SSURGO: ${state} failed: ${stateErr.message}`);
      }
    }

    if (totalUnits === 0) {
      console.warn('[USDA CDC Batch] SSURGO: no data returned -- skipping cache save');
      recordCronRun('rebuild-ssurgo', 'success', Date.now() - start);
      return { name: 'ssurgo', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    await setSsurgoCache({
      _meta: {
        built: new Date().toISOString(),
        unitCount: totalUnits,
        stateCount: Object.keys(byState).length,
      },
      byState,
      grid,
    });

    console.log(`[USDA CDC Batch] SSURGO: ${totalUnits} units from ${Object.keys(byState).length} states`);
    recordCronRun('rebuild-ssurgo', 'success', Date.now() - start);
    return { name: 'ssurgo', status: 'success', durationMs: Date.now() - start, recordCount: totalUnits };
  } catch (err: any) {
    console.error('[USDA CDC Batch] SSURGO failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-ssurgo', batch: 'usda-cdc' } });
    recordCronRun('rebuild-ssurgo', 'error', Date.now() - start, err.message);
    return { name: 'ssurgo', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setSsurgoBuildInProgress(false);
  }
}

async function buildNassLivestock(): Promise<SubCronResult> {
  const start = Date.now();

  if (isNassLivestockBuildInProgress()) {
    return { name: 'nass-livestock', status: 'skipped', durationMs: Date.now() - start };
  }

  setNassLivestockBuildInProgress(true);
  try {
    const apiKey = process.env.NASS_API_KEY || '';
    if (!apiKey) {
      console.warn('[USDA CDC Batch] NASS Livestock: NASS_API_KEY not set -- skipping');
      recordCronRun('rebuild-nass-livestock', 'success', Date.now() - start);
      return { name: 'nass-livestock', status: 'skipped', durationMs: Date.now() - start };
    }

    const url = `https://quickstats.nass.usda.gov/api/api_GET/?key=${apiKey}&commodity_desc=CATTLE&statisticcat_desc=INVENTORY&year__GE=2023&format=JSON`;
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`NASS API returned HTTP ${res.status}`);
    const data = await res.json();
    const items = data?.data || [];

    if (items.length === 0) {
      console.warn('[USDA CDC Batch] NASS Livestock: no data returned -- skipping cache save');
      recordCronRun('rebuild-nass-livestock', 'success', Date.now() - start);
      return { name: 'nass-livestock', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const states: Record<string, any[]> = {};
    const commodities = new Set<string>();

    for (const item of items) {
      const state = (item.state_alpha || '').toUpperCase();
      if (!state || state.length !== 2) continue;

      const record = {
        state,
        county: item.county_name || '',
        commodity: item.commodity_desc || 'CATTLE',
        category: item.statisticcat_desc || 'INVENTORY',
        value: parseInt(String(item.Value || '0').replace(/,/g, ''), 10) || 0,
        unit: item.unit_desc || 'HEAD',
        year: parseInt(item.year || '0', 10),
        operationCount: null,
        inventoryHead: parseInt(String(item.Value || '0').replace(/,/g, ''), 10) || null,
        lat: 0,
        lng: 0,
      };

      commodities.add(record.commodity);
      if (!states[state]) states[state] = [];
      states[state].push(record);
    }

    const totalRecords = Object.values(states).reduce((sum, arr) => sum + arr.length, 0);

    await setNassLivestockCache({
      _meta: {
        built: new Date().toISOString(),
        recordCount: totalRecords,
        stateCount: Object.keys(states).length,
        commodityCount: commodities.size,
      },
      states,
    });

    console.log(`[USDA CDC Batch] NASS Livestock: ${totalRecords} records from ${Object.keys(states).length} states`);
    recordCronRun('rebuild-nass-livestock', 'success', Date.now() - start);
    return { name: 'nass-livestock', status: 'success', durationMs: Date.now() - start, recordCount: totalRecords };
  } catch (err: any) {
    console.error('[USDA CDC Batch] NASS Livestock failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-nass-livestock', batch: 'usda-cdc' } });
    recordCronRun('rebuild-nass-livestock', 'error', Date.now() - start, err.message);
    return { name: 'nass-livestock', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setNassLivestockBuildInProgress(false);
  }
}

async function buildNassCrops(): Promise<SubCronResult> {
  const start = Date.now();

  if (isNassCropsBuildInProgress()) {
    return { name: 'nass-crops', status: 'skipped', durationMs: Date.now() - start };
  }

  setNassCropsBuildInProgress(true);
  try {
    const apiKey = process.env.NASS_API_KEY || '';
    if (!apiKey) {
      console.warn('[USDA CDC Batch] NASS Crops: NASS_API_KEY not set -- skipping');
      recordCronRun('rebuild-nass-crops', 'success', Date.now() - start);
      return { name: 'nass-crops', status: 'skipped', durationMs: Date.now() - start };
    }

    const url = `https://quickstats.nass.usda.gov/api/api_GET/?key=${apiKey}&sector_desc=CROPS&statisticcat_desc=AREA%20PLANTED&year__GE=2023&format=JSON`;
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`NASS API returned HTTP ${res.status}`);
    const data = await res.json();
    const items = data?.data || [];

    if (items.length === 0) {
      console.warn('[USDA CDC Batch] NASS Crops: no data returned -- skipping cache save');
      recordCronRun('rebuild-nass-crops', 'success', Date.now() - start);
      return { name: 'nass-crops', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const states: Record<string, any[]> = {};
    let totalAcres = 0;

    for (const item of items) {
      const state = (item.state_alpha || '').toUpperCase();
      if (!state || state.length !== 2) continue;

      const acres = parseInt(String(item.Value || '0').replace(/,/g, ''), 10) || 0;
      const record = {
        state,
        county: item.county_name || '',
        commodity: item.commodity_desc || '',
        acresPlanted: acres,
        acresHarvested: null,
        yieldPerAcre: null,
        irrigatedPct: null,
        year: parseInt(item.year || '0', 10),
        lat: 0,
        lng: 0,
      };

      totalAcres += acres;
      if (!states[state]) states[state] = [];
      states[state].push(record);
    }

    const totalRecords = Object.values(states).reduce((sum, arr) => sum + arr.length, 0);

    await setNassCropsCache({
      _meta: {
        built: new Date().toISOString(),
        recordCount: totalRecords,
        stateCount: Object.keys(states).length,
        totalAcres,
      },
      states,
    });

    console.log(`[USDA CDC Batch] NASS Crops: ${totalRecords} records, ${totalAcres.toLocaleString()} total acres`);
    recordCronRun('rebuild-nass-crops', 'success', Date.now() - start);
    return { name: 'nass-crops', status: 'success', durationMs: Date.now() - start, recordCount: totalRecords };
  } catch (err: any) {
    console.error('[USDA CDC Batch] NASS Crops failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-nass-crops', batch: 'usda-cdc' } });
    recordCronRun('rebuild-nass-crops', 'error', Date.now() - start, err.message);
    return { name: 'nass-crops', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setNassCropsBuildInProgress(false);
  }
}

async function buildCdcPlaces(): Promise<SubCronResult> {
  const start = Date.now();

  if (isCdcPlacesBuildInProgress()) {
    return { name: 'cdc-places', status: 'skipped', durationMs: Date.now() - start };
  }

  setCdcPlacesBuildInProgress(true);
  try {
    const res = await fetch(
      'https://data.cdc.gov/resource/cwsq-ngmh.json?$limit=50000&$order=year%20DESC',
      { signal: AbortSignal.timeout(120_000) },
    );
    if (!res.ok) throw new Error(`CDC PLACES API returned HTTP ${res.status}`);
    const rawData = await res.json();

    if (!Array.isArray(rawData) || rawData.length === 0) {
      console.warn('[USDA CDC Batch] CDC PLACES: no data returned -- skipping cache save');
      recordCronRun('rebuild-cdc-places', 'success', Date.now() - start);
      return { name: 'cdc-places', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const grid: Record<string, any[]> = {};
    const stateIndex: Record<string, any[]> = {};
    const statesSet = new Set<string>();
    let tractCount = 0;

    for (const row of rawData) {
      const lat = parseFloat(row.geolocation?.latitude || row.latitude || '0');
      const lng = parseFloat(row.geolocation?.longitude || row.longitude || '0');
      const state = (row.stateabbr || row.statedesc || '').substring(0, 2).toUpperCase();

      const tract = {
        tractFips: row.locationid || row.tractfips || '',
        state,
        county: row.countyname || '',
        totalPopulation: parseInt(row.totalpopulation || '0', 10) || 0,
        asthmaPrevalence: parseFloat(row.casthma_crudeprev || '0') || null,
        cancerPrevalence: parseFloat(row.cancer_crudeprev || '0') || null,
        ckdPrevalence: parseFloat(row.kidney_crudeprev || '0') || null,
        copdPrevalence: parseFloat(row.copd_crudeprev || '0') || null,
        diabetesPrevalence: parseFloat(row.diabetes_crudeprev || '0') || null,
        mentalHealthPrevalence: parseFloat(row.mhlth_crudeprev || '0') || null,
        obesityPrevalence: parseFloat(row.obesity_crudeprev || '0') || null,
        smokingPrevalence: parseFloat(row.csmoking_crudeprev || '0') || null,
        physicalInactivity: parseFloat(row.lpa_crudeprev || '0') || null,
        drinkingPrevalence: parseFloat(row.binge_crudeprev || '0') || null,
        lat,
        lng,
      };

      if (lat && lng) {
        const key = gridKey(lat, lng);
        if (!grid[key]) grid[key] = [];
        grid[key].push(tract);
      }

      if (state) {
        statesSet.add(state);
        if (!stateIndex[state]) stateIndex[state] = [];
        stateIndex[state].push(tract);
      }

      tractCount++;
    }

    await setCdcPlacesCache({
      _meta: {
        built: new Date().toISOString(),
        tractCount,
        stateCount: statesSet.size,
        gridCells: Object.keys(grid).length,
      },
      grid,
      stateIndex,
    });

    console.log(`[USDA CDC Batch] CDC PLACES: ${tractCount} tracts, ${statesSet.size} states, ${Object.keys(grid).length} grid cells`);
    recordCronRun('rebuild-cdc-places', 'success', Date.now() - start);
    return { name: 'cdc-places', status: 'success', durationMs: Date.now() - start, recordCount: tractCount };
  } catch (err: any) {
    console.error('[USDA CDC Batch] CDC PLACES failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-cdc-places', batch: 'usda-cdc' } });
    recordCronRun('rebuild-cdc-places', 'error', Date.now() - start, err.message);
    return { name: 'cdc-places', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setCdcPlacesBuildInProgress(false);
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchStart = Date.now();
  const results: SubCronResult[] = [];

  console.log('[USDA CDC Batch] Starting batch rebuild of 4 USDA/CDC caches...');

  // Run sequentially to avoid overwhelming external APIs and stay within
  // the 300s function timeout. Each sub-cron has its own try/catch so a
  // failure in one does not block the others.

  results.push(await buildSsurgo());
  results.push(await buildNassLivestock());
  results.push(await buildNassCrops());
  results.push(await buildCdcPlaces());

  const totalDurationMs = Date.now() - batchStart;
  const elapsed = (totalDurationMs / 1000).toFixed(1);
  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const empty = results.filter(r => r.status === 'empty').length;

  console.log(`[USDA CDC Batch] Complete in ${elapsed}s -- ${succeeded} succeeded, ${failed} failed, ${skipped} skipped, ${empty} empty`);

  // Record overall batch cron run
  const overallStatus = failed === results.length ? 'error' : 'success';
  recordCronRun('rebuild-usda-cdc-batch', overallStatus, totalDurationMs,
    failed > 0 ? `${failed}/${results.length} sub-crons failed` : undefined);

  // Notify Slack if any sub-cron failed
  if (failed > 0) {
    const failedNames = results.filter(r => r.status === 'error').map(r => r.name).join(', ');
    notifySlackCronFailure({
      cronName: 'rebuild-usda-cdc-batch',
      error: `Sub-crons failed: ${failedNames}`,
      duration: totalDurationMs,
    });
  }

  const httpStatus = failed === results.length ? 500 : 200;

  return NextResponse.json({
    status: overallStatus,
    duration: `${elapsed}s`,
    summary: { succeeded, failed, skipped, empty, total: results.length },
    results: results.map(r => ({
      name: r.name,
      status: r.status,
      duration: `${(r.durationMs / 1000).toFixed(1)}s`,
      recordCount: r.recordCount,
      error: r.error,
    })),
    cacheStatus: {
      ssurgo: getSsurgoCacheStatus(),
      nassLivestock: getNassLivestockCacheStatus(),
      nassCrops: getNassCropsCacheStatus(),
      cdcPlaces: getCdcPlacesCacheStatus(),
    },
  }, { status: httpStatus });
}
