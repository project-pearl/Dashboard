// app/api/cron/rebuild-nwm/route.ts
// Cron endpoint — fetches National Water Model high-flow stream analysis data
// from the NWM ArcGIS Map Service.
// Schedule: every 6 hours via Vercel cron.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setNwmCache, getNwmCacheStatus,
  isNwmBuildInProgress, setNwmBuildInProgress,
  gridKey,
  type NwmReach,
} from '@/lib/nwmCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const NWM_MAPSERVER = 'https://mapservices.weather.noaa.gov/vector/rest/services/obs/NWM_Stream_Analysis/MapServer/0/query';
const RESULT_LIMIT = 2000;
const FETCH_TIMEOUT_MS = 60_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/**
 * Extract lat/lng from an ArcGIS feature geometry.
 * Point geometry: { x, y }
 * Polyline geometry: { paths: [[[x,y], ...], ...] } — use midpoint of first path.
 */
function extractLatLng(geometry: any): { lat: number; lng: number } | null {
  if (!geometry) return null;

  // Point geometry
  if (typeof geometry.x === 'number' && typeof geometry.y === 'number') {
    return { lat: geometry.y, lng: geometry.x };
  }

  // Polyline geometry — use midpoint of first path segment
  if (geometry.paths && Array.isArray(geometry.paths) && geometry.paths.length > 0) {
    const path = geometry.paths[0];
    if (!Array.isArray(path) || path.length === 0) return null;
    const midIdx = Math.floor(path.length / 2);
    const point = path[midIdx];
    if (Array.isArray(point) && point.length >= 2) {
      return { lat: point[1], lng: point[0] };
    }
  }

  return null;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isNwmBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'NWM build already in progress',
      cache: getNwmCacheStatus(),
    });
  }

  setNwmBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Query NWM ArcGIS for high-flow reaches (recurrence > 2 year return period)
    const params = new URLSearchParams({
      where: 'recurrence>2',
      outFields: 'feature_id,streamflow,velocity,recurrence,reach_id,nwm_feature_id',
      geometry: '-130,24,-65,50',
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects',
      outSR: '4326',
      returnGeometry: 'true',
      f: 'json',
      resultRecordCount: String(RESULT_LIMIT),
    });

    const url = `${NWM_MAPSERVER}?${params.toString()}`;
    console.log('[NWM Cron] Fetching high-flow reaches from ArcGIS...');

    const res = await fetch(url, {
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`ArcGIS HTTP ${res.status}`);
    }

    const data = await res.json();

    // Check for ArcGIS error response
    if (data.error) {
      console.warn(`[NWM Cron] ArcGIS service error: ${JSON.stringify(data.error)}`);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        warning: `ArcGIS error: ${data.error.message || 'Unknown'}`,
        cache: getNwmCacheStatus(),
      });
    }

    const features = data.features || [];
    console.log(`[NWM Cron] Received ${features.length} features`);

    // Parse features into NwmReach records
    const reaches: NwmReach[] = [];
    let skippedNoGeom = 0;

    for (const feature of features) {
      const attrs = feature.attributes || {};
      const coords = extractLatLng(feature.geometry);

      if (!coords) {
        skippedNoGeom++;
        continue;
      }

      const featureId = String(
        attrs.feature_id ?? attrs.nwm_feature_id ?? attrs.reach_id ?? ''
      );
      if (!featureId) continue;

      reaches.push({
        featureId,
        lat: coords.lat,
        lng: coords.lng,
        streamflow: parseNum(attrs.streamflow),
        velocity: parseNum(attrs.velocity),
        recurrence: parseNum(attrs.recurrence),
      });
    }

    console.log(`[NWM Cron] Parsed ${reaches.length} reaches (${skippedNoGeom} skipped, no geometry)`);

    // Build grid index
    const grid: Record<string, { reaches: NwmReach[] }> = {};
    for (const r of reaches) {
      const key = gridKey(r.lat, r.lng);
      if (!grid[key]) grid[key] = { reaches: [] };
      grid[key].reaches.push(r);
    }

    // Empty-data guard
    if (reaches.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[NWM Cron] 0 reaches in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        totalFeatures: features.length,
        skippedNoGeom,
        cache: getNwmCacheStatus(),
      });
    }

    await setNwmCache({
      _meta: {
        built: new Date().toISOString(),
        reachCount: reaches.length,
        gridCells: Object.keys(grid).length,
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[NWM Cron] Complete in ${elapsed}s — ${reaches.length} reaches, ${Object.keys(grid).length} cells`);

    recordCronRun('rebuild-nwm', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      reachCount: reaches.length,
      gridCells: Object.keys(grid).length,
      totalFeatures: features.length,
      skippedNoGeom,
      cache: getNwmCacheStatus(),
    });

  } catch (err: any) {
    console.error('[NWM Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-nwm' } });

    notifySlackCronFailure({ cronName: 'rebuild-nwm', error: err.message || 'build failed', duration: Date.now() - startTime });

    recordCronRun('rebuild-nwm', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'NWM build failed' },
      { status: 500 },
    );
  } finally {
    setNwmBuildInProgress(false);
  }
}
