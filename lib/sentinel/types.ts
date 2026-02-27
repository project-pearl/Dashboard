/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Core Types                                         */
/* ------------------------------------------------------------------ */

export type ChangeSource =
  | 'NWS_ALERTS'
  | 'NWPS_FLOOD'
  | 'USGS_IV'
  | 'SSO_CSO'
  | 'NPDES_DMR'
  | 'QPE_RAINFALL'
  | 'ATTAINS'
  | 'STATE_DISCHARGE'
  | 'FEMA_DISASTER'
  | 'ECHO_ENFORCEMENT';

export type ChangeType =
  | 'NEW_RECORD'
  | 'VALUE_CHANGE'
  | 'THRESHOLD_CROSSED'
  | 'DOCUMENT_UPDATED';

export type SeverityHint = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type SourceStatus = 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
export type ScoreLevel = 'NOMINAL' | 'ADVISORY' | 'WATCH' | 'CRITICAL';

/* ------------------------------------------------------------------ */
/*  Change Events                                                     */
/* ------------------------------------------------------------------ */

export interface ChangeEventGeography {
  huc8?: string;
  huc6?: string;       // derived: first 6 chars of huc8
  stateAbbr?: string;
  lat?: number;
  lng?: number;
}

export interface ChangeEvent {
  eventId: string;
  source: ChangeSource;
  detectedAt: string;           // ISO-8601
  sourceTimestamp: string | null;
  changeType: ChangeType;
  geography: ChangeEventGeography;
  severityHint: SeverityHint;
  payload: Record<string, unknown>;
  metadata: {
    sourceRecordId?: string;
    previousValue?: number;
    currentValue?: number;
    threshold?: number;
    facilityId?: string;
  };
}

/* ------------------------------------------------------------------ */
/*  Source Health Tracking                                             */
/* ------------------------------------------------------------------ */

export interface SentinelSourceState {
  source: ChangeSource;
  lastPollAt: string | null;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  status: SourceStatus;
  knownIds: string[];           // serialized; Set<string> at runtime
  lastHash?: string;
  lastEtag?: string;
  lastModified?: string;
  lastValues?: Record<string, number>;
  lastTimestamps?: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/*  Tier-2 Scoring                                                    */
/* ------------------------------------------------------------------ */

export interface ScoredEventRef {
  eventId: string;
  source: ChangeSource;
  baseScore: number;
  decayedScore: number;
}

export interface ActivePattern {
  patternId: string;
  multiplier: number;
  matchedEventIds: string[];
}

export interface ScoredHuc {
  huc8: string;
  stateAbbr: string;
  score: number;
  level: ScoreLevel;
  events: ScoredEventRef[];
  activePatterns: ActivePattern[];
  lastScored: string;           // ISO-8601
}

/* ------------------------------------------------------------------ */
/*  Compound Pattern Definition                                       */
/* ------------------------------------------------------------------ */

export interface CompoundPattern {
  id: string;
  name: string;
  multiplier: number;
  timeWindowHours: number;
  requireSameHuc: boolean;
  /** Each inner array = one "source group"; at least one event per group required */
  requiredSources: ChangeSource[][];
  minDistinctSources?: number;
  minDistinctHucs?: number;
}

/* ------------------------------------------------------------------ */
/*  Queue & Health Snapshots (for API responses)                      */
/* ------------------------------------------------------------------ */

export interface QueueStats {
  total: number;
  last1h: number;
  last6h: number;
  last24h: number;
  bySource: Partial<Record<ChangeSource, number>>;
}

export interface SentinelStatusResponse {
  sources: SentinelSourceState[];
  activeHucs: ScoredHuc[];
  queue: QueueStats;
  summary: {
    healthySources: number;
    degradedSources: number;
    offlineSources: number;
    criticalHucs: number;
    watchHucs: number;
    advisoryHucs: number;
  };
  recentResolutions?: ResolvedHuc[];
}

/* ------------------------------------------------------------------ */
/*  Adapter contract                                                  */
/* ------------------------------------------------------------------ */

export interface AdapterResult {
  events: ChangeEvent[];
  updatedState: Partial<SentinelSourceState>;
}

/* ------------------------------------------------------------------ */
/*  Resolved HUC (for briefing Layer 2)                               */
/* ------------------------------------------------------------------ */

export interface ResolvedHuc {
  huc8: string;
  stateAbbr: string;
  peakScore: number;
  peakLevel: ScoreLevel;
  resolvedAt: string;         // ISO-8601
  patternNames: string[];
}

/* ------------------------------------------------------------------ */
/*  Client-side scored HUC (subset for API response)                  */
/* ------------------------------------------------------------------ */

export interface ScoredHucClient {
  huc8: string;
  stateAbbr: string;
  score: number;
  level: ScoreLevel;
  eventCount: number;
  patternNames: string[];
  lastScored: string;
}
