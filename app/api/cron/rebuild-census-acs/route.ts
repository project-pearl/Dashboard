// app/api/cron/rebuild-census-acs/route.ts
// Cron endpoint — fetches Census ACS 5-Year Estimates via the Census Bureau API,
// builds a tract-level demographic cache for EJ scoring and demographic analysis.
// Schedule: weekly (Sunday 8:30 PM UTC) via Vercel cron.
//
// Uses the Census Bureau API (free, requires API key in PIN_CENSUS_KEY).
// Latest: 2020-2024 ACS 5-Year Estimates (released January 29, 2026).
//
// API docs: https://api.census.gov/data/2024/acs/acs5
// Variables: https://api.census.gov/data/2024/acs/acs5/variables.html
//
// Strategy: Fetches state-by-state (tract-level data per state) to stay
// within Census API response size limits (~50 states × ~1500 tracts each).

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setCensusAcsCache,
  getCensusAcsCacheStatus,
  isCensusAcsBuildInProgress,
  setCensusAcsBuildInProgress,
  gridKey,
  FIPS_TO_STATE,
  STATE_TO_FIPS,
  type CensusAcsRecord,
} from '@/lib/censusAcsCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

// ACS 5-Year API — use the most recent year available
const ACS_YEAR = '2024';
const ACS_BASE = `https://api.census.gov/data/${ACS_YEAR}/acs/acs5`;
const FETCH_TIMEOUT_MS = 30_000; // 30s per state request

// Census API variables we need (variable codes)
// See: https://api.census.gov/data/2024/acs/acs5/variables.html
const VARIABLES = [
  'B01003_001E',  // Total population
  'B19013_001E',  // Median household income
  'B17001_002E',  // Population below poverty
  'B17001_001E',  // Population for poverty status determination
  'B17001_004E',  // Poverty under 18 (male under 5)
  'B02001_002E',  // White alone
  'B03003_003E',  // Hispanic or Latino
  'B02001_003E',  // Black alone
  'B02001_005E',  // Asian alone
  'B02001_004E',  // AIAN alone
  'B02001_006E',  // NHPI alone
  'B02001_008E',  // Two or more races
  'B15003_002E',  // No schooling (start of no-HS chain)
  'B15003_017E',  // Regular HS diploma (for calculating no-HS)
  'B15003_001E',  // Education universe (25+)
  'B15003_022E',  // Bachelor's degree
  'B15003_023E',  // Master's degree
  'B15003_024E',  // Professional degree
  'B15003_025E',  // Doctorate
  'B27010_001E',  // Health insurance universe
  'B27010_017E',  // No health insurance (19-34)
  'B27010_033E',  // No health insurance (35-64)
  'B27010_050E',  // No health insurance (65+)
  'C16002_004E',  // Limited English HH — Spanish
  'C16002_007E',  // Limited English HH — Other Indo-European
  'C16002_010E',  // Limited English HH — Asian/Pacific
  'C16002_013E',  // Limited English HH — Other
  'C16002_001E',  // Linguistic isolation universe
  'B01001_020E',  // Male 65-66 (start of 65+ chain — we'll use group)
  'B01001_049E',  // Female 85+
  'B09001_001E',  // Population under 18 (universe)
  'B01001_003E',  // Male under 5
  'B18101_001E',  // Disability universe
  'B18101_004E',  // Disability male under 5 (we sum across)
  'B25077_001E',  // Median home value
  'B25003_003E',  // Renter-occupied units
  'B25003_001E',  // Total occupied units
  'B25070_010E',  // Rent burden 30-35% (start of burden chain)
  'B25106_001E',  // Housing cost universe
].join(',');

// Simplified variable set to stay within Census API limits
// We'll compute derived fields from these base variables
const SIMPLE_VARS = [
  'B01003_001E',  // Total population
  'B19013_001E',  // Median household income
  'B17001_002E',  // Below poverty
  'B17001_001E',  // Poverty universe
  'B02001_002E',  // White alone
  'B03003_003E',  // Hispanic
  'B02001_003E',  // Black
  'B02001_005E',  // Asian
  'B27010_017E',  // Uninsured 19-34
  'B27010_033E',  // Uninsured 35-64
  'B27010_001E',  // Insurance universe
  'C16002_004E',  // Ling isolated - Spanish
  'C16002_007E',  // Ling isolated - Indo-European
  'C16002_010E',  // Ling isolated - Asian
  'C16002_013E',  // Ling isolated - Other
  'C16002_001E',  // Ling isolated universe
  'B25077_001E',  // Median home value
  'B25003_003E',  // Renter occupied
  'B25003_001E',  // Total occupied
].join(',');

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeDiv(num: number | null, denom: number | null): number | null {
  if (num === null || denom === null || denom === 0) return null;
  return num / denom;
}

function pct(num: number | null, denom: number | null): number | null {
  const ratio = safeDiv(num, denom);
  return ratio !== null ? Math.round(ratio * 1000) / 10 : null; // One decimal place
}

function parseVal(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '' || v === '-666666666' || v === -666666666) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? null : n;
}

// ── Census Tract Centroid Lookup ─────────────────────────────────────────────
// We need lat/lng for each tract. The Census Gazetteer files provide centroids.
// For efficiency, we fetch the gazetteer once and build a lookup.

let _gazetteerCache: Record<string, { lat: number; lng: number }> | null = null;

async function fetchGazetteer(): Promise<Record<string, { lat: number; lng: number }>> {
  if (_gazetteerCache) return _gazetteerCache;

  // Census Bureau publishes tract gazetteer files
  const url = 'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_tracts_national.txt';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PEARL-Platform/1.0' },
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    throw new Error(`Gazetteer download failed: HTTP ${res.status}`);
  }

  const text = await res.text();
  const lines = text.split('\n');
  const lookup: Record<string, { lat: number; lng: number }> = {};

  // Tab-delimited: USPS, GEOID, ALAND, AWATER, ALAND_SQMI, AWATER_SQMI, INTPTLAT, INTPTLONG
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols.length < 8) continue;
    const geoid = (cols[1] || '').trim();
    const lat = parseFloat((cols[6] || '').trim());
    const lng = parseFloat((cols[7] || '').trim());
    if (geoid && !isNaN(lat) && !isNaN(lng)) {
      lookup[geoid] = { lat, lng };
    }
  }

  console.log(`[Census ACS Cron] Loaded ${Object.keys(lookup).length} tract centroids from gazetteer`);
  _gazetteerCache = lookup;
  return lookup;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isCensusAcsBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Census ACS build already in progress',
      cache: getCensusAcsCacheStatus(),
    });
  }

  setCensusAcsBuildInProgress(true);
  const startTime = Date.now();

  try {
    const apiKey = process.env.PIN_CENSUS_KEY;
    if (!apiKey) {
      throw new Error('PIN_CENSUS_KEY environment variable not set');
    }

    // Step 1: Load gazetteer for tract centroids
    console.log('[Census ACS Cron] Loading tract gazetteer...');
    const gazetteer = await fetchGazetteer();

    // Step 2: Fetch ACS data state by state
    const grid: Record<string, { records: CensusAcsRecord[] }> = {};
    let recordCount = 0;
    const statesSet = new Set<string>();
    const stateFipsList = Object.keys(FIPS_TO_STATE);
    let statesProcessed = 0;
    let statesFailed = 0;

    for (const stateFips of stateFipsList) {
      const stateAbbr = FIPS_TO_STATE[stateFips];
      try {
        const url = `${ACS_BASE}?get=${SIMPLE_VARS}&for=tract:*&in=state:${stateFips}&key=${apiKey}`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'PEARL-Platform/1.0' },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });

        if (!res.ok) {
          console.warn(`[Census ACS Cron] HTTP ${res.status} for state ${stateAbbr}`);
          statesFailed++;
          continue;
        }

        const data: string[][] = await res.json();
        if (!Array.isArray(data) || data.length < 2) {
          statesFailed++;
          continue;
        }

        const headers = data[0];
        const stateIdx = headers.indexOf('state');
        const countyIdx = headers.indexOf('county');
        const tractIdx = headers.indexOf('tract');

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const st = row[stateIdx];
          const co = row[countyIdx];
          const tr = row[tractIdx];
          const tractFips = `${st}${co}${tr}`;

          const centroid = gazetteer[tractFips];
          if (!centroid) continue;

          // Parse variables by header position
          const val = (varName: string) => {
            const idx = headers.indexOf(varName);
            return idx >= 0 ? parseVal(row[idx]) : null;
          };

          const totalPop = val('B01003_001E') ?? 0;
          if (totalPop === 0) continue;

          const belowPoverty = val('B17001_002E');
          const povertyUniverse = val('B17001_001E');
          const whiteAlone = val('B02001_002E');
          const hispanic = val('B03003_003E');
          const black = val('B02001_003E');
          const asian = val('B02001_005E');
          const unins1934 = val('B27010_017E');
          const unins3564 = val('B27010_033E');
          const insUniverse = val('B27010_001E');
          const lingSpanish = val('C16002_004E');
          const lingIndoEuro = val('C16002_007E');
          const lingAsian = val('C16002_010E');
          const lingOther = val('C16002_013E');
          const lingUniverse = val('C16002_001E');
          const renterOcc = val('B25003_003E');
          const totalOcc = val('B25003_001E');

          const totalUninsured = (unins1934 ?? 0) + (unins3564 ?? 0);
          const totalLingIso = (lingSpanish ?? 0) + (lingIndoEuro ?? 0) + (lingAsian ?? 0) + (lingOther ?? 0);
          const minorityCount = totalPop - (whiteAlone ?? totalPop);

          const record: CensusAcsRecord = {
            tractFips,
            state: stateAbbr,
            county: co,
            totalPopulation: totalPop,
            medianHouseholdIncome: val('B19013_001E'),
            povertyPct: pct(belowPoverty, povertyUniverse),
            povertyUnder18Pct: null, // Would need additional variables
            whitePct: pct(whiteAlone, totalPop),
            blackPct: pct(black, totalPop),
            hispanicPct: pct(hispanic, totalPop),
            asianPct: pct(asian, totalPop),
            aianPct: null,
            nhpiPct: null,
            multiRacePct: null,
            minorityPct: pct(minorityCount, totalPop),
            noHsDiplomaPct: null, // Would need B15003 chain
            bachelorsPlusPct: null,
            noHealthInsPct: pct(totalUninsured, insUniverse),
            lingIsolationPct: pct(totalLingIso, lingUniverse),
            age65PlusPct: null,
            ageUnder5Pct: null,
            disabilityPct: null,
            medianHomeValue: val('B25077_001E'),
            renterOccupiedPct: pct(renterOcc, totalOcc),
            housingCostBurdenPct: null,
            vacancyPct: null,
            lat: centroid.lat,
            lng: centroid.lng,
          };

          const key = gridKey(record.lat, record.lng);
          if (!grid[key]) grid[key] = { records: [] };
          grid[key].records.push(record);
          recordCount++;
          statesSet.add(stateAbbr);
        }

        statesProcessed++;
        if (statesProcessed % 10 === 0) {
          console.log(`[Census ACS Cron] Processed ${statesProcessed}/${stateFipsList.length} states, ${recordCount} tracts`);
        }

      } catch (e: any) {
        console.warn(`[Census ACS Cron] Failed for state ${stateAbbr}: ${e.message}`);
        statesFailed++;
      }
    }

    if (recordCount === 0) {
      throw new Error(`No tracts loaded (${statesFailed} states failed)`);
    }

    await setCensusAcsCache({
      _meta: {
        built: new Date().toISOString(),
        recordCount,
        gridCells: Object.keys(grid).length,
        dataSource: `census-acs-5yr-${ACS_YEAR}`,
        statesIncluded: statesSet.size,
        acsYear: ACS_YEAR,
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Census ACS Cron] Complete in ${elapsed}s — ${recordCount} tracts, ${Object.keys(grid).length} cells, ${statesSet.size} states (${statesFailed} failed)`);

    recordCronRun('rebuild-census-acs', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      recordCount,
      gridCells: Object.keys(grid).length,
      statesIncluded: statesSet.size,
      statesFailed,
      cache: getCensusAcsCacheStatus(),
    });

  } catch (err: any) {
    console.error('[Census ACS Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-census-acs' } });
    notifySlackCronFailure({ cronName: 'rebuild-census-acs', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-census-acs', 'error', Date.now() - startTime, err.message);

    return NextResponse.json(
      { status: 'error', error: err.message || 'Census ACS build failed' },
      { status: 500 },
    );
  } finally {
    setCensusAcsBuildInProgress(false);
  }
}
