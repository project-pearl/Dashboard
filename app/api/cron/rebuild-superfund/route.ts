// app/api/cron/rebuild-superfund/route.ts
// Cron endpoint — fetches EPA Superfund NPL sites from ArcGIS Feature Server.
// Queries per state with semaphore concurrency (10 at a time).
// Schedule: daily at 3:15 AM UTC.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setSuperfundCache, getSuperfundCacheStatus,
  isSuperfundBuildInProgress, setSuperfundBuildInProgress,
  type SuperfundSite,
} from '@/lib/superfundCache';
import { STATE_NAMES, NAME_TO_ABBR } from '@/lib/mapUtils';
import { isCronAuthorized } from '@/lib/apiAuth';

// ── Config ───────────────────────────────────────────────────────────────────

const ARCGIS_URL = 'https://services.arcgis.com/cJ9YHowT8TU7DUyn/ArcGIS/rest/services/Superfund_National_Priorities_List_(NPL)_Sites_with_Status_Information/FeatureServer/0/query';
const CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 30_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchStateSites(stateAbbr: string, stateName: string): Promise<SuperfundSite[]> {
  const params = new URLSearchParams({
    where: `State='${stateName}'`,
    outFields: 'Site_Name,State,City,County,Status,Latitude,Longitude,Site_Score,Site_EPA_ID,Listing_Date',
    f: 'json',
    resultRecordCount: '2000',
  });

  const res = await fetch(`${ARCGIS_URL}?${params}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    console.warn(`[Superfund Cron] ${stateAbbr}: HTTP ${res.status}`);
    return [];
  }

  const data = await res.json();
  const features = data?.features || [];

  const sites: SuperfundSite[] = [];
  for (const f of features) {
    const a = f.attributes;
    if (!a) continue;

    sites.push({
      siteEpaId: a.Site_EPA_ID || '',
      siteName: a.Site_Name || '',
      stateAbbr,
      city: a.City || '',
      county: a.County || '',
      status: a.Status || '',
      siteScore: a.Site_Score != null ? Number(a.Site_Score) : null,
      lat: a.Latitude ?? 0,
      lng: a.Longitude ?? 0,
      listingDate: a.Listing_Date ? new Date(a.Listing_Date).toISOString() : null,
    });
  }

  return sites;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isSuperfundBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Superfund build already in progress',
      cache: getSuperfundCacheStatus(),
    });
  }

  setSuperfundBuildInProgress(true);
  const startTime = Date.now();

  try {
    const sitesByState: Record<string, { sites: SuperfundSite[]; fetched: string }> = {};
    let totalSites = 0;
    let failedStates = 0;

    // Build queue of [abbr, fullName] pairs
    const queue: [string, string][] = Object.entries(STATE_NAMES);
    const inFlight: Promise<void>[] = [];

    async function processState(abbr: string, name: string) {
      try {
        const sites = await fetchStateSites(abbr, name);
        sitesByState[abbr] = {
          sites,
          fetched: new Date().toISOString(),
        };
        totalSites += sites.length;
        if (sites.length > 0) {
          console.log(`[Superfund Cron] ${abbr}: ${sites.length} NPL sites`);
        }
      } catch (err: any) {
        console.warn(`[Superfund Cron] ${abbr} failed: ${err.message}`);
        failedStates++;
      }
    }

    while (queue.length > 0 || inFlight.length > 0) {
      while (inFlight.length < CONCURRENCY && queue.length > 0) {
        const [abbr, name] = queue.shift()!;
        const p = processState(abbr, name).then(() => {
          inFlight.splice(inFlight.indexOf(p), 1);
        });
        inFlight.push(p);
      }
      if (inFlight.length > 0) {
        await Promise.race(inFlight);
      }
    }

    // Empty-data guard
    if (totalSites === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[Superfund Cron] No sites found in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        failedStates,
        cache: getSuperfundCacheStatus(),
      });
    }

    await setSuperfundCache(sitesByState);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Superfund Cron] Complete in ${elapsed}s — ${totalSites} NPL sites across ${Object.keys(sitesByState).length} states`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      totalSites,
      statesFetched: Object.keys(sitesByState).length,
      failedStates,
      cache: getSuperfundCacheStatus(),
    });

  } catch (err: any) {
    console.error('[Superfund Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'Superfund build failed' },
      { status: 500 },
    );
  } finally {
    setSuperfundBuildInProgress(false);
  }
}
