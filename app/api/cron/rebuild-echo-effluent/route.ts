// app/api/cron/rebuild-echo-effluent/route.ts
// Cron endpoint — fetches EPA ECHO effluent/DMR data for SNC facilities per state.
// Schedule: daily at 10:30 PM UTC.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setEchoEffluentCache, getEchoEffluentCacheStatus,
  isEchoEffluentBuildInProgress, setEchoEffluentBuildInProgress,
  type EffluentRecord,
} from '@/lib/echoEffluentCache';
import { getEchoAllData } from '@/lib/echoCache';
import { ALL_STATES } from '@/lib/constants';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const EFFLUENT_API = 'https://echodata.epa.gov/echo/eff_rest_services.get_effluent_chart';
const FETCH_TIMEOUT_MS = 15_000;
const FACILITY_CONCURRENCY = 5;

// ── Per-Facility Fetch ──────────────────────────────────────────────────────

async function fetchEffluentForFacility(
  permitId: string,
  facilityName: string,
  state: string,
  lat: number | null,
  lng: number | null,
): Promise<EffluentRecord[]> {
  try {
    const params = new URLSearchParams({
      p_id: permitId,
      output: 'JSON',
    });

    const res = await fetch(`${EFFLUENT_API}?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) return [];
    const data = await res.json();

    // Parse effluent chart response — structure varies
    const charts = data?.Results?.EFF_CHART || data?.EFF_CHART || [];
    const records: EffluentRecord[] = [];
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    for (const chart of charts) {
      const monEnd = chart.MONITORING_PERIOD_END_DATE || chart.monitoringPeriodEndDate || '';
      // Only keep last 12 months
      if (monEnd) {
        const endDate = new Date(monEnd);
        if (endDate < oneYearAgo) continue;
      }

      const limitVal = parseFloat(chart.LIMIT_VALUE_STANDARD_UNITS || chart.limitValue) || null;
      const actualVal = parseFloat(chart.DMR_VALUE_STANDARD_UNITS || chart.actualValue) || null;
      const exceedance = (limitVal != null && actualVal != null) ? actualVal > limitVal : false;

      records.push({
        facilityId: permitId,
        facilityName,
        state,
        lat,
        lng,
        parameterCode: chart.PARAMETER_CODE || chart.parameterCode || '',
        parameterDesc: chart.PARAMETER_DESC || chart.parameterDesc || '',
        limitValue: limitVal,
        limitUnit: chart.STANDARD_UNIT_DESC || chart.limitUnit || null,
        actualValue: actualVal,
        exceedance,
        monitoringPeriodEnd: monEnd,
      });
    }

    return records;
  } catch {
    return [];
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isEchoEffluentBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'ECHO Effluent build already in progress',
      cache: getEchoEffluentCacheStatus(),
    });
  }

  setEchoEffluentBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Step 1: Get SNC facilities from existing ECHO cache
    const echoData = getEchoAllData();
    const sncFacilities = echoData.facilities.filter(f => f.snc && f.permitId);

    console.log(`[ECHO Effluent Cron] Found ${sncFacilities.length} SNC facilities from ECHO cache`);

    // Group by state
    const facilityByState = new Map<string, typeof sncFacilities>();
    for (const f of sncFacilities) {
      const st = f.state?.toUpperCase() || '';
      if (!st) continue;
      if (!facilityByState.has(st)) facilityByState.set(st, []);
      facilityByState.get(st)!.push(f);
    }

    const effluentByState: Record<string, { records: EffluentRecord[]; fetched: string }> = {};
    const now = new Date().toISOString();
    let totalRecords = 0;

    // Initialize all states
    for (const st of ALL_STATES) {
      effluentByState[st] = { records: [], fetched: now };
    }

    // Step 2: Fetch effluent data for SNC facilities with concurrency limit
    const allFacilities = sncFacilities;
    let idx = 0;
    let running = 0;

    await new Promise<void>((resolve) => {
      function next() {
        if (idx >= allFacilities.length && running === 0) return resolve();
        while (running < FACILITY_CONCURRENCY && idx < allFacilities.length) {
          const fac = allFacilities[idx++];
          running++;
          (async () => {
            try {
              const records = await fetchEffluentForFacility(
                fac.permitId, fac.name, fac.state, fac.lat, fac.lng,
              );
              if (records.length > 0) {
                const st = fac.state.toUpperCase();
                if (effluentByState[st]) {
                  effluentByState[st].records.push(...records);
                  totalRecords += records.length;
                }
              }
            } catch {
              // Skip failed facility
            } finally {
              running--;
              next();
            }
          })();
        }
      }
      next();
    });

    // When ECHO cache is empty (no SNC facilities), save empty effluent cache
    // with a valid timestamp so downstream consumers know the cron ran.
    if (sncFacilities.length === 0) {
      await setEchoEffluentCache(effluentByState);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[ECHO Effluent Cron] No SNC facilities in ECHO cache — saved empty cache in ${elapsed}s`);

      recordCronRun('rebuild-echo-effluent', 'success', Date.now() - startTime);

      return NextResponse.json({
        status: 'complete',
        duration: `${elapsed}s`,
        note: 'No SNC facilities in ECHO cache — saved empty effluent cache',
        sncFacilitiesQueried: 0,
        totalRecords: 0,
        cache: getEchoEffluentCacheStatus(),
      });
    }

    await setEchoEffluentCache(effluentByState);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const statesWithRecords = Object.keys(effluentByState).filter(k => effluentByState[k].records.length > 0).length;
    console.log(`[ECHO Effluent Cron] Complete in ${elapsed}s — ${totalRecords} records across ${statesWithRecords} states`);

    recordCronRun('rebuild-echo-effluent', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      sncFacilitiesQueried: sncFacilities.length,
      totalRecords,
      statesWithRecords,
      cache: getEchoEffluentCacheStatus(),
    });

  } catch (err: any) {
    console.error('[ECHO Effluent Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-echo-effluent' } });
    notifySlackCronFailure({ cronName: 'rebuild-echo-effluent', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-echo-effluent', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'ECHO Effluent build failed' },
      { status: 500 },
    );
  } finally {
    setEchoEffluentBuildInProgress(false);
  }
}
