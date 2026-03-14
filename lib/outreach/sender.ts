/* ------------------------------------------------------------------ */
/*  PIN Outreach — Email Sender (via Resend)                          */
/*  Dispatches outreach emails with rate limiting                     */
/* ------------------------------------------------------------------ */

import { Resend } from 'resend';
import type { EmailDraft, OutreachContact, BusinessProfile, SendLogEntry } from './types';
import { OUTREACH_FLAGS, RESEND_API_KEY, OUTREACH_FROM_EMAIL, OUTREACH_FROM_NAME } from './config';
import { renderHtmlEmail, renderTextEmail, renderSubjectLine } from './emailRenderer';
import { appendSendLog } from './sendLog';

export async function sendOutreachEmail(
  draft: EmailDraft,
  contact: OutreachContact,
  profile: BusinessProfile,
  campaignId: string,
): Promise<{ success: boolean; error?: string; logOnly?: boolean }> {
  const subject = renderSubjectLine(draft, contact);
  const html = renderHtmlEmail(draft, contact, profile);
  const text = renderTextEmail(draft, contact, profile);

  const logEntry: SendLogEntry = {
    id: `send_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    campaignId,
    contactId: contact.id,
    contactEmail: contact.email,
    segmentId: draft.segmentId,
    subjectLine: subject,
    sentAt: new Date().toISOString(),
    success: false,
  };

  if (!RESEND_API_KEY) {
    console.warn(`[Outreach] No RESEND_API_KEY — email not sent to ${contact.email}`);
    logEntry.error = 'RESEND_API_KEY not configured';
    await appendSendLog(logEntry);
    return { success: false, error: 'RESEND_API_KEY is not configured' };
  }

  if (OUTREACH_FLAGS.LOG_ONLY) {
    console.log(`[Outreach] LOG_ONLY — would send "${subject}" to ${contact.email}`);
    logEntry.success = true;
    await appendSendLog(logEntry);
    return { success: true, logOnly: true };
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: `${OUTREACH_FROM_NAME} <${OUTREACH_FROM_EMAIL}>`,
      to: contact.email,
      subject,
      html,
      text,
    });

    if (error) {
      logEntry.error = error.message;
      await appendSendLog(logEntry);
      return { success: false, error: error.message };
    }

    logEntry.success = true;
    await appendSendLog(logEntry);
    return { success: true };
  } catch (err: any) {
    logEntry.error = err.message || 'Unknown send error';
    await appendSendLog(logEntry);
    return { success: false, error: logEntry.error };
  }
}
