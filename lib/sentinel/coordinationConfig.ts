/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Coordination Detection Configuration               */
/* ------------------------------------------------------------------ */

/** Minimum events in a HUC-6 cluster to flag as coordinated */
export const MIN_CLUSTER_SIZE = 2;

/** Coordination window (events must fall within this timeframe) */
export const COORDINATION_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Threshold: coordination score > this → emit CoordinatedEvent */
export const COORDINATION_THRESHOLD = 0.6;

/* ------------------------------------------------------------------ */
/*  Scoring Weights                                                   */
/* ------------------------------------------------------------------ */

export const COORDINATION_WEIGHTS = {
  clusterSize:       0.35,   // more HUCs = more suspicious
  parameterBreadth:  0.35,   // more distinct parameters = more suspicious
  temporalTightness: 0.30,   // tighter clustering = more suspicious
};

/* ------------------------------------------------------------------ */
/*  Multivariate Detection                                            */
/*  Parameter pairs that indicate coordinated attacks when            */
/*  they deviate simultaneously.                                     */
/* ------------------------------------------------------------------ */

export const ATTACK_INDICATOR_PAIRS: { params: string[]; weight: number }[] = [
  { params: ['00300', '00400'],           weight: 0.8 },  // DO + pH → chemical dump
  { params: ['00300', '63680'],           weight: 0.7 },  // DO + turbidity → sediment/organic load
  { params: ['00095', '00400'],           weight: 0.9 },  // conductivity + pH → industrial discharge
  { params: ['00095', '00300', '00400'],  weight: 1.0 },  // conductivity + DO + pH → major contamination
];

/** Minimum simultaneous parameter deviations to flag multivariate */
export const MIN_MULTIVARIATE_PARAMS = 3;
