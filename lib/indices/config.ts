import type { IndexId } from './types';

/** Composite weights — equal 25% each */
export const INDEX_WEIGHTS: Record<IndexId, number> = {
  pearlLoadVelocity: 0.25,
  infrastructureFailure: 0.25,
  watershedRecovery: 0.25,
  permitRiskExposure: 0.25,
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
};

/** Expected unique data sources per index */
export const EXPECTED_SOURCES: Record<IndexId, number> = {
  pearlLoadVelocity: 2,       // WQP + ICIS DMR
  infrastructureFailure: 3,   // SDWIS + ICIS inspections
  watershedRecovery: 1,       // ATTAINS only
  permitRiskExposure: 3,      // ICIS permits + violations + DMR + enforcement
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
