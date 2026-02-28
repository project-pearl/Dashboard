// app/api/cron/rebuild-icis/route.ts
// Cron endpoint — fetches EPA ICIS compliance data (permits, violations, DMR,
// enforcement, inspections) for priority states, deduplicates, and populates
// the in-memory spatial cache for instant lookups.
// Schedule: daily via Vercel cron (6 AM UTC) or manual trigger.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setIcisCache, getIcisCacheStatus,
  isIcisBuildInProgress, setIcisBuildInProgress,
  gridKey,
  type IcisPermit, type IcisViolation, type IcisDmr,
  type IcisEnforcement, type IcisInspection,
} from '@/lib/icisCache';

// ── Config ───────────────────────────────────────────────────────────────────

const EF_BASE = 'https://data.epa.gov/efservice';
const PAGE_SIZE = 5000;
const CONCURRENCY = 6;

import { ALL_STATES } from '@/lib/constants';

// DMR parameter description → PEARL key mapping
const DMR_PARAM_TO_PEARL: Record<string, string> = {
  'Dissolved Oxygen': 'DO',
  'Oxygen, dissolved': 'DO',
  'BOD, 5-Day': 'BOD',
  'BOD, 5-day, 20 deg. C': 'BOD',
  'Biochemical oxygen demand': 'BOD',
  'pH': 'pH',
  'pH, Maximum': 'pH',
  'pH, Minimum': 'pH',
  'Total Suspended Solids': 'TSS',
  'Solids, total suspended': 'TSS',
  'Nitrogen, total': 'TN',
  'Nitrogen, Kjeldahl, total': 'TN',
  'Nitrogen, ammonia total': 'TN',
  'Phosphorus, total': 'TP',
  'Phosphorus': 'TP',
  'Fecal Coliform': 'bacteria',
  'E. Coli': 'bacteria',
  'Escherichia coli': 'bacteria',
  'Enterococcus': 'bacteria',
  'Turbidity': 'turbidity',
  'Temperature': 'temperature',
  'Temperature, water deg. centigrade': 'temperature',
  'Specific Conductance': 'conductivity',
  'Conductivity': 'conductivity',
  'Flow': 'flow',
  'Flow, in conduit or thru treatment plant': 'flow',
  'Chlorine, total residual': 'chlorine',
  'Residual Chlorine': 'chlorine',
};

// ── Paginated fetch helper ──────────────────────────────────────────────────

async function fetchTable<T>(
  table: string,
  stateFilter: string,
  stateAbbr: string,
  transform: (row: Record<string, any>) => T | null,
): Promise<T[]> {
  const results: T[] = [];
  let offset = 0;

  while (true) {
    const url = `${EF_BASE}/${table}/${stateFilter}/${stateAbbr}/ROWS/${offset}:${offset + PAGE_SIZE - 1}/JSON`;
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        console.warn(`[ICIS Cron] ${table} ${stateAbbr}: HTTP ${res.status}`);
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
        const item = transform(row);
        if (item !== null) results.push(item);
      }

      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    } catch (e) {
      console.warn(`[ICIS Cron] ${table} ${stateAbbr} page ${offset}: ${e instanceof Error ? e.message : e}`);
      break;
    }
  }

  return results;
}

// ── Row transforms ──────────────────────────────────────────────────────────

function transformPermit(row: Record<string, any>): IcisPermit | null {
  const permitId = row.NPDES_ID || row.EXTERNAL_PERMIT_NMBR || row.external_permit_nmbr || '';
  if (!permitId) return null;

  // ICIS_PERMIT table lacks coordinates — use 0,0 as placeholder
  const lat = parseFloat(row.LATITUDE_MEASURE || row.FAC_LAT || '0');
  const lng = parseFloat(row.LONGITUDE_MEASURE || row.FAC_LONG || '0');

  return {
    permit: permitId,
    facility: row.FACILITY_NAME || row.FAC_NAME || row.permit_name || '',
    state: row.STATE_ABBR || row.FAC_STATE || '',
    status: row.PERMIT_STATUS_CODE || row.permit_status_code || '',
    type: row.PERMIT_TYPE_CODE || row.permit_type_code || '',
    expiration: row.PERMIT_EXPIRATION_DATE || row.expiration_date || '',
    flow: row.DESIGN_FLOW_NMBR || row.total_design_flow_nmbr
      ? parseFloat(row.DESIGN_FLOW_NMBR || row.total_design_flow_nmbr) : null,
    lat: isNaN(lat) ? 0 : Math.round(lat * 100000) / 100000,
    lng: isNaN(lng) ? 0 : Math.round(lng * 100000) / 100000,
  };
}

function transformViolation(row: Record<string, any>): IcisViolation | null {
  const lat = parseFloat(row.LATITUDE_MEASURE || row.FAC_LAT || '');
  const lng = parseFloat(row.LONGITUDE_MEASURE || row.FAC_LONG || '');
  if (isNaN(lat) || isNaN(lng) || lat <= 0) return null;

  return {
    permit: row.NPDES_ID || row.EXTERNAL_PERMIT_NMBR || '',
    code: row.VIOLATION_CODE || row.VIOLATION_TYPE_CODE || '',
    desc: row.VIOLATION_DESC || row.VIOLATION_TYPE_DESC || '',
    date: row.SCHEDULE_DATE || row.RNC_DETECTION_DATE || row.ACTUAL_DATE || '',
    rnc: row.RNC_DETECTION_CODE === 'Y' || row.SNC_FLAG === 'Y',
    severity: row.SEVERITY_IND || row.RNC_RESOLUTION_CODE || '',
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000,
  };
}

function transformDmr(row: Record<string, any>): IcisDmr | null {
  const lat = parseFloat(row.LATITUDE_MEASURE || row.FAC_LAT || '');
  const lng = parseFloat(row.LONGITUDE_MEASURE || row.FAC_LONG || '');
  if (isNaN(lat) || isNaN(lng) || lat <= 0) return null;

  const paramDesc = row.PARAMETER_DESC || row.PARAMETER_SHORT_NAME || '';
  const pearlKey = findPearlKey(paramDesc);

  const dmrVal = row.DMR_VALUE_NMBR ? parseFloat(row.DMR_VALUE_NMBR) : null;
  const limitVal = row.LIMIT_VALUE_NMBR ? parseFloat(row.LIMIT_VALUE_NMBR) : null;
  const exceedance = row.NODI_CODE === 'E' ||
    row.EXCEEDANCE_PCT ? parseFloat(row.EXCEEDANCE_PCT || '0') > 0 : false;

  return {
    permit: row.NPDES_ID || row.EXTERNAL_PERMIT_NMBR || '',
    paramDesc,
    pearlKey,
    dmrValue: dmrVal !== null && !isNaN(dmrVal) ? Math.round(dmrVal * 10000) / 10000 : null,
    limitValue: limitVal !== null && !isNaN(limitVal) ? Math.round(limitVal * 10000) / 10000 : null,
    unit: row.LIMIT_UNIT_DESC || row.STANDARD_UNIT_DESC || '',
    exceedance,
    period: row.MONITORING_PERIOD_END_DATE || '',
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000,
  };
}

function transformEnforcement(row: Record<string, any>): IcisEnforcement | null {
  const lat = parseFloat(row.LATITUDE_MEASURE || row.FAC_LAT || '');
  const lng = parseFloat(row.LONGITUDE_MEASURE || row.FAC_LONG || '');
  if (isNaN(lat) || isNaN(lng) || lat <= 0) return null;

  const assessed = parseFloat(row.FED_PENALTY_ASSESSED_AMT || row.PENALTY_AMOUNT || '0');
  const collected = parseFloat(row.FED_PENALTY_COLLECTED_AMT || '0');

  return {
    permit: row.NPDES_ID || row.EXTERNAL_PERMIT_NMBR || '',
    caseNumber: row.CASE_NUMBER || row.ACTIVITY_ID || '',
    actionType: row.ENF_TYPE_DESC || row.ENFORCEMENT_ACTION_TYPE || '',
    penaltyAssessed: isNaN(assessed) ? 0 : assessed,
    penaltyCollected: isNaN(collected) ? 0 : collected,
    settlementDate: row.SETTLEMENT_ENTERED_DATE || row.ACHIEVED_DATE || '',
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000,
  };
}

function transformInspection(row: Record<string, any>): IcisInspection | null {
  const lat = parseFloat(row.LATITUDE_MEASURE || row.FAC_LAT || '');
  const lng = parseFloat(row.LONGITUDE_MEASURE || row.FAC_LONG || '');
  if (isNaN(lat) || isNaN(lng) || lat <= 0) return null;

  return {
    permit: row.NPDES_ID || row.EXTERNAL_PERMIT_NMBR || '',
    type: row.INSPECTION_TYPE_CODE || row.COMP_MONITOR_TYPE_DESC || '',
    date: row.ACTUAL_BEGIN_DATE || row.ACTUAL_END_DATE || '',
    complianceStatus: row.COMP_DETERMINATION_CODE || row.STATE_EPA_FLAG || '',
    leadAgency: row.LEAD_AGENCY || row.STATE_EPA_FLAG || '',
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function findPearlKey(paramDesc: string): string {
  // Exact match first
  if (DMR_PARAM_TO_PEARL[paramDesc]) return DMR_PARAM_TO_PEARL[paramDesc];
  // Case-insensitive partial match
  const lower = paramDesc.toLowerCase();
  for (const [key, pearl] of Object.entries(DMR_PARAM_TO_PEARL)) {
    if (lower.includes(key.toLowerCase())) return pearl;
  }
  return 'other';
}

// ── ECHO violation fetch (replaces retired ICIS_VIOLATION table) ─────────────

const ECHO_CWA_QUERY = 'https://echodata.epa.gov/echo/cwa_rest_services.get_facilities';
const ECHO_CWA_QID   = 'https://echodata.epa.gov/echo/cwa_rest_services.get_qid';

async function fetchEchoViolations(stateAbbr: string): Promise<IcisViolation[]> {
  try {
    // Step 1: get QueryID (p_qiv=Y = violating facilities only)
    const queryUrl = `${ECHO_CWA_QUERY}?output=JSON&p_st=${stateAbbr}&p_qiv=Y`;
    const qRes = await fetch(queryUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!qRes.ok) {
      console.warn(`[ICIS Cron] ECHO violations ${stateAbbr}: HTTP ${qRes.status}`);
      return [];
    }
    const qJson = await qRes.json();
    const qid = qJson?.Results?.QueryID;
    const totalRows = parseInt(qJson?.Results?.QueryRows || '0', 10);
    if (!qid || totalRows === 0) return [];

    console.log(`[ICIS Cron] ECHO violations ${stateAbbr}: QID=${qid}, rows=${totalRows}`);

    // Step 2: paginated JSON results
    const results: IcisViolation[] = [];
    let pageNo = 1;
    const PAGE = 5000;

    while (results.length < totalRows) {
      const qidUrl = `${ECHO_CWA_QID}?output=JSON&qid=${qid}&responseset=${PAGE}&pageno=${pageNo}`;
      const dRes = await fetch(qidUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(60_000),
      });
      if (!dRes.ok) {
        console.warn(`[ICIS Cron] ECHO violations ${stateAbbr} page ${pageNo}: HTTP ${dRes.status}`);
        break;
      }
      const dJson = await dRes.json();
      const facilities = dJson?.Results?.Facilities || [];
      if (facilities.length === 0) break;

      for (const f of facilities) {
        const lat = parseFloat(f.FacLat || '');
        const lng = parseFloat(f.FacLong || '');
        if (isNaN(lat) || isNaN(lng) || Math.abs(lat) < 1) continue;

        const sncStatus = (f.CWPSNCStatus || '').trim();
        results.push({
          permit: (f.SourceID || '').trim(),
          code: (f.CWPVioStatus || '').trim(),
          desc: (f.CWPVioStatus || '').trim(),
          date: new Date().toISOString().slice(0, 10), // ECHO gives facility status, not individual dates
          rnc: sncStatus.startsWith('S'),
          severity: sncStatus,
          lat: Math.round(lat * 100000) / 100000,
          lng: Math.round(lng * 100000) / 100000,
        });
      }

      if (facilities.length < PAGE) break;
      pageNo++;
    }

    return results;
  } catch (e) {
    console.warn(`[ICIS Cron] ECHO violations ${stateAbbr}: ${e instanceof Error ? e.message : e}`);
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
  if (isIcisBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'ICIS build already in progress',
      cache: getIcisCacheStatus(),
    });
  }

  setIcisBuildInProgress(true);
  const startTime = Date.now();
  const stateResults: Record<string, Record<string, number>> = {};

  try {
    const allPermits: IcisPermit[] = [];
    const allViolations: IcisViolation[] = [];
    const allDmr: IcisDmr[] = [];
    const allEnforcement: IcisEnforcement[] = [];
    const allInspections: IcisInspection[] = [];
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
              console.log(`[ICIS Cron] Fetching ${stateAbbr}...`);

              // Fetch tables in parallel: permits/DMR/enforcement from Envirofacts,
              // violations from ECHO (Envirofacts ICIS_VIOLATION is retired),
              // inspections skipped (low value, Envirofacts table retired)
              const [permits, violations, dmr, enforcement, inspections] = await Promise.all([
                fetchTable('ICIS_PERMIT', 'STATE_ABBR', stateAbbr, transformPermit)
                  .then(rows => rows.map(r => ({ ...r, state: r.state || stateAbbr }))),
                fetchEchoViolations(stateAbbr),
                fetchTable('ICIS_DMR', 'STATE_ABBR', stateAbbr, transformDmr),
                fetchTable('ICIS_ENFORCEMENT', 'STATE_ABBR', stateAbbr, transformEnforcement),
                Promise.resolve([]) as Promise<IcisInspection[]>,  // inspections — retired, skip
              ]);

              // Deduplicate permits by permit number
              const permitMap = new Map<string, IcisPermit>();
              for (const p of permits) {
                if (!permitMap.has(p.permit)) permitMap.set(p.permit, p);
              }
              const dedupedPermits = Array.from(permitMap.values());

              // Deduplicate violations by permit|code|date
              const violationMap = new Map<string, IcisViolation>();
              for (const v of violations) {
                const key = `${v.permit}|${v.code}|${v.date}`;
                if (!violationMap.has(key)) violationMap.set(key, v);
              }
              const dedupedViolations = Array.from(violationMap.values());

              // Deduplicate DMR by permit|param|period
              const dmrMap = new Map<string, IcisDmr>();
              for (const d of dmr) {
                const key = `${d.permit}|${d.paramDesc}|${d.period}`;
                if (!dmrMap.has(key)) dmrMap.set(key, d);
              }
              const dedupedDmr = Array.from(dmrMap.values());

              // Deduplicate enforcement by case number
              const enfMap = new Map<string, IcisEnforcement>();
              for (const e of enforcement) {
                if (!enfMap.has(e.caseNumber)) enfMap.set(e.caseNumber, e);
              }
              const dedupedEnforcement = Array.from(enfMap.values());

              // Deduplicate inspections by permit|date|type
              const inspMap = new Map<string, IcisInspection>();
              for (const i of inspections) {
                const key = `${i.permit}|${i.date}|${i.type}`;
                if (!inspMap.has(key)) inspMap.set(key, i);
              }
              const dedupedInspections = Array.from(inspMap.values());

              allPermits.push(...dedupedPermits);
              allViolations.push(...dedupedViolations);
              allDmr.push(...dedupedDmr);
              allEnforcement.push(...dedupedEnforcement);
              allInspections.push(...dedupedInspections);
              processedStates.push(stateAbbr);

              stateResults[stateAbbr] = {
                permits: dedupedPermits.length,
                violations: dedupedViolations.length,
                dmr: dedupedDmr.length,
                enforcement: dedupedEnforcement.length,
                inspections: dedupedInspections.length,
              };

              console.log(
                `[ICIS Cron] ${stateAbbr}: ${dedupedPermits.length} permits, ` +
                `${dedupedViolations.length} violations, ${dedupedDmr.length} DMR, ` +
                `${dedupedEnforcement.length} enforcement, ${dedupedInspections.length} inspections`
              );
            } catch (e) {
              console.warn(`[ICIS Cron] ${stateAbbr} failed (will retry):`, e instanceof Error ? e.message : e);
              stateResults[stateAbbr] = { permits: -1, violations: 0, dmr: 0, enforcement: 0, inspections: 0 }; // -1 = needs retry
            } finally {
              running--;
              next();
            }
          })();
        }
      }
      next();
    });

    // ── Retry failed states once with 5s backoff ────────────────────────────
    const retryStates = Object.entries(stateResults)
      .filter(([, v]) => v.permits === -1)
      .map(([s]) => s);

    if (retryStates.length > 0) {
      console.log(`[ICIS Cron] Retrying ${retryStates.length} failed states: ${retryStates.join(', ')}`);
      await new Promise(r => setTimeout(r, 5000));

      for (const stateAbbr of retryStates) {
        try {
          const [permits, violations, dmr, enforcement, inspections] = await Promise.all([
            fetchTable('ICIS_PERMIT', 'STATE_ABBR', stateAbbr, transformPermit)
              .then(rows => rows.map(r => ({ ...r, state: r.state || stateAbbr }))),
            fetchEchoViolations(stateAbbr),
            fetchTable('ICIS_DMR', 'STATE_ABBR', stateAbbr, transformDmr),
            fetchTable('ICIS_ENFORCEMENT', 'STATE_ABBR', stateAbbr, transformEnforcement),
            Promise.resolve([]) as Promise<IcisInspection[]>,
          ]);

          const dedupedPermits = Array.from(new Map(permits.map(p => [p.permit, p])).values());
          allPermits.push(...dedupedPermits);
          allViolations.push(...violations);
          allDmr.push(...dmr);
          allEnforcement.push(...enforcement);
          allInspections.push(...inspections);
          processedStates.push(stateAbbr);
          stateResults[stateAbbr] = {
            permits: dedupedPermits.length, violations: violations.length,
            dmr: dmr.length, enforcement: enforcement.length, inspections: inspections.length,
          };
          console.log(`[ICIS Cron] ${stateAbbr} retry succeeded: ${dedupedPermits.length} permits`);
        } catch (e) {
          console.warn(`[ICIS Cron] ${stateAbbr} retry failed:`, e instanceof Error ? e.message : e);
          stateResults[stateAbbr] = { permits: 0, violations: 0, dmr: 0, enforcement: 0, inspections: 0 };
        }
      }
    }

    // ── Build Grid Index ───────────────────────────────────────────────────
    const grid: Record<string, {
      permits: IcisPermit[];
      violations: IcisViolation[];
      dmr: IcisDmr[];
      enforcement: IcisEnforcement[];
      inspections: IcisInspection[];
    }> = {};

    const emptyCell = () => ({
      permits: [] as IcisPermit[],
      violations: [] as IcisViolation[],
      dmr: [] as IcisDmr[],
      enforcement: [] as IcisEnforcement[],
      inspections: [] as IcisInspection[],
    });

    for (const p of allPermits) {
      const key = gridKey(p.lat, p.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].permits.push(p);
    }
    for (const v of allViolations) {
      const key = gridKey(v.lat, v.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].violations.push(v);
    }
    for (const d of allDmr) {
      const key = gridKey(d.lat, d.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].dmr.push(d);
    }
    for (const e of allEnforcement) {
      const key = gridKey(e.lat, e.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].enforcement.push(e);
    }
    for (const i of allInspections) {
      const key = gridKey(i.lat, i.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].inspections.push(i);
    }

    // ── Store in memory ────────────────────────────────────────────────────
    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        permitCount: allPermits.length,
        violationCount: allViolations.length,
        dmrCount: allDmr.length,
        enforcementCount: allEnforcement.length,
        inspectionCount: allInspections.length,
        statesProcessed: processedStates,
        gridCells: Object.keys(grid).length,
      },
      grid,
    };

    if (allPermits.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[ICIS Cron] 0 permits fetched in ${elapsed}s — skipping cache save`);
      return NextResponse.json({ status: 'empty', duration: `${elapsed}s`, cache: getIcisCacheStatus() });
    }

    await setIcisCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[ICIS Cron] Build complete in ${elapsed}s — ` +
      `${allPermits.length} permits, ${allViolations.length} violations, ` +
      `${allDmr.length} DMR, ${allEnforcement.length} enforcement, ` +
      `${allInspections.length} inspections, ${Object.keys(grid).length} cells`
    );

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      permits: allPermits.length,
      violations: allViolations.length,
      dmr: allDmr.length,
      enforcement: allEnforcement.length,
      inspections: allInspections.length,
      gridCells: Object.keys(grid).length,
      statesProcessed: processedStates.length,
      states: stateResults,
      cache: getIcisCacheStatus(),
    });

  } catch (err: any) {
    console.error('[ICIS Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'ICIS build failed' },
      { status: 500 },
    );
  } finally {
    setIcisBuildInProgress(false);
  }
}
