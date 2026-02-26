// app/api/cron/rebuild-echo/route.ts
// Cron endpoint — fetches EPA ECHO facility compliance data (facilities +
// violations) for priority states, deduplicates, and populates the in-memory
// spatial cache for instant lookups.
// Schedule: daily via Vercel cron (9 AM UTC) or manual trigger.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setEchoCache, getEchoCacheStatus,
  isEchoBuildInProgress, setEchoBuildInProgress,
  gridKey,
  type EchoFacility, type EchoViolation,
} from '@/lib/echoCache';

// ── Config ───────────────────────────────────────────────────────────────────

const ECHO_QUERY = 'https://echodata.epa.gov/echo/cwa_rest_services.get_facilities';
const ECHO_QID   = 'https://echodata.epa.gov/echo/cwa_rest_services.get_qid';
const ECHO_DL    = 'https://echodata.epa.gov/echo/cwa_rest_services.get_download';
const CONCURRENCY = 6;
// Columns we request: basic info (1-9), coords (24-25), compliance (97-101)
const DL_QCOLS = '1,2,3,4,5,9,24,25,97,98,99,101';

import { ALL_STATES } from '@/lib/constants';

// ── CSV parser (no external deps) ───────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV split — handles quoted fields with commas
    const vals: string[] = [];
    let cur = '';
    let inQuote = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { vals.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    vals.push(cur.trim());
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = vals[j] || '';
    rows.push(row);
  }
  return rows;
}

// ── ECHO two-step fetch: get_facilities → QueryID → get_download (CSV) ──────

async function fetchEchoFacilities(stateAbbr: string): Promise<EchoFacility[]> {
  try {
    // Step 1: get QueryID
    const queryUrl = `${ECHO_QUERY}?output=JSON&p_st=${stateAbbr}&qcolumns=${DL_QCOLS}`;
    const qRes = await fetch(queryUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!qRes.ok) {
      console.warn(`[ECHO Cron] Facilities ${stateAbbr} query: HTTP ${qRes.status}`);
      return [];
    }
    const qJson = await qRes.json();
    const qid = qJson?.Results?.QueryID;
    const totalRows = parseInt(qJson?.Results?.QueryRows || '0', 10);
    if (!qid || totalRows === 0) return [];

    console.log(`[ECHO Cron] ${stateAbbr} facilities: QID=${qid}, rows=${totalRows}`);

    // Step 2: download CSV (paginated — ECHO returns up to 5000 rows per page)
    const results: EchoFacility[] = [];
    let pageNo = 1;
    const PAGE_SIZE = 5000;

    while (results.length < totalRows) {
      const dlUrl = `${ECHO_DL}?qid=${qid}&qcolumns=${DL_QCOLS}&pageno=${pageNo}&pagesize=${PAGE_SIZE}`;
      const dlRes = await fetch(dlUrl, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!dlRes.ok) {
        console.warn(`[ECHO Cron] Facilities ${stateAbbr} download page ${pageNo}: HTTP ${dlRes.status}`);
        break;
      }
      const csv = await dlRes.text();
      const rows = parseCSV(csv);
      if (rows.length === 0) break;

      for (const f of rows) {
        const lat = parseFloat(f.FacLat || '');
        const lng = parseFloat(f.FacLong || '');
        if (isNaN(lat) || isNaN(lng) || Math.abs(lat) < 1) continue;

        results.push({
          registryId: f.RegistryID || f.SourceID || '',
          name: (f.CWPName || '').trim(),
          state: (f.CWPState || stateAbbr).trim(),
          permitId: (f.SourceID || '').trim(),
          lat: Math.round(lat * 100000) / 100000,
          lng: Math.round(lng * 100000) / 100000,
          complianceStatus: (f.CWPSNCStatus || f.CWPStatus || '').trim(),
          qtrsInViolation: parseInt(f.CWPQtrsWithNC || '0', 10) || 0,
        });
      }

      if (rows.length < PAGE_SIZE) break;
      pageNo++;
    }

    return results;
  } catch (e) {
    console.warn(`[ECHO Cron] Facilities ${stateAbbr}: ${e instanceof Error ? e.message : e}`);
    return [];
  }
}

async function fetchEchoViolations(stateAbbr: string): Promise<EchoViolation[]> {
  try {
    // Step 1: get QueryID (p_qiv=Y filters to violating facilities)
    const queryUrl = `${ECHO_QUERY}?output=JSON&p_st=${stateAbbr}&p_qiv=Y&qcolumns=${DL_QCOLS}`;
    const qRes = await fetch(queryUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!qRes.ok) {
      console.warn(`[ECHO Cron] Violations ${stateAbbr} query: HTTP ${qRes.status}`);
      return [];
    }
    const qJson = await qRes.json();
    const qid = qJson?.Results?.QueryID;
    const totalRows = parseInt(qJson?.Results?.QueryRows || '0', 10);
    if (!qid || totalRows === 0) return [];

    console.log(`[ECHO Cron] ${stateAbbr} violations: QID=${qid}, rows=${totalRows}`);

    // Step 2: download CSV
    const results: EchoViolation[] = [];
    let pageNo = 1;
    const PAGE_SIZE = 5000;

    while (results.length < totalRows) {
      const dlUrl = `${ECHO_DL}?qid=${qid}&qcolumns=${DL_QCOLS}&pageno=${pageNo}&pagesize=${PAGE_SIZE}`;
      const dlRes = await fetch(dlUrl, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!dlRes.ok) {
        console.warn(`[ECHO Cron] Violations ${stateAbbr} download page ${pageNo}: HTTP ${dlRes.status}`);
        break;
      }
      const csv = await dlRes.text();
      const rows = parseCSV(csv);
      if (rows.length === 0) break;

      for (const f of rows) {
        const lat = parseFloat(f.FacLat || '');
        const lng = parseFloat(f.FacLong || '');
        if (isNaN(lat) || isNaN(lng) || Math.abs(lat) < 1) continue;

        results.push({
          registryId: f.RegistryID || f.SourceID || '',
          name: (f.CWPName || '').trim(),
          state: (f.CWPState || stateAbbr).trim(),
          lat: Math.round(lat * 100000) / 100000,
          lng: Math.round(lng * 100000) / 100000,
          violationType: (f.CWPVioStatus || f.CWPViolStatus || '').trim(),
          pollutant: '',
          qtrsInNc: parseInt(f.CWPQtrsWithNC || '0', 10) || 0,
        });
      }

      if (rows.length < PAGE_SIZE) break;
      pageNo++;
    }

    return results;
  } catch (e) {
    console.warn(`[ECHO Cron] Violations ${stateAbbr}: ${e instanceof Error ? e.message : e}`);
    return [];
  }
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
  if (isEchoBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'ECHO build already in progress',
      cache: getEchoCacheStatus(),
    });
  }

  setEchoBuildInProgress(true);
  const startTime = Date.now();
  const stateResults: Record<string, Record<string, number>> = {};

  try {
    const allFacilities: EchoFacility[] = [];
    const allViolations: EchoViolation[] = [];
    const processedStates: string[] = [];

    // Semaphore-based parallel fetching (6 states at a time)
    const queue = [...ALL_STATES];
    let running = 0;
    let qIdx = 0;

    await new Promise<void>((resolve) => {
      function next() {
        if (qIdx >= queue.length && running === 0) return resolve();
        while (running < CONCURRENCY && qIdx < queue.length) {
          const stateAbbr = queue[qIdx++];
          running++;
          (async () => {
            try {
              console.log(`[ECHO Cron] Fetching ${stateAbbr}...`);

              const [facilities, violations] = await Promise.allSettled([
                fetchEchoFacilities(stateAbbr),
                fetchEchoViolations(stateAbbr),
              ]);

              const rawFacilities = facilities.status === 'fulfilled' ? facilities.value : [];
              const rawViolations = violations.status === 'fulfilled' ? violations.value : [];

              // Deduplicate facilities by registryId
              const facMap = new Map<string, EchoFacility>();
              for (const f of rawFacilities) {
                if (!facMap.has(f.registryId)) facMap.set(f.registryId, f);
              }
              const dedupedFacilities = Array.from(facMap.values());

              // Deduplicate violations by registryId
              const violMap = new Map<string, EchoViolation>();
              for (const v of rawViolations) {
                if (!violMap.has(v.registryId)) violMap.set(v.registryId, v);
              }
              const dedupedViolations = Array.from(violMap.values());

              allFacilities.push(...dedupedFacilities);
              allViolations.push(...dedupedViolations);
              processedStates.push(stateAbbr);

              stateResults[stateAbbr] = {
                facilities: dedupedFacilities.length,
                violations: dedupedViolations.length,
              };

              console.log(
                `[ECHO Cron] ${stateAbbr}: ${dedupedFacilities.length} facilities, ` +
                `${dedupedViolations.length} violations`
              );
            } catch (e) {
              console.warn(`[ECHO Cron] ${stateAbbr} failed:`, e instanceof Error ? e.message : e);
              stateResults[stateAbbr] = { facilities: 0, violations: 0 };
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
    const grid: Record<string, {
      facilities: EchoFacility[];
      violations: EchoViolation[];
    }> = {};

    const emptyCell = () => ({
      facilities: [] as EchoFacility[],
      violations: [] as EchoViolation[],
    });

    for (const f of allFacilities) {
      const key = gridKey(f.lat, f.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].facilities.push(f);
    }
    for (const v of allViolations) {
      const key = gridKey(v.lat, v.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].violations.push(v);
    }

    // ── Store in memory ────────────────────────────────────────────────────
    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        facilityCount: allFacilities.length,
        violationCount: allViolations.length,
        statesProcessed: processedStates,
        gridCells: Object.keys(grid).length,
      },
      grid,
    };

    if (allFacilities.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[ECHO Cron] 0 facilities fetched in ${elapsed}s — skipping cache save`);
      return NextResponse.json({ status: 'empty', duration: `${elapsed}s`, cache: getEchoCacheStatus() });
    }

    await setEchoCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[ECHO Cron] Build complete in ${elapsed}s — ` +
      `${allFacilities.length} facilities, ${allViolations.length} violations, ` +
      `${Object.keys(grid).length} cells`
    );

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      facilities: allFacilities.length,
      violations: allViolations.length,
      gridCells: Object.keys(grid).length,
      statesProcessed: processedStates.length,
      states: stateResults,
      cache: getEchoCacheStatus(),
    });

  } catch (err: any) {
    console.error('[ECHO Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'ECHO build failed' },
      { status: 500 },
    );
  } finally {
    setEchoBuildInProgress(false);
  }
}
