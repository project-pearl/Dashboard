/* ------------------------------------------------------------------ */
/*  PIN Alerts — Email Channel (via Resend)                           */
/* ------------------------------------------------------------------ */

import { Resend } from 'resend';
import type { AlertEvent } from '../types';
import { ALERT_FLAGS, RESEND_API_KEY, ALERT_FROM_EMAIL, ALERT_FROM_NAME } from '../config';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  warning:  '#f59e0b',
  info:     '#3b82f6',
};

/* ------------------------------------------------------------------ */
/*  Send                                                              */
/* ------------------------------------------------------------------ */

export async function sendAlertEmail(
  event: AlertEvent,
): Promise<{ success: boolean; error?: string }> {
  if (ALERT_FLAGS.LOG_ONLY || !RESEND_API_KEY) {
    console.warn(`[Alerts] LOG_ONLY — would send "${event.title}" to ${event.recipientEmail}`);
    return { success: true };
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: `${ALERT_FROM_NAME} <${ALERT_FROM_EMAIL}>`,
      to: event.recipientEmail,
      subject: formatSubject(event),
      html: formatHtmlBody(event),
      text: formatTextBody(event),
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown send error' };
  }
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                        */
/* ------------------------------------------------------------------ */

function formatSubject(event: AlertEvent): string {
  return `[PIN ${event.severity.toUpperCase()}] ${event.title}`;
}

function formatHtmlBody(event: AlertEvent): string {
  const color = SEVERITY_COLORS[event.severity] || '#6b7280';
  const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pin-dashboard.com';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:${color};padding:16px 24px;">
      <h1 style="margin:0;font-size:18px;color:#fff;">
        ${event.severity.toUpperCase()}: ${escapeHtml(event.title)}
      </h1>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
        ${escapeHtml(event.body)}
      </p>
      <table style="font-size:13px;color:#6b7280;border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Entity</td><td>${escapeHtml(event.entityLabel)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600;">ID</td><td><code>${escapeHtml(event.entityId)}</code></td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Type</td><td>${event.type}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Time</td><td>${new Date(event.createdAt).toUTCString()}</td></tr>
      </table>
      <div style="margin-top:24px;">
        <a href="${dashboardUrl}" style="display:inline-block;padding:10px 20px;background:${color};color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
          View Dashboard
        </a>
      </div>
    </div>
    <div style="padding:12px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
      PIN Dashboard Alert System &mdash; You are receiving this because you are subscribed to ${event.type} alerts.
    </div>
  </div>
</body>
</html>`;
}

function formatTextBody(event: AlertEvent): string {
  return `[PIN ${event.severity.toUpperCase()}] ${event.title}

${event.body}

Entity: ${event.entityLabel} (${event.entityId})
Type: ${event.type}
Time: ${new Date(event.createdAt).toUTCString()}

View Dashboard: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://pin-dashboard.com'}

---
PIN Dashboard Alert System`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
