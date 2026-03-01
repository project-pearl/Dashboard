// app/api/cron/rebuild-icis/route.ts
// Cron endpoint — fetches EPA ICIS compliance data per state via getOrRefresh
// (Supabase shared cache). Skips states that were recently user-refreshed.
// Collects per-state snapshots and rebuilds the in-memory spatial grid.
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
import { getOrRefresh } from '@/lib/supabaseCache';
import { fetchIcisForState, type IcisStateSnapshot } from '@/lib/icisStateFetcher';
import { ALL_STATES } from '@/lib/constants';

const CONCURRENCY = 6;

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
  const stateResults: Record<string, { permits: number; violations: number; dmr: number; enforcement: number; fromCache: boolean }> = {};

  try {
    const allPermits: IcisPermit[] = [];
    const allViolations: IcisViolation[] = [];
    const allDmr: IcisDmr[] = [];
    const allEnforcement: IcisEnforcement[] = [];
    const allInspections: IcisInspection[] = [];
    const processedStates: string[] = [];

    // Semaphore-based parallel fetching via getOrRefresh per state.
    // getOrRefresh checks Supabase snapshot — if fresh (user recently refreshed),
    // it returns immediately without hitting EPA APIs. Eliminates 504 timeouts.
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
              const result = await getOrRefresh<IcisStateSnapshot>({
                source: 'icis',
                scopeKey: stateAbbr,
                fetchFn: () => fetchIcisForState(stateAbbr),
                fetchedBy: 'cron',
              });

              const snap = result.data;
              allPermits.push(...snap.permits);
              allViolations.push(...snap.violations);
              allDmr.push(...snap.dmr);
              allEnforcement.push(...snap.enforcement);
              allInspections.push(...snap.inspections);
              processedStates.push(stateAbbr);

              stateResults[stateAbbr] = {
                permits: snap.permits.length,
                violations: snap.violations.length,
                dmr: snap.dmr.length,
                enforcement: snap.enforcement.length,
                fromCache: !result.meta.isStale && result.meta.fetchedBy !== 'cron',
              };

              console.log(
                `[ICIS Cron] ${stateAbbr}: ${snap.permits.length} permits, ` +
                `${snap.violations.length} violations (${result.meta.ageLabel})`
              );
            } catch (e) {
              console.warn(`[ICIS Cron] ${stateAbbr} failed:`, e instanceof Error ? e.message : e);
              stateResults[stateAbbr] = { permits: 0, violations: 0, dmr: 0, enforcement: 0, fromCache: false };
            } finally {
              running--;
              next();
            }
          })();
        }
      }
      next();
    });

    // ── Build Grid Index ─────────────────────────────────────────────────────
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

    // ── Store in memory ──────────────────────────────────────────────────────
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

    const cachedStates = Object.values(stateResults).filter(s => s.fromCache).length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[ICIS Cron] Build complete in ${elapsed}s — ` +
      `${allPermits.length} permits, ${allViolations.length} violations, ` +
      `${allDmr.length} DMR, ${allEnforcement.length} enforcement, ` +
      `${Object.keys(grid).length} cells (${cachedStates} states served from cache)`
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
      cachedStates,
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
