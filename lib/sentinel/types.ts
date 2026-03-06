/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Core Types                                         */
/* ------------------------------------------------------------------ */

export type ChangeSource =
  | 'NWS_ALERTS'
  | 'AIR_QUALITY'
  | 'NWPS_FLOOD'
  | 'NWPS_FORECAST'
  | 'USGS_IV'
  | 'SSO_CSO'
  | 'NPDES_DMR'
  | 'QPE_RAINFALL'
  | 'ATTAINS'
  | 'STATE_DISCHARGE'
  | 'FEMA_DISASTER'
  | 'ECHO_ENFORCEMENT'
  | 'CDC_NWSS'
  | 'HABSOS'
  | 'EPA_BEACON';

export type ChangeType =
  | 'NEW_RECORD'
  | 'VALUE_CHANGE'
  | 'THRESHOLD_CROSSED'
  | 'DOCUMENT_UPDATED';

export type SeverityHint = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type SourceStatus = 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
export type ScoreLevel = 'NOMINAL' | 'ADVISORY' | 'WATCH' | 'CRITICAL';

export interface BedSiteState {
  streak: number;
  lastProbability: number;
  lastSeverity?: SeverityHint;
  updatedAt: string;
}

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
    previousStatus?: string;
    currentStatus?: string;
    escalationType?: 'SNC_ENTRY' | 'QTRS_INCREASE' | 'STATUS_CHANGE';
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
  bedState?: Record<string, BedSiteState>; // key: siteNumber
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

/* ------------------------------------------------------------------ */
/*  Coordination Engine Types                                         */
/* ------------------------------------------------------------------ */

export interface CoordinatedEvent {
  id: string;
  huc6: string;
  memberHucs: string[];
  memberEvents: ChangeEvent[];
  coordinationScore: number;
  parameterBreadth: number;
  temporalSpread: number;         // ms between earliest and latest event
  detectedAt: string;
}

export interface ParameterDeviation {
  huc8: string;
  paramCd: string;
  value: number;
  zScore: number;
  baseline: { mean: number; stdDev: number };
}

/* ------------------------------------------------------------------ */
/*  Attack Classification Types                                       */
/* ------------------------------------------------------------------ */

export type AttackClassificationType =
  | 'likely_attack'
  | 'possible_attack'
  | 'likely_benign'
  | 'insufficient_data';

export interface ConfounderCheck {
  rule: string;
  matched: boolean;
  detail: string;
}

export interface ClassificationReasoning {
  rule: string;
  effect: 'reduce' | 'boost';
  magnitude: number;
  detail: string;
}

export interface AttackClassification {
  classification: AttackClassificationType;
  threatScore: number;
  confounders: ConfounderCheck[];
  reasoning: ClassificationReasoning[];
}

/* ------------------------------------------------------------------ */
/*  NWSS Correlation Types                                            */
/* ------------------------------------------------------------------ */

export interface NwssCorrelation {
  nwssAnomaly: {
    sewershedId: string;
    pathogen: string;
    sigma: number;
    concentration: number;
    date: string;
  };
  wqEvents: ChangeEvent[];
  correlationScore: number;
  parameterMatches: { paramCd: string; matchStrength: number }[];
  spatialMatch: 'same_huc' | 'adjacent_huc' | 'none';
  temporalGapHours: number;
  hucFlowTiming?: {
    expectedHours: number;
    windowHours: number;
    hops: number;
    distanceKm: number | null;
    routingMode: 'directed' | 'adjacency';
    lagDirection: 'downstream_lag' | 'reverse_lead';
  };
}

/* ------------------------------------------------------------------ */
/*  Enriched Alert Types                                              */
/* ------------------------------------------------------------------ */

export interface EnrichedAlert {
  affectedHucs: { huc8: string; name: string; state: string }[];
  parameterDeviations: ParameterDeviation[];
  coordinationContext: {
    coordinationScore: number;
    clusterSize: number;
    memberHucs: string[];
    temporalSpread: number;
  } | null;
  classification: AttackClassification | null;
  mapUrl: string;
  relatedEvents: ChangeEvent[];
  sourceHealth: { source: string; status: string }[];
}
