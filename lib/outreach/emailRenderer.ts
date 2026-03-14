/* ------------------------------------------------------------------ */
/*  PIN Outreach — Email Renderer                                     */
/*  HTML + text email templates with token substitution               */
/* ------------------------------------------------------------------ */

import type { EmailDraft, OutreachContact, BusinessProfile } from './types';

/** Replace personalization tokens in a string. */
export function substituteTokens(
  text: string,
  contact: OutreachContact,
  extra?: Record<string, string>,
): string {
  let result = text;
  result = result.replace(/\{\{firstName\}\}/g, contact.name.split(' ')[0] || contact.name);
  result = result.replace(/\{\{name\}\}/g, contact.name);
  result = result.replace(/\{\{email\}\}/g, contact.email);
  result = result.replace(/\{\{organization\}\}/g, contact.organization || 'your organization');
  result = result.replace(/\{\{state\}\}/g, contact.state || 'your state');
  result = result.replace(/\{\{title\}\}/g, contact.title || '');
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
  }
  return result;
}

/** Wrap the AI-generated email body in a professional HTML shell. */
export function renderHtmlEmail(
  draft: EmailDraft,
  contact: OutreachContact,
  profile: BusinessProfile,
): string {
  const body = substituteTokens(draft.htmlBody, contact);
  const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pin-dashboard.com';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <div style="max-width:600px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="padding:24px;">
      ${body}
    </div>
    <div style="padding:12px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">
      ${escapeHtml(profile.name)} &mdash; ${escapeHtml(profile.tagline)}<br>
      <a href="${dashboardUrl}" style="color:#3b82f6;text-decoration:none;">${dashboardUrl}</a>
    </div>
  </div>
</body>
</html>`;
}

/** Render the plain text version with token substitution. */
export function renderTextEmail(
  draft: EmailDraft,
  contact: OutreachContact,
  profile: BusinessProfile,
): string {
  const body = substituteTokens(draft.textBody, contact);
  const dashboardUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pin-dashboard.com';
  return `${body}

---
${profile.name} — ${profile.tagline}
${dashboardUrl}`;
}

/** Get the selected subject line with token substitution. */
export function renderSubjectLine(
  draft: EmailDraft,
  contact: OutreachContact,
): string {
  const subject = draft.subjectLines[draft.selectedSubject] || draft.subjectLines[0];
  return substituteTokens(subject, contact);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
