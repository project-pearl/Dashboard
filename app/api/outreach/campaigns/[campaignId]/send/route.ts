/* ------------------------------------------------------------------ */
/*  PIN Outreach — Campaign Send                                      */
/*  POST: send emails to selected contacts                            */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { parseBody } from '@/lib/validateRequest';
import { outreachSendSchema } from '@/lib/schemas';
import { getCampaign, upsertCampaign } from '@/lib/outreach/campaignCache';
import { loadProfile } from '@/lib/outreach/profileCache';
import { loadContacts } from '@/lib/outreach/contactCache';
import { sendOutreachEmail } from '@/lib/outreach/sender';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const profile = await loadProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Business profile not configured' }, { status: 400 });
  }

  const parsed = await parseBody(request, outreachSendSchema);
  if (!parsed.success) return parsed.error;

  const { contactIds, segmentId } = parsed.data;
  const draft = campaign.emails[segmentId];
  if (!draft) {
    return NextResponse.json({ error: 'No email draft for this segment' }, { status: 400 });
  }

  const allContacts = await loadContacts();
  const contacts = allContacts.filter(c => contactIds.includes(c.id));
  if (contacts.length === 0) {
    return NextResponse.json({ error: 'No matching contacts found' }, { status: 400 });
  }

  const results: { contactId: string; email: string; success: boolean; error?: string }[] = [];

  for (const contact of contacts) {
    const result = await sendOutreachEmail(draft, contact, profile, campaignId);
    results.push({
      contactId: contact.id,
      email: contact.email,
      success: result.success,
      error: result.error,
    });
    // Brief pause between sends to avoid rate limits
    if (contacts.length > 1) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  const successCount = results.filter(r => r.success).length;
  const newStatus = successCount === contacts.length ? 'sent' : successCount > 0 ? 'partial' : campaign.status;

  await upsertCampaign({
    ...campaign,
    status: newStatus,
    sentAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    sent: successCount,
    failed: contacts.length - successCount,
    results,
  });
}
