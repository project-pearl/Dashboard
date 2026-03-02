// app/api/cron/rebuild-ncei/route.ts
// Cron endpoint — fetches NOAA NCEI Climate at a Glance state-level precipitation data.
// Iterates all US states (by FIPS), fetches most recent month's precipitation + anomaly.
// Schedule: daily via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setNceiCache, getNceiCacheStatus,
  isNceiBuildInProgress, setNceiBuildInProgress,
  type NceiStateClimate,
} from '@/lib/nceiCache';
import { ALL_STATES_WITH_FIPS } from '@/lib/constants';

// ── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = 'https://www.ncei.noaa.gov/cag/statewide/time-series';
const FETCH_TIMEOUT_MS = 30_000;
const CONCURRENCY = 5;
const DELAY_MS = 500;

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === '' || v === -99 || v === '-99') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isNceiBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'NCEI build already in progress',
      cache: getNceiCacheStatus(),
    });
  }

  setNceiBuildInProgress(true);
  const startTime = Date.now();

  try {
    const now = new Date();
    const latestMonth = now.getMonth() + 1; // 1-12
    const latestYear = now.getFullYear();

    const states: Record<string, NceiStateClimate> = {};
    let fetchErrors = 0;

    for (let i = 0; i < ALL_STATES_WITH_FIPS.length; i += CONCURRENCY) {
      const batch = ALL_STATES_WITH_FIPS.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async ([st, fips]) => {
          try {
            // State FIPS number (strip leading zero for the URL parameter)
            const stateNum = parseInt(fips, 10);
            const url = `${BASE_URL}/${stateNum}/pcp/1/${latestMonth}/${latestYear}?base_prd=true&begbaseyear=1991&endbaseyear=2020`;

            const res = await fetch(url, {
              headers: { 'User-Agent': 'PEARL-Platform/1.0', 'Accept': 'application/json' },
              signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });

            if (!res.ok) {
              console.warn(`[NCEI Cron] ${st}: HTTP ${res.status}`);
              fetchErrors++;
              return null;
            }

            const json = await res.json();
            const dataObj = json?.data || {};

            // Get the last entry in the data object (most recent period)
            const keys = Object.keys(dataObj).sort();
            if (keys.length === 0) {
              console.warn(`[NCEI Cron] ${st}: no data entries`);
              return null;
            }

            const lastKey = keys[keys.length - 1];
            const lastEntry = dataObj[lastKey];

            // Parse period from the key (format: "YYYYMM" or similar)
            let period = lastKey;
            if (lastKey.length === 6) {
              period = `${lastKey.slice(0, 4)}-${lastKey.slice(4, 6)}`;
            }

            const value = parseNum(lastEntry?.value);
            const anomaly = parseNum(lastEntry?.anomaly);

            // Calculate normal: value - anomaly = normal
            let normal: number | null = null;
            if (value !== null && anomaly !== null) {
              normal = Math.round((value - anomaly) * 100) / 100;
            }

            return {
              state: st,
              fips,
              recentPrecip: value,
              precipAnomaly: anomaly,
              precipNormal: normal,
              period,
            } as NceiStateClimate;
          } catch (err) {
            console.warn(`[NCEI Cron] ${st}: fetch error`, err);
            fetchErrors++;
            return null;
          }
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          states[r.value.state] = r.value;
        }
      }

      if (i + CONCURRENCY < ALL_STATES_WITH_FIPS.length) await delay(DELAY_MS);
    }

    const stateCount = Object.keys(states).length;

    // Empty-data guard
    if (stateCount === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[NCEI Cron] 0 states in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getNceiCacheStatus(),
      });
    }

    await setNceiCache({
      _meta: {
        built: new Date().toISOString(),
        stateCount,
      },
      states,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[NCEI Cron] Complete in ${elapsed}s — ${stateCount} states, ${fetchErrors} errors`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      stateCount,
      fetchErrors,
      cache: getNceiCacheStatus(),
    });

  } catch (err: any) {
    console.error('[NCEI Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'NCEI build failed' },
      { status: 500 },
    );
  } finally {
    setNceiBuildInProgress(false);
  }
}
