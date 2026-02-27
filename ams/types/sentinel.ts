// =============================================================================
// PIN Sentinel System — Core Types
// PEARL Intelligence Network | Local Seafood Projects Inc.
// =============================================================================

// ---------------------------------------------------------------------------
// Tier 1: Change Event Types
// ---------------------------------------------------------------------------

export type DataSource =
  | "NWS_ALERTS"
  | "USGS_NWIS"
  | "STATE_SSO_CSO"
  | "NPDES_DMR"
  | "NWS_QPE_RAINFALL"
  | "ATTAINS"
  | "STATE_DISCHARGE"
  | "FEMA_DISASTER"
  | "EPA_ECHO";

export type ChangeType =
  | "NEW_RECORD"
  | "VALUE_CHANGE"
  | "THRESHOLD_CROSSED"
  | "DOCUMENT_UPDATED";

export type SeverityHint = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Geography {
  huc8?: string;
  huc6?: string;
  huc12?: string;
  stateFips?: string;
  lat?: number;
  lon?: number;
  assessmentUnitId?: string;
  facilityId?: string;
  watershedName?: string;
}

export interface ChangeEvent {
  eventId: string;
  source: DataSource;
  detectedAt: string; // ISO 8601
  sourceTimestamp: string | null;
  changeType: ChangeType;
  geography: Geography;
  severityHint: SeverityHint;
  payload: Record<string, unknown>;
  metadata: {
    pollCycleId: string;
    detectionMethod: "HASH_COMPARE" | "ETAG_COMPARE" | "NEW_ID" | "THRESHOLD";
    responseTimeMs: number;
    httpStatus?: number;
  };
}

// ---------------------------------------------------------------------------
// Tier 2: Scoring Types
// ---------------------------------------------------------------------------

export type SignalType =
  | "NWS_FLOOD_WARNING"
  | "NWS_FLOOD_WATCH"
  | "SSO_CSO_EVENT"
  | "NPDES_EXCEEDANCE"
  | "USGS_FLOOD_STAGE"
  | "USGS_ACTION_STAGE"
  | "RAINFALL_THRESHOLD"
  | "FEMA_DECLARATION"
  | "ATTAINS_CHANGE"
  | "ECHO_ENFORCEMENT"
  | "MULTI_STATION_EXCEEDANCE";

export type CompoundPattern =
  | "POTOMAC_PATTERN"
  | "INFRASTRUCTURE_STRESS"
  | "SPREADING_CONTAMINATION"
  | "REGULATORY_ESCALATION";

export type AlertLevel = "NORMAL" | "WATCH" | "ADVISORY" | "ALERT";

export interface ScoredSignal {
  changeEvent: ChangeEvent;
  signalType: SignalType;
  baseScore: number;
  freshnessMultiplier: number; // 0.1 - 1.0, decays over 48h
  effectiveScore: number; // baseScore * freshnessMultiplier
}

export interface CompoundMatch {
  pattern: CompoundPattern;
  label: string;
  matchedSignals: ScoredSignal[];
  multiplier: number;
  compoundScore: number;
}

export interface WatershedScore {
  huc8: string;
  watershedName: string;
  compositeScore: number;
  alertLevel: AlertLevel;
  signals: ScoredSignal[];
  compoundMatches: CompoundMatch[];
  firstSignalAt: string; // ISO 8601
  lastSignalAt: string;
  signalCount: number;
  affectedEntities: {
    shellfishBeds: string[];
    recreationalWaters: string[];
    drinkingWaterIntakes: string[];
    npdesPermits: string[];
  };
}

// ---------------------------------------------------------------------------
// AMS UI Types
// ---------------------------------------------------------------------------

export interface AlertSummary {
  total: number;
  byLevel: Record<AlertLevel, number>;
  highestScoringEvent: WatershedScore | null;
  recentEvents: WatershedScore[];
}

export interface SentinelHealth {
  source: DataSource;
  status: "HEALTHY" | "DEGRADED" | "OFFLINE";
  lastPollAt: string | null;
  consecutiveFailures: number;
  avgResponseTimeMs: number;
}

// ---------------------------------------------------------------------------
// Role-based filtering
// ---------------------------------------------------------------------------

export type PinRole =
  | "FEDERAL_OVERSIGHT"
  | "STATE_REGULATOR"
  | "MS4_MUNICIPAL"
  | "UTILITY_OPERATOR"
  | "RESEARCHER"
  | "PUBLIC";

export interface AlertFilter {
  role: PinRole;
  stateFips?: string[];
  huc8Codes?: string[];
  facilityIds?: string[];
  permitIds?: string[];
  minAlertLevel?: AlertLevel;
}
