// app/api/cron/rebuild-pfas/route.ts
// Cron endpoint — fetches EPA UCMR5 PFAS occurrence data.
// UCMR tables are no longer on Envirofacts REST API.
// Instead: downloads the UCMR5 occurrence ZIP from EPA, parses the
// tab-delimited data, and geocodes via Envirofacts WATER_SYSTEM_FACILITY.
// Schedule: daily via Vercel cron (11 AM UTC) or manual trigger.

import { NextRequest, NextResponse } from 'next/server';
import {
  setPfasCache, getPfasCacheStatus,
  isPfasBuildInProgress, setPfasBuildInProgress,
  gridKey,
  type PfasResult,
} from '@/lib/pfasCache';

// Allow up to 5 minutes on Vercel Pro
export const maxDuration = 300;

// ── Config ───────────────────────────────────────────────────────────────────

// UCMR5 occurrence data (tab-delimited text inside ZIP)
const UCMR5_ZIP_URL = 'https://www.epa.gov/system/files/other-files/2023-08/ucmr5-occurrence-data.zip';

// Envirofacts for geocoding PWSIDs → lat/lng
const EF_BASE = 'https://data.epa.gov/efservice';
const GEO_BATCH_SIZE = 50; // PWSIDs per Envirofacts request
const GEO_DELAY_MS = 500;

// PFAS analytes in UCMR5 (all 29 PFAS + lithium — we filter to PFAS only)
const PFAS_KEYWORDS = [
  'PFOS', 'PFOA', 'PFBS', 'PFNA', 'PFHxS', 'PFHpA', 'PFDA', 'PFUnA',
  'PFDoA', 'PFTrDA', 'PFTA', 'PFBA', 'PFPeA', 'PFHxA', 'PFHpS',
  'PFDS', 'PFNS', 'PFPeS', 'PFOSA', 'ADONA', 'HFPO-DA', 'GenX',
  'NEtFOSAA', 'NMeFOSAA', '11Cl-PF3OUdS', '9Cl-PF3ONS',
  '4:2 FTS', '6:2 FTS', '8:2 FTS',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function isPfasContaminant(name: string): boolean {
  if (!name) return false;
  const upper = name.toUpperCase();
  if (upper.includes('PERFLUORO') || upper.includes('PFAS')) return true;
  return PFAS_KEYWORDS.some(kw => upper.includes(kw.toUpperCase()));
}

// ── Parse UCMR5 TSV data ────────────────────────────────────────────────────

interface Ucmr5Row {
  pwsid: string;
  pwsName: string;
  state: string;
  contaminant: string;
  resultValue: number | null;
  detected: boolean;
  sampleDate: string;
}

async function fetchAndParseUcmr5(): Promise<Ucmr5Row[]> {
  console.log(`[PFAS Cron] Downloading UCMR5 occurrence data...`);

  const res = await fetch(UCMR5_ZIP_URL, {
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    throw new Error(`UCMR5 download failed: HTTP ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  console.log(`[PFAS Cron] Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB ZIP`);

  // Parse ZIP — find the TSV/TXT file inside
  // Minimal ZIP parsing: look for the file entry and decompress
  const JSZip = await importJSZip();
  if (!JSZip) {
    // Fallback: try to parse as raw text (in case URL gives us the file directly)
    throw new Error('ZIP decompression not available — install jszip or use unzipped endpoint');
  }

  const zip = await JSZip.loadAsync(buffer);
  const txtFiles = Object.keys(zip.files).filter(f =>
    f.toLowerCase().includes('ucmr5') && (f.endsWith('.txt') || f.endsWith('.tsv'))
  );

  if (txtFiles.length === 0) {
    // Try any txt file
    const anyTxt = Object.keys(zip.files).filter(f => f.endsWith('.txt') || f.endsWith('.tsv'));
    if (anyTxt.length === 0) throw new Error('No TXT/TSV files found in UCMR5 ZIP');
    txtFiles.push(anyTxt[0]);
  }

  console.log(`[PFAS Cron] Parsing ${txtFiles[0]}...`);
  const content = await zip.files[txtFiles[0]].async('string');
  const lines = content.split('\n');

  if (lines.length < 2) throw new Error('UCMR5 file is empty');

  // Parse header (tab-delimited)
  const headers = lines[0].split('\t').map(h => h.trim().replace(/"/g, ''));
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => { colMap[h] = i; });

  // Expected columns: PWSID, PWSName, State, Contaminant, AnalyticalResultValue,
  // AnalyticalResultsSign, CollectionDate, MRL, Units
  const pwsidCol = colMap['PWSID'] ?? colMap['PWSId'] ?? -1;
  const nameCol = colMap['PWSName'] ?? colMap['PWS Name'] ?? -1;
  const stateCol = colMap['State'] ?? colMap['STATE'] ?? -1;
  const contCol = colMap['Contaminant'] ?? colMap['CONTAMINANT'] ?? -1;
  const valCol = colMap['AnalyticalResultValue'] ?? colMap['Analytical Result Value'] ?? -1;
  const signCol = colMap['AnalyticalResultsSign'] ?? colMap['AnalyticalResultSign'] ?? -1;
  const dateCol = colMap['CollectionDate'] ?? colMap['Collection Date'] ?? -1;

  if (pwsidCol === -1 || contCol === -1) {
    throw new Error(`UCMR5 column mapping failed. Headers: ${headers.slice(0, 10).join(', ')}`);
  }

  const rows: Ucmr5Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split('\t').map(c => c.trim().replace(/"/g, ''));

    const contaminant = cols[contCol] || '';
    if (!isPfasContaminant(contaminant)) continue;

    const valStr = valCol >= 0 ? cols[valCol] : '';
    const resultValue = valStr ? parseFloat(valStr) : null;
    const sign = signCol >= 0 ? cols[signCol] : '';
    const detected = sign !== '<' && resultValue !== null && !isNaN(resultValue) && resultValue > 0;

    rows.push({
      pwsid: cols[pwsidCol] || '',
      pwsName: nameCol >= 0 ? cols[nameCol] || '' : '',
      state: stateCol >= 0 ? cols[stateCol] || '' : '',
      contaminant,
      resultValue: resultValue !== null && !isNaN(resultValue) ? Math.round(resultValue * 10000) / 10000 : null,
      detected,
      sampleDate: dateCol >= 0 ? cols[dateCol] || '' : '',
    });
  }

  console.log(`[PFAS Cron] Parsed ${rows.length} PFAS rows from ${lines.length - 1} total rows`);
  return rows;
}

// ── JSZip dynamic import ────────────────────────────────────────────────────

async function importJSZip(): Promise<any> {
  try {
    return require('jszip');
  } catch {
    try {
      const mod = await import('jszip');
      return mod.default || mod;
    } catch {
      return null;
    }
  }
}

// ── Geocode PWSIDs via Envirofacts WATER_SYSTEM_FACILITY ─────────────────────

async function geocodePwsids(pwsids: string[]): Promise<Map<string, { lat: number; lng: number }>> {
  const coordMap = new Map<string, { lat: number; lng: number }>();
  const unique = [...new Set(pwsids)];

  console.log(`[PFAS Cron] Geocoding ${unique.length} unique PWSIDs...`);

  // Batch by state prefix (first 2 chars of PWSID) for more efficient queries
  const byState = new Map<string, string[]>();
  for (const id of unique) {
    const st = id.substring(0, 2);
    const arr = byState.get(st) || [];
    arr.push(id);
    byState.set(st, arr);
  }

  let geocoded = 0;
  for (const [state, ids] of byState) {
    // Fetch all facilities for this state in one shot
    try {
      const url = `${EF_BASE}/WATER_SYSTEM_FACILITY/STATE_CODE/${state}/ROWS/0:9999/JSON`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data)) continue;

      const idSet = new Set(ids);
      for (const row of data) {
        const pwsid = row.PWSID || row.PWS_ID || '';
        if (!idSet.has(pwsid)) continue;

        const lat = parseFloat(row.LATITUDE_MEASURE || row.LATITUDE || '');
        const lng = parseFloat(row.LONGITUDE_MEASURE || row.LONGITUDE || '');
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
          coordMap.set(pwsid, {
            lat: Math.round(lat * 100000) / 100000,
            lng: Math.round(lng * 100000) / 100000,
          });
          geocoded++;
        }
      }
    } catch {
      // Skip state on error — we'll have partial geocoding
    }
    await delay(GEO_DELAY_MS);
  }

  console.log(`[PFAS Cron] Geocoded ${geocoded}/${unique.length} PWSIDs`);
  return coordMap;
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
    // Step 1: Download and parse UCMR5 occurrence data
    const rows = await fetchAndParseUcmr5();

    if (rows.length === 0) {
      console.warn('[PFAS Cron] No PFAS rows found in UCMR5 data');
      setPfasCache({
        _meta: {
          built: new Date().toISOString(),
          resultCount: 0,
          tableName: 'UCMR5_ZIP',
          gridCells: 0,
        },
        grid: {},
      });
      return NextResponse.json({
        status: 'complete',
        warning: 'No PFAS rows parsed from UCMR5 data',
        results: 0,
        cache: getPfasCacheStatus(),
      });
    }

    // Step 2: Geocode PWSIDs
    const allPwsids = rows.map(r => r.pwsid).filter(Boolean);
    const coordMap = await geocodePwsids(allPwsids);

    // Step 3: Transform to PfasResult with coordinates
    const results: PfasResult[] = [];
    for (const row of rows) {
      const coords = coordMap.get(row.pwsid);
      if (!coords) continue; // Skip rows we can't geocode

      results.push({
        facilityName: row.pwsName,
        state: row.state,
        contaminant: row.contaminant,
        resultValue: row.resultValue,
        detected: row.detected,
        sampleDate: row.sampleDate,
        lat: coords.lat,
        lng: coords.lng,
      });
    }

    // Deduplicate by facility+contaminant+date
    const dedupMap = new Map<string, PfasResult>();
    for (const r of results) {
      const key = `${r.facilityName}|${r.contaminant}|${r.sampleDate}`;
      if (!dedupMap.has(key)) dedupMap.set(key, r);
    }
    const dedupedResults = Array.from(dedupMap.values());

    // Build Grid Index
    const grid: Record<string, { results: PfasResult[] }> = {};
    for (const r of dedupedResults) {
      const key = gridKey(r.lat, r.lng);
      if (!grid[key]) grid[key] = { results: [] };
      grid[key].results.push(r);
    }

    // Store in memory
    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        resultCount: dedupedResults.length,
        tableName: 'UCMR5_ZIP',
        gridCells: Object.keys(grid).length,
      },
      grid,
    };

    setPfasCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const geocodeRate = results.length > 0
      ? `${Math.round(results.length / rows.length * 100)}% geocoded`
      : '0% geocoded';

    console.log(
      `[PFAS Cron] Build complete in ${elapsed}s — ` +
      `${rows.length} PFAS rows, ${dedupedResults.length} deduplicated, ` +
      `${Object.keys(grid).length} cells (${geocodeRate})`
    );

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      source: 'UCMR5_ZIP',
      totalPfasRows: rows.length,
      geocoded: results.length,
      deduplicated: dedupedResults.length,
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
