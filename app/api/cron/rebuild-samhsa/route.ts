// app/api/cron/rebuild-samhsa/route.ts
// Cron endpoint — fetches SAMHSA treatment facility data from the Treatment
// Locator API, processes records, builds the cache with spatial index and
// summary statistics.
// Schedule: daily at 4:00 AM UTC.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setSAMHSACache,
  getSAMHSACacheStatus,
  isBuildInProgress,
  setBuildInProgress,
  processSAMHSAData,
  buildSAMHSACacheData,
} from '@/lib/samhsaCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const SAMHSA_API = 'https://findtreatment.gov/locator/listing';
const FETCH_TIMEOUT_MS = 30_000;
const CONCURRENCY = 4;

/** US states to query individually */
const STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
  'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
  'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchStateData(stateName: string): Promise<any[]> {
  try {
    const params = new URLSearchParams({
      sType: 'SA',
      sAddr: stateName,
    });

    const res = await fetch(`${SAMHSA_API}?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      console.warn(`[SAMHSA Cron] ${stateName}: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    // The API may return results under various keys
    const items = data?.rows || data?.results || data?.listings || data?.data || [];
    if (!Array.isArray(items)) {
      console.warn(`[SAMHSA Cron] ${stateName}: unexpected response shape`);
      return [];
    }
    return items;
  } catch (e: any) {
    console.warn(`[SAMHSA Cron] ${stateName}: ${e.message}`);
    return [];
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'SAMHSA build already in progress',
      cache: getSAMHSACacheStatus(),
    });
  }

  setBuildInProgress(true);
  const startTime = Date.now();

  try {
    // ── Fetch state-by-state with concurrency limit ──────────────────
    const allRaw: any[] = [];
    const queue = [...STATES];
    let idx = 0;
    let running = 0;
    let statesFetched = 0;

    await new Promise<void>((resolve) => {
      function next() {
        if (idx >= queue.length && running === 0) return resolve();
        while (running < CONCURRENCY && idx < queue.length) {
          const st = queue[idx++];
          running++;
          (async () => {
            try {
              const items = await fetchStateData(st);
              if (items.length > 0) {
                allRaw.push(...items);
                statesFetched++;
                console.log(`[SAMHSA Cron] ${st}: ${items.length} facilities`);
              }
            } catch {
              // skip on failure
            } finally {
              running--;
              next();
            }
          })();
        }
      }
      next();
    });

    console.log(`[SAMHSA Cron] Fetched ${allRaw.length} raw records from ${statesFetched} states`);

    // ── Empty-data guard ─────────────────────────────────────────────
    if (allRaw.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[SAMHSA Cron] No facilities returned in ${elapsed}s — skipping cache save`);
      recordCronRun('rebuild-samhsa', 'success', Date.now() - startTime);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getSAMHSACacheStatus(),
      });
    }

    // ── Process and build cache ──────────────────────────────────────
    const processed = processSAMHSAData(allRaw);
    console.log(`[SAMHSA Cron] Processed ${processed.length} records`);

    const cacheData = await buildSAMHSACacheData(processed);
    await setSAMHSACache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SAMHSA Cron] Complete in ${elapsed}s — ${processed.length} facilities across ${statesFetched} states`);

    recordCronRun('rebuild-samhsa', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      totalFacilities: processed.length,
      statesFetched,
      militaryFriendly: cacheData.summary.militaryFriendlyFacilities,
      veteranSpecialized: cacheData.summary.veteranSpecializedFacilities,
      cache: getSAMHSACacheStatus(),
    });

  } catch (err: any) {
    console.error('[SAMHSA Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-samhsa' } });

    notifySlackCronFailure({ cronName: 'rebuild-samhsa', error: err.message || 'build failed', duration: Date.now() - startTime });

    recordCronRun('rebuild-samhsa', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'SAMHSA build failed' },
      { status: 500 },
    );
  } finally {
    setBuildInProgress(false);
  }
}
