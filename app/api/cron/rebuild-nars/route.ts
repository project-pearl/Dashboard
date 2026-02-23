// app/api/cron/rebuild-nars/route.ts
// Cron endpoint — fetches EPA National Aquatic Resource Surveys site + chemistry data.
// Downloads CSV files from EPA for latest NLA (2022), NRSA (2018-19), NWCA (2021).
// Parses CSV, joins site info with water chemistry, and builds spatial grid cache.
// Schedule: weekly via Vercel cron (Sunday 4 AM UTC) or manual trigger.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setNarsCache, getNarsCacheStatus,
  isNarsBuildInProgress, setNarsBuildInProgress,
  gridKey,
  type NarsSite,
} from '@/lib/narsCache';

// ── Config ───────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 60_000; // CSVs can be large
const DELAY_MS = 1000;

// EPA CSV download URLs (most recent survey cycle for each type)
const SURVEY_CSVS: Array<{
  survey: 'NLA' | 'NRSA' | 'NWCA';
  year: string;
  siteInfoUrl: string;
  waterChemUrl: string | null;
}> = [
  {
    survey: 'NLA',
    year: '2022',
    siteInfoUrl: 'https://www.epa.gov/system/files/other-files/2024-04/nla22_siteinfo.csv',
    waterChemUrl: 'https://www.epa.gov/system/files/other-files/2024-08/nla22_waterchem_wide.csv',
  },
  {
    survey: 'NRSA',
    year: '2018-19',
    siteInfoUrl: 'https://www.epa.gov/system/files/other-files/2023-01/NRSA_1819_SiteInfo.csv',
    waterChemUrl: 'https://www.epa.gov/system/files/other-files/2023-01/NRSA_1819_WaterChemistry.csv',
  },
  {
    survey: 'NWCA',
    year: '2021',
    siteInfoUrl: 'https://www.epa.gov/system/files/other-files/2024-05/nwca21_siteinfo-data.csv',
    waterChemUrl: null, // NWCA water chem has different structure — site info sufficient for now
  },
];

// ── CSV Parser (minimal, no dependencies) ───────────────────────────────────

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim().toUpperCase()] = (values[j] || '').trim();
    }
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parseNum(val: string | undefined): number | null {
  if (!val || val === '' || val === 'NA' || val === 'NR' || val === '.') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchCSV(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
    });
    if (!res.ok) {
      console.warn(`[NARS Cron] CSV fetch ${res.status}: ${url}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`[NARS Cron] CSV fetch error: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isNarsBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'NARS build already in progress',
      cache: getNarsCacheStatus(),
    });
  }

  setNarsBuildInProgress(true);
  const startTime = Date.now();

  try {
    const allSites: NarsSite[] = [];
    const surveyStats: Record<string, number> = {};
    const statesSet = new Set<string>();

    for (const { survey, year, siteInfoUrl, waterChemUrl } of SURVEY_CSVS) {
      console.log(`[NARS Cron] Fetching ${survey} ${year} site info...`);
      const siteText = await fetchCSV(siteInfoUrl);
      if (!siteText) {
        console.warn(`[NARS Cron] Failed to fetch ${survey} site info`);
        await delay(DELAY_MS);
        continue;
      }

      const siteRows = parseCSV(siteText);
      console.log(`[NARS Cron] ${survey}: ${siteRows.length} site rows`);

      // Build chemistry lookup by UID/SITE_ID if available
      const chemMap = new Map<string, Record<string, string>>();
      if (waterChemUrl) {
        console.log(`[NARS Cron] Fetching ${survey} ${year} water chemistry...`);
        await delay(DELAY_MS);
        const chemText = await fetchCSV(waterChemUrl);
        if (chemText) {
          const chemRows = parseCSV(chemText);
          console.log(`[NARS Cron] ${survey}: ${chemRows.length} chemistry rows`);
          for (const row of chemRows) {
            const key = row['UID'] || row['SITE_ID'] || '';
            if (key) chemMap.set(key, row);
          }
        }
      }

      // Parse sites
      for (const row of siteRows) {
        const lat = parseNum(row['LAT_DD83'] || row['LAT_DD'] || row['LATITUDE']);
        const lng = parseNum(row['LON_DD83'] || row['LON_DD'] || row['LONGITUDE']);
        if (lat === null || lng === null || lat === 0) continue;

        const siteId = row['SITE_ID'] || row['SITEID'] || '';
        const uid = row['UID'] || siteId;
        const state = row['PSTL_CODE'] || row['STATE'] || row['STATE_NAME'] || '';

        if (state) statesSet.add(state);

        // Look up chemistry data
        const chem = chemMap.get(uid) || chemMap.get(siteId) || {};

        const site: NarsSite = {
          siteId,
          uniqueId: row['UNIQUE_ID'] || uid,
          name: row['GNIS_NAME'] || row['SITE_NAME'] || row['SITENAME'] || '',
          survey,
          surveyYear: year,
          lat,
          lng,
          state,
          county: row['CNTYNAME'] || row['COUNTY'] || '',
          ecoregion: row['AG_ECO9_NM'] || row['AG_ECO9'] || '',
          huc8: row['HUC8'] || '',
          visitDate: row['DATE_COL'] || row['DATE_COLLECTED'] || '',
          chla: parseNum(chem['CHLA_RESULT'] || chem['CHLA'] || chem['CHLX_RESULT']),
          ph: parseNum(chem['PH_RESULT'] || chem['PH'] || chem['PHLAB']),
          turbidity: parseNum(chem['TURB_RESULT'] || chem['TURB'] || chem['TURBIDITY']),
          dissolvedO2: parseNum(chem['DO_RESULT'] || chem['DO'] || chem['DO_MGL']),
          conductivity: parseNum(chem['COND_RESULT'] || chem['COND'] || chem['CONDUCTIVITY']),
          nitrogen: parseNum(chem['NTL_RESULT'] || chem['NTL'] || chem['TOTAL_NITROGEN']),
          phosphorus: parseNum(chem['PTL_RESULT'] || chem['PTL'] || chem['TOTAL_PHOSPHORUS']),
        };

        allSites.push(site);
      }

      surveyStats[`${survey}_${year}`] = siteRows.length;
      await delay(DELAY_MS);
    }

    console.log(`[NARS Cron] Total: ${allSites.length} sites across ${statesSet.size} states`);

    // Build grid index
    const grid: Record<string, { sites: NarsSite[] }> = {};
    for (const site of allSites) {
      const key = gridKey(site.lat, site.lng);
      if (!grid[key]) grid[key] = { sites: [] };
      grid[key].sites.push(site);
    }

    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        siteCount: allSites.length,
        surveys: surveyStats,
        statesWithData: statesSet.size,
        gridCells: Object.keys(grid).length,
      },
      grid,
    };

    setNarsCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[NARS Cron] Built in ${elapsed}s — ${allSites.length} sites, ${Object.keys(grid).length} cells`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      sites: allSites.length,
      surveys: surveyStats,
      states: statesSet.size,
      gridCells: Object.keys(grid).length,
      cache: getNarsCacheStatus(),
    });

  } catch (err: any) {
    console.error('[NARS Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'NARS build failed' },
      { status: 500 },
    );
  } finally {
    setNarsBuildInProgress(false);
  }
}
