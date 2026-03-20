/* ------------------------------------------------------------------ */
/*  Watershed Context Lookup for Sentinel Engines                     */
/*  Thin helper bridging the 14-layer composite index to Sentinel.    */
/* ------------------------------------------------------------------ */

import { getIndicesForHuc8 } from '../indices/indicesCache';

export interface WatershedContext {
  severity: number;        // 0-1, higher = more degraded (composite / 100)
  confidence: number;      // compositeConfidence from indices
  composite: number;       // raw 0-100 composite
  waterRiskInverse: number; // 1 - (waterRisk / 100), 0-1 higher = worse
  available: boolean;      // false if indices not loaded for this HUC
}

const FALLBACK: WatershedContext = {
  severity: 0.5,
  confidence: 0,
  composite: 50,
  waterRiskInverse: 0.5,
  available: false,
};

export function getWatershedContext(huc8: string): WatershedContext {
  // Get all HUC-12 indices within this HUC-8
  const huc12Indices = getIndicesForHuc8(huc8);
  if (huc12Indices.length === 0) return FALLBACK;

  // Aggregate HUC-12s within the HUC-8
  const totalCount = huc12Indices.length;
  const avgComposite = Math.round(
    huc12Indices.reduce((sum, idx) => sum + idx.composite, 0) / totalCount
  );
  const minConfidence = Math.min(
    ...huc12Indices.map(idx => idx.compositeConfidence)
  );

  return {
    severity: avgComposite / 100,
    confidence: minConfidence,
    composite: avgComposite,
    waterRiskInverse: avgComposite / 100, // composite: higher = worse
    available: true,
  };
}
