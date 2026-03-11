// app/api/cron/rebuild-seismic/route.ts
// Cron endpoint — fetches recent M2.5+ earthquakes from USGS.
// Source: USGS Earthquake Hazards Program GeoJSON feed (free, no auth).
// Schedule: every 30 minutes via Vercel cron.

export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import {
  setSeismicCache, getSeismicCacheStatus,
  isSeismicBuildInProgress, setSeismicBuildInProgress,
  type SeismicEvent,
} from '@/lib/seismicCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

const FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
const FETCH_TIMEOUT_MS = 20_000;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isSeismicBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Seismic build already in progress',
      cache: getSeismicCacheStatus(),
    });
  }

  setSeismicBuildInProgress(true);
  const startTime = Date.now();

  try {
    console.log('[Seismic Cron] Fetching M2.5+ earthquakes (past day)...');

    const res = await fetch(FEED_URL, {
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`USGS Earthquake API: HTTP ${res.status}`);
    const geoJson = await res.json();

    const features = geoJson?.features ?? [];
    console.log(`[Seismic Cron] Received ${features.length} earthquake features`);

    const events: SeismicEvent[] = features.map((f: any) => ({
      id: f.id || f.properties?.code || '',
      mag: f.properties?.mag ?? 0,
      lat: f.geometry?.coordinates?.[1] ?? 0,
      lng: f.geometry?.coordinates?.[0] ?? 0,
      place: f.properties?.place || '',
      time: f.properties?.time ?? 0,
      depth: f.geometry?.coordinates?.[2] ?? 0,
      url: f.properties?.url || '',
    }));

    // Empty-data guard
    if (events.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[Seismic Cron] 0 events in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getSeismicCacheStatus(),
      });
    }

    await setSeismicCache({
      _meta: {
        built: new Date().toISOString(),
        eventCount: events.length,
      },
      events,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Seismic Cron] Complete in ${elapsed}s — ${events.length} events`);

    recordCronRun('rebuild-seismic', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      eventCount: events.length,
      cache: getSeismicCacheStatus(),
    });

  } catch (err: any) {
    console.error('[Seismic Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-seismic' } });
    notifySlackCronFailure({ cronName: 'rebuild-seismic', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-seismic', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'Seismic build failed' },
      { status: 500 },
    );
  } finally {
    setSeismicBuildInProgress(false);
  }
}
