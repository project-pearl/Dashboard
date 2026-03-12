// app/api/cron/rebuild-hrsa-hpsa/route.ts
// Cron endpoint — fetches HRSA Health Professional Shortage Area (HPSA)
// designations from data.hrsa.gov Socrata endpoint for all US states.
// Schedule: daily via Vercel cron (1:30 PM UTC) or manual trigger.

export const maxDuration = 240;

import { NextRequest, NextResponse } from 'next/server';
import {
  setHpsaCache, getHpsaCacheStatus,
  isHpsaBuildInProgress, setHpsaBuildInProgress,
  type HpsaDesignation, type HpsaTypeCode,
} from '@/lib/hrsaHpsaCache';
import { ALL_STATES } from '@/lib/constants';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const SOCRATA_BASE = 'https://data.hrsa.gov/resource/7tbf-v2pp.json';
const PAGE_SIZE = 5000;
const MAX_PAGES = 10; // Safety cap
const DELAY_MS = 500;
const FETCH_TIMEOUT_MS = 30_000;
const BATCH_SIZE = 8;

// ── State FIPS mapping for HRSA state filtering ─────────────────────────────

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida',
  GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin',
  WY: 'Wyoming',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function mapHpsaType(raw: string): HpsaTypeCode {
  const upper = (raw || '').toUpperCase();
  if (upper.includes('DENTAL') || upper === 'DH') return 'DH';
  if (upper.includes('MENTAL') || upper === 'MH') return 'MH';
  return 'PC'; // Primary Care is default
}

/**
 * Fetch HPSA designations for a given state via Socrata API with pagination.
 */
async function fetchStateDesignations(stateAbbr: string): Promise<HpsaDesignation[]> {
  const stateName = STATE_NAMES[stateAbbr];
  if (!stateName) return [];

  const designations: HpsaDesignation[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      '$where': `common_state_name='${stateName}' AND hpsa_status='Designated'`,
      '$limit': String(PAGE_SIZE),
      '$offset': String(offset),
      '$order': 'hpsa_score DESC',
    });

    const appToken = process.env.HRSA_SOCRATA_APP_TOKEN || process.env.CDC_SOCRATA_APP_TOKEN;
    if (appToken) params.set('$$app_token', appToken);

    const url = `${SOCRATA_BASE}?${params.toString()}`;

    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        console.warn(`[HRSA HPSA Cron] ${stateAbbr} page ${page}: HTTP ${res.status}`);
        break;
      }

      const rows: any[] = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) break;

      for (const r of rows) {
        const score = parseInt(r.hpsa_score) || 0;
        designations.push({
          hpsaId: r.source_id || r.hpsa_source_id || `HPSA-${stateAbbr}-${designations.length}`,
          hpsaName: r.hpsa_name || r.hpsa_formal_name || 'Unknown',
          hpsaTypeCode: mapHpsaType(r.hpsa_type_description || r.hpsa_type_code || ''),
          state: stateAbbr,
          countyFips: r.common_county_fips_code || r.hpsa_county_fips_code || '',
          countyName: r.common_county_name || r.county_equivalent_name || '',
          lat: r.latitude ? parseFloat(r.latitude) : null,
          lng: r.longitude ? parseFloat(r.longitude) : null,
          hpsaScore: score,
          designationDate: r.hpsa_designation_date || '',
          statusCode: r.hpsa_status || 'Designated',
          populationServed: parseInt(r.hpsa_designation_population) || 0,
          providerRatio: r.provider_ratio ? parseFloat(r.provider_ratio) : null,
          percentBelowPoverty: r.percent_of_population_below_100_percent_of_federal_poverty_level
            ? parseFloat(r.percent_of_population_below_100_percent_of_federal_poverty_level)
            : null,
          ruralStatus: (r.rural_status || '').toLowerCase().includes('rural') ||
            (r.metropolitan_indicator || '').toLowerCase().includes('non-metro'),
        });
      }

      if (rows.length < PAGE_SIZE) break; // Last page
      offset += PAGE_SIZE;
      await delay(DELAY_MS);
    } catch (e) {
      console.warn(
        `[HRSA HPSA Cron] ${stateAbbr} page ${page}: ${e instanceof Error ? e.message : e}`
      );
      break;
    }
  }

  return designations;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isHpsaBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'HRSA HPSA build already in progress',
      cache: getHpsaCacheStatus(),
    });
  }

  setHpsaBuildInProgress(true);
  const startTime = Date.now();

  try {
    const states: Record<string, {
      designations: HpsaDesignation[];
      totalPopulationServed: number;
      highSeverityCount: number;
    }> = {};
    let totalDesignations = 0;
    let highSeverityTotal = 0;
    let ruralCount = 0;
    const byType: Record<HpsaTypeCode, number> = { PC: 0, DH: 0, MH: 0 };
    const stateResults: string[] = [];
    const failedStates: string[] = [];

    // Fetch states in parallel batches
    for (let i = 0; i < ALL_STATES.length; i += BATCH_SIZE) {
      const batch = ALL_STATES.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (state) => {
          console.log(`[HRSA HPSA Cron] Fetching ${state}...`);
          const designations = await fetchStateDesignations(state);
          return { state, designations };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { state, designations } = result.value;
          if (designations.length > 0) {
            const highSev = designations.filter(d => d.hpsaScore >= 18).length;
            const popServed = designations.reduce((s, d) => s + d.populationServed, 0);
            const rural = designations.filter(d => d.ruralStatus).length;

            states[state] = {
              designations,
              totalPopulationServed: popServed,
              highSeverityCount: highSev,
            };

            totalDesignations += designations.length;
            highSeverityTotal += highSev;
            ruralCount += rural;
            for (const d of designations) byType[d.hpsaTypeCode]++;

            stateResults.push(`${state}:${designations.length}`);
            console.log(`[HRSA HPSA Cron] ${state}: ${designations.length} HPSAs, ${highSev} high-severity`);
          } else {
            stateResults.push(`${state}:0`);
          }
        } else {
          const state = batch[results.indexOf(result)];
          console.error(`[HRSA HPSA Cron] ${state} failed:`, result.reason);
          failedStates.push(state);
        }
      }

      // Delay between batches
      if (i + BATCH_SIZE < ALL_STATES.length) {
        await delay(1000);
      }
    }

    // Retry failed states once with longer delay
    if (failedStates.length > 0) {
      console.log(`[HRSA HPSA Cron] Retrying ${failedStates.length} failed states...`);
      await delay(5000);

      for (const state of failedStates) {
        try {
          const designations = await fetchStateDesignations(state);
          if (designations.length > 0) {
            const highSev = designations.filter(d => d.hpsaScore >= 18).length;
            const popServed = designations.reduce((s, d) => s + d.populationServed, 0);
            const rural = designations.filter(d => d.ruralStatus).length;

            states[state] = {
              designations,
              totalPopulationServed: popServed,
              highSeverityCount: highSev,
            };
            totalDesignations += designations.length;
            highSeverityTotal += highSev;
            ruralCount += rural;
            for (const d of designations) byType[d.hpsaTypeCode]++;

            console.log(`[HRSA HPSA Cron] ${state} retry succeeded: ${designations.length} HPSAs`);
          }
        } catch (e) {
          console.error(`[HRSA HPSA Cron] ${state} retry failed:`, e);
        }
        await delay(1000);
      }
    }

    // Empty-data guard
    if (totalDesignations === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[HRSA HPSA Cron] 0 designations in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getHpsaCacheStatus(),
      });
    }

    // Build cache
    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        totalDesignations,
        stateCount: Object.keys(states).length,
        highSeverityTotal,
        ruralCount,
        byType,
      },
      states,
    };

    await setHpsaCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[HRSA HPSA Cron] Build complete in ${elapsed}s — ` +
      `${totalDesignations} designations, ${Object.keys(states).length} states`
    );

    recordCronRun('rebuild-hrsa-hpsa', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      totalDesignations,
      states: Object.keys(states).length,
      highSeverityTotal,
      ruralCount,
      byType,
      stateBreakdown: stateResults,
      cache: getHpsaCacheStatus(),
    });
  } catch (err: any) {
    console.error('[HRSA HPSA Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-hrsa-hpsa' } });
    notifySlackCronFailure({
      cronName: 'rebuild-hrsa-hpsa',
      error: err.message || 'build failed',
      duration: Date.now() - startTime,
    });
    recordCronRun('rebuild-hrsa-hpsa', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'HRSA HPSA build failed' },
      { status: 500 },
    );
  } finally {
    setHpsaBuildInProgress(false);
  }
}
