// app/api/cron/rebuild-usgs-hydro-batch/route.ts
// Batch cron -- rebuilds 3 USGS hydrology caches in one invocation:
//   1. WQX Modern (EPA Water Quality Exchange 3.0 monitoring results)
//   2. STN Flood (USGS Short-Term Network flood event data)
//   3. StreamStats (USGS basin characteristics and flow statistics)
//
// Schedule: daily 8:30 AM UTC

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';
import { gridKey } from '@/lib/cacheUtils';
import { ALL_STATES_WITH_FIPS } from '@/lib/constants';

// WQX Modern imports
import {
  setWqxModernCache,
  isWqxModernBuildInProgress,
  setWqxModernBuildInProgress,
  getWqxModernCacheStatus,
} from '@/lib/wqxModernCache';
import type { WqxResult } from '@/lib/wqxModernCache';

// STN Flood imports
import {
  setStnFloodCache,
  isStnFloodBuildInProgress,
  setStnFloodBuildInProgress,
  getStnFloodCacheStatus,
} from '@/lib/stnFloodCache';
import type { StnFloodEvent } from '@/lib/stnFloodCache';

// StreamStats imports
import {
  setStreamStatsCache,
  isStreamStatsBuildInProgress,
  setStreamStatsBuildInProgress,
  getStreamStatsCacheStatus,
} from '@/lib/streamStatsCache';
import type { StreamStatsBasin } from '@/lib/streamStatsCache';

// ── Constants ────────────────────────────────────────────────────────────────

const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const CONCURRENCY = 4;
const REQUEST_TIMEOUT = 60_000;

// ── Types ────────────────────────────────────────────────────────────────────

interface SubCronResult {
  name: string;
  status: 'success' | 'skipped' | 'empty' | 'error';
  durationMs: number;
  recordCount?: number;
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Run an async function for each state with limited concurrency. */
async function forEachStateConcurrent<T>(
  states: string[],
  fn: (st: string) => Promise<T[]>,
): Promise<T[]> {
  const allResults: T[] = [];
  const queue = [...states];

  async function runNext(): Promise<void> {
    while (queue.length > 0) {
      const st = queue.shift()!;
      try {
        const items = await fn(st);
        allResults.push(...items);
      } catch (err: any) {
        console.warn(`[USGS Hydro Batch] State ${st} failed: ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => runNext());
  await Promise.all(workers);
  return allResults;
}

// ── Sub-cron 1: WQX Modern ─────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  fields.push(cur);
  return fields;
}

async function fetchWqxForState(stFips: [string, string]): Promise<WqxResult[]> {
  const [st, fips] = stFips;
  // WQP no longer accepts mimeType=json (returns 406); use CSV.
  // Limit to last 6 months + 2000 results per state to avoid OOM on serverless.
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startDate = `${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01-${sixMonthsAgo.getFullYear()}`;
  const url = `https://www.waterqualitydata.us/data/Result/search?mimeType=csv&zip=no&statecode=US:${fips}&startDateLo=${startDate}&dataProfile=resultPhysChem&providers=NWIS&providers=STORET&sorted=no`;
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  if (!resp.ok) throw new Error(`WQP HTTP ${resp.status}`);

  const text = await resp.text();
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse CSV header to build column index
  const headers = parseCsvLine(lines[0]);
  const col = (name: string) => headers.indexOf(name);
  const iLat = col('ActivityLocation/LatitudeMeasure');
  const iLng = col('ActivityLocation/LongitudeMeasure');
  const iOrgId = col('OrganizationIdentifier');
  const iOrgName = col('OrganizationFormalName');
  const iActId = col('ActivityIdentifier');
  const iChar = col('CharacteristicName');
  const iVal = col('ResultMeasureValue');
  const iUnit = col('ResultMeasure/MeasureUnitCode');
  const iMethod = col('ResultAnalyticalMethod/MethodName');
  const iMonId = col('MonitoringLocationIdentifier');
  const iMonType = col('MonitoringLocationTypeName');
  const iDate = col('ActivityStartDate');

  const MAX_PER_STATE = 3000;
  const results: WqxResult[] = [];
  for (let i = 1; i < lines.length && results.length < MAX_PER_STATE; i++) {
    const fields = parseCsvLine(lines[i]);
    const lat = parseFloat(fields[iLat] || '0');
    const lng = parseFloat(fields[iLng] || '0');
    if (!lat || !lng) continue;

    results.push({
      organizationId: fields[iOrgId] || '',
      organizationName: fields[iOrgName] || '',
      activityId: fields[iActId] || '',
      characteristicName: fields[iChar] || '',
      resultValue: fields[iVal] ? parseFloat(fields[iVal]) : null,
      resultUnit: fields[iUnit] || '',
      resultAnalyticalMethod: fields[iMethod] || '',
      monitoringLocationId: fields[iMonId] || '',
      monitoringLocationType: fields[iMonType] || '',
      lat,
      lng,
      activityStartDate: fields[iDate] || '',
      state: st,
    });
  }
  return results;
}

async function buildWqxModern(): Promise<SubCronResult> {
  const start = Date.now();

  if (isWqxModernBuildInProgress()) {
    return { name: 'wqx-modern', status: 'skipped', durationMs: Date.now() - start };
  }

  setWqxModernBuildInProgress(true);
  try {
    // Use state+FIPS pairs for WQP API which requires FIPS codes
    const allResults: WqxResult[] = [];
    const queue = [...ALL_STATES_WITH_FIPS] as [string, string][];

    async function runNext(): Promise<void> {
      while (queue.length > 0) {
        const pair = queue.shift()!;
        try {
          const items = await fetchWqxForState(pair);
          allResults.push(...items);
        } catch (err: any) {
          console.warn(`[USGS Hydro Batch] WQX state ${pair[0]} failed: ${err.message}`);
        }
      }
    }

    const workers = Array.from({ length: CONCURRENCY }, () => runNext());
    await Promise.all(workers);

    if (allResults.length === 0) {
      console.warn('[USGS Hydro Batch] WQX Modern: no data returned -- skipping cache save');
      recordCronRun('rebuild-wqx-modern', 'success', Date.now() - start);
      return { name: 'wqx-modern', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const byState: Record<string, WqxResult[]> = {};
    const grid: Record<string, WqxResult[]> = {};

    for (const r of allResults) {
      (byState[r.state] ??= []).push(r);
      const gk = gridKey(r.lat, r.lng);
      (grid[gk] ??= []).push(r);
    }

    await setWqxModernCache({
      _meta: {
        built: new Date().toISOString(),
        recordCount: allResults.length,
        stateCount: Object.keys(byState).length,
      },
      byState,
      grid,
    });

    console.log(`[USGS Hydro Batch] WQX Modern: ${allResults.length} records from ${Object.keys(byState).length} states`);
    recordCronRun('rebuild-wqx-modern', 'success', Date.now() - start);
    return { name: 'wqx-modern', status: 'success', durationMs: Date.now() - start, recordCount: allResults.length };
  } catch (err: any) {
    console.error('[USGS Hydro Batch] WQX Modern failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-wqx-modern', batch: 'usgs-hydro-batch' } });
    recordCronRun('rebuild-wqx-modern', 'error', Date.now() - start, err.message);
    return { name: 'wqx-modern', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setWqxModernBuildInProgress(false);
  }
}

// ── Sub-cron 2: STN Flood ──────────────────────────────────────────────────

async function buildStnFlood(): Promise<SubCronResult> {
  const start = Date.now();

  if (isStnFloodBuildInProgress()) {
    return { name: 'stn-flood', status: 'skipped', durationMs: Date.now() - start };
  }

  setStnFloodBuildInProgress(true);
  try {
    // Step 1: Fetch recent flood events
    const eventsUrl = 'https://stn.wim.usgs.gov/STNServices/Events.json';
    const eventsResp = await fetch(eventsUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      headers: { Accept: 'application/json' },
    });
    if (!eventsResp.ok) throw new Error(`STN Events HTTP ${eventsResp.status}`);
    const events = await eventsResp.json();

    if (!Array.isArray(events) || events.length === 0) {
      console.warn('[USGS Hydro Batch] STN Flood: no events returned -- skipping cache save');
      recordCronRun('rebuild-stn-flood', 'success', Date.now() - start);
      return { name: 'stn-flood', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    // Sort by event_start_date descending, take recent events (last 12 months)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const recentEvents = events
      .filter((e: any) => {
        const startDate = e.event_start_date || e.EventStartDate;
        return startDate && new Date(startDate) >= oneYearAgo;
      })
      .slice(0, 20); // Limit to 20 most recent events to stay within timeout

    const grid: Record<string, StnFloodEvent[]> = {};
    const stateIndex: Record<string, StnFloodEvent[]> = {};
    const statesWithData = new Set<string>();
    let totalEvents = 0;

    // Step 2: For each recent event, fetch instruments/sensors
    for (const event of recentEvents) {
      const eventId = event.event_id || event.EventId;
      const eventName = event.event_name || event.EventName || `Event ${eventId}`;
      const eventStartDate = event.event_start_date || event.EventStartDate || '';
      const eventEndDate = event.event_end_date || event.EventEndDate || null;
      const eventStatus = event.event_status_string || event.EventStatus || '';

      try {
        const instrUrl = `https://stn.wim.usgs.gov/STNServices/Instruments/FilteredInstruments.json?Event=${eventId}`;
        const instrResp = await fetch(instrUrl, {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
          headers: { Accept: 'application/json' },
        });
        if (!instrResp.ok) {
          console.warn(`[USGS Hydro Batch] STN instruments for event ${eventId} HTTP ${instrResp.status}`);
          continue;
        }
        const instruments = await instrResp.json();
        if (!Array.isArray(instruments)) continue;

        for (const inst of instruments) {
          const lat = parseFloat(inst.latitude || inst.Latitude || inst.site_latitude || '0');
          const lng = parseFloat(inst.longitude || inst.Longitude || inst.site_longitude || '0');
          if (!lat || !lng) continue;

          const state = (inst.state_abbrev || inst.StateAbbrev || inst.state || '').toUpperCase();
          if (!state) continue;

          statesWithData.add(state);

          const floodEvent: StnFloodEvent = {
            eventId: eventId,
            eventName,
            state,
            county: inst.county || inst.County || '',
            sensorType: inst.sensor_type_string || inst.SensorType || inst.instrument_type || '',
            siteNo: inst.site_no || inst.SiteNo || '',
            peakStage: inst.peak_stage != null ? parseFloat(inst.peak_stage) : null,
            peakDate: inst.peak_date || inst.PeakDate || null,
            hwmElevation: inst.hwm_elevation != null ? parseFloat(inst.hwm_elevation) : null,
            lat,
            lng,
            eventStatus,
            eventStartDate,
            eventEndDate,
          };

          const gk = gridKey(lat, lng);
          (grid[gk] ??= []).push(floodEvent);
          (stateIndex[state] ??= []).push(floodEvent);
          totalEvents++;
        }
      } catch (err: any) {
        console.warn(`[USGS Hydro Batch] STN event ${eventId} instruments failed: ${err.message}`);
      }
    }

    if (totalEvents === 0) {
      console.warn('[USGS Hydro Batch] STN Flood: no sensor data from recent events -- skipping cache save');
      recordCronRun('rebuild-stn-flood', 'success', Date.now() - start);
      return { name: 'stn-flood', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    await setStnFloodCache({
      _meta: {
        built: new Date().toISOString(),
        eventCount: totalEvents,
        stateCount: statesWithData.size,
      },
      grid,
      stateIndex,
    });

    console.log(`[USGS Hydro Batch] STN Flood: ${totalEvents} sensors from ${statesWithData.size} states`);
    recordCronRun('rebuild-stn-flood', 'success', Date.now() - start);
    return { name: 'stn-flood', status: 'success', durationMs: Date.now() - start, recordCount: totalEvents };
  } catch (err: any) {
    console.error('[USGS Hydro Batch] STN Flood failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-stn-flood', batch: 'usgs-hydro-batch' } });
    recordCronRun('rebuild-stn-flood', 'error', Date.now() - start, err.message);
    return { name: 'stn-flood', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setStnFloodBuildInProgress(false);
  }
}

// ── Sub-cron 3: StreamStats ────────────────────────────────────────────────

async function fetchStreamStatsForState(st: string): Promise<StreamStatsBasin[]> {
  const url = `https://streamstats.usgs.gov/gagestats/api/v1/stations?stateCode=${st}&statisticCodes=PK17B500,MA0001`;
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    headers: { Accept: 'application/json' },
  });
  if (!resp.ok) throw new Error(`StreamStats HTTP ${resp.status}`);
  const json = await resp.json();
  const stations = Array.isArray(json) ? json : json?.features || json?.data || [];

  const basins: StreamStatsBasin[] = [];
  for (const stn of stations) {
    const lat = parseFloat(
      stn.location?.latitude || stn.latitude || stn.Latitude ||
      stn.geometry?.coordinates?.[1] || '0'
    );
    const lng = parseFloat(
      stn.location?.longitude || stn.longitude || stn.Longitude ||
      stn.geometry?.coordinates?.[0] || '0'
    );
    if (!lat || !lng) continue;

    // Extract statistics from the station object
    const stats = stn.statistics || stn.Statistics || [];
    let meanAnnualFlow: number | null = null;
    let peakQ100: number | null = null;
    let peakQ500: number | null = null;

    for (const stat of (Array.isArray(stats) ? stats : [])) {
      const code = stat.statisticGroupTypeCode || stat.StatisticCode || '';
      const val = stat.value != null ? parseFloat(stat.value) : null;
      if (code === 'MA0001' && val != null) meanAnnualFlow = val;
      if (code === 'PK17B500' && val != null) peakQ500 = val;
      if (code === 'PK17B100' && val != null) peakQ100 = val;
    }

    // Extract basin characteristics
    const chars = stn.characteristics || stn.basinCharacteristics || [];
    let drainageArea: number | null = null;
    let slope: number | null = null;
    let elevation: number | null = null;
    let precip: number | null = null;
    let imperv: number | null = null;
    let forest: number | null = null;

    for (const c of (Array.isArray(chars) ? chars : [])) {
      const code = c.code || c.characteristicCode || '';
      const val = c.value != null ? parseFloat(c.value) : null;
      if (code === 'DRNAREA' && val != null) drainageArea = val;
      if (code === 'BSLDEM10M' && val != null) slope = val;
      if (code === 'ELEV' && val != null) elevation = val;
      if (code === 'PRECIP' && val != null) precip = val;
      if (code === 'LC11IMP' && val != null) imperv = val;
      if (code === 'LC11FOREST' && val != null) forest = val;
    }

    basins.push({
      stationId: stn.code || stn.stationID || stn.site_no || '',
      stationName: stn.name || stn.stationName || stn.station_nm || '',
      state: st,
      lat,
      lng,
      drainageAreaSqMi: drainageArea ?? (stn.drainageArea != null ? parseFloat(stn.drainageArea) : null),
      meanAnnualFlowCfs: meanAnnualFlow,
      peakFlowQ100: peakQ100,
      peakFlowQ500: peakQ500,
      basinSlope: slope,
      basinElevationFt: elevation,
      precipInchesAnnual: precip,
      impervPct: imperv,
      forestPct: forest,
      huc8: stn.huc8 || stn.HUC8 || '',
    });
  }
  return basins;
}

async function buildStreamStats(): Promise<SubCronResult> {
  const start = Date.now();

  if (isStreamStatsBuildInProgress()) {
    return { name: 'stream-stats', status: 'skipped', durationMs: Date.now() - start };
  }

  setStreamStatsBuildInProgress(true);
  try {
    const allBasins = await forEachStateConcurrent(ALL_STATES, fetchStreamStatsForState);

    if (allBasins.length === 0) {
      console.warn('[USGS Hydro Batch] StreamStats: no data returned -- skipping cache save');
      recordCronRun('rebuild-stream-stats', 'success', Date.now() - start);
      return { name: 'stream-stats', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const byState: Record<string, StreamStatsBasin[]> = {};
    for (const b of allBasins) {
      (byState[b.state] ??= []).push(b);
    }

    await setStreamStatsCache({
      _meta: {
        built: new Date().toISOString(),
        basinCount: allBasins.length,
        stateCount: Object.keys(byState).length,
      },
      byState,
    });

    console.log(`[USGS Hydro Batch] StreamStats: ${allBasins.length} basins from ${Object.keys(byState).length} states`);
    recordCronRun('rebuild-stream-stats', 'success', Date.now() - start);
    return { name: 'stream-stats', status: 'success', durationMs: Date.now() - start, recordCount: allBasins.length };
  } catch (err: any) {
    console.error('[USGS Hydro Batch] StreamStats failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-stream-stats', batch: 'usgs-hydro-batch' } });
    recordCronRun('rebuild-stream-stats', 'error', Date.now() - start, err.message);
    return { name: 'stream-stats', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setStreamStatsBuildInProgress(false);
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchStart = Date.now();
  const results: SubCronResult[] = [];

  console.log('[USGS Hydro Batch] Starting batch rebuild of 3 USGS hydrology caches...');

  // Run sequentially to avoid overwhelming external APIs and stay within
  // the 300s function timeout. Each sub-cron has its own try/catch so a
  // failure in one does not block the others.

  results.push(await buildWqxModern());
  results.push(await buildStnFlood());
  results.push(await buildStreamStats());

  const totalDurationMs = Date.now() - batchStart;
  const elapsed = (totalDurationMs / 1000).toFixed(1);
  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const empty = results.filter(r => r.status === 'empty').length;

  console.log(`[USGS Hydro Batch] Complete in ${elapsed}s -- ${succeeded} succeeded, ${failed} failed, ${skipped} skipped, ${empty} empty`);

  // Record overall batch cron run
  const overallStatus = failed === results.length ? 'error' : 'success';
  recordCronRun('rebuild-usgs-hydro-batch', overallStatus, totalDurationMs,
    failed > 0 ? `${failed}/${results.length} sub-crons failed` : undefined);

  // Notify Slack if any sub-cron failed
  if (failed > 0) {
    const failedNames = results.filter(r => r.status === 'error').map(r => r.name).join(', ');
    notifySlackCronFailure({
      cronName: 'rebuild-usgs-hydro-batch',
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
      wqxModern: getWqxModernCacheStatus(),
      stnFlood: getStnFloodCacheStatus(),
      streamStats: getStreamStatsCacheStatus(),
    },
  }, { status: httpStatus });
}
