/* ------------------------------------------------------------------ */
/*  PIN Sentinel — NWSS ↔ Water Quality Correlation Configuration     */
/* ------------------------------------------------------------------ */

/** Look-back window for WQ signals after NWSS anomaly */
export const CORRELATION_WINDOW_HOURS = 72;

/* ------------------------------------------------------------------ */
/*  Bio-Proxy Parameter Links                                         */
/*  Which NWSS pathogens correlate with which WQ parameters.          */
/* ------------------------------------------------------------------ */

export interface BioProxyLink {
  pathogen: string;
  paramCd: string;
  paramName: string;
  direction: 'elevated' | 'depressed';
  matchStrength: number; // 0–1
}

export const BIO_PROXY_LINKS: BioProxyLink[] = [
  // Norovirus → fecal indicator + DO depression
  { pathogen: 'sars-cov-2', paramCd: '00300', paramName: 'DO', direction: 'depressed', matchStrength: 0.5 },
  { pathogen: 'sars-cov-2', paramCd: '63680', paramName: 'turbidity', direction: 'elevated', matchStrength: 0.4 },

  // Influenza A → seasonal baseline shift (weak, mostly confounding)
  { pathogen: 'influenza-a', paramCd: '00300', paramName: 'DO', direction: 'depressed', matchStrength: 0.3 },
  { pathogen: 'influenza-a', paramCd: '00010', paramName: 'temperature', direction: 'elevated', matchStrength: 0.2 },

  // RSV → weak general correlation
  { pathogen: 'rsv', paramCd: '00300', paramName: 'DO', direction: 'depressed', matchStrength: 0.3 },

  // Mpox → very weak correlation
  { pathogen: 'mpox', paramCd: '63680', paramName: 'turbidity', direction: 'elevated', matchStrength: 0.2 },
];

/* ------------------------------------------------------------------ */
/*  Correlation Scoring Weights                                       */
/* ------------------------------------------------------------------ */

export const CORRELATION_WEIGHTS = {
  temporalProximity: 0.35,
  spatialProximity:  0.35,
  parameterMatch:    0.30,
};

/** Minimum correlation score to flag as significant */
export const CORRELATION_THRESHOLD = 0.5;
