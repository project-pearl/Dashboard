// app/api/cron/rebuild-cdc-nwss/route.ts
// Cron endpoint — fetches CDC National Wastewater Surveillance System data from
// data.cdc.gov Socrata endpoint for priority states.
// Data includes pathogen surveillance at wastewater treatment plants.
// Schedule: daily via Vercel cron (1 PM UTC) or manual trigger.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setCdcNwssCache, getCdcNwssCacheStatus,
  isCdcNwssBuildInProgress, setCdcNwssBuildInProgress,
  type CdcNwssRecord,
} from '@/lib/cdcNwssCache';
import { PRIORITY_STATES } from '@/lib/constants';

// ── Config ───────────────────────────────────────────────────────────────────

const SOCRATA_BASE = 'https://data.cdc.gov/resource/2ew6-ywp6.json';
const PAGE_SIZE = 10000;
const MAX_PAGES = 20; // Safety cap: 200K records max per state
const DELAY_MS = 500;
const FETCH_TIMEOUT_MS = 30_000;

// ── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Fetch all recent NWSS records for a given state using Socrata pagination.
 * Gets last 90 days of data to capture seasonal trends.
 */
async function fetchStateRecords(state: string): Promise<CdcNwssRecord[]> {
  const records: CdcNwssRecord[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      '$where': `wwtp_jurisdiction='${state}' AND date_end >= '${cutoffStr}'`,
      '$limit': String(PAGE_SIZE),
      '$offset': String(offset),
      '$order': 'date_end DESC',
    });

    // Add app token if available (higher rate limits)
    const appToken = process.env.CDC_SOCRATA_APP_TOKEN;
    if (appToken) params.set('$$app_token', appToken);

    const url = `${SOCRATA_BASE}?${params.toString()}`;

    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        console.warn(`[CDC NWSS Cron] ${state} page ${page}: HTTP ${res.status}`);
        break;
      }

      const rows: any[] = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) break;

      for (const r of rows) {
        records.push({
          wwtpId: r.wwtp_id || '',
          wwtpJurisdiction: r.wwtp_jurisdiction || state,
          countyFips: r.county_fips || '',
          countyNames: r.county_names || '',
          populationServed: parseFloat(r.population_served) || 0,
          dateStart: r.date_start || '',
          dateEnd: r.date_end || '',
          ptc15d: r.ptc_15d != null ? parseFloat(r.ptc_15d) : null,
          detectProp15d: r.detect_prop_15d != null ? parseFloat(r.detect_prop_15d) : null,
          percentile: r.percentile != null ? parseFloat(r.percentile) : null,
        });
      }

      if (rows.length < PAGE_SIZE) break; // Last page
      offset += PAGE_SIZE;
      await delay(DELAY_MS);
    } catch (e) {
      console.warn(`[CDC NWSS Cron] ${state} page ${page}: ${e instanceof Error ? e.message : e}`);
      break;
    }
  }

  return records;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isCdcNwssBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'CDC NWSS build already in progress',
      cache: getCdcNwssCacheStatus(),
    });
  }

  setCdcNwssBuildInProgress(true);
  const startTime = Date.now();

  try {
    const states: Record<string, { records: CdcNwssRecord[]; counties: number; totalPopulationServed: number }> = {};
    let totalRecords = 0;
    const allCounties = new Set<string>();
    let totalPop = 0;
    const stateResults: string[] = [];
    const failedStates: string[] = [];

    // Fetch states in parallel batches of 4 to avoid rate limiting
    const BATCH_SIZE = 4;
    for (let i = 0; i < PRIORITY_STATES.length; i += BATCH_SIZE) {
      const batch = PRIORITY_STATES.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (state) => {
          console.log(`[CDC NWSS Cron] Fetching ${state}...`);
          const records = await fetchStateRecords(state);
          return { state, records };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { state, records } = result.value;
          if (records.length > 0) {
            const countySet = new Set<string>();
            let statePop = 0;

            // Deduplicate population by wwtp_id (same plant appears in multiple time periods)
            const wwtpPop = new Map<string, number>();
            for (const r of records) {
              countySet.add(r.countyFips);
              allCounties.add(r.countyFips);
              if (r.wwtpId && r.populationServed > 0) {
                wwtpPop.set(r.wwtpId, Math.max(wwtpPop.get(r.wwtpId) || 0, r.populationServed));
              }
            }
            for (const pop of wwtpPop.values()) statePop += pop;

            states[state] = {
              records,
              counties: countySet.size,
              totalPopulationServed: statePop,
            };
            totalRecords += records.length;
            totalPop += statePop;
            stateResults.push(`${state}:${records.length}`);
            console.log(`[CDC NWSS Cron] ${state}: ${records.length} records, ${countySet.size} counties`);
          } else {
            stateResults.push(`${state}:0`);
          }
        } else {
          const state = batch[results.indexOf(result)];
          console.error(`[CDC NWSS Cron] ${state} failed:`, result.reason);
          failedStates.push(state);
        }
      }

      // Delay between batches
      if (i + BATCH_SIZE < PRIORITY_STATES.length) {
        await delay(1000);
      }
    }

    // Retry failed states once with longer timeout
    if (failedStates.length > 0) {
      console.log(`[CDC NWSS Cron] Retrying ${failedStates.length} failed states...`);
      await delay(5000);

      for (const state of failedStates) {
        try {
          const records = await fetchStateRecords(state);
          if (records.length > 0) {
            const countySet = new Set<string>();
            const wwtpPop = new Map<string, number>();
            for (const r of records) {
              countySet.add(r.countyFips);
              allCounties.add(r.countyFips);
              if (r.wwtpId && r.populationServed > 0) {
                wwtpPop.set(r.wwtpId, Math.max(wwtpPop.get(r.wwtpId) || 0, r.populationServed));
              }
            }
            let statePop = 0;
            for (const pop of wwtpPop.values()) statePop += pop;

            states[state] = {
              records,
              counties: countySet.size,
              totalPopulationServed: statePop,
            };
            totalRecords += records.length;
            totalPop += statePop;
            console.log(`[CDC NWSS Cron] ${state} retry succeeded: ${records.length} records`);
          }
        } catch (e) {
          console.error(`[CDC NWSS Cron] ${state} retry failed:`, e);
        }
        await delay(1000);
      }
    }

    // Build cache
    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        recordCount: totalRecords,
        stateCount: Object.keys(states).length,
        countyCount: allCounties.size,
        totalPopulationServed: totalPop,
      },
      states,
    };

    if (totalRecords === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[CDC NWSS Cron] 0 records in ${elapsed}s — skipping cache save`);
      return NextResponse.json({ status: 'empty', duration: `${elapsed}s`, cache: getCdcNwssCacheStatus() });
    }

    await setCdcNwssCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[CDC NWSS Cron] Build complete in ${elapsed}s — ` +
      `${totalRecords} records, ${Object.keys(states).length} states, ${allCounties.size} counties`
    );

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      records: totalRecords,
      states: Object.keys(states).length,
      counties: allCounties.size,
      populationServed: totalPop,
      stateBreakdown: stateResults,
      cache: getCdcNwssCacheStatus(),
    });

  } catch (err: any) {
    console.error('[CDC NWSS Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'CDC NWSS build failed' },
      { status: 500 },
    );
  } finally {
    setCdcNwssBuildInProgress(false);
  }
}
