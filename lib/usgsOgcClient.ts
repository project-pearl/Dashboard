/**
 * USGS OGC API Client — Shared utility for fetching data from the modern
 * USGS Water Data OGC API (api.waterdata.usgs.gov/ogcapi/v0/).
 *
 * Replaces legacy waterservices.usgs.gov endpoints for:
 * - IV (instantaneous values) → collections/latest-continuous
 * - DV (daily values) → collections/daily
 * - GW levels → collections/field-measurements
 * - Monitoring locations → collections/monitoring-locations
 *
 * Handles pagination, rate limiting, per-parameter iteration, and
 * GeoJSON feature parsing into normalized internal types.
 */

// ── Config ──────────────────────────────────────────────────────────────────

const OGC_BASE = 'https://api.waterdata.usgs.gov/ogcapi/v0';
const DEFAULT_LIMIT = 10000;
const MAX_PAGES = 50;
const RATE_LIMIT_DELAY_MS = 2000;
const RATE_LIMIT_MAX_RETRIES = 3;

// ── Types ───────────────────────────────────────────────────────────────────

export interface OgcFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: [number, number] | [number, number, number];
  } | null;
  properties: Record<string, any>;
}

export interface OgcFeatureCollection {
  type: 'FeatureCollection';
  features: OgcFeature[];
  links?: Array<{ rel: string; href: string; type?: string }>;
  numberMatched?: number;
  numberReturned?: number;
}

export interface ParsedOgcObservation {
  siteNumber: string;
  parameterCode: string;
  value: number | null;
  dateTime: string;
  unit: string;
  qualifier: string;
  lat: number;
  lng: number;
  statisticId?: string;
}

export interface ParsedOgcSite {
  siteNumber: string;
  siteName: string;
  siteType: string;
  state: string;
  huc: string;
  lat: number;
  lng: number;
}

export type OgcCollection =
  | 'latest-continuous'
  | 'continuous'
  | 'daily'
  | 'field-measurements'
  | 'monitoring-locations';

// ── Feature Flag ────────────────────────────────────────────────────────────

export function useOgcApi(): boolean {
  return process.env.USGS_USE_OGC_API === 'true';
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function getApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/geo+json',
    'User-Agent': 'PEARL-Platform/1.0',
  };
  if (process.env.USGS_WATERDATA_API_KEY) {
    headers['X-Api-Key'] = process.env.USGS_WATERDATA_API_KEY;
  }
  return headers;
}

// ── Core Fetcher ────────────────────────────────────────────────────────────

/**
 * Fetch items from an OGC collection with automatic pagination.
 * Follows `next` links until exhausted or maxPages reached.
 */
export async function fetchOgcCollection(
  collection: OgcCollection,
  params: Record<string, string>,
  options?: {
    maxPages?: number;
    timeoutMs?: number;
  },
): Promise<OgcFeatureCollection> {
  const maxPages = options?.maxPages ?? MAX_PAGES;
  const timeoutMs = options?.timeoutMs ?? 45_000;
  const allFeatures: OgcFeature[] = [];

  const searchParams = new URLSearchParams(params);
  if (!searchParams.has('limit')) {
    searchParams.set('limit', String(DEFAULT_LIMIT));
  }
  searchParams.set('f', 'json');

  let url: string | null =
    `${OGC_BASE}/collections/${collection}/items?${searchParams}`;

  let page = 0;

  while (url && page < maxPages) {
    let retries = 0;

    while (retries <= RATE_LIMIT_MAX_RETRIES) {
      const resp = await fetch(url, {
        headers: getApiHeaders(),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (resp.status === 429) {
        retries++;
        if (retries > RATE_LIMIT_MAX_RETRIES) {
          console.warn(`[USGS OGC] Rate limited on ${collection}, giving up after ${RATE_LIMIT_MAX_RETRIES} retries`);
          return { type: 'FeatureCollection', features: allFeatures };
        }
        const retryAfter = parseInt(resp.headers.get('Retry-After') || '', 10);
        const waitMs = (!isNaN(retryAfter) && retryAfter > 0)
          ? retryAfter * 1000
          : RATE_LIMIT_DELAY_MS * retries;
        console.warn(`[USGS OGC] Rate limited, waiting ${waitMs}ms (retry ${retries}/${RATE_LIMIT_MAX_RETRIES})`);
        await delay(waitMs);
        continue;
      }

      if (!resp.ok) {
        throw new Error(`USGS OGC ${collection}: ${resp.status} ${resp.statusText}`);
      }

      const data: OgcFeatureCollection = await resp.json();

      if (Array.isArray(data.features)) {
        allFeatures.push(...data.features);
      }

      // Follow pagination via `next` link
      const nextLink = data.links?.find(l => l.rel === 'next');
      url = nextLink?.href ?? null;
      page++;
      break;
    }
  }

  return { type: 'FeatureCollection', features: allFeatures };
}

/**
 * Fetch data for multiple parameter codes (OGC API only supports one per query).
 * Fetches in parallel and merges results.
 */
export async function fetchOgcMultiParam(
  collection: OgcCollection,
  baseParams: Record<string, string>,
  parameterCodes: string[],
  options?: {
    maxPages?: number;
    timeoutMs?: number;
  },
): Promise<OgcFeatureCollection> {
  const results = await Promise.allSettled(
    parameterCodes.map(code =>
      fetchOgcCollection(collection, {
        ...baseParams,
        parameter_code: code,
      }, options),
    ),
  );

  const allFeatures: OgcFeature[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      allFeatures.push(...result.value.features);
    } else {
      console.warn(
        `[USGS OGC] Failed to fetch ${collection} for param ${parameterCodes[i]}: ${result.reason?.message}`,
      );
    }
  }

  return { type: 'FeatureCollection', features: allFeatures };
}

// ── Parsers ─────────────────────────────────────────────────────────────────

/**
 * Parse an OGC feature (observation) into a normalized record.
 * Works for latest-continuous, continuous, daily, and field-measurements.
 */
export function parseOgcObservation(feature: OgcFeature): ParsedOgcObservation | null {
  const props = feature.properties;
  if (!props) return null;

  const monitoringLocationId = props.monitoring_location_id || '';
  const siteNumber = monitoringLocationId.replace(/^USGS-/, '');
  if (!siteNumber) return null;

  const coords = feature.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;

  const lng = coords[0];
  const lat = coords[1];
  if (isNaN(lat) || isNaN(lng) || lat === 0) return null;

  const rawValue = props.value;
  const value = rawValue === null || rawValue === undefined || rawValue === ''
    ? null
    : typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);

  const qualifier = Array.isArray(props.qualifier)
    ? props.qualifier.join(',')
    : (props.qualifier || props.approval_status || '');

  return {
    siteNumber,
    parameterCode: props.parameter_code || '',
    value: value !== null && !isNaN(value) ? Math.round(value * 1000) / 1000 : null,
    dateTime: props.time || props.date || '',
    unit: props.unit_of_measure || '',
    qualifier,
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000,
    statisticId: props.statistic_id || undefined,
  };
}

/**
 * Parse a monitoring-locations feature into site metadata.
 */
export function parseOgcSite(feature: OgcFeature, fallbackState?: string): ParsedOgcSite | null {
  const props = feature.properties;
  if (!props) return null;

  const monitoringLocationId = props.monitoring_location_id || '';
  const siteNumber = monitoringLocationId.replace(/^USGS-/, '');
  if (!siteNumber) return null;

  const coords = feature.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;

  const lng = coords[0];
  const lat = coords[1];
  if (isNaN(lat) || isNaN(lng) || lat === 0) return null;

  return {
    siteNumber,
    siteName: props.monitoring_location_name || '',
    siteType: props.site_type_code || 'ST',
    state: props.state_code || props.monitoring_location_state_code || fallbackState || '',
    huc: props.hydrologic_unit_code || '',
    lat: Math.round(lat * 100000) / 100000,
    lng: Math.round(lng * 100000) / 100000,
  };
}

/**
 * Fetch monitoring location metadata for a state.
 * Results can be cached to avoid re-fetching during param iteration.
 */
export async function fetchMonitoringLocations(
  stateCode: string,
  siteTypeFilter?: string[],
): Promise<Map<string, ParsedOgcSite>> {
  const params: Record<string, string> = {
    monitoring_location_state_code: stateCode,
  };

  // OGC API may not support multi-value site_type_code — fetch all and filter
  const data = await fetchOgcCollection('monitoring-locations', params, {
    maxPages: 10,
    timeoutMs: 30_000,
  });

  const siteMap = new Map<string, ParsedOgcSite>();
  for (const feature of data.features) {
    const site = parseOgcSite(feature, stateCode);
    if (site) {
      if (siteTypeFilter && siteTypeFilter.length > 0) {
        if (!siteTypeFilter.includes(site.siteType)) continue;
      }
      siteMap.set(site.siteNumber, site);
    }
  }

  return siteMap;
}
