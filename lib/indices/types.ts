export interface IndexScore {
  value: number;          // 0-100
  confidence: number;     // 0-100
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
  lastCalculated: string; // ISO-8601
  dataPoints: number;     // # of source records used
  tidalModified: boolean; // true if tidal algorithm applied
}

export interface HucIndices {
  huc8: string;
  stateAbbr: string;
  pearlLoadVelocity: IndexScore;
  infrastructureFailure: IndexScore;
  watershedRecovery: IndexScore;
  permitRiskExposure: IndexScore;
  composite: number;               // weighted average 0-100
  compositeConfidence: number;     // min confidence across indices
  projection7d: HucProjection | null;
  projection30d: HucProjection | null;
}

export interface HucProjection {
  composite: number;        // projected composite value
  delta: number;            // change from current
  direction: 'improving' | 'stable' | 'declining';
  confidence: number;       // projection confidence (lower than base)
}

export type IndexId = 'pearlLoadVelocity' | 'infrastructureFailure' | 'watershedRecovery' | 'permitRiskExposure';
