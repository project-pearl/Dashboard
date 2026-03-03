/* ------------------------------------------------------------------ */
/*  PIN Alerts — Email Channel (via Resend)                           */
/* ------------------------------------------------------------------ */

import { Resend } from 'resend';
import type { AlertEvent } from '../types';
import type { EnrichedAlert } from '../../sentinel/types';
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
  enrichment?: EnrichedAlert,
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
      html: formatHtmlBody(event, enrichment),
      text: formatTextBody(event, enrichment),
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

function formatHtmlBody(event: AlertEvent, enrichment?: EnrichedAlert): string {
  const color = SEVERITY_COLORS[event.severity] || '#6b7280';
  const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pin-dashboard.com';

  const enrichmentSections = enrichment ? buildEnrichmentHtml(enrichment) : '';

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
      ${enrichmentSections}
      <div style="margin-top:24px;">
        <a href="${enrichment?.mapUrl || dashboardUrl}" style="display:inline-block;padding:10px 20px;background:${color};color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
          ${enrichment ? 'View on Map' : 'View Dashboard'}
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

function formatTextBody(event: AlertEvent, enrichment?: EnrichedAlert): string {
  let text = `[PIN ${event.severity.toUpperCase()}] ${event.title}

${event.body}

Entity: ${event.entityLabel} (${event.entityId})
Type: ${event.type}
Time: ${new Date(event.createdAt).toUTCString()}`;

  if (enrichment) {
    if (enrichment.affectedHucs.length > 0) {
      text += `\n\nAffected HUCs:\n${enrichment.affectedHucs.map(h => `  ${h.huc8} (${h.state})`).join('\n')}`;
    }
    if (enrichment.classification) {
      text += `\n\nClassification: ${enrichment.classification.classification.toUpperCase()} (threat: ${enrichment.classification.threatScore})`;
    }
    if (enrichment.coordinationContext) {
      text += `\n\nCoordination: score=${enrichment.coordinationContext.coordinationScore}, ${enrichment.coordinationContext.clusterSize} HUCs`;
    }
    text += `\n\nView Map: ${enrichment.mapUrl}`;
  } else {
    text += `\n\nView Dashboard: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://pin-dashboard.com'}`;
  }

  text += `\n\n---\nPIN Dashboard Alert System`;
  return text;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/*  Enrichment HTML Builder                                           */
/* ------------------------------------------------------------------ */

function buildEnrichmentHtml(enrichment: EnrichedAlert): string {
  const sections: string[] = [];
  const sectionStyle = 'margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;';
  const headingStyle = 'margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.05em;';
  const tableStyle = 'width:100%;font-size:12px;color:#6b7280;border-collapse:collapse;';
  const thStyle = 'padding:6px 8px;text-align:left;font-weight:600;background:#f9fafb;border-bottom:1px solid #e5e7eb;';
  const tdStyle = 'padding:6px 8px;border-bottom:1px solid #f3f4f6;';

  // 1. Affected HUCs table
  if (enrichment.affectedHucs.length > 0) {
    const rows = enrichment.affectedHucs.map(h =>
      `<tr><td style="${tdStyle}"><code>${escapeHtml(h.huc8)}</code></td><td style="${tdStyle}">${escapeHtml(h.name)}</td><td style="${tdStyle}">${escapeHtml(h.state)}</td></tr>`
    ).join('');
    sections.push(`
      <div style="${sectionStyle}">
        <h3 style="${headingStyle}">Affected Watersheds</h3>
        <table style="${tableStyle}">
          <tr><th style="${thStyle}">HUC-8</th><th style="${thStyle}">Name</th><th style="${thStyle}">State</th></tr>
          ${rows}
        </table>
      </div>
    `);
  }

  // 2. Parameter deviations table
  if (enrichment.parameterDeviations.length > 0) {
    const rows = enrichment.parameterDeviations.map(d => {
      const zColor = Math.abs(d.zScore) >= 3 ? '#dc2626' : Math.abs(d.zScore) >= 2 ? '#f59e0b' : '#6b7280';
      const status = Math.abs(d.zScore) >= 3 ? 'ANOMALOUS' : Math.abs(d.zScore) >= 2 ? 'ELEVATED' : 'NORMAL';
      return `<tr><td style="${tdStyle}"><code>${escapeHtml(d.paramCd)}</code></td><td style="${tdStyle}">${d.value.toFixed(2)}</td><td style="${tdStyle}">${d.baseline.mean.toFixed(2)}</td><td style="${tdStyle};color:${zColor};font-weight:600;">${d.zScore.toFixed(1)}&sigma;</td><td style="${tdStyle};color:${zColor};">${status}</td></tr>`;
    }).join('');
    sections.push(`
      <div style="${sectionStyle}">
        <h3 style="${headingStyle}">Parameter Deviations</h3>
        <table style="${tableStyle}">
          <tr><th style="${thStyle}">Param</th><th style="${thStyle}">Value</th><th style="${thStyle}">Baseline</th><th style="${thStyle}">Z-Score</th><th style="${thStyle}">Status</th></tr>
          ${rows}
        </table>
      </div>
    `);
  }

  // 3. Coordination summary
  if (enrichment.coordinationContext) {
    const c = enrichment.coordinationContext;
    const spreadMin = Math.round(c.temporalSpread / 60_000);
    sections.push(`
      <div style="${sectionStyle}">
        <h3 style="${headingStyle}">Coordination Analysis</h3>
        <table style="${tableStyle}">
          <tr><td style="${tdStyle};font-weight:600;">Score</td><td style="${tdStyle}">${c.coordinationScore.toFixed(2)}</td></tr>
          <tr><td style="${tdStyle};font-weight:600;">Cluster Size</td><td style="${tdStyle}">${c.clusterSize} HUCs</td></tr>
          <tr><td style="${tdStyle};font-weight:600;">Temporal Spread</td><td style="${tdStyle}">${spreadMin} min</td></tr>
          <tr><td style="${tdStyle};font-weight:600;">Involved HUCs</td><td style="${tdStyle}"><code>${c.memberHucs.join(', ')}</code></td></tr>
        </table>
      </div>
    `);
  }

  // 4. Classification badge
  if (enrichment.classification) {
    const cl = enrichment.classification;
    const badgeColors: Record<string, string> = {
      likely_attack: '#dc2626',
      possible_attack: '#f59e0b',
      likely_benign: '#22c55e',
      insufficient_data: '#9ca3af',
    };
    const badgeColor = badgeColors[cl.classification] || '#6b7280';
    const label = cl.classification.replace(/_/g, ' ').toUpperCase();

    const reasoningHtml = cl.reasoning.length > 0
      ? `<ul style="margin:8px 0 0;padding-left:20px;font-size:12px;color:#6b7280;">${cl.reasoning.map(r =>
          `<li>${r.effect === 'boost' ? '+' : '-'}${r.magnitude.toFixed(2)} ${escapeHtml(r.detail)}</li>`
        ).join('')}</ul>`
      : '';

    sections.push(`
      <div style="${sectionStyle}">
        <h3 style="${headingStyle}">Threat Classification</h3>
        <div style="display:inline-block;padding:4px 12px;background:${badgeColor};color:#fff;border-radius:4px;font-size:12px;font-weight:600;">
          ${label}
        </div>
        <span style="margin-left:8px;font-size:12px;color:#6b7280;">Threat score: ${cl.threatScore.toFixed(2)}</span>
        ${reasoningHtml}
      </div>
    `);
  }

  // 5. Related events
  if (enrichment.relatedEvents.length > 0) {
    const eventRows = enrichment.relatedEvents.slice(0, 10).map(e => {
      const time = new Date(e.detectedAt).toISOString().slice(0, 16).replace('T', ' ');
      return `<tr><td style="${tdStyle}">${time}</td><td style="${tdStyle}">${escapeHtml(e.source)}</td><td style="${tdStyle}"><code>${e.geography.huc8 || '—'}</code></td><td style="${tdStyle}">${escapeHtml(e.severityHint)}</td></tr>`;
    }).join('');
    sections.push(`
      <div style="${sectionStyle}">
        <h3 style="${headingStyle}">Related Events (24h)</h3>
        <table style="${tableStyle}">
          <tr><th style="${thStyle}">Time</th><th style="${thStyle}">Source</th><th style="${thStyle}">HUC</th><th style="${thStyle}">Severity</th></tr>
          ${eventRows}
        </table>
      </div>
    `);
  }

  return sections.join('');
}
