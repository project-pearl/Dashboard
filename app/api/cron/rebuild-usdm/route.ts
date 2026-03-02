// app/api/cron/rebuild-usdm/route.ts
// Cron endpoint — fetches US Drought Monitor state-level statistics.
// Fetches drought severity percentages for all US states.
// Schedule: daily via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setUsdmCache, getUsdmCacheStatus,
  isUsdmBuildInProgress, setUsdmBuildInProgress,
  type DroughtState,
} from '@/lib/usdmCache';

// ── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = 'https://usdmdataservices.unl.edu/api/StateStatistics/GetDroughtSeverityStatisticsByAreaPercent';
const FETCH_TIMEOUT_MS = 30_000;

function parseNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
    // Fetch state statistics for today
    const today = formatDate(new Date());
    const url = `${BASE_URL}?aoi=state&startdate=${today}&enddate=${today}&statisticsType=1`;
    console.log(`[USDM Cron] Fetching drought statistics for ${today}...`);

    const res = await fetch(url, {
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`USDM API: HTTP ${res.status}`);
    const rawData: any[] = await res.json();

    console.log(`[USDM Cron] Received ${rawData.length} state records`);

    // Build state map
    const states: Record<string, DroughtState> = {};
    for (const row of rawData) {
      const stateCode = (row.State || '').toUpperCase().trim();
      if (!stateCode) continue;

      states[stateCode] = {
        state: stateCode,
        fips: String(row.FIPS || '').padStart(2, '0'),
        date: row.MapDate || row.ValidStart || today,
        none: parseNum(row.None),
        d0: parseNum(row.D0),
        d1: parseNum(row.D1),
        d2: parseNum(row.D2),
        d3: parseNum(row.D3),
        d4: parseNum(row.D4),
      };
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

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      stateCount,
      cache: getUsdmCacheStatus(),
    });

  } catch (err: any) {
    console.error('[USDM Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'USDM build failed' },
      { status: 500 },
    );
  } finally {
    setUsdmBuildInProgress(false);
  }
}
