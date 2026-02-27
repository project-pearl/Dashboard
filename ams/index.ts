// =============================================================================
// PIN AMS (Alert Monitoring System) — Module Exports
// =============================================================================

// Types
export type {
  DataSource,
  ChangeType,
  SeverityHint,
  Geography,
  ChangeEvent,
  SignalType,
  CompoundPattern,
  AlertLevel,
  ScoredSignal,
  CompoundMatch,
  WatershedScore,
  AlertSummary,
  SentinelHealth,
  PinRole,
  AlertFilter,
} from "./types/sentinel";

// Scoring config
export {
  SIGNAL_BASE_SCORES,
  COMPOUND_PATTERNS,
  ALERT_THRESHOLDS,
  getAlertLevel,
  getFreshnessMultiplier,
  ADJACENT_HUC_BONUS,
  EVENT_WINDOW_HOURS,
  POLL_INTERVALS,
  ESCALATED_POLL_INTERVALS,
} from "./types/scoring-config";

// Components
export { default as AMSAlertMonitor } from "./components/AMSAlertMonitor";
export { default as GlobalAlertBadge } from "./components/GlobalAlertBadge";
export { default as SentinelHealthMonitor } from "./components/SentinelHealthMonitor";

// Hooks (real API — bridge sentinel-status → AMS types)
export { useAlertSummary } from "./hooks/useAlertSummary";
export { useSentinelHealth } from "./hooks/useSentinelHealth";

// Mock data (remove in production)
export { MOCK_ALERT_SUMMARY, MOCK_SENTINEL_HEALTH } from "./data/mock-alerts";
