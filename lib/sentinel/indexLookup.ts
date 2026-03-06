/* ------------------------------------------------------------------ */
/*  Watershed Context Lookup for Sentinel Engines                     */
/*  Thin helper bridging the 14-layer composite index to Sentinel.    */
/* ------------------------------------------------------------------ */

import { getIndicesForHuc } from '../indices/indicesCache';

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
  const indices = getIndicesForHuc(huc8);
  if (!indices) return FALLBACK;

  return {
    severity: indices.composite / 100,
    confidence: indices.compositeConfidence,
    composite: indices.composite,
    waterRiskInverse: indices.composite / 100, // composite: higher = worse
    available: true,
  };
}
