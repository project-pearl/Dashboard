/* ------------------------------------------------------------------ */
/*  PIN Alerts — Alert History Endpoint                               */
/*  GET: Return recent alert log                                      */
/* ------------------------------------------------------------------ */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { loadAlertLog } from '@/lib/alerts/engine';

export async function GET(request: NextRequest) {
  // Auth: require CRON_SECRET or session cookie
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const hasCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const hasSessionCookie = request.cookies.has('pin_session');

  if (!hasCronAuth && !hasSessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const log = await loadAlertLog();

  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
  const recentEvents = log.events.slice(-Math.min(limit, 500));

  return NextResponse.json({
    events: recentEvents,
    totalEvents: log.events.length,
    lastDispatchAt: log.lastDispatchAt,
    totalSent: log.totalSent,
    totalSuppressed: log.totalSuppressed,
    totalErrors: log.totalErrors,
  });
}
