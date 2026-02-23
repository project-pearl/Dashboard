// app/api/cron/rebuild-wqp/route.ts
// Cron endpoint — fetches WQP water quality data for priority states,
// deduplicates, and populates the in-memory spatial cache for instant lookups.
// Schedule: daily via Vercel cron (5 AM UTC) or manual trigger.

import { NextRequest, NextResponse } from 'next/server';
import {
  setWqpCache, getWqpCacheStatus,
  isWqpBuildInProgress, setWqpBuildInProgress,
  gridKey,
  type WqpRecord,
} from '@/lib/wqpCache';

// Allow up to 5 minutes on Vercel Pro
export const maxDuration = 300;

// ── Config ───────────────────────────────────────────────────────────────────

const WQP_BASE = 'https://www.waterqualitydata.us/data/Result/search';
const CONCURRENCY = 4;  // Parallel state fetches (respects WQP rate limits)

import { PRIORITY_STATES_WITH_FIPS } from '@/lib/constants';

// Top characteristics to fetch (maps to PEARL keys)
const CHARACTERISTICS = [
  'Dissolved oxygen (DO)',
  'pH',
  'Temperature, water',
  'Turbidity',
  'Nitrogen',
  'Phosphorus',
  'Escherichia coli',
  'Specific conductance',
];

// WQP characteristic → PEARL key
const CHAR_TO_PEARL: Record<string, string> = {
  'Dissolved oxygen (DO)': 'DO',
  'Dissolved Oxygen': 'DO',
  'pH': 'pH',
  'Temperature, water': 'temperature',
  'Temperature': 'temperature',
  'Turbidity': 'turbidity',
  'Nitrogen': 'TN',
  'Total Nitrogen, mixed forms': 'TN',
  'Nitrate': 'TN',
  'Phosphorus': 'TP',
  'Total Phosphorus, mixed forms': 'TP',
  'Escherichia coli': 'bacteria',
  'Enterococcus': 'bacteria',
  'Fecal Coliform': 'bacteria',
  'Total suspended solids': 'TSS',
  'Specific conductance': 'conductivity',
  'Chlorophyll a': 'chlorophyll',
  'Salinity': 'salinity',
};

// ── CSV Parser (minimal — same as statePortalAdapters) ───────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function csvToRows(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] || '';
    }
    rows.push(obj);
  }
  return rows;
}

// ── Fetch WQP for one state ──────────────────────────────────────────────────

async function fetchState(stateAbbr: string, fips: string): Promise<WqpRecord[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  // WQP requires MM-dd-yyyy format (not ISO yyyy-MM-dd)
  const mm = String(sixMonthsAgo.getMonth() + 1).padStart(2, '0');
  const dd = String(sixMonthsAgo.getDate()).padStart(2, '0');
  const yyyy = sixMonthsAgo.getFullYear();
  const startDate = `${mm}-${dd}-${yyyy}`;

  const url = new URL(WQP_BASE);
  url.searchParams.set('statecode', `US:${fips}`);
  url.searchParams.set('characteristicName', CHARACTERISTICS.join(';'));
  url.searchParams.set('startDateLo', startDate);
  url.searchParams.set('sampleMedia', 'Water');
  url.searchParams.set('providers', 'STORET');   // State/tribal data only — USGS covered by Source 4
  url.searchParams.set('dataProfile', 'resultPhysChem');
  url.searchParams.set('mimeType', 'csv');
  url.searchParams.set('sorted', 'no');           // Faster query

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(120_000),  // resultPhysChem is larger — allow 2 min
    redirect: 'follow',
  });

  if (!res.ok) {
    console.warn(`[WQP Cron] ${stateAbbr}: HTTP ${res.status}`);
    return [];
  }

  const text = await res.text();
  const rows = csvToRows(text);
  const records: WqpRecord[] = [];

  for (const row of rows) {
    const charName = row.CharacteristicName || row['Characteristic Name'] || '';
    const pearlKey = CHAR_TO_PEARL[charName];
    if (!pearlKey) continue;

    const rawValue = row.ResultMeasureValue || row['ResultMeasure/MeasureValue'] || '';
    const val = parseFloat(rawValue);
    if (isNaN(val)) continue;

    const lat = parseFloat(row['ActivityLocation/LatitudeMeasure'] || row['Monitoring Location Latitude'] || row.LatitudeMeasure || '');
    const lng = parseFloat(row['ActivityLocation/LongitudeMeasure'] || row['Monitoring Location Longitude'] || row.LongitudeMeasure || '');
    if (isNaN(lat) || isNaN(lng) || lat <= 0) continue;

    records.push({
      stn: row.MonitoringLocationIdentifier || row['Monitoring Location Identifier'] || '',
      name: row.MonitoringLocationName || row['Monitoring Location Name'] || '',
      date: row.ActivityStartDate || row['Activity Start Date'] || '',
      key: pearlKey,
      char: charName,
      val: Math.round(val * 10000) / 10000,
      unit: row['ResultMeasure/MeasureUnitCode'] || row['ResultMeasure.MeasureUnitCode'] || row.ResultMeasure_MeasureUnitCode || row['Result Unit'] || '',
      org: row.OrganizationFormalName || row['Organization Formal Name'] || '',
      lat: Math.round(lat * 100000) / 100000,
      lng: Math.round(lng * 100000) / 100000,
      state: stateAbbr,
    });
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
  if (isWqpBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'WQP build already in progress',
      cache: getWqpCacheStatus(),
    });
  }

  setWqpBuildInProgress(true);
  const startTime = Date.now();
  const stateResults: Record<string, { raw: number; deduplicated: number }> = {};

  try {
    const allRecords: WqpRecord[] = [];
    const processedStates: string[] = [];

    // Semaphore-based concurrency to respect WQP rate limits
    const queue = [...PRIORITY_STATES_WITH_FIPS];
    let running = 0;
    let idx = 0;

    await new Promise<void>((resolve) => {
      function next() {
        if (idx >= queue.length && running === 0) return resolve();
        while (running < CONCURRENCY && idx < queue.length) {
          const [abbr, fips] = queue[idx++];
          running++;
          (async () => {
            try {
              console.log(`[WQP Cron] Fetching ${abbr} (FIPS ${fips})...`);
              const records = await fetchState(abbr, fips);
              const rawCount = records.length;

              // Deduplicate: keep latest per station + PEARL key
              const seen = new Map<string, WqpRecord>();
              records.sort((a, b) => b.date.localeCompare(a.date));
              for (const rec of records) {
                const dedupeKey = `${rec.stn}|${rec.key}`;
                if (!seen.has(dedupeKey)) seen.set(dedupeKey, rec);
              }

              const deduplicated = Array.from(seen.values());
              for (const r of deduplicated) allRecords.push(r);
              processedStates.push(abbr);
              stateResults[abbr] = { raw: rawCount, deduplicated: deduplicated.length };
              console.log(`[WQP Cron] ${abbr}: ${rawCount} raw → ${deduplicated.length} deduplicated`);
            } catch (e) {
              console.warn(`[WQP Cron] ${abbr} failed:`, e instanceof Error ? e.message : e);
              stateResults[abbr] = { raw: 0, deduplicated: 0 };
            } finally {
              running--;
              next();
            }
          })();
        }
      }
      next();
    });

    // ── Build Grid Index ───────────────────────────────────────────────────
    const grid: Record<string, { records: WqpRecord[] }> = {};

    for (const rec of allRecords) {
      const key = gridKey(rec.lat, rec.lng);
      if (!grid[key]) grid[key] = { records: [] };
      grid[key].records.push(rec);
    }

    // ── Store in memory ────────────────────────────────────────────────────
    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        totalRecords: allRecords.length,
        statesProcessed: processedStates,
        gridCells: Object.keys(grid).length,
      },
      grid,
    };

    await setWqpCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[WQP Cron] Build complete in ${elapsed}s — ${allRecords.length} records, ${Object.keys(grid).length} cells`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      totalRecords: allRecords.length,
      gridCells: Object.keys(grid).length,
      statesProcessed: processedStates.length,
      states: stateResults,
      cache: getWqpCacheStatus(),
    });

  } catch (err: any) {
    console.error('[WQP Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'WQP build failed' },
      { status: 500 },
    );
  } finally {
    setWqpBuildInProgress(false);
  }
}
