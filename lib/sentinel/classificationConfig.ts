/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Attack vs. Benign Classification Configuration     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Classification Thresholds                                         */
/* ------------------------------------------------------------------ */

export const CLASSIFICATION_THRESHOLDS = {
  LIKELY_ATTACK:  0.7,
  POSSIBLE_ATTACK: 0.4,
  // Below 0.4 = likely benign
};

/* ------------------------------------------------------------------ */
/*  Confounder Rules                                                  */
/* ------------------------------------------------------------------ */

export interface ConfounderRule {
  id: string;
  name: string;
  /** How much to reduce threat score when this confounder matches */
  reductionMagnitude: number;
  /** Parameters this confounder affects (empty = all) */
  affectedParamCds: string[];
  /** Description for reasoning output */
  description: string;
}

export const CONFOUNDER_RULES: ConfounderRule[] = [
  {
    id: 'RAINFALL_CONFOUNDER',
    name: 'Heavy Rainfall',
    reductionMagnitude: 0.3,
    affectedParamCds: ['63680', '00095'], // turbidity, conductivity
    description: 'Rainfall >2 inches in 24h suppresses turbidity/conductance anomalies',
  },
  {
    id: 'FLOOD_CONFOUNDER',
    name: 'Active Flood Warning',
    reductionMagnitude: 0.4,
    affectedParamCds: [], // affects all except bio markers
    description: 'Active NWS flood warning — suppresses all but bio markers',
  },
  {
    id: 'SEASONAL_CONFOUNDER',
    name: 'Seasonal Pattern',
    reductionMagnitude: 0.2,
    affectedParamCds: ['00300', '00010'], // DO, temperature
    description: 'Parameters with known seasonal patterns require higher z-score (>4σ)',
  },
  {
    id: 'COVARIANCE_CONFOUNDER',
    name: 'Natural Covariance',
    reductionMagnitude: 0.15,
    affectedParamCds: ['00300', '00010'], // temp↔DO naturally correlated
    description: 'Naturally correlated parameters — don\'t double-count',
  },
];

/* ------------------------------------------------------------------ */
/*  Attack Indicator Signals                                          */
/* ------------------------------------------------------------------ */

export interface AttackSignal {
  id: string;
  name: string;
  /** How much to boost threat score when this signal matches */
  boostMagnitude: number;
  /** Parameter combinations that indicate this signal */
  paramCds: string[];
  /** Minimum simultaneous deviations needed */
  minDeviations: number;
  description: string;
}

export const ATTACK_SIGNALS: AttackSignal[] = [
  {
    id: 'CHEMICAL_DUMP',
    name: 'Chemical Contamination',
    boostMagnitude: 0.3,
    paramCds: ['00095', '00400', '00300'], // conductivity + pH + DO
    minDeviations: 2,
    description: 'Simultaneous conductivity + pH/DO shifts suggest chemical contamination',
  },
  {
    id: 'MULTI_SITE_PATTERN',
    name: 'Multi-Site Coordinated',
    boostMagnitude: 0.35,
    paramCds: [], // any params, but across multiple sites
    minDeviations: 0,
    description: 'Same parameter anomaly across multiple sites suggests intentional action',
  },
  {
    id: 'BIO_MARKER_SPIKE',
    name: 'Bio-Marker Spike',
    boostMagnitude: 0.25,
    paramCds: ['00300', '63680'], // DO crash + turbidity spike
    minDeviations: 2,
    description: 'DO crash with turbidity spike indicates biological contamination event',
  },
];

/* ------------------------------------------------------------------ */
/*  Bio-Marker Parameter Codes (exempt from flood confounder)         */
/* ------------------------------------------------------------------ */

export const BIO_MARKER_PARAMS = new Set(['00300']); // dissolved oxygen
