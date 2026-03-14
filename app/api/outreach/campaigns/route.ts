/* ------------------------------------------------------------------ */
/*  PIN Outreach — Campaigns List/Create                              */
/*  GET: list all, POST: create new campaign                          */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { parseBody } from '@/lib/validateRequest';
import { outreachCampaignCreateSchema } from '@/lib/schemas';
import { loadCampaigns, upsertCampaign } from '@/lib/outreach/campaignCache';
import type { Campaign } from '@/lib/outreach/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const campaigns = await loadCampaigns();
  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = await parseBody(request, outreachCampaignCreateSchema);
  if (!parsed.success) return parsed.error;

  const now = new Date().toISOString();
  const campaign: Campaign = {
    id: `camp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: parsed.data.name,
    goal: parsed.data.goal,
    segmentIds: parsed.data.segmentIds,
    emails: {},
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  await upsertCampaign(campaign);
  return NextResponse.json({ success: true, campaign });
}
