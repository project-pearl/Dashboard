/**
 * PIN Alerts — Core Types
 *
 * Shared type definitions for the alert dispatch engine, recipient management,
 * custom rules, suppressions, and dispatch results.
 */

/** Alert severity levels, ordered from most to least urgent. */
export type AlertSeverity = 'anomaly' | 'critical' | 'warning' | 'info';

/** Supported alert delivery channels. Currently email only. */
export type AlertChannel = 'email';

/** All supported alert trigger sources across Sentinel, USGS, ATTAINS, etc. */
export type AlertTriggerType = 'sentinel' | 'usgs' | 'delta' | 'attains' | 'nwss' | 'custom' | 'fusion' | 'coordination' | 'flood_forecast' | 'deployment' | 'hab' | 'beacon' | 'firms' | 'nws_weather' | 'pfas_proximity' | 'groundwater_anomaly' | 'multi_hazard';

/** A single alert event to be dispatched (or already dispatched) to a recipient. */
export interface AlertEvent {
  id: string;                    // uuid
  type: AlertTriggerType;
  severity: AlertSeverity;
  title: string;
  body: string;
  entityId: string;              // e.g., HUC code, source name, state abbr
  entityLabel: string;           // human-readable entity name
  dedupKey: string;              // type + entityId + severity
  createdAt: string;             // ISO
  channel: AlertChannel;
  recipientEmail: string;
  sent: boolean;
  sentAt: string | null;
  error: string | null;
  ruleId: string | null;         // which rule triggered this, if custom
  metadata: Record<string, unknown>;
}

/** A configured alert recipient with trigger and severity filters. */
export interface AlertRecipient {
  email: string;
  name: string;
  role: string;                  // 'admin' | 'Federal' | 'State' | etc.
  state: string | null;
  triggers: AlertTriggerType[];  // which trigger types they subscribe to
  severities: AlertSeverity[];   // minimum severity filter
  active: boolean;
}

/** A custom alert rule with a condition that triggers alerts when met. */
export interface AlertRule {
  id: string;
  name: string;
  triggerType: AlertTriggerType;
  condition: RuleCondition;
  severity: AlertSeverity;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
}

/** The condition evaluated by an {@link AlertRule} — compares a metric against a threshold. */
export interface RuleCondition {
  source: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
}

/** A suppression rule that silences alerts matching a dedupKey pattern. */
export interface AlertSuppression {
  id: string;
  dedupKey: string;              // pattern to suppress (supports wildcards)
  reason: string;
  expiresAt: string | null;      // null = permanent
  createdBy: string;
  createdAt: string;
}

/** Persistent log of all alert events with aggregate counters. */
export interface AlertLog {
  events: AlertEvent[];
  lastDispatchAt: string | null;
  totalSent: number;
  totalSuppressed: number;
  totalThrottled: number;
  totalErrors: number;
  totalLogged: number;
}

/** Summary returned by {@link dispatchAlerts} after processing a batch of candidates. */
export interface DispatchResult {
  sent: number;
  suppressed: number;
  errors: number;
  rateLimited: number;
  logged: number;
  throttled: number;
}
