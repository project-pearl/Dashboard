// app/api/cron/rebuild-pfas/route.ts
// Cron endpoint — fetches EPA UCMR PFAS screening data. Probes multiple
// table names (UCMR4_ALL, UCMR_4, UCMR4_RESULTS, UCMR5_ALL) since the
// original UCMR4_ALL table returned 404.
// Falls back to SDWIS CONTAMINANT tables if none work.
// Schedule: daily via Vercel cron (11 AM UTC) or manual trigger.

import { NextRequest, NextResponse } from 'next/server';
import {
  setPfasCache, getPfasCacheStatus,
  isPfasBuildInProgress, setPfasBuildInProgress,
  gridKey,
  type PfasResult,
} from '@/lib/pfasCache';

// ── Config ───────────────────────────────────────────────────────────────────

const EF_BASE = 'https://data.epa.gov/efservice';
const PAGE_SIZE = 5000;

// PFAS-related contaminant names to filter for
const PFAS_CONTAMINANTS = [
  'PFOS', 'PFOA', 'PFBS', 'PFNA', 'PFHxS', 'PFHpA', 'PFDA',
  'GenX', 'HFPO-DA', 'ADONA', 'NEtFOSAA', 'NMeFOSAA',
  'Perfluorooctanesulfonic acid', 'Perfluorooctanoic acid',
  'Perfluorobutanesulfonic acid',
];

// Tables to probe in order — first one that responds with data wins
const UCMR_TABLE_CANDIDATES = [
  'UCMR4_ALL',
  'UCMR_4',
  'UCMR4_RESULTS',
  'UCMR5_ALL',
  'UCMR_5',
];

// Fallback: SDWIS contaminant tables
const SDWIS_CONTAMINANT_TABLE = 'SDWIS_CONTAMINANT';

// ── Table probe ──────────────────────────────────────────────────────────────

async function probeTable(table: string): Promise<boolean> {
  try {
    const url = `${EF_BASE}/${table}/ROWS/0:0/JSON`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    const text = await res.text();
    if (!text || text.trim() === '' || text.trim() === '[]') return false;
    const data = JSON.parse(text);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

async function findAvailableTable(): Promise<string | null> {
  for (const table of UCMR_TABLE_CANDIDATES) {
    console.log(`[PFAS Cron] Probing table ${table}...`);
    if (await probeTable(table)) {
      console.log(`[PFAS Cron] Found available table: ${table}`);
      return table;
    }
  }
  // Try SDWIS fallback
  console.log(`[PFAS Cron] Probing SDWIS fallback: ${SDWIS_CONTAMINANT_TABLE}...`);
  if (await probeTable(SDWIS_CONTAMINANT_TABLE)) {
    console.log(`[PFAS Cron] Using SDWIS fallback: ${SDWIS_CONTAMINANT_TABLE}`);
    return SDWIS_CONTAMINANT_TABLE;
  }
  return null;
}

// ── Paginated fetch ──────────────────────────────────────────────────────────

async function fetchPfasResults(table: string): Promise<PfasResult[]> {
  const results: PfasResult[] = [];
  let offset = 0;

  while (true) {
    const url = `${EF_BASE}/${table}/ROWS/${offset}:${offset + PAGE_SIZE - 1}/JSON`;
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        console.warn(`[PFAS Cron] ${table} page ${offset}: HTTP ${res.status}`);
        break;
      }

      const text = await res.text();
      if (!text || text.trim() === '' || text.trim() === '[]') break;

      let data: any[];
      try {
        data = JSON.parse(text);
      } catch {
        break;
      }

      if (!Array.isArray(data) || data.length === 0) break;

      for (const row of data) {
        const item = transformResult(row, table);
        if (item !== null) results.push(item);
      }

      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    } catch (e) {
      console.warn(`[PFAS Cron] ${table} page ${offset}: ${e instanceof Error ? e.message : e}`);
      break;
    }
  }

  return results;
}

// ── Row transform ────────────────────────────────────────────────────────────

function transformResult(row: Record<string, any>, table: string): PfasResult | null {
  // UCMR tables have different field names than SDWIS
  const isUcmr = table.startsWith('UCMR');

  const lat = parseFloat(row.LATITUDE || row.LATITUDE83 || row.LATITUDE_DD || '');
  const lng = parseFloat(row.LONGITUDE || row.LONGITUDE83 || row.LONGITUDE_DD || '');
  if (isNaN(lat) || isNaN(lng) || lat <= 0) return null;

  const contaminant = isUcmr
    ? (row.CONTAMINANT || row.ANALYTE || row.CHEMICAL_NAME || '')
    : (row.CONTAMINANT_NAME || row.CONTAMINANT_CODE || '');

  // For SDWIS fallback, only keep PFAS-related contaminants
  if (!isUcmr) {
    const upper = contaminant.toUpperCase();
    const isPfas = PFAS_CONTAMINANTS.some(p => upper.includes(p.toUpperCase()));
    if (!isPfas) return null;
  }

  const resultValue = parseFloat(row.ANALYTICAL_RESULT || row.RESULT || row.VALUE || '');
  const detected = row.DETECT === 'Y' || row.DETECTED === 'Y' ||
    (row.ANALYTICAL_RESULT && parseFloat(row.ANALYTICAL_RESULT) > 0);

  return {
    facilityName: row.FACILITY_NAME || row.PWS_NAME || row.SYSTEM_NAME || '',
    state: row.STATE || row.STATE_CODE || row.PRIMACY_AGENCY_CODE || '',
    contaminant,
    resultValue: isNaN(resultValue) ? null : Math.round(resultValue * 10000) / 10000,
    detected: !!detected,
    sampleDate: row.COLLECTION_DATE || row.SAMPLE_DATE || row.MONITORING_PERIOD || '',
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
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
  if (isPfasBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'PFAS build already in progress',
      cache: getPfasCacheStatus(),
    });
  }

  setPfasBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Step 1: Find an available UCMR/PFAS table
    const tableName = await findAvailableTable();

    if (!tableName) {
      console.warn('[PFAS Cron] No UCMR/PFAS tables available — storing empty cache');

      // Store empty cache so status endpoint shows "degraded" rather than "not loaded"
      setPfasCache({
        _meta: {
          built: new Date().toISOString(),
          resultCount: 0,
          tableName: null,
          gridCells: 0,
        },
        grid: {},
      });

      return NextResponse.json({
        status: 'complete',
        warning: 'No UCMR/PFAS tables available on Envirofacts',
        tablesProbed: [...UCMR_TABLE_CANDIDATES, SDWIS_CONTAMINANT_TABLE],
        results: 0,
        cache: getPfasCacheStatus(),
      });
    }

    await delay(1000);

    // Step 2: Fetch all results from the found table
    console.log(`[PFAS Cron] Fetching results from ${tableName}...`);
    const allResults = await fetchPfasResults(tableName);

    // Deduplicate by facility+contaminant+date
    const dedupMap = new Map<string, PfasResult>();
    for (const r of allResults) {
      const key = `${r.facilityName}|${r.contaminant}|${r.sampleDate}`;
      if (!dedupMap.has(key)) dedupMap.set(key, r);
    }
    const dedupedResults = Array.from(dedupMap.values());

    // ── Build Grid Index ───────────────────────────────────────────────────
    const grid: Record<string, { results: PfasResult[] }> = {};

    for (const r of dedupedResults) {
      const key = gridKey(r.lat, r.lng);
      if (!grid[key]) grid[key] = { results: [] };
      grid[key].results.push(r);
    }

    // ── Store in memory ────────────────────────────────────────────────────
    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        resultCount: dedupedResults.length,
        tableName,
        gridCells: Object.keys(grid).length,
      },
      grid,
    };

    setPfasCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[PFAS Cron] Build complete in ${elapsed}s — ` +
      `${dedupedResults.length} results from ${tableName}, ${Object.keys(grid).length} cells`
    );

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      tableName,
      results: dedupedResults.length,
      gridCells: Object.keys(grid).length,
      cache: getPfasCacheStatus(),
    });

  } catch (err: any) {
    console.error('[PFAS Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'PFAS build failed' },
      { status: 500 },
    );
  } finally {
    setPfasBuildInProgress(false);
  }
}
