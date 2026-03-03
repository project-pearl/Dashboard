/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Pre-Built Attack Scenarios                         */
/* ------------------------------------------------------------------ */

import type { AttackScenario } from './attackSimulator';

/* ------------------------------------------------------------------ */
/*  Scenario 1: Single-Point Contamination                            */
/*  One HUC-8, 3 parameters spike simultaneously, 2h window.         */
/* ------------------------------------------------------------------ */

export const SINGLE_POINT_CONTAMINATION: AttackScenario = {
  name: 'single-point-contamination',
  description: 'Single HUC-8 — 3 parameters spike simultaneously within 2 hours (chemical dump pattern)',
  huc8s: ['02070010'],
  states: ['MD'],
  paramCds: ['00095', '00400', '00300'], // conductivity + pH + DO
  windowMs: 2 * 60 * 60 * 1000,         // 2 hours
  jitterMs: 10 * 60 * 1000,             // ±10 min
  deviationMultiplier: 3.0,
  source: 'USGS_IV',
  expectedClassification: 'likely_attack',
  expectedCoordinationScore: [0.0, 0.3], // single site, no coordination
};

/* ------------------------------------------------------------------ */
/*  Scenario 2: Coordinated Multi-Site                                */
/*  4 adjacent HUC-8s, staggered 30min, same parameter.              */
/* ------------------------------------------------------------------ */

export const COORDINATED_MULTI_SITE: AttackScenario = {
  name: 'coordinated-multi-site',
  description: '4 adjacent HUC-8s — same parameter spikes staggered 30 min apart (coordinated attack)',
  huc8s: ['02070010', '02070008', '02060003', '02060001'],
  states: ['MD', 'MD', 'MD', 'MD'],
  paramCds: ['00095'],                   // conductivity only
  windowMs: 2 * 60 * 60 * 1000,         // 2 hours
  jitterMs: 5 * 60 * 1000,              // ±5 min
  deviationMultiplier: 2.5,
  source: 'USGS_IV',
  expectedClassification: 'likely_attack',
  expectedCoordinationScore: [0.6, 1.0],
};

/* ------------------------------------------------------------------ */
/*  Scenario 3: Slow-Roll Poisoning                                   */
/*  One HUC-8, gradual increase over 12h, subtle z-scores (2-3σ).    */
/* ------------------------------------------------------------------ */

export const SLOW_ROLL_POISONING: AttackScenario = {
  name: 'slow-roll-poisoning',
  description: 'Single HUC-8 — gradual contamination over 12 hours, subtle (2-3σ) deviations',
  huc8s: ['02060004'],
  states: ['MD'],
  paramCds: ['00095', '00300'],          // conductivity + DO
  windowMs: 12 * 60 * 60 * 1000,        // 12 hours
  jitterMs: 30 * 60 * 1000,             // ±30 min
  deviationMultiplier: 1.5,
  source: 'USGS_IV',
  expectedClassification: 'possible_attack',
  expectedCoordinationScore: [0.0, 0.3],
};

/* ------------------------------------------------------------------ */
/*  Scenario 4: Bio-Threat with NWSS                                  */
/*  NWSS pathogen spike + downstream WQ anomalies 24h later.          */
/* ------------------------------------------------------------------ */

export const BIO_THREAT_WITH_NWSS: AttackScenario = {
  name: 'bio-threat-with-nwss',
  description: 'NWSS pathogen spike in wastewater + downstream WQ anomalies appearing 24h later',
  huc8s: ['02070010', '02060003'],
  states: ['MD', 'MD'],
  paramCds: ['00300', '63680'],          // DO depression + turbidity spike
  windowMs: 48 * 60 * 60 * 1000,        // 48 hours (accounts for lag)
  jitterMs: 60 * 60 * 1000,             // ±1 hour
  deviationMultiplier: 2.0,
  source: 'USGS_IV',
  expectedClassification: 'likely_attack',
  expectedCoordinationScore: [0.3, 0.7],
  nwssAnomaly: {
    sewershedId: 'NWSS-2210',
    pathogen: 'sars-cov-2',
    sigma: 4.2,
    concentration: 15000,
    countyFips: '24031',    // Montgomery County MD → HUC 02070010
  },
};

/* ------------------------------------------------------------------ */
/*  All Scenarios                                                     */
/* ------------------------------------------------------------------ */

export const ALL_SCENARIOS: Record<string, AttackScenario> = {
  'single-point-contamination': SINGLE_POINT_CONTAMINATION,
  'coordinated-multi-site': COORDINATED_MULTI_SITE,
  'slow-roll-poisoning': SLOW_ROLL_POISONING,
  'bio-threat-with-nwss': BIO_THREAT_WITH_NWSS,
};
