// app/api/nws-alerts/route.ts
// Serves NWS weather alert data from existing nwsAlertCache.
// No new cache or cron — NWS alerts are already refreshed every 30 minutes.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ensureWarmed, getNwsAlerts, getNwsAlertsAll } from '@/lib/nwsAlertCache';

const SEVERITY_ORDER: Record<string, number> = {
  Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4,
};

export async function GET(request: NextRequest) {
  await ensureWarmed();

  const state = request.nextUrl.searchParams.get('state')?.toUpperCase();

  const alerts = state ? (getNwsAlerts(state) ?? []) : getNwsAlertsAll();

  const severityCounts: Record<string, number> = { Extreme: 0, Severe: 0, Moderate: 0, Minor: 0, Unknown: 0 };
  for (const a of alerts) {
    const sev = a.severity in severityCounts ? a.severity : 'Unknown';
    severityCounts[sev]++;
  }

  const topAlerts = [...alerts]
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4))
    .slice(0, 20)
    .map(a => ({
      id: a.id,
      event: a.event,
      severity: a.severity,
      areaDesc: a.areaDesc,
      onset: a.onset,
      expires: a.expires,
      headline: a.headline,
    }));

  return NextResponse.json({
    totalAlerts: alerts.length,
    severityCounts,
    topAlerts,
  });
}
