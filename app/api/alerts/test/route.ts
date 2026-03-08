/* ------------------------------------------------------------------ */
/*  PIN Alerts — Test Alert Endpoint                                  */
/*  POST: Send a test alert email to a specified address              */
/* ------------------------------------------------------------------ */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sendAlertEmail } from '@/lib/alerts/channels/email';
import { isAuthorized } from '@/lib/apiAuth';
import type { AlertEvent } from '@/lib/alerts/types';
import { alertTestSchema } from '@/lib/schemas';
import { parseBody } from '@/lib/validateRequest';

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = await parseBody(request, alertTestSchema);
  if (!parsed.success) return parsed.error;
  const { email } = parsed.data;

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

  if (result.logOnly) {
    return NextResponse.json({
      status: 'log_only',
      message: `PIN_ALERTS_LOG_ONLY is true — email was NOT sent to ${email}. Set PIN_ALERTS_LOG_ONLY=false to enable delivery.`,
    });
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ status: 'ok', message: `Test alert sent to ${email}` });
}
