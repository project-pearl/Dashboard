// app/api/cron/rebuild-rcra/route.ts
// Cron endpoint — fetches EPA ECHO RCRA hazardous waste facilities per state.
// Uses ECHO 3-step query pattern: get_facilities → get_qid → get_results.
// Schedule: weekly on Sunday at 11:00 PM UTC.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setRcraCache, getRcraCacheStatus,
  isRcraBuildInProgress, setRcraBuildInProgress,
  type RcraFacility,
} from '@/lib/rcraCache';
import { ALL_STATES } from '@/lib/constants';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const RCRA_BASE = 'https://echodata.epa.gov/echo/rcra_rest_services';
const FETCH_TIMEOUT_MS = 30_000;
const STATE_CONCURRENCY = 5;
const PAGE_SIZE = 1000;

// ── ECHO 3-Step Query ───────────────────────────────────────────────────────

async function fetchRcraForState(stateAbbr: string): Promise<RcraFacility[]> {
  // Step 1: Get QueryID
  const step1Params = new URLSearchParams({
    p_st: stateAbbr,
    p_act: 'Y',           // Active facilities only
    output: 'JSON',
  });

  const step1Res = await fetch(`${RCRA_BASE}.get_facilities?${step1Params}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: 'application/json' },
  });

  if (!step1Res.ok) {
    console.warn(`[RCRA Cron] ${stateAbbr} step1: HTTP ${step1Res.status}`);
    return [];
  }

  const step1Data = await step1Res.json();
  const qid = step1Data?.Results?.QueryID || step1Data?.QueryID;
  const totalRows = parseInt(step1Data?.Results?.QueryRows || step1Data?.QueryRows || '0', 10);

  if (!qid || totalRows === 0) return [];

  // Step 2: Verify QID (optional but follows pattern)
  // Step 3: Get paginated results
  const facilities: RcraFacility[] = [];
  let page = 1;

  while (facilities.length < totalRows) {
    const step3Params = new URLSearchParams({
      qid: qid.toString(),
      output: 'JSON',
      responseset: PAGE_SIZE.toString(),
      pageno: page.toString(),
    });

    const step3Res = await fetch(`${RCRA_BASE}.get_results?${step3Params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });

    if (!step3Res.ok) break;

    const step3Data = await step3Res.json();
    const rows = step3Data?.Results?.Facilities || step3Data?.Facilities || [];

    if (rows.length === 0) break;

    for (const row of rows) {
      facilities.push({
        registryId: row.RegistryId || row.RCRAId || '',
        facilityName: row.FacName || row.FacilityName || '',
        state: stateAbbr,
        county: row.County || '',
        lat: row.Lat ? parseFloat(row.Lat) : null,
        lng: row.Lon ? parseFloat(row.Lon) : null,
        facilityTypeCode: row.RCRAClass || row.FacilityTypeCode || '',
        sncFlag: row.RCRASNCFlag === 'Y' || row.SNCFlag === 'Y',
        lastInspectionDate: row.RCRALastInspDate || row.LastInspectionDate || null,
        violationCount: parseInt(row.RCRAViolCount || row.ViolationCount || '0', 10) || 0,
        penaltyAmount: parseFloat(row.RCRAPenalties || row.PenaltyAmount || '0') || 0,
      });
    }

    page++;
    // Safety: prevent infinite loops
    if (page > 50) break;
  }

  return facilities;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isRcraBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'RCRA build already in progress',
      cache: getRcraCacheStatus(),
    });
  }

  setRcraBuildInProgress(true);
  const startTime = Date.now();

  try {
    const facilitiesByState: Record<string, { facilities: RcraFacility[]; fetched: string }> = {};
    const now = new Date().toISOString();
    let totalFacilities = 0;
    let statesFetched = 0;

    // Concurrency-limited state fetch
    const queue = [...ALL_STATES];
    let idx = 0;
    let running = 0;

    await new Promise<void>((resolve) => {
      function next() {
        if (idx >= queue.length && running === 0) return resolve();
        while (running < STATE_CONCURRENCY && idx < queue.length) {
          const st = queue[idx++];
          running++;
          (async () => {
            try {
              const facilities = await fetchRcraForState(st);
              facilitiesByState[st] = { facilities, fetched: now };
              if (facilities.length > 0) {
                totalFacilities += facilities.length;
                statesFetched++;
                console.log(`[RCRA Cron] ${st}: ${facilities.length} facilities`);
              }
            } catch (e: any) {
              console.warn(`[RCRA Cron] ${st}: ${e.message}`);
              facilitiesByState[st] = { facilities: [], fetched: now };
            } finally {
              running--;
              next();
            }
          })();
        }
      }
      next();
    });

    // Empty-data guard
    if (totalFacilities === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[RCRA Cron] No facilities found in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getRcraCacheStatus(),
      });
    }

    await setRcraCache(facilitiesByState);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[RCRA Cron] Complete in ${elapsed}s — ${totalFacilities} facilities across ${statesFetched} states`);

    recordCronRun('rebuild-rcra', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      totalFacilities,
      statesFetched,
      cache: getRcraCacheStatus(),
    });

  } catch (err: any) {
    console.error('[RCRA Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-rcra' } });
    notifySlackCronFailure({ cronName: 'rebuild-rcra', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-rcra', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'RCRA build failed' },
      { status: 500 },
    );
  } finally {
    setRcraBuildInProgress(false);
  }
}
