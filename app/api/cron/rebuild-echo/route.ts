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

const ECHO_BASE = 'https://echodata.epa.gov/echo/cwa_rest_services.get_facilities';
const STATE_DELAY_MS = 2000;
const PAGE_SIZE = 1000; // ECHO max responseset size

import { PRIORITY_STATES } from '@/lib/constants';

// ── ECHO fetch helpers ──────────────────────────────────────────────────────

async function fetchEchoFacilities(stateAbbr: string): Promise<EchoFacility[]> {
  const results: EchoFacility[] = [];
  let page = 1;

  while (true) {
    const url = `${ECHO_BASE}?output=JSON&p_st=${stateAbbr}&responseset=${page}`;
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        console.warn(`[ECHO Cron] Facilities ${stateAbbr} page ${page}: HTTP ${res.status}`);
        break;
      }

      const json = await res.json();
      const facilities = json?.Results?.Facilities;
      if (!Array.isArray(facilities) || facilities.length === 0) break;

      for (const f of facilities) {
        const lat = parseFloat(f.FacLat || '');
        const lng = parseFloat(f.FacLong || '');
        if (isNaN(lat) || isNaN(lng) || lat <= 0) continue;

        results.push({
          registryId: f.RegistryID || f.SourceID || '',
          name: f.CWPName || f.FacName || '',
          state: f.FacState || stateAbbr,
          permitId: f.CWPPermitStatusDesc ? (f.SourceID || '') : (f.CWPNpdesIds || ''),
          lat: Math.round(lat * 100000) / 100000,
          lng: Math.round(lng * 100000) / 100000,
          complianceStatus: f.CWPComplianceStatus || f.CWPSNCStatus || '',
          qtrsInViolation: parseInt(f.CWPQtrsInNC || '0', 10) || 0,
        });
      }

      // ECHO paginates by responseset — if fewer than ~1000 results, we're done
      if (facilities.length < PAGE_SIZE) break;
      page++;
    } catch (e) {
      console.warn(`[ECHO Cron] Facilities ${stateAbbr} page ${page}: ${e instanceof Error ? e.message : e}`);
      break;
    }
  }

  return results;
}

async function fetchEchoViolations(stateAbbr: string): Promise<EchoViolation[]> {
  const results: EchoViolation[] = [];
  let page = 1;

  while (true) {
    const url = `${ECHO_BASE}?output=JSON&p_st=${stateAbbr}&p_qiv=Y&responseset=${page}`;
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        console.warn(`[ECHO Cron] Violations ${stateAbbr} page ${page}: HTTP ${res.status}`);
        break;
      }

      const json = await res.json();
      const facilities = json?.Results?.Facilities;
      if (!Array.isArray(facilities) || facilities.length === 0) break;

      for (const f of facilities) {
        const lat = parseFloat(f.FacLat || '');
        const lng = parseFloat(f.FacLong || '');
        if (isNaN(lat) || isNaN(lng) || lat <= 0) continue;

        results.push({
          registryId: f.RegistryID || f.SourceID || '',
          name: f.CWPName || f.FacName || '',
          state: f.FacState || stateAbbr,
          lat: Math.round(lat * 100000) / 100000,
          lng: Math.round(lng * 100000) / 100000,
          violationType: f.CWPViolStatus || f.CWPComplianceStatus || '',
          pollutant: f.CWPCsoOutfalls || '',
          qtrsInNc: parseInt(f.CWPQtrsInNC || '0', 10) || 0,
        });
      }

      if (facilities.length < PAGE_SIZE) break;
      page++;
    } catch (e) {
      console.warn(`[ECHO Cron] Violations ${stateAbbr} page ${page}: ${e instanceof Error ? e.message : e}`);
      break;
    }
  }

  return results;
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

    for (const stateAbbr of PRIORITY_STATES) {
      try {
        console.log(`[ECHO Cron] Fetching ${stateAbbr}...`);

        const facilities = await fetchEchoFacilities(stateAbbr);
        await delay(STATE_DELAY_MS);

        const violations = await fetchEchoViolations(stateAbbr);

        // Deduplicate facilities by registryId
        const facMap = new Map<string, EchoFacility>();
        for (const f of facilities) {
          if (!facMap.has(f.registryId)) facMap.set(f.registryId, f);
        }
        const dedupedFacilities = Array.from(facMap.values());

        // Deduplicate violations by registryId
        const violMap = new Map<string, EchoViolation>();
        for (const v of violations) {
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
      }

      // Rate limit delay between states
      await delay(STATE_DELAY_MS);
    }

    // ── Retry failed states ───────────────────────────────────────────────
    const failedStates = PRIORITY_STATES.filter(s => !processedStates.includes(s));
    if (failedStates.length > 0) {
      console.log(`[ECHO Cron] Retrying ${failedStates.length} failed states...`);
      for (const stateAbbr of failedStates) {
        await delay(5000);
        try {
          const facilities = await fetchEchoFacilities(stateAbbr);
          const violations = await fetchEchoViolations(stateAbbr);

          const facMap = new Map<string, EchoFacility>();
          for (const f of facilities) if (!facMap.has(f.registryId)) facMap.set(f.registryId, f);
          const violMap = new Map<string, EchoViolation>();
          for (const v of violations) if (!violMap.has(v.registryId)) violMap.set(v.registryId, v);

          allFacilities.push(...facMap.values());
          allViolations.push(...violMap.values());
          processedStates.push(stateAbbr);
          stateResults[stateAbbr] = { facilities: facMap.size, violations: violMap.size };
          console.log(`[ECHO Cron] ${stateAbbr}: RETRY OK`);
        } catch (e) {
          console.warn(`[ECHO Cron] ${stateAbbr}: RETRY FAILED — ${e instanceof Error ? e.message : e}`);
        }
      }
    }

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
