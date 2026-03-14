/* ------------------------------------------------------------------ */
/*  PIN Outreach — Business Profile API                               */
/*  GET: load profile, PUT: save profile                              */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { parseBody } from '@/lib/validateRequest';
import { outreachProfileSchema } from '@/lib/schemas';
import { loadProfile, saveProfile } from '@/lib/outreach/profileCache';
import type { BusinessProfile } from '@/lib/outreach/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const profile = await loadProfile();
  return NextResponse.json({ profile });
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = await parseBody(request, outreachProfileSchema);
  if (!parsed.success) return parsed.error;

  const d = parsed.data;
  const profile: BusinessProfile = {
    name: d.name,
    tagline: d.tagline,
    website: d.website,
    valueProps: d.valueProps,
    stats: d.stats ?? [],
    differentiators: d.differentiators ?? [],
    updatedAt: new Date().toISOString(),
  };

  await saveProfile(profile);
  return NextResponse.json({ success: true, profile });
}
