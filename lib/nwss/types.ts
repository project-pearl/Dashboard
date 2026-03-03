/* ------------------------------------------------------------------ */
/*  CDC NWSS Pathogen Surveillance — Core Types                       */
/*                                                                    */
/*  Data is community-level wastewater surveillance from ~1,500 WWTPs */
/*  nationwide. No individual-identifiable data — concentrations are  */
/*  measured at the treatment plant (sewershed) level.                */
/*                                                                    */
/*  Concentration units: copies/L wastewater (raw) or                 */
/*  copies/person/day (flow-population normalized).                   */
/* ------------------------------------------------------------------ */

export type PathogenType = 'sars-cov-2' | 'influenza-a' | 'mpox' | 'rsv';

export const ALL_PATHOGENS: PathogenType[] = ['sars-cov-2', 'influenza-a', 'mpox', 'rsv'];

/** Socrata dataset IDs — verified live as of March 2026 */
export const DATASET_IDS: Record<PathogenType, string> = {
  'sars-cov-2':  'j9g8-acpt',
  'influenza-a': 'ymmh-divb',
  'mpox':        'xpxn-rzgz',
  'rsv':         '45cq-cw4i',
};

/** Region 3 EPA jurisdictions for validation scope */
export const REGION_3_STATES = ['DE', 'DC', 'MD', 'PA', 'VA', 'WV'] as const;

/* ------------------------------------------------------------------ */
/*  Core Record                                                       */
/* ------------------------------------------------------------------ */

export interface NWSSRecord {
  recordId: string;
  sewershedId: string;
  jurisdiction: string;               // state abbreviation (uppercase)
  countyFips: string;                 // FIPS code — primary join key to PIN
  countiesServed: string;
  populationServed: number;
  sampleCollectDate: string;          // ISO date (YYYY-MM-DD)
  pathogen: PathogenType;
  geneTarget: string;
  concentration: number | null;       // copies/L wastewater (raw)
  concentrationUnit: string;
  limitOfDetection: number | null;
  flowPopNormalized: number | null;   // copies/person/day (CDC-normalized)
  flowRate: number | null;            // MGD (million gallons/day)
  sampleType: string;
  dateUpdated: string;
}

/* ------------------------------------------------------------------ */
/*  Baseline & Anomaly Detection                                      */
/* ------------------------------------------------------------------ */

export interface NWSSSewershedBaseline {
  sewershedId: string;
  pathogen: PathogenType;
  rollingMean30d: number;             // 30-day rolling mean (normalized conc.)
  rollingStdDev30d: number;           // 30-day rolling std deviation
  lastUpdated: string;                // ISO date
  sampleCount: number;                // samples in the window
}

export type AnomalyLevel = 'normal' | 'elevated' | 'anomalous' | 'extreme';

export interface NWSSAnomaly {
  sewershedId: string;
  countyFips: string;
  pathogen: PathogenType;
  concentration: number;              // normalized value used for comparison
  baseline: number;                   // rolling mean
  sigma: number;                      // std deviations from baseline
  level: AnomalyLevel;
  date: string;
  populationServed: number;
  jurisdiction: string;
  countiesServed: string;
}

/* ------------------------------------------------------------------ */
/*  Cache Metadata                                                    */
/* ------------------------------------------------------------------ */

export interface NWSSPollState {
  lastPollAt: Record<PathogenType, string | null>;
  lastFullRefreshAt: string | null;
}

export interface NWSSCacheMeta {
  built: string;
  pathogenCounts: Record<PathogenType, number>;
  totalRecords: number;
  stateCount: number;
  sewershedCount: number;
  anomalyCount: number;
}

export interface NWSSCacheData {
  _meta: NWSSCacheMeta;
  records: Record<PathogenType, NWSSRecord[]>;
  baselines: Record<string, NWSSSewershedBaseline>;  // key: sewershedId_pathogen
  anomalies: NWSSAnomaly[];
  pollState: NWSSPollState;
}
