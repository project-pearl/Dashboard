/* ------------------------------------------------------------------ */
/*  PIN Alerts — Custom Rules Engine                                  */
/*  Simple key-value condition matching (v1)                          */
/* ------------------------------------------------------------------ */

import type { AlertEvent, AlertRule, RuleCondition } from './types';
import { BLOB_PATHS } from './config';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';

let _rules: AlertRule[] | null = null;
let _blobChecked = false;

export async function loadRules(): Promise<AlertRule[]> {
  if (_rules) return _rules;
  if (!_blobChecked) {
    _blobChecked = true;
    const data = await loadCacheFromBlob<AlertRule[]>(BLOB_PATHS.rules);
    if (data && Array.isArray(data)) {
      _rules = data;
      return _rules;
    }
  }
  _rules = [];
  return _rules;
}

export async function saveRules(rules: AlertRule[]): Promise<void> {
  _rules = rules;
  await saveCacheToBlob(BLOB_PATHS.rules, rules);
}

/* ------------------------------------------------------------------ */
/*  Rule Context — current system state fed into rule evaluation      */
/* ------------------------------------------------------------------ */

export interface RuleContext {
  /** Cache deltas keyed by source name, e.g. { WQP: { delta_pct: 15 } } */
  deltas: Record<string, Record<string, number>>;
  /** Sentinel source statuses keyed by source name */
  sourceHealth: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/*  Evaluation                                                        */
/* ------------------------------------------------------------------ */

function evaluateCondition(condition: RuleCondition, context: RuleContext): boolean {
  const metrics = context.deltas[condition.source];
  if (!metrics) return false;

  const actual = metrics[condition.metric];
  if (actual === undefined) return false;

  switch (condition.operator) {
    case 'gt':  return actual > condition.value;
    case 'lt':  return actual < condition.value;
    case 'eq':  return actual === condition.value;
    case 'gte': return actual >= condition.value;
    case 'lte': return actual <= condition.value;
    default:    return false;
  }
}

export function evaluateRules(rules: AlertRule[], context: RuleContext): AlertEvent[] {
  const events: AlertEvent[] = [];
  const now = new Date().toISOString();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    if (evaluateCondition(rule.condition, context)) {
      events.push({
        id: crypto.randomUUID(),
        type: rule.triggerType,
        severity: rule.severity,
        title: `Rule triggered: ${rule.name}`,
        body: `Custom rule "${rule.name}" matched: ${rule.condition.source}.${rule.condition.metric} ${rule.condition.operator} ${rule.condition.value}`,
        entityId: rule.condition.source,
        entityLabel: rule.condition.source,
        dedupKey: `custom:${rule.id}:${rule.severity}`,
        createdAt: now,
        channel: 'email',
        recipientEmail: '',  // filled by engine per-recipient
        sent: false,
        sentAt: null,
        error: null,
        ruleId: rule.id,
        metadata: { rule: rule.condition },
      });
    }
  }

  return events;
}
