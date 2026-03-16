// app/api/cron/rebuild-epa-reporting-batch/route.ts
// Batch cron -- rebuilds 3 EPA reporting/environmental caches in one invocation:
//   1. eReporting (EPA ECHO DMR electronic discharge monitoring report filings)
//   2. epaOppPesticide (EPA OPP aquatic life benchmarks)
//   3. swdi (NOAA SWDI severe weather events)
//
// Replaces 3 individual cron routes to conserve Vercel cron slots:
//   rebuild-e-reporting, rebuild-epa-opp-pesticide, rebuild-swdi
//
// Schedule: daily 11:15 AM UTC

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';
import { gridKey } from '@/lib/cacheUtils';
import { PRIORITY_STATES } from '@/lib/constants';

// eReporting imports
import {
  setEReportingCache,
  isEReportingBuildInProgress,
  setEReportingBuildInProgress,
  getEReportingCacheStatus,
} from '@/lib/eReportingCache';

// EPA OPP Pesticide imports
import {
  setEpaOppPesticideCache,
  isEpaOppPesticideBuildInProgress,
  setEpaOppPesticideBuildInProgress,
  getEpaOppPesticideCacheStatus,
} from '@/lib/epaOppPesticideCache';

// SWDI imports
import {
  setSwdiCache,
  isSwdiBuildInProgress,
  setSwdiBuildInProgress,
  getSwdiCacheStatus,
} from '@/lib/swdiCache';

// ── Types ───────────────────────────────────────────────────────────────────

interface SubCronResult {
  name: string;
  status: 'success' | 'skipped' | 'empty' | 'error';
  durationMs: number;
  recordCount?: number;
  error?: string;
}

// ── Sub-cron builders ───────────────────────────────────────────────────────

async function buildEReporting(): Promise<SubCronResult> {
  const start = Date.now();

  if (isEReportingBuildInProgress()) {
    return { name: 'e-reporting', status: 'skipped', durationMs: Date.now() - start };
  }

  setEReportingBuildInProgress(true);
  try {
    const byState: Record<string, any[]> = {};
    let totalFilings = 0;
    let lateCount = 0;
    const facilitiesSet = new Set<string>();

    for (const state of PRIORITY_STATES) {
      try {
        // Step 1: Get QID for the state
        const qidRes = await fetch(
          `https://echodata.epa.gov/echo/dmr_rest_services.get_qid?p_st=${state}&output=JSON`,
          { signal: AbortSignal.timeout(30_000) },
        );
        if (!qidRes.ok) continue;
        const qidData = await qidRes.json();
        const qid = qidData?.Results?.QueryID;
        if (!qid) continue;

        // Step 2: Get results by QID
        const resultsRes = await fetch(
          `https://echodata.epa.gov/echo/dmr_rest_services.get_results?qid=${qid}&output=JSON`,
          { signal: AbortSignal.timeout(60_000) },
        );
        if (!resultsRes.ok) continue;
        const resultsData = await resultsRes.json();
        const facilities = resultsData?.Results?.Facilities || [];

        const stateFilings: any[] = [];
        for (const f of facilities) {
          const lat = parseFloat(f.FacLat || f.RegistryLat || '0');
          const lng = parseFloat(f.FacLong || f.RegistryLon || '0');
          if (!lat || !lng) continue;

          const filing = {
            permitId: f.SourceID || f.CWPPermitStatusDesc || '',
            facilityName: f.FacName || '',
            state,
            filingStatus: f.CWPStatus === 'Effective'
              ? (f.DfrUrl ? 'submitted' : 'pending')
              : 'overdue',
            reportingPeriod: f.CWPCurrentSNCStatus || '',
            dueDate: f.CWPDateLastDmr || '',
            submittedDate: f.CWPDateLastDmr || null,
            lateSubmission: f.CWPSNCStatus === 'S',
            daysLate: null,
            parameterCount: parseInt(f.CWPTotalDesViolations || '0', 10),
            violationCount: parseInt(f.CWPQtrsWithNC || '0', 10),
            lat,
            lng,
          };

          if (filing.lateSubmission) lateCount++;
          facilitiesSet.add(filing.permitId);
          stateFilings.push(filing);
        }

        if (stateFilings.length > 0) {
          byState[state] = stateFilings;
          totalFilings += stateFilings.length;
        }
      } catch (stateErr: any) {
        console.warn(`[EPA Reporting Batch] eReporting: ${state} failed: ${stateErr.message}`);
      }
    }

    if (totalFilings === 0) {
      console.warn('[EPA Reporting Batch] eReporting: no data returned -- skipping cache save');
      recordCronRun('rebuild-e-reporting', 'success', Date.now() - start);
      return { name: 'e-reporting', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    await setEReportingCache({
      _meta: {
        built: new Date().toISOString(),
        filingCount: totalFilings,
        facilityCount: facilitiesSet.size,
        stateCount: Object.keys(byState).length,
        lateCount,
      },
      byState,
    });

    console.log(`[EPA Reporting Batch] eReporting: ${totalFilings} filings from ${Object.keys(byState).length} states`);
    recordCronRun('rebuild-e-reporting', 'success', Date.now() - start);
    return { name: 'e-reporting', status: 'success', durationMs: Date.now() - start, recordCount: totalFilings };
  } catch (err: any) {
    console.error('[EPA Reporting Batch] eReporting failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-e-reporting', batch: 'epa-reporting' } });
    recordCronRun('rebuild-e-reporting', 'error', Date.now() - start, err.message);
    return { name: 'e-reporting', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setEReportingBuildInProgress(false);
  }
}

async function buildEpaOppPesticide(): Promise<SubCronResult> {
  const start = Date.now();

  if (isEpaOppPesticideBuildInProgress()) {
    return { name: 'epa-opp-pesticide', status: 'skipped', durationMs: Date.now() - start };
  }

  setEpaOppPesticideBuildInProgress(true);
  try {
    const res = await fetch(
      'https://ordspub.epa.gov/ords/pesticides/apprilern/benchmark',
      { signal: AbortSignal.timeout(60_000) },
    );
    if (!res.ok) throw new Error(`EPA OPP API returned HTTP ${res.status}`);
    const rawBenchmarks = await res.json();
    const items = Array.isArray(rawBenchmarks) ? rawBenchmarks : rawBenchmarks?.items || [];

    if (items.length === 0) {
      console.warn('[EPA Reporting Batch] EPA OPP Pesticide: no data returned -- skipping cache save');
      recordCronRun('rebuild-epa-opp-pesticide', 'success', Date.now() - start);
      return { name: 'epa-opp-pesticide', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    let highRiskCount = 0;
    const benchmarks = items.map((b: any) => {
      const aquaticBenchmark = parseFloat(b.aquatic_life_benchmark || b.aq_bench || '0') || null;
      const humanBenchmark = parseFloat(b.human_health_benchmark || b.hh_bench || '0') || null;
      const risk = aquaticBenchmark && aquaticBenchmark < 1 ? 'high'
        : aquaticBenchmark && aquaticBenchmark < 10 ? 'moderate'
        : 'low';
      if (risk === 'high') highRiskCount++;

      return {
        chemicalName: b.chemical_name || b.chem_name || '',
        casNumber: b.cas_number || b.cas_no || '',
        pesticideType: b.pesticide_type || b.pest_type || '',
        aquaticLifeBenchmark: aquaticBenchmark,
        aquaticLifeBenchmarkUnit: b.aq_bench_unit || 'ug/L',
        humanHealthBenchmark: humanBenchmark,
        humanHealthBenchmarkUnit: b.hh_bench_unit || 'ug/L',
        mcl: parseFloat(b.mcl || '0') || null,
        ha: parseFloat(b.ha || '0') || null,
        ecologicalRisk: risk as 'low' | 'moderate' | 'high',
        lastUpdated: b.last_updated || new Date().toISOString(),
      };
    });

    await setEpaOppPesticideCache({
      _meta: {
        built: new Date().toISOString(),
        benchmarkCount: benchmarks.length,
        highRiskCount,
      },
      benchmarks,
    });

    console.log(`[EPA Reporting Batch] EPA OPP Pesticide: ${benchmarks.length} benchmarks`);
    recordCronRun('rebuild-epa-opp-pesticide', 'success', Date.now() - start);
    return { name: 'epa-opp-pesticide', status: 'success', durationMs: Date.now() - start, recordCount: benchmarks.length };
  } catch (err: any) {
    console.error('[EPA Reporting Batch] EPA OPP Pesticide failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-epa-opp-pesticide', batch: 'epa-reporting' } });
    recordCronRun('rebuild-epa-opp-pesticide', 'error', Date.now() - start, err.message);
    return { name: 'epa-opp-pesticide', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setEpaOppPesticideBuildInProgress(false);
  }
}

async function buildSwdi(): Promise<SubCronResult> {
  const start = Date.now();

  if (isSwdiBuildInProgress()) {
    return { name: 'swdi', status: 'skipped', durationMs: Date.now() - start };
  }

  setSwdiBuildInProgress(true);
  try {
    const grid: Record<string, any[]> = {};
    let totalEvents = 0;
    let severeCount = 0;
    const statesWithData = new Set<string>();

    // NCDC migrated to NCEI; max date range is 744 hours (~31 days).
    // Query last 30 days in a single chunk; no per-state filter available in new API.
    const now = new Date();
    const end = new Date(now);
    const start30 = new Date(now);
    start30.setDate(start30.getDate() - 30);
    const fmt = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

    let allSwdiResults: any[] = [];
    try {
      const res = await fetch(
        `https://www.ncei.noaa.gov/swdiws/json/nx3structure/${fmt(start30)}:${fmt(end)}`,
        { signal: AbortSignal.timeout(60_000), redirect: 'follow' },
      );
      if (res.ok) {
        const data = await res.json();
        const rawResults = data?.swdiJsonResponse?.result || data?.result || data?.results || [];
        allSwdiResults = rawResults;
        console.log(`[EPA Reporting Batch] SWDI: fetched ${allSwdiResults.length} raw events`);
      } else {
        console.warn(`[EPA Reporting Batch] SWDI: HTTP ${res.status}`);
      }
    } catch (fetchErr: any) {
      console.warn(`[EPA Reporting Batch] SWDI fetch failed: ${fetchErr.message}`);
    }

    for (const evt of allSwdiResults) {
      try {
        // Parse lat/lng from SHAPE field: "POINT (lng lat)"
        let lat = 0, lng = 0;
        const shape = evt.SHAPE || '';
        const pointMatch = shape.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/);
        if (pointMatch) {
          lng = parseFloat(pointMatch[1]);
          lat = parseFloat(pointMatch[2]);
        } else {
          lat = parseFloat(evt.lat || evt.BEGIN_LAT || '0');
          lng = parseFloat(evt.lon || evt.lng || evt.BEGIN_LON || '0');
        }
        if (!lat || !lng) continue;

        // Derive severity from max reflectivity (dBZ)
        const maxReflect = parseFloat(evt.MAX_REFLECT || '0');
        const severity = maxReflect >= 60 ? 'severe'
          : maxReflect >= 50 ? 'moderate'
          : 'minor';
        if (severity === 'severe') severeCount++;

        // Determine state from radar station (first 4 chars = WSR_ID like KCLE)
        const wsrId = evt.WSR_ID || '';
        // Use lat/lng to approximate state — accept all CONUS events
        const state = wsrId.slice(0, 1) === 'K' ? 'US' : 'US'; // all tagged as national

        const event = {
          eventId: `${wsrId}-${evt.CELL_ID || ''}-${totalEvents}`,
          eventType: maxReflect >= 55 ? 'thunderstorm' : 'convective',
          severity,
          lat,
          lng,
          state: 'US',
          county: '',
          eventDate: evt.ZTIME || evt.date || '',
          magnitude: maxReflect || null,
          magnitudeUnit: 'dBZ',
          source: 'NOAA SWDI',
        };

        const key = gridKey(lat, lng);
        if (!grid[key]) grid[key] = [];
        grid[key].push(event);
        totalEvents++;
        statesWithData.add('US');
      } catch (evtErr: any) {
        // skip individual event parse errors
      }
    }

    if (totalEvents === 0) {
      console.warn('[EPA Reporting Batch] SWDI: no data returned -- skipping cache save');
      recordCronRun('rebuild-swdi', 'success', Date.now() - start);
      return { name: 'swdi', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    await setSwdiCache({
      _meta: {
        built: new Date().toISOString(),
        eventCount: totalEvents,
        stateCount: statesWithData.size,
        severeCount,
      },
      grid,
    });

    console.log(`[EPA Reporting Batch] SWDI: ${totalEvents} events from ${statesWithData.size} states`);
    recordCronRun('rebuild-swdi', 'success', Date.now() - start);
    return { name: 'swdi', status: 'success', durationMs: Date.now() - start, recordCount: totalEvents };
  } catch (err: any) {
    console.error('[EPA Reporting Batch] SWDI failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-swdi', batch: 'epa-reporting' } });
    recordCronRun('rebuild-swdi', 'error', Date.now() - start, err.message);
    return { name: 'swdi', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setSwdiBuildInProgress(false);
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchStart = Date.now();
  const results: SubCronResult[] = [];

  console.log('[EPA Reporting Batch] Starting batch rebuild of 3 EPA/environmental caches...');

  // Run sequentially to avoid overwhelming external APIs and stay within
  // the 300s function timeout. Each sub-cron has its own try/catch so a
  // failure in one does not block the others.

  results.push(await buildEReporting());
  results.push(await buildEpaOppPesticide());
  results.push(await buildSwdi());

  const totalDurationMs = Date.now() - batchStart;
  const elapsed = (totalDurationMs / 1000).toFixed(1);
  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const empty = results.filter(r => r.status === 'empty').length;

  console.log(`[EPA Reporting Batch] Complete in ${elapsed}s -- ${succeeded} succeeded, ${failed} failed, ${skipped} skipped, ${empty} empty`);

  // Record overall batch cron run
  const overallStatus = failed === results.length ? 'error' : 'success';
  recordCronRun('rebuild-epa-reporting-batch', overallStatus, totalDurationMs,
    failed > 0 ? `${failed}/${results.length} sub-crons failed` : undefined);

  // Notify Slack if any sub-cron failed
  if (failed > 0) {
    const failedNames = results.filter(r => r.status === 'error').map(r => r.name).join(', ');
    notifySlackCronFailure({
      cronName: 'rebuild-epa-reporting-batch',
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
      eReporting: getEReportingCacheStatus(),
      epaOppPesticide: getEpaOppPesticideCacheStatus(),
      swdi: getSwdiCacheStatus(),
    },
  }, { status: httpStatus });
}
