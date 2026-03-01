/**
 * ICIS State Fetcher — Reusable per-state ICIS data fetch.
 *
 * Extracted from rebuild-icis cron. Returns flat arrays (permits, violations,
 * dmr, enforcement) — NOT grid-indexed. Grid indexing stays in icisCache
 * for spatial lookups.
 *
 * Used by:
 *  - rebuild-icis cron (via getOrRefresh per state)
 *  - cache-refresh API (user-triggered "Update Now")
 */

import type {
  IcisPermit, IcisViolation, IcisDmr, IcisEnforcement, IcisInspection,
} from './icisCache';

export interface IcisStateSnapshot {
  permits: IcisPermit[];
  violations: IcisViolation[];
  dmr: IcisDmr[];
  enforcement: IcisEnforcement[];
  inspections: IcisInspection[];
  state: string;
  fetchedAt: string;
}

// ── Config ───────────────────────────────────────────────────────────────────

const EF_BASE = 'https://data.epa.gov/efservice';
const PAGE_SIZE = 5000;
const ECHO_CWA_QUERY = 'https://echodata.epa.gov/echo/cwa_rest_services.get_facilities';
const ECHO_CWA_QID = 'https://echodata.epa.gov/echo/cwa_rest_services.get_qid';

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
        console.warn(`[ICIS Fetcher] ${table} ${stateAbbr}: HTTP ${res.status}`);
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
      console.warn(`[ICIS Fetcher] ${table} ${stateAbbr} page ${offset}: ${e instanceof Error ? e.message : e}`);
      break;
    }
  }

  return results;
}

// ── Row transforms ──────────────────────────────────────────────────────────

function transformPermit(row: Record<string, any>): IcisPermit | null {
  const permitId = row.NPDES_ID || row.EXTERNAL_PERMIT_NMBR || row.external_permit_nmbr || '';
  if (!permitId) return null;

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
  const caseNumber = row.enf_identifier || row.CASE_NUMBER || row.ACTIVITY_ID
    || row.ENFORCEMENT_ACTION_IDENTIFIER || row.activity_id || '';
  const permit = row.NPDES_ID || row.EXTERNAL_PERMIT_NMBR
    || row.enf_name || '';
  if (!permit && !caseNumber) return null;

  const assessed = parseFloat(
    row.total_penalty_assessed_amt || row.FED_PENALTY_ASSESSED_AMT
    || row.PENALTY_AMOUNT || '0'
  );
  const collected = parseFloat(
    row.total_cost_recovery_amt || row.FED_PENALTY_COLLECTED_AMT || '0'
  );

  return {
    permit,
    caseNumber,
    actionType: row.enf_outcome_code || row.ENF_TYPE_DESC || row.ENFORCEMENT_ACTION_TYPE
      || row.ENFORCEMENT_ACTION_TYPE_CODE || row.hq_division || '',
    penaltyAssessed: isNaN(assessed) ? 0 : assessed,
    penaltyCollected: isNaN(collected) ? 0 : collected,
    settlementDate: row.achieved_date || row.filed_date
      || row.SETTLEMENT_ENTERED_DATE || row.ACHIEVED_DATE
      || row.FINAL_ORDER_ENTERED_DATE || row.ENFORCEMENT_ACTION_DATE || '',
    lat: 0,
    lng: 0,
  };
}

function findPearlKey(paramDesc: string): string {
  if (DMR_PARAM_TO_PEARL[paramDesc]) return DMR_PARAM_TO_PEARL[paramDesc];
  const lower = paramDesc.toLowerCase();
  for (const [key, pearl] of Object.entries(DMR_PARAM_TO_PEARL)) {
    if (lower.includes(key.toLowerCase())) return pearl;
  }
  return 'other';
}

// ── ECHO facility coordinate fetch ──────────────────────────────────────────

async function fetchEchoFacilityCoords(stateAbbr: string): Promise<Map<string, { lat: number; lng: number }>> {
  const coords = new Map<string, { lat: number; lng: number }>();
  try {
    const queryUrl = `${ECHO_CWA_QUERY}?output=JSON&p_st=${stateAbbr}`;
    const qRes = await fetch(queryUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!qRes.ok) return coords;
    const qJson = await qRes.json();
    const qid = qJson?.Results?.QueryID;
    const totalRows = parseInt(qJson?.Results?.QueryRows || '0', 10);
    if (!qid || totalRows === 0) return coords;

    let pageNo = 1;
    const PAGE = 5000;
    let fetched = 0;

    while (fetched < totalRows) {
      const qidUrl = `${ECHO_CWA_QID}?output=JSON&qid=${qid}&responseset=${PAGE}&pageno=${pageNo}`;
      const dRes = await fetch(qidUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(60_000),
      });
      if (!dRes.ok) break;
      const dJson = await dRes.json();
      const facilities = dJson?.Results?.Facilities || [];
      if (facilities.length === 0) break;

      for (const f of facilities) {
        const lat = parseFloat(f.FacLat || '');
        const lng = parseFloat(f.FacLong || '');
        if (isNaN(lat) || isNaN(lng) || Math.abs(lat) < 1) continue;
        const permitId = (f.SourceID || '').trim();
        if (permitId) {
          coords.set(permitId, {
            lat: Math.round(lat * 100000) / 100000,
            lng: Math.round(lng * 100000) / 100000,
          });
        }
      }

      fetched += facilities.length;
      if (facilities.length < PAGE) break;
      pageNo++;
    }
  } catch (e) {
    console.warn(`[ICIS Fetcher] ECHO coords ${stateAbbr}: ${e instanceof Error ? e.message : e}`);
  }
  return coords;
}

// ── ECHO violation fetch (replaces retired ICIS_VIOLATION table) ─────────────

async function fetchEchoViolations(stateAbbr: string): Promise<IcisViolation[]> {
  try {
    const queryUrl = `${ECHO_CWA_QUERY}?output=JSON&p_st=${stateAbbr}&p_qiv=Y`;
    const qRes = await fetch(queryUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!qRes.ok) return [];
    const qJson = await qRes.json();
    const qid = qJson?.Results?.QueryID;
    const totalRows = parseInt(qJson?.Results?.QueryRows || '0', 10);
    if (!qid || totalRows === 0) return [];

    const results: IcisViolation[] = [];
    let pageNo = 1;
    const PAGE = 5000;

    while (results.length < totalRows) {
      const qidUrl = `${ECHO_CWA_QID}?output=JSON&qid=${qid}&responseset=${PAGE}&pageno=${pageNo}`;
      const dRes = await fetch(qidUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(60_000),
      });
      if (!dRes.ok) break;
      const dJson = await dRes.json();
      const facilities = dJson?.Results?.Facilities || [];
      if (facilities.length === 0) break;

      for (const f of facilities) {
        const lat = parseFloat(f.FacLat || '');
        const lng = parseFloat(f.FacLong || '');
        if (isNaN(lat) || isNaN(lng) || Math.abs(lat) < 1) continue;

        const sncStatus = (f.CWPSNCStatus || '').trim();
        const isSnc = /^S/.test(sncStatus) || /SNC|significant/i.test(sncStatus);
        const bestDate = f.CWPDateLastFormalAction || f.CWPDateLastInspection
          || f.CWPDateLastPenalty || f.CWPLastFormalActionDate || '';
        const severity = isSnc ? 'S' : (sncStatus || 'M');
        const vioStatus = (f.CWPVioStatus || f.CWPCurrentVioStatus || '').trim();
        const qtrsWithVio = f.CWPQtrsWithVio || '';
        const facilityName = (f.CWPName || f.FacName || '').trim();
        const desc = vioStatus
          || (isSnc ? 'Significant Non-Compliance' : '')
          || (qtrsWithVio ? `${qtrsWithVio} quarters with violations` : '')
          || (facilityName ? `Violation at ${facilityName}` : 'Violation');
        results.push({
          permit: (f.SourceID || '').trim(),
          code: vioStatus || (isSnc ? 'SNC' : ''),
          desc,
          date: bestDate,
          rnc: isSnc,
          severity,
          lat: Math.round(lat * 100000) / 100000,
          lng: Math.round(lng * 100000) / 100000,
        });
      }

      if (facilities.length < PAGE) break;
      pageNo++;
    }

    return results;
  } catch (e) {
    console.warn(`[ICIS Fetcher] ECHO violations ${stateAbbr}: ${e instanceof Error ? e.message : e}`);
    return [];
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Fetch all ICIS data for a single state.
 * Returns flat arrays — NOT grid-indexed.
 */
export async function fetchIcisForState(stateAbbr: string): Promise<IcisStateSnapshot> {
  console.log(`[ICIS Fetcher] Fetching ${stateAbbr}...`);

  const [permits, violations, dmr, enforcement, , echoCoords] = await Promise.all([
    fetchTable('ICIS_PERMIT', 'STATE_ABBR', stateAbbr, transformPermit)
      .then(rows => rows.map(r => ({ ...r, state: r.state || stateAbbr }))),
    fetchEchoViolations(stateAbbr),
    fetchTable('ICIS_DMR', 'STATE_ABBR', stateAbbr, transformDmr),
    fetchTable('ICIS_ENFORCEMENT', 'STATE_ABBR', stateAbbr, transformEnforcement),
    Promise.resolve([]) as Promise<IcisInspection[]>,
    fetchEchoFacilityCoords(stateAbbr),
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

  // Backfill coordinates from ECHO
  let backfilled = 0;
  for (const p of dedupedPermits) {
    if (p.lat === 0 && p.lng === 0) {
      const coord = echoCoords.get(p.permit);
      if (coord) { p.lat = coord.lat; p.lng = coord.lng; backfilled++; }
    }
  }
  for (const e of dedupedEnforcement) {
    if (e.lat === 0 && e.lng === 0) {
      const coord = echoCoords.get(e.permit);
      if (coord) { e.lat = coord.lat; e.lng = coord.lng; }
    }
  }
  if (backfilled > 0) {
    console.log(`[ICIS Fetcher] ${stateAbbr}: backfilled coords for ${backfilled}/${dedupedPermits.length} permits`);
  }

  console.log(
    `[ICIS Fetcher] ${stateAbbr}: ${dedupedPermits.length} permits, ` +
    `${dedupedViolations.length} violations, ${dedupedDmr.length} DMR, ` +
    `${dedupedEnforcement.length} enforcement`
  );

  return {
    permits: dedupedPermits,
    violations: dedupedViolations,
    dmr: dedupedDmr,
    enforcement: dedupedEnforcement,
    inspections: [],
    state: stateAbbr,
    fetchedAt: new Date().toISOString(),
  };
}
