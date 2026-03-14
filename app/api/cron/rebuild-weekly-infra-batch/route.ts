// app/api/cron/rebuild-weekly-infra-batch/route.ts
// Batch cron -- rebuilds 5 infrastructure/regulatory caches in one invocation:
//   1. NLCD (USGS National Land Cover Database county-level summaries)
//   2. NADP PFAS (NOAA/NADP atmospheric PFAS deposition monitoring)
//   3. PHMSA Pipeline (DOT pipeline incident data)
//   4. Congress (water-related legislation tracking)
//   5. OSHA Water (DOL water/wastewater facility inspections)
//
// Replaces 5 individual cron routes to conserve Vercel cron slots:
//   rebuild-nlcd, rebuild-nadp-pfas, rebuild-phmsa, rebuild-congress, rebuild-osha-water
//
// Schedule: weekly Sunday 9:00 PM UTC

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';
import { gridKey } from '@/lib/cacheUtils';
import { PRIORITY_STATES } from '@/lib/constants';

// NLCD imports
import {
  setNlcdCache,
  isNlcdBuildInProgress,
  setNlcdBuildInProgress,
  getNlcdCacheStatus,
} from '@/lib/nlcdCache';

// NADP PFAS imports
import {
  setNadpPfasCache,
  isNadpPfasBuildInProgress,
  setNadpPfasBuildInProgress,
  getNadpPfasCacheStatus,
} from '@/lib/nadpPfasCache';

// PHMSA Pipeline imports
import {
  setPhmsaPipelineCache,
  isPhmsaBuildInProgress,
  setPhmsaBuildInProgress,
  getPhmsaPipelineCacheStatus,
} from '@/lib/phmsaPipelineCache';

// Congress imports
import {
  setCongressCache,
  isCongressBuildInProgress,
  setCongressBuildInProgress,
  getCongressCacheStatus,
} from '@/lib/congressCache';

// OSHA Water imports
import {
  setOshaWaterCache,
  isOshaWaterBuildInProgress,
  setOshaWaterBuildInProgress,
  getOshaWaterCacheStatus,
} from '@/lib/oshaWaterCache';

// ── Types ───────────────────────────────────────────────────────────────────

interface SubCronResult {
  name: string;
  status: 'success' | 'skipped' | 'empty' | 'error';
  durationMs: number;
  recordCount?: number;
  error?: string;
}

// ── Sub-cron builders ───────────────────────────────────────────────────────

async function buildNlcd(): Promise<SubCronResult> {
  const start = Date.now();

  if (isNlcdBuildInProgress()) {
    return { name: 'nlcd', status: 'skipped', durationMs: Date.now() - start };
  }

  setNlcdBuildInProgress(true);
  try {
    const res = await fetch(
      'https://www.mrlc.gov/geoserver/mrlc_display/NLCD_2021_Land_Cover_L48/ows?service=WFS&request=GetFeature&outputFormat=application/json&count=5000',
      { signal: AbortSignal.timeout(60_000) },
    );
    if (!res.ok) throw new Error(`MRLC WFS returned HTTP ${res.status}`);
    const geojson = await res.json();
    const features = geojson?.features || [];

    if (features.length === 0) {
      console.warn('[Weekly Infra Batch] NLCD: no data returned -- skipping cache save');
      recordCronRun('rebuild-nlcd', 'success', Date.now() - start);
      return { name: 'nlcd', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const byState: Record<string, any[]> = {};
    const grid: Record<string, any[]> = {};
    const statesSet = new Set<string>();
    let countyCount = 0;

    for (const feature of features) {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates;
      const lat = coords ? (Array.isArray(coords[0]) ? coords[0][1] : coords[1]) : 0;
      const lng = coords ? (Array.isArray(coords[0]) ? coords[0][0] : coords[0]) : 0;
      const state = (props.STATE || props.state || '').substring(0, 2).toUpperCase();

      const summary = {
        state,
        county: props.COUNTY || props.county || '',
        fips: props.FIPS || props.fips || '',
        developedPct: parseFloat(props.developed_pct || props.DEVELOPED || '0') || 0,
        forestPct: parseFloat(props.forest_pct || props.FOREST || '0') || 0,
        croplandPct: parseFloat(props.cropland_pct || props.CROPLAND || '0') || 0,
        wetlandPct: parseFloat(props.wetland_pct || props.WETLAND || '0') || 0,
        waterPct: parseFloat(props.water_pct || props.WATER || '0') || 0,
        barrenPct: parseFloat(props.barren_pct || props.BARREN || '0') || 0,
        grasslandPct: parseFloat(props.grassland_pct || props.GRASSLAND || '0') || 0,
        impervSurfacePct: parseFloat(props.imperv_pct || props.IMPERVIOUS || '0') || 0,
        treeCanopyPct: parseFloat(props.canopy_pct || props.CANOPY || '0') || 0,
        year: parseInt(props.year || props.YEAR || '2021', 10),
        lat: lat || 0,
        lng: lng || 0,
      };

      if (state) {
        statesSet.add(state);
        if (!byState[state]) byState[state] = [];
        byState[state].push(summary);
      }

      if (lat && lng) {
        const key = gridKey(lat, lng);
        if (!grid[key]) grid[key] = [];
        grid[key].push(summary);
      }

      countyCount++;
    }

    await setNlcdCache({
      _meta: {
        built: new Date().toISOString(),
        countyCount,
        stateCount: statesSet.size,
        dataYear: 2021,
      },
      byState,
      grid,
    });

    console.log(`[Weekly Infra Batch] NLCD: ${countyCount} counties from ${statesSet.size} states`);
    recordCronRun('rebuild-nlcd', 'success', Date.now() - start);
    return { name: 'nlcd', status: 'success', durationMs: Date.now() - start, recordCount: countyCount };
  } catch (err: any) {
    console.error('[Weekly Infra Batch] NLCD failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-nlcd', batch: 'weekly-infra' } });
    recordCronRun('rebuild-nlcd', 'error', Date.now() - start, err.message);
    return { name: 'nlcd', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setNlcdBuildInProgress(false);
  }
}

async function buildNadpPfas(): Promise<SubCronResult> {
  const start = Date.now();

  if (isNadpPfasBuildInProgress()) {
    return { name: 'nadp-pfas', status: 'skipped', durationMs: Date.now() - start };
  }

  setNadpPfasBuildInProgress(true);
  try {
    const res = await fetch(
      'https://nadp.slh.wisc.edu/dataAccess/api/v1/pfas-data',
      { signal: AbortSignal.timeout(60_000) },
    );
    if (!res.ok) throw new Error(`NADP PFAS API returned HTTP ${res.status}`);
    const rawData = await res.json();
    const items = Array.isArray(rawData) ? rawData : rawData?.data || rawData?.items || [];

    if (items.length === 0) {
      console.warn('[Weekly Infra Batch] NADP PFAS: no data returned -- skipping cache save');
      recordCronRun('rebuild-nadp-pfas', 'success', Date.now() - start);
      return { name: 'nadp-pfas', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const grid: Record<string, any[]> = {};
    const byState: Record<string, any[]> = {};
    const sitesSet = new Set<string>();
    const statesSet = new Set<string>();
    let sampleCount = 0;

    for (const item of items) {
      const lat = parseFloat(item.latitude || item.lat || '0');
      const lng = parseFloat(item.longitude || item.lon || item.lng || '0');
      const state = (item.state || item.stateCode || '').toUpperCase();

      const sample = {
        siteId: item.siteID || item.site_id || '',
        siteName: item.siteName || item.site_name || '',
        network: item.network || 'NADP',
        lat,
        lng,
        state,
        sampleDate: item.sampleDate || item.date || '',
        pfosConc: parseFloat(item.pfos || item.PFOS || '0') || null,
        pfoaConc: parseFloat(item.pfoa || item.PFOA || '0') || null,
        totalPfasConc: parseFloat(item.totalPFAS || item.total_pfas || '0') || null,
        precipMm: parseFloat(item.precip || item.precipitation_mm || '0') || null,
        depositionUgM2: parseFloat(item.deposition || item.dep_ug_m2 || '0') || null,
      };

      sitesSet.add(sample.siteId);

      if (lat && lng) {
        const key = gridKey(lat, lng);
        if (!grid[key]) grid[key] = [];
        grid[key].push(sample);
      }

      if (state) {
        statesSet.add(state);
        if (!byState[state]) byState[state] = [];
        byState[state].push(sample);
      }

      sampleCount++;
    }

    await setNadpPfasCache({
      _meta: {
        built: new Date().toISOString(),
        sampleCount,
        siteCount: sitesSet.size,
        stateCount: statesSet.size,
      },
      grid,
      byState,
    });

    console.log(`[Weekly Infra Batch] NADP PFAS: ${sampleCount} samples from ${sitesSet.size} sites`);
    recordCronRun('rebuild-nadp-pfas', 'success', Date.now() - start);
    return { name: 'nadp-pfas', status: 'success', durationMs: Date.now() - start, recordCount: sampleCount };
  } catch (err: any) {
    console.error('[Weekly Infra Batch] NADP PFAS failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-nadp-pfas', batch: 'weekly-infra' } });
    recordCronRun('rebuild-nadp-pfas', 'error', Date.now() - start, err.message);
    return { name: 'nadp-pfas', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setNadpPfasBuildInProgress(false);
  }
}

async function buildPhmsa(): Promise<SubCronResult> {
  const start = Date.now();

  if (isPhmsaBuildInProgress()) {
    return { name: 'phmsa-pipeline', status: 'skipped', durationMs: Date.now() - start };
  }

  setPhmsaBuildInProgress(true);
  try {
    // Try the Socrata data endpoint first
    const res = await fetch(
      'https://data.phmsa.dot.gov/resource/7tbj-768y.json?$limit=5000&$order=iyear%20DESC',
      { signal: AbortSignal.timeout(60_000) },
    );
    if (!res.ok) throw new Error(`PHMSA API returned HTTP ${res.status}`);
    const rawData = await res.json();

    if (!Array.isArray(rawData) || rawData.length === 0) {
      console.warn('[Weekly Infra Batch] PHMSA Pipeline: no data returned -- skipping cache save');
      recordCronRun('rebuild-phmsa', 'success', Date.now() - start);
      return { name: 'phmsa-pipeline', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const grid: Record<string, any[]> = {};
    const statesSet = new Set<string>();
    let incidentCount = 0;
    let waterContaminationCount = 0;

    for (const row of rawData) {
      const lat = parseFloat(row.location_latitude || row.latitude || '0');
      const lng = parseFloat(row.location_longitude || row.longitude || '0');
      const state = (row.location_state || row.state || '').toUpperCase();

      const spillBarrels = parseFloat(row.total_release_bbls || row.unintentional_release_bbls || '0') || null;
      const waterContam = !!(row.water_contamination === 'YES' || row.water_body_type);

      const incident = {
        reportId: row.report_number || row.report_id || `PHMSA-${incidentCount}`,
        operatorName: row.operator_name || '',
        state,
        county: row.location_county_name || row.county || '',
        commodity: row.commodity_released_type || row.commodity || '',
        incidentDate: row.significant_date || row.incident_date || '',
        causeCategory: row.cause_category || row.cause || '',
        spillBarrels,
        spillGallons: spillBarrels ? spillBarrels * 42 : null,
        waterContamination: waterContam,
        fatalities: parseInt(row.fatal || row.fatalities || '0', 10) || 0,
        injuries: parseInt(row.injure || row.injuries || '0', 10) || 0,
        propertyCost: parseFloat(row.total_cost_in_1984_dollars || row.property_damage || '0') || 0,
        lat,
        lng,
      };

      if (waterContam) waterContaminationCount++;
      statesSet.add(state);

      if (lat && lng) {
        const key = gridKey(lat, lng);
        if (!grid[key]) grid[key] = [];
        grid[key].push(incident);
      }

      incidentCount++;
    }

    await setPhmsaPipelineCache({
      _meta: {
        built: new Date().toISOString(),
        incidentCount,
        stateCount: statesSet.size,
        waterContaminationCount,
      },
      grid,
    });

    console.log(`[Weekly Infra Batch] PHMSA Pipeline: ${incidentCount} incidents, ${waterContaminationCount} water contamination`);
    recordCronRun('rebuild-phmsa', 'success', Date.now() - start);
    return { name: 'phmsa-pipeline', status: 'success', durationMs: Date.now() - start, recordCount: incidentCount };
  } catch (err: any) {
    console.error('[Weekly Infra Batch] PHMSA Pipeline failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-phmsa', batch: 'weekly-infra' } });
    recordCronRun('rebuild-phmsa', 'error', Date.now() - start, err.message);
    return { name: 'phmsa-pipeline', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setPhmsaBuildInProgress(false);
  }
}

async function buildCongress(): Promise<SubCronResult> {
  const start = Date.now();

  if (isCongressBuildInProgress()) {
    return { name: 'congress', status: 'skipped', durationMs: Date.now() - start };
  }

  setCongressBuildInProgress(true);
  try {
    const apiKey = process.env.CONGRESS_API_KEY || '';
    if (!apiKey) {
      console.warn('[Weekly Infra Batch] Congress: CONGRESS_API_KEY not set -- skipping');
      recordCronRun('rebuild-congress', 'success', Date.now() - start);
      return { name: 'congress', status: 'skipped', durationMs: Date.now() - start };
    }

    const res = await fetch(
      `https://api.congress.gov/v3/bill?api_key=${apiKey}&limit=250&sort=updateDate+desc&subject=Water`,
      {
        signal: AbortSignal.timeout(30_000),
        headers: { Accept: 'application/json' },
      },
    );
    if (!res.ok) throw new Error(`Congress API returned HTTP ${res.status}`);
    const data = await res.json();
    const rawBills = data?.bills || [];

    if (rawBills.length === 0) {
      console.warn('[Weekly Infra Batch] Congress: no data returned -- skipping cache save');
      recordCronRun('rebuild-congress', 'success', Date.now() - start);
      return { name: 'congress', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    let activeCount = 0;
    let enactedCount = 0;

    const bills = rawBills.map((b: any) => {
      const latestAction = b.latestAction?.text || '';
      const status = latestAction.includes('Became Public Law') ? 'enacted'
        : latestAction.includes('Vetoed') ? 'vetoed'
        : latestAction.includes('Passed Senate') ? 'passed_senate'
        : latestAction.includes('Passed House') ? 'passed_house'
        : latestAction.includes('Committee') ? 'committee'
        : 'introduced';

      if (status === 'enacted') enactedCount++;
      if (status !== 'introduced') activeCount++;

      return {
        billNumber: `${b.type || 'HR'} ${b.number || ''}`,
        billType: b.type || '',
        congress: b.congress || 0,
        title: b.title || '',
        shortTitle: b.shortTitle || null,
        sponsor: b.sponsors?.[0]?.fullName || '',
        sponsorParty: b.sponsors?.[0]?.party || '',
        sponsorState: b.sponsors?.[0]?.state || '',
        introducedDate: b.introducedDate || '',
        latestAction,
        latestActionDate: b.latestAction?.actionDate || '',
        status: status as any,
        subjects: b.subjects?.map((s: any) => s.name || s) || [],
        waterRelated: true,
        url: b.url || `https://www.congress.gov/bill/${b.congress}th-congress/${(b.type || '').toLowerCase()}-bill/${b.number}`,
      };
    });

    await setCongressCache({
      _meta: {
        built: new Date().toISOString(),
        billCount: bills.length,
        activeCount,
        enactedCount,
      },
      bills,
    });

    console.log(`[Weekly Infra Batch] Congress: ${bills.length} bills, ${activeCount} active, ${enactedCount} enacted`);
    recordCronRun('rebuild-congress', 'success', Date.now() - start);
    return { name: 'congress', status: 'success', durationMs: Date.now() - start, recordCount: bills.length };
  } catch (err: any) {
    console.error('[Weekly Infra Batch] Congress failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-congress', batch: 'weekly-infra' } });
    recordCronRun('rebuild-congress', 'error', Date.now() - start, err.message);
    return { name: 'congress', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setCongressBuildInProgress(false);
  }
}

async function buildOshaWater(): Promise<SubCronResult> {
  const start = Date.now();

  if (isOshaWaterBuildInProgress()) {
    return { name: 'osha-water', status: 'skipped', durationMs: Date.now() - start };
  }

  setOshaWaterBuildInProgress(true);
  try {
    const res = await fetch(
      'https://enforcedata.dol.gov/api/osha_inspection?naics=221310&naics=221320',
      { signal: AbortSignal.timeout(60_000) },
    );
    if (!res.ok) throw new Error(`DOL OSHA API returned HTTP ${res.status}`);
    const rawData = await res.json();
    const items = Array.isArray(rawData) ? rawData : rawData?.data || rawData?.results || [];

    if (items.length === 0) {
      console.warn('[Weekly Infra Batch] OSHA Water: no data returned -- skipping cache save');
      recordCronRun('rebuild-osha-water', 'success', Date.now() - start);
      return { name: 'osha-water', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const states: Record<string, any[]> = {};
    let totalPenalties = 0;

    for (const item of items) {
      const state = (item.site_state || item.state || '').toUpperCase();
      if (!state || state.length !== 2) continue;

      const penalty = parseFloat(item.total_current_penalty || item.penalty || '0') || 0;
      totalPenalties += penalty;

      const inspection = {
        activityNr: item.activity_nr || item.id || '',
        establishmentName: item.estab_name || item.establishment_name || '',
        state,
        sic: item.sic_code || '',
        naicsCode: item.naics_code || '',
        inspectionType: item.insp_type || item.inspection_type || '',
        openDate: item.open_date || '',
        closeDate: item.close_case_date || item.close_date || null,
        violationCount: parseInt(item.total_violations || item.nr_of_violations || '0', 10) || 0,
        seriousCount: parseInt(item.serious_violations || item.nr_serious || '0', 10) || 0,
        willfulCount: parseInt(item.willful_violations || item.nr_willful || '0', 10) || 0,
        penaltyTotal: penalty,
        lat: parseFloat(item.latitude || '0') || 0,
        lng: parseFloat(item.longitude || '0') || 0,
      };

      if (!states[state]) states[state] = [];
      states[state].push(inspection);
    }

    const totalInspections = Object.values(states).reduce((sum, arr) => sum + arr.length, 0);

    await setOshaWaterCache({
      _meta: {
        built: new Date().toISOString(),
        inspectionCount: totalInspections,
        stateCount: Object.keys(states).length,
        totalPenalties,
      },
      states,
    });

    console.log(`[Weekly Infra Batch] OSHA Water: ${totalInspections} inspections, $${totalPenalties.toLocaleString()} penalties`);
    recordCronRun('rebuild-osha-water', 'success', Date.now() - start);
    return { name: 'osha-water', status: 'success', durationMs: Date.now() - start, recordCount: totalInspections };
  } catch (err: any) {
    console.error('[Weekly Infra Batch] OSHA Water failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-osha-water', batch: 'weekly-infra' } });
    recordCronRun('rebuild-osha-water', 'error', Date.now() - start, err.message);
    return { name: 'osha-water', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setOshaWaterBuildInProgress(false);
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchStart = Date.now();
  const results: SubCronResult[] = [];

  console.log('[Weekly Infra Batch] Starting batch rebuild of 5 infrastructure/regulatory caches...');

  // Run sequentially to avoid overwhelming external APIs and stay within
  // the 300s function timeout. Each sub-cron has its own try/catch so a
  // failure in one does not block the others.

  results.push(await buildNlcd());
  results.push(await buildNadpPfas());
  results.push(await buildPhmsa());
  results.push(await buildCongress());
  results.push(await buildOshaWater());

  const totalDurationMs = Date.now() - batchStart;
  const elapsed = (totalDurationMs / 1000).toFixed(1);
  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const empty = results.filter(r => r.status === 'empty').length;

  console.log(`[Weekly Infra Batch] Complete in ${elapsed}s -- ${succeeded} succeeded, ${failed} failed, ${skipped} skipped, ${empty} empty`);

  // Record overall batch cron run
  const overallStatus = failed === results.length ? 'error' : 'success';
  recordCronRun('rebuild-weekly-infra-batch', overallStatus, totalDurationMs,
    failed > 0 ? `${failed}/${results.length} sub-crons failed` : undefined);

  // Notify Slack if any sub-cron failed
  if (failed > 0) {
    const failedNames = results.filter(r => r.status === 'error').map(r => r.name).join(', ');
    notifySlackCronFailure({
      cronName: 'rebuild-weekly-infra-batch',
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
      nlcd: getNlcdCacheStatus(),
      nadpPfas: getNadpPfasCacheStatus(),
      phmsaPipeline: getPhmsaPipelineCacheStatus(),
      congress: getCongressCacheStatus(),
      oshaWater: getOshaWaterCacheStatus(),
    },
  }, { status: httpStatus });
}
