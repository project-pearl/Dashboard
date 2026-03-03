/* ------------------------------------------------------------------ */
/*  PIN Alerts — Cache Delta Trigger                                  */
/*  Monitors cache rebuild deltas for significant swings              */
/* ------------------------------------------------------------------ */

import type { AlertEvent, AlertSeverity } from '../types';
import type { CacheDelta } from '../../cacheUtils';
import type { RuleContext } from '../rules';

/* ------------------------------------------------------------------ */
/*  Cache status importers                                            */
/*  Each cache exports a status function with lastDelta               */
/* ------------------------------------------------------------------ */

import { getWqpCacheStatus, ensureWarmed as warmWqp } from '../../wqpCache';
import { getIcisCacheStatus, ensureWarmed as warmIcis } from '../../icisCache';
import { getEchoCacheStatus, ensureWarmed as warmEcho } from '../../echoCache';
import { getSdwisCacheStatus, ensureWarmed as warmSdwis } from '../../sdwisCache';
import { getNwisGwCacheStatus, ensureWarmed as warmNwisGw } from '../../nwisGwCache';
import { getCedenCacheStatus, ensureWarmed as warmCeden } from '../../cedenCache';
import { getCacheStatus as getAttainsCacheStatus, ensureWarmed as warmAttains } from '../../attainsCache';

interface DeltaSource {
  name: string;
  warm: () => Promise<void>;
  getDelta: () => CacheDelta | null | undefined;
}

const DELTA_SOURCES: DeltaSource[] = [
  { name: 'WQP',     warm: warmWqp,    getDelta: () => getWqpCacheStatus().lastDelta },
  { name: 'ICIS',    warm: warmIcis,   getDelta: () => getIcisCacheStatus().lastDelta },
  { name: 'ECHO',    warm: warmEcho,   getDelta: () => getEchoCacheStatus().lastDelta },
  { name: 'SDWIS',   warm: warmSdwis,  getDelta: () => getSdwisCacheStatus().lastDelta },
  { name: 'NWIS-GW', warm: warmNwisGw, getDelta: () => getNwisGwCacheStatus().lastDelta },
  { name: 'CEDEN',   warm: warmCeden,  getDelta: () => getCedenCacheStatus().lastDelta },
  { name: 'ATTAINS', warm: warmAttains, getDelta: () => getAttainsCacheStatus().lastDelta },
];

const SWING_WARNING_PCT = 10;   // >10% change → warning
const DROP_CRITICAL_PCT = 50;   // >50% drop → critical

/* ------------------------------------------------------------------ */
/*  Evaluate                                                          */
/* ------------------------------------------------------------------ */

export async function evaluateDeltaAlerts(): Promise<{ events: AlertEvent[]; ruleContext: RuleContext }> {
  const events: AlertEvent[] = [];
  const now = new Date().toISOString();
  const ruleContext: RuleContext = { deltas: {}, sourceHealth: {} };

  for (const src of DELTA_SOURCES) {
    try {
      await src.warm();
    } catch {
      // Non-fatal — cache may be cold
    }

    const delta = src.getDelta();
    if (!delta || !delta.dataChanged) continue;

    // Build rule context for custom rules
    const metrics: Record<string, number> = {};

    for (const [key, counts] of Object.entries(delta.counts)) {
      if (counts.before === 0) continue; // skip new-from-zero

      const pctChange = Math.round(((counts.after - counts.before) / counts.before) * 100);
      metrics[`${key}_delta_pct`] = pctChange;
      metrics[`${key}_before`] = counts.before;
      metrics[`${key}_after`] = counts.after;

      const absPct = Math.abs(pctChange);

      // >50% drop → critical
      if (pctChange < -DROP_CRITICAL_PCT) {
        events.push(makeDeltaAlert(src.name, key, counts, pctChange, 'critical', now));
      }
      // >10% swing → warning
      else if (absPct > SWING_WARNING_PCT) {
        events.push(makeDeltaAlert(src.name, key, counts, pctChange, 'warning', now));
      }
    }

    if (Object.keys(metrics).length > 0) {
      ruleContext.deltas[src.name] = metrics;
    }
  }

  return { events, ruleContext };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function makeDeltaAlert(
  sourceName: string,
  metric: string,
  counts: { before: number; after: number; diff: number },
  pctChange: number,
  severity: AlertSeverity,
  now: string,
): AlertEvent {
  const direction = pctChange > 0 ? 'increase' : 'decrease';
  return {
    id: crypto.randomUUID(),
    type: 'delta',
    severity,
    title: `${sourceName} ${metric}: ${Math.abs(pctChange)}% ${direction}`,
    body: `Cache ${sourceName} metric "${metric}" changed from ${counts.before} to ${counts.after} (${pctChange > 0 ? '+' : ''}${pctChange}%).`,
    entityId: `${sourceName}:${metric}`,
    entityLabel: `${sourceName} — ${metric}`,
    dedupKey: `delta:${sourceName}:${metric}:${severity}`,
    createdAt: now,
    channel: 'email',
    recipientEmail: '',
    sent: false,
    sentAt: null,
    error: null,
    ruleId: null,
    metadata: { before: counts.before, after: counts.after, pctChange },
  };
}
