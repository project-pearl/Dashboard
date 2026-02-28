import type { IndexId } from './types';

/** Composite weights — 5 data-rich HUC-specific × 12% + 4 state-baseline × 10% = 100% */
export const INDEX_WEIGHTS: Record<IndexId, number> = {
  pearlLoadVelocity: 0.12,
  infrastructureFailure: 0.12,
  watershedRecovery: 0.12,
  permitRiskExposure: 0.12,
  perCapitaLoad: 0.12,
  waterfrontExposure: 0.10,
  ecologicalHealth: 0.10,
  ejVulnerability: 0.10,
  governanceResponse: 0.10,
};

/** Confidence tier thresholds */
export const CONFIDENCE = {
  HIGH: 70,
  MODERATE: 40,
  LOW: 0,
} as const;

/** At LOW confidence (< 40), scores regress this fraction toward neutral (50) */
export const LOW_CONFIDENCE_REGRESSION = 0.5;
export const NEUTRAL_SCORE = 50;

/** Confidence component weights */
export const CONFIDENCE_WEIGHTS = {
  dataDensity: 0.40,
  recency: 0.35,
  sourceDiversity: 0.25,
} as const;

/** Expected data points per HUC for density scoring */
export const EXPECTED_DATA_POINTS: Record<IndexId, number> = {
  pearlLoadVelocity: 20,       // ~20 WQP + DMR nutrient records expected
  infrastructureFailure: 30,   // SDWIS systems + violations + inspections
  watershedRecovery: 15,       // ATTAINS waterbodies per HUC
  permitRiskExposure: 25,      // ICIS permits + violations + DMRs
  perCapitaLoad: 20,           // SDWIS population + WQP nutrients + DMR records
  waterfrontExposure: 10,      // WQP hedonic params + ATTAINS + DMR records
  ecologicalHealth: 10,        // ATTAINS waterbodies + state T&E baseline
  ejVulnerability: 8,          // SDWIS systems + violations + enforcement
  governanceResponse: 15,      // ATTAINS + ICIS enforcement + permits + inspections
};

/** Expected unique data sources per index */
export const EXPECTED_SOURCES: Record<IndexId, number> = {
  pearlLoadVelocity: 2,       // WQP + ICIS DMR
  infrastructureFailure: 3,   // SDWIS + ICIS inspections
  watershedRecovery: 1,       // ATTAINS only
  permitRiskExposure: 3,      // ICIS permits + violations + DMR + enforcement
  perCapitaLoad: 3,           // SDWIS + WQP + ICIS DMR
  waterfrontExposure: 1,      // WQP + ATTAINS + DMR (state baseline always present)
  ecologicalHealth: 1,        // ATTAINS (state baseline always present)
  ejVulnerability: 2,         // SDWIS + state baseline
  governanceResponse: 3,      // ATTAINS + ICIS + SDWIS
};

/** Blob and disk persistence paths */
export const BLOB_PATH_INDICES = 'indices/huc-indices.json';
export const BLOB_PATH_HISTORY = 'indices/score-history.json';
export const DISK_PATH_INDICES = 'indices-cache.json';
export const DISK_PATH_HISTORY = 'indices-score-history.json';

/** Build lock timeout (12 min, matches existing pattern) */
export const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

/** Max score history entries per HUC (90 days) */
export const MAX_HISTORY_ENTRIES = 90;

/** Cron concurrency: HUCs processed in parallel per batch */
export const HUC_BATCH_SIZE = 10;
