// =============================================================================
// lib/wqp/index.ts — PIN integration layer for WQP
// =============================================================================
//
// This is what the app calls. Not the raw WQP client.
//
// Two primary use cases:
//   1. User loads a waterbody → getWaterbodyObservations()
//   2. User loads a state     → getStateSummary()
//
// All responses are cached in-memory with TTL to avoid hammering WQP
// on repeated loads of the same waterbody/state.
//
// Drop-in usage in your Next.js API routes or server components:
//
//   import { getWaterbodyObservations, getStateSummary } from "@/lib/wqp";
//
//   // In a waterbody detail API route:
//   export async function GET(req) {
//     const { searchParams } = new URL(req.url);
//     const huc = searchParams.get("huc");
//     const data = await getWaterbodyObservations({ huc });
//     return Response.json(data);
//   }
//
// =============================================================================

import { fetchStations, fetchResults, fetchSummary, STATE_FIPS } from "./client";
import type { WQPStation, WQPResult, PINObservation, PINStateSummary } from "./types";

// Re-export everything consumers might need
export { fetchStations, fetchResults, fetchSummary, STATE_FIPS } from "./client";
export type * from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Cache — simple in-memory TTL cache
// ─────────────────────────────────────────────────────────────────────────────
// In production, swap this for Redis or Supabase cache table if needed.
// For now, in-memory works fine for a Vercel serverless function since
// the instance stays warm for ~5 minutes between invocations.

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const CACHE_TTL = {
  waterbody: 30 * 60 * 1000,  // 30 min — observation data doesn't change fast
  state: 60 * 60 * 1000,      // 1 hour — state summaries are stable
  stations: 24 * 60 * 60 * 1000, // 24 hours — stations barely change
};

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T, ttl: number): void {
  // Prevent unbounded cache growth — evict oldest if >500 entries
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

// ─────────────────────────────────────────────────────────────────────────────
// getWaterbodyObservations — called when user loads a waterbody
// ─────────────────────────────────────────────────────────────────────────────

interface WaterbodyQuery {
  /** HUC8 or HUC12 code for the waterbody's watershed */
  huc?: string;
  /** Specific WQP monitoring location ID */
  siteId?: string;
  /** How many years back to pull. Default: 5 */
  yearsBack?: number;
  /** Specific parameters to pull. Default: core WQ set */
  parameters?: string[];
}

/** Core WQ parameters that matter for impairment assessment */
const CORE_PARAMETERS = [
  "Dissolved oxygen (DO)",
  "pH",
  "Temperature, water",
  "Specific conductance",
  "Turbidity",
  "Total Nitrogen, mixed forms",
  "Phosphorus",
  "Escherichia coli",
  "Enterococcus",
  "Total suspended solids",
  "Chlorophyll a",
];

export interface WaterbodyData {
  stations: WQPStation[];
  observations: PINObservation[];
  stationCount: number;
  observationCount: number;
  parametersCovered: string[];
  dateRange: { earliest: string; latest: string } | null;
  fetchedAt: string;
  cached: boolean;
}

export async function getWaterbodyObservations(
  query: WaterbodyQuery
): Promise<WaterbodyData> {
  const { huc, siteId, yearsBack = 5, parameters = CORE_PARAMETERS } = query;

  if (!huc && !siteId) {
    throw new Error("getWaterbodyObservations requires either huc or siteId");
  }

  // Check cache
  const cacheKey = `wb:${huc || siteId}:${yearsBack}`;
  const cached = getCached<WaterbodyData>(cacheKey);
  if (cached) return { ...cached, cached: true };

  // Calculate date range
  const now = new Date();
  const startDate = new Date(now.getFullYear() - yearsBack, now.getMonth(), now.getDate());
  const startDateStr = `${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}-${startDate.getFullYear()}`;

  // Build WQP query
  const wqpParams = {
    ...(huc ? { huc } : {}),
    ...(siteId ? { siteid: siteId } : {}),
    startDateLo: startDateStr,
    characteristicName: parameters,
    sampleMedia: "Water",
  };

  // Parallel fetch: stations + results
  const [stations, rawResults] = await Promise.all([
    fetchStations(huc ? { huc } : { siteid: siteId }),
    fetchResults(wqpParams),
  ]);

  // Build station lookup for enriching results
  const stationMap = new Map<string, WQPStation>();
  for (const s of stations) {
    stationMap.set(s.MonitoringLocationIdentifier, s);
  }

  // Normalize results to PIN observations
  const observations: PINObservation[] = rawResults
    .filter((r) => r.ResultMeasureValue !== null && r.ResultMeasureValue !== "")
    .map((r) => {
      const station = stationMap.get(r.MonitoringLocationIdentifier);
      return {
        stationId: r.MonitoringLocationIdentifier,
        stationName: station?.MonitoringLocationName || "",
        lat: station?.LatitudeMeasure || 0,
        lon: station?.LongitudeMeasure || 0,
        date: r.ActivityStartDate,
        parameter: r.CharacteristicName,
        value: r.ResultMeasureValue ? parseFloat(r.ResultMeasureValue) : null,
        unit: r.ResultMeasure_MeasureUnitCode,
        organization: station?.OrganizationFormalName || "",
        state: station?.StateName || "",
        county: station?.CountyName || "",
      };
    })
    .filter((o) => o.value !== null && !isNaN(o.value as number));

  // Derive metadata
  const paramsCovered = [...new Set(observations.map((o) => o.parameter))];
  const dates = observations.map((o) => o.date).filter(Boolean).sort();

  const result: WaterbodyData = {
    stations,
    observations,
    stationCount: stations.length,
    observationCount: observations.length,
    parametersCovered: paramsCovered,
    dateRange: dates.length
      ? { earliest: dates[0], latest: dates[dates.length - 1] }
      : null,
    fetchedAt: new Date().toISOString(),
    cached: false,
  };

  setCache(cacheKey, result, CACHE_TTL.waterbody);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// getStateSummary — called when user loads a state card
// ─────────────────────────────────────────────────────────────────────────────

export async function getStateSummary(stateAbbr: string): Promise<PINStateSummary> {
  const cacheKey = `state:${stateAbbr}`;
  const cached = getCached<PINStateSummary>(cacheKey);
  if (cached) return cached;

  const statecode = STATE_FIPS[stateAbbr.toUpperCase()];
  if (!statecode) throw new Error(`Unknown state: ${stateAbbr}`);

  // Summary endpoint is fast — returns counts per station, no raw data
  const summaries = await fetchSummary({ statecode });

  // Aggregate
  const orgs = new Set<string>();
  let totalResults = 0;
  let earliest = "9999-99-99";
  let latest = "0000-00-00";

  for (const s of summaries) {
    orgs.add(s.OrganizationIdentifier);
    totalResults += s.resultCount;
  }

  const result: PINStateSummary = {
    stateCode: stateAbbr.toUpperCase(),
    stateName: summaries[0]?.StateName || stateAbbr,
    stationCount: summaries.length,
    resultCount: totalResults,
    organizations: [...orgs],
    parameterGroups: {}, // WQP summary doesn't break down by param — enhance later
    dateRange: { earliest, latest }, // enhance with actual date query later
    fetchedAt: new Date().toISOString(),
  };

  setCache(cacheKey, result, CACHE_TTL.state);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// getStationsForMap — lightweight call for map markers
// ─────────────────────────────────────────────────────────────────────────────

export interface MapStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: string;
  org: string;
  resultCount: number;
}

/**
 * Get stations for map display in a state or HUC.
 * Uses the summary endpoint so you get locations + result counts
 * without downloading actual observations.
 */
export async function getStationsForMap(params: {
  stateAbbr?: string;
  huc?: string;
  countyFips?: string;
}): Promise<MapStation[]> {
  const { stateAbbr, huc, countyFips } = params;

  const cacheKey = `map:${stateAbbr || huc || countyFips}`;
  const cached = getCached<MapStation[]>(cacheKey);
  if (cached) return cached;

  const query: Record<string, string> = {};
  if (stateAbbr) query.statecode = STATE_FIPS[stateAbbr.toUpperCase()];
  if (huc) query.huc = huc;
  if (countyFips) query.countycode = countyFips;

  const summaries = await fetchSummary(query);

  const stations: MapStation[] = summaries.map((s) => ({
    id: s.MonitoringLocationIdentifier,
    name: s.MonitoringLocationName,
    lat: s.LatitudeMeasure,
    lon: s.LongitudeMeasure,
    type: s.MonitoringLocationTypeName,
    org: s.OrganizationIdentifier,
    resultCount: s.resultCount,
  }));

  setCache(cacheKey, stations, CACHE_TTL.stations);
  return stations;
}
