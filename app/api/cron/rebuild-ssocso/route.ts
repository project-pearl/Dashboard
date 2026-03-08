// app/api/cron/rebuild-ssocso/route.ts
// Cron endpoint — fetches EPA ECHO CWA SSO/CSO overflow event data.
// Queries last 30 days per state, parses response, and builds spatial grid cache.
// Pushes overflow events as sentinel SSO_CSO events for bio-threat-correlation pattern.
// Schedule: daily at 15:30 UTC via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setSsoCsoCache, getSsoCsoCacheStatus,
  isSsoCsoBuildInProgress, setSsoCsoBuildInProgress,
  gridKey,
  type SsoEvent,
} from '@/lib/ssoCsoCache';
import { ALL_STATES } from '@/lib/constants';
import { enqueueEvents } from '@/lib/sentinel/eventQueue';
import type { ChangeEvent, SeverityHint } from '@/lib/sentinel/types';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const ECHO_SSO_URL = 'https://echodata.epa.gov/echo/cwa_sso_rest_services.get_download';
const FETCH_TIMEOUT_MS = 45_000;
const RETRY_DELAY_MS = 5_000;

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === '' || v === 'N/A') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function parseStr(v: any): string | null {
  if (v === null || v === undefined || v === '' || v === 'N/A') return null;
  return String(v).trim();
}

// ── Fetch One State ─────────────────────────────────────────────────────────

async function fetchSsoState(state: string): Promise<SsoEvent[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startDate = `${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}/${String(thirtyDaysAgo.getDate()).padStart(2, '0')}/${thirtyDaysAgo.getFullYear()}`;

  const params = new URLSearchParams({
    output: 'JSON',
    p_st: state,
    p_sso_start_date: startDate,
    responseset: '5000',
  });

  const res = await fetch(`${ECHO_SSO_URL}?${params.toString()}`, {
    headers: { 'User-Agent': 'PEARL-Platform/1.0' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    if (res.status === 404 || res.status === 204) return [];
    throw new Error(`ECHO SSO API: HTTP ${res.status} for ${state}`);
  }

  const json = await res.json();
  const records: any[] = json?.Results?.SSOEvents || json?.Results?.Facilities || json?.data || [];

  const events: SsoEvent[] = [];
  for (const r of records) {
    const lat = parseNum(r.Latitude || r.FacLat || r.lat);
    const lng = parseNum(r.Longitude || r.FacLong || r.lng || r.lon);

    if (!lat || !lng || (lat === 0 && lng === 0)) continue;

    const eventTypeRaw = String(r.SSOEventType || r.EventType || r.event_type || 'SSO').toUpperCase();
    const eventType: 'SSO' | 'CSO' = eventTypeRaw.includes('CSO') ? 'CSO' : 'SSO';

    events.push({
      npdesId: String(r.NpdesId || r.SourceID || r.npdes_id || ''),
      facilityName: String(r.FacilityName || r.FacName || r.facility_name || ''),
      state,
      lat,
      lng,
      eventType,
      startDate: String(r.SSOStartDate || r.StartDate || r.start_date || ''),
      endDate: parseStr(r.SSOEndDate || r.EndDate || r.end_date),
      volume: parseNum(r.SSOVolume || r.Volume || r.volume),
      duration: parseNum(r.SSODuration || r.Duration || r.duration),
      receivingWater: parseStr(r.ReceivingWater || r.receiving_water),
      cause: parseStr(r.SSOCause || r.Cause || r.cause),
    });
  }

  return events;
}

// ── Severity Mapping ────────────────────────────────────────────────────────

function volumeToSeverity(volume: number | null): SeverityHint {
  if (!volume) return 'LOW';
  if (volume > 1_000_000) return 'CRITICAL';
  if (volume > 100_000) return 'HIGH';
  if (volume > 10_000) return 'MODERATE';
  return 'LOW';
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isSsoCsoBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'SSO/CSO build already in progress',
      cache: getSsoCsoCacheStatus(),
    });
  }

  setSsoCsoBuildInProgress(true);
  const startTime = Date.now();

  try {
    console.log('[SSO/CSO Cron] Fetching sewer overflow events (last 30 days)...');

    let allEvents: SsoEvent[] = [];
    const failedStates: string[] = [];

    // Fetch in batches of 6
    for (let i = 0; i < ALL_STATES.length; i += 6) {
      const batch = ALL_STATES.slice(i, i + 6);
      const results = await Promise.allSettled(
        batch.map(state => fetchSsoState(state))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled') {
          allEvents.push(...result.value);
        } else {
          failedStates.push(batch[j]);
          console.warn(`[SSO/CSO Cron] Failed for ${batch[j]}: ${result.reason?.message || 'unknown'}`);
        }
      }
    }

    // Retry failed states once
    if (failedStates.length > 0) {
      console.log(`[SSO/CSO Cron] Retrying ${failedStates.length} failed states...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      const retryResults = await Promise.allSettled(
        failedStates.map(state => fetchSsoState(state))
      );
      for (const result of retryResults) {
        if (result.status === 'fulfilled') {
          allEvents.push(...result.value);
        }
      }
    }

    console.log(`[SSO/CSO Cron] Total: ${allEvents.length} events`);

    // Build grid index
    const grid: Record<string, { events: SsoEvent[] }> = {};
    for (const evt of allEvents) {
      const key = gridKey(evt.lat, evt.lng);
      if (!grid[key]) grid[key] = { events: [] };
      grid[key].events.push(evt);
    }

    // Empty-data guard
    if (allEvents.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[SSO/CSO Cron] No events found in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getSsoCsoCacheStatus(),
      });
    }

    await setSsoCsoCache({
      _meta: {
        built: new Date().toISOString(),
        eventCount: allEvents.length,
        gridCells: Object.keys(grid).length,
      },
      grid,
    });

    // Push overflow events as sentinel SSO_CSO events
    const nowIso = new Date().toISOString();
    const sentinelEvents: ChangeEvent[] = [];
    for (const evt of allEvents) {
      const severityHint = volumeToSeverity(evt.volume);

      sentinelEvents.push({
        eventId: crypto.randomUUID(),
        source: 'SSO_CSO',
        detectedAt: nowIso,
        sourceTimestamp: evt.startDate || null,
        changeType: 'NEW_RECORD',
        geography: {
          stateAbbr: evt.state || undefined,
          lat: evt.lat,
          lng: evt.lng,
        },
        severityHint,
        payload: {
          npdesId: evt.npdesId,
          facilityName: evt.facilityName,
          eventType: evt.eventType,
          volume: evt.volume,
          duration: evt.duration,
          receivingWater: evt.receivingWater,
          cause: evt.cause,
        },
        metadata: {
          sourceRecordId: `ssocso:${evt.npdesId}:${evt.startDate}`,
          facilityId: evt.npdesId,
          currentValue: evt.volume ?? undefined,
        },
      });
    }

    let sentinelPushed = 0;
    if (sentinelEvents.length > 0) {
      const added = await enqueueEvents(sentinelEvents);
      sentinelPushed = added.length;
      console.log(`[SSO/CSO Cron] Pushed ${sentinelPushed} sentinel events`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SSO/CSO Cron] Complete in ${elapsed}s — ${allEvents.length} events, ${Object.keys(grid).length} cells`);

    recordCronRun('rebuild-ssocso', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      eventCount: allEvents.length,
      gridCells: Object.keys(grid).length,
      sentinelPushed,
      cache: getSsoCsoCacheStatus(),
    });

  } catch (err: any) {
    console.error('[SSO/CSO Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-ssocso' } });

    notifySlackCronFailure({ cronName: 'rebuild-ssocso', error: err.message || 'build failed', duration: Date.now() - startTime });

    recordCronRun('rebuild-ssocso', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'SSO/CSO build failed' },
      { status: 500 },
    );
  } finally {
    setSsoCsoBuildInProgress(false);
  }
}
