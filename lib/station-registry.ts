// lib/station-registry.ts
// AUTO-GENERATED — do not edit manually
// Re-run: python scripts/discover_stations.py
// Generated: 2026-02-15 23:50

import registryData from './station-registry.json';

export interface RegionMeta {
  lat: number;
  lng: number;
  huc8: string;
  stateCode: string;
  name: string;
}

export interface WqpStationInfo {
  siteId: string;
  provider: string;
  name: string;
}

export interface CoverageInfo {
  hasData: boolean;
  sources: string[];
  wqParams: string[];
  paramCount: number;
}

// Typed exports from the JSON registry
export const REGION_META: Record<string, RegionMeta> = registryData.regions as any;
export const USGS_SITE_MAP: Record<string, string> = registryData.usgsSiteMap as any;
export const WQP_STATION_MAP: Record<string, WqpStationInfo> = registryData.wqpStationMap as any;
export const COVERAGE_MAP: Record<string, CoverageInfo> = registryData.coverage as any;

/** Check if a waterbody has confirmed monitoring data */
export function hasConfirmedData(regionId: string): boolean {
  return COVERAGE_MAP[regionId]?.hasData ?? false;
}

/** Get all waterbody IDs with confirmed data */
export function getWaterbodiesWithData(): string[] {
  return Object.keys(COVERAGE_MAP);
}

/** Get waterbodies for a specific state, sorted by name */
export function getWaterbodiesByState(stateCode: string): { id: string; name: string }[] {
  return Object.entries(REGION_META)
    .filter(([_, meta]) => meta.stateCode === stateCode)
    .map(([id, meta]) => ({ id, name: meta.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Get all states that have confirmed waterbody data */
export function getStatesWithData(): { code: string; count: number }[] {
  const states = new Map<string, number>();
  for (const meta of Object.values(REGION_META)) {
    states.set(meta.stateCode, (states.get(meta.stateCode) || 0) + 1);
  }
  return Array.from(states.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => a.code.localeCompare(b.code));
}
