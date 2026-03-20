import centroidsData from '@/data/huc12-centroids.json';
import adjacencyData from '@/data/huc12-adjacency.json';
import { getWqpCache, type WqpRecord } from '@/lib/wqpCache';
import { getIcisCache, type IcisPermit, type IcisViolation, type IcisDmr, type IcisEnforcement, type IcisInspection } from '@/lib/icisCache';
import { getSdwisCache, type SdwisSystem, type SdwisViolation, type SdwisEnforcement } from '@/lib/sdwisCache';
import { getAttainsCache, type CachedWaterbody } from '@/lib/attainsCache';
import { extractHuc12, huc12ToHuc8 } from '@/lib/huc12Utils';

const centroids = Object.fromEntries(
  Object.entries(centroidsData)
    .filter(([key]) => key !== '_comment')
) as Record<string, { lat: number; lng: number }>;
const adjacency = adjacencyData as unknown as Record<string, { huc8: string; huc10: string; adjacent: string[]; state: string }>;

export interface HucData {
  huc12: string;                    // Primary HUC-12 identifier
  huc8: string;                     // Parent HUC-8 for backwards compatibility
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
 * Collect data from all grid-based caches for a given HUC-12.
 *
 * For grid-based caches (WQP, ICIS, SDWIS), uses the HUC centroid to do a
 * 3x3 neighbor lookup (~15km radius for higher precision). For ATTAINS (state-keyed),
 * filters waterbodies whose ATTAINS ID maps to this HUC-12.
 */
export function collectForHuc(huc12: string): HucData {
  const centroid = centroids[huc12];
  const adj = adjacency[huc12];
  const huc8 = huc12ToHuc8(huc12);

  // For HUCs missing centroid/adjacency data, create fallback with empty arrays
  if (!centroid || !adj) {
    console.warn(`[HUC Data Collector] Missing centroid/adjacency for ${huc12}, using fallback`);
    return {
      huc12,
      huc8,
      stateAbbr: 'XX', // Unknown state - will be handled by index calculators
      wqpRecords: [],
      icisPermits: [],
      icisViolations: [],
      icisDmrs: [],
      icisEnforcement: [],
      icisInspections: [],
      sdwisSystems: [],
      sdwisViolations: [],
      sdwisEnforcement: [],
      attainsWaterbodies: [],
    };
  }

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

  // ATTAINS: state-keyed, filter waterbodies by HUC-12 extracted from ID
  const attainsResponse = getAttainsCache();
  const stateSummary = attainsResponse.states[stateAbbr];
  const attainsWaterbodies = (stateSummary?.waterbodies ?? []).filter(wb => {
    const wbHuc12 = extractHuc12(wb.id);
    const wbHuc8 = extractHuc12(wb.id)?.slice(0, 8); // Also check parent HUC-8
    return wbHuc12 === huc12 || wbHuc8 === huc8; // Match either HUC-12 or parent HUC-8
  });

  return {
    huc12,
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

/** Get all HUC-12 codes from the centroids file */
export function getAllHuc12s(): string[] {
  return Object.keys(centroids);
}

/** Get all HUC-8 codes (backwards compatibility) */
export function getAllHuc8s(): string[] {
  const huc12s = Object.keys(centroids);
  const huc8s = new Set(huc12s.map(huc12 => huc12ToHuc8(huc12)));
  return Array.from(huc8s);
}
