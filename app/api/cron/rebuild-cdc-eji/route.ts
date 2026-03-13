// app/api/cron/rebuild-cdc-eji/route.ts
// Cron endpoint — downloads CDC Environmental Justice Index (EJI) 2024 data,
// parses CSV, grid-indexes by census tract centroid.
// Schedule: weekly (Sunday 10 PM UTC) via Vercel cron.
//
// The EJI combines environmental burden, social vulnerability, health
// vulnerability, and climate burden into a single tract-level index.
//
// Source: CDC/ATSDR EJI 2024
//   Primary: https://eji.cdc.gov/eji_data_download.html
//   Archive: https://zenodo.org/records/14675861

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setCdcEjiCache,
  getCdcEjiCacheStatus,
  isCdcEjiBuildInProgress,
  setCdcEjiBuildInProgress,
  gridKey,
  type CdcEjiRecord,
} from '@/lib/cdcEjiCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

// CDC EJI download — CSV format from Zenodo (stable DOI-based URL)
const EJI_ZENODO_URL = 'https://zenodo.org/records/14675861/files/EJI_2024_Tract.csv';
// Fallback: direct CDC download
const EJI_CDC_URL = 'https://eji.cdc.gov/Documents/Data/2024/EJI_2024_Tract_CSV.zip';
const FETCH_TIMEOUT_MS = 180_000; // 3 minutes

// State FIPS → abbreviation lookup
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

function rowToRecord(row: Record<string, string>): CdcEjiRecord | null {
  const tractFips = row['FIPS'] || row['GEOID'] || row['GEOID10'] || '';
  if (!tractFips || tractFips.length < 11) return null;

  const lat = parseNum(row['LAT'] || row['LATITUDE'] || row['INTPTLAT'] || row['E_LAT']);
  const lng = parseNum(row['LON'] || row['LNG'] || row['LONGITUDE'] || row['INTPTLON'] || row['E_LON']);
  if (lat === null || lng === null) return null;

  const stateFips = tractFips.substring(0, 2);
  const state = FIPS_TO_STATE[stateFips] || '';
  if (!state) return null;

  return {
    tractFips,
    state,
    county: row['COUNTY'] || row['CNTY_NAME'] || '',
    ejiRank: parseNum(row['RPL_EJI']) ?? 0,
    envBurdenRank: parseNum(row['RPL_EBM']) ?? 0,
    socialVulnRank: parseNum(row['RPL_SVM']) ?? 0,
    healthVulnRank: parseNum(row['RPL_HVM']) ?? 0,
    climateBurdenRank: parseNum(row['RPL_CBM']) ?? 0,
    pm25: parseNum(row['EPL_PM'] || row['E_PM']),
    ozone: parseNum(row['EPL_OZONE'] || row['E_OZONE']),
    dieselPm: parseNum(row['EPL_DSLPM'] || row['E_DSLPM']),
    toxicReleases: parseNum(row['EPL_TOTCR'] || row['E_TOTCR']),
    superfundProx: parseNum(row['EPL_NPL'] || row['E_NPL']),
    waterDischarge: parseNum(row['EPL_WDIS'] || row['E_WDIS']),
    povertyPct: parseNum(row['EP_POV150'] || row['E_POV150']),
    unemploymentPct: parseNum(row['EP_UNEMP'] || row['E_UNEMP']),
    noHealthInsPct: parseNum(row['EP_UNINSUR'] || row['E_UNINSUR']),
    noHsDiplomaPct: parseNum(row['EP_NOHSDP'] || row['E_NOHSDP']),
    minorityPct: parseNum(row['EP_MINRTY'] || row['E_MINRTY']),
    lingIsolationPct: parseNum(row['EP_LIMENG'] || row['E_LIMENG']),
    disabilityPct: parseNum(row['EP_DISABL'] || row['E_DISABL']),
    age65PlusPct: parseNum(row['EP_AGE65'] || row['E_AGE65']),
    singleParentPct: parseNum(row['EP_SNGPNT'] || row['E_SNGPNT']),
    asthmaRate: parseNum(row['EP_ASTHMA'] || row['E_ASTHMA']),
    cancerRate: parseNum(row['EP_CANCER'] || row['E_CANCER']),
    heartDiseaseRate: parseNum(row['EP_BPHIGH'] || row['E_BPHIGH']),
    diabetesRate: parseNum(row['EP_DIABETES'] || row['E_DIABETES']),
    lowBirthWeightRate: parseNum(row['EP_LBW'] || row['E_LBW']),
    lifeExpectancy: parseNum(row['EP_LEXP'] || row['E_LEXP']),
    lat,
    lng,
  };
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isCdcEjiBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'CDC EJI build already in progress',
      cache: getCdcEjiCacheStatus(),
    });
  }

  setCdcEjiBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Try Zenodo first (stable DOI), fall back to CDC direct
    let text: string | null = null;

    for (const url of [EJI_ZENODO_URL, EJI_CDC_URL]) {
      try {
        console.log(`[CDC EJI Cron] Fetching from ${new URL(url).hostname}...`);
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'PEARL-Platform/1.0',
            'Accept': 'text/csv,application/csv,*/*',
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('zip')) {
            // ZIP files need decompression — skip for now, try next URL
            console.log(`[CDC EJI Cron] Got ZIP from ${new URL(url).hostname}, trying next source`);
            continue;
          }
          text = await res.text();
          console.log(`[CDC EJI Cron] Downloaded ${(text.length / 1024 / 1024).toFixed(1)} MB from ${new URL(url).hostname}`);
          break;
        }
      } catch (e: any) {
        console.warn(`[CDC EJI Cron] Failed to fetch from ${url}: ${e.message}`);
      }
    }

    if (!text) {
      throw new Error('All CDC EJI download sources failed');
    }

    const rows = parseCSV(text);
    console.log(`[CDC EJI Cron] Parsed ${rows.length} rows`);

    // Convert to records and build grid
    const grid: Record<string, { records: CdcEjiRecord[] }> = {};
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
      console.warn(`[CDC EJI Cron] 0 records parsed in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getCdcEjiCacheStatus(),
      });
    }

    await setCdcEjiCache({
      _meta: {
        built: new Date().toISOString(),
        recordCount,
        gridCells: Object.keys(grid).length,
        dataSource: 'cdc-eji-2024',
        statesIncluded: statesSet.size,
        version: '2024',
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[CDC EJI Cron] Complete in ${elapsed}s — ${recordCount} records, ${Object.keys(grid).length} cells, ${statesSet.size} states`);

    recordCronRun('rebuild-cdc-eji', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      recordCount,
      gridCells: Object.keys(grid).length,
      statesIncluded: statesSet.size,
      cache: getCdcEjiCacheStatus(),
    });

  } catch (err: any) {
    console.error('[CDC EJI Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-cdc-eji' } });
    notifySlackCronFailure({ cronName: 'rebuild-cdc-eji', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-cdc-eji', 'error', Date.now() - startTime, err.message);

    return NextResponse.json(
      { status: 'error', error: err.message || 'CDC EJI build failed' },
      { status: 500 },
    );
  } finally {
    setCdcEjiBuildInProgress(false);
  }
}
