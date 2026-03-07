// app/api/cron/rebuild-fema/route.ts
// Cron endpoint — fetches FEMA disaster declarations for the last 90 days,
// filters to water-relevant incident types, groups by state.
// Schedule: daily at 3:00 AM UTC.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setFemaCache, getFemaCacheStatus,
  isFemaBuildInProgress, setFemaBuildInProgress,
  setFemaNfipCommunities,
  type FemaDeclaration, type NfipCommunity,
} from '@/lib/femaCache';

// ── Config ───────────────────────────────────────────────────────────────────

const FEMA_API = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';
const NFIP_API = 'https://www.fema.gov/api/open/v2/NfipCommunityStatusBook';
const FETCH_TIMEOUT_MS = 30_000;
const NFIP_CONCURRENCY = 6;

/** Incident types relevant to water quality (from sentinel femaAdapter) */
const WATER_INCIDENT_TYPES = new Set([
  'Flood', 'Hurricane', 'Severe Storm(s)', 'Typhoon',
  'Coastal Storm', 'Dam/Levee Break', 'Tornado',
  'Tropical Storm', 'Severe Ice Storm',
]);

import { ALL_STATES } from '@/lib/constants';
import { isCronAuthorized } from '@/lib/apiAuth';

// ── NFIP Community Status Fetch ─────────────────────────────────────────────

async function fetchNfipCommunities(stateAbbr: string): Promise<NfipCommunity[]> {
  try {
    const params = new URLSearchParams({
      '$filter': `state eq '${stateAbbr}'`,
      '$top': '1000',
      '$select': 'communityIdNumber,communityName,state,countyFipsCode,programEntryDate,communityStatus,crsClassCode',
    });
    const res = await fetch(`${NFIP_API}?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.warn(`[FEMA Cron] NFIP ${stateAbbr}: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const items = data?.NfipCommunityStatusBook || data?.items || [];
    const communities: NfipCommunity[] = [];
    for (const item of items) {
      communities.push({
        communityId: (item.communityIdNumber || item.communityId || '').toString(),
        communityName: item.communityName || '',
        state: item.state || stateAbbr,
        countyFips: item.countyFipsCode || item.countyFips || '',
        status: item.communityStatus || item.status || 'Unknown',
        crsClass: item.crsClassCode != null ? parseInt(item.crsClassCode, 10) || null : null,
      });
    }
    return communities;
  } catch (e: any) {
    console.warn(`[FEMA Cron] NFIP ${stateAbbr}: ${e.message}`);
    return [];
  }
}

/**
 * Fetch NFIP community status for all states with concurrency limit.
 */
async function fetchAllNfipCommunities(): Promise<{ total: number; states: number }> {
  const queue = [...ALL_STATES];
  let totalCommunities = 0;
  let statesProcessed = 0;
  let idx = 0;
  let running = 0;

  await new Promise<void>((resolve) => {
    function next() {
      if (idx >= queue.length && running === 0) return resolve();
      while (running < NFIP_CONCURRENCY && idx < queue.length) {
        const st = queue[idx++];
        running++;
        (async () => {
          try {
            const communities = await fetchNfipCommunities(st);
            if (communities.length > 0) {
              setFemaNfipCommunities(st, communities);
              totalCommunities += communities.length;
              statesProcessed++;
              console.log(`[FEMA Cron] NFIP ${st}: ${communities.length} communities`);
            }
          } catch {
            // Skip on failure
          } finally {
            running--;
            next();
          }
        })();
      }
    }
    next();
  });

  return { total: totalCommunities, states: statesProcessed };
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isFemaBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'FEMA build already in progress',
      cache: getFemaCacheStatus(),
    });
  }

  setFemaBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Fetch last 90 days of declarations
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const filterDate = `${String(ninetyDaysAgo.getFullYear())}-${String(ninetyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(ninetyDaysAgo.getDate()).padStart(2, '0')}`;

    const params = new URLSearchParams({
      '$filter': `declarationDate ge '${filterDate}'`,
      '$select': 'disasterNumber,state,declarationDate,incidentType,declarationTitle,declarationType,designatedArea,fipsStateCode,fipsCountyCode',
      '$orderby': 'declarationDate desc',
      '$top': '1000',
    });

    const res = await fetch(`${FEMA_API}?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`FEMA API returned ${res.status}`);
    }

    const data = await res.json();
    const rawDeclarations = (data?.DisasterDeclarationsSummaries ?? []) as any[];

    // Filter to water-relevant types and map to FemaDeclaration
    const declarations: FemaDeclaration[] = [];
    for (const d of rawDeclarations) {
      const incidentType = d.incidentType ?? '';
      if (!WATER_INCIDENT_TYPES.has(incidentType)) continue;

      declarations.push({
        disasterNumber: d.disasterNumber ?? 0,
        state: d.state ?? '',
        declarationDate: d.declarationDate ?? '',
        incidentType,
        declarationTitle: d.declarationTitle ?? '',
        declarationType: d.declarationType ?? '',
        designatedArea: d.designatedArea ?? '',
        fipsStateCode: d.fipsStateCode ?? '',
        fipsCountyCode: d.fipsCountyCode ?? '',
      });
    }

    // Empty-data guard
    if (declarations.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[FEMA Cron] No water-relevant declarations found in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        rawCount: rawDeclarations.length,
        cache: getFemaCacheStatus(),
      });
    }

    // Group by state
    const declsByState: Record<string, { declarations: FemaDeclaration[]; fetched: string }> = {};
    const now = new Date().toISOString();
    for (const d of declarations) {
      if (!d.state) continue;
      if (!declsByState[d.state]) {
        declsByState[d.state] = { declarations: [], fetched: now };
      }
      declsByState[d.state].declarations.push(d);
    }

    await setFemaCache(declsByState);

    // ── Fetch NFIP Community Status (paginated, per state) ──────────
    let nfipResult = { total: 0, states: 0 };
    try {
      nfipResult = await fetchAllNfipCommunities();
      console.log(`[FEMA Cron] NFIP: ${nfipResult.total} communities across ${nfipResult.states} states`);
    } catch (e: any) {
      console.warn(`[FEMA Cron] NFIP fetch failed: ${e.message} — continuing without NFIP data`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[FEMA Cron] Complete in ${elapsed}s — ${declarations.length} water declarations across ${Object.keys(declsByState).length} states`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      totalDeclarations: declarations.length,
      statesFetched: Object.keys(declsByState).length,
      rawCount: rawDeclarations.length,
      nfipCommunities: nfipResult.total,
      nfipStatesProcessed: nfipResult.states,
      cache: getFemaCacheStatus(),
    });

  } catch (err: any) {
    console.error('[FEMA Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'FEMA build failed' },
      { status: 500 },
    );
  } finally {
    setFemaBuildInProgress(false);
  }
}
