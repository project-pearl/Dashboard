// app/api/cron/rebuild-nfip-claims/route.ts
// Cron endpoint — fetches FEMA NFIP flood insurance claims per state (last 10 years).
// Schedule: daily at 10:00 PM UTC.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setNfipClaimsCache, getNfipClaimsCacheStatus,
  isNfipClaimsBuildInProgress, setNfipClaimsBuildInProgress,
  type NfipClaim,
} from '@/lib/nfipClaimsCache';
import { ALL_STATES } from '@/lib/constants';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const NFIP_API = 'https://www.fema.gov/api/open/v2/FimaNfipClaims';
const FETCH_TIMEOUT_MS = 30_000;
const CONCURRENCY = 10;
const MIN_YEAR = new Date().getFullYear() - 10;

// ── Per-State Fetch ─────────────────────────────────────────────────────────

async function fetchClaimsForState(stateAbbr: string): Promise<NfipClaim[]> {
  const params = new URLSearchParams({
    '$filter': `state eq '${stateAbbr}' and yearOfLoss ge ${MIN_YEAR}`,
    '$select': 'state,countyCode,yearOfLoss,amountPaidOnBuildingClaim,amountPaidOnContentsClaim,floodZone,waterDepth,latitude,longitude,asOfDate',
    '$top': '10000',
    '$orderby': 'yearOfLoss desc',
  });

  const res = await fetch(`${NFIP_API}?${params}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    console.warn(`[NFIP Claims Cron] ${stateAbbr}: HTTP ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items = data?.FimaNfipClaims || data?.items || [];
  const claims: NfipClaim[] = [];

  for (const item of items) {
    claims.push({
      state: item.state || stateAbbr,
      countyCode: item.countyCode || '',
      yearOfLoss: item.yearOfLoss ?? 0,
      amountPaidOnBuildingClaim: item.amountPaidOnBuildingClaim ?? 0,
      amountPaidOnContentsClaim: item.amountPaidOnContentsClaim ?? 0,
      floodZone: item.floodZone || '',
      waterDepth: item.waterDepth != null ? item.waterDepth : null,
      lat: item.latitude != null ? parseFloat(item.latitude) || null : null,
      lng: item.longitude != null ? parseFloat(item.longitude) || null : null,
      asOfDate: item.asOfDate || '',
    });
  }

  return claims;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isNfipClaimsBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'NFIP Claims build already in progress',
      cache: getNfipClaimsCacheStatus(),
    });
  }

  setNfipClaimsBuildInProgress(true);
  const startTime = Date.now();

  try {
    const claimsByState: Record<string, { claims: NfipClaim[]; fetched: string }> = {};
    const now = new Date().toISOString();
    let totalClaims = 0;
    let statesFetched = 0;

    // Concurrency-limited state fetch
    const queue = [...ALL_STATES];
    let idx = 0;
    let running = 0;

    await new Promise<void>((resolve) => {
      function next() {
        if (idx >= queue.length && running === 0) return resolve();
        while (running < CONCURRENCY && idx < queue.length) {
          const st = queue[idx++];
          running++;
          (async () => {
            try {
              const claims = await fetchClaimsForState(st);
              claimsByState[st] = { claims, fetched: now };
              if (claims.length > 0) {
                totalClaims += claims.length;
                statesFetched++;
                console.log(`[NFIP Claims Cron] ${st}: ${claims.length} claims`);
              }
            } catch (e: any) {
              console.warn(`[NFIP Claims Cron] ${st}: ${e.message}`);
              claimsByState[st] = { claims: [], fetched: now };
            } finally {
              running--;
              next();
            }
          })();
        }
      }
      next();
    });

    // Empty-data guard
    if (totalClaims === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[NFIP Claims Cron] No claims found in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getNfipClaimsCacheStatus(),
      });
    }

    await setNfipClaimsCache(claimsByState);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[NFIP Claims Cron] Complete in ${elapsed}s — ${totalClaims} claims across ${statesFetched} states`);

    recordCronRun('rebuild-nfip-claims', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      totalClaims,
      statesFetched,
      cache: getNfipClaimsCacheStatus(),
    });

  } catch (err: any) {
    console.error('[NFIP Claims Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-nfip-claims' } });
    notifySlackCronFailure({ cronName: 'rebuild-nfip-claims', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-nfip-claims', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'NFIP Claims build failed' },
      { status: 500 },
    );
  } finally {
    setNfipClaimsBuildInProgress(false);
  }
}
