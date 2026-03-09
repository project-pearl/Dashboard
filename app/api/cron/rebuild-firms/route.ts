// app/api/cron/rebuild-firms/route.ts
// Cron endpoint — fetches active fire detections from NASA FIRMS for military command regions.
// Runs every 4 hours. Source: VIIRS NOAA-20 NRT via FIRMS Area API.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setFirmsCache,
  getFirmsCacheStatus,
  isFirmsBuildInProgress,
  setFirmsBuildInProgress,
  FIRMS_REGIONS,
  type FirmsDetection,
  type FirmsRegionSummary,
  type FirmsCacheData,
} from '@/lib/firmsCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';
import installationsJson from '@/data/military-installations.json';

const FETCH_TIMEOUT_MS = 30_000;
const MAX_DETECTIONS_PER_REGION = 2000;

interface Installation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  branch: string;
  burnPitHistory: boolean;
}

const INSTALLATIONS: Installation[] = installationsJson as Installation[];

/* ------------------------------------------------------------------ */
/*  Haversine                                                          */
/* ------------------------------------------------------------------ */

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ------------------------------------------------------------------ */
/*  CSV Parser (FIRMS CSV is simple — no quoted fields)                */
/* ------------------------------------------------------------------ */

function parseCSV(csv: string): Array<Record<string, string>> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    if (vals.length < headers.length) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = vals[j]?.trim() ?? '';
    }
    rows.push(row);
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/*  Nearest Installation                                               */
/* ------------------------------------------------------------------ */

function findNearestInstallation(lat: number, lng: number, regionId: string): { name: string; distMi: number } | null {
  // Check installations in same region first, then all
  const candidates = INSTALLATIONS.filter(i => i.region === regionId);
  let best: { name: string; distMi: number } | null = null;
  for (const inst of candidates) {
    const d = haversineMi(lat, lng, inst.lat, inst.lng);
    if (!best || d < best.distMi) {
      best = { name: inst.name, distMi: Math.round(d * 10) / 10 };
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/*  Fetch Region                                                       */
/* ------------------------------------------------------------------ */

async function fetchRegion(
  regionId: string,
  label: string,
  bbox: [number, number, number, number],
  mapKey: string,
): Promise<FirmsRegionSummary> {
  const [w, s, e, n] = bbox;
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/VIIRS_NOAA20_NRT/${w},${s},${e},${n}/2`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'PEARL-Platform/1.0' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    console.warn(`[rebuild-firms] Region ${regionId} HTTP ${res.status}`);
    return { region: regionId, label, bbox, detectionCount: 0, highConfidenceCount: 0, maxFrp: 0, detections: [] };
  }

  const csv = await res.text();
  const rows = parseCSV(csv);

  // Map confidence: l->low, n->nominal, h->high; filter out low
  const detections: FirmsDetection[] = [];
  let maxFrp = 0;
  let highCount = 0;

  for (const row of rows) {
    const rawConf = (row.confidence || '').toLowerCase();
    if (rawConf === 'l' || rawConf === 'low') continue; // filter low confidence

    const confidence: 'nominal' | 'high' = (rawConf === 'h' || rawConf === 'high') ? 'high' : 'nominal';
    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);
    const frp = parseFloat(row.frp) || 0;
    const brightness = parseFloat(row.bright_ti4 || row.brightness) || 0;

    if (isNaN(lat) || isNaN(lng)) continue;

    const nearest = findNearestInstallation(lat, lng, regionId);
    if (confidence === 'high') highCount++;
    if (frp > maxFrp) maxFrp = frp;

    detections.push({
      lat,
      lng,
      brightness,
      acq_date: row.acq_date || '',
      acq_time: row.acq_time || '',
      confidence,
      frp,
      daynight: (row.daynight || 'D') as 'D' | 'N',
      region: regionId,
      nearestInstallation: nearest?.name ?? null,
      distanceToInstallationMi: nearest?.distMi ?? null,
    });
  }

  // Cap at MAX_DETECTIONS_PER_REGION (sort by FRP descending to keep most intense)
  if (detections.length > MAX_DETECTIONS_PER_REGION) {
    detections.sort((a, b) => b.frp - a.frp);
    detections.length = MAX_DETECTIONS_PER_REGION;
  }

  return {
    region: regionId,
    label,
    bbox,
    detectionCount: detections.length,
    highConfidenceCount: highCount,
    maxFrp: Math.round(maxFrp * 10) / 10,
    detections,
  };
}

/* ------------------------------------------------------------------ */
/*  GET Handler                                                        */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mapKey = process.env.FIRMS_MAP_KEY;
  if (!mapKey) {
    return NextResponse.json({ status: 'skipped', reason: 'FIRMS_MAP_KEY not configured' });
  }

  if (isFirmsBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'FIRMS build already in progress',
      cache: getFirmsCacheStatus(),
    });
  }

  setFirmsBuildInProgress(true);
  const start = Date.now();

  try {
    // Fetch all regions in parallel
    const results = await Promise.allSettled(
      FIRMS_REGIONS.map(r => fetchRegion(r.id, r.label, r.bbox, mapKey))
    );

    const regions: Record<string, FirmsRegionSummary> = {};
    let totalDetections = 0;
    let failures = 0;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        regions[result.value.region] = result.value;
        totalDetections += result.value.detectionCount;
      } else {
        failures++;
        console.warn(`[rebuild-firms] Region fetch failed:`, result.reason);
      }
    }

    const regionCount = Object.keys(regions).length;
    if (totalDetections === 0 && regionCount === 0) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        failures,
        cache: getFirmsCacheStatus(),
      });
    }

    const cacheData: FirmsCacheData = {
      _meta: {
        built: new Date().toISOString(),
        regionCount,
        totalDetections,
      },
      regions,
    };

    await setFirmsCache(cacheData);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    recordCronRun('rebuild-firms', 'success', Date.now() - start);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      regionCount,
      totalDetections,
      failures,
      regionBreakdown: Object.fromEntries(
        Object.values(regions).map(r => [r.region, { detections: r.detectionCount, highConf: r.highConfidenceCount, maxFrp: r.maxFrp }])
      ),
      cache: getFirmsCacheStatus(),
    });
  } catch (err: any) {
    console.error('[rebuild-firms] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-firms' } });
    notifySlackCronFailure({ cronName: 'rebuild-firms', error: err.message || 'build failed', duration: Date.now() - start });
    recordCronRun('rebuild-firms', 'error', Date.now() - start, err.message);
    return NextResponse.json(
      { status: 'error', error: err?.message || 'FIRMS build failed' },
      { status: 500 },
    );
  } finally {
    setFirmsBuildInProgress(false);
  }
}
