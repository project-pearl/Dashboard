/**
 * PIN Sentinel — Configuration
 *
 * All scoring parameters externalized: base scores per source/severity,
 * score thresholds, compound multi-hazard patterns, dedup windows,
 * time decay, polling intervals, feature flags, and persistence paths.
 */

import type { ChangeSource, SeverityHint, CompoundPattern, ScoreLevel } from './types';

/* ------------------------------------------------------------------ */
/*  Base Scores: source × severity → numeric weight                   */
/* ------------------------------------------------------------------ */

/** Numeric weight matrix mapping each change source and severity hint to a base score. */
export const BASE_SCORES: Record<ChangeSource, Record<SeverityHint, number>> = {
  NWS_ALERTS:       { LOW: 10, MODERATE: 25, HIGH: 40, CRITICAL: 60 },
  AIR_QUALITY:      { LOW:  5, MODERATE: 15, HIGH: 30, CRITICAL: 45 },
  NWPS_FLOOD:       { LOW: 10, MODERATE: 20, HIGH: 35, CRITICAL: 50 },
  NWPS_FORECAST:    { LOW:  5, MODERATE: 20, HIGH: 40, CRITICAL: 55 },
  USGS_IV:          { LOW:  5, MODERATE: 15, HIGH: 45, CRITICAL: 60 },
  SSO_CSO:          { LOW: 15, MODERATE: 30, HIGH: 50, CRITICAL: 70 },
  NPDES_DMR:        { LOW: 10, MODERATE: 20, HIGH: 35, CRITICAL: 50 },
  QPE_RAINFALL:     { LOW:  5, MODERATE: 15, HIGH: 30, CRITICAL: 45 },
  ATTAINS:          { LOW:  1, MODERATE:  3, HIGH:  8, CRITICAL: 15 },
  STATE_DISCHARGE:  { LOW: 10, MODERATE: 20, HIGH: 35, CRITICAL: 50 },
  FEMA_DISASTER:    { LOW: 15, MODERATE: 30, HIGH: 50, CRITICAL: 70 },
  ECHO_ENFORCEMENT: { LOW: 10, MODERATE: 25, HIGH: 40, CRITICAL: 55 },
  CDC_NWSS:         { LOW:  5, MODERATE: 15, HIGH: 35, CRITICAL: 55 },
  HABSOS:           { LOW: 10, MODERATE: 25, HIGH: 45, CRITICAL: 65 },
  EPA_BEACON:       { LOW: 10, MODERATE: 30, HIGH: 50, CRITICAL: 70 },
};

/* ------------------------------------------------------------------ */
/*  Score Thresholds                                                  */
/* ------------------------------------------------------------------ */

/** Ordered thresholds mapping cumulative scores to Sentinel levels (CRITICAL→NOMINAL). */
export const SCORE_THRESHOLDS: { min: number; level: ScoreLevel }[] = [
  { min: 300, level: 'ANOMALY' },
  { min: 150, level: 'CRITICAL' },
  { min:  75, level: 'WATCH' },
  { min:  30, level: 'ADVISORY' },
  { min:   0, level: 'NOMINAL' },
];

/**
 * Map a cumulative Sentinel score to a threat level.
 *
 * @param score - Cumulative score for a HUC region
 * @returns The corresponding {@link ScoreLevel} (CRITICAL | WATCH | ADVISORY | NOMINAL)
 */
export function scoreToLevel(score: number): ScoreLevel {
  for (const t of SCORE_THRESHOLDS) {
    if (score >= t.min) return t.level;
  }
  return 'NOMINAL';
}

/* ------------------------------------------------------------------ */
/*  Compound Patterns                                                 */
/* ------------------------------------------------------------------ */

/** Multi-hazard compound patterns that apply score multipliers when co-occurring events match. */
export const COMPOUND_PATTERNS: CompoundPattern[] = [
  {
    id: 'potomac-crisis',
    name: 'Potomac Multi-Hazard',
    multiplier: 2.5,
    timeWindowHours: 24,
    requireSameHuc: false,
    requiredSources: [
      ['NWS_ALERTS', 'NWPS_FLOOD'],
      ['SSO_CSO', 'NPDES_DMR'],
    ],
    minDistinctSources: 2,
    minDistinctHucs: 1,
  },
  {
    id: 'infrastructure-stress',
    name: 'Infrastructure Stress',
    multiplier: 2.0,
    timeWindowHours: 12,
    requireSameHuc: true,
    requiredSources: [
      ['SSO_CSO'],
      ['QPE_RAINFALL', 'NWPS_FLOOD'],
    ],
  },
  {
    id: 'spreading-contamination',
    name: 'Spreading Contamination',
    multiplier: 3.0,
    timeWindowHours: 48,
    requireSameHuc: false,
    requiredSources: [
      ['NPDES_DMR', 'SSO_CSO', 'ECHO_ENFORCEMENT'],
    ],
    minDistinctHucs: 2,
  },
  {
    id: 'regulatory-escalation',
    name: 'Regulatory Escalation',
    multiplier: 1.8,
    timeWindowHours: 48,
    requireSameHuc: true,
    requiredSources: [
      ['NPDES_DMR'],
      ['ECHO_ENFORCEMENT'],
    ],
  },
  {
    id: 'enforcement-cascade',
    name: 'Enforcement Cascade',
    multiplier: 2.2,
    timeWindowHours: 72,
    requireSameHuc: false,
    requiredSources: [
      ['ECHO_ENFORCEMENT'],
      ['NPDES_DMR'],
    ],
    minDistinctSources: 2,
  },
  {
    id: 'bio-threat-correlation',
    name: 'Bio-Threat Correlation',
    multiplier: 3.5,
    timeWindowHours: 168,           // 7 days (NWSS data is weekly)
    requireSameHuc: false,
    requiredSources: [
      ['CDC_NWSS'],
      ['USGS_IV', 'SSO_CSO', 'NPDES_DMR'],
    ],
    minDistinctSources: 2,
  },
  {
    id: 'flood-prediction-cascade',
    name: 'Flood Prediction Cascade',
    multiplier: 3.0,
    timeWindowHours: 24,
    requireSameHuc: false,
    requiredSources: [
      ['NWPS_FORECAST'],
      ['QPE_RAINFALL', 'NWPS_FLOOD'],   // rainfall or active flood warning
    ],
    minDistinctSources: 2,
  },
  {
    id: 'airborne-public-health',
    name: 'Airborne Public Health Risk',
    multiplier: 2.0,
    timeWindowHours: 12,
    requireSameHuc: false,
    requiredSources: [
      ['AIR_QUALITY'],
      ['NWS_ALERTS'],
    ],
    minDistinctSources: 2,
  },
  {
    id: 'predicted-infrastructure-failure',
    name: 'Predicted Infrastructure Failure',
    multiplier: 2.5,
    timeWindowHours: 24,
    requireSameHuc: true,
    requiredSources: [
      ['NWPS_FORECAST'],
      ['SSO_CSO', 'NPDES_DMR'],          // infrastructure stress during predicted flood
    ],
    minDistinctSources: 2,
  },
  {
    id: 'hab-wq-correlation',
    name: 'HAB Water Quality Correlation',
    multiplier: 2.5,
    timeWindowHours: 72,
    requireSameHuc: false,
    requiredSources: [
      ['HABSOS'],
      ['USGS_IV'],
    ],
    minDistinctSources: 2,
  },
  {
    id: 'beach-pathogen-wq',
    name: 'Beach Pathogen Water Quality',
    multiplier: 2.0,
    timeWindowHours: 48,
    requireSameHuc: false,
    requiredSources: [
      ['EPA_BEACON'],
      ['USGS_IV', 'CDC_NWSS'],
    ],
    minDistinctSources: 2,
  },
];

/* ------------------------------------------------------------------ */
/*  Deduplication Windows                                             */
/* ------------------------------------------------------------------ */

/** Deduplication time windows (hours) to prevent redundant event scoring. */
export const DEDUP_WINDOWS = {
  sameSourceId_hours: 1,
  sameGeography_hours: 4,
  attainsCooldown_hours: 120,
  echoEscalationCooldown_hours: 24,
  nwsAlertUpdateOnly: true, // re-score on severity change only
};

/* ------------------------------------------------------------------ */
/*  Time Decay & Geographic Correlation                               */
/* ------------------------------------------------------------------ */

/** Hours over which event scores decay toward the floor. */
export const TIME_DECAY_WINDOW_HOURS = 48;
/** Minimum decay multiplier (events never fully zero out within the window). */
export const TIME_DECAY_FLOOR = 0.1;
/** Score multiplier applied when events occur in adjacent HUC regions. */
export const ADJACENT_HUC_BONUS = 1.5;

/* ------------------------------------------------------------------ */
/*  Polling Intervals (multiples of the base 5-min cron cycle)        */
/*  Value = how many 5-min cycles between polls for each source       */
/* ------------------------------------------------------------------ */

/** Polling intervals per source, in multiples of the base 5-min sentinel-poll cron cycle. */
export const POLL_INTERVALS: Record<ChangeSource, number> = {
  NWS_ALERTS:       1,   // every 5 min
  AIR_QUALITY:      6,   // every 30 min
  NWPS_FLOOD:       1,   // every 5 min
  NWPS_FORECAST:    6,   // every 30 min (matches rebuild-nwps cron)
  USGS_IV:          3,   // every 15 min
  SSO_CSO:          6,   // every 30 min
  NPDES_DMR:        6,   // every 30 min
  QPE_RAINFALL:     6,   // every 30 min
  ATTAINS:        288,   // once/day (288 × 5 min = 24h)
  STATE_DISCHARGE: 288,  // once/day
  FEMA_DISASTER:   12,   // every hour
  ECHO_ENFORCEMENT: 288, // once/day
  CDC_NWSS:        2016, // weekly (2016 × 5 min ≈ 7 days)
  HABSOS:           288, // once/day
  EPA_BEACON:       288, // once/day
};

/* ------------------------------------------------------------------ */
/*  Feature Flags (env-var driven)                                    */
/* ------------------------------------------------------------------ */

/** Runtime feature flags for Sentinel (read from environment variables). */
export const SENTINEL_FLAGS = {
  get ENABLED()  { return process.env.SENTINEL_ENABLED  !== 'false'; },
  get SCORING()  { return process.env.SENTINEL_SCORING  !== 'false'; },
  get LLM()      { return process.env.SENTINEL_LLM      === 'true'; },
  get LOG_ONLY() { return process.env.SENTINEL_LOG_ONLY  === 'true'; },
};

/* ------------------------------------------------------------------ */
/*  Blob / Disk Paths                                                 */
/* ------------------------------------------------------------------ */

/** Vercel Blob storage paths for Sentinel persistence. */
export const BLOB_PATHS = {
  eventQueue:      'sentinel/event-queue.json',
  sourceHealth:    'sentinel/source-health.json',
  scoredHucs:      'sentinel/scored-hucs.json',
  pollCounter:     'sentinel/poll-counter.json',
  resolvedHucs:    'sentinel/resolved-hucs.json',
  baselines:       'sentinel/parameter-baselines.json',
  coordination:    'sentinel/coordination-state.json',
};

/** Local disk paths for Sentinel cache persistence. */
export const DISK_PATHS = {
  eventQueue:      '.cache/sentinel-event-queue.json',
  sourceHealth:    '.cache/sentinel-source-health.json',
  scoredHucs:      '.cache/sentinel-scored-hucs.json',
  pollCounter:     '.cache/sentinel-poll-counter.json',
  resolvedHucs:    '.cache/sentinel-resolved-hucs.json',
  baselines:       '.cache/sentinel-baselines.json',
  coordination:    '.cache/sentinel-coordination.json',
};
