/* ------------------------------------------------------------------ */
/*  PIN Alerts — Throttle Stats Endpoint                              */
/*  GET: Compute live stats from site throttle state + alert log      */
/* ------------------------------------------------------------------ */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { loadAlertLog } from '@/lib/alerts/engine';
import { loadSiteThrottleState } from '@/lib/alerts/siteThrottle';
import { SITE_COOLDOWN_MS, MAX_EMAILS_PER_HOUR } from '@/lib/alerts/config';
import { isAuthorized } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [siteState, log] = await Promise.all([
    loadSiteThrottleState(),
    loadAlertLog(),
  ]);

  const now = Date.now();
  const entries = Object.values(siteState.entries);

  let sitesInCooldown = 0;
  let sitesPending = 0;
  let sitesRecovered = 0;

  for (const entry of entries) {
    const firedRecently =
      entry.lastFiredAt && (now - new Date(entry.lastFiredAt).getTime()) < SITE_COOLDOWN_MS;

    if (firedRecently) {
      sitesInCooldown++;
    } else if (entry.consecutiveBreaches > 0 && entry.consecutiveBreaches < 2) {
      sitesPending++;
    } else if (entry.consecutiveBreaches === 0 && entry.lastFiredAt === null) {
      sitesRecovered++;
    }
  }

  // Count emails sent in the last hour
  const oneHourAgo = now - 60 * 60_000;
  const sentThisHour = log.events.filter(
    e => e.sent && e.sentAt && new Date(e.sentAt).getTime() > oneHourAgo,
  ).length;

  return NextResponse.json({
    totalTracked: entries.length,
    sitesInCooldown,
    sitesPending,
    sitesRecovered,
    totalThrottled: log.totalThrottled || 0,
    totalSuppressed: log.totalSuppressed || 0,
    sentThisHour,
    rateLimitCap: MAX_EMAILS_PER_HOUR,
  });
}
