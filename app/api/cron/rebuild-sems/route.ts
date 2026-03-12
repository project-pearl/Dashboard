// app/api/cron/rebuild-sems/route.ts
// Cron endpoint — fetches EPA SEMS full Superfund inventory per state via ECHO.
// Uses ECHO 3-step query pattern with p_prgm=SF filter.
// Schedule: weekly on Sunday at 11:30 PM UTC.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setSemsCache, getSemsCacheStatus,
  isSemsBuildInProgress, setSemsBuildInProgress,
  type SemsSite,
} from '@/lib/semsCache';
import { ALL_STATES } from '@/lib/constants';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const ECHO_BASE = 'https://echodata.epa.gov/echo/cwa_rest_services';
const FETCH_TIMEOUT_MS = 30_000;
const STATE_CONCURRENCY = 5;
const PAGE_SIZE = 1000;

// ── ECHO 3-Step Query (Superfund-filtered) ──────────────────────────────────

async function fetchSemsForState(stateAbbr: string): Promise<SemsSite[]> {
  // Step 1: Get QueryID with Superfund program filter
  const step1Params = new URLSearchParams({
    p_st: stateAbbr,
    p_prgm: 'SF',          // Superfund program filter
    output: 'JSON',
  });

  const step1Res = await fetch(`${ECHO_BASE}.get_facilities?${step1Params}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: 'application/json' },
  });

  if (!step1Res.ok) {
    console.warn(`[SEMS Cron] ${stateAbbr} step1: HTTP ${step1Res.status}`);
    return [];
  }

  const step1Data = await step1Res.json();
  const qid = step1Data?.Results?.QueryID || step1Data?.QueryID;
  const totalRows = parseInt(step1Data?.Results?.QueryRows || step1Data?.QueryRows || '0', 10);

  if (!qid || totalRows === 0) return [];

  // Step 3: Get paginated results
  const sites: SemsSite[] = [];
  let page = 1;

  while (sites.length < totalRows) {
    const step3Params = new URLSearchParams({
      qid: qid.toString(),
      output: 'JSON',
      responseset: PAGE_SIZE.toString(),
      pageno: page.toString(),
    });

    const step3Res = await fetch(`${ECHO_BASE}.get_results?${step3Params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });

    if (!step3Res.ok) break;

    const step3Data = await step3Res.json();
    const rows = step3Data?.Results?.Facilities || step3Data?.Facilities || [];

    if (rows.length === 0) break;

    for (const row of rows) {
      const nplStatus = row.NPLStatus || row.CurrSiteStatus || '';
      sites.push({
        siteId: row.RegistryId || row.EPAId || '',
        siteName: row.FacName || row.FacilityName || '',
        state: stateAbbr,
        county: row.County || '',
        lat: row.Lat ? parseFloat(row.Lat) : null,
        lng: row.Lon ? parseFloat(row.Lon) : null,
        nplStatus,
        siteType: row.FederalFacility === 'Y' ? 'Federal facility' : 'Non-federal',
        removalAction: row.RemovalAction === 'Y' || false,
        remedialAction: row.RemedialAction === 'Y' || false,
        constructionComplete: row.ConstructionComplete === 'Y' || false,
        fiveYearReview: row.FiveYearReview === 'Y' || false,
      });
    }

    page++;
    if (page > 50) break;
  }

  return sites;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isSemsBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'SEMS build already in progress',
      cache: getSemsCacheStatus(),
    });
  }

  setSemsBuildInProgress(true);
  const startTime = Date.now();

  try {
    const sitesByState: Record<string, { sites: SemsSite[]; fetched: string }> = {};
    const now = new Date().toISOString();
    let totalSites = 0;
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
              const sites = await fetchSemsForState(st);
              sitesByState[st] = { sites, fetched: now };
              if (sites.length > 0) {
                totalSites += sites.length;
                statesFetched++;
                console.log(`[SEMS Cron] ${st}: ${sites.length} sites`);
              }
            } catch (e: any) {
              console.warn(`[SEMS Cron] ${st}: ${e.message}`);
              sitesByState[st] = { sites: [], fetched: now };
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
    if (totalSites === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[SEMS Cron] No sites found in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getSemsCacheStatus(),
      });
    }

    await setSemsCache(sitesByState);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SEMS Cron] Complete in ${elapsed}s — ${totalSites} sites across ${statesFetched} states`);

    recordCronRun('rebuild-sems', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      totalSites,
      statesFetched,
      cache: getSemsCacheStatus(),
    });

  } catch (err: any) {
    console.error('[SEMS Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-sems' } });
    notifySlackCronFailure({ cronName: 'rebuild-sems', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-sems', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'SEMS build failed' },
      { status: 500 },
    );
  } finally {
    setSemsBuildInProgress(false);
  }
}
