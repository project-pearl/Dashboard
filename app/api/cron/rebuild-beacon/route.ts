// app/api/cron/rebuild-beacon/route.ts
// Cron endpoint — fetches EPA BEACON beach advisory/notification data.
// Queries beach notifications per state and builds a spatial grid cache.
// Schedule: daily at 16:00 UTC via Vercel cron.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setBeaconCache, getBeaconCacheStatus,
  isBeaconBuildInProgress, setBeaconBuildInProgress,
  gridKey,
  type BeachAdvisory,
} from '@/lib/beaconCache';
import { ALL_STATES } from '@/lib/constants';
import { enqueueEvents } from '@/lib/sentinel/eventQueue';
import type { ChangeEvent, SeverityHint } from '@/lib/sentinel/types';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const BEACON_URL = 'https://watersgeo.epa.gov/beacon2/rest/services/notifications';
const FETCH_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 5_000;

function parseNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

// ── Fetch One State ─────────────────────────────────────────────────────────

async function fetchBeaconState(state: string): Promise<BeachAdvisory[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

  const params = new URLSearchParams({
    state,
    startDate: dateStr,
    f: 'json',
  });

  const res = await fetch(`${BEACON_URL}?${params.toString()}`, {
    headers: { 'User-Agent': 'PEARL-Platform/1.0' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    if (res.status === 404 || res.status === 204) return []; // no data for state
    throw new Error(`BEACON API: HTTP ${res.status} for ${state}`);
  }

  const json = await res.json();
  const records: any[] = Array.isArray(json) ? json : json?.data || json?.notifications || json?.features || [];

  const advisories: BeachAdvisory[] = [];
  for (const r of records) {
    const attrs = r.attributes || r.properties || r;
    const lat = parseNum(attrs.LATITUDE || attrs.latitude || attrs.lat);
    const lng = parseNum(attrs.LONGITUDE || attrs.longitude || attrs.lng || attrs.lon);

    if (lat === 0 && lng === 0) continue;

    advisories.push({
      beachId: String(attrs.BEACH_ID || attrs.beachId || attrs.beach_id || ''),
      beachName: attrs.BEACH_NAME || attrs.beachName || attrs.beach_name || '',
      state,
      lat,
      lng,
      indicator: attrs.INDICATOR || attrs.indicator || attrs.PARAMETER || '',
      value: parseNum(attrs.VALUE || attrs.value || attrs.RESULT || attrs.result),
      advisoryStatus: (attrs.ADVISORY_STATUS || attrs.advisoryStatus || attrs.status || 'open').toLowerCase(),
      sampleDate: attrs.SAMPLE_DATE || attrs.sampleDate || attrs.sample_date || '',
      notificationDate: attrs.NOTIFICATION_DATE || attrs.notificationDate || attrs.notification_date || '',
    });
  }

  return advisories;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isBeaconBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'BEACON build already in progress',
      cache: getBeaconCacheStatus(),
    });
  }

  setBeaconBuildInProgress(true);
  const startTime = Date.now();

  try {
    console.log('[BEACON Cron] Fetching beach notifications (last 30 days)...');

    // Coastal/Great Lakes states most likely to have beach data
    const COASTAL_STATES = [
      'AL', 'CA', 'CT', 'DE', 'FL', 'GA', 'HI', 'IL', 'IN', 'LA',
      'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'NH', 'NJ', 'NY', 'NC',
      'OH', 'OR', 'PA', 'RI', 'SC', 'TX', 'VA', 'WA', 'WI',
    ];

    let allAdvisories: BeachAdvisory[] = [];
    const failedStates: string[] = [];

    // Fetch in batches of 6 to avoid overwhelming the API
    for (let i = 0; i < COASTAL_STATES.length; i += 6) {
      const batch = COASTAL_STATES.slice(i, i + 6);
      const results = await Promise.allSettled(
        batch.map(state => fetchBeaconState(state))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled') {
          allAdvisories.push(...result.value);
        } else {
          failedStates.push(batch[j]);
          console.warn(`[BEACON Cron] Failed for ${batch[j]}: ${result.reason?.message || 'unknown'}`);
        }
      }
    }

    // Retry failed states once
    if (failedStates.length > 0) {
      console.log(`[BEACON Cron] Retrying ${failedStates.length} failed states...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      const retryResults = await Promise.allSettled(
        failedStates.map(state => fetchBeaconState(state))
      );
      for (const result of retryResults) {
        if (result.status === 'fulfilled') {
          allAdvisories.push(...result.value);
        }
      }
    }

    console.log(`[BEACON Cron] Total: ${allAdvisories.length} advisories`);

    // Build grid index
    const grid: Record<string, { advisories: BeachAdvisory[] }> = {};
    for (const adv of allAdvisories) {
      const key = gridKey(adv.lat, adv.lng);
      if (!grid[key]) grid[key] = { advisories: [] };
      grid[key].advisories.push(adv);
    }

    // Empty-data guard
    if (allAdvisories.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[BEACON Cron] No advisories found in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getBeaconCacheStatus(),
      });
    }

    await setBeaconCache({
      _meta: {
        built: new Date().toISOString(),
        advisoryCount: allAdvisories.length,
        gridCells: Object.keys(grid).length,
      },
      grid,
    });

    // Push advisories/closures as sentinel events
    const nowIso = new Date().toISOString();
    const sentinelEvents: ChangeEvent[] = [];
    for (const adv of allAdvisories) {
      // Only push closures, high-value advisories
      const isClosed = adv.advisoryStatus === 'closed';
      const isHighEcoli = adv.indicator.toLowerCase().includes('coli') && adv.value > 235;
      const isHighEntero = adv.indicator.toLowerCase().includes('enterococcus') && adv.value > 70;

      if (!isClosed && !isHighEcoli && !isHighEntero) continue;

      let severityHint: SeverityHint = 'MODERATE';
      if (isClosed) severityHint = 'CRITICAL';
      else if (
        (adv.indicator.toLowerCase().includes('coli') && adv.value > 576) ||
        (adv.indicator.toLowerCase().includes('enterococcus') && adv.value > 130)
      ) severityHint = 'HIGH';

      sentinelEvents.push({
        eventId: crypto.randomUUID(),
        source: 'EPA_BEACON',
        detectedAt: nowIso,
        sourceTimestamp: adv.sampleDate || adv.notificationDate || null,
        changeType: isClosed ? 'THRESHOLD_CROSSED' : 'VALUE_CHANGE',
        geography: {
          stateAbbr: adv.state || undefined,
          lat: adv.lat,
          lng: adv.lng,
        },
        severityHint,
        payload: {
          beachId: adv.beachId,
          beachName: adv.beachName,
          indicator: adv.indicator,
          value: adv.value,
          advisoryStatus: adv.advisoryStatus,
        },
        metadata: {
          sourceRecordId: `beacon:${adv.beachId}:${adv.sampleDate}`,
          currentValue: adv.value,
        },
      });
    }

    let sentinelPushed = 0;
    if (sentinelEvents.length > 0) {
      const added = await enqueueEvents(sentinelEvents);
      sentinelPushed = added.length;
      console.log(`[BEACON Cron] Pushed ${sentinelPushed} sentinel events`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[BEACON Cron] Complete in ${elapsed}s — ${allAdvisories.length} advisories, ${Object.keys(grid).length} cells`);

    recordCronRun('rebuild-beacon', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      advisoryCount: allAdvisories.length,
      gridCells: Object.keys(grid).length,
      sentinelPushed,
      cache: getBeaconCacheStatus(),
    });

  } catch (err: any) {
    console.error('[BEACON Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-beacon' } });

    notifySlackCronFailure({ cronName: 'rebuild-beacon', error: err.message || 'build failed', duration: Date.now() - startTime });

    recordCronRun('rebuild-beacon', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'BEACON build failed' },
      { status: 500 },
    );
  } finally {
    setBeaconBuildInProgress(false);
  }
}
