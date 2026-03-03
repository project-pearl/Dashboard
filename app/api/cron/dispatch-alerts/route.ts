/* ------------------------------------------------------------------ */
/*  PIN Alerts — Dispatch Cron Route                                  */
/*  Runs every 5 min (offset +2 from sentinel crons).                 */
/*  Reads sentinel + delta state, evaluates rules, dispatches alerts. */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { ALERT_FLAGS, BUILD_LOCK_TIMEOUT_MS } from '@/lib/alerts/config';
import { dispatchAlerts } from '@/lib/alerts/engine';
import { evaluateSentinelAlerts } from '@/lib/alerts/triggers/sentinelTrigger';
import { evaluateDeltaAlerts } from '@/lib/alerts/triggers/deltaTrigger';
import { loadRules, evaluateRules } from '@/lib/alerts/rules';
import type { AlertEvent } from '@/lib/alerts/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/* ------------------------------------------------------------------ */
/*  Build Lock                                                        */
/* ------------------------------------------------------------------ */

let _buildInProgress = false;
let _buildStartedAt = 0;

function isBuildInProgress(): boolean {
  if (_buildInProgress && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[dispatch-alerts] Build lock auto-cleared (timeout)');
    _buildInProgress = false;
  }
  return _buildInProgress;
}

/* ------------------------------------------------------------------ */
/*  GET Handler                                                       */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ALERT_FLAGS.ENABLED) {
    return NextResponse.json({ status: 'disabled', reason: 'PIN_ALERTS_ENABLED=false' });
  }

  if (isBuildInProgress()) {
    return NextResponse.json({ status: 'skipped', reason: 'build in progress' });
  }

  _buildInProgress = true;
  _buildStartedAt = Date.now();

  try {
    const candidates: AlertEvent[] = [];

    // 1. Sentinel trigger
    try {
      const sentinelEvents = await evaluateSentinelAlerts();
      candidates.push(...sentinelEvents);
      console.warn(`[dispatch-alerts] Sentinel: ${sentinelEvents.length} candidates`);
    } catch (err: any) {
      console.warn(`[dispatch-alerts] Sentinel trigger error: ${err.message}`);
    }

    // 2. Delta trigger
    let ruleContext = { deltas: {} as Record<string, Record<string, number>>, sourceHealth: {} as Record<string, string> };
    try {
      const deltaResult = await evaluateDeltaAlerts();
      candidates.push(...deltaResult.events);
      ruleContext = deltaResult.ruleContext;
      console.warn(`[dispatch-alerts] Delta: ${deltaResult.events.length} candidates`);
    } catch (err: any) {
      console.warn(`[dispatch-alerts] Delta trigger error: ${err.message}`);
    }

    // 3. Custom rules
    try {
      const rules = await loadRules();
      if (rules.length > 0) {
        const ruleEvents = evaluateRules(rules, ruleContext);
        candidates.push(...ruleEvents);
        console.warn(`[dispatch-alerts] Rules: ${ruleEvents.length} candidates`);
      }
    } catch (err: any) {
      console.warn(`[dispatch-alerts] Rules engine error: ${err.message}`);
    }

    // 4. Dispatch all candidates
    const result = await dispatchAlerts(candidates);
    const durationMs = Date.now() - _buildStartedAt;

    console.warn(`[dispatch-alerts] Done in ${durationMs}ms: ${JSON.stringify(result)}`);

    return NextResponse.json({
      status: 'ok',
      candidates: candidates.length,
      ...result,
      durationMs,
    });
  } catch (err: any) {
    console.error(`[dispatch-alerts] Fatal error: ${err.message}`);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  } finally {
    _buildInProgress = false;
  }
}
