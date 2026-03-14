/* ------------------------------------------------------------------ */
/*  PIN Outreach — Single Campaign GET/PUT                            */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { parseBody } from '@/lib/validateRequest';
import { outreachCampaignUpdateSchema } from '@/lib/schemas';
import { getCampaign, upsertCampaign } from '@/lib/outreach/campaignCache';

export const dynamic = 'force-dynamic';

export async function GET(
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

  return NextResponse.json({ campaign });
}

export async function PUT(
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

  const parsed = await parseBody(request, outreachCampaignUpdateSchema);
  if (!parsed.success) return parsed.error;

  const updated = {
    ...campaign,
    ...parsed.data,
    emails: parsed.data.emails
      ? { ...campaign.emails, ...(parsed.data.emails as Record<string, any>) }
      : campaign.emails,
    updatedAt: new Date().toISOString(),
  };

  await upsertCampaign(updated);
  return NextResponse.json({ success: true, campaign: updated });
}
