/* ------------------------------------------------------------------ */
/*  PIN Outreach — Campaign Email Preview                             */
/*  POST: render email preview with sample token substitution         */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { getCampaign } from '@/lib/outreach/campaignCache';
import { loadProfile } from '@/lib/outreach/profileCache';
import { renderHtmlEmail, renderSubjectLine } from '@/lib/outreach/emailRenderer';
import type { OutreachContact } from '@/lib/outreach/types';

export const dynamic = 'force-dynamic';

const SAMPLE_CONTACT: OutreachContact = {
  id: 'preview',
  name: 'Jane Smith',
  email: 'jane.smith@example.gov',
  title: 'Environmental Program Manager',
  organization: 'State DEQ',
  state: 'CA',
  createdAt: new Date().toISOString(),
};

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

  let body: { segmentId?: string } = {};
  try {
    body = await request.json();
  } catch { /* empty body OK, use first segment */ }

  const segmentId = body.segmentId || campaign.segmentIds[0];
  const draft = campaign.emails[segmentId];
  if (!draft) {
    return NextResponse.json({ error: 'No email draft for this segment' }, { status: 404 });
  }

  const html = renderHtmlEmail(draft, SAMPLE_CONTACT, profile);
  const subject = renderSubjectLine(draft, SAMPLE_CONTACT);

  return NextResponse.json({ subject, html });
}
