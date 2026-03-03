/* ------------------------------------------------------------------ */
/*  PIN Alerts — Test Alert Endpoint                                  */
/*  POST: Send a test alert email to a specified address              */
/* ------------------------------------------------------------------ */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sendAlertEmail } from '@/lib/alerts/channels/email';
import type { AlertEvent } from '@/lib/alerts/types';

export async function POST(request: NextRequest) {
  // Auth: require CRON_SECRET or session cookie
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const hasCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const hasSessionCookie = request.cookies.has('pin_session');

  if (!hasCronAuth && !hasSessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = body.email;
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email field required' }, { status: 400 });
  }

  const testEvent: AlertEvent = {
    id: crypto.randomUUID(),
    type: 'sentinel',
    severity: 'info',
    title: 'Test Alert from PIN Dashboard',
    body: 'This is a test alert to verify your email notification setup is working correctly.',
    entityId: 'test',
    entityLabel: 'Test Entity',
    dedupKey: `test:${Date.now()}`,
    createdAt: new Date().toISOString(),
    channel: 'email',
    recipientEmail: email,
    sent: false,
    sentAt: null,
    error: null,
    ruleId: null,
    metadata: { test: true },
  };

  const result = await sendAlertEmail(testEvent);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ status: 'ok', message: `Test alert sent to ${email}` });
}
