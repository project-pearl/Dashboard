/**
 * Prefetch API — Login-triggered pre-warming of role-relevant caches.
 *
 * GET /api/prefetch?role=State&state=MD
 *
 * Calls ensureWarmed() for each cache relevant to the role. With the
 * Supabase shared cache in place, this also triggers getOrRefresh for
 * stale snapshots — warming data before the user starts browsing.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import type { UserRole } from '@/lib/authTypes';
import { PREFETCH_CONFIG } from '@/lib/prefetchConfig';
import { PRIORITY_STATES } from '@/lib/constants';

// ── Cache warming registry ──────────────────────────────────────────────────

type WarmFn = () => Promise<void>;

async function getWarmFns(): Promise<Record<string, WarmFn>> {
  // Dynamic imports to avoid loading all caches at module level
  const [
    { ensureWarmed: warmIcis },
    { ensureWarmed: warmEcho },
    { ensureWarmed: warmNwisGw },
    { ensureWarmed: warmNws },
    { ensureWarmed: warmAttains },
  ] = await Promise.all([
    import('@/lib/icisCache'),
    import('@/lib/echoCache'),
    import('@/lib/nwisGwCache'),
    import('@/lib/nwsAlertCache'),
    import('@/lib/attainsCache'),
  ]);

  return {
    icis: warmIcis,
    echo: warmEcho,
    'nwis-gw': warmNwisGw,
    nwsAlerts: warmNws,
    attains: warmAttains,
    // Sources without ensureWarmed (sdwis, wqp, stateReport) are no-ops here.
    // They'll be populated by their respective crons or by getOrRefresh on first access.
    sdwis: async () => {},
    wqp: async () => {},
    stateReport: async () => {},
  };
}

// ── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get('role') as UserRole | null;
  const state = request.nextUrl.searchParams.get('state') || '';

  if (!role) {
    return NextResponse.json({ error: 'role param required' }, { status: 400 });
  }

  const sources = PREFETCH_CONFIG[role];
  if (!sources || sources.length === 0) {
    return NextResponse.json({ status: 'no-config', role });
  }

  const warmFns = await getWarmFns();
  const results: { source: string; status: string }[] = [];

  // Build list of warm tasks
  const tasks: Promise<void>[] = [];

  for (const src of sources) {
    const warmFn = warmFns[src.source];
    if (!warmFn) {
      results.push({ source: src.source, status: 'unknown' });
      continue;
    }

    if (src.scope === 'userState' && state) {
      // For user-state scoped sources, just warm the base cache
      tasks.push(
        warmFn()
          .then(() => { results.push({ source: src.source, status: 'warmed' }); })
          .catch(() => { results.push({ source: src.source, status: 'error' }); })
      );
    } else if (src.scope === 'allPriority') {
      // For priority-state sources, warm the base cache (covers all states)
      tasks.push(
        warmFn()
          .then(() => { results.push({ source: src.source, status: 'warmed' }); })
          .catch(() => { results.push({ source: src.source, status: 'error' }); })
      );
    }
  }

  await Promise.allSettled(tasks);

  return NextResponse.json({
    status: 'complete',
    role,
    state: state || undefined,
    warmed: results,
  });
}
