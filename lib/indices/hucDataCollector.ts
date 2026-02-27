import centroidsData from '@/data/huc8-centroids.json';
import adjacencyData from '@/data/huc8-adjacency.json';
import { getWqpCache, type WqpRecord } from '@/lib/wqpCache';
import { getIcisCache, type IcisPermit, type IcisViolation, type IcisDmr, type IcisEnforcement, type IcisInspection } from '@/lib/icisCache';
import { getSdwisCache, type SdwisSystem, type SdwisViolation, type SdwisEnforcement } from '@/lib/sdwisCache';
import { getAttainsCache, type CachedWaterbody } from '@/lib/attainsCache';
import { extractHuc8 } from '@/lib/huc8Utils';

const centroids = centroidsData as Record<string, { lat: number; lng: number }>;
const adjacency = adjacencyData as unknown as Record<string, { huc6: string; adjacent: string[]; state: string }>;

export interface HucData {
  huc8: string;
  stateAbbr: string;
  wqpRecords: WqpRecord[];
  icisPermits: IcisPermit[];
  icisViolations: IcisViolation[];
  icisDmrs: IcisDmr[];
  icisEnforcement: IcisEnforcement[];
  icisInspections: IcisInspection[];
  sdwisSystems: SdwisSystem[];
  sdwisViolations: SdwisViolation[];
  sdwisEnforcement: SdwisEnforcement[];
  attainsWaterbodies: CachedWaterbody[];
}

/**
 * Collect data from all grid-based caches for a given HUC-8.
 *
 * For grid-based caches (WQP, ICIS, SDWIS), uses the HUC centroid to do a
 * 3x3 neighbor lookup (~30km radius). For ATTAINS (state-keyed), filters
 * waterbodies whose ATTAINS ID maps to this HUC-8.
 */
export function collectForHuc(huc8: string): HucData | null {
  const centroid = centroids[huc8];
  const adj = adjacency[huc8];
  if (!centroid || !adj) return null;

  const { lat, lng } = centroid;
  const stateAbbr = adj.state;

  // Grid-based lookups (each already does 3x3 neighbor expansion)
  const wqpResult = getWqpCache(lat, lng);
  const icisResult = getIcisCache(lat, lng);
  const sdwisResult = getSdwisCache(lat, lng);

  // Filter grid results to this HUC's state
  const wqpRecords = (wqpResult?.data ?? []).filter(r => !r.state || r.state === stateAbbr);
  const icisPermits = (icisResult?.permits ?? []).filter(r => !r.state || r.state === stateAbbr);
  const icisViolations = icisResult?.violations ?? [];
  const icisDmrs = icisResult?.dmr ?? [];
  const icisEnforcement = icisResult?.enforcement ?? [];
  const icisInspections = icisResult?.inspections ?? [];
  const sdwisSystems = (sdwisResult?.systems ?? []).filter(r => !r.state || r.state === stateAbbr);
  const sdwisViolations = sdwisResult?.violations ?? [];
  const sdwisEnforcement = sdwisResult?.enforcement ?? [];

  // ATTAINS: state-keyed, filter waterbodies by HUC-8 extracted from ID
  const attainsResponse = getAttainsCache();
  const stateSummary = attainsResponse.states[stateAbbr];
  const attainsWaterbodies = (stateSummary?.waterbodies ?? []).filter(wb => {
    const wbHuc = extractHuc8(wb.id);
    return wbHuc === huc8;
  });

  return {
    huc8,
    stateAbbr,
    wqpRecords,
    icisPermits,
    icisViolations,
    icisDmrs,
    icisEnforcement,
    icisInspections,
    sdwisSystems,
    sdwisViolations,
    sdwisEnforcement,
    attainsWaterbodies,
  };
}

/** Get all HUC-8 codes from the centroids file */
export function getAllHuc8s(): string[] {
  return Object.keys(centroids);
}
