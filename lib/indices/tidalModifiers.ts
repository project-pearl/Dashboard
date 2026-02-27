import type { HucIndices, IndexScore } from './types';
import { COASTAL_WATER_TYPES, isCoastalWaterbody } from '@/lib/huc8Utils';
import { getAttainsCache, type CachedWaterbody } from '@/lib/attainsCache';
import adjacencyData from '@/data/huc8-adjacency.json';
import { extractHuc8 } from '@/lib/huc8Utils';

const adjacency = adjacencyData as unknown as Record<string, { huc6: string; adjacent: string[]; state: string }>;

/**
 * Detect whether a HUC-8 is coastal/tidal.
 * Cross-references ATTAINS waterbodies in this HUC with COASTAL_WATER_TYPES.
 */
export function isCoastalHuc(huc8: string): boolean {
  const adj = adjacency[huc8];
  if (!adj) return false;

  const attainsResponse = getAttainsCache();
  const stateSummary = attainsResponse.states[adj.state];
  if (!stateSummary) return false;

  return stateSummary.waterbodies.some(wb => {
    const wbHuc = extractHuc8(wb.id);
    if (wbHuc !== huc8) return false;
    return isCoastalWaterbody(wb as any);
  });
}

/**
 * Apply tidal modifiers to index scores for coastal HUC-8s.
 *
 * Modifications:
 *   PEARL Load Velocity: TP emphasized (+15%), TN de-emphasized (-10%) — net +5% shift
 *   Infrastructure Failure: +10% for saltwater intrusion risk (GW source)
 *   Watershed Recovery: dampened by 0.85x (slower expected recovery in tidal)
 *   Permit Risk: DMR exceedance diluted 0.9x, enforcement boosted 1.1x — net slight reduction
 */
export function applyTidalModifiers(indices: {
  pearlLoadVelocity: IndexScore;
  infrastructureFailure: IndexScore;
  watershedRecovery: IndexScore;
  permitRiskExposure: IndexScore;
}): void {
  // PEARL: shift score up by 5% (TP is more mobile in tidal → worse)
  indices.pearlLoadVelocity.value = clamp(Math.round(indices.pearlLoadVelocity.value * 1.05));
  indices.pearlLoadVelocity.tidalModified = true;

  // Infrastructure: +10% for saltwater intrusion risk
  indices.infrastructureFailure.value = clamp(Math.round(indices.infrastructureFailure.value * 1.10));
  indices.infrastructureFailure.tidalModified = true;

  // Recovery: slower expected recovery → dampen score by 0.85x
  indices.watershedRecovery.value = clamp(Math.round(indices.watershedRecovery.value * 0.85));
  indices.watershedRecovery.tidalModified = true;

  // Permit Risk: tidal mixing dilution offsets enforcement boost → net 0.98x
  indices.permitRiskExposure.value = clamp(Math.round(indices.permitRiskExposure.value * 0.98));
  indices.permitRiskExposure.tidalModified = true;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
