/**
 * Location Water Quality Report API — Fan-out endpoint that resolves a location
 * to coordinates and queries all spatial caches in parallel via Promise.allSettled().
 *
 * GET /api/location-report?lat=39.27&lng=-76.61&state=MD
 * GET /api/location-report?zip=21201
 */

import { NextRequest, NextResponse } from 'next/server';
import type { LocationReport } from '@/lib/locationReport';

// Cache imports
import { ensureWarmed as warmWqp, getWqpCache } from '@/lib/wqpCache';
import { ensureWarmed as warmSdwis, getSdwisCache } from '@/lib/sdwisCache';
import { ensureWarmed as warmIcis, getIcisCache } from '@/lib/icisCache';
import { ensureWarmed as warmEcho, getEchoCache } from '@/lib/echoCache';
import { ensureWarmed as warmPfas, getPfasCache } from '@/lib/pfasCache';
import { ensureWarmed as warmNwisGw, getNwisGwCache } from '@/lib/nwisGwCache';
import { ensureWarmed as warmNwisIv, getUsgsIvCache } from '@/lib/nwisIvCache';
import { ensureWarmed as warmFrs, getFrsCache } from '@/lib/frsCache';
import { ensureWarmed as warmTri, getTriCache } from '@/lib/triCache';
import { ensureWarmed as warmNdbc, getNdbcCache } from '@/lib/ndbcCache';
import { ensureWarmed as warmNars, getNarsCache } from '@/lib/narsCache';
import { ensureWarmed as warmStateReport, getStateReport } from '@/lib/stateReportCache';
import { ensureWarmed as warmAttains, getAttainsCache } from '@/lib/attainsCache';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const EJSCREEN_BASE = 'https://ejscreen.epa.gov/mapper/ejscreenRESTbroker1.aspx';
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

// ── ZIP centroid resolution ──────────────────────────────────────────────────

let _zipData: Record<string, [number, number]> | null = null;

function getZipCentroids(): Record<string, [number, number]> {
  if (!_zipData) {
    _zipData = require('@/lib/zipCentroids.json') as Record<string, [number, number]>;
  }
  return _zipData;
}

// ── EJScreen fetch (same pattern as water-data/route.ts) ────────────────────

async function ejscreenFetch(lat: number, lng: number): Promise<Record<string, unknown> | null> {
  const urls = [
    `${EJSCREEN_BASE}?namestr=&geometry=${lng},${lat}&distance=1&unit=9035&aession=&f=json`,
    `https://pedp-ejscreen.azurewebsites.net/mapper/ejscreenRESTbroker1.aspx?namestr=&geometry=${lng},${lat}&distance=1&unit=9035&f=json`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 604800 },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && !data.error) return data as Record<string, unknown>;
      }
    } catch { /* try next URL */ }
  }
  return null;
}

// ── Mapbox reverse geocode for state ────────────────────────────────────────

async function reverseGeocodeState(lat: number, lng: number): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=region&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0];
    // short_code is like "US-MD"
    const code = feature?.properties?.short_code as string | undefined;
    if (code?.startsWith('US-')) return code.slice(3);
    return null;
  } catch {
    return null;
  }
}

// ── GET handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  let lat: number | null = sp.has('lat') ? parseFloat(sp.get('lat')!) : null;
  let lng: number | null = sp.has('lng') ? parseFloat(sp.get('lng')!) : null;
  let state = sp.get('state')?.toUpperCase() || '';
  const zip = sp.get('zip') || '';
  let label = '';

  // Resolve ZIP to coordinates
  if (zip && (lat === null || lng === null)) {
    const centroids = getZipCentroids();
    const coords = centroids[zip];
    if (!coords) {
      return NextResponse.json({ error: `Unknown ZIP code: ${zip}` }, { status: 400 });
    }
    [lat, lng] = coords;
    label = `ZIP ${zip}`;
  }

  if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: 'Provide lat+lng or zip query parameters' },
      { status: 400 },
    );
  }

  // Resolve state via reverse geocode if not provided
  if (!state) {
    state = (await reverseGeocodeState(lat, lng)) || '';
  }

  if (!label) {
    label = `${lat.toFixed(4)}, ${lng.toFixed(4)}${state ? ` (${state})` : ''}`;
  }

  // Warm all caches in parallel
  await Promise.allSettled([
    warmWqp(), warmSdwis(), warmIcis(), warmEcho(), warmPfas(),
    warmNwisGw(), warmNwisIv(), warmFrs(), warmTri(), warmNdbc(),
    warmNars(), warmStateReport(), warmAttains(),
  ]);

  // Fan out all lookups in parallel
  const [
    wqpR, sdwisR, icisR, echoR, pfasR,
    nwisGwR, nwisIvR, frsR, triR, ndbcR, narsR,
    ejscreenR,
  ] = await Promise.allSettled([
    Promise.resolve(getWqpCache(lat, lng)),
    Promise.resolve(getSdwisCache(lat, lng)),
    Promise.resolve(getIcisCache(lat, lng)),
    Promise.resolve(getEchoCache(lat, lng)),
    Promise.resolve(getPfasCache(lat, lng)),
    Promise.resolve(getNwisGwCache(lat, lng)),
    Promise.resolve(getUsgsIvCache(lat, lng)),
    Promise.resolve(getFrsCache(lat, lng)),
    Promise.resolve(getTriCache(lat, lng)),
    Promise.resolve(getNdbcCache(lat, lng)),
    Promise.resolve(getNarsCache(lat, lng)),
    ejscreenFetch(lat, lng),
  ]);

  // Helper to extract fulfilled value or null
  const val = <T,>(r: PromiseSettledResult<T | null>): T | null =>
    r.status === 'fulfilled' ? r.value : null;

  // State-level lookups (not spatial)
  const stateReport = state ? getStateReport(state) : null;

  let attainsData: LocationReport['sources']['attains'] = null;
  if (state) {
    try {
      const ac = getAttainsCache();
      const ss = ac.states[state];
      if (ss) {
        attainsData = {
          impaired: ss.high + ss.medium,
          total: ss.total,
          topCauses: ss.topCauses || [],
        };
      }
    } catch { /* null */ }
  }

  // Shape the WQP result
  const wqpVal = val(wqpR);
  const wqp = wqpVal ? { records: wqpVal.data } : null;

  // Shape SDWIS
  const sdwisVal = val(sdwisR);
  const sdwis = sdwisVal ? {
    systems: sdwisVal.systems,
    violations: sdwisVal.violations,
    enforcement: sdwisVal.enforcement,
  } : null;

  // Shape ICIS
  const icisVal = val(icisR);
  const icis = icisVal ? {
    permits: icisVal.permits,
    violations: icisVal.violations,
  } : null;

  // Shape ECHO
  const echoVal = val(echoR);
  const echo = echoVal ? {
    facilities: echoVal.facilities,
    violations: echoVal.violations,
  } : null;

  // Shape PFAS
  const pfasVal = val(pfasR);
  const pfas = pfasVal ? { results: pfasVal.results } : null;

  // Shape NWIS-GW
  const nwisGwVal = val(nwisGwR);
  const nwisGw = nwisGwVal ? {
    sites: nwisGwVal.sites,
    levels: nwisGwVal.levels,
    trends: nwisGwVal.trends,
  } : null;

  // Shape NWIS-IV
  const nwisIvVal = val(nwisIvR);
  const nwisIv = nwisIvVal ? {
    sites: nwisIvVal.sites,
    readings: nwisIvVal.readings,
  } : null;

  // Shape FRS
  const frsVal = val(frsR);
  const frs = frsVal ? { facilities: frsVal.facilities } : null;

  // Shape TRI
  const triVal = val(triR);
  const tri = triVal ? { facilities: triVal } : null;

  // Shape NDBC
  const ndbcVal = val(ndbcR);
  const ndbc = ndbcVal ? { stations: ndbcVal.stations } : null;

  // Shape NARS
  const narsVal = val(narsR);
  const nars = narsVal ? { sites: narsVal.sites } : null;

  const report: LocationReport = {
    location: { lat, lng, state, label, ...(zip ? { zip } : {}) },
    sources: {
      wqp, sdwis, icis, echo, pfas,
      nwisGw, nwisIv, frs, tri, ndbc, nars,
      ejscreen: val(ejscreenR),
      stateReport,
      attains: attainsData,
    },
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(report);
}
