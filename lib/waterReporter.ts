// lib/waterReporter.ts
// Client-side utility for fetching Water Reporter data via our secure API proxy
// API key never leaves the server — all calls go through /api/water-data

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WRDataset {
  id: number;
  name: string;
  stub: string;
  organization: { id: number; name: string; logo_url?: string };
  created_at?: string;
  updated_at?: string;
}

export interface WRStation {
  id: number;
  name: string;
  dataset_id: number;
  lat: number;
  lng: number;
  is_active: boolean;
  last_sampled?: string;
  parameter_count?: number;
  reading_count?: number;
  raw_id?: string;
  huc_12?: string;
  huc?: Record<string, { code: string; name: string }>;
}

export interface WRParameter {
  id: number;
  name: string;
  normalized_name: string;
  unit: string;
  min?: number;
  max?: number;
  mean?: number;
  newest_value?: number;
  reading_count?: number;
  last_sampled?: string;
  chart_schema?: {
    ranges: Array<{
      color: string;
      label: string;
      lower_bound: number;
      upper_bound?: number;
    }>;
  };
}

export interface WRReading {
  id: number;
  value: number;
  collection_date: string;
  color?: string;
  certified?: boolean;
  user?: string;
}

export interface WRReadingsResponse {
  data: WRReading[];
  dataset?: { id: number; name: string };
  parameter?: { id: number; name: string; display_name?: string; normalized_name: string };
  station?: { id: number; name: string };
  unit?: { detail: string; notation?: string };
  summary?: { count: number; page: number; total_pages: number };
}

// ─── Region → Coordinate Mapping ────────────────────────────────────────────
// Maps PEARL region IDs to approximate center coordinates for Water Reporter lookups
// Focused on MD waterbodies but extensible to any state

export interface RegionCoord {
  lat: number;
  lng: number;
  searchRadius?: number; // meters, default 5000
  name: string;
}

export const REGION_COORDINATES: Record<string, RegionCoord> = {
  // Maryland — Baltimore area
  maryland_middle_branch:    { lat: 39.263, lng: -76.623, name: 'Middle Branch Patapsco' },
  maryland_inner_harbor:     { lat: 39.285, lng: -76.610, name: 'Inner Harbor' },
  maryland_jones_falls:      { lat: 39.290, lng: -76.612, name: 'Jones Falls' },
  maryland_gwynns_falls:     { lat: 39.275, lng: -76.657, name: 'Gwynns Falls' },
  maryland_back_river:       { lat: 39.262, lng: -76.476, name: 'Back River' },
  maryland_bear_creek:       { lat: 39.250, lng: -76.460, name: 'Bear Creek' },
  maryland_curtis_bay:       { lat: 39.215, lng: -76.577, name: 'Curtis Bay' },
  maryland_patapsco_river:   { lat: 39.235, lng: -76.535, name: 'Patapsco River' },
  maryland_stony_creek:      { lat: 39.203, lng: -76.537, name: 'Stony Creek' },

  // Maryland — Chesapeake tributaries
  maryland_severn_river:     { lat: 39.060, lng: -76.535, name: 'Severn River' },
  maryland_south_river:      { lat: 38.945, lng: -76.545, name: 'South River' },
  maryland_magothy_river:    { lat: 39.095, lng: -76.505, name: 'Magothy River' },
  maryland_chester_river:    { lat: 39.145, lng: -76.065, name: 'Chester River' },
  maryland_choptank_river:   { lat: 38.675, lng: -76.065, name: 'Choptank River' },
  maryland_patuxent_river:   { lat: 38.540, lng: -76.680, name: 'Patuxent River' },
  maryland_sassafras_river:  { lat: 39.370, lng: -75.950, name: 'Sassafras River' },
  maryland_nanticoke_river:  { lat: 38.395, lng: -75.895, name: 'Nanticoke River' },
  maryland_wicomico_river:   { lat: 38.370, lng: -75.600, name: 'Wicomico River' },
  maryland_pocomoke_river:   { lat: 38.070, lng: -75.560, name: 'Pocomoke River' },

  // Maryland — Western/Central
  maryland_monocacy_river:   { lat: 39.395, lng: -77.395, name: 'Monocacy River' },
  maryland_antietam_creek:   { lat: 39.450, lng: -77.740, name: 'Antietam Creek' },
  maryland_deep_creek_lake:  { lat: 39.510, lng: -79.340, name: 'Deep Creek Lake' },

  // Florida — PEARL pilot area
  florida_escambia:          { lat: 30.600, lng: -87.215, name: 'Escambia Bay' },
  florida_blackwater:        { lat: 30.610, lng: -86.925, name: 'Blackwater River' },
  florida_pensacola:         { lat: 30.400, lng: -87.210, name: 'Pensacola Bay' },

  // Virginia — Chesapeake
  virginia_james_river:      { lat: 37.045, lng: -76.425, name: 'James River' },
  virginia_elizabeth_river:  { lat: 36.830, lng: -76.295, name: 'Elizabeth River' },
  virginia_york_river:       { lat: 37.230, lng: -76.505, name: 'York River' },

  // DC
  dc_anacostia:              { lat: 38.870, lng: -76.975, name: 'Anacostia River' },
  dc_potomac:                { lat: 38.880, lng: -77.040, name: 'Potomac River' },
};

// ─── API Helpers ─────────────────────────────────────────────────────────────

const API_BASE = '/api/water-data';

async function apiFetch<T = any>(params: Record<string, string>): Promise<T> {
  const url = new URL(API_BASE, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── Datasets ─────────────────────────────────────────────────────────────────

/** Find datasets with stations near a bounding box */
export async function getDatasets(bbox?: string, huc?: string): Promise<WRDataset[]> {
  const data = await apiFetch({
    action: 'datasets',
    ...(bbox ? { bbox } : {}),
    ...(huc ? { huc } : {}),
  });
  return data.results || [];
}

/** Find datasets near a PEARL region */
export async function getDatasetsForRegion(regionId: string): Promise<WRDataset[]> {
  const coord = REGION_COORDINATES[regionId];
  if (!coord) return [];
  // Build a ~5km bbox around the center point
  const delta = 0.045; // ~5km at MD latitudes
  const bbox = `${coord.lng - delta},${coord.lat - delta},${coord.lng + delta},${coord.lat + delta}`;
  return getDatasets(bbox);
}

// ── Stations ─────────────────────────────────────────────────────────────────

/** Get stations for one or more datasets */
export async function getStations(datasetIds: number | number[], bbox?: string): Promise<WRStation[]> {
  const sets = Array.isArray(datasetIds) ? datasetIds.join(',') : String(datasetIds);
  const data = await apiFetch({
    action: 'stations',
    sets,
    ...(bbox ? { bbox } : {}),
  });
  return data.features || [];
}

/** Find the nearest station to a point */
export async function getNearestStation(lat: number, lng: number, radius = 5000): Promise<WRStation | null> {
  try {
    const data = await apiFetch({
      action: 'nearest',
      lat: String(lat),
      lng: String(lng),
      radius: String(radius),
    });
    return data?.id ? data : null;
  } catch {
    return null;
  }
}

/** Find the nearest station to a PEARL region */
export async function getNearestStationForRegion(regionId: string): Promise<WRStation | null> {
  const coord = REGION_COORDINATES[regionId];
  if (!coord) return null;
  return getNearestStation(coord.lat, coord.lng, coord.searchRadius || 5000);
}

// ── Parameters ───────────────────────────────────────────────────────────────

/** Get parameters available at a station */
export async function getParameters(datasetId: number, stationId: number): Promise<WRParameter[]> {
  const data = await apiFetch({
    action: 'parameters',
    dataset_id: String(datasetId),
    station_id: String(stationId),
  });
  return data.features || [];
}

// ── Readings ─────────────────────────────────────────────────────────────────

/** Get readings for a specific station + parameter */
export async function getReadings(
  stationId: number,
  parameterId: number,
  opts?: { limit?: number; startDate?: string; endDate?: string }
): Promise<WRReadingsResponse> {
  return apiFetch({
    action: 'readings',
    station_id: String(stationId),
    parameter_id: String(parameterId),
    limit: String(opts?.limit || 50),
    ...(opts?.startDate ? { start_date: opts.startDate } : {}),
    ...(opts?.endDate ? { end_date: opts.endDate } : {}),
  });
}

// ── Watersheds ───────────────────────────────────────────────────────────────

/** Look up watershed info for a point */
export async function getWatershed(lat: number, lng: number) {
  const data = await apiFetch({
    action: 'watersheds',
    lat: String(lat),
    lng: String(lng),
  });
  return data.feature || null;
}

// ─── High-Level: Get Latest Data for a PEARL Region ─────────────────────────
// One-call convenience function that chains: nearest station → parameters → latest readings

export interface RegionWaterData {
  station: WRStation;
  parameters: Array<{
    info: WRParameter;
    latestValue: number | null;
    latestDate: string | null;
    unit: string;
    thresholdColor: string | null;
  }>;
}

/** Get all available water quality data for a PEARL region in one call */
export async function getRegionWaterData(regionId: string): Promise<RegionWaterData | null> {
  const coord = REGION_COORDINATES[regionId];
  if (!coord) return null;

  // 1. Find nearest station
  const station = await getNearestStation(coord.lat, coord.lng);
  if (!station) return null;

  // 2. Get available parameters
  const params = await getParameters(station.dataset_id, station.id);
  if (!params.length) return null;

  // 3. Get latest reading for each parameter (parallel)
  const paramData = await Promise.all(
    params.map(async (param) => {
      try {
        const readings = await getReadings(station.id, param.id, { limit: 1 });
        const latest = readings.data?.[0];
        return {
          info: param,
          latestValue: latest?.value ?? param.newest_value ?? null,
          latestDate: latest?.collection_date ?? param.last_sampled ?? null,
          unit: param.unit || readings.unit?.detail || '',
          thresholdColor: latest?.color ?? null,
        };
      } catch {
        return {
          info: param,
          latestValue: param.newest_value ?? null,
          latestDate: param.last_sampled ?? null,
          unit: param.unit || '',
          thresholdColor: null,
        };
      }
    })
  );

  return { station, parameters: paramData };
}

// ─── Parameter Name Mapping ─────────────────────────────────────────────────
// Maps Water Reporter normalized_name values to PEARL dashboard fields

export const WR_TO_PEARL_MAP: Record<string, string> = {
  'dissolved_oxygen_mg_l': 'dissolvedOxygen',
  'dissolved_oxygen': 'dissolvedOxygen',
  'ph': 'pH',
  'turbidity_ntu': 'turbidity',
  'turbidity': 'turbidity',
  'total_suspended_solids_mg_l': 'tss',
  'total_suspended_solids': 'tss',
  'tss': 'tss',
  'total_nitrogen_mg_l': 'nitrogen',
  'total_nitrogen': 'nitrogen',
  'nitrate_mg_l': 'nitrogen',
  'total_phosphorus_mg_l': 'phosphorus',
  'total_phosphorus': 'phosphorus',
  'e_coli_concentration': 'bacteria',
  'e_coli_cfu_100ml': 'bacteria',
  'enterococcus_mpn_100ml': 'bacteria',
  'enterococcus': 'bacteria',
  'fecal_coliform': 'bacteria',
  'water_temperature_c': 'temperature',
  'temperature': 'temperature',
  'conductivity': 'conductivity',
  'salinity': 'salinity',
  'chlorophyll_a': 'chlorophyll',
};

/** Convert Water Reporter data to a PEARL-compatible data object */
export function wrDataToPearl(regionData: RegionWaterData): Record<string, number | null> {
  const result: Record<string, number | null> = {};

  for (const param of regionData.parameters) {
    const pearlKey = WR_TO_PEARL_MAP[param.info.normalized_name];
    if (pearlKey && param.latestValue !== null) {
      result[pearlKey] = param.latestValue;
    }
  }

  return result;
}
