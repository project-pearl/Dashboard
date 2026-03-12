// app/api/cron/rebuild-ejscreen/route.ts
// Cron endpoint — downloads EJScreen data from Harvard DataVerse (EPA dataset
// preserved after EJScreen removal in Feb 2025), parses CSV, grid-indexes.
// Schedule: weekly (Sunday 11 PM UTC) via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setEJScreenCache,
  getEJScreenCacheStatus,
  isEJScreenBuildInProgress,
  setEJScreenBuildInProgress,
  gridKey,
  type EJScreenRecord,
} from '@/lib/ejscreenCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

// Harvard DataVerse API — EPA EJScreen dataset preservation
// This is a tabular CSV export of the block-group-level EJ indices
const DATAVERSE_BASE = 'https://dataverse.harvard.edu/api/access/datafile/:persistentId';
const DATASET_DOI = 'doi:10.7910/DVN/RLR5AX';
const FETCH_TIMEOUT_MS = 120_000; // 2 minutes (large file)

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
  if (!v || v.trim() === '' || v === 'NA' || v === 'None') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

interface RawRow {
  [key: string]: string;
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

function parseCSV(text: string): RawRow[] {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;
    const row: RawRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j];
    }
    rows.push(row);
  }
  return rows;
}

function rowToRecord(row: RawRow): EJScreenRecord | null {
  // Block group FIPS is typically the ID_NO or FIPS column
  const blockGroupId = row['ID'] || row['ID_NO'] || row['FIPS'] || row['GEOID'] || '';
  if (!blockGroupId) return null;

  const lat = parseNum(row['LAT'] || row['LATITUDE'] || row['INTPTLAT']);
  const lng = parseNum(row['LON'] || row['LNG'] || row['LONGITUDE'] || row['INTPTLON']);
  if (lat === null || lng === null) return null;

  const stateFips = blockGroupId.substring(0, 2);
  const state = FIPS_TO_STATE[stateFips] || '';
  if (!state) return null;

  return {
    blockGroupId,
    state,
    ejIndex: parseNum(row['EJ_INDEX'] || row['P_LDPNT_D2'] || row['EJINDEX']) ?? 0,
    lowIncomePct: (parseNum(row['LOWINCPCT']) ?? 0),
    minorityPct: (parseNum(row['MINORPCT']) ?? 0),
    lingIsolatedPct: (parseNum(row['LINGISOPCT']) ?? 0),
    lessThanHsPct: (parseNum(row['LESSHSPCT']) ?? 0),
    pm25: parseNum(row['PM25'] || row['PARTICULATE']),
    ozone: parseNum(row['OZONE']),
    dieselPm: parseNum(row['DSLPM'] || row['DIESEL']),
    waterDischarge: parseNum(row['PTRAF'] || row['PWDIS'] || row['D_DWATER_2']),
    superfundProx: parseNum(row['PNPL'] || row['SUPERFUND_PROX']),
    rmpProx: parseNum(row['PRMP'] || row['RMP_PROX']),
    lat,
    lng,
  };
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isEJScreenBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'EJScreen build already in progress',
      cache: getEJScreenCacheStatus(),
    });
  }

  setEJScreenBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Attempt to download CSV from Harvard DataVerse
    const url = `${DATAVERSE_BASE}?persistentId=${DATASET_DOI}`;
    console.log(`[EJScreen Cron] Fetching from Harvard DataVerse...`);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PEARL-Platform/1.0',
        'Accept': 'text/csv,application/csv,*/*',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`Harvard DataVerse returned HTTP ${res.status}`);
    }

    const text = await res.text();
    console.log(`[EJScreen Cron] Downloaded ${(text.length / 1024 / 1024).toFixed(1)} MB`);

    const rows = parseCSV(text);
    console.log(`[EJScreen Cron] Parsed ${rows.length} rows`);

    // Convert to EJScreenRecords and build grid
    const grid: Record<string, { records: EJScreenRecord[] }> = {};
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

    // Empty-data guard
    if (recordCount === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[EJScreen Cron] 0 records parsed in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getEJScreenCacheStatus(),
      });
    }

    await setEJScreenCache({
      _meta: {
        built: new Date().toISOString(),
        recordCount,
        gridCells: Object.keys(grid).length,
        dataSource: 'harvard-dataverse',
        statesIncluded: statesSet.size,
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[EJScreen Cron] Complete in ${elapsed}s — ${recordCount} records, ${Object.keys(grid).length} cells, ${statesSet.size} states`);

    recordCronRun('rebuild-ejscreen', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      recordCount,
      gridCells: Object.keys(grid).length,
      statesIncluded: statesSet.size,
      cache: getEJScreenCacheStatus(),
    });

  } catch (err: any) {
    console.error('[EJScreen Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-ejscreen' } });
    notifySlackCronFailure({ cronName: 'rebuild-ejscreen', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-ejscreen', 'error', Date.now() - startTime, err.message);

    return NextResponse.json(
      { status: 'error', error: err.message || 'EJScreen build failed' },
      { status: 500 },
    );
  } finally {
    setEJScreenBuildInProgress(false);
  }
}
