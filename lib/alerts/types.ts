/* ------------------------------------------------------------------ */
/*  PIN Alerts — Core Types                                           */
/* ------------------------------------------------------------------ */

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertChannel = 'email';
export type AlertTriggerType = 'sentinel' | 'delta' | 'attains' | 'nwss' | 'custom';

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

export interface AlertRecipient {
  email: string;
  name: string;
  role: string;                  // 'admin' | 'Federal' | 'State' | etc.
  state: string | null;
  triggers: AlertTriggerType[];  // which trigger types they subscribe to
  severities: AlertSeverity[];   // minimum severity filter
  active: boolean;
}

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

export interface RuleCondition {
  source: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
}

export interface AlertSuppression {
  id: string;
  dedupKey: string;              // pattern to suppress (supports wildcards)
  reason: string;
  expiresAt: string | null;      // null = permanent
  createdBy: string;
  createdAt: string;
}

export interface AlertLog {
  events: AlertEvent[];
  lastDispatchAt: string | null;
  totalSent: number;
  totalSuppressed: number;
  totalErrors: number;
}

export interface DispatchResult {
  sent: number;
  suppressed: number;
  errors: number;
  rateLimited: number;
}
