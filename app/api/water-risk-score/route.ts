/**
 * Water Risk Score API — Resolves a location to coordinates and computes
 * a composite water risk score using all spatial caches + HUC-8 indices.
 *
 * GET /api/water-risk-score?lat=39.27&lng=-76.61
 * GET /api/water-risk-score?zip=21201
 * GET /api/water-risk-score?address=Baltimore+MD
 */

import { NextRequest, NextResponse } from 'next/server';

// Cache imports
import { ensureWarmed as warmWqp, getWqpCache } from '@/lib/wqpCache';
import { ensureWarmed as warmSdwis, getSdwisCache } from '@/lib/sdwisCache';
import { ensureWarmed as warmIcis, getIcisCache } from '@/lib/icisCache';
import { ensureWarmed as warmEcho, getEchoCache } from '@/lib/echoCache';
import { ensureWarmed as warmPfas, getPfasCache } from '@/lib/pfasCache';
import { ensureWarmed as warmTri, getTriCache } from '@/lib/triCache';
import { ensureWarmed as warmAttains, getAttainsCache } from '@/lib/attainsCache';
import { ensureWarmed as warmIndices, getIndicesForHuc } from '@/lib/indices/indicesCache';

// Scoring
import { computeWaterRiskScore, type RiskScoreInput } from '@/lib/waterRiskScore';
import { calculateGrade } from '@/lib/waterQualityScore';
import { findNearestHuc8 } from '@/lib/hucLookup';

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

// ── EJScreen fetch ───────────────────────────────────────────────────────────

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

// ── Mapbox reverse geocode for state ─────────────────────────────────────────

async function reverseGeocodeState(lat: number, lng: number): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=region&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0];
    const code = feature?.properties?.short_code as string | undefined;
    if (code?.startsWith('US-')) return code.slice(3);
    return null;
  } catch {
    return null;
  }
}

// ── Mapbox forward geocode for address ───────────────────────────────────────

async function forwardGeocode(address: string): Promise<{ lat: number; lng: number; label: string } | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&country=us&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature?.center) return null;
    return {
      lng: feature.center[0],
      lat: feature.center[1],
      label: feature.place_name || address,
    };
  } catch {
    return null;
  }
}

// ── GET handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  let lat: number | null = sp.has('lat') ? parseFloat(sp.get('lat')!) : null;
  let lng: number | null = sp.has('lng') ? parseFloat(sp.get('lng')!) : null;
  let state = sp.get('state')?.toUpperCase() || '';
  const zip = sp.get('zip') || '';
  const address = sp.get('address') || '';
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

  // Resolve address to coordinates
  if (address && (lat === null || lng === null)) {
    const geo = await forwardGeocode(address);
    if (!geo) {
      return NextResponse.json({ error: `Could not geocode address: ${address}` }, { status: 400 });
    }
    lat = geo.lat;
    lng = geo.lng;
    label = geo.label;
  }

  if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: 'Provide lat+lng, zip, or address query parameter' },
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
    warmWqp(), warmSdwis(), warmIcis(), warmEcho(),
    warmPfas(), warmTri(), warmAttains(), warmIndices(),
  ]);

  // Fan out all lookups in parallel
  const [wqpR, sdwisR, icisR, echoR, pfasR, triR, ejscreenR] = await Promise.allSettled([
    Promise.resolve(getWqpCache(lat, lng)),
    Promise.resolve(getSdwisCache(lat, lng)),
    Promise.resolve(getIcisCache(lat, lng)),
    Promise.resolve(getEchoCache(lat, lng)),
    Promise.resolve(getPfasCache(lat, lng)),
    Promise.resolve(getTriCache(lat, lng)),
    ejscreenFetch(lat, lng),
  ]);

  const val = <T,>(r: PromiseSettledResult<T | null>): T | null =>
    r.status === 'fulfilled' ? r.value : null;

  // HUC-8 lookup for indices
  const hucMatch = findNearestHuc8(lat, lng);
  const hucIndices = hucMatch ? getIndicesForHuc(hucMatch.huc8) : null;

  // ATTAINS state-level data
  let attainsData: { impaired: number; total: number; topCauses: string[] } | null = null;
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

  // Compute water quality grade from WQP data
  const wqpVal = val(wqpR);
  const wqpRecords = wqpVal?.data;
  let wqpGrade = null;
  if (wqpRecords && wqpRecords.length > 0) {
    // Build parameter map from WqpRecord fields: key, val, date
    const paramMap: Record<string, { value: number; lastSampled?: string | null }> = {};
    for (const rec of wqpRecords) {
      if (rec.key && typeof rec.val === 'number') {
        paramMap[rec.key] = {
          value: rec.val,
          lastSampled: rec.date || null,
        };
      }
    }
    if (Object.keys(paramMap).length > 0) {
      wqpGrade = calculateGrade(paramMap);
    }
  }

  // Shape data for scoring
  const sdwisVal = val(sdwisR);
  const icisVal = val(icisR);
  const echoVal = val(echoR);
  const pfasVal = val(pfasR);
  const triVal = val(triR);

  const scoreInput: RiskScoreInput = {
    wqpGrade,
    hucIndices,
    sdwis: sdwisVal ? {
      systems: sdwisVal.systems,
      violations: sdwisVal.violations,
      enforcement: sdwisVal.enforcement,
    } : null,
    icis: icisVal ? {
      permits: icisVal.permits,
      violations: icisVal.violations,
      enforcement: icisVal.enforcement,
    } : null,
    echo: echoVal ? {
      facilities: echoVal.facilities,
      violations: echoVal.violations,
    } : null,
    pfas: pfasVal ? { results: pfasVal.results } : null,
    tri: triVal,
    attains: attainsData,
    ejscreen: val(ejscreenR),
  };

  const result = computeWaterRiskScore(scoreInput);

  return NextResponse.json({
    location: {
      lat,
      lng,
      state,
      label,
      ...(zip ? { zip } : {}),
      ...(hucMatch ? { huc8: hucMatch.huc8, hucDistance: hucMatch.distance } : {}),
    },
    ...result,
    generatedAt: new Date().toISOString(),
  });
}
