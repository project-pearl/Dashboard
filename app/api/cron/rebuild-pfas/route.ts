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

// ZIP code centroid lookup for geocoding PWSIDs → lat/lng
const ZIP_API_BASE = 'https://api.zippopotam.us/us';
const ZIP_BATCH_SIZE = 20;  // Concurrent ZIP code lookups
const ZIP_DELAY_MS = 200;   // Delay between batches

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

async function fetchAndParseUcmr5(): Promise<{ rows: Ucmr5Row[]; pwsidToZip: Map<string, string> }> {
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
  const allFiles = Object.keys(zip.files);
  console.log(`[PFAS Cron] ZIP contains: ${allFiles.join(', ')}`);

  // Target the main occurrence file specifically (UCMR5_All.txt, ~295MB uncompressed)
  const targetFile = allFiles.find(f => /ucmr5[_-]?all/i.test(f))
    || allFiles.find(f => f.toLowerCase().includes('ucmr5') && !f.toLowerCase().includes('addtl') && !f.toLowerCase().includes('zip') && !f.toLowerCase().includes('summary') && !f.toLowerCase().includes('instruction') && f.endsWith('.txt'))
    || allFiles.find(f => f.endsWith('.txt') || f.endsWith('.tsv'));

  if (!targetFile) throw new Error('No occurrence data file found in UCMR5 ZIP');

  console.log(`[PFAS Cron] Stream-parsing ${targetFile}...`);

  // Stream-parse the large file (~295 MB) line by line to avoid OOM.
  // JSZip nodeStream returns a Node ReadableStream; we buffer lines manually.
  const rows: Ucmr5Row[] = [];
  let totalLines = 0;

  let pwsidCol = -1, nameCol = -1, contCol = -1, valCol = -1, signCol = -1, dateCol = -1;
  let headerParsed = false;
  let remainder = '';

  await new Promise<void>((resolve, reject) => {
    const stream = zip.files[targetFile].nodeStream('nodebuffer');
    stream.on('data', (chunk: Buffer) => {
      const text = remainder + chunk.toString('utf8');
      const lines = text.split('\n');
      remainder = lines.pop() || ''; // Last partial line

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (!headerParsed) {
          const headers = line.split('\t').map(h => h.trim().replace(/"/g, ''));
          const colMap: Record<string, number> = {};
          headers.forEach((h, i) => { colMap[h] = i; });

          pwsidCol = colMap['PWSID'] ?? colMap['PWSId'] ?? -1;
          nameCol = colMap['PWSName'] ?? colMap['PWS Name'] ?? -1;
          contCol = colMap['Contaminant'] ?? colMap['CONTAMINANT'] ?? -1;
          valCol = colMap['AnalyticalResultValue'] ?? colMap['Analytical Result Value'] ?? -1;
          signCol = colMap['AnalyticalResultsSign'] ?? colMap['AnalyticalResultSign'] ?? -1;
          dateCol = colMap['CollectionDate'] ?? colMap['Collection Date'] ?? -1;

          if (pwsidCol === -1 || contCol === -1) {
            stream.destroy();
            return reject(new Error(`UCMR5 column mapping failed. Headers: ${headers.slice(0, 10).join(', ')}`));
          }
          headerParsed = true;
          continue;
        }

        totalLines++;
        const cols = line.split('\t').map(c => c.trim().replace(/"/g, ''));
        const contaminant = cols[contCol] || '';
        if (!isPfasContaminant(contaminant)) continue;

        const valStr = valCol >= 0 ? cols[valCol] : '';
        const resultValue = valStr ? parseFloat(valStr) : null;
        const sign = signCol >= 0 ? cols[signCol] : '';
        const detected = sign !== '<' && resultValue !== null && !isNaN(resultValue) && resultValue > 0;

        const pwsid = cols[pwsidCol] || '';
        rows.push({
          pwsid,
          pwsName: nameCol >= 0 ? cols[nameCol] || '' : '',
          state: pwsid.substring(0, 2),
          contaminant,
          resultValue: resultValue !== null && !isNaN(resultValue) ? Math.round(resultValue * 10000) / 10000 : null,
          detected,
          sampleDate: dateCol >= 0 ? cols[dateCol] || '' : '',
        });
      }
    });
    stream.on('end', () => {
      // Process any final line in remainder
      if (remainder.trim() && headerParsed) {
        totalLines++;
        const cols = remainder.trim().split('\t').map(c => c.trim().replace(/"/g, ''));
        const contaminant = cols[contCol] || '';
        if (isPfasContaminant(contaminant)) {
          const valStr = valCol >= 0 ? cols[valCol] : '';
          const resultValue = valStr ? parseFloat(valStr) : null;
          const sign = signCol >= 0 ? cols[signCol] : '';
          const detected = sign !== '<' && resultValue !== null && !isNaN(resultValue) && resultValue > 0;
          const pwsid = cols[pwsidCol] || '';
          rows.push({
            pwsid,
            pwsName: nameCol >= 0 ? cols[nameCol] || '' : '',
            state: pwsid.substring(0, 2),
            contaminant,
            resultValue: resultValue !== null && !isNaN(resultValue) ? Math.round(resultValue * 10000) / 10000 : null,
            detected,
            sampleDate: dateCol >= 0 ? cols[dateCol] || '' : '',
          });
        }
      }
      resolve();
    });
    stream.on('error', reject);
  });

  console.log(`[PFAS Cron] Parsed ${rows.length} PFAS rows from ${totalLines} total rows`);

  // Parse UCMR5_ZIPCodes.txt for PWSID → ZIP code mapping
  const pwsidToZip = new Map<string, string>();
  const zipFile = allFiles.find(f => /zipcodes/i.test(f) && f.endsWith('.txt'));
  if (zipFile) {
    const zipContent = await zip.files[zipFile].async('string');
    const zipLines = zipContent.split('\n');
    if (zipLines.length > 1) {
      const zipHeaders = zipLines[0].split('\t').map(h => h.trim().replace(/"/g, ''));
      const zpwsidCol = zipHeaders.findIndex(h => /pwsid/i.test(h));
      const zzipCol = zipHeaders.findIndex(h => /zip/i.test(h));
      if (zpwsidCol >= 0 && zzipCol >= 0) {
        for (let i = 1; i < zipLines.length; i++) {
          const parts = zipLines[i].split('\t').map(c => c.trim().replace(/"/g, ''));
          const id = parts[zpwsidCol] || '';
          const zc = (parts[zzipCol] || '').replace(/-.*/, '').substring(0, 5);
          if (id && zc && /^\d{5}$/.test(zc)) pwsidToZip.set(id, zc);
        }
      }
    }
    console.log(`[PFAS Cron] Loaded ${pwsidToZip.size} PWSID → ZIP code mappings`);
  }

  return { rows, pwsidToZip };
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

// ── Geocode PWSIDs via ZIP code centroids ────────────────────────────────────

async function geocodePwsids(
  pwsidToZip: Map<string, string>,
): Promise<Map<string, { lat: number; lng: number }>> {
  const coordMap = new Map<string, { lat: number; lng: number }>();

  // Collect unique ZIP codes
  const uniqueZips = [...new Set(pwsidToZip.values())];
  console.log(`[PFAS Cron] Geocoding ${uniqueZips.length} unique ZIP codes...`);

  // Batch fetch ZIP centroids from Zippopotam.us
  const zipCoords = new Map<string, { lat: number; lng: number }>();
  let fetched = 0;

  for (let i = 0; i < uniqueZips.length; i += ZIP_BATCH_SIZE) {
    const batch = uniqueZips.slice(i, i + ZIP_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (zip) => {
        try {
          const res = await fetch(`${ZIP_API_BASE}/${zip}`, {
            signal: AbortSignal.timeout(5_000),
          });
          if (!res.ok) return null;
          const data = await res.json();
          const place = data?.places?.[0];
          if (!place) return null;
          const lat = parseFloat(place.latitude);
          const lng = parseFloat(place.longitude);
          if (isNaN(lat) || isNaN(lng)) return null;
          return { zip, lat, lng };
        } catch {
          return null;
        }
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        zipCoords.set(r.value.zip, { lat: r.value.lat, lng: r.value.lng });
        fetched++;
      }
    }

    if (i + ZIP_BATCH_SIZE < uniqueZips.length) {
      await delay(ZIP_DELAY_MS);
    }
  }

  console.log(`[PFAS Cron] Resolved ${fetched}/${uniqueZips.length} ZIP codes`);

  // Map PWSIDs to coordinates via their ZIP codes
  for (const [pwsid, zip] of pwsidToZip) {
    const coords = zipCoords.get(zip);
    if (coords) {
      coordMap.set(pwsid, {
        lat: Math.round(coords.lat * 100000) / 100000,
        lng: Math.round(coords.lng * 100000) / 100000,
      });
    }
  }

  console.log(`[PFAS Cron] Geocoded ${coordMap.size}/${pwsidToZip.size} PWSIDs`);
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
    // Step 1: Download and parse UCMR5 occurrence data + ZIP code mapping
    const { rows, pwsidToZip } = await fetchAndParseUcmr5();

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

    // Step 2: Geocode PWSIDs via ZIP code centroids
    const coordMap = await geocodePwsids(pwsidToZip);

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
