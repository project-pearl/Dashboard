// =============================================================================
// PIN Sentinel System — Scoring Configuration
// All tunable values externalized here. Adjust based on real-world calibration.
// =============================================================================

import type { SignalType, CompoundPattern, AlertLevel } from "./sentinel";

// ---------------------------------------------------------------------------
// Base signal scores
// ---------------------------------------------------------------------------

export const SIGNAL_BASE_SCORES: Record<SignalType, number> = {
  NWS_FLOOD_WARNING: 40,
  NWS_FLOOD_WATCH: 25,
  SSO_CSO_EVENT: 50,
  NPDES_EXCEEDANCE: 35,
  USGS_FLOOD_STAGE: 45,
  USGS_ACTION_STAGE: 20,
  RAINFALL_THRESHOLD: 30,
  FEMA_DECLARATION: 35,
  ATTAINS_CHANGE: 10,
  ECHO_ENFORCEMENT: 15,
  MULTI_STATION_EXCEEDANCE: 55,
};

// ---------------------------------------------------------------------------
// Compound pattern definitions
// ---------------------------------------------------------------------------

export interface PatternDefinition {
  pattern: CompoundPattern;
  label: string;
  description: string;
  requiredSignals: SignalType[][];
  // Each inner array is an OR group — need at least one from each group
  // All groups must match (AND across groups)
  timeWindowHours: number;
  sameHuc8Required: boolean;
  multiplier: number;
}

export const COMPOUND_PATTERNS: PatternDefinition[] = [
  {
    pattern: "POTOMAC_PATTERN",
    label: "Sewage + Weather + Downstream Impact",
    description:
      "Infrastructure failure combined with weather event affecting downstream resources. Mirrors the 2023 Potomac Interceptor signal profile.",
    requiredSignals: [
      ["SSO_CSO_EVENT"],
      ["NWS_FLOOD_WARNING", "RAINFALL_THRESHOLD"],
      // Third condition (downstream shellfish/recreational) checked via geography
    ],
    timeWindowHours: 24,
    sameHuc8Required: true,
    multiplier: 2.5,
  },
  {
    pattern: "INFRASTRUCTURE_STRESS",
    label: "Permit Violation + Flooding + Heavy Rain",
    description:
      "Multiple indicators of infrastructure under strain without confirmed sewage discharge.",
    requiredSignals: [
      ["NPDES_EXCEEDANCE"],
      ["USGS_FLOOD_STAGE", "USGS_ACTION_STAGE"],
      ["RAINFALL_THRESHOLD"],
    ],
    timeWindowHours: 12,
    sameHuc8Required: true,
    multiplier: 2.0,
  },
  {
    pattern: "SPREADING_CONTAMINATION",
    label: "Multi-Station Violations Across Watersheds",
    description:
      "Violations appearing across adjacent monitoring stations suggesting plume movement or widespread failure.",
    requiredSignals: [
      ["NPDES_EXCEEDANCE", "SSO_CSO_EVENT"],
      ["NPDES_EXCEEDANCE", "SSO_CSO_EVENT"],
      ["NPDES_EXCEEDANCE", "SSO_CSO_EVENT"],
      // Requires 3+ signals, cross-HUC check done in engine
    ],
    timeWindowHours: 24,
    sameHuc8Required: false, // cross-HUC is the whole point
    multiplier: 3.0,
  },
  {
    pattern: "REGULATORY_ESCALATION",
    label: "Enforcement + Active Violation + Weather",
    description:
      "Known bad actor with active enforcement compounding during a weather event.",
    requiredSignals: [
      ["ECHO_ENFORCEMENT"],
      ["NPDES_EXCEEDANCE"],
      ["NWS_FLOOD_WARNING", "NWS_FLOOD_WATCH", "RAINFALL_THRESHOLD"],
    ],
    timeWindowHours: 48,
    sameHuc8Required: true,
    multiplier: 1.8,
  },
];

// ---------------------------------------------------------------------------
// Alert level thresholds
// ---------------------------------------------------------------------------

export const ALERT_THRESHOLDS: { minScore: number; level: AlertLevel }[] = [
  { minScore: 150, level: "ALERT" },
  { minScore: 100, level: "ADVISORY" },
  { minScore: 50, level: "WATCH" },
  { minScore: 0, level: "NORMAL" },
];

export function getAlertLevel(score: number): AlertLevel {
  for (const threshold of ALERT_THRESHOLDS) {
    if (score >= threshold.minScore) return threshold.level;
  }
  return "NORMAL";
}

// ---------------------------------------------------------------------------
// Time decay
// ---------------------------------------------------------------------------

export const EVENT_WINDOW_HOURS = 48;
export const MIN_FRESHNESS = 0.1;

export function getFreshnessMultiplier(detectedAt: string): number {
  const hours =
    (Date.now() - new Date(detectedAt).getTime()) / (1000 * 60 * 60);
  if (hours >= EVENT_WINDOW_HOURS) return MIN_FRESHNESS;
  return Math.max(MIN_FRESHNESS, 1.0 - hours / EVENT_WINDOW_HOURS);
}

// ---------------------------------------------------------------------------
// Geographic correlation bonus
// ---------------------------------------------------------------------------

export const ADJACENT_HUC_BONUS = 1.5;

// ---------------------------------------------------------------------------
// Deduplication windows
// ---------------------------------------------------------------------------

export const DEDUP_SAME_RECORD_HOURS = 1;
export const DEDUP_SAME_GEO_HOURS = 4;
export const DEDUP_ATTAINS_COOLDOWN_HOURS = 24;

// ---------------------------------------------------------------------------
// Polling intervals (milliseconds)
// ---------------------------------------------------------------------------

export const POLL_INTERVALS = {
  NWS_ALERTS: 5 * 60 * 1000, // 5 min
  USGS_NWIS: 15 * 60 * 1000, // 15 min
  STATE_SSO_CSO: 15 * 60 * 1000,
  NPDES_DMR: 30 * 60 * 1000,
  NWS_QPE_RAINFALL: 15 * 60 * 1000,
  ATTAINS: 24 * 60 * 60 * 1000, // daily
  STATE_DISCHARGE: 30 * 60 * 1000,
  FEMA_DISASTER: 60 * 60 * 1000, // hourly
  EPA_ECHO: 24 * 60 * 60 * 1000, // daily
};

// Escalated intervals when WATCH+ is active in a HUC
export const ESCALATED_POLL_INTERVALS = {
  NWS_ALERTS: 2 * 60 * 1000, // 2 min
  USGS_NWIS: 5 * 60 * 1000,
  STATE_SSO_CSO: 5 * 60 * 1000,
  NPDES_DMR: 15 * 60 * 1000,
  NWS_QPE_RAINFALL: 5 * 60 * 1000,
  ATTAINS: 6 * 60 * 60 * 1000, // 6 hours
  STATE_DISCHARGE: 15 * 60 * 1000,
  FEMA_DISASTER: 30 * 60 * 1000,
  EPA_ECHO: 6 * 60 * 60 * 1000,
};
