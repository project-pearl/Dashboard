// app/api/cron/rebuild-sdwis/route.ts
// Cron endpoint — fetches EPA SDWIS drinking water data (systems, violations,
// enforcement) for priority states, deduplicates, and populates the in-memory
// spatial cache for instant lookups.
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
const STATE_DELAY_MS = 2000;
const PAGE_SIZE = 5000;

import { PRIORITY_STATES } from '@/lib/constants';

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
        console.warn(`[SDWIS Cron] ${table} ${stateAbbr}: HTTP ${res.status}`);
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
      console.warn(`[SDWIS Cron] ${table} ${stateAbbr} page ${offset}: ${e instanceof Error ? e.message : e}`);
      break;
    }
  }

  return results;
}

// ── Row transforms ──────────────────────────────────────────────────────────

function transformSystem(row: Record<string, any>): SdwisSystem | null {
  const lat = parseFloat(row.LATITUDE_DD || '');
  const lng = parseFloat(row.LONGITUDE_DD || '');
  if (isNaN(lat) || isNaN(lng) || lat <= 0) return null;

  return {
    pwsid: row.PWSID || row.PWS_ID || '',
    name: row.PWS_NAME || '',
    type: row.PWS_TYPE_CODE || '',
    population: parseInt(row.POPULATION_SERVED_COUNT || '0', 10) || 0,
    sourceWater: row.PRIMARY_SOURCE_CODE || row.SOURCE_WATER_TYPE || '',
    state: row.STATE_CODE || row.PRIMACY_AGENCY_CODE || '',
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000,
  };
}

function transformViolation(row: Record<string, any>): SdwisViolation | null {
  // Violations don't have direct lat/lng — we'll match via PWSID later
  // For now, return with 0,0 and filter during grid indexing
  const pwsid = row.PWSID || row.PWS_ID || '';
  if (!pwsid) return null;

  const isMajor = row.IS_MAJOR_VIOL_IND === 'Y' || row.SEVERITY_IND_CNT === 'Y';
  const isHealthBased = row.IS_HEALTH_BASED_IND === 'Y' ||
    (row.CONTAMINANT_CODE && ['1040', '1041', '2950', '2456', '3100', '3014'].includes(row.CONTAMINANT_CODE));

  return {
    pwsid,
    code: row.VIOLATION_CODE || row.VIOLATION_TYPE_CODE || '',
    contaminant: row.CONTAMINANT_NAME || row.CONTAMINANT_CODE || '',
    rule: row.RULE_NAME || row.RULE_CODE || '',
    isMajor,
    isHealthBased,
    compliancePeriod: row.COMPL_PER_BEGIN_DATE || row.COMPLIANCE_PERIOD || '',
    lat: 0,
    lng: 0,
  };
}

function transformEnforcement(row: Record<string, any>): SdwisEnforcement | null {
  const pwsid = row.PWSID || row.PWS_ID || '';
  if (!pwsid) return null;

  return {
    pwsid,
    actionType: row.ENFORCEMENT_ACTION_TYPE || row.ENF_ACTION_TYPE_CODE || '',
    date: row.ENFORCEMENT_DATE || row.ENF_ACTION_DATE || '',
    lat: 0,
    lng: 0,
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
    const allSystems: SdwisSystem[] = [];
    const allViolations: SdwisViolation[] = [];
    const allEnforcement: SdwisEnforcement[] = [];
    const processedStates: string[] = [];

    for (const stateAbbr of PRIORITY_STATES) {
      try {
        console.log(`[SDWIS Cron] Fetching ${stateAbbr}...`);

        // Fetch systems first (needed for coordinate lookup), then violations + enforcement in parallel
        const systems = await fetchTable('WATER_SYSTEM', 'STATE_CODE', stateAbbr, transformSystem);

        const [violations, enforcement] = await Promise.all([
          fetchTable('VIOLATION', 'PRIMACY_AGENCY_CODE', stateAbbr, transformViolation),
          fetchTable('ENFORCEMENT_ACTION', 'STATE_CODE', stateAbbr, transformEnforcement),
        ]);

        // Deduplicate systems by PWSID
        const systemMap = new Map<string, SdwisSystem>();
        for (const s of systems) {
          if (!systemMap.has(s.pwsid)) systemMap.set(s.pwsid, s);
        }
        const dedupedSystems = Array.from(systemMap.values());

        // Build PWSID → lat/lng lookup from systems for violations/enforcement
        const pwsidCoords = new Map<string, { lat: number; lng: number }>();
        for (const s of dedupedSystems) {
          pwsidCoords.set(s.pwsid, { lat: s.lat, lng: s.lng });
        }

        // Deduplicate violations by PWSID|code|compliancePeriod
        const violationMap = new Map<string, SdwisViolation>();
        for (const v of violations) {
          const key = `${v.pwsid}|${v.code}|${v.compliancePeriod}`;
          if (!violationMap.has(key)) {
            // Assign coordinates from system lookup
            const coords = pwsidCoords.get(v.pwsid);
            if (coords) {
              v.lat = coords.lat;
              v.lng = coords.lng;
            }
            violationMap.set(key, v);
          }
        }
        const dedupedViolations = Array.from(violationMap.values()).filter(v => v.lat !== 0);

        // Deduplicate enforcement by PWSID|actionType|date
        const enfMap = new Map<string, SdwisEnforcement>();
        for (const e of enforcement) {
          const key = `${e.pwsid}|${e.actionType}|${e.date}`;
          if (!enfMap.has(key)) {
            const coords = pwsidCoords.get(e.pwsid);
            if (coords) {
              e.lat = coords.lat;
              e.lng = coords.lng;
            }
            enfMap.set(key, e);
          }
        }
        const dedupedEnforcement = Array.from(enfMap.values()).filter(e => e.lat !== 0);

        allSystems.push(...dedupedSystems);
        allViolations.push(...dedupedViolations);
        allEnforcement.push(...dedupedEnforcement);
        processedStates.push(stateAbbr);

        stateResults[stateAbbr] = {
          systems: dedupedSystems.length,
          violations: dedupedViolations.length,
          enforcement: dedupedEnforcement.length,
        };

        console.log(
          `[SDWIS Cron] ${stateAbbr}: ${dedupedSystems.length} systems, ` +
          `${dedupedViolations.length} violations, ${dedupedEnforcement.length} enforcement`
        );
      } catch (e) {
        console.warn(`[SDWIS Cron] ${stateAbbr} failed:`, e instanceof Error ? e.message : e);
        stateResults[stateAbbr] = { systems: 0, violations: 0, enforcement: 0 };
      }

      // Rate limit delay between states
      await delay(STATE_DELAY_MS);
    }

    // ── Retry failed states ───────────────────────────────────────────────
    const failedStates = PRIORITY_STATES.filter(s => !processedStates.includes(s));
    if (failedStates.length > 0) {
      console.log(`[SDWIS Cron] Retrying ${failedStates.length} failed states...`);
      for (const stateAbbr of failedStates) {
        await delay(5000);
        try {
          const systems = await fetchTable('WATER_SYSTEM', 'STATE_CODE', stateAbbr, transformSystem);
          const [violations, enforcement] = await Promise.all([
            fetchTable('VIOLATION', 'PRIMACY_AGENCY_CODE', stateAbbr, transformViolation),
            fetchTable('ENFORCEMENT_ACTION', 'STATE_CODE', stateAbbr, transformEnforcement),
          ]);

          // Build PWSID lookup and assign coords
          const systemMap = new Map<string, SdwisSystem>();
          for (const s of systems) { if (!systemMap.has(s.pwsid)) systemMap.set(s.pwsid, s); }
          const pwsidCoords = new Map<string, { lat: number; lng: number }>();
          for (const s of systemMap.values()) pwsidCoords.set(s.pwsid, { lat: s.lat, lng: s.lng });
          for (const v of violations) { const c = pwsidCoords.get(v.pwsid); if (c) { v.lat = c.lat; v.lng = c.lng; } }
          for (const e of enforcement) { const c = pwsidCoords.get(e.pwsid); if (c) { e.lat = c.lat; e.lng = c.lng; } }

          allSystems.push(...systemMap.values());
          allViolations.push(...violations.filter(v => v.lat !== 0));
          allEnforcement.push(...enforcement.filter(e => e.lat !== 0));
          processedStates.push(stateAbbr);

          stateResults[stateAbbr] = { systems: systemMap.size, violations: violations.length, enforcement: enforcement.length };
          console.log(`[SDWIS Cron] ${stateAbbr}: RETRY OK`);
        } catch (e) {
          console.warn(`[SDWIS Cron] ${stateAbbr}: RETRY FAILED — ${e instanceof Error ? e.message : e}`);
        }
      }
    }

    // ── Build Grid Index ───────────────────────────────────────────────────
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
    for (const v of allViolations) {
      const key = gridKey(v.lat, v.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].violations.push(v);
    }
    for (const e of allEnforcement) {
      const key = gridKey(e.lat, e.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].enforcement.push(e);
    }

    // ── Store in memory ────────────────────────────────────────────────────
    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        systemCount: allSystems.length,
        violationCount: allViolations.length,
        enforcementCount: allEnforcement.length,
        statesProcessed: processedStates,
        gridCells: Object.keys(grid).length,
      },
      grid,
    };

    await setSdwisCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[SDWIS Cron] Build complete in ${elapsed}s — ` +
      `${allSystems.length} systems, ${allViolations.length} violations, ` +
      `${allEnforcement.length} enforcement, ${Object.keys(grid).length} cells`
    );

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      systems: allSystems.length,
      violations: allViolations.length,
      enforcement: allEnforcement.length,
      gridCells: Object.keys(grid).length,
      statesProcessed: processedStates.length,
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
