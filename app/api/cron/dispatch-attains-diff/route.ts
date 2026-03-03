/* ------------------------------------------------------------------ */
/*  PIN Alerts — ATTAINS Diff Cron Route                              */
/*  Runs daily (after ATTAINS rebuild).                               */
/*  Compares ATTAINS snapshots, dispatches impairment diff alerts.    */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { ALERT_FLAGS, BUILD_LOCK_TIMEOUT_MS } from '@/lib/alerts/config';
import { dispatchAlerts } from '@/lib/alerts/engine';
import { evaluateAttainsAlerts } from '@/lib/alerts/triggers/attainsTrigger';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/* ------------------------------------------------------------------ */
/*  Build Lock                                                        */
/* ------------------------------------------------------------------ */

let _buildInProgress = false;
let _buildStartedAt = 0;

function isBuildInProgress(): boolean {
  if (_buildInProgress && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[dispatch-attains-diff] Build lock auto-cleared (timeout)');
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
    const candidates = await evaluateAttainsAlerts();
    console.warn(`[dispatch-attains-diff] ATTAINS: ${candidates.length} candidates`);

    const result = await dispatchAlerts(candidates);
    const durationMs = Date.now() - _buildStartedAt;

    console.warn(`[dispatch-attains-diff] Done in ${durationMs}ms: ${JSON.stringify(result)}`);

    return NextResponse.json({
      status: 'ok',
      candidates: candidates.length,
      ...result,
      durationMs,
    });
  } catch (err: any) {
    console.error(`[dispatch-attains-diff] Fatal error: ${err.message}`);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  } finally {
    _buildInProgress = false;
  }
}
