// app/api/cron/rebuild-usaspending/route.ts
// Cron endpoint — fetches federal water spending data from USAspending.gov API.
// Queries by CFDA program number for EPA water programs, builds state-level aggregates.
// Schedule: weekly Sunday 7 PM UTC via Vercel cron or manual trigger.

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ALL_STATES_WITH_FIPS } from '@/lib/constants';
import {
  setUSAsCache, getUSAsCacheStatus,
  isUSAsBuildInProgress, setUSAsBuildInProgress,
  type USAsProgramData, type USAsStateData, type USAsCacheData,
} from '@/lib/usaSpendingCache';

// ── Config ───────────────────────────────────────────────────────────────────

const USAS_API = 'https://api.usaspending.gov/api/v2';
const FETCH_TIMEOUT_MS = 30_000;
const DELAY_MS = 200;

// EPA Water program CFDAs
const WATER_CFDAS: Array<{ cfda: string; name: string; shortName: string }> = [
  { cfda: '66.458', name: 'Clean Water State Revolving Fund', shortName: 'CWSRF' },
  { cfda: '66.468', name: 'Drinking Water State Revolving Fund', shortName: 'DWSRF' },
  { cfda: '66.202', name: 'Congressionally Mandated Projects (CWA 106)', shortName: 'CWA 106' },
  { cfda: '66.480', name: 'Watershed Protection (CWA 319)', shortName: 'CWA 319' },
  { cfda: '66.474', name: 'Water Protection Grants', shortName: 'Water Protection' },
];

// BIL/IIJA def_codes
const BIL_DEF_CODES = ['Z', '1'];

// Priority states for top-recipient detail (full list gets totals only)
const PRIORITY_STATES_SET = new Set([
  'MD', 'VA', 'DC', 'PA', 'DE', 'FL', 'WV', 'CA', 'TX', 'NY',
  'NJ', 'OH', 'NC', 'MA', 'GA', 'IL', 'MI', 'WA', 'OR',
]);

// FIPS → state abbr reverse map
const FIPS_TO_STATE = new Map<string, string>();
for (const [abbr, fips] of ALL_STATES_WITH_FIPS) {
  FIPS_TO_STATE.set(fips, abbr);
}

// FY date ranges (FY21 = Oct 2020 – Sep 2021, etc.)
function fyDateRange(fy: number): { start: string; end: string } {
  return {
    start: `${fy - 1}-10-01`,
    end: `${fy}-09-30`,
  };
}

// Current completed FY: if we're past Sep 30, current FY is complete; otherwise last FY
function currentCompletedFY(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  return month >= 10 ? year : year - 1;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function usasPost(endpoint: string, body: Record<string, any>): Promise<any> {
  const res = await fetch(`${USAS_API}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`USAs API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Phase 1: CFDA totals by state (spending_by_geography) ────────────────────

interface StateTotal {
  fips: string;
  amount: number;
  awardCount: number;
}

async function fetchCfdaByState(cfda: string, fyStart: number, fyEnd: number): Promise<StateTotal[]> {
  const { start } = fyDateRange(fyStart);
  const { end } = fyDateRange(fyEnd);

  const body = {
    scope: 'place_of_performance',
    geo_layer: 'state',
    filters: {
      time_period: [{ start_date: start, end_date: end }],
      award_type_codes: ['02', '03', '04', '05'], // grants
      program_numbers: [cfda],
    },
  };

  const data = await usasPost('/search/spending_by_geography/', body);
  const results: StateTotal[] = [];

  for (const r of data?.results || []) {
    const fips = r.shape_code || r.code || '';
    if (fips && r.aggregated_amount != null) {
      results.push({
        fips,
        amount: r.aggregated_amount || 0,
        awardCount: r.per_capita ? 1 : (r.award_count || 1),
      });
    }
  }
  return results;
}

// ── Phase 2: BIL totals by state ─────────────────────────────────────────────

async function fetchBilByState(fyStart: number, fyEnd: number): Promise<Map<string, number>> {
  const { start } = fyDateRange(fyStart);
  const { end } = fyDateRange(fyEnd);

  const allWaterCfdas = WATER_CFDAS.map(c => c.cfda);

  const body = {
    scope: 'place_of_performance',
    geo_layer: 'state',
    filters: {
      time_period: [{ start_date: start, end_date: end }],
      award_type_codes: ['02', '03', '04', '05'],
      program_numbers: allWaterCfdas,
      def_codes: BIL_DEF_CODES,
    },
  };

  const data = await usasPost('/search/spending_by_geography/', body);
  const map = new Map<string, number>();

  for (const r of data?.results || []) {
    const fips = r.shape_code || r.code || '';
    if (fips && r.aggregated_amount) {
      map.set(fips, (map.get(fips) || 0) + r.aggregated_amount);
    }
  }
  return map;
}

// ── Phase 3: FY trend (national) ─────────────────────────────────────────────

interface FyTrendEntry {
  fy: number;
  byCfda: Record<string, number>;
  bil: number;
}

async function fetchFyTrend(fyStart: number, fyEnd: number): Promise<FyTrendEntry[]> {
  const entries: FyTrendEntry[] = [];

  for (let fy = fyStart; fy <= fyEnd; fy++) {
    const { start, end } = fyDateRange(fy);
    const byCfda: Record<string, number> = {};

    for (const c of WATER_CFDAS) {
      try {
        const body = {
          scope: 'place_of_performance',
          geo_layer: 'state',
          filters: {
            time_period: [{ start_date: start, end_date: end }],
            award_type_codes: ['02', '03', '04', '05'],
            program_numbers: [c.cfda],
          },
        };
        const data = await usasPost('/search/spending_by_geography/', body);
        const total = (data?.results || []).reduce(
          (sum: number, r: any) => sum + (r.aggregated_amount || 0), 0
        );
        byCfda[c.cfda] = total;
        await delay(DELAY_MS);
      } catch (e) {
        console.warn(`[USAs Cron] FY${fy} ${c.cfda} trend fetch failed:`, e instanceof Error ? e.message : e);
        byCfda[c.cfda] = 0;
      }
    }

    // BIL total for this FY
    let bil = 0;
    try {
      const bilBody = {
        scope: 'place_of_performance',
        geo_layer: 'state',
        filters: {
          time_period: [{ start_date: start, end_date: end }],
          award_type_codes: ['02', '03', '04', '05'],
          program_numbers: WATER_CFDAS.map(c => c.cfda),
          def_codes: BIL_DEF_CODES,
        },
      };
      const bilData = await usasPost('/search/spending_by_geography/', bilBody);
      bil = (bilData?.results || []).reduce(
        (sum: number, r: any) => sum + (r.aggregated_amount || 0), 0
      );
      await delay(DELAY_MS);
    } catch {
      // BIL trend data is optional
    }

    entries.push({ fy, byCfda, bil });
  }

  return entries;
}

// ── Phase 4: Top recipients per state/CFDA ───────────────────────────────────

async function fetchTopRecipients(
  stateAbbr: string,
  cfda: string,
  fyStart: number,
  fyEnd: number,
): Promise<{ name: string; amount: number }[]> {
  const { start } = fyDateRange(fyStart);
  const { end } = fyDateRange(fyEnd);

  const body = {
    category: 'recipient',
    filters: {
      time_period: [{ start_date: start, end_date: end }],
      award_type_codes: ['02', '03', '04', '05'],
      program_numbers: [cfda],
      place_of_performance_locations: [{ country: 'USA', state: stateAbbr }],
    },
    limit: 5,
    page: 1,
  };

  const data = await usasPost('/search/spending_by_category/recipient/', body);
  return (data?.results || []).slice(0, 5).map((r: any) => ({
    name: r.name || r.recipient_name || 'Unknown',
    amount: r.amount || r.aggregated_amount || 0,
  }));
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isUSAsBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'USAspending build already in progress',
      cache: getUSAsCacheStatus(),
    });
  }

  setUSAsBuildInProgress(true);
  const startTime = Date.now();

  try {
    const currentFy = currentCompletedFY();
    const fyStart = currentFy - 4; // 5-year window
    const fyEnd = currentFy;
    console.log(`[USAs Cron] Starting build FY${fyStart}-FY${fyEnd}...`);

    // ── Phase 1: CFDA totals by state ──────────────────────────────────────
    console.log('[USAs Cron] Phase 1: Fetching CFDA totals by state...');
    const cfdaStateTotals = new Map<string, Map<string, { amount: number; awardCount: number }>>();

    for (const c of WATER_CFDAS) {
      try {
        const stateTotals = await fetchCfdaByState(c.cfda, fyStart, fyEnd);
        const stateMap = new Map<string, { amount: number; awardCount: number }>();
        for (const st of stateTotals) {
          const abbr = FIPS_TO_STATE.get(st.fips);
          if (abbr) {
            stateMap.set(abbr, { amount: st.amount, awardCount: st.awardCount });
          }
        }
        cfdaStateTotals.set(c.cfda, stateMap);
        console.log(`[USAs Cron] ${c.shortName} (${c.cfda}): ${stateMap.size} states`);
        await delay(DELAY_MS);
      } catch (e) {
        console.warn(`[USAs Cron] Phase 1 ${c.cfda} failed:`, e instanceof Error ? e.message : e);
        cfdaStateTotals.set(c.cfda, new Map());
      }
    }

    // ── Phase 2: BIL totals by state ───────────────────────────────────────
    console.log('[USAs Cron] Phase 2: Fetching BIL totals by state...');
    let bilByState = new Map<string, number>();
    try {
      const rawBil = await fetchBilByState(fyStart, fyEnd);
      for (const [fips, amount] of rawBil) {
        const abbr = FIPS_TO_STATE.get(fips);
        if (abbr) bilByState.set(abbr, amount);
      }
      console.log(`[USAs Cron] BIL data: ${bilByState.size} states`);
      await delay(DELAY_MS);
    } catch (e) {
      console.warn('[USAs Cron] Phase 2 BIL fetch failed:', e instanceof Error ? e.message : e);
    }

    // ── Phase 3: FY trend (national) ───────────────────────────────────────
    console.log('[USAs Cron] Phase 3: Fetching FY trend data...');
    let trendEntries: FyTrendEntry[] = [];
    try {
      trendEntries = await fetchFyTrend(fyStart, fyEnd);
      console.log(`[USAs Cron] Trend: ${trendEntries.length} fiscal years`);
    } catch (e) {
      console.warn('[USAs Cron] Phase 3 trend failed:', e instanceof Error ? e.message : e);
    }

    // ── Phase 4: Top recipients (priority states × top 3 CFDAs) ────────────
    console.log('[USAs Cron] Phase 4: Fetching top recipients for priority states...');
    const topRecipientCfdas = WATER_CFDAS.slice(0, 3); // CWSRF, DWSRF, CWA 106
    const recipientMap = new Map<string, Map<string, { name: string; amount: number }[]>>();

    for (const stateAbbr of PRIORITY_STATES_SET) {
      const stateRecipients = new Map<string, { name: string; amount: number }[]>();
      for (const c of topRecipientCfdas) {
        try {
          const recipients = await fetchTopRecipients(stateAbbr, c.cfda, fyStart, fyEnd);
          stateRecipients.set(c.cfda, recipients);
          await delay(DELAY_MS);
        } catch {
          stateRecipients.set(c.cfda, []);
        }
      }
      recipientMap.set(stateAbbr, stateRecipients);
    }
    console.log(`[USAs Cron] Recipients fetched for ${recipientMap.size} priority states`);

    // ── Assemble cache ─────────────────────────────────────────────────────
    console.log('[USAs Cron] Assembling cache...');
    const byState: Record<string, USAsStateData> = {};
    const statesProcessed: string[] = [];

    // Get current FY totals per CFDA per state
    // (We'll approximate currentFyObligated from the trend data for the latest FY)
    // For simplicity, re-use the 5-year totals and the latest FY trend

    for (const [abbr] of ALL_STATES_WITH_FIPS) {
      const programs: USAsProgramData[] = [];
      let totalEpa = 0;
      let totalAwards = 0;
      let currentFyTotal = 0;
      const stateBil = bilByState.get(abbr) || 0;

      for (const c of WATER_CFDAS) {
        const stateMap = cfdaStateTotals.get(c.cfda);
        const totals = stateMap?.get(abbr);
        const amount = totals?.amount || 0;
        const awards = totals?.awardCount || 0;

        // Current FY from trend (last entry)
        const latestTrend = trendEntries.length > 0 ? trendEntries[trendEntries.length - 1] : null;
        // Approximate state share of current FY: state's 5yr share × national FY total
        const nationalTotal = Object.values(
          cfdaStateTotals.get(c.cfda) ? Object.fromEntries(cfdaStateTotals.get(c.cfda)!) : {}
        ).reduce((s, v) => s + v.amount, 0);
        const stateShare = nationalTotal > 0 ? amount / nationalTotal : 0;
        const nationalFyAmount = latestTrend?.byCfda?.[c.cfda] || 0;
        const currentFy = Math.round(nationalFyAmount * stateShare);

        // BIL amount per-CFDA (approximate: distribute state BIL proportionally)
        const bilProportion = totalEpa + amount > 0 ? amount / (totalEpa + amount + 1) : 0;

        // Top recipients
        const recipients = recipientMap.get(abbr)?.get(c.cfda) || [];

        // FY trend per state/CFDA (approximate from national trend × state share)
        const fyTrend = trendEntries.map(t => ({
          fy: t.fy,
          amount: Math.round((t.byCfda?.[c.cfda] || 0) * stateShare),
        }));

        programs.push({
          cfda: c.cfda,
          programName: c.shortName,
          totalObligated: amount,
          currentFyObligated: currentFy,
          awardCount: awards,
          bilAmount: Math.round(stateBil * bilProportion),
          topRecipients: recipients,
          fyTrend,
        });

        totalEpa += amount;
        totalAwards += awards;
        currentFyTotal += currentFy;
      }

      // Recalculate BIL per-program now that we have totalEpa
      if (stateBil > 0 && totalEpa > 0) {
        for (const prog of programs) {
          prog.bilAmount = Math.round(stateBil * (prog.totalObligated / totalEpa));
        }
      }

      const cwsrf = programs.find(p => p.cfda === '66.458')?.totalObligated || 0;
      const dwsrf = programs.find(p => p.cfda === '66.468')?.totalObligated || 0;
      const srfFederal = cwsrf + dwsrf;

      if (totalEpa > 0) {
        statesProcessed.push(abbr);
      }

      byState[abbr] = {
        stateAbbr: abbr,
        programs,
        totalEpaWater: totalEpa,
        totalBil: stateBil,
        currentFyTotal,
        awardCount: totalAwards,
        srfFederal,
        srfMatchRequired: Math.round(srfFederal * 0.25),  // 20% statutory match
        bilMatchRequired: Math.round(stateBil * 0.111),    // ~10% match
      };
    }

    // National trend
    const nationalTrend = trendEntries.map(t => ({
      fy: t.fy,
      cwsrf: t.byCfda['66.458'] || 0,
      dwsrf: t.byCfda['66.468'] || 0,
      cwa319: t.byCfda['66.480'] || 0,
      cwa106: t.byCfda['66.202'] || 0,
      bil: t.bil,
    }));

    const cacheData: USAsCacheData = {
      _meta: {
        built: new Date().toISOString(),
        statesProcessed,
        stateCount: statesProcessed.length,
        fyRange: `FY${fyStart}-FY${fyEnd}`,
      },
      byState,
      nationalTrend,
    };

    // Empty-data guard
    if (statesProcessed.length === 0) {
      console.warn('[USAs Cron] No states with data — skipping cache save to preserve existing data');
      setUSAsBuildInProgress(false);
      return NextResponse.json({
        status: 'skipped',
        reason: 'No states returned data from USAspending API',
        elapsed: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      });
    }

    await setUSAsCache(cacheData);
    setUSAsBuildInProgress(false);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[USAs Cron] Build complete: ${statesProcessed.length} states in ${elapsed}s`);

    return NextResponse.json({
      status: 'ok',
      statesProcessed: statesProcessed.length,
      fyRange: `FY${fyStart}-FY${fyEnd}`,
      nationalTrendYears: nationalTrend.length,
      elapsed: `${elapsed}s`,
    });
  } catch (e: any) {
    setUSAsBuildInProgress(false);
    console.error('[USAs Cron] Build failed:', e);
    return NextResponse.json(
      { status: 'error', error: e.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
