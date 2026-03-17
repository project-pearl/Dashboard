// app/api/cron/rebuild-usdm/route.ts
// Cron endpoint — fetches US Drought Monitor state-level statistics.
// Fetches drought severity percentages for all US states via per-state
// FIPS queries against the USDM REST API.
// Schedule: daily via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setUsdmCache, getUsdmCacheStatus,
  isUsdmBuildInProgress, setUsdmBuildInProgress,
  type DroughtState,
} from '@/lib/usdmCache';
import { ALL_STATES_WITH_FIPS } from '@/lib/constants';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = 'https://usdmdataservices.unl.edu/api/StateStatistics/GetDroughtSeverityStatisticsByAreaPercent';
const FETCH_TIMEOUT_MS = 15_000;
const BATCH_SIZE = 8;
const DELAY_MS = 500;
const LOOKBACK_DAYS = 21; // USDM publishes weekly; 21 days ensures we catch the latest

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function parseNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/** Format Date as M/d/yyyy (API requirement, e.g. 3/17/2026) */
function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/** Fetch drought data for a single state by FIPS code. Returns the most recent entry. */
async function fetchStateData(
  stateAbbr: string,
  fips: string,
  startDate: string,
  endDate: string,
): Promise<DroughtState | null> {
  try {
    const url = `${BASE_URL}?aoi=${fips}&startdate=${startDate}&enddate=${endDate}&statisticsType=1`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PEARL-Platform/1.0',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[USDM Cron] ${stateAbbr} (FIPS ${fips}): HTTP ${res.status}`);
      return null;
    }

    const data: any[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    // Take the most recent entry (highest mapDate)
    const sorted = data.sort((a, b) =>
      new Date(b.mapDate).getTime() - new Date(a.mapDate).getTime(),
    );
    const row = sorted[0];

    return {
      state: (row.stateAbbreviation || stateAbbr).toUpperCase(),
      fips: fips.padStart(2, '0'),
      date: row.mapDate || row.validStart || endDate,
      none: parseNum(row.none),
      d0: parseNum(row.d0),
      d1: parseNum(row.d1),
      d2: parseNum(row.d2),
      d3: parseNum(row.d3),
      d4: parseNum(row.d4),
    };
  } catch (e) {
    console.warn(`[USDM Cron] ${stateAbbr} error: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isUsdmBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'USDM build already in progress',
      cache: getUsdmCacheStatus(),
    });
  }

  setUsdmBuildInProgress(true);
  const startTime = Date.now();

  try {
    const now = new Date();
    const lookback = new Date(now);
    lookback.setDate(lookback.getDate() - LOOKBACK_DAYS);

    const endDate = formatDate(now);
    const startDate = formatDate(lookback);

    console.log(`[USDM Cron] Fetching drought statistics for ${startDate} – ${endDate}...`);

    const states: Record<string, DroughtState> = {};
    const failedStates: string[] = [];

    // Fetch all states in parallel batches
    for (let i = 0; i < ALL_STATES_WITH_FIPS.length; i += BATCH_SIZE) {
      const batch = ALL_STATES_WITH_FIPS.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(([stateAbbr, fips]) => fetchStateData(stateAbbr, fips, startDate, endDate)),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const [stateAbbr] = batch[j];
        if (result.status === 'fulfilled' && result.value) {
          states[stateAbbr] = result.value;
        } else {
          failedStates.push(stateAbbr);
        }
      }

      // Delay between batches
      if (i + BATCH_SIZE < ALL_STATES_WITH_FIPS.length) {
        await delay(DELAY_MS);
      }
    }

    // Retry failed states once
    if (failedStates.length > 0) {
      console.log(`[USDM Cron] Retrying ${failedStates.length} failed states...`);
      await delay(3000);

      for (const stateAbbr of failedStates) {
        const fipsTuple = ALL_STATES_WITH_FIPS.find(([s]) => s === stateAbbr);
        if (!fipsTuple) continue;
        const [, fips] = fipsTuple;

        const result = await fetchStateData(stateAbbr, fips, startDate, endDate);
        if (result) {
          states[stateAbbr] = result;
          console.log(`[USDM Cron] ${stateAbbr} retry succeeded`);
        }
        await delay(500);
      }
    }

    const stateCount = Object.keys(states).length;

    // Empty-data guard
    if (stateCount === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[USDM Cron] 0 states in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getUsdmCacheStatus(),
      });
    }

    await setUsdmCache({
      _meta: {
        built: new Date().toISOString(),
        stateCount,
      },
      states,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[USDM Cron] Complete in ${elapsed}s — ${stateCount} states`);

    recordCronRun('rebuild-usdm', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      stateCount,
      cache: getUsdmCacheStatus(),
    });

  } catch (err: any) {
    console.error('[USDM Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-usdm' } });

    notifySlackCronFailure({ cronName: 'rebuild-usdm', error: err.message || 'build failed', duration: Date.now() - startTime });

    recordCronRun('rebuild-usdm', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'USDM build failed' },
      { status: 500 },
    );
  } finally {
    setUsdmBuildInProgress(false);
  }
}
