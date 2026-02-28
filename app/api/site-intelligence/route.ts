/**
 * Site Intelligence API — Comprehensive environmental, regulatory, and
 * water quality dossier for any US address / lat+lng / ZIP.
 *
 * Parallel fan-out to:
 *   Tier 1: PIN spatial caches (WQP, SDWIS, ICIS, ECHO, PFAS, TRI, ATTAINS, HUC-8)
 *   Tier 2: Existing external APIs (EJScreen, Water Risk Score)
 *   Tier 3: New external APIs (Census, FEMA NFHL, USFWS CRITHAB, EPA SEMS, EPA Brownfields)
 *
 * GET /api/site-intelligence?lat=39.27&lng=-76.61
 * GET /api/site-intelligence?zip=21201
 * GET /api/site-intelligence?address=Baltimore+MD
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  SiteIntelligenceReport,
  CensusGeo,
  FloodZone,
  CriticalHabitatResult,
  SuperfundSite,
  BrownfieldSite,
  EJScreenData,
} from '@/lib/siteIntelTypes';

// ── Cache imports ────────────────────────────────────────────────────────────
import { ensureWarmed as warmWqp, getWqpCache } from '@/lib/wqpCache';
import { ensureWarmed as warmSdwis, getSdwisCache } from '@/lib/sdwisCache';
import { ensureWarmed as warmIcis, getIcisCache } from '@/lib/icisCache';
import { ensureWarmed as warmEcho, getEchoCache } from '@/lib/echoCache';
import { ensureWarmed as warmPfas, getPfasCache } from '@/lib/pfasCache';
import { ensureWarmed as warmTri, getTriCache } from '@/lib/triCache';
import { ensureWarmed as warmAttains, getAttainsCache } from '@/lib/attainsCache';
import { ensureWarmed as warmIndices, getIndicesForHuc } from '@/lib/indices/indicesCache';

// ── Scoring ──────────────────────────────────────────────────────────────────
import { computeWaterRiskScore, type RiskScoreInput } from '@/lib/waterRiskScore';
import { calculateGrade } from '@/lib/waterQualityScore';
import { findNearestHuc8 } from '@/lib/hucLookup';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const EJSCREEN_BASE = 'https://ejscreen.epa.gov/mapper/ejscreenRESTbroker1.aspx';

// ── Shared helpers (same patterns as water-risk-score + location-report) ────

let _zipData: Record<string, [number, number]> | null = null;
function getZipCentroids(): Record<string, [number, number]> {
  if (!_zipData) {
    _zipData = require('@/lib/zipCentroids.json') as Record<string, [number, number]>;
  }
  return _zipData;
}

async function forwardGeocode(address: string): Promise<{ lat: number; lng: number; label: string } | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&country=us&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature?.center) return null;
    return { lng: feature.center[0], lat: feature.center[1], label: feature.place_name || address };
  } catch { return null; }
}

async function reverseGeocodeState(lat: number, lng: number): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=region&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const code = data?.features?.[0]?.properties?.short_code as string | undefined;
    if (code?.startsWith('US-')) return code.slice(3);
    return null;
  } catch { return null; }
}

async function ejscreenFetch(lat: number, lng: number): Promise<EJScreenData | null> {
  const urls = [
    `${EJSCREEN_BASE}?namestr=&geometry=${lng},${lat}&distance=1&unit=9035&aession=&f=json`,
    `https://pedp-ejscreen.azurewebsites.net/mapper/ejscreenRESTbroker1.aspx?namestr=&geometry=${lng},${lat}&distance=1&unit=9035&f=json`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 604800 } });
      if (res.ok) {
        const data = await res.json();
        if (data && !data.error) return data as EJScreenData;
      }
    } catch { /* try next */ }
  }
  return null;
}

// ── Haversine distance in miles ─────────────────────────────────────────────

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Tier 3: New external API fetchers ───────────────────────────────────────

async function fetchCensusGeo(lat: number, lng: number): Promise<CensusGeo | null> {
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const geo = data?.result?.geographies;
    const tract = geo?.['Census Tracts']?.[0];
    const county = geo?.['Counties']?.[0];
    const cd = geo?.['118th Congressional Districts']?.[0] ?? geo?.['119th Congressional Districts']?.[0];
    if (!tract && !county) return null;
    return {
      fips: (tract?.STATE || '') + (tract?.COUNTY || '') + (tract?.TRACT || ''),
      county: county?.NAME || tract?.COUNTY || '',
      tract: tract?.TRACT || '',
      congressionalDistrict: cd?.NAME || cd?.BASENAME || '',
      stateFips: tract?.STATE || '',
    };
  } catch { return null; }
}

async function fetchFloodZone(lat: number, lng: number): Promise<FloodZone | null> {
  try {
    const url = `https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelContains&outFields=FLD_ZONE,ZONE_SUBTY,SFHA_TF&f=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0]?.attributes;
    if (!feature) return null;
    return {
      zone: feature.FLD_ZONE || '',
      sfha: feature.SFHA_TF === 'T',
      zoneSubtype: feature.ZONE_SUBTY || '',
    };
  } catch { return null; }
}

async function fetchCriticalHabitat(lat: number, lng: number): Promise<CriticalHabitatResult[]> {
  try {
    const url = `https://services.arcgis.com/QVENGdaPbd4LUkLV/ArcGIS/rest/services/USFWS_Critical_Habitat/FeatureServer/2/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&distance=3&units=esriSRUnit_StatuteMile&outFields=*&f=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.features?.length) return [];
    return data.features.map((f: Record<string, unknown>) => {
      const a = f.attributes as Record<string, unknown>;
      return {
        species: (a.comname as string) || (a.COMNAME as string) || '',
        scientificName: (a.sciname as string) || (a.SCINAME as string) || '',
        status: (a.status as string) || (a.STATUS as string) || '',
        listingDate: (a.listing_date as string) || (a.LISTING_DATE as string) || '',
        distanceMi: 0, // within query radius
      };
    });
  } catch { return []; }
}

async function fetchSuperfund(lat: number, lng: number): Promise<SuperfundSite[]> {
  try {
    const latLo = lat - 0.1;
    const latHi = lat + 0.1;
    const lngLo = lng - 0.1;
    const lngHi = lng + 0.1;
    const url = `https://data.epa.gov/efservice/SEMS_ACTIVE_SITES/LATITUDE/BEGINNING/${latLo}/ENDING/${latHi}/LONGITUDE/BEGINNING/${lngLo}/ENDING/${lngHi}/JSON`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data: Record<string, unknown>[] = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((d) => {
        const siteLat = parseFloat(String(d.LATITUDE || 0));
        const siteLng = parseFloat(String(d.LONGITUDE || 0));
        const dist = haversineMi(lat, lng, siteLat, siteLng);
        return {
          name: String(d.SITE_NAME || d.PRIMARY_NAME || ''),
          distanceMi: Math.round(dist * 10) / 10,
          nplStatus: String(d.NPL_STATUS || d.SITE_STATUS || ''),
          epaId: String(d.EPA_ID || d.SITE_EPA_ID || ''),
          city: String(d.CITY || ''),
          state: String(d.STATE || ''),
        };
      })
      .filter((s) => s.distanceMi <= 5)
      .sort((a, b) => a.distanceMi - b.distanceMi);
  } catch { return []; }
}

async function fetchBrownfields(lat: number, lng: number): Promise<BrownfieldSite[]> {
  try {
    const latLo = lat - 0.1;
    const latHi = lat + 0.1;
    const lngLo = lng - 0.1;
    const lngHi = lng + 0.1;
    const url = `https://data.epa.gov/efservice/CLEANUPS/LATITUDE/BEGINNING/${latLo}/ENDING/${latHi}/LONGITUDE/BEGINNING/${lngLo}/ENDING/${lngHi}/JSON`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data: Record<string, unknown>[] = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((d) => {
        const siteLat = parseFloat(String(d.LATITUDE || 0));
        const siteLng = parseFloat(String(d.LONGITUDE || 0));
        const dist = haversineMi(lat, lng, siteLat, siteLng);
        return {
          name: String(d.SITE_NAME || d.NAME || ''),
          distanceMi: Math.round(dist * 10) / 10,
          status: String(d.STATUS || d.CLEANUP_STATUS || ''),
          city: String(d.CITY || ''),
          state: String(d.STATE || ''),
        };
      })
      .filter((s) => s.distanceMi <= 5)
      .sort((a, b) => a.distanceMi - b.distanceMi);
  } catch { return []; }
}

// ── GET handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  let lat: number | null = sp.has('lat') ? parseFloat(sp.get('lat')!) : null;
  let lng: number | null = sp.has('lng') ? parseFloat(sp.get('lng')!) : null;
  let state = sp.get('state')?.toUpperCase() || '';
  const zip = sp.get('zip') || '';
  const address = sp.get('address') || '';
  let label = '';

  // Resolve ZIP
  if (zip && (lat === null || lng === null)) {
    const centroids = getZipCentroids();
    const coords = centroids[zip];
    if (!coords) return NextResponse.json({ error: `Unknown ZIP code: ${zip}` }, { status: 400 });
    [lat, lng] = coords;
    label = `ZIP ${zip}`;
  }

  // Resolve address
  if (address && (lat === null || lng === null)) {
    const geo = await forwardGeocode(address);
    if (!geo) return NextResponse.json({ error: `Could not geocode address: ${address}` }, { status: 400 });
    lat = geo.lat;
    lng = geo.lng;
    label = geo.label;
  }

  if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'Provide lat+lng, zip, or address query parameter' }, { status: 400 });
  }

  // Resolve state
  if (!state) {
    state = (await reverseGeocodeState(lat, lng)) || '';
  }
  if (!label) {
    label = `${lat.toFixed(4)}, ${lng.toFixed(4)}${state ? ` (${state})` : ''}`;
  }

  // ── Warm caches ──
  await Promise.allSettled([
    warmWqp(), warmSdwis(), warmIcis(), warmEcho(),
    warmPfas(), warmTri(), warmAttains(), warmIndices(),
  ]);

  // ── Parallel fan-out: all 3 tiers ──
  const [
    // Tier 1: caches
    wqpR, sdwisR, icisR, echoR, pfasR, triR,
    // Tier 2: existing external
    ejscreenR,
    // Tier 3: new external
    censusR, floodR, crithabR, superfundR, brownfieldR,
  ] = await Promise.allSettled([
    Promise.resolve(getWqpCache(lat, lng)),
    Promise.resolve(getSdwisCache(lat, lng)),
    Promise.resolve(getIcisCache(lat, lng)),
    Promise.resolve(getEchoCache(lat, lng)),
    Promise.resolve(getPfasCache(lat, lng)),
    Promise.resolve(getTriCache(lat, lng)),
    ejscreenFetch(lat, lng),
    fetchCensusGeo(lat, lng),
    fetchFloodZone(lat, lng),
    fetchCriticalHabitat(lat, lng),
    fetchSuperfund(lat, lng),
    fetchBrownfields(lat, lng),
  ]);

  const val = <T,>(r: PromiseSettledResult<T | null>): T | null =>
    r.status === 'fulfilled' ? r.value : null;
  const valArr = <T,>(r: PromiseSettledResult<T[]>): T[] =>
    r.status === 'fulfilled' ? r.value : [];

  // ── HUC-8 lookup ──
  const hucMatch = findNearestHuc8(lat, lng);
  const hucIndices = hucMatch ? getIndicesForHuc(hucMatch.huc8) : null;

  // ── ATTAINS ──
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

  // ── Water Risk Score ──
  const wqpVal = val(wqpR);
  const wqpRecords = wqpVal?.data || [];
  let wqpGrade = null;
  if (wqpRecords.length > 0) {
    const paramMap: Record<string, { value: number; lastSampled?: string | null }> = {};
    for (const rec of wqpRecords) {
      if (rec.key && typeof rec.val === 'number') {
        paramMap[rec.key] = { value: rec.val, lastSampled: rec.date || null };
      }
    }
    if (Object.keys(paramMap).length > 0) {
      wqpGrade = calculateGrade(paramMap);
    }
  }

  const sdwisVal = val(sdwisR);
  const icisVal = val(icisR);
  const echoVal = val(echoR);
  const pfasVal = val(pfasR);
  const triVal = val(triR);

  const scoreInput: RiskScoreInput = {
    wqpGrade,
    hucIndices,
    sdwis: sdwisVal ? { systems: sdwisVal.systems, violations: sdwisVal.violations, enforcement: sdwisVal.enforcement } : null,
    icis: icisVal ? { permits: icisVal.permits, violations: icisVal.violations, enforcement: icisVal.enforcement } : null,
    echo: echoVal ? { facilities: echoVal.facilities, violations: echoVal.violations } : null,
    pfas: pfasVal ? { results: pfasVal.results } : null,
    tri: triVal,
    attains: attainsData,
    ejscreen: val(ejscreenR) as Record<string, unknown> | null,
  };

  let waterScore = null;
  try {
    waterScore = computeWaterRiskScore(scoreInput);
  } catch { /* null */ }

  // ── Assemble report ──
  const report: SiteIntelligenceReport = {
    location: {
      lat, lng, state, label,
      ...(zip ? { zip } : {}),
      ...(hucMatch ? { huc8: hucMatch.huc8, hucDistance: hucMatch.distance } : {}),
    },
    census: val(censusR),
    floodZone: val(floodR),
    environmentalProfile: {
      wqpRecords,
      attains: attainsData,
      ejscreen: val(ejscreenR),
    },
    speciesHabitat: {
      criticalHabitat: valArr(crithabR),
    },
    contamination: {
      superfund: valArr(superfundR),
      brownfields: valArr(brownfieldR),
      echoFacilities: echoVal?.facilities || [],
      echoViolations: echoVal?.violations || [],
      triReleases: triVal || [],
      pfasDetections: pfasVal?.results?.length || 0,
    },
    regulatory: {
      sdwisSystems: sdwisVal?.systems || [],
      sdwisViolations: sdwisVal?.violations || [],
      icisPermits: icisVal?.permits || [],
      icisViolations: icisVal?.violations || [],
    },
    waterScore,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(report);
}
