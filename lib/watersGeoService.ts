/**
 * EPA WATERS GeoServices — On-demand utility for watershed delineation
 * and upstream/downstream NHD flow navigation.
 *
 * NOT a cache module. This is a service module called by the Sentinel
 * scoring engine and restoration planner for flow-path analysis.
 *
 * API: https://waters.epa.gov/waters10/ (no key needed)
 *   - PointIndexing.Service — Snap lat/lng to nearest NHD reach
 *   - Navigation.Service — Trace upstream/downstream from a reach
 *   - Delineation.Service — Delineate watershed boundary for a point
 *
 * Includes 1-hour LRU cache for repeat lookups.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReachSnap {
  reachCode: string;
  measure: number;          // Percentage along the reach (0-100)
  distanceKm: number;       // Distance from input point to snapped reach
  reachName: string | null;
  huc8: string | null;
}

export interface NavigationResult {
  reachCodes: string[];
  huc8s: string[];
  totalDistanceKm: number;
  navigationType: 'upstream' | 'downstream';
}

// ── Config ────────────────────────────────────────────────────────────────────

const WATERS_BASE = 'https://waters.epa.gov/waters10';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_NAVIGATION_DISTANCE_KM = 100;

// ── LRU Cache ────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_ENTRIES = 500;

const _lruCache = new Map<string, CacheEntry<any>>();

function cacheGet<T>(key: string): T | null {
  const entry = _lruCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _lruCache.delete(key);
    return null;
  }
  // Move to end (most recently used)
  _lruCache.delete(key);
  _lruCache.set(key, entry);
  return entry.value as T;
}

function cacheSet<T>(key: string, value: T): void {
  // Evict oldest entries if at capacity
  while (_lruCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = _lruCache.keys().next().value;
    if (firstKey !== undefined) _lruCache.delete(firstKey);
    else break;
  }
  _lruCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Internal fetch helper ───────────────────────────────────────────────────

async function watersFetch(endpoint: string, params: Record<string, string>): Promise<any> {
  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const url = `${WATERS_BASE}/${endpoint}?${queryString}&f=json`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'PEARL-Platform/1.0', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`WATERS API ${endpoint}: HTTP ${res.status}`);
  }

  return res.json();
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Snap a lat/lng to the nearest NHD reach.
 * Returns reach code, measure along reach, and distance from input point.
 */
export async function snapToReach(lat: number, lng: number): Promise<ReachSnap | null> {
  const cacheKey = `snap:${lat.toFixed(5)}_${lng.toFixed(5)}`;
  const cached = cacheGet<ReachSnap>(cacheKey);
  if (cached) return cached;

  try {
    const data = await watersFetch('PointIndexing.Service', {
      pGeometry: `POINT(${lng} ${lat})`,
      pGeometryMod: 'WKT,SRSNAME=urn:ogc:def:crs:OGC::CRS84',
      pPointIndexingMethod: 'DISTANCE',
      pPointIndexingMaxDist: '5', // km
    });

    const result = data?.output?.ary_nhdfeatures?.[0];
    if (!result) return null;

    const snap: ReachSnap = {
      reachCode: result.permanent_identifier || result.reachcode || '',
      measure: parseFloat(result.fmeasure || '0'),
      distanceKm: parseFloat(result.snap_distance || '0') / 1000, // meters to km
      reachName: result.gnis_name || null,
      huc8: result.reachcode?.substring(0, 8) || null,
    };

    cacheSet(cacheKey, snap);
    return snap;
  } catch (err: any) {
    console.warn(`[WATERS] snapToReach(${lat}, ${lng}) failed: ${err.message}`);
    return null;
  }
}

/**
 * Trace upstream from a reach code.
 * Returns array of upstream reach codes and the HUC-8s they belong to.
 */
export async function traceUpstream(
  reachCode: string,
  maxDistanceKm: number = MAX_NAVIGATION_DISTANCE_KM
): Promise<NavigationResult | null> {
  const cacheKey = `up:${reachCode}:${maxDistanceKm}`;
  const cached = cacheGet<NavigationResult>(cacheKey);
  if (cached) return cached;

  try {
    const data = await watersFetch('Navigation.Service', {
      pNavigationType: 'UT', // Upstream with tributaries
      pStartComID: reachCode,
      pMaxDistanceKm: String(maxDistanceKm),
      pReturnFlowlineGeom: 'FALSE',
    });

    const flowlines = data?.output?.flowlines || [];
    const reachCodes: string[] = [];
    const huc8Set = new Set<string>();
    let totalDistance = 0;

    for (const fl of flowlines) {
      const code = fl.permanent_identifier || fl.comid || '';
      if (code) reachCodes.push(code);
      const huc = fl.reachcode?.substring(0, 8);
      if (huc) huc8Set.add(huc);
      totalDistance += parseFloat(fl.lengthkm || '0');
    }

    const result: NavigationResult = {
      reachCodes,
      huc8s: Array.from(huc8Set),
      totalDistanceKm: Math.round(totalDistance * 10) / 10,
      navigationType: 'upstream',
    };

    cacheSet(cacheKey, result);
    return result;
  } catch (err: any) {
    console.warn(`[WATERS] traceUpstream(${reachCode}) failed: ${err.message}`);
    return null;
  }
}

/**
 * Trace downstream from a reach code.
 * Returns array of downstream reach codes and the HUC-8s they belong to.
 */
export async function traceDownstream(
  reachCode: string,
  maxDistanceKm: number = MAX_NAVIGATION_DISTANCE_KM
): Promise<NavigationResult | null> {
  const cacheKey = `down:${reachCode}:${maxDistanceKm}`;
  const cached = cacheGet<NavigationResult>(cacheKey);
  if (cached) return cached;

  try {
    const data = await watersFetch('Navigation.Service', {
      pNavigationType: 'DD', // Downstream with divergences
      pStartComID: reachCode,
      pMaxDistanceKm: String(maxDistanceKm),
      pReturnFlowlineGeom: 'FALSE',
    });

    const flowlines = data?.output?.flowlines || [];
    const reachCodes: string[] = [];
    const huc8Set = new Set<string>();
    let totalDistance = 0;

    for (const fl of flowlines) {
      const code = fl.permanent_identifier || fl.comid || '';
      if (code) reachCodes.push(code);
      const huc = fl.reachcode?.substring(0, 8);
      if (huc) huc8Set.add(huc);
      totalDistance += parseFloat(fl.lengthkm || '0');
    }

    const result: NavigationResult = {
      reachCodes,
      huc8s: Array.from(huc8Set),
      totalDistanceKm: Math.round(totalDistance * 10) / 10,
      navigationType: 'downstream',
    };

    cacheSet(cacheKey, result);
    return result;
  } catch (err: any) {
    console.warn(`[WATERS] traceDownstream(${reachCode}) failed: ${err.message}`);
    return null;
  }
}

/**
 * Convenience: snap a point and then trace downstream.
 * Returns the downstream HUC-8s from a given location.
 */
export async function getDownstreamHucs(
  lat: number,
  lng: number,
  maxDistanceKm: number = MAX_NAVIGATION_DISTANCE_KM
): Promise<string[] | null> {
  const snap = await snapToReach(lat, lng);
  if (!snap) return null;

  const downstream = await traceDownstream(snap.reachCode, maxDistanceKm);
  return downstream?.huc8s ?? null;
}

/**
 * Convenience: snap a point and then trace upstream.
 * Returns the upstream HUC-8s from a given location.
 */
export async function getUpstreamHucs(
  lat: number,
  lng: number,
  maxDistanceKm: number = MAX_NAVIGATION_DISTANCE_KM
): Promise<string[] | null> {
  const snap = await snapToReach(lat, lng);
  if (!snap) return null;

  const upstream = await traceUpstream(snap.reachCode, maxDistanceKm);
  return upstream?.huc8s ?? null;
}
