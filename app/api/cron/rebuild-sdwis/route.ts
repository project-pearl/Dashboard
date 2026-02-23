// app/api/cron/rebuild-sdwis/route.ts
// Cron endpoint — fetches EPA SDWIS Community Water Systems (CWS) for
// priority states, resolves coordinates via bundled ZIP centroids,
// and populates the spatial cache for instant lookups.
// Schedule: daily via Vercel cron (7 AM UTC) or manual trigger.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setSdwisCache, getSdwisCacheStatus,
  isSdwisBuildInProgress, setSdwisBuildInProgress,
  gridKey,
  type SdwisSystem, type SdwisViolation, type SdwisEnforcement,
} from '@/lib/sdwisCache';

// ── Config ───────────────────────────────────────────────────────────────────

const EF_BASE = 'https://data.epa.gov/efservice';
const PAGE_SIZE = 5000;
const MAX_PAGES = 3; // Safety cap: 15k records max per table per state
const CONCURRENCY = 5;

import { PRIORITY_STATES } from '@/lib/constants';
import zipCentroids from '@/lib/zipCentroids.json';

// ── Paginated fetch helper ──────────────────────────────────────────────────

async function fetchTable<T>(
  url: string,
  label: string,
  transform: (row: Record<string, any>) => T | null,
): Promise<T[]> {
  const results: T[] = [];
  let offset = 0;
  let pages = 0;

  while (pages < MAX_PAGES) {
    const pageUrl = `${url}/ROWS/${offset}:${offset + PAGE_SIZE - 1}/JSON`;
    try {
      const res = await fetch(pageUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        console.warn(`[SDWIS Cron] ${label}: HTTP ${res.status}`);
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

      pages++;
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    } catch (e) {
      console.warn(`[SDWIS Cron] ${label} page ${pages}: ${e instanceof Error ? e.message : e}`);
      break;
    }
  }

  return results;
}

// ── Row transforms ──────────────────────────────────────────────────────────

interface RawSystem {
  pwsid: string;
  name: string;
  type: string;
  population: number;
  sourceWater: string;
  state: string;
  zip: string;
}

function transformSystemRaw(row: Record<string, any>): RawSystem | null {
  const pwsid = row.pwsid || row.PWSID || row.pws_id || '';
  if (!pwsid) return null;

  const rawZip = String(row.zip_code || row.ZIP_CODE || '');
  const zip = rawZip.replace(/\s/g, '').substring(0, 5);

  return {
    pwsid,
    name: row.pws_name || row.PWS_NAME || '',
    type: row.pws_type_code || row.PWS_TYPE_CODE || '',
    population: parseInt(row.population_served_count || row.POPULATION_SERVED_COUNT || '0', 10) || 0,
    sourceWater: row.primary_source_code || row.PRIMARY_SOURCE_CODE || '',
    state: row.state_code || row.STATE_CODE || row.primacy_agency_code || row.PRIMACY_AGENCY_CODE || '',
    zip,
  };
}

function transformViolation(row: Record<string, any>): SdwisViolation | null {
  const pwsid = row.pwsid || row.PWSID || row.pws_id || '';
  if (!pwsid) return null;

  return {
    pwsid,
    code: row.violation_code || row.VIOLATION_CODE || row.violation_type_code || '',
    contaminant: row.contaminant_name || row.CONTAMINANT_NAME || row.contaminant_code || '',
    rule: row.rule_name || row.RULE_NAME || row.rule_code || '',
    isMajor: (row.is_major_viol_ind || row.IS_MAJOR_VIOL_IND) === 'Y',
    isHealthBased: (row.is_health_based_ind || row.IS_HEALTH_BASED_IND) === 'Y',
    compliancePeriod: row.compl_per_begin_date || row.COMPL_PER_BEGIN_DATE || '',
    lat: 0,
    lng: 0,
  };
}

function transformEnforcement(row: Record<string, any>): SdwisEnforcement | null {
  const pwsid = row.pwsid || row.PWSID || row.pws_id || '';
  if (!pwsid) return null;

  return {
    pwsid,
    actionType: row.enforcement_action_type || row.ENFORCEMENT_ACTION_TYPE || row.enf_action_type_code || '',
    date: row.enforcement_date || row.ENFORCEMENT_DATE || row.enf_action_date || '',
    lat: 0,
    lng: 0,
  };
}

// ── ZIP Centroid Lookup (bundled — no API calls needed) ──────────────────────

const ZIP_LOOKUP = zipCentroids as Record<string, [number, number]>;

function lookupZips(
  zips: string[],
): Map<string, { lat: number; lng: number }> {
  const coordMap = new Map<string, { lat: number; lng: number }>();
  const uniqueZips = [...new Set(zips.filter(z => z.length === 5 && /^\d{5}$/.test(z)))];

  for (const zip of uniqueZips) {
    const coords = ZIP_LOOKUP[zip];
    if (coords) {
      coordMap.set(zip, { lat: coords[0], lng: coords[1] });
    }
  }

  console.log(`[SDWIS Cron] ZIP lookup: ${coordMap.size}/${uniqueZips.length} resolved`);
  return coordMap;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isSdwisBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'SDWIS build already in progress',
      cache: getSdwisCacheStatus(),
    });
  }

  setSdwisBuildInProgress(true);
  const startTime = Date.now();
  const stateResults: Record<string, Record<string, number>> = {};

  try {
    const rawSystems: RawSystem[] = [];
    const allViolations: SdwisViolation[] = [];
    const allEnforcement: SdwisEnforcement[] = [];
    const processedStates: string[] = [];

    // ── Phase 1: Fetch CWS systems + violations for all states ──────────
    // Filter to CWS (Community Water Systems) — covers 95%+ of population
    // and reduces record count by ~85% vs all system types.
    const queue = [...PRIORITY_STATES];
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
              console.log(`[SDWIS Cron] Fetching ${stateAbbr} CWS...`);

              // Fetch CWS systems only (compound filter: STATE_CODE + PWS_TYPE_CODE)
              const systemUrl = `${EF_BASE}/WATER_SYSTEM/STATE_CODE/${stateAbbr}/PWS_TYPE_CODE/CWS`;
              const systems = await fetchTable(systemUrl, `systems/${stateAbbr}`, transformSystemRaw);

              // Violations + enforcement in parallel (allSettled — enf returns 500 for some states)
              const [violResult, enfResult] = await Promise.allSettled([
                fetchTable(
                  `${EF_BASE}/VIOLATION/PRIMACY_AGENCY_CODE/${stateAbbr}`,
                  `violations/${stateAbbr}`,
                  transformViolation,
                ),
                fetchTable(
                  `${EF_BASE}/ENFORCEMENT_ACTION/STATE_CODE/${stateAbbr}`,
                  `enforcement/${stateAbbr}`,
                  transformEnforcement,
                ),
              ]);
              const violations = violResult.status === 'fulfilled' ? violResult.value : [];
              const enforcement = enfResult.status === 'fulfilled' ? enfResult.value : [];

              // Deduplicate systems by PWSID
              const systemMap = new Map<string, RawSystem>();
              for (const s of systems) {
                if (!systemMap.has(s.pwsid)) systemMap.set(s.pwsid, s);
              }

              rawSystems.push(...systemMap.values());
              allViolations.push(...violations);
              allEnforcement.push(...enforcement);
              processedStates.push(stateAbbr);

              stateResults[stateAbbr] = {
                systems: systemMap.size,
                violations: violations.length,
                enforcement: enforcement.length,
              };

              console.log(
                `[SDWIS Cron] ${stateAbbr}: ${systemMap.size} systems, ` +
                `${violations.length} violations, ${enforcement.length} enforcement`
              );
            } catch (e) {
              console.warn(`[SDWIS Cron] ${stateAbbr} failed:`, e instanceof Error ? e.message : e);
              stateResults[stateAbbr] = { systems: 0, violations: 0, enforcement: 0 };
            } finally {
              running--;
              next();
            }
          })();
        }
      }
      next();
    });

    if (rawSystems.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[SDWIS Cron] 0 systems fetched in ${elapsed}s — skipping cache save`);
      return NextResponse.json({ status: 'empty', duration: `${elapsed}s`, cache: getSdwisCacheStatus() });
    }

    // ── Phase 2: Resolve system coordinates via bundled ZIP centroids ────
    const allZips = rawSystems.map(s => s.zip).filter(Boolean);
    const zipCoords = lookupZips(allZips);

    const allSystems: SdwisSystem[] = [];
    const pwsidCoords = new Map<string, { lat: number; lng: number }>();

    for (const raw of rawSystems) {
      const coords = zipCoords.get(raw.zip);
      if (!coords) continue;

      allSystems.push({
        pwsid: raw.pwsid,
        name: raw.name,
        type: raw.type,
        population: raw.population,
        sourceWater: raw.sourceWater,
        state: raw.state,
        lat: Math.round(coords.lat * 100000) / 100000,
        lng: Math.round(coords.lng * 100000) / 100000,
      });
      pwsidCoords.set(raw.pwsid, coords);
    }

    console.log(`[SDWIS Cron] Geocoded ${allSystems.length}/${rawSystems.length} systems`);

    // ── Phase 3: Assign coords to violations/enforcement and deduplicate ──
    const violationMap = new Map<string, SdwisViolation>();
    for (const v of allViolations) {
      const key = `${v.pwsid}|${v.code}|${v.compliancePeriod}`;
      if (!violationMap.has(key)) {
        const coords = pwsidCoords.get(v.pwsid);
        if (coords) { v.lat = coords.lat; v.lng = coords.lng; }
        violationMap.set(key, v);
      }
    }
    const geocodedViolations = Array.from(violationMap.values()).filter(v => v.lat !== 0);

    const enfMap = new Map<string, SdwisEnforcement>();
    for (const e of allEnforcement) {
      const key = `${e.pwsid}|${e.actionType}|${e.date}`;
      if (!enfMap.has(key)) {
        const coords = pwsidCoords.get(e.pwsid);
        if (coords) { e.lat = coords.lat; e.lng = coords.lng; }
        enfMap.set(key, e);
      }
    }
    const geocodedEnforcement = Array.from(enfMap.values()).filter(e => e.lat !== 0);

    // ── Phase 4: Build Grid Index ─────────────────────────────────────────
    const grid: Record<string, {
      systems: SdwisSystem[];
      violations: SdwisViolation[];
      enforcement: SdwisEnforcement[];
    }> = {};

    const emptyCell = () => ({
      systems: [] as SdwisSystem[],
      violations: [] as SdwisViolation[],
      enforcement: [] as SdwisEnforcement[],
    });

    for (const s of allSystems) {
      const key = gridKey(s.lat, s.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].systems.push(s);
    }
    for (const v of geocodedViolations) {
      const key = gridKey(v.lat, v.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].violations.push(v);
    }
    for (const e of geocodedEnforcement) {
      const key = gridKey(e.lat, e.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].enforcement.push(e);
    }

    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        systemCount: allSystems.length,
        violationCount: geocodedViolations.length,
        enforcementCount: geocodedEnforcement.length,
        statesProcessed: processedStates,
        gridCells: Object.keys(grid).length,
      },
      grid,
    };

    if (allSystems.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[SDWIS Cron] 0 geocoded systems — skipping cache save`);
      return NextResponse.json({ status: 'empty', duration: `${elapsed}s`, cache: getSdwisCacheStatus() });
    }

    await setSdwisCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[SDWIS Cron] Build complete in ${elapsed}s — ` +
      `${allSystems.length} systems, ${geocodedViolations.length} violations, ` +
      `${geocodedEnforcement.length} enforcement, ${Object.keys(grid).length} cells`
    );

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      systems: allSystems.length,
      violations: geocodedViolations.length,
      enforcement: geocodedEnforcement.length,
      gridCells: Object.keys(grid).length,
      statesProcessed: processedStates.length,
      geocodedZips: zipCoords.size,
      states: stateResults,
      cache: getSdwisCacheStatus(),
    });

  } catch (err: any) {
    console.error('[SDWIS Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'SDWIS build failed' },
      { status: 500 },
    );
  } finally {
    setSdwisBuildInProgress(false);
  }
}
