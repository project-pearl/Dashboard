// app/api/cron/rebuild-cdc-svi/route.ts
// Cron endpoint — downloads CDC/ATSDR Social Vulnerability Index (SVI) 2022 data,
// parses CSV, grid-indexes by census tract centroid.
// Schedule: weekly (Sunday 9:30 PM UTC) via Vercel cron.
//
// SVI provides tract-level social vulnerability across 4 themes:
//   Theme 1: Socioeconomic Status
//   Theme 2: Household Characteristics & Disability
//   Theme 3: Racial & Ethnic Minority Status
//   Theme 4: Housing Type & Transportation
//
// SVI was briefly removed in early 2025 but restored by court order.
// Source: https://www.atsdr.cdc.gov/place-health/php/svi/svi-data-documentation-download.html

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setCdcSviCache,
  getCdcSviCacheStatus,
  isCdcSviBuildInProgress,
  setCdcSviBuildInProgress,
  gridKey,
  type CdcSviRecord,
} from '@/lib/cdcSviCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

// CDC SVI 2022 — full US tract-level CSV
// The CDC serves these from their data download page. The direct URL pattern
// follows: SVI_{year}_US.csv for the national dataset.
const SVI_PRIMARY_URL = 'https://svi.cdc.gov/data/SVI_2022_US.csv';
// Fallback: ATSDR download page serves the same data
const SVI_FALLBACK_URL = 'https://www.atsdr.cdc.gov/place-health/media/csv/SVI2022_US.csv';
const FETCH_TIMEOUT_MS = 180_000; // 3 minutes (large file ~200MB)

// State FIPS → abbreviation
const FIPS_TO_STATE: Record<string, string> = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE',
  '11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA',
  '20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN',
  '28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM',
  '36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI',
  '45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA',
  '54':'WV','55':'WI','56':'WY','72':'PR','78':'VI',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(v: string | undefined): number | null {
  if (!v || v.trim() === '' || v === 'NA' || v === 'None' || v === '-999' || v === '-1') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      fields.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j];
    }
    rows.push(row);
  }
  return rows;
}

function rowToRecord(row: Record<string, string>): CdcSviRecord | null {
  const tractFips = row['FIPS'] || row['GEOID'] || '';
  if (!tractFips || tractFips.length < 11) return null;

  const lat = parseNum(row['LAT'] || row['LATITUDE'] || row['E_LAT'] || row['INTPTLAT']);
  const lng = parseNum(row['LON'] || row['LNG'] || row['LONGITUDE'] || row['E_LON'] || row['INTPTLON']);
  if (lat === null || lng === null) return null;

  const stateFips = tractFips.substring(0, 2);
  const state = FIPS_TO_STATE[stateFips] || '';
  if (!state) return null;

  return {
    tractFips,
    state,
    county: row['COUNTY'] || row['CNTY_NAME'] || '',
    sviOverall: parseNum(row['RPL_THEMES']) ?? 0,
    theme1Socioeconomic: parseNum(row['RPL_THEME1']) ?? 0,
    theme2HouseholdDisability: parseNum(row['RPL_THEME2']) ?? 0,
    theme3MinorityStatus: parseNum(row['RPL_THEME3']) ?? 0,
    theme4HousingTransport: parseNum(row['RPL_THEME4']) ?? 0,
    povertyPct: parseNum(row['EP_POV150']),
    unemploymentPct: parseNum(row['EP_UNEMP']),
    housingCostBurdenPct: parseNum(row['EP_HBURD']),
    noHealthInsPct: parseNum(row['EP_UNINSUR']),
    noHsDiplomaPct: parseNum(row['EP_NOHSDP']),
    age65PlusPct: parseNum(row['EP_AGE65']),
    age17MinusPct: parseNum(row['EP_AGE17']),
    disabilityPct: parseNum(row['EP_DISABL']),
    singleParentPct: parseNum(row['EP_SNGPNT']),
    lingIsolationPct: parseNum(row['EP_LIMENG']),
    minorityPct: parseNum(row['EP_MINRTY']),
    multiUnitPct: parseNum(row['EP_MUNIT']),
    mobileHomePct: parseNum(row['EP_MOBILE']),
    crowdingPct: parseNum(row['EP_CROWD']),
    noVehiclePct: parseNum(row['EP_NOVEH']),
    groupQuartersPct: parseNum(row['EP_GROUPQ']),
    totalPopulation: parseNum(row['E_TOTPOP']) ?? null,
    lat,
    lng,
  };
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isCdcSviBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'CDC SVI build already in progress',
      cache: getCdcSviCacheStatus(),
    });
  }

  setCdcSviBuildInProgress(true);
  const startTime = Date.now();

  try {
    let text: string | null = null;

    for (const url of [SVI_PRIMARY_URL, SVI_FALLBACK_URL]) {
      try {
        console.log(`[CDC SVI Cron] Fetching from ${new URL(url).hostname}...`);
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'PEARL-Platform/1.0',
            'Accept': 'text/csv,application/csv,*/*',
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (res.ok) {
          text = await res.text();
          console.log(`[CDC SVI Cron] Downloaded ${(text.length / 1024 / 1024).toFixed(1)} MB from ${new URL(url).hostname}`);
          break;
        }
      } catch (e: any) {
        console.warn(`[CDC SVI Cron] Failed to fetch from ${url}: ${e.message}`);
      }
    }

    if (!text) {
      throw new Error('All CDC SVI download sources failed');
    }

    const rows = parseCSV(text);
    console.log(`[CDC SVI Cron] Parsed ${rows.length} rows`);

    const grid: Record<string, { records: CdcSviRecord[] }> = {};
    let recordCount = 0;
    const statesSet = new Set<string>();

    for (const row of rows) {
      const record = rowToRecord(row);
      if (!record) continue;

      const key = gridKey(record.lat, record.lng);
      if (!grid[key]) grid[key] = { records: [] };
      grid[key].records.push(record);
      recordCount++;
      statesSet.add(record.state);
    }

    if (recordCount === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[CDC SVI Cron] 0 records parsed in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getCdcSviCacheStatus(),
      });
    }

    await setCdcSviCache({
      _meta: {
        built: new Date().toISOString(),
        recordCount,
        gridCells: Object.keys(grid).length,
        dataSource: 'cdc-svi-2022',
        statesIncluded: statesSet.size,
        sviYear: '2022',
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[CDC SVI Cron] Complete in ${elapsed}s — ${recordCount} records, ${Object.keys(grid).length} cells, ${statesSet.size} states`);

    recordCronRun('rebuild-cdc-svi', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      recordCount,
      gridCells: Object.keys(grid).length,
      statesIncluded: statesSet.size,
      cache: getCdcSviCacheStatus(),
    });

  } catch (err: any) {
    console.error('[CDC SVI Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-cdc-svi' } });
    notifySlackCronFailure({ cronName: 'rebuild-cdc-svi', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-cdc-svi', 'error', Date.now() - startTime, err.message);

    return NextResponse.json(
      { status: 'error', error: err.message || 'CDC SVI build failed' },
      { status: 500 },
    );
  } finally {
    setCdcSviBuildInProgress(false);
  }
}
