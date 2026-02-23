// app/api/cron/rebuild-ceden/route.ts
// Cron endpoint — fetches fresh CEDEN data from data.ca.gov, deduplicates,
// and populates the in-memory cache for instant lookups.
// Schedule: daily via Vercel cron or external trigger.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setCedenCache, getCedenCacheStatus,
  isCedenBuildInProgress, setCedenBuildInProgress,
  gridKey,
  type ChemRecord, type ToxRecord,
} from '@/lib/cedenCache';

// ── Config ───────────────────────────────────────────────────────────────────

const CKAN_BASE = 'https://data.ca.gov/api/3/action/datastore_search_sql';
const PAGE_SIZE = 32000;

const CEDEN_CHEM_2025 = '97b8bb60-8e58-4c97-a07f-d51a48cd36d4';
const CEDEN_CHEM_AUG  = 'e07c5e0b-cace-4b70-9f13-b3e696cd5a99';
const CEDEN_TOX       = 'bd484e9b-426a-4ba6-ba4d-f5f8ce095836';

// Analytes that map to PEARL parameters
const PEARL_ANALYTES: Record<string, string> = {
  'Oxygen, Dissolved, Total': 'DO',
  'Oxygen, Dissolved': 'DO',
  'Temperature': 'temperature',
  'pH': 'pH',
  'Turbidity, Total': 'turbidity',
  'Turbidity': 'turbidity',
  'E. coli': 'bacteria',
  'Enterococcus': 'bacteria',
  'Enterococcus, Total': 'bacteria',
  'Coliform, Fecal': 'bacteria',
  'Coliform, Total': 'coliform_total',
  'Nitrogen, Total': 'TN',
  'Nitrogen, Total Kjeldahl': 'TN',
  'Phosphorus as P': 'TP',
  'Phosphorus, Total': 'TP',
  'Chlorophyll a': 'chlorophyll',
  'SpecificConductivity': 'conductivity',
  'Specific Conductance': 'conductivity',
  'Salinity': 'salinity',
  'Total Suspended Solids': 'TSS',
  'Suspended Sediment Concentration': 'TSS',
};

const CHEM_COLS = '"StationName","StationCode","SampleDate","Analyte","Result","Unit","Latitude","Longitude","DataQuality","SampleAgency"';
const TOX_COLS = '"StationName","StationCode","SampleDate","OrganismName","Analyte","Result","Unit","Mean","SigEffectCode","Latitude","Longitude","DataQuality"';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function ckanSql(sql: string): Promise<any[]> {
  const url = new URL(CKAN_BASE);
  url.searchParams.set('sql', sql);
  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`CKAN ${res.status}: ${res.statusText}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'CKAN query failed');
  return json.result?.records || [];
}

async function fetchPaginated(resourceId: string, cols: string, where: string): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  while (true) {
    const sql = `SELECT ${cols} FROM "${resourceId}" WHERE ${where} ORDER BY "SampleDate" DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
    const records = await ckanSql(sql);
    all.push(...records);
    if (records.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    // Small delay between pages to be polite
    await new Promise(r => setTimeout(r, 300));
  }
  return all;
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
  if (isCedenBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'CEDEN build already in progress',
      cache: getCedenCacheStatus(),
    });
  }

  setCedenBuildInProgress(true);
  const startTime = Date.now();

  try {
    // ── Fetch Chemistry ────────────────────────────────────────────────────
    const analyteList = Object.keys(PEARL_ANALYTES).map(a => `'${a.replace(/'/g, "''")}'`).join(',');
    const chemWhere = `"DataQuality" NOT IN ('MetaData','Reject') AND "Analyte" IN (${analyteList}) AND "Latitude" > 0`;

    console.log('[CEDEN Cron] Fetching chemistry 2025...');
    let chemRows = await fetchPaginated(CEDEN_CHEM_2025, CHEM_COLS, chemWhere);

    // Fallback to augmentation if 2025 is empty
    if (chemRows.length === 0) {
      console.log('[CEDEN Cron] 2025 empty, trying augmentation...');
      chemRows = await fetchPaginated(CEDEN_CHEM_AUG, CHEM_COLS, chemWhere + ` AND "SampleDate" >= '2022-01-01'`);
    }
    console.log(`[CEDEN Cron] Chemistry: ${chemRows.length} raw records`);

    // ── Fetch Toxicity (2022+) ─────────────────────────────────────────────
    console.log('[CEDEN Cron] Fetching toxicity 2022+...');
    const toxWhere = `"DataQuality" NOT IN ('MetaData','Reject') AND "SampleDate" >= '2022-01-01' AND "Latitude" > 0`;
    const toxRows = await fetchPaginated(CEDEN_TOX, TOX_COLS, toxWhere);
    console.log(`[CEDEN Cron] Toxicity: ${toxRows.length} raw records`);

    // ── Deduplicate Chemistry ──────────────────────────────────────────────
    // Keep latest per StationCode + pearl_key
    const chemSeen = new Map<string, any>(); // key: "stnCode|pearlKey"
    const chemStations = new Set<string>();
    for (const r of chemRows) {
      const lat = parseFloat(r.Latitude);
      const lng = parseFloat(r.Longitude);
      const result = parseFloat(r.Result);
      if (isNaN(lat) || isNaN(lng) || lat <= 0 || isNaN(result)) continue;

      const pearlKey = PEARL_ANALYTES[r.Analyte];
      if (!pearlKey) continue;

      const dedupeKey = `${r.StationCode}|${pearlKey}`;
      if (chemSeen.has(dedupeKey)) continue; // already have more recent
      chemSeen.set(dedupeKey, r);
      chemStations.add(r.StationCode);
    }

    // ── Deduplicate Toxicity ───────────────────────────────────────────────
    // Keep latest per StationCode + OrganismName
    const toxSeen = new Map<string, any>();
    const toxStations = new Set<string>();
    for (const r of toxRows) {
      const lat = parseFloat(r.Latitude);
      const lng = parseFloat(r.Longitude);
      if (isNaN(lat) || isNaN(lng) || lat <= 0) continue;

      const dedupeKey = `${r.StationCode}|${r.OrganismName || ''}`;
      if (toxSeen.has(dedupeKey)) continue;
      toxSeen.set(dedupeKey, r);
      toxStations.add(r.StationCode);
    }

    // ── Build Grid Index ───────────────────────────────────────────────────
    const grid: Record<string, { chemistry: ChemRecord[]; toxicity: ToxRecord[] }> = {};

    for (const r of chemSeen.values()) {
      const lat = parseFloat(r.Latitude);
      const lng = parseFloat(r.Longitude);
      const key = gridKey(lat, lng);
      if (!grid[key]) grid[key] = { chemistry: [], toxicity: [] };
      grid[key].chemistry.push({
        stn: r.StationCode,
        name: r.StationName,
        date: r.SampleDate ? String(r.SampleDate).slice(0, 10) : null,
        key: PEARL_ANALYTES[r.Analyte],
        analyte: r.Analyte,
        val: Math.round(parseFloat(r.Result) * 10000) / 10000,
        unit: r.Unit || '',
        lat: Math.round(lat * 100000) / 100000,
        lng: Math.round(lng * 100000) / 100000,
        agency: r.SampleAgency || '',
      });
    }

    for (const r of toxSeen.values()) {
      const lat = parseFloat(r.Latitude);
      const lng = parseFloat(r.Longitude);
      const key = gridKey(lat, lng);
      if (!grid[key]) grid[key] = { chemistry: [], toxicity: [] };
      grid[key].toxicity.push({
        stn: r.StationCode,
        name: r.StationName,
        date: r.SampleDate ? String(r.SampleDate).slice(0, 10) : null,
        organism: r.OrganismName || '',
        analyte: r.Analyte || '',
        val: r.Result != null ? Math.round(parseFloat(r.Result) * 10000) / 10000 : null,
        mean: r.Mean != null ? Math.round(parseFloat(r.Mean) * 10000) / 10000 : null,
        unit: r.Unit || '',
        sig: r.SigEffectCode || '',
        lat: Math.round(lat * 100000) / 100000,
        lng: Math.round(lng * 100000) / 100000,
      });
    }

    // ── Store in memory ────────────────────────────────────────────────────
    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        chemistry_records: chemSeen.size,
        toxicity_records: toxSeen.size,
        grid_resolution: 0.1,
        chemistry_stations: chemStations.size,
        toxicity_stations: toxStations.size,
      },
      grid,
    };

    setCedenCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[CEDEN Cron] Build complete in ${elapsed}s`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      chemistry: { raw: chemRows.length, deduplicated: chemSeen.size, stations: chemStations.size },
      toxicity: { raw: toxRows.length, deduplicated: toxSeen.size, stations: toxStations.size },
      gridCells: Object.keys(grid).length,
      cache: getCedenCacheStatus(),
    });

  } catch (err: any) {
    console.error('[CEDEN Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'CEDEN build failed' },
      { status: 500 },
    );
  } finally {
    setCedenBuildInProgress(false);
  }
}
