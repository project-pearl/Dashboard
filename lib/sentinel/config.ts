/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Configuration (all scoring params externalized)    */
/* ------------------------------------------------------------------ */

import type { ChangeSource, SeverityHint, CompoundPattern, ScoreLevel } from './types';

/* ------------------------------------------------------------------ */
/*  Base Scores: source × severity → numeric weight                   */
/* ------------------------------------------------------------------ */

export const BASE_SCORES: Record<ChangeSource, Record<SeverityHint, number>> = {
  NWS_ALERTS:       { LOW: 10, MODERATE: 25, HIGH: 40, CRITICAL: 60 },
  NWPS_FLOOD:       { LOW: 10, MODERATE: 20, HIGH: 35, CRITICAL: 50 },
  USGS_IV:          { LOW:  5, MODERATE: 15, HIGH: 45, CRITICAL: 60 },
  SSO_CSO:          { LOW: 15, MODERATE: 30, HIGH: 50, CRITICAL: 70 },
  NPDES_DMR:        { LOW: 10, MODERATE: 20, HIGH: 35, CRITICAL: 50 },
  QPE_RAINFALL:     { LOW:  5, MODERATE: 15, HIGH: 30, CRITICAL: 45 },
  ATTAINS:          { LOW:  5, MODERATE: 10, HIGH: 20, CRITICAL: 30 },
  STATE_DISCHARGE:  { LOW: 10, MODERATE: 20, HIGH: 35, CRITICAL: 50 },
  FEMA_DISASTER:    { LOW: 15, MODERATE: 30, HIGH: 50, CRITICAL: 70 },
  ECHO_ENFORCEMENT: { LOW: 10, MODERATE: 25, HIGH: 40, CRITICAL: 55 },
};

/* ------------------------------------------------------------------ */
/*  Score Thresholds                                                  */
/* ------------------------------------------------------------------ */

export const SCORE_THRESHOLDS: { min: number; level: ScoreLevel }[] = [
  { min: 150, level: 'CRITICAL' },
  { min:  75, level: 'WATCH' },
  { min:  30, level: 'ADVISORY' },
  { min:   0, level: 'NOMINAL' },
];

export function scoreToLevel(score: number): ScoreLevel {
  for (const t of SCORE_THRESHOLDS) {
    if (score >= t.min) return t.level;
  }
  return 'NOMINAL';
}

/* ------------------------------------------------------------------ */
/*  Compound Patterns                                                 */
/* ------------------------------------------------------------------ */

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
];

/* ------------------------------------------------------------------ */
/*  Deduplication Windows                                             */
/* ------------------------------------------------------------------ */

export const DEDUP_WINDOWS = {
  sameSourceId_hours: 1,
  sameGeography_hours: 4,
  attainsCooldown_hours: 24,
  nwsAlertUpdateOnly: true, // re-score on severity change only
};

/* ------------------------------------------------------------------ */
/*  Time Decay & Geographic Correlation                               */
/* ------------------------------------------------------------------ */

export const TIME_DECAY_WINDOW_HOURS = 48;
export const TIME_DECAY_FLOOR = 0.1;
export const ADJACENT_HUC_BONUS = 1.5;

/* ------------------------------------------------------------------ */
/*  Polling Intervals (multiples of the base 5-min cron cycle)        */
/*  Value = how many 5-min cycles between polls for each source       */
/* ------------------------------------------------------------------ */

export const POLL_INTERVALS: Record<ChangeSource, number> = {
  NWS_ALERTS:       1,   // every 5 min
  NWPS_FLOOD:       1,   // every 5 min
  USGS_IV:          3,   // every 15 min
  SSO_CSO:          6,   // every 30 min
  NPDES_DMR:        6,   // every 30 min
  QPE_RAINFALL:     6,   // every 30 min
  ATTAINS:        288,   // once/day (288 × 5 min = 24h)
  STATE_DISCHARGE: 288,  // once/day
  FEMA_DISASTER:   12,   // every hour
  ECHO_ENFORCEMENT: 288, // once/day
};

/* ------------------------------------------------------------------ */
/*  Feature Flags (env-var driven)                                    */
/* ------------------------------------------------------------------ */

export const SENTINEL_FLAGS = {
  get ENABLED()  { return process.env.SENTINEL_ENABLED  !== 'false'; },
  get SCORING()  { return process.env.SENTINEL_SCORING  !== 'false'; },
  get LLM()      { return process.env.SENTINEL_LLM      === 'true'; },
  get LOG_ONLY() { return process.env.SENTINEL_LOG_ONLY  === 'true'; },
};

/* ------------------------------------------------------------------ */
/*  Blob / Disk Paths                                                 */
/* ------------------------------------------------------------------ */

export const BLOB_PATHS = {
  eventQueue:    'sentinel/event-queue.json',
  sourceHealth:  'sentinel/source-health.json',
  scoredHucs:    'sentinel/scored-hucs.json',
  pollCounter:   'sentinel/poll-counter.json',
  resolvedHucs:  'sentinel/resolved-hucs.json',
};

export const DISK_PATHS = {
  eventQueue:    '.cache/sentinel-event-queue.json',
  sourceHealth:  '.cache/sentinel-source-health.json',
  scoredHucs:    '.cache/sentinel-scored-hucs.json',
  pollCounter:   '.cache/sentinel-poll-counter.json',
  resolvedHucs:  '.cache/sentinel-resolved-hucs.json',
};
