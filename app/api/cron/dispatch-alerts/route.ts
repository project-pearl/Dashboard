/* ------------------------------------------------------------------ */
/*  PIN Alerts — Dispatch Cron Route                                  */
/*  Runs every 5 min (offset +2 from sentinel crons).                 */
/*  Reads sentinel + delta state, evaluates rules, dispatches alerts. */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { ALERT_FLAGS, BUILD_LOCK_TIMEOUT_MS } from '@/lib/alerts/config';
import { dispatchAlerts } from '@/lib/alerts/engine';
import { evaluateSentinelAlerts } from '@/lib/alerts/triggers/sentinelTrigger';
import { evaluateUsgsAlerts } from '@/lib/alerts/triggers/usgsTrigger';
import { evaluateDeltaAlerts } from '@/lib/alerts/triggers/deltaTrigger';
import { evaluateNwssAlerts } from '@/lib/alerts/triggers/nwssTrigger';
import { evaluateFloodForecasts } from '@/lib/alerts/triggers/floodForecastTrigger';
import { evaluateDeploymentAlerts, type DeploymentInput } from '@/lib/alerts/triggers/deploymentTrigger';
import { evaluateHabAlerts } from '@/lib/alerts/triggers/habTrigger';
import { evaluateBeaconAlerts } from '@/lib/alerts/triggers/beaconTrigger';
import { evaluateFusionAlerts } from '@/lib/alerts/triggers/fusionTrigger';
import { evaluateFirmsAlerts } from '@/lib/alerts/triggers/firmsTrigger';
import { evaluateAttainsAlerts } from '@/lib/alerts/triggers/attainsTrigger';
import { evaluateNwsWeatherAlerts } from '@/lib/alerts/triggers/nwsWeatherTrigger';
import { loadRules, evaluateRules } from '@/lib/alerts/rules';
import type { AlertEvent } from '@/lib/alerts/types';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

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
  if (!isCronAuthorized(request)) {
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

    // 2. USGS IV threshold trigger
    try {
      const usgsEvents = await evaluateUsgsAlerts();
      candidates.push(...usgsEvents);
      console.warn(`[dispatch-alerts] USGS: ${usgsEvents.length} candidates`);
    } catch (err: any) {
      console.warn(`[dispatch-alerts] USGS trigger error: ${err.message}`);
    }

    // 3. Delta trigger
    let ruleContext = { deltas: {} as Record<string, Record<string, number>>, sourceHealth: {} as Record<string, string> };
    try {
      const deltaResult = await evaluateDeltaAlerts();
      candidates.push(...deltaResult.events);
      ruleContext = deltaResult.ruleContext;
      console.warn(`[dispatch-alerts] Delta: ${deltaResult.events.length} candidates`);
    } catch (err: any) {
      console.warn(`[dispatch-alerts] Delta trigger error: ${err.message}`);
    }

    // 4. NWSS pathogen anomaly trigger
    try {
      const nwssEvents = await evaluateNwssAlerts();
      candidates.push(...nwssEvents);
      console.warn(`[dispatch-alerts] NWSS: ${nwssEvents.length} candidates`);
    } catch (err: any) {
      console.warn(`[dispatch-alerts] NWSS trigger error: ${err.message}`);
    }

    // 5. Flood forecast trigger
    try {
      const forecastEvents = await evaluateFloodForecasts();
      candidates.push(...forecastEvents);
      console.warn(`[dispatch-alerts] Flood forecast: ${forecastEvents.length} candidates`);
    } catch (err: any) {
      console.warn(`[dispatch-alerts] Flood forecast trigger error: ${err.message}`);
    }

    // 6. Deployment sensor trigger
    try {
      // Fetch current deployment readings from the deployments API
      const depRes = await fetch(new URL('/api/deployments/readings', request.url).toString(), {
        headers: process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {},
      }).catch(() => null);
      if (depRes?.ok) {
        const depData = await depRes.json();
        const deploymentInputs: DeploymentInput[] = depData.deployments || [];
        if (deploymentInputs.length > 0) {
          const deploymentEvents = await evaluateDeploymentAlerts(deploymentInputs);
          candidates.push(...deploymentEvents);
          console.warn(`[dispatch-alerts] Deployment: ${deploymentEvents.length} candidates`);
        }
      }
    } catch (err: any) {
      console.warn(`[dispatch-alerts] Deployment trigger error: ${err.message}`);
    }

    // 7. HAB alert trigger
    try {
      const habEvents = await evaluateHabAlerts();
      candidates.push(...habEvents);
      console.warn(`[dispatch-alerts] HAB: ${habEvents.length} candidates`);
    } catch (err: any) {
      console.warn(`[dispatch-alerts] HAB trigger error: ${err.message}`);
    }

    // 8. BEACON beach advisory trigger
    try {
      const beaconEvents = await evaluateBeaconAlerts();
      candidates.push(...beaconEvents);
      console.warn(`[dispatch-alerts] BEACON: ${beaconEvents.length} candidates`);
    } catch (err: any) {
      console.warn(`[dispatch-alerts] BEACON trigger error: ${err.message}`);
    }

    // 9. Fusion cross-source anomaly trigger
    try {
      const fusionEvents = await evaluateFusionAlerts();
      candidates.push(...fusionEvents);
      console.warn(`[dispatch-alerts] Fusion: ${fusionEvents.length} candidates`);
    } catch (err: any) {
      console.warn(`[dispatch-alerts] Fusion trigger error: ${err.message}`);
    }

    // 10. FIRMS fire detection trigger
    try {
      const firmsEvents = await evaluateFirmsAlerts();
      candidates.push(...firmsEvents);
      console.warn(`[dispatch-alerts] FIRMS: ${firmsEvents.length} candidates`);
    } catch (err: any) {
      console.warn(`[dispatch-alerts] FIRMS trigger error: ${err.message}`);
    }

    // 11. ATTAINS impairment diff trigger
    try {
      const attainsEvents = await evaluateAttainsAlerts();
      candidates.push(...attainsEvents);
      console.warn(`[dispatch-alerts] ATTAINS: ${attainsEvents.length} candidates`);
    } catch (err: any) {
      console.warn(`[dispatch-alerts] ATTAINS trigger error: ${err.message}`);
    }

    // 12. NWS Weather trigger (tornado, flash flood near installations)
    try {
      const nwsWeatherEvents = await evaluateNwsWeatherAlerts();
      candidates.push(...nwsWeatherEvents);
      console.warn(`[dispatch-alerts] NWS Weather: ${nwsWeatherEvents.length} candidates`);
    } catch (err: any) {
      console.warn(`[dispatch-alerts] NWS Weather trigger error: ${err.message}`);
    }

    // 13. Custom rules
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

    // 14. Dispatch all candidates
    const result = await dispatchAlerts(candidates);
    const durationMs = Date.now() - _buildStartedAt;

    console.warn(`[dispatch-alerts] Done in ${durationMs}ms: ${JSON.stringify(result)}`);

    recordCronRun('dispatch-alerts', 'success', Date.now() - _buildStartedAt);

    return NextResponse.json({
      status: 'ok',
      candidates: candidates.length,
      ...result,
      durationMs,
    });
  } catch (err: any) {
    console.error(`[dispatch-alerts] Fatal error: ${err.message}`);

    Sentry.captureException(err, { tags: { cron: 'dispatch-alerts' } });

    notifySlackCronFailure({ cronName: 'dispatch-alerts', error: err.message || 'build failed', duration: Date.now() - _buildStartedAt });

    recordCronRun('dispatch-alerts', 'error', Date.now() - _buildStartedAt, err.message);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  } finally {
    _buildInProgress = false;
  }
}
