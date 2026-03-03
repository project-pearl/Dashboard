/**
 * Cache Refresh API — POST endpoint for "Update Now" button.
 *
 * Accepts { source, scopeKey } and forces a fresh fetch through getOrRefresh.
 * Auth required. Rate-limited by lock TTL (5 min per source+state).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { getOrRefresh, type GetOrRefreshResult } from '@/lib/supabaseCache';
import { fetchIcisForState, type IcisStateSnapshot } from '@/lib/icisStateFetcher';

// ── Source → fetch function registry ────────────────────────────────────────

type FetcherFn = (scopeKey: string) => Promise<any>;

const FETCHERS: Record<string, FetcherFn> = {
  icis: (scopeKey: string) => fetchIcisForState(scopeKey),
  // Future sources follow the same pattern:
  // sdwis: (scopeKey) => fetchSdwisForState(scopeKey),
  // echo: (scopeKey) => fetchEchoForState(scopeKey),
};

// ── POST Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth check
  const { isAuthorized } = await import('@/lib/apiAuth');
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { source?: string; scopeKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { source, scopeKey } = body;
  if (!source || !scopeKey) {
    return NextResponse.json({ error: 'source and scopeKey required' }, { status: 400 });
  }

  const fetchFn = FETCHERS[source];
  if (!fetchFn) {
    return NextResponse.json(
      { error: `Unknown source: ${source}. Supported: ${Object.keys(FETCHERS).join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const result: GetOrRefreshResult<any> = await getOrRefresh({
      source,
      scopeKey,
      fetchFn: () => fetchFn(scopeKey),
      forceRefresh: true,
      fetchedBy: request.headers.get('origin') ? 'user' : 'api',
    });

    return NextResponse.json({
      status: 'refreshed',
      source,
      scopeKey,
      meta: result.meta,
      data: result.data,
    });
  } catch (e: any) {
    console.error(`[cache-refresh] ${source}/${scopeKey} failed:`, e.message);
    return NextResponse.json(
      { error: e.message || 'Refresh failed' },
      { status: 502 },
    );
  }
}
